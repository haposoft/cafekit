'use strict';

const fs = require('fs');
const os = require('os');
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

  const paths = new Set(cachedAccess(scrubbed).paths);

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

// omp's edit modes name files in their own grammars: hashline headers `[path#TAG]` (tag
// optional, path may be quoted) and `¶path`, a hashline `MV <dest>` move, and the sloppy
// `*** Edit File:` header. The move destination is a write like any other.
const PATCH_FILE_LINES = [
  /^\*\*\* (?:(?:Add|Update|Delete) File:|Move to:)\s+(.+)$/gm,
  /^[ \t]*\*{3}[ \t]+Edit[ \t]+File:[ \t]*(.+)$/gim,
  /^\[(.+?)(?:#[0-9A-Fa-f]{4})?\]$/gm,
  /^\u00b6(.+)$/gm,
  /^[ \t]*MV[ \t]+(.+)$/gm,
];

function extractPatchPaths(patch) {
  const text = String(patch).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return PATCH_FILE_LINES.flatMap((pattern) => [...text.matchAll(pattern)])
    .map((match) => match[1].trim().replace(/^(["'])(.*)\1$/, '$2').replace(/#[0-9A-Fa-f]{4}$/, ''))
    .filter(Boolean);
}

// omp's read takes `path:<selector>` (`raw`, `conflicts`, `img`, a line or range list);
// the file is the part before it, so `.env:raw` is `.env`.
const READ_SELECTOR = /:((?:raw|conflicts|img|-?\d+(?:[-+,.]\d+)*))$/i;

function withoutSelectors(filePath) {
  const variants = [];
  let current = filePath;
  for (let count = 0; count < 2 && READ_SELECTOR.test(current); count += 1) {
    current = current.replace(READ_SELECTOR, '');
    if (current) variants.push(current);
  }
  return variants;
}

// omp's eval runs code with no path argument; a quoted literal naming a secret file is the
// only file reference the gate can see.
function evalLiterals(input) {
  const code = typeof input?.code === 'string' ? input.code : '';
  return [...code.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((match) => match[2].trim()).filter(Boolean);
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
  return /^(?:file_?paths?|paths?|search_?paths?|director(?:y|ies)|cwd|root|locations?|notebook_path|globs?|rename)$/i.test(key)
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
    const patch = patchInput(input);
    paths.push(...extractPatchPaths(patch));
    // An edit whose text names no file cannot be judged, so it is not allowed through.
    if (tool === 'edit' && patch.trim() && !paths.length) throw new Error('edit input names no file');
  } else if (tool === 'eval') {
    paths.push(...evalLiterals(input));
  }
  return [...new Set(paths.flatMap((filePath) => [filePath, ...withoutSelectors(filePath)]))];
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
  if (['bash', 'exec_command', 'shell'].includes(tool)) return cachedAccess(scrubCommand(shellInput(input)));
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

// Dynamic shell. One budget covers the whole command -- directory entries and stats, assignments resolved, and wall
// time -- so a crafted command cannot outrun the hook's own timeout; running out of it asks rather than allows. Every
// step below is linear in its input, and every loop that touches the disk checks the budget.
const DYNAMIC_BUDGET = { entries: 4000, assignments: 100000, milliseconds: 250, globstarMilliseconds: 60, textLength: 16384, braceVariants: 64, braceGroups: 64 };
const OVER_BUDGET = 'dynamic shell expansion over the check budget';
const DECODED_READ = 'decoded input fed to a shell or reader';
const UNRESOLVED = '\u0000';
// Names a glob is tested against when its directory is unknown (after `cd "$D"`) or only its name is visible.
const SENSITIVE_NAMES = ['.env', '.env.local', '.env.production', '.env.development', 'credentials', 'credentials.json',
  'secrets.yml', 'secrets.yaml', 'secrets.json', 'server.pem', 'server.key', 'cert.p12', 'cert.pfx', 'id_rsa', 'id_ed25519',
  'id_ecdsa', 'id_dsa', '.netrc', '.pgpass', 'kubeconfig', 'app.keystore', 'app.jks', 'auth.json', 'token.json', 'tokens.json'];

const hasGlob = (text) => /[*?[]/.test(text);
const overBudget = (budget) => {
  if (budget.entries > DYNAMIC_BUDGET.entries || budget.assignments > DYNAMIC_BUDGET.assignments
    || Date.now() > budget.deadline) budget.over = true;
  return budget.over;
};

// One path segment of a shell glob: * and ? never cross '/', [..] is a class ([!..] negated, a-z ranges), and a name
// starting with '.' only matches when the pattern starts with '.' too (bash without dotglob). Matching is the two-pointer
// wildcard walk, so a pattern full of stars costs pattern x name steps, never exponential backtracking.
const STAR = Symbol('star');
const ANY = Symbol('any');
function segmentMatcher(pattern) {
  const tokens = [];
  // Once one '[' finds no ']' after it, no later '[' can: they are all literal, and the rest is not scanned again.
  let unclosed = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const ch = pattern[index];
    if (ch === '*') { if (tokens.at(-1) !== STAR) tokens.push(STAR); continue; }
    if (ch === '?') { tokens.push(ANY); continue; }
    if (ch === '[' && !unclosed) {
      const negated = pattern[index + 1] === '!' || pattern[index + 1] === '^';
      const open = index + (negated ? 2 : 1);
      const close = classEnd(pattern, open);
      if (close > 0) {
        tokens.push(characterClass(pattern.slice(open, close), negated));
        index = close;
        continue;
      }
      unclosed = true;
    }
    tokens.push(ch);
  }
  const dot = pattern.startsWith('.');
  return (name) => (dot || !name.startsWith('.')) && wildcardMatch(tokens, name);
}

// The ']' that closes a class opened before `open`: a ']' first in the class is a member, and a POSIX class
// (`[:alpha:]`) inside it is skipped whole.
function classEnd(pattern, open) {
  for (let index = open; index < pattern.length; index += 1) {
    if (pattern[index] === '[' && pattern[index + 1] === ':') {
      const end = pattern.indexOf(':]', index + 2);
      if (end > 0) { index = end + 1; continue; }
    }
    if (pattern[index] === ']' && index > open) return index;
  }
  return -1;
}

function characterClass(body, negated) {
  // A POSIX class (`.e[[:alpha:]]v`) is taken to match any character, negated or not: it may ask more than the shell
  // would match, never less.
  if (body.includes('[:')) return () => true;
  const ranges = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index + 1] === '-' && index + 2 < body.length) { ranges.push([body[index], body[index + 2]]); index += 2; }
    else ranges.push([body[index], body[index]]);
  }
  return (ch) => ranges.some(([low, high]) => low <= ch && ch <= high) !== negated;
}

function wildcardMatch(tokens, name) {
  let token = 0;
  let at = 0;
  let star = -1;
  let starAt = 0;
  const one = (expected, ch) => expected === ANY || (typeof expected === 'function' ? expected(ch) : expected === ch);
  while (at < name.length) {
    if (token < tokens.length && tokens[token] !== STAR && one(tokens[token], name[at])) { token += 1; at += 1; continue; }
    if (tokens[token] === STAR) { star = token; token += 1; starAt = at; continue; }
    if (star < 0) return false;
    token = star + 1;
    starAt += 1;
    at = starAt;
  }
  while (tokens[token] === STAR) token += 1;
  return token === tokens.length;
}

// Ordinary names: a glob that also matches one of these (`*`, `*.json`) says nothing about secrets on its own.
const ORDINARY_NAMES = ['README.md', 'package.json', 'index.js', 'main.ts', 'config.yaml', 'settings.yml', 'data.json',
  'notes.txt', 'main.go', 'app.py', 'Makefile', 'style.css', 'index.html', 'image.png'];

// Name-only judgement, used when the directory cannot be read: a literal secret name, or a glob aimed at secrets.
const nameLooksSensitive = (pattern) => {
  const base = pattern.split('/').pop();
  if (!hasGlob(base)) return isSensitive(base) && !isSafe(base);
  const matches = segmentMatcher(base);
  return SENSITIVE_NAMES.some(matches) && !ORDINARY_NAMES.some(matches);
};

// $name, ${name}, ${name:-default} and ${name-default}; ~ at the start is HOME. Anything else that expands ($(...),
// backticks, $1, $@, unknown variables) becomes UNRESOLVED. One left-to-right pass, and the output is capped: past the
// cap the budget is spent.
const BRACED = /^([A-Za-z_]\w*)(?::?[-=]([\s\S]*))?$/;
function substitute(text, vars, budget) {
  const home = process.env.HOME || os.homedir();
  let out = '';
  let close = -1;
  const emit = (value) => {
    if (value === null || out.length + value.length > DYNAMIC_BUDGET.textLength) { budget.over = true; return false; }
    out += value;
    return true;
  };
  for (let index = 0; index < text.length;) {
    const ch = text[index];
    const next = text[index + 1];
    let value = ch;
    let width = 1;
    if (index === 0 && ch === '~' && (next === undefined || next === '/')) value = home;
    else if (ch === '$' && next === '{') {
      // The first '}' after this point; reused while it stays ahead, so `${${${…` is not rescanned for each '${'.
      if (close !== Infinity && close < index + 2) close = text.indexOf('}', index + 2);
      if (close < 0) close = Infinity;
      if (close === Infinity) { value = UNRESOLVED; width = text.length - index; } else {
        const match = BRACED.exec(text.slice(index + 2, close));
        const name = match?.[1];
        value = !match ? UNRESOLVED : vars.has(name) ? vars.get(name) : name === 'HOME' ? home
          : match[2] !== undefined ? match[2] : UNRESOLVED;
        width = close + 1 - index;
      }
    } else if (ch === '$' && next === '(' && text[index + 2] === ')') { value = UNRESOLVED; width = 3; }
    else if ((ch === '<' || ch === '>') && next === '(' && text[index + 2] === ')') { value = UNRESOLVED; width = 3; }
    else if (ch === '`' && next === '`') { value = UNRESOLVED; width = 2; }
    else if (ch === '$' && next !== undefined && '@*#?$!-0123456789'.includes(next)) { value = UNRESOLVED; width = 2; }
    if (!emit(value)) return '';
    index += width;
  }
  return out;
}

// Assignments visible to an operand, outermost scope first, each value substituted with the ones before it. A value
// past the text cap is kept as null, which spends the budget only if an operand actually uses it.
const listIds = new WeakMap();
let nextListId = 0;
function resolveVars(scopes, budget, memo) {
  // Operands of the same segment see the same assignments; resolve those once.
  const key = scopes.map(({ list, count }) => {
    if (!listIds.has(list)) listIds.set(list, nextListId++);
    return `${listIds.get(list)}:${count}`;
  }).join(',');
  if (memo.has(key)) return memo.get(key);
  const vars = new Map();
  memo.set(key, vars);
  for (const { list, count } of scopes) {
    for (let index = 0; index < count; index += 1) {
      budget.assignments += 1;
      if (overBudget(budget)) return vars;
      const { name, value } = list[index];
      const probe = { over: false };
      const resolved = value.length > DYNAMIC_BUDGET.textLength ? '' : substitute(value, vars, probe);
      vars.set(name, value.length > DYNAMIC_BUDGET.textLength || probe.over ? null : resolved);
    }
  }
  return vars;
}

// Brace expansion {a,b}: the first innermost group holding a comma, found in one scan; variants and group depth capped.
function braces(text, budget, depth = 0) {
  if (budget.over) return [];
  if (depth > DYNAMIC_BUDGET.braceGroups) { budget.over = true; return []; }
  let open = -1;
  let comma = false;
  let group = null;
  for (let index = 0; index < text.length && !group; index += 1) {
    const ch = text[index];
    if (ch === '{') { open = index; comma = false; } else if (ch === ',' && open >= 0) comma = true;
    else if (ch === '}' && open >= 0) { if (comma) group = [open, index]; open = -1; }
  }
  if (!group) return [text];
  const [start, end] = group;
  const out = [];
  for (const part of text.slice(start + 1, end).split(',')) {
    for (const rest of braces(text.slice(0, start) + part + text.slice(end + 1), budget, depth + 1)) {
      out.push(rest);
      if (out.length > DYNAMIC_BUDGET.braceVariants) { budget.over = true; return out; }
    }
    if (budget.over) return out;
  }
  return out;
}

// Expand a glob against the real directory tree. Every entry read and every literal segment stat-ed is charged to the
// shared budget. `**` (zsh, bash globstar) walks every directory below, itself included, on a slice of its own: a tree
// too big for that slice (`**/*.md` at a repository root, through node_modules) returns null, and the caller judges the
// pattern by name instead of asking for every such command.
function expandGlob(pattern, base, budget) {
  if (!pattern.split('/').includes('**')) return expandParts(pattern, base, budget);
  const slice = { entries: 0, assignments: 0, over: false,
    deadline: Math.min(budget.deadline, Date.now() + DYNAMIC_BUDGET.globstarMilliseconds) };
  const found = expandParts(pattern, base, slice);
  if (slice.over) return null;
  budget.entries += slice.entries;
  return found;
}

function expandParts(pattern, base, budget) {
  const absolute = pattern.startsWith('/');
  let current = [absolute ? '/' : base];
  const parts = pattern.split('/').filter((part, index) => part || index === 0 && !absolute);
  for (const [index, part] of parts.entries()) {
    if (!part) continue;
    const last = index === parts.length - 1;
    const next = [];
    for (const directory of current) {
      if (part === '**') { if (!walk(directory, next, last, budget)) return []; continue; }
      if (!hasGlob(part)) {
        budget.entries += 1;
        if (overBudget(budget)) return [];
        const joined = path.join(directory, part);
        if (last || isDirectory(joined)) next.push(joined);
        continue;
      }
      let entries;
      try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
      budget.entries += entries.length;
      if (overBudget(budget)) return [];
      const matches = segmentMatcher(part);
      for (const entry of entries) {
        if (Date.now() > budget.deadline) { budget.over = true; return []; }
        if (!matches(entry.name)) continue;
        const joined = path.join(directory, entry.name);
        if (last || entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(joined))) next.push(joined);
      }
    }
    current = next;
    if (!current.length || overBudget(budget)) return [];
  }
  return current;
}

// `**`: the directory and every non-hidden directory below it, or, as the last part, every non-hidden entry below.
function walk(root, out, last, budget) {
  const pending = [root];
  if (!last) out.push(root);
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    budget.entries += entries.length;
    if (overBudget(budget)) return false;
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const joined = path.join(directory, entry.name);
      if (entry.isDirectory()) { pending.push(joined); out.push(joined); } else if (last) out.push(joined);
    }
  }
  return true;
}

function isDirectory(filePath) {
  try { return fs.statSync(filePath).isDirectory(); } catch { return false; }
}

function dynamicSensitive(access, cwd) {
  const found = [];
  const budget = { entries: 0, assignments: 0, deadline: Date.now() + DYNAMIC_BUDGET.milliseconds, over: false };
  if (access.decodedRead) found.push(DECODED_READ);
  for (const name of access.pipeNames || []) {
    if (name.length > DYNAMIC_BUDGET.textLength) budget.over = true;
    if (overBudget(budget)) break;
    if (nameLooksSensitive(name)) found.push(name);
  }
  const resolved = new Map();
  for (const expansion of access.expansions || []) {
    if (overBudget(budget)) break;
    for (const literal of expansion.literals) if (isSensitive(literal) && !isSafe(literal)) found.push(literal);
    if (expansion.text.length > DYNAMIC_BUDGET.textLength) { budget.over = true; break; }
    const text = substitute(expansion.text, resolveVars(expansion.scopes || [], budget, resolved), budget);
    for (const variant of braces(text, budget)) {
      if (overBudget(budget)) break;
      if (variant.includes(UNRESOLVED)) {
        // `"$X/.env"`: whatever $X is, the name read is the literal tail. `.env$X`, `.en"$Y"v`: a name that starts with
        // literal text reads, when the rest is empty, the name its literal parts spell. A name that starts with an
        // unknown value (`$g.*`) says nothing about which file it is.
        const tail = variant.slice(variant.lastIndexOf(UNRESOLVED) + 1);
        if (tail.includes('/') && nameLooksSensitive(tail)) found.push(tail.replace(/^\/+/, ''));
        const name = variant.slice(variant.lastIndexOf('/') + 1);
        const joined = variant.split(UNRESOLVED).join('');
        if (name && !name.startsWith(UNRESOLVED) && nameLooksSensitive(joined)) found.push(joined);
        continue;
      }
      if (expansion.directory === null) {
        if (nameLooksSensitive(variant)) found.push(variant);
        continue;
      }
      const base = path.resolve(cwd, expansion.directory);
      const candidates = hasGlob(variant) ? expandGlob(variant, base, budget) : [path.resolve(base, variant)];
      if (candidates === null) {
        if (nameLooksSensitive(variant)) found.push(variant);
        continue;
      }
      for (const candidate of candidates) if (sensitiveRequest(candidate, cwd)) found.push(candidate);
    }
  }
  if (budget.over) found.push(OVER_BUDGET);
  return found;
}

// One hook call parses the same command for reads, writes and searches; parse it once.
const accessCache = new Map();
function cachedAccess(command) {
  if (!accessCache.has(command)) {
    if (accessCache.size >= 4) accessCache.clear();
    accessCache.set(command, commandAccess(command));
  }
  return accessCache.get(command);
}

function sensitivePaths(toolName, input, cwd) {
  const paths = extractPaths(toolName, input).filter(filePath => sensitiveRequest(filePath, cwd));
  const tool = String(toolName).toLowerCase();
  if (['bash', 'exec_command', 'shell'].includes(tool)) paths.push(...dynamicSensitive(cachedAccess(scrubCommand(shellInput(input))), cwd));
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
      ? cachedAccess(scrubCommand(shellInput(input))).searches : [];
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
