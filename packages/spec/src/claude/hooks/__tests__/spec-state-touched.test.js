'use strict';

// spec-state injects the active packet's tollgate on every prompt. With several sessions in
// one checkout, a Claude session kept seeing a packet another session was working on. On
// Claude the hook now speaks only about packets this session touched; omp, grok and
// payloads without a Claude session id keep the old behaviour. Each case names the failure
// it prevents.

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLAUDE_ROOT = path.join(__dirname, '..', '..');

function taskContent(status) {
  return ['# Task 01 — work', '', `Status: ${status}`, '', '## Dependencies', '', '- none', '',
    '## Verification Plan', '', '- Command: node --test', ''].join('\n');
}

function writePacket(root, name) {
  const dir = path.join(root, 'specs', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.md'), `# ${name}\nSpecs-Contract: process-first-ready-v1\n`);
  fs.writeFileSync(path.join(dir, 'task-01-work.md'), taskContent('pending'));
  return dir;
}

/** A project with the installed hook tree under `<root>/<runtimeDir>/hooks` and the given packets. */
function fixture(packets, runtimeDir = '.claude') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-spec-touched-'));
  const hooks = path.join(root, runtimeDir, 'hooks');
  const scripts = path.join(root, runtimeDir, 'scripts');
  fs.mkdirSync(path.join(hooks, 'lib'), { recursive: true });
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(path.join(CLAUDE_ROOT, 'hooks', 'spec-state.cjs'), path.join(hooks, 'spec-state.cjs'));
  for (const lib of ['runtime-dir.cjs', 'hook-payload.cjs', 'hook-state-dir.cjs']) {
    fs.copyFileSync(path.join(CLAUDE_ROOT, 'hooks', 'lib', lib), path.join(hooks, 'lib', lib));
  }
  for (const file of ['provenance.cjs', 'spec-receipt.cjs', 'spec-resolver.cjs', 'workflow-policy.cjs']) {
    fs.copyFileSync(path.join(CLAUDE_ROOT, 'scripts', file), path.join(scripts, file));
  }
  for (const name of packets) writePacket(root, name);
  for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'],
    ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
    const git = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.strictEqual(git.status, 0, git.stderr);
  }
  const run = (payload) => {
    const result = spawnSync(process.execPath, [path.join(hooks, 'spec-state.cjs')], {
      cwd: root, env: { ...process.env, PROJECT_ROOT: root },
      input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const prompt = (session, text) => run({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt: text });
  const cacheFile = path.join(hooks, '.logs', 'tollgate-last.txt');
  return { root, hooks, run, prompt, cacheFile, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function within(fx, fn) {
  try { return fn(fx); } finally { fx.cleanup(); }
}

test('an untouched packet prints nothing on Claude', () => {
  within(fixture(['auth-flow']), (fx) => {
    assert.strictEqual(fx.prompt('s1', 'Continue'), '');
    assert.strictEqual(fs.existsSync(fx.cacheFile), false, 'a filtered session must not claim the cache slot');
  });
});

test('naming the packet in the prompt touches it and keeps the full block', () => {
  within(fixture(['auth-flow']), (fx) => {
    assert.strictEqual(fx.prompt('s1', 'Continue'), '');
    assert.match(fx.prompt('s1', 'continue auth-flow'), /Spec state changed/);
    assert.match(fx.prompt('s1', 'Continue'), /Tollgate active/);
  });
});

test('editing a file inside the packet touches it silently', () => {
  within(fixture(['auth-flow']), (fx) => {
    // macOS tmp dirs live under /private/var behind the /var symlink; send the other spelling.
    const real = fs.realpathSync(fx.root);
    const alias = real.startsWith('/private/var/') ? real.slice('/private'.length) : (() => {
      const link = path.join(os.tmpdir(), `ck-alias-${process.pid}-${Date.now()}`);
      fs.symlinkSync(real, link);
      return link;
    })();
    const edited = path.join(alias, 'specs', 'auth-flow', 'plan.md');
    assert.notStrictEqual(edited, fs.realpathSync(edited), 'the path sent must not be canonical');
    const out = fx.run({ hook_event_name: 'PostToolUse', session_id: 's2', tool_name: 'Edit', tool_input: { file_path: edited } });
    assert.strictEqual(out, '');
    assert.strictEqual(fs.existsSync(fx.cacheFile), false, 'a touch record must not run the tollgate');
    assert.match(fx.prompt('s2', 'Continue'), /Spec state changed/);
    if (!real.startsWith('/private/var/')) fs.rmSync(alias, { force: true });
  });
});

test('a plain one-word slug needs specs/ prefix', () => {
  within(fixture(['docs']), (fx) => {
    assert.strictEqual(fx.prompt('s1', 'fix the docs'), '');
    assert.match(fx.prompt('s1', 'look at specs/docs'), /Spec state changed/);
  });
});

test("another session's touch does not leak", () => {
  within(fixture(['auth-flow']), (fx) => {
    assert.match(fx.prompt('s3', 'specs/auth-flow'), /Spec state changed/);
    assert.strictEqual(fx.prompt('s4', 'Continue'), '');
  });
});

test('omp, grok and session-less payloads keep the old behaviour', () => {
  within(fixture(['auth-flow'], '.omp'), (fx) => {
    assert.match(fx.prompt('s5', 'Continue'), /Spec state changed/, 'omp is unchanged');
  });
  within(fixture(['auth-flow']), (fx) => {
    assert.match(fx.run({ hook_event_name: 'UserPromptSubmit', sessionId: 's6', prompt: 'Continue' }), /Spec/, 'grok sends sessionId');
  });
  within(fixture(['auth-flow']), (fx) => {
    assert.match(fx.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Continue' }), /Spec/, 'no session id');
  });
});

test('a prompt touch is remembered even when two packets are active', () => {
  within(fixture(['auth-flow', 'billing-2']), (fx) => {
    assert.match(fx.prompt('s7', 'work on specs/auth-flow'), /Multiple active specs/);
    fs.rmSync(path.join(fx.root, 'specs', 'billing-2'), { recursive: true, force: true });
    assert.match(fx.prompt('s7', 'Continue'), /auth-flow/);
  });
});

function writeLegacyPacket(root, name) {
  const dir = path.join(root, 'specs', name);
  fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify({ feature_name: name, status: 'in_progress' }));
}

const LEGACY_NOTICE = /`specs\/old` is a legacy Specs packet without plan\.md; CafeKit no longer reads it/;

test('a leftover legacy packet is noticed once per session, before the touch filter', () => {
  within(fixture(['auth-flow']), (fx) => {
    writeLegacyPacket(fx.root, 'old');
    const first = fx.prompt('s1', 'Continue');
    assert.match(first, LEGACY_NOTICE);
    assert.strictEqual(first.match(new RegExp(LEGACY_NOTICE.source, 'g')).length, 1);
    assert.strictEqual(fx.prompt('s1', 'Continue'), '', 'the same session is not told twice');
    assert.match(fx.prompt('s2', 'Continue'), LEGACY_NOTICE, 'a new session is told once');
  });
});

test('a legacy packet is noticed even when it is the only packet', () => {
  within(fixture([]), (fx) => {
    writeLegacyPacket(fx.root, 'old');
    assert.match(fx.prompt('s1', 'Continue'), LEGACY_NOTICE);
  });
});
