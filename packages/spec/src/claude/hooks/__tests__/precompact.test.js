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
const crypto = require('node:crypto');

const PRECOMPACT = path.join(__dirname, '..', 'precompact.cjs');
const SESSION = path.join(__dirname, '..', 'session.cjs');
const { hookStateDir } = require(path.join(__dirname, '..', 'lib', 'hook-state-dir.cjs'));
const CAPTURES = new Set([path.join(hookStateDir(), 'compact-recovery.json')]);
function recoveryPath(session = 'compact-session') {
  const key = crypto.createHash('sha256').update(session).digest('hex');
  const file = path.join(hookStateDir(), `compact-recovery-${key}.json`);
  CAPTURES.add(file);
  return file;
}
const HOOK_ENV = { ...process.env };
delete HOOK_ENV.CLAUDE_PROJECT_DIR;
delete HOOK_ENV.PROJECT_ROOT;

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
  if (typeof payload?.session_id === 'string' && payload.session_id.trim()) recoveryPath(payload.session_id);
  const result = spawnSync(process.execPath, [hook], {
    cwd: dir,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: HOOK_ENV,
  });
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function clearCapture() {
  for (const file of CAPTURES) {
    try { fs.unlinkSync(file); } catch { /* absent */ }
  }
}

function readCapture(session) {
  return JSON.parse(fs.readFileSync(recoveryPath(session), 'utf8'));
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
    assert.strictEqual(run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', trigger: 'manual', session_id: 'compact-session', cwd: dir }).code, 0);
    const restart = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'compact', session_id: 'compact-session', cwd: dir });
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

test('a compact restart in another session prints the warning without foreign anchors', () => {
  const dir = fixture();
  try {
    clearCapture();
    assert.strictEqual(run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', session_id: 'session-a', cwd: dir }).code, 0);
    const restart = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'compact', session_id: 'session-b', cwd: dir });
    assert.strictEqual(restart.code, 0, restart.stderr);
    assert.match(restart.stdout, /SESSION COMPRESSED/);
    assert.doesNotMatch(restart.stdout, /State before compaction/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});

test('a compact restart in the same session restores its captured anchors', () => {
  const dir = fixture();
  try {
    clearCapture();
    assert.strictEqual(run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', session_id: 'session-a', cwd: dir }).code, 0);
    const restart = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'compact', session_id: 'session-a', cwd: dir });
    assert.strictEqual(restart.code, 0, restart.stderr);
    assert.match(restart.stdout, /SESSION COMPRESSED/);
    assert.match(restart.stdout, /State before compaction[\s\S]*branch work/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});

for (const [captureId, restartId] of [[undefined, 'session-a'], ['session-a', undefined], [undefined, undefined]]) {
  test(`a compact restart without ${captureId ? 'restart' : restartId ? 'capture' : 'either'} session identity keeps only the warning`, () => {
    const dir = fixture();
    try {
      clearCapture();
      assert.strictEqual(run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', session_id: captureId, cwd: dir }).code, 0);
      const restart = run(SESSION, dir, { hook_event_name: 'SessionStart', source: 'compact', session_id: restartId, cwd: dir });
      assert.strictEqual(restart.code, 0, restart.stderr);
      assert.match(restart.stdout, /SESSION COMPRESSED/);
      assert.doesNotMatch(restart.stdout, /State before compaction/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      clearCapture();
    }
  });
}

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
    const noGit = run(PRECOMPACT, dir, { hook_event_name: 'PreCompact', session_id: 'compact-session', cwd: dir });
    assert.strictEqual(noGit.code, 0, 'a directory outside git must not fail the hook');
    const record = readCapture();
    assert.strictEqual(record.branch, null, 'unavailable git facts are recorded as null, never guessed');
    assert.strictEqual(record.head, null);
    assert.strictEqual(record.workflow, null);

    clearCapture();
    const malformed = spawnSync(process.execPath, [PRECOMPACT], {
      cwd: dir, input: 'not json', encoding: 'utf8', env: HOOK_ENV,
    });
    assert.strictEqual(malformed.status, 0, 'malformed payload must fail open');
    assert.strictEqual(fs.existsSync(recoveryPath()), false, 'a malformed payload writes no capture');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearCapture();
  }
});

function installedFixture(callback) {
  const root = fixture();
  const source = path.resolve(__dirname, '../..');
  const manifest = require('../../migration-manifest.json');
  const sessions = new Set();
  try {
    for (const relative of manifest.runtime.files) {
      const target = path.join(root, '.claude', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source, relative), target);
    }
    for (const relative of manifest.scripts.required) {
      const target = path.join(root, '.claude/scripts', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source, 'scripts', relative), target);
    }
    const hooks = path.join(root, '.claude/hooks');
    const invoke = (name, payload, overrides = {}) => {
      if (typeof payload?.session_id === 'string' && payload.session_id.trim()) sessions.add(payload.session_id);
      return spawnSync(process.execPath, [path.join(hooks, `${name}.cjs`)], {
        cwd: root, env: HOOK_ENV, encoding: 'utf8', timeout: 10000,
        input: typeof payload === 'string' ? payload : JSON.stringify(payload), ...overrides,
      });
    };
    callback({ root: fs.realpathSync(root), hooks, invoke });
  } finally {
    for (const session of sessions) {
      const key = crypto.createHash('sha256').update(session).digest('hex').slice(0, 16);
      fs.rmSync(path.join(os.tmpdir(), `cafekit-rules-${key}.json`), { force: true });
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('two compacting sessions keep separate anchors and restore only their own branch', () => {
  installedFixture(({ root, hooks, invoke }) => {
    const sessions = [crypto.randomUUID(), crypto.randomUUID()];
    const files = [];
    for (const [index, session_id] of sessions.entries()) {
      const branch = `anchor-${index === 0 ? 'first' : 'second'}`;
      const checkout = spawnSync('git', ['-C', root, 'checkout', '-qb', branch], { encoding: 'utf8' });
      assert.strictEqual(checkout.status, 0, checkout.stderr);
      const capture = invoke('precompact', { hook_event_name: 'PreCompact', session_id, cwd: root });
      assert.strictEqual(capture.status, 0, capture.stderr);
      const hash = crypto.createHash('sha256').update(session_id).digest('hex');
      files.push(path.join(hooks, '.logs', `compact-recovery-${hash}.json`));
    }
    for (const [index, file] of files.entries()) {
      assert.ok(fs.existsSync(file), 'both session captures must survive');
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.strictEqual(record.session_id, sessions[index]);
      assert.strictEqual(record.branch, `anchor-${index === 0 ? 'first' : 'second'}`);
    }
    for (const [index, session_id] of sessions.entries()) {
      const compact = invoke('session', { hook_event_name: 'SessionStart', source: 'compact', session_id, cwd: root });
      assert.strictEqual(compact.status, 0, compact.stderr);
      assert.match(compact.stdout, /SESSION COMPRESSED/);
      assert.match(compact.stdout, /State before compaction/);
      assert.ok(compact.stdout.includes(`branch anchor-${index === 0 ? 'first' : 'second'}`));
      assert.ok(!compact.stdout.includes(`branch anchor-${index === 0 ? 'second' : 'first'}`));
    }
  });
});

test('PreCompact without a usable session identity creates no anchor or state directory', () => {
  installedFixture(({ root, hooks, invoke }) => {
    for (const session_id of [undefined, null, '', 42, '   ']) {
      const capture = invoke('precompact', { hook_event_name: 'PreCompact', session_id, cwd: root });
      assert.strictEqual(capture.status, 0, capture.stderr);
      assert.strictEqual(fs.existsSync(path.join(hooks, '.logs')), false);
    }
  });
});

test('compact reinjects rules only for its own session even without matching anchors', () => {
  installedFixture(({ root, hooks, invoke }) => {
    const session = crypto.randomUUID();
    const other = crypto.randomUUID();
    const prompt = id => invoke('rules', { hook_event_name: 'UserPromptSubmit', session_id: id, cwd: root });
    for (const id of [session, other]) {
      const first = prompt(id);
      assert.strictEqual(first.status, 0, first.stderr);
      assert.match(first.stdout, /## Rules/);
      assert.strictEqual(prompt(id).stdout, '');
    }
    fs.mkdirSync(path.join(hooks, '.logs'), { recursive: true });
    const otherHash = crypto.createHash('sha256').update(other).digest('hex');
    fs.writeFileSync(path.join(hooks, '.logs', `compact-recovery-${otherHash}.json`), JSON.stringify({ session_id: other }));
    const compact = invoke('session', { hook_event_name: 'SessionStart', source: 'compact', session_id: session, cwd: root });
    assert.strictEqual(compact.status, 0, compact.stderr);
    assert.match(compact.stdout, /SESSION COMPRESSED/);
    assert.doesNotMatch(compact.stdout, /State before compaction/);
    const again = prompt(session);
    assert.strictEqual(again.status, 0, again.stderr);
    assert.match(again.stdout, /## Rules/);
    assert.strictEqual(prompt(other).stdout, '');
  });
});

test('malformed session input fails open without a stack and logs its crash', () => {
  installedFixture(({ hooks, invoke }) => {
    const result = invoke('session', '{');
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stderr, '');
    const rows = fs.readFileSync(path.join(hooks, '.logs/hook-log.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].hook, 'session');
    assert.strictEqual(rows[0].status, 'crash');
  });
});

test('installed session explains a nested cwd but omits the root line without a cwd', () => {
  installedFixture(({ root, invoke }) => {
    const cwd = path.join(root, 'sub/dir');
    fs.mkdirSync(cwd, { recursive: true });
    const nested = invoke('session', { source: 'startup', cwd }, { cwd });
    assert.strictEqual(nested.status, 0, nested.stderr);
    assert.ok(nested.stdout.includes(`CafeKit project root: ${root} (session working directory: ${cwd}).`));
    const missing = invoke('session', { source: 'startup' }, { cwd });
    assert.strictEqual(missing.status, 0, missing.stderr);
    assert.doesNotMatch(missing.stdout, /CafeKit project root:/);
  });
});

test('PreCompact bounds slow git calls and finishes within ten seconds', { timeout: 15000 }, () => {
  installedFixture(({ root, invoke }) => {
    const bin = path.join(root, 'fake-bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexec /bin/sleep 30\n', { mode: 0o755 });
    const start = Date.now();
    const result = invoke('precompact', { hook_event_name: 'PreCompact', session_id: crypto.randomUUID(), cwd: root }, { env: { ...HOOK_ENV, PATH: bin } });
    assert.strictEqual(result.status, 0, 'slow git must not exhaust the hook timeout');
    assert.ok(Date.now() - start < 10000);
  });
});
