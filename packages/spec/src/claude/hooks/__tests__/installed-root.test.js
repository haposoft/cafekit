'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const CLAUDE = path.resolve(__dirname, '../..');
const MANIFEST = require('../../migration-manifest.json');
const RUNTIME = { paths: { specs: 'work-specs', plans: 'work-plans', docs: 'work-docs' }, inspect: { enabled: false } };

function fixture(run, withRuntime = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-installed-root-'));
  const sessions = new Set();
  try {
    for (const relative of MANIFEST.runtime.files) {
      const target = path.join(root, '.claude', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(CLAUDE, relative), target);
    }
    for (const relative of MANIFEST.scripts.required) {
      const target = path.join(root, '.claude/scripts', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(CLAUDE, 'scripts', relative), target);
    }
    const runtimeFile = path.join(root, '.claude/runtime.json');
    const writeRuntime = () => fs.writeFileSync(runtimeFile, JSON.stringify(RUNTIME));
    if (withRuntime) writeRuntime();
    else fs.unlinkSync(runtimeFile);
    const cwd = path.join(root, 'sub/dir');
    fs.mkdirSync(cwd, { recursive: true });
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.PROJECT_ROOT;
    const invoke = (name, payload) => {
      if (payload.session_id) sessions.add(payload.session_id);
      return spawnSync(process.execPath, [path.join(root, '.claude/hooks', `${name}.cjs`)], {
        cwd, env, encoding: 'utf8', input: JSON.stringify({ cwd, ...payload }),
      });
    };
    run({ root: fs.realpathSync(root), cwd, invoke, writeRuntime });
  } finally {
    for (const session of sessions) {
      const key = crypto.createHash('sha256').update(session).digest('hex').slice(0, 16);
      fs.rmSync(path.join(os.tmpdir(), `cafekit-rules-${key}.json`), { force: true });
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('installed rules read the project runtime from a nested session cwd', () => {
  fixture(({ root, invoke }) => {
    const result = invoke('rules', { hook_event_name: 'UserPromptSubmit', session_id: crypto.randomUUID() });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /## Rules/);
    assert.ok(result.stdout.includes(`${root}/work-specs/`));
  });
});

test('rules wait for runtime before reserving the session injection', () => {
  fixture(({ invoke, writeRuntime }) => {
    const payload = { hook_event_name: 'UserPromptSubmit', session_id: crypto.randomUUID() };
    const absent = invoke('rules', payload);
    assert.equal(absent.status, 0, absent.stderr);
    assert.equal(absent.stdout, '');
    writeRuntime();
    const present = invoke('rules', payload);
    assert.equal(present.status, 0, present.stderr);
    assert.match(present.stdout, /## Rules/);
  }, false);
});

test('installed inspect respects a disabled project runtime from a nested cwd', () => {
  fixture(({ invoke }) => {
    const result = invoke('inspect-block', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'node_modules/pkg/index.js' } });
    assert.equal(result.status, 0, result.stderr);
  });
});

test('installed agent context uses project paths from a nested session cwd', () => {
  fixture(({ root, invoke }) => {
    const result = invoke('agent', { hook_event_name: 'SubagentStart', agent_id: 'nested-agent' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /additionalContext/);
    const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
    for (const relative of ['work-specs', 'work-plans', 'work-docs']) assert.ok(context.includes(`${root}/${relative}/`));
  });
});

test('installed spec gate checks root packet receipts from a nested session cwd', () => {
  fixture(({ root, invoke }) => {
    for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const packet = path.join(root, 'work-specs/demo');
    fs.mkdirSync(packet, { recursive: true });
    fs.writeFileSync(path.join(packet, 'plan.md'), '# Demo\nSpecs-Contract: process-first-ready-v1\n');
    fs.writeFileSync(path.join(packet, 'task-01-work.md'), '# Work\n\nStatus: done\n\n## Dependencies\n\n- none\n\n## Verification Plan\n\n- Command: node --test\n');
    const result = invoke('spec-gate', { hook_event_name: 'Stop', session_id: crypto.randomUUID() });
    assert.equal(result.status, 0, result.stderr);
    const block = JSON.parse(result.stdout);
    assert.equal(block.decision, 'block');
    assert.match(block.reason, /receipt/i);
    assert.match(block.reason, /task-01-work\.md/);
    assert.doesNotMatch(block.reason, /unavailable|controlled failure/i);
  });
});
