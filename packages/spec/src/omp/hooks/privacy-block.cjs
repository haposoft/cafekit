#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * PreToolUse Hook — privacy-block.cjs
 *
 * Claude Code CLI privacy gate for sensitive files.
 *
 * Runtime contract:
 * - Sensitive access returns Claude Code's native PreToolUse "ask" decision
 * - The same decision applies to direct tools and Bash commands
 * - Symlinks are classified by their resolved target before their alias
 *
 * Exit: 0 (the JSON hook output carries the permission decision)
 */

try {
  const fs = require('fs');
  const path = require('path');
  const { commandAccess } = require('./lib/privacy-command-analysis.cjs');

  const RESTRICTED_PATTERNS = [
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

  const ALLOWED_EXEMPTIONS = [
    /\.env\.(example|sample|template|test)$/i
  ];

  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  function readRuntime(cwd) {
    try {
      const file = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch {
      return {};
    }
  }

  function isSafe(filePath) {
    const base = path.basename(filePath);
    return ALLOWED_EXEMPTIONS.some((rule) => rule.test(base) || rule.test(filePath));
  }

  function isSensitive(filePath) {
    const base = path.basename(filePath);
    return RESTRICTED_PATTERNS.some((rule) => rule.test(base) || rule.test(filePath));
  }

  /**
   * Resolve a symlink to its real target so a harmless-looking name that points
   * at a sensitive file cannot slip through the basename check. Returns null
   * when the path cannot be resolved (missing file, broken link) — fail-open to
   * the original-path check in that case. See isSymlinkToSensitive for dangling handling.
   */
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
   * whose lexical target is sensitive. Dangling link to protected target -> true (fail-closed ask);
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

  function extractBashPaths(command) {
    // The analyzer parses the command and returns the operands of every reading
    // command it recognises, nested shells and `find -exec` included. Treating
    // every unresolved expansion as sensitive, as this did before, asked on
    // `cat $FILE`, `wc -l *.cjs` and `cat ~/.zshrc` alike. Noise is what trains
    // people to click through the prompt that matters.
    // A heredoc whose delimiter is quoted (<<'BODY') is inert: the shell
    // expands nothing inside it, so no word in the body is ever read. The
    // analyzer has no notion of heredocs and parses the body as shell, so prose
    // that quotes a command -- a PR body carrying `cat .env` in backticks --
    // came back as a real command substitution. Blank those bodies out first.
    // An unquoted delimiter (<<BODY) does expand, so it is left to the
    // analyzer.
    const scrubbed = String(command).replace(
      /(<<-?[ \t]*)(['"])([A-Za-z_]\w*)\2[^\n]*\n[\s\S]*?\n[ \t]*\3\b/g,
      '$1$2$3$2'
    );

    const paths = new Set(commandAccess(scrubbed).paths);

    // Two shapes the analyzer cannot return. It drops any word carrying an
    // expansion, so `~/.ssh/id_rsa` and `certs/*.pem` still have to be matched
    // by name. And it only walks commands it recognises, so an unknown tool
    // handed a secret through a file-shaped option, such as
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

  function extractPaths(toolName, input) {
    const paths = [];
    if (!input) return paths;

    for (const key of ['file_path', 'path']) {
      if (typeof input[key] === 'string' && input[key].trim()) {
        paths.push(input[key].trim());
      }
    }

    for (const key of ['paths', 'search_paths']) {
      if (Array.isArray(input[key])) {
        paths.push(...input[key].filter(Boolean));
      }
    }

    if (toolName === 'Bash' && typeof input.command === 'string') {
      paths.push(...extractBashPaths(input.command));
    }

    return paths.filter(Boolean);
  }

  function askForPermission(filePath) {
    const basename = path.basename(filePath);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        // omp has no ask state on tool_call, so an ask under Claude becomes a denial here.
        permissionDecision: 'deny',
        permissionDecisionReason: `Sensitive file access requires approval: ${basename}`
      }
    }) + '\n');
  }

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const data = normalizeHookPayload(JSON.parse(stdin));
  const toolName = data.tool_name || '';
  const toolInput = data.tool_input || {};
  const cwd = typeof data.cwd === 'string' && data.cwd.trim() ? data.cwd : process.cwd();
  const runtime = readRuntime(cwd);

  if (runtime.privacyBlock === false) process.exit(0);

  const paths = extractPaths(toolName, toolInput);
  if (!paths.length) process.exit(0);

  for (const filePath of paths) {
    const target = resolveTarget(filePath, cwd);

    // The real target is authoritative: an exempt-looking alias must not hide
    // a sensitive target, while a real .env.example target remains safe.
    if (target) {
      if (isSensitive(target) && !isSafe(target)) {
        askForPermission(filePath);
        process.exit(0);
      }
      if (isSafe(target)) continue;
    } else {
      if (isSymlinkToSensitive(filePath, cwd)) {
        askForPermission(filePath);
        process.exit(0);
      }
    }

    if (isSafe(filePath) || !isSensitive(filePath)) continue;
    askForPermission(filePath);
    process.exit(0);
  }

  process.exit(0);
} catch (_) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Sensitive access could not be evaluated safely.'
    }
  }) + '\n');
  process.exit(0);
}
