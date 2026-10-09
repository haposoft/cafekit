'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const SOURCE = path.resolve(__dirname, '../../src');

function fixture({ specs = 'specs', packets = ['auth-flow'] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-codex-quiet-'));
  const hooks = path.join(root, '.codex/hooks');
  fs.cpSync(path.join(SOURCE, 'codex/hooks'), hooks, { recursive: true });
  fs.copyFileSync(path.join(SOURCE, 'claude/hooks/lib/runtime-path-safety.cjs'), path.join(hooks, 'lib/runtime-path-safety.cjs'));
  fs.cpSync(path.join(SOURCE, 'claude/scripts'), path.join(root, '.codex/scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex/runtime.json'), JSON.stringify({ paths: { specs } }));
  fs.writeFileSync(path.join(root, '.gitignore'), '.codex/\n');
  for (const args of [['init', '-q'], ['config', 'user.email', 'probe@example.invalid'], ['config', 'user.name', 'Probe'], ['add', '.gitignore'], ['commit', '-qm', 'base']]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  for (const name of packets) {
    const dir = path.join(root, specs, name); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
    fs.writeFileSync(path.join(dir, 'task-01-work.md'), '# Work\nStatus: pending\n## Dependencies\n- none\n## Verification Plan\n- Command: node --test\n');
  }
  const run = (hook, payload, cwd = root) => {
    const result = spawnSync(process.execPath, [path.join(hooks, `${hook}.cjs`)], {
      cwd, input: JSON.stringify({ cwd, ...payload }), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  return { root, hooks, specs, run, prompt: (id, prompt, more = {}) => run('spec-state', { hook_event_name: 'UserPromptSubmit', session_id: id, prompt, ...more }), cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
function within(options, fn) { const fx = fixture(options); try { fn(fx); } finally { fx.cleanup(); } }
// Native shape pinned by openai/codex apply-patch tests: string stdout summary,
// not the empty object code mode returns (core/src/tools/context.rs).
function patch(fx, session, command, response, cwd = fx.root) {
  if (response === undefined) {
    const files = [];
    for (const line of command.split('\n')) {
      const header = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
      if (header) files.push(`${{ Add: 'A', Update: 'M', Delete: 'D' }[header[1]]} ${header[2]}`);
      else if (line.startsWith('*** Move to: ')) files[files.length - 1] = `M ${line.slice(13)}`;
    }
    response = `Success. Updated the following files:\n${files.join('\n')}\n`;
  }
  return fx.run('spec-state', { hook_event_name: 'PostToolUse', session_id: session, tool_name: 'apply_patch', tool_input: { command }, tool_response: response }, cwd);
}
function snapshot(fx, id, content, generated = new Date().toISOString()) {
  const dir = path.join(fx.root, '.codex/session-state', crypto.createHash('sha256').update(id).digest('hex'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest.md'), `# Session State\n<!-- Generated: ${generated} -->\n${content}\n`);
}

test('untouched sessions remain quiet even beside malformed and multiple active packets', () => {
  within({ packets: ['auth-flow', 'billing-2'] }, (fx) => {
    fs.writeFileSync(path.join(fx.root, 'specs/billing-2/task-01-work.md'), 'Status: invented\n');
    assert.equal(fx.prompt('a', 'Explain README'), '');
    assert.match(fx.prompt('a', '$cf-develop auth-flow'), /Spec state changed: `auth-flow`/);
    assert.equal(fx.prompt('b', 'Continue'), '');
    assert.match(fx.prompt('a', 'Continue'), /auth-flow/);
  });
});
test('named packets narrow relevant ambiguity and explicit targets are remembered', () => {
  within({ packets: ['auth-flow', 'billing-2'] }, (fx) => {
    fs.mkdirSync(path.join(fx.root, 'specs/_shared'));
    fs.writeFileSync(path.join(fx.root, 'specs/_shared/active-feature.json'), '{"featureName":"billing-2"}');
    assert.match(fx.prompt('a', '/cf:develop auth-flow'), /Spec state changed: `auth-flow`/);
    assert.match(fx.prompt('a', 'specs/billing-2'), /Spec state changed: `billing-2`/);
    assert.match(fx.prompt('a', 'Continue'), /Multiple active specs/);
    assert.match(fx.prompt('b', 'Continue', { explicitPath: 'specs/auth-flow/plan.md' }), /auth-flow/);
    assert.match(fx.prompt('b', 'Continue'), /auth-flow/);
    assert.match(fx.prompt('c', 'Continue', { explicitFeature: 'billing-2' }), /billing-2/);
  });
});
test('native successful add/update/delete/move patches touch silently without loading policy or resolver', () => {
  within({ packets: ['auth-flow', 'billing-2'] }, (fx) => {
    fs.writeFileSync(path.join(fx.root, '.codex/scripts/workflow-policy.cjs'), 'throw new Error("must not load");');
    fs.writeFileSync(path.join(fx.root, '.codex/scripts/spec-resolver.cjs'), 'throw new Error("must not resolve");');
    for (const [session, body] of [
      ['add', '*** Add File: specs/auth-flow/new.md\n+new'],
      ['update', '*** Update File: specs/auth-flow/plan.md\n@@\n-old\n+new'],
      ['delete', '*** Delete File: specs/auth-flow/deleted.md'],
      ['move', '*** Update File: specs/auth-flow/old.md\n*** Move to: specs/billing-2/new.md\n@@\n-old\n+new'],
    ]) assert.equal(patch(fx, session, `*** Begin Patch\n${body}\n*** End Patch`), '');
    const records = fs.readdirSync(path.join(fx.hooks, '.logs')).filter((name) => name.startsWith('spec-touched-'));
    assert.equal(records.length, 4);
    assert.ok(records.some((name) => JSON.parse(fs.readFileSync(path.join(fx.hooks, '.logs', name))).length === 2));
    assert.ok(!fs.existsSync(path.join(fx.hooks, '.logs/hook-log.jsonl')));
  });
});
test('failed, malformed, shell and unrelated tool payloads never touch', () => {
  within({}, (fx) => {
    const command = '*** Begin Patch\n*** Add File: specs/auth-flow/new.md\n+new\n*** End Patch';
    for (const response of [null, {}, 'unknown', 'Error: Failed to apply patch', { content: [{ type: 'text', text: 'Failed to find expected lines' }] }, { isError: true }, { success: false }, { exit_code: 1 }, { error: 'failed' }]) assert.equal(patch(fx, 'a', command, response), '');
    for (const invalid of ['echo specs/auth-flow', '*** Begin Patch\n*** Add File: specs/auth-flow/new.md\n*** End Patch']) assert.equal(patch(fx, 'a', invalid), '');
    fx.run('spec-state', { hook_event_name: 'PostToolUse', session_id: 'a', tool_name: 'apply_patch', tool_input: { command } });
    fx.run('spec-state', { hook_event_name: 'PostToolUse', session_id: 'a', tool_name: 'exec_command', tool_input: { command } });
    assert.equal(fx.prompt('a', 'Continue'), '');
  });
});
test('custom root, nested cwd, deleted paths and symlink containment preserve canonical ownership', () => {
  within({ specs: 'work/packets' }, (fx) => {
    const nested = path.join(fx.root, 'nested'); fs.mkdirSync(nested);
    assert.match(fx.prompt('absolute', path.join(fx.root, 'work/packets/auth-flow/plan.md')), /auth-flow/);
    assert.equal(patch(fx, 'a', '*** Begin Patch\n*** Delete File: ../work/packets/auth-flow/deleted.md\n*** End Patch', 'Success. Updated the following files:\nD ../work/packets/auth-flow/deleted.md\n', nested), '');
    assert.match(fx.prompt('a', 'Continue'), /auth-flow/);
    assert.match(fx.prompt('b', 'work/packets/auth-flow'), /auth-flow/);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-quiet-outside-'));
    try {
      fs.symlinkSync(outside, path.join(fx.root, 'work/packets/escape'));
      patch(fx, 'c', '*** Begin Patch\n*** Add File: work/packets/escape/new.md\n+new\n*** End Patch');
      assert.equal(fx.prompt('c', 'Continue'), '');
      assert.match(fx.prompt('explicit', 'Continue', { explicitPath: 'work/packets/auth-flow/task-01-work.md' }), /auth-flow/);
    } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  });
});
test('legacy-compatible writes touch; failed writes and no-session observer do not share an unknown session', () => {
  within({}, (fx) => {
    for (const tool of ['Edit', 'Write', 'MultiEdit']) {
      assert.equal(fx.run('spec-state', { hook_event_name: 'PostToolUse', session_id: tool, tool_name: tool, tool_input: { file_path: 'specs/auth-flow/plan.md' }, tool_response: { ok: true } }), '');
      assert.match(fx.prompt(tool, 'Continue'), /auth-flow/);
    }
    fx.run('spec-state', { hook_event_name: 'PostToolUse', session_id: 'failed', tool_name: 'Write', tool_input: { file_path: 'specs/auth-flow/plan.md' }, tool_response: { success: false } });
    assert.equal(fx.prompt('failed', 'Continue'), '');
    fx.run('spec-state', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'specs/auth-flow/plan.md' } });
    assert.equal(fx.prompt('new', 'Continue'), '');
    assert.match(fx.prompt(undefined, 'Continue'), /runtime_session must be a non-empty/, 'session-less prompt preserves the original provenance failure without inventing identity');
  });
});
test('legacy migration notice stays once per session independently of packet touch', () => {
  within({ packets: [] }, (fx) => {
    const dir = path.join(fx.root, 'specs/old'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'spec.json'), '{}');
    assert.match(fx.prompt('a', 'Hello'), /legacy Specs packet/);
    assert.equal(fx.prompt('a', 'Hello'), '');
    assert.match(fx.prompt('b', 'Hello'), /legacy Specs packet/);
  });
});
test('state hides placeholders and invalid/expired timestamps but restores meaningful per-session content', () => {
  within({ packets: [] }, (fx) => {
    const filler = '## What Worked\n- (No completed tasks recorded)\n## Left\n- (No pending tasks recorded)\n## Agent\n- Completed at 12:30:40\n- Completed without a result message.\n## Files\n- (No file changes detected)';
    snapshot(fx, 'a', filler);
    assert.equal(fx.run('state', { hook_event_name: 'SessionStart', session_id: 'a' }), '');
    for (const timestamp of ['invalid', new Date(Date.now() - 8 * 86400000).toISOString()]) {
      snapshot(fx, 'a', '- real work', timestamp);
      assert.equal(fx.run('state', { hook_event_name: 'SessionStart', session_id: 'a' }), '');
    }
    for (const content of ['- [ ] Build API', '## Agent Result\nVerified endpoint', '## Latest Assistant Message\nSaved edits', '## Key Files Modified\n- src/api.js']) {
      snapshot(fx, 'a', content);
      assert.match(fx.run('state', { hook_event_name: 'SessionStart', session_id: 'a' }), /Prior Execution Context/);
      assert.equal(fx.run('state', { hook_event_name: 'SessionStart', session_id: 'b' }), '');
    }
  });
});
test('template keeps on-demand docs file and registers native mutation observer separately', () => {
  const template = JSON.parse(fs.readFileSync(path.join(SOURCE, 'codex/hooks.json')));
  assert.ok(!JSON.stringify(template.hooks.SessionStart).includes('docs-sync.cjs'));
  assert.ok(fs.existsSync(path.join(SOURCE, 'codex/hooks/docs-sync.cjs')));
  assert.ok(template.hooks.PostToolUse.some((entry) => entry.matcher.includes('apply_patch') && entry.hooks.some((hook) => hook.command.includes('spec-state.cjs'))));
});
