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
const crypto = require('node:crypto');

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
  for (const lib of ['runtime-dir.cjs', 'hook-payload.cjs', 'hook-state-dir.cjs', 'project-root.cjs', 'spec-touch.cjs']) {
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
  let lastSession = null;
  const run = (payload) => {
    lastSession = payload.session_id;
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.PROJECT_ROOT;
    const result = spawnSync(process.execPath, [path.join(hooks, 'spec-state.cjs')], {
      cwd: root, env,
      input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const prompt = (session, text) => run({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt: text });
  return {
    root, hooks, run, prompt,
    get cacheFile() {
      const name = runtimeDir === '.claude' && typeof lastSession === 'string' && lastSession
        ? `tollgate-last-${crypto.createHash('sha256').update(lastSession).digest('hex').slice(0, 16)}.txt`
        : 'tollgate-last.txt';
      return path.join(hooks, '.logs', name);
    },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function within(fx, fn) {
  try { return fn(fx); } finally { fx.cleanup(); }
}

test('Claude spec-state says receipt revalidation never grants approval', () => {
  within(fixture(['auth-flow']), fx => {
    assert.match(fx.prompt('message-session', 'specs/auth-flow'), /^- Hooks revalidate receipt bytes but never grant approval\.$/m);
  });
});

test('Claude subagent rules include the shared simplicity and reporting instructions', () => {
  within(fixture([]), fx => {
    fs.copyFileSync(path.join(CLAUDE_ROOT, 'hooks/agent.cjs'), path.join(fx.hooks, 'agent.cjs'));
    fs.writeFileSync(path.join(fx.root, '.claude/runtime.json'), '{}');
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.PROJECT_ROOT;
    const result = spawnSync(process.execPath, [path.join(fx.hooks, 'agent.cjs')], {
      cwd: fx.root, env, encoding: 'utf8', input: JSON.stringify({ cwd: fx.root, hook_event_name: 'SubagentStart', agent_type: 'checker' }),
    });
    assert.strictEqual(result.status, 0, result.stderr);
    const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
    const rules = context.split('## Rules\n')[1];
    assert.ok(rules, 'the rules section must be present');
    assert.match(rules, /^- YAGNI · KISS · DRY$/m);
    assert.match(rules, /^- Be concise\. List unresolved questions at end\.$/m);
  });
});

test('an untouched packet prints nothing on Claude', () => {
  within(fixture(['auth-flow']), (fx) => {
    assert.strictEqual(fx.prompt('s1', 'Continue'), '');
    assert.strictEqual(fs.existsSync(fx.cacheFile), false, 'a filtered session must not claim the cache slot');
  });
});

test('a touched packet respects the project tollgate toggle from a nested cwd', () => {
  within(fixture(['auth-flow']), fx => {
    assert.match(fx.prompt('s1', 'specs/auth-flow'), /Spec state changed/);
    fs.writeFileSync(path.join(fx.root, '.claude/runtime.json'), JSON.stringify({ spec: { tollgate: false } }));
    const cwd = path.join(fx.root, 'sub/dir');
    fs.mkdirSync(cwd, { recursive: true });
    assert.strictEqual(fx.run({ cwd, session_id: 's1', hook_event_name: 'UserPromptSubmit', prompt: 'Continue' }), '');
  });
});

test('an explicitly failed edit does not touch its packet', () => {
  within(fixture(['auth-flow']), fx => {
    fx.run({ session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Edit',
      tool_input: { file_path: path.join(fx.root, 'specs/auth-flow/plan.md') }, tool_response: { is_error: true } });
    assert.strictEqual(fx.prompt('s1', 'Continue'), '');
  });
});

test('written content mentioning failure still touches its packet', () => {
  within(fixture(['auth-flow']), fx => {
    fx.run({ session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Write',
      tool_input: { file_path: path.join(fx.root, 'specs/auth-flow/plan.md') }, tool_response: { content: 'Failed x' } });
    assert.match(fx.prompt('s1', 'Continue'), /Spec state changed/);
  });
});

test('a configured specs prefix names a plain lowercase packet', () => {
  within(fixture(['auth']), fx => {
    fs.renameSync(path.join(fx.root, 'specs'), path.join(fx.root, 'planning'));
    fs.writeFileSync(path.join(fx.root, '.claude/runtime.json'), JSON.stringify({ paths: { specs: 'planning' } }));
    assert.match(fx.prompt('s1', 'Continue planning/auth'), /Spec state changed: `auth`/);
  });
});

test('an explicit packet path records the session touch', () => {
  within(fixture(['auth']), fx => {
    assert.match(fx.run({ session_id: 's1', hook_event_name: 'UserPromptSubmit',
      specPath: path.join(fs.realpathSync(fx.root), 'specs/auth'), prompt: 'Continue' }), /Spec state changed: `auth`/);
    assert.match(fx.prompt('s1', 'Continue'), /Tollgate active/);
  });
});

test('another session does not displace the compact tollgate cache', () => {
  within(fixture(['auth-flow']), fx => {
    assert.match(fx.prompt('session-a', 'specs/auth-flow'), /Spec state changed/);
    assert.match(fx.prompt('session-b', 'specs/auth-flow'), /Spec state changed/);
    const again = fx.prompt('session-a', 'Continue');
    assert.match(again, /Tollgate active/);
    assert.doesNotMatch(again, /Spec state changed/);
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

test('an untouched session stays quiet with two active packets', () => {
  within(fixture(['auth-flow', 'billing-2']), (fx) => {
    assert.strictEqual(fx.prompt('s1', 'Continue'), '');
  });
});

function invalidateTask(root, feature) {
  fs.writeFileSync(path.join(root, 'specs', feature, 'task-01-work.md'),
    '# Task 01: broken\n\n## Verification Plan\n\n- Command: node --test\n');
}

test('an untouched session stays quiet when a packet is invalid', () => {
  within(fixture(['broken-flow']), (fx) => {
    invalidateTask(fx.root, 'broken-flow');
    assert.strictEqual(fx.prompt('s1', 'Continue'), '');
  });
});

test('touching an invalid packet still prints its warning', () => {
  within(fixture(['broken-flow']), (fx) => {
    invalidateTask(fx.root, 'broken-flow');
    assert.match(fx.prompt('s1', 'Continue specs/broken-flow'), /Invalid workflow packet/);
  });
});

test('a session-less prompt still warns about two active packets', () => {
  within(fixture(['auth-flow', 'billing-2']), (fx) => {
    assert.match(fx.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Continue' }), /Multiple active specs/);
  });
});

test('a touched valid packet prints its tollgate when another packet is invalid', () => {
  within(fixture(['auth-flow', 'broken-flow']), (fx) => {
    invalidateTask(fx.root, 'broken-flow');
    const output = fx.prompt('s1', 'Continue specs/auth-flow');
    assert.match(output, /Spec state changed: `auth-flow`/);
    assert.doesNotMatch(output, /Invalid workflow packet/);
  });
});

test('an invalid specs root still warns an untouched session', () => {
  within(fixture(['auth-flow']), (fx) => {
    fs.writeFileSync(path.join(fx.root, '.claude/runtime.json'), JSON.stringify({ paths: { specs: '../outside' } }));
    assert.match(fx.prompt('s1', 'Continue'), /Invalid workflow packet detected: <specs>/);
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

test('Claude spec-state uses one snapshot for done task receipts', (t) => {
  within(fixture(['auth-flow']), (fx) => {
    const trace = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-snapshot-count-'));
    try {
      const feature = path.join(fx.root, 'specs/auth-flow');
      const tasks = ['task-01-work.md', 'task-02-work.md'];
      for (const name of tasks) fs.writeFileSync(path.join(feature, name), taskContent('done'));
      fs.writeFileSync(path.join(feature, 'task-03-work.md'), taskContent('in_progress'));
      const scripts = path.join(fx.root, '.claude/scripts');
      const provenance = require(path.join(scripts, 'provenance.cjs'));
      const policy = require(path.join(scripts, 'workflow-policy.cjs'));
      const receipt = require(path.join(scripts, 'spec-receipt.cjs'));
      const context = provenance.deriveRuntimeContext({ projectRoot: fx.root,
        specsRoot: path.join(fx.root, 'specs'), specFile: path.join(feature, 'plan.md'),
        featureName: 'auth-flow', runtimeSession: 'one-snapshot' });
      for (const name of tasks) {
        fs.appendFileSync(path.join(feature, name), [
          '\n## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
          `Base: ${context.base}`, `Head: ${context.head}`, '```text', '1 test passed', '```', '',
        ].join('\n'));
        assert.deepStrictEqual(receipt.checkWorkflowTaskReceipt(feature, name, context, policy).failures, []);
      }
      const countFile = path.join(trace, 'git-status.txt');
      const preload = path.join(trace, 'count.cjs');
      fs.writeFileSync(preload, `
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
for (const method of ['spawnSync', 'execFileSync']) {
  const original = cp[method];
  cp[method] = function(command, args, ...rest) {
    if (path.basename(String(command)) === 'git' && Array.isArray(args) && args.includes('status'))
      fs.appendFileSync(${JSON.stringify(countFile)}, 'status\\n');
    return original.call(this, command, args, ...rest);
  };
}
`);
      const result = spawnSync(process.execPath, [path.join(fx.hooks, 'spec-state.cjs')], {
        cwd: fx.root, encoding: 'utf8',
        env: { ...process.env, PROJECT_ROOT: fx.root,
          NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${JSON.stringify(preload)}` },
        input: JSON.stringify({ cwd: fx.root, hook_event_name: 'UserPromptSubmit',
          session_id: 'one-snapshot', prompt: 'Continue specs/auth-flow' }),
      });
      assert.strictEqual(result.status, 0, result.stderr);
      assert.match(result.stdout, /Spec state changed/);
      const count = fs.readFileSync(countFile, 'utf8').trim().split('\n').length;
      t.diagnostic(`Claude git status calls: ${count}`);
      assert.ok(count > 0 && count <= 2, `git status calls: ${count}; expected at most 2`);
    } finally { fs.rmSync(trace, { recursive: true, force: true }); }
  });
});
