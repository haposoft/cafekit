'use strict';

// SessionStart is the one place a session can learn where it is before the user says a
// word. When ORCA_PANE_KEY is present the CafeKit session hook for Claude Code and for
// Codex now appends "Orca: pane" to its first line. The same environment carries two
// credentials, ORCA_AGENT_HOOK_TOKEN and ORCA_AGENT_LAUNCH_TOKEN; neither must ever reach
// stdout, stderr, or the env file the Claude hook writes. Every case here builds its own
// environment from a copy of process.env with every ORCA_* key removed first, because this
// suite itself commonly runs inside an Orca pane — spawning with the ambient environment
// unstripped would make the negative cases pass or fail by accident of where they run.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const CLAUDE_HOOK = path.join(PACKAGE_ROOT, 'src/claude/hooks/session.cjs');

const HOOK_TOKEN_SENTINEL = 'sentinel-hook-token-2fc9a1';
const LAUNCH_TOKEN_SENTINEL = 'sentinel-launch-token-7be04d';

/** A copy of process.env with every ORCA_* key removed, then the case's own additions. */
function baseEnv(overrides = {}) {
  const stripped = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('ORCA_')) stripped[key] = value;
  }
  return { ...stripped, ...overrides };
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
}

/** A git repo with one commit on a named branch, and no package.json: detectProjectType
 * always resolves to at least "app", so this is the smallest fixture that still has a
 * second, real fact (Branch) alongside the unavoidable Type. */
function withRepo(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-orca-session-'));
  try {
    git(['init', '-q'], dir);
    git(['config', 'user.email', 'cafekit@example.invalid'], dir);
    git(['config', 'user.name', 'CafeKit Test'], dir);
    git(['commit', '--allow-empty', '-qm', 'fixture'], dir);
    git(['checkout', '-q', '-b', 'orca-fixture'], dir);
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A plain directory: no git, no package.json. detectProjectType still returns "app", so
 * this is the minimum a session can print — there is no directory shape that yields zero
 * parts, on either hook, because "Type: app" is not conditional on anything being found. */
function withBareDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-orca-session-bare-'));
  try {
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runClaude(cwd, env, envFile) {
  const result = spawnSync(process.execPath, [CLAUDE_HOOK], {
    cwd,
    input: JSON.stringify({ source: 'startup' }),
    encoding: 'utf8',
    env: envFile ? { ...env, CLAUDE_ENV_FILE: envFile } : env,
  });
  assert.equal(result.status, 0, `hook must exit 0 (fail-open): ${result.stderr}`);
  return result;
}

test('the Claude session line ends with Orca: pane', () => {
  withRepo((dir) => {
    const without = runClaude(dir, baseEnv());
    const withOrca = runClaude(dir, baseEnv({ ORCA_PANE_KEY: 'pane-abc' }));
    assert.match(withOrca.stdout, /Orca: pane$/m, 'Orca: pane must be the last part on its line');
    assert.equal(withOrca.stdout.trimEnd(), `${without.stdout.trimEnd()} | Orca: pane`,
      'the line must be byte-equal to the no-variable line plus " | Orca: pane"');
  });
});

test('no Orca part outside a pane, byte for byte', () => {
  withRepo((dir) => {
    const first = runClaude(dir, baseEnv());
    const second = runClaude(dir, baseEnv());
    assert.doesNotMatch(first.stdout, /Orca/, 'without ORCA_PANE_KEY the line must never mention Orca');
    assert.equal(first.stdout, second.stdout, 'the same fixture must print the same line every time');
  });
});

test('keying on ORCA_TERMINAL_HANDLE instead of ORCA_PANE_KEY must not add the marker', () => {
  // The handle is a real, non-secret variable Orca also sets, but it is not the presence
  // marker this packet keys on: a hook that checked it instead would fire outside a
  // trusted pane state or miss a pane that only carries the key.
  withRepo((dir) => {
    const handleOnly = runClaude(dir, baseEnv({ ORCA_TERMINAL_HANDLE: 'term-xyz' }));
    assert.doesNotMatch(handleOnly.stdout, /Orca/, 'ORCA_TERMINAL_HANDLE alone must not print the marker');
  });
});

test('an empty project inside a pane still prints the marker', () => {
  // No directory shape yields zero parts: detectProjectType always resolves to at least
  // "app". This is the true minimum line, not the empty-parts case the plan first assumed.
  withBareDir((dir) => {
    const withOrca = runClaude(dir, baseEnv({ ORCA_PANE_KEY: 'pane-abc' }));
    assert.equal(withOrca.stdout.trimEnd(), 'Session startup. Type: app | Orca: pane');
  });
});

test('no token ever reaches stdout, stderr, or the Claude env file', () => {
  withRepo((dir) => {
    const envFile = path.join(dir, 'orca-session-env.sh');
    const result = runClaude(dir, baseEnv({
      ORCA_PANE_KEY: 'pane-abc',
      ORCA_AGENT_HOOK_TOKEN: HOOK_TOKEN_SENTINEL,
      ORCA_AGENT_LAUNCH_TOKEN: LAUNCH_TOKEN_SENTINEL,
    }), envFile);
    assert.match(result.stdout, /Orca: pane$/m, 'the marker must still print alongside the tokens');
    const envFileText = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    for (const sentinel of [HOOK_TOKEN_SENTINEL, LAUNCH_TOKEN_SENTINEL]) {
      assert.doesNotMatch(result.stdout, new RegExp(sentinel), 'stdout must not carry the token');
      assert.doesNotMatch(result.stderr, new RegExp(sentinel), 'stderr must not carry the token');
      assert.doesNotMatch(envFileText, new RegExp(sentinel), 'the env file must not carry the token');
    }
  });
});

// ---------------------------------------------------------------------------------------
// Codex: session.cjs resolves its own PROJECT_ROOT from lib/hook-context.cjs's __dirname,
// not from payload.cwd or process.cwd(), so testing it means composing the same relative
// layout an install produces rather than spawning the source file against an arbitrary
// directory. The Codex-side runtime-path-safety.cjs in the source tree is a thin re-export
// pointing at the Claude file three levels up; the real installer materializes the Claude
// file's content in its place (bin/phases/codex-runtime.js), so the composed tree does too.
// ---------------------------------------------------------------------------------------

function composeCodexHookTree(root) {
  const hooksDir = path.join(root, '.codex', 'hooks');
  fs.mkdirSync(path.join(hooksDir, 'lib'), { recursive: true });
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/codex/hooks/session.cjs'), path.join(hooksDir, 'session.cjs'));
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/codex/hooks/completion-authority-state.cjs'),
    path.join(hooksDir, 'completion-authority-state.cjs'));
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/hook-context.cjs'),
    path.join(hooksDir, 'lib', 'hook-context.cjs'));
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/privacy-state.cjs'),
    path.join(hooksDir, 'lib', 'privacy-state.cjs'));
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/runtime-path-safety.cjs'),
    path.join(hooksDir, 'lib', 'runtime-path-safety.cjs'));
  return path.join(hooksDir, 'session.cjs');
}

function withCodexProject(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-orca-codex-session-'));
  try {
    const hook = composeCodexHookTree(dir);
    return run(dir, hook);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runCodex(hook, cwd, env) {
  const result = spawnSync(process.execPath, [hook], {
    cwd,
    input: JSON.stringify({ source: 'startup', cwd, session_id: 'orca-session-test' }),
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 0, `hook must exit 0 (fail-open): ${result.stderr}`);
  return result;
}

test('the Codex session line ends with Orca: pane', () => {
  withCodexProject((dir, hook) => {
    git(['init', '-q'], dir);
    git(['config', 'user.email', 'cafekit@example.invalid'], dir);
    git(['config', 'user.name', 'CafeKit Test'], dir);
    git(['commit', '--allow-empty', '-qm', 'fixture'], dir);
    git(['checkout', '-q', '-b', 'orca-fixture'], dir);

    const without = runCodex(hook, dir, baseEnv());
    const withOrca = runCodex(hook, dir, baseEnv({ ORCA_PANE_KEY: 'pane-abc' }));
    assert.match(withOrca.stdout, /Orca: pane$/m);
    assert.equal(withOrca.stdout.split('\n')[0], `${without.stdout.split('\n')[0]} | Orca: pane`,
      'the summary line must be byte-equal to the no-variable line plus " | Orca: pane"');
  });
});

test('no Orca part outside a pane on Codex, byte for byte', () => {
  withCodexProject((dir, hook) => {
    const first = runCodex(hook, dir, baseEnv());
    const second = runCodex(hook, dir, baseEnv());
    assert.doesNotMatch(first.stdout.split('\n')[0], /Orca/);
    assert.equal(first.stdout, second.stdout);
  });
});

test('an empty Codex project inside a pane still prints the marker', () => {
  withCodexProject((dir, hook) => {
    const result = runCodex(hook, dir, baseEnv({ ORCA_PANE_KEY: 'pane-abc' }));
    assert.equal(result.stdout.split('\n')[0], 'Session startup. Type: app | Orca: pane');
  });
});

test('no token ever reaches stdout or stderr on Codex', () => {
  withCodexProject((dir, hook) => {
    const result = runCodex(hook, dir, baseEnv({
      ORCA_PANE_KEY: 'pane-abc',
      ORCA_AGENT_HOOK_TOKEN: HOOK_TOKEN_SENTINEL,
      ORCA_AGENT_LAUNCH_TOKEN: LAUNCH_TOKEN_SENTINEL,
    }));
    assert.match(result.stdout, /Orca: pane$/m);
    for (const sentinel of [HOOK_TOKEN_SENTINEL, LAUNCH_TOKEN_SENTINEL]) {
      assert.doesNotMatch(result.stdout, new RegExp(sentinel));
      assert.doesNotMatch(result.stderr, new RegExp(sentinel));
    }
  });
});
