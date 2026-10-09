'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const SOURCE = path.resolve(__dirname, '../../src');

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-native-boundaries-'));
  const hooks = path.join(root, '.codex/hooks');
  try {
    fs.cpSync(path.join(SOURCE, 'codex/hooks'), hooks, { recursive: true });
    for (const name of ['runtime-path-safety', 'privacy-command-analysis', 'secret-keywords']) {
      fs.copyFileSync(path.join(SOURCE, `claude/hooks/lib/${name}.cjs`), path.join(hooks, `lib/${name}.cjs`));
    }
    fs.cpSync(path.join(SOURCE, 'claude/scripts'), path.join(root, '.codex/scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, '.gitignore'), '.codex/\n');
    for (const args of [['init', '-q'], ['config', 'user.email', 'probe@example.invalid'], ['config', 'user.name', 'Probe'], ['add', '.gitignore'], ['commit', '-qm', 'base']]) {
      assert.equal(spawnSync('git', ['-C', root, ...args]).status, 0);
    }
    const hook = (name, payload = {}) => spawnSync(process.execPath, [path.join(hooks, `${name}.cjs`)], {
      cwd: root, input: JSON.stringify({ cwd: root, session_id: 'a', ...payload }), encoding: 'utf8',
    });
    run({ root, hooks, hook });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function task(root, name, status = 'pending', receipt = '') {
  const dir = path.join(root, 'specs/demo'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
  fs.writeFileSync(path.join(dir, name), `# Task\nStatus: ${status}\n## Dependencies\n- none\n## Verification Plan\n- Command: node --test\n${receipt}`);
}

test('privacy walks nested operation arrays but ignores prose', () => fixture(({ hook }) => {
  for (const tool_input of [{ operations: [{ path: 'credentials.json' }] }, { operations: [[{ file_path: 'credentials.json' }]] }, { paths: ['credentials.json'] }]) {
    const result = hook('privacy-block', { tool_name: 'mcp__files__read', tool_input });
    assert.match(result.stdout, /APPROVE CAFEKIT PRIVACY/);
  }
  assert.equal(hook('privacy-block', { tool_name: 'mcp__files__read', tool_input: { messages: ['credentials.json', { text: 'credentials.json' }] } }).stdout, '');
}));

test('session startup revokes only its own pending requests and grants', () => fixture(({ root, hooks, hook }) => {
  const privacy = require(path.join(hooks, 'lib/privacy-state.cjs'));
  const request = { projectRoot: root, sessionCwd: root, sessionId: 'a', filePath: 'credentials.json' };
  const grant = privacy.createPending(request);
  assert.equal(privacy.approvePending({ ...request, requestId: grant.requestId }).ok, true);
  const pending = privacy.createPending(request);
  for (const session_id of ['b', undefined]) {
    assert.equal(hook('session', { session_id, hook_event_name: 'SessionStart', source: 'compact' }).status, 0);
    assert.equal(privacy.hasGrant(request), true);
    assert.ok(fs.existsSync(path.join(hooks, `.privacy/pending-${pending.requestId}.json`)));
  }
  assert.equal(hook('session', { hook_event_name: 'SessionStart', source: 'resume' }).status, 0);
  assert.equal(privacy.hasGrant(request), false);
  assert.equal(privacy.approvePending({ ...request, requestId: pending.requestId }).ok, false);
}));

test('cache persistence failure does not replace receipt authority', () => fixture(({ root, hooks, hook }) => {
  task(root, 'task-01-work.md');
  fs.mkdirSync(path.join(hooks, '.logs/spec-gate-last.json'), { recursive: true });
  assert.equal(hook('spec-gate', { hook_event_name: 'Stop' }).stdout, '');
  task(root, 'task-01-work.md', 'done');
  const result = hook('spec-gate', { hook_event_name: 'Stop', explicitFeature: 'demo' });
  assert.match(JSON.parse(result.stdout).reason, /lack a verification receipt/);
  assert.doesNotMatch(result.stdout, /EISDIR|controlled failure/);
  fs.writeFileSync(path.join(root, '.codex/runtime.json'), '{"spec":{"completion_gate":false}}');
  assert.match(hook('spec-gate', { hook_event_name: 'Stop' }).stdout, /no completion-gate bypass/);
}));

test('build output directories are allowed while inspection commands stay blocked', () => fixture(({ hook }) => {
  for (const command of ['vite build --outDir ./dist', 'tsc --outDir ./build', 'npm run build -- --outDir ./dist', 'cargo build --target-dir ./target']) {
    assert.equal(hook('inspect-block', { tool_name: 'exec_command', tool_input: { command } }).status, 0, command);
  }
  for (const command of ['cat dist/index.js', 'find ./dist', 'grep x dist/index.js', 'vite build --outDir ./dist && cat dist/index.js', 'npm exec cat ./dist/index.js', 'vite build --outDir ./dist $(cat dist/index.js)']) {
    assert.equal(hook('inspect-block', { tool_name: 'exec_command', tool_input: { command } }).status, 2, command);
  }
  assert.equal(hook('inspect-block', { tool_input: { path: './dist/index.js' } }).status, 2);
}));

test('one gate invocation captures one stable snapshot for multiple receipts and rechecks next run', () => fixture(({ root, hook }) => {
  task(root, 'task-06-pending.md');
  const provenanceFile = path.join(root, '.codex/scripts/provenance.cjs');
  const trace = path.join(root, '.codex/manifest-count');
  fs.writeFileSync(provenanceFile, fs.readFileSync(provenanceFile, 'utf8').replace('function manifest(root, specsRoot) {', `function manifest(root, specsRoot) { fs.appendFileSync(${JSON.stringify(trace)}, 'x');`));
  const provenance = require(provenanceFile);
  const context = provenance.deriveRuntimeContext({ projectRoot: root, specsRoot: path.join(root, 'specs'), specFile: path.join(root, 'specs/demo/plan.md'), featureName: 'demo', runtimeSession: 'a' });
  const receipt = `## Receipt\nVerification: PASS\nCommand: node --test\nExit: 0\nBase: ${context.base}\nHead: ${context.head}\n\`\`\`text\nnode --test\n1 test passed\n\`\`\`\n`;
  for (let n = 1; n <= 5; n += 1) task(root, `task-0${n}-work.md`, 'done', receipt);
  for (const args of [['add', 'specs'], ['commit', '-qm', 'packet']]) assert.equal(spawnSync('git', ['-C', root, ...args]).status, 0);
  fs.writeFileSync(trace, '');
  assert.equal(hook('spec-gate', { hook_event_name: 'Stop' }).stdout, '');
  assert.equal(fs.readFileSync(trace, 'utf8').length, 2);
  fs.writeFileSync(path.join(root, 'changed.js'), 'changed');
  fs.appendFileSync(path.join(root, 'specs/demo/task-01-work.md'), '\n');
  const blocked = hook('spec-gate', { hook_event_name: 'Stop' }).stdout;
  assert.match(blocked, /provenance/);
  assert.match(blocked, /lines are present but are not the pair/);
  assert.equal(fs.readFileSync(trace, 'utf8').length, 4);
}));
