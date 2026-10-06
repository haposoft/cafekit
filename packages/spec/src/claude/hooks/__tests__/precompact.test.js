'use strict';

// Behavioral tests for precompact.cjs and the compact-restart readback in
// session.cjs. Both hooks run as real subprocesses against a temporary git
// fixture; the capture is asserted from the file it writes and from what the
// next session actually prints.

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PRECOMPACT = path.join(__dirname, '..', 'precompact.cjs');
const SESSION = path.join(__dirname, '..', 'session.cjs');
const { hookStateDir } = require(path.join(__dirname, '..', 'lib', 'hook-state-dir.cjs'));
const RECOVERY = path.join(hookStateDir(), 'compact-recovery.json');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-precompact-'));
  for (const args of [
    ['init', '-q', '-b', 'work'],
    ['config', 'user.email', 'cafekit@example.invalid'],
    ['config', 'user.name', 'CafeKit Test'],
  ]) {
    const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  }
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'one\n');
  for (const args of [['add', '-A'], ['commit', '-qm', 'fixture']]) {
    const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  }
  return dir;
}

function run(hook, dir, payload) {
  const result = spawnSync(process.execPath, [hook], {
    cwd: dir,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function clearCapture() {
  try { fs.unlinkSync(RECOVERY); } catch { /* absent */ }
}

function readCapture() {
  return JSON.parse(fs.readFileSync(RECOVERY, 'utf8'));
}

test('PreCompact records branch, HEAD, dirty count and the in-flight task', () => {
  const dir = fixture();
  try {
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'two\n');
    fs.writeFileSync(path.join(dir, 'untracked.txt'), 'scratch\n');
    const featureDir = path.join(dir, 'specs', 'demo');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Demo plan\nSpecs-Contract: process-first-ready-v1\n');
    for (const [name, status] of [['task-01-one.md', 'in_progress'], ['task-02-two.md', 'pending']]) {
      fs.writeFileSync(path.join(featureDir, name), [
        `# ${name}`, '', `Status: ${status}`, '',
        '## Dependencies', '', '- none', '',
        '## Verification Plan', '', '- Command: node --test', '',
      ].join('\n'));
    }

    clearCapture();
    const result = run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', trigger: 'auto', session_id: 'compact-session', cwd: dir });
    assert.strictEqual(result.code, 0, result.stderr);

    const record = readCapture();
    assert.strictEqual(record.branch, 'work');
    assert.match(record.head, /^[0-9a-f]{7,}$/);
    assert.strictEqual(record.dirty_count, 3, 'one modified file, one untracked file, one untracked specs directory');
    assert.strictEqual(record.trigger, 'auto');
    assert.strictEqual(record.session_id, 'compact-session');
    assert.strictEqual(record.workflow.feature, 'demo');
    assert.deepStrictEqual(record.workflow.in_progress, ['task-01-one.md']);
    assert.strictEqual(record.workflow.counts.in_progress, 1);
    assert.strictEqual(record.workflow.counts.pending, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});

test('a compact restart prints the captured anchors alongside the authorization warning', () => {
  const dir = fixture();
  try {
    clearCapture();
    assert.strictEqual(run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', trigger: 'manual', cwd: dir }).code, 0);
    const restart = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'compact', cwd: dir });
    assert.strictEqual(restart.code, 0, restart.stderr);
    assert.match(restart.stdout, /VERIFY PENDING AUTHORIZATIONS/, 'the existing warning must survive');
    assert.match(restart.stdout, /State before compaction/);
    assert.match(restart.stdout, /branch work/);
    assert.match(restart.stdout, /Re-read these from disk before acting/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});

test('a compact restart without a capture still prints the warning and nothing invented', () => {
  const dir = fixture();
  try {
    clearCapture();
    const restart = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'compact', cwd: dir });
    assert.strictEqual(restart.code, 0, restart.stderr);
    assert.match(restart.stdout, /VERIFY PENDING AUTHORIZATIONS/);
    assert.doesNotMatch(restart.stdout, /State before compaction/, 'no capture means no claim about prior state');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a normal session start prints no compaction anchors', () => {
  const dir = fixture();
  try {
    clearCapture();
    assert.strictEqual(run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', cwd: dir }).code, 0);
    const startup = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'startup', cwd: dir });
    assert.strictEqual(startup.code, 0, startup.stderr);
    assert.doesNotMatch(startup.stdout, /State before compaction/);
    assert.doesNotMatch(startup.stdout, /VERIFY PENDING AUTHORIZATIONS/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});

test('PreCompact fails open outside a repository and on malformed input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-precompact-bare-'));
  try {
    clearCapture();
    const noGit = run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', cwd: dir });
    assert.strictEqual(noGit.code, 0, 'a directory outside git must not fail the hook');
    const record = readCapture();
    assert.strictEqual(record.branch, null, 'unavailable git facts are recorded as null, never guessed');
    assert.strictEqual(record.head, null);
    assert.strictEqual(record.workflow, null);

    clearCapture();
    const malformed = spawnSync(process.execPath, [PRECOMPACT], {
      cwd: dir, input: 'not json', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
    assert.strictEqual(malformed.status, 0, 'malformed payload must fail open');
    assert.strictEqual(fs.existsSync(RECOVERY), false, 'a malformed payload writes no capture');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});
