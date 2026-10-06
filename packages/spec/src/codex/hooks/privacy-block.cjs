#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  APPROVAL_PREFIX,
  createPending,
  hasGrant
} = require('./lib/privacy-state.cjs');
const {
  getHookContext,
  readPayload
} = require('./lib/hook-context.cjs');
const { commandAccess } = require('./lib/privacy-command-analysis.cjs');

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

function isPathKey(key) {
  return /^(?:file_?paths?|paths?|search_?paths?|director(?:y|ies)|cwd|root|locations?)$/i
    .test(key);
}

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
  const scrubbed = String(command).replace(
    /(<<-?[ \t]*)(['"])([A-Za-z_]\w*)\2[^\n]*\n[\s\S]*?\n[ \t]*\3\b/g,
    '$1$2$3$2'
  );

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
  if (typeof input?.command === 'string') return input.command;
  if (typeof input?.cmd === 'string') return input.cmd;
  return '';
}

function patchInput(input) {
  if (typeof input === 'string') return input;
  for (const key of ['command', 'patch', 'input']) {
    if (typeof input?.[key] === 'string') return input[key];
  }
  return '';
}

function collectPathValues(value, key, out) {
  if (typeof value === 'string' && isPathKey(key)) {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    if (isPathKey(key)) out.push(...value.filter((item) => typeof item === 'string'));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, childValue] of Object.entries(value)) {
    collectPathValues(childValue, childKey, out);
  }
}

function extractPaths(toolName, input) {
  const paths = [];
  collectPathValues(input, '', paths);
  const normalizedTool = String(toolName).toLowerCase();
  if (['bash', 'exec_command', 'shell'].includes(normalizedTool)) {
    paths.push(...extractCommandPaths(shellInput(input)));
  } else if (['apply_patch', 'edit', 'write'].includes(normalizedTool)) {
    paths.push(...extractPatchPaths(patchInput(input)));
  }
  return [...new Set(paths.filter(Boolean))];
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

function sensitivePaths(toolName, input, cwd) {
  return extractPaths(toolName, input)
    .filter((filePath) => sensitiveRequest(filePath, cwd));
}

function deny(reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  })}\n`);
}

try {
  const data = readPayload();
  if (!data) process.exit(0);
  const { projectRoot, sessionCwd, runtime } = getHookContext(data);
  if (runtime.privacyBlock === false) process.exit(0);

  const filePaths = sensitivePaths(data.tool_name || '', data.tool_input || {}, sessionCwd);
  const effectivePaths = filePaths;
  if (effectivePaths.length === 0) process.exit(0);
  if (!data.session_id) {
    deny(
      'Sensitive file access denied because this hook invocation had no Codex session ID. ' +
      'No approval request or token was created.'
    );
    process.exit(0);
  }
  const grantInput = {
    projectRoot,
    sessionCwd,
    sessionId: data.session_id,
    filePaths: effectivePaths
  };
  if (hasGrant(grantInput)) process.exit(0);

  const pending = createPending(grantInput);
  deny(
    `Sensitive file access denied: ${pending.displayName}. ` +
    `To approve access to exactly these paths for the next hour of this Codex ` +
    `session, send this exact user prompt: ` +
    `${APPROVAL_PREFIX}${pending.requestId}`
  );
  process.exit(0);
} catch {
  deny('Sensitive access could not be evaluated safely. No file content was read or logged.');
  process.exit(0);
}
