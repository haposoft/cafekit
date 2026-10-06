'use strict';

// The Stop gates and the session hooks must not depend on the completion-authority hook files,
// so those files can be deleted without blocking every Stop or crashing SessionStart. Each case
// runs against a real install (bin/install.js), with and without the five legacy files.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const INSTALLER = path.join(__dirname, '..', 'install.js');
const LEGACY_FILES = [
  'completion-authority.cjs',
  'completion-authority-check.cjs',
  'completion-authority-state.cjs',
  'semantic-review-authority.cjs',
  'task-scaffold-guard.cjs',
];
const MIGRATION = /Legacy spec\.json closeout is no longer supported/;

function inTempProject(run) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-decoupled-')));
  try {
    for (const args of [['init', '-q'], ['config', 'user.email', 'test@example.invalid'], ['config', 'user.name', 'Test'], ['commit', '--allow-empty', '-qm', 'base']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const installed = spawnSync(process.execPath, [INSTALLER, '--platform', 'claude,codex', '--yes'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function removeLegacyFiles(root) {
  for (const runtime of ['.claude', '.codex']) {
    for (const file of LEGACY_FILES) {
      const target = path.join(root, runtime, 'hooks', file);
      fs.rmSync(target, { force: true });
    }
  }
}

function runHook(root, kind, script, event, extra = {}) {
  const hook = path.join(root, kind === 'claude' ? '.claude' : '.codex', 'hooks', script);
  const result = spawnSync(process.execPath, [hook], {
    cwd: root,
    input: JSON.stringify({ hook_event_name: event, session_id: 's', stop_hook_active: false, cwd: root, ...extra }),
    env: { ...process.env, PATH: '/usr/bin:/bin', ...(kind === 'claude' ? { CLAUDE_PROJECT_DIR: root } : {}) },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function stopGate(root, kind) {
  return runHook(root, kind, 'spec-gate.cjs', 'Stop');
}

function isBlocked(stdout) {
  return stdout !== '' && JSON.parse(stdout.split('\n').pop()).decision === 'block';
}

function blockReason(stdout) {
  assert.equal(isBlocked(stdout), true, `expected a block, got: ${stdout}`);
  return JSON.parse(stdout.split('\n').pop()).reason;
}

function provenance(root, taskFile) {
  const result = spawnSync(process.execPath, [
    path.join(root, '.claude', 'scripts', 'provenance.cjs'),
    '--project-root', root, '--specs-root', 'specs', '--spec-file', taskFile,
    '--feature-name', 'demo', '--session', 's', '--json',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  return { base: parsed.Base, head: parsed.Head };
}

function writeProcessFirst(root, { receipt }) {
  const featureDir = path.join(root, 'specs', 'demo');
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Demo plan\n');
  const taskFile = path.join(featureDir, 'task-01-demo.md');
  const body = ['# Task 01: demo', '', 'Status: done', '', '## Dependencies', '', '- none', '', '## Verification Plan', '', '- Command: node --test', ''];
  fs.writeFileSync(taskFile, body.join('\n'));
  if (!receipt) return;
  const { base, head } = provenance(root, taskFile);
  fs.writeFileSync(taskFile, [...body, '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${base}`, `Head: ${head}`, '```text', '$ node --test', 'pass: 1', '```', ''].join('\n'));
}

// A 2.1 packet keeps its machine state in spec.json and its tasks in a nested tasks/ directory.
function writeLegacy(root, { status, doneTask = false }) {
  const featureDir = path.join(root, 'specs', 'legacy');
  fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
  const task = 'tasks/task-R1-01-legacy.md';
  const spec = { schema_version: '2.1', feature_name: 'legacy', status, current_phase: 'implementation', task_registry: {} };
  if (doneTask) spec.task_registry[task] = { status: 'done', completed_at: '2026-08-13T00:00:00.000Z', dependencies: [] };
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify(spec));
  if (doneTask) {
    fs.writeFileSync(path.join(featureDir, task), ['# Task R1-01: legacy', '**Status:** done', '## Outcome', 'Legacy work.',
      '## Verification Plan', '- **Command:** `node --test`', '- **Expected:** passes', ''].join('\n'));
  }
}

function checkProcessFirst(kind) {
  inTempProject((root) => {
    writeProcessFirst(root, { receipt: true });
    assert.equal(stopGate(root, kind), '', 'valid receipt passes with the legacy files');
    writeProcessFirst(root, { receipt: false });
    assert.match(blockReason(stopGate(root, kind)), /missing_receipt/, 'no receipt blocks with the legacy files');
    removeLegacyFiles(root);
    assert.match(blockReason(stopGate(root, kind)), /missing_receipt/, 'no receipt blocks without the legacy files');
    writeProcessFirst(root, { receipt: true });
    assert.equal(stopGate(root, kind), '', 'valid receipt passes without the legacy files');
  });
}

function checkLegacyCloseout(kind) {
  for (const status of ['done', 'completed']) {
    inTempProject((root) => {
      writeLegacy(root, { status });
      removeLegacyFiles(root);
      assert.match(blockReason(stopGate(root, kind)), MIGRATION, `${kind} ${status}`);
    });
  }
}

function checkLegacyMidExecution(kind) {
  inTempProject((root) => {
    writeLegacy(root, { status: 'in_progress', doneTask: true });
    removeLegacyFiles(root);
    const reason = blockReason(stopGate(root, kind));
    assert.doesNotMatch(reason, MIGRATION);
    assert.match(reason, /task-R1-01-legacy\.md/);
  });
}

function checkSession(kind) {
  inTempProject((root) => {
    removeLegacyFiles(root);
    runHook(root, kind, 'session.cjs', 'SessionStart', { source: 'startup' });
  });
}

test('claude gate passes and blocks process-first with and without the legacy files', () => checkProcessFirst('claude'));
test('codex gate passes and blocks process-first with and without the legacy files', () => checkProcessFirst('codex'));
test('claude gate blocks legacy 2.1 closeout with the migration message', () => checkLegacyCloseout('claude'));
test('codex gate blocks legacy 2.1 closeout with the migration message', () => checkLegacyCloseout('codex'));
test('claude gate still receipt-checks a legacy 2.1 packet mid-execution', () => checkLegacyMidExecution('claude'));
test('codex gate still receipt-checks a legacy 2.1 packet mid-execution', () => checkLegacyMidExecution('codex'));
test('claude session starts without the legacy files', () => checkSession('claude'));
test('codex session starts without the legacy files', () => checkSession('codex'));
