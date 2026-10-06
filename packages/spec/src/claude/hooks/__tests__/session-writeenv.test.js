'use strict';

// Behavioral test for session.cjs writeEnv escaping. A git branch name is an
// attacker-influenced value that flows into GIT_BRANCH in CLAUDE_ENV_FILE. If
// the value is not escaped, sourcing that env file expands `$HOME` and executes
// the `pwd` command substitution. We build a repo whose branch carries both
// payloads (space-free, since git bans spaces in refs), run the hook, then
// source the produced env file and assert GIT_BRANCH read back is the exact
// literal branch name — nothing expanded or executed.

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', 'session.cjs');

function git(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  }
  return res.stdout.trim();
}

test('session.cjs escapes shell metacharacters in GIT_BRANCH (no injection when sourced)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-session-'));
  const envFile = path.join(dir, 'env.sh');
  try {
    // Branch name carries both a $HOME expansion and a `pwd` command
    // substitution. Both are space-free so git accepts them as a valid ref.
    const payloadBranch = 'evil$HOME-x`pwd`';
    git(['init', '-q'], dir);
    git(['config', 'user.email', 't@t.co'], dir);
    git(['config', 'user.name', 't'], dir);
    git(['commit', '-q', '--allow-empty', '-m', 'init'], dir);
    git(['checkout', '-q', '-b', payloadBranch], dir);

    // Run the hook exactly as Claude Code would (SessionStart on stdin).
    const res = spawnSync(process.execPath, [HOOK], {
      cwd: dir,
      input: JSON.stringify({ source: 'startup' }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_ENV_FILE: envFile },
    });
    assert.strictEqual(res.status, 0, 'hook must exit 0 (fail-open)');
    assert.ok(fs.existsSync(envFile), 'env file must be written');

    const envText = fs.readFileSync(envFile, 'utf8');
    const branchLine = envText.split('\n').find((l) => l.startsWith('export GIT_BRANCH='));
    assert.ok(branchLine, 'GIT_BRANCH must be present');
    assert.ok(branchLine.includes('\\$') && branchLine.includes('\\`'), 'both $ and backtick must be escaped');

    // The real proof: source the env file, then echo the value back. It must
    // equal the literal branch name — no $HOME expansion, no pwd execution.
    const sourced = spawnSync('sh', ['-c', `. "${envFile}" && printf '%s' "$GIT_BRANCH"`], { encoding: 'utf8' });
    assert.strictEqual(sourced.status, 0, 'sourcing env file should succeed');
    assert.strictEqual(
      sourced.stdout,
      payloadBranch,
      'GIT_BRANCH must read back as the exact literal branch (no expansion/execution)',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
