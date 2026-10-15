'use strict';

const fs = require('fs');
const path = require('path');
const { commandAccess } = require('./privacy-command-analysis.cjs');

const RESTRICTED = [
  /^\.env(?:[.\[*?{]|$)/i,
  /^credentials/i,
  /secrets?\.(ya?ml|json)$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)$/i,
  /\.netrc$/i,
  /\.pgpass$/i,
  /kubeconfig/i,
  /\.keystore$/i,
  /\.jks$/i,
  /auth\.json$/i,
  /token(s)?\.json$/i
];

const EXEMPT = [/\.env\.(example|sample|template|test)$/i];

function matchesAny(filePath, rules) {
  const base = path.basename(filePath);
  return rules.some((rule) => rule.test(base) || rule.test(filePath));
}

function isSafe(filePath) {
  return matchesAny(filePath, EXEMPT);
}

function isSensitive(filePath) {
  return matchesAny(filePath, RESTRICTED);
}

function resolveTarget(filePath, cwd) {
  try {
    const requested = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
    return fs.realpathSync(requested);
  } catch {
    return null;
  }
}

/**
 * When realpath fails, check whether the requested path is a symlink (or chain)
 * whose lexical target is sensitive. Dangling link to protected target -> true (fail-closed deny);
 * dangling benign link or link to allowed example/template -> false (allow).
 * Limit hops to avoid loops; malformed/looping -> fail closed.
 * TOCTOU note: check and use are not atomic; target could be swapped between this check and the actual read.
 * This is a best-effort guardrail, not an arbitrary-shell security boundary. For strong isolation use OS sandbox.
 */
function isSymlinkToSensitive(filePath, cwd) {
  try {
    const requested = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
    let current = requested;
    let hops = 0;
    const MAX_HOPS = 8;
    while (hops < MAX_HOPS) {
      let stat;
      try {
        stat = fs.lstatSync(current);
      } catch {
        return false;
      }
      if (!stat.isSymbolicLink()) return false;
      let linkTarget;
      try {
        linkTarget = fs.readlinkSync(current);
      } catch {
        return true;
      }
      if (isSensitive(linkTarget) && !isSafe(linkTarget)) return true;
      if (isSafe(linkTarget)) return false;
      const next = path.isAbsolute(linkTarget) ? linkTarget : path.resolve(path.dirname(current), linkTarget);
      if (next === current) return true;
      try {
        const real = fs.realpathSync(next);
        if (isSensitive(real) && !isSafe(real)) return true;
        if (isSafe(real)) return false;
        return false;
      } catch {
        current = next;
        hops += 1;
        continue;
      }
    }
    return true;
  } catch {
    return true;
  }
}

function scrubCommand(command) {
  return String(command).replace(
    /(<<-?[ \t]*)(['"])([A-Za-z_]\w*)\2([^\n]*)\n[\s\S]*?\n[ \t]*\3\b/g,
    '$1$2$3$2$4'
  );
}

function extractCommandPaths(command) {
  // The analyzer parses the command and returns the operands of every reading
  // command it recognises, nested shells and `find -exec` included. Treating
  // every unresolved expansion as sensitive, as this did before, denied
  // `cat $FILE`, `wc -l *.cjs` and `cat ~/.zshrc` alike -- and every denial here
  // costs a round trip through a one-shot approval prompt.
  // A heredoc whose delimiter is quoted (<<'BODY') is inert: the shell expands
  // nothing inside it, so no word in the body is ever read. The analyzer has no
  // notion of heredocs and parses the body as shell, so prose that quotes a
  // command -- a PR body carrying `cat .env` in backticks -- came back as a real
  // command substitution. Blank those bodies out first. An unquoted delimiter
  // (<<BODY) does expand, so it is left to the analyzer.
  const scrubbed = scrubCommand(command);

  const paths = new Set(commandAccess(scrubbed).paths);

  // Two shapes the analyzer cannot return. It drops any word carrying an
  // expansion, so `~/.ssh/id_rsa` and `certs/*.pem` still have to be matched by
  // name. And it only walks commands it recognises, so an unknown tool handed a
  // secret through a file-shaped option, such as
  // `docker compose --env-file .env`, is invisible to it.
  const FILE_OPTION = /^--?[\w-]*(?:file|config|key|cert|identity)$/i;
  const tokens = scrubbed.split(/[\s|;&<>"'()`]+/);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const shaped = /^~|[*?[{]/.test(token);
    const optionFed = index > 0 && FILE_OPTION.test(tokens[index - 1]);
    if (!shaped && !optionFed) continue;
    const value = token.replace(/^~/, '').replace(/^["'()`]+|["'(),]+$/g, '');
    if (value && isSensitive(value) && !isSafe(value)) paths.add(value);
  }

  return [...paths];
}

function extractPatchPaths(patch) {
  return [...String(patch).matchAll(
    /^\*\*\* (?:(?:Add|Update|Delete) File:|Move to:)\s+(.+)$/gm
  )]
    .map((match) => match[1].trim())
    .filter(Boolean);
}


function shellInput(input) {
  const value = input?.command ?? input?.cmd;
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  const index = value.findIndex(word => word === '-c' || word === '-lc');
  return index >= 0 ? String(value[index + 1] || '') : value.join(' ');
}

function patchInput(input) {
  if (typeof input === 'string') return input;
  for (const key of ['command', 'patch', 'input']) {
    if (typeof input?.[key] === 'string') return input[key];
  }
  return '';
}

function isPathKey(key, mcp) {
  return /^(?:file_?paths?|paths?|search_?paths?|director(?:y|ies)|cwd|root|locations?|notebook_path|globs?)$/i.test(key)
    || (mcp && /path|file|dir|uri|source|dest|target/i.test(key));
}

function collectPathValues(value, key, out, mcp) {
  if (typeof value === 'string' && isPathKey(key, mcp)) {
    const filePath = value.trim().replace(/^file:\/\//i, '');
    if (filePath) out.push(filePath);
  } else if (Array.isArray(value)) {
    for (const item of value) collectPathValues(item, key, out, mcp);
  } else if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectPathValues(childValue, childKey, out, mcp);
    }
  }
}

function extractPaths(toolName, input) {
  const paths = [];
  const tool = String(toolName).toLowerCase();
  collectPathValues(input, '', paths, tool.startsWith('mcp__'));
  if (['bash', 'exec_command', 'shell'].includes(tool)) {
    paths.push(...extractCommandPaths(shellInput(input)));
  } else if (['apply_patch', 'edit', 'write'].includes(tool)) {
    paths.push(...extractPatchPaths(patchInput(input)));
  }
  return [...new Set(paths)];
}

function sensitiveRequest(filePath, cwd) {
  const target = resolveTarget(filePath, cwd);
  if (target) {
    if (isSensitive(target) && !isSafe(target)) return true;
    if (isSafe(target)) return false;
  } else {
    if (isSymlinkToSensitive(filePath, cwd)) return true;
  }
  return !isSafe(filePath) && isSensitive(filePath);
}

function protectedLocation(filePath) {
  const normalized = path.posix.normalize(filePath).toLowerCase();
  const parts = normalized.split('/');
  const runtimes = new Set(['.claude', '.codex', '.omp']);
  if (runtimes.has(parts.at(-1)) || parts.at(-1) === '.privacy') return true;
  if (parts.at(-1) === 'runtime.json' && runtimes.has(parts.at(-2))) return true;
  for (let index = 0; index + 2 < parts.length; index += 1) {
    if (parts[index] === '.codex' && parts[index + 1] === 'hooks' && parts[index + 2] === '.privacy') return true;
  }
  return false;
}

function protectedWrite(filePath, cwd) {
  const absolute = path.posix.resolve(cwd.replace(/\\/g, '/'), filePath.replace(/\\/g, '/'));
  if (protectedLocation(absolute)) return true;
  let current = absolute;
  const suffix = [];
  const links = new Set();
  for (;;) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        if (links.has(current) || links.size >= 8) return true;
        links.add(current);
        const target = path.posix.resolve(path.posix.dirname(current), fs.readlinkSync(current));
        if (protectedLocation(path.posix.join(target, ...suffix.slice().reverse()))) return true;
        current = target;
        continue;
      }
      const real = fs.realpathSync(current);
      return protectedLocation(path.posix.join(real, ...suffix.reverse()));
    } catch (error) {
      if (error.code === 'ELOOP') return true;
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') return false;
    }
    const parent = path.posix.dirname(current);
    if (parent === current) return false;
    suffix.push(path.posix.basename(current));
    current = parent;
  }
}

function extractWritePaths(tool, input) {
  if (['bash', 'exec_command', 'shell'].includes(tool)) return commandAccess(scrubCommand(shellInput(input)));
  const paths = [];
  if (['write', 'edit', 'multiedit', 'notebookedit'].includes(tool) || tool.startsWith('mcp__')) {
    collectPathValues(input, '', paths, tool.startsWith('mcp__'));
  }
  if (['apply_patch', 'edit', 'write'].includes(tool)) paths.push(...extractPatchPaths(patchInput(input)));
  return { writes: paths, unknownWrites: [] };
}

function protectedUnknownWrite(filePath) {
  const parts = path.posix.normalize(filePath.replace(/\\/g, '/')).toLowerCase().split('/');
  return parts.at(-1) === 'runtime.json' || parts.includes('.privacy')
    || ['.claude', '.codex', '.omp'].includes(parts.at(-1));
}

function sensitivePaths(toolName, input, cwd) {
  const paths = extractPaths(toolName, input).filter(filePath => sensitiveRequest(filePath, cwd));
  const tool = String(toolName).toLowerCase();
  const access = extractWritePaths(tool, input);
  paths.push(...access.writes.filter(filePath => protectedWrite(filePath, cwd)),
    ...access.unknownWrites.filter(protectedUnknownWrite));
  const searches = tool === 'grep'
    ? [{ recursive: true, hidden: true,
      roots: [typeof input?.path === 'string' && input.path.trim() ? input.path : cwd],
      includes: [input?.glob, ...(Array.isArray(input?.globs) ? input.globs : [])]
        .filter(glob => typeof glob === 'string' && glob),
    }]
    : ['bash', 'exec_command', 'shell'].includes(tool)
      ? commandAccess(scrubCommand(shellInput(input))).searches : [];
  for (const search of searches) {
    if (!search.recursive) continue;
    // Negative globs and exclusion/type flags cannot prove a sensitive child is omitted.
    const includes = search.includes.filter(glob => glob && !glob.startsWith('!'));
    for (const root of search.roots) {
      const directory = path.resolve(cwd, root);
      let entries;
      try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (entry.isDirectory() || (!search.hidden && entry.name.startsWith('.'))) continue;
        if (includes.length && !includes.some(glob => matchesInclude(entry.name, glob))) continue;
        const filePath = path.join(directory, entry.name);
        if (sensitiveRequest(filePath, cwd)) paths.push(filePath);
      }
    }
  }
  return [...new Set(paths)];
}

function matchesInclude(name, glob) {
  if (typeof path.matchesGlob !== 'function') return true;
  glob = glob.replace(/^\/+/, '');
  if (glob.length > 256 || (glob.match(/[*?]/g) || []).length > 4 || /\{[^}]*\.\.[^}]*\}/.test(glob)
    || !/^[\w.\-\/]*(?:[*?][\w.\-\/]*){0,4}(?:\{[\w.\-*,]*\}[\w.\-\/]*)?$/.test(glob)) return true;
  // Prefixing both sides removes Node's implicit leading-dot exclusion for a basename.
  return path.matchesGlob(name, glob)
    || (name.startsWith('.') && path.matchesGlob(`x${name}`, `x${glob.replace(/^(?:\*\*\/)+/, '')}`));
}

function displayNames(filePaths) {
  const names = [...new Set(filePaths.map((filePath) => path.basename(filePath)))].sort();
  return names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
}

module.exports = { isSensitive, isSafe, sensitiveRequest, extractPaths, sensitivePaths, displayNames };
