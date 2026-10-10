'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('installed Codex ask guard follows the observed hook payloads', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-ask-guard-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const project = path.join(temp, 'project');
  fs.mkdirSync(project);
  const install = spawnSync(process.execPath, [path.join(__dirname, '../install.js'),
    '--platform', 'codex', '--yes'], { cwd: project, encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr + install.stdout);
  const script = path.join(project, '.codex/hooks/ask-guard.cjs');
  const config = JSON.parse(fs.readFileSync(path.join(project, '.codex/hooks.json'), 'utf8'));

  function fixture() {
    const stateRoot = fs.mkdtempSync(path.join(temp, 'state-'));
    const session = crypto.randomUUID();
    const sessionDir = (id = session) => path.join(stateRoot, sha256(id));
    function call(event, extra = {}, id = session, override = stateRoot) {
      return spawnSync(process.execPath, [script], {
        cwd: project, encoding: 'utf8',
        env: { ...process.env, CAFEKIT_ASK_GUARD_DIR: override },
        input: JSON.stringify({ hook_event_name: event, cwd: project, session_id: id, ...extra })
      });
    }
    const prompt = (text, id = session) => call('UserPromptSubmit', { prompt: text }, id);
    const tool = (name = 'apply_patch', id = session) => call('PreToolUse', {
      tool_name: name, tool_input: { command: '*** Begin Patch\n*** Update File: src/greet.js\n*** End Patch' }
    }, id);
    return { call, prompt, tool, session, stateRoot, sessionDir };
  }

  await t.test('real installer registers both events and a separate apply_patch group', () => {
    assert.ok(fs.existsSync(script));
    const isGuard = (handler) => /ask-guard\.cjs/.test(handler.command || '');
    assert.ok(config.hooks.UserPromptSubmit.some((group) => group.hooks.some(isGuard)));
    const group = config.hooks.PreToolUse.find((entry) => entry.hooks.some(isGuard));
    assert.ok(group);
    assert.equal(group.matcher, 'apply_patch');
    assert.equal(group.hooks.length, 1);
    const windowsPath = Buffer.from(group.hooks[0].commandWindows.split(' ').at(-1), 'base64url').toString('utf8');
    assert.equal(fs.realpathSync(windowsPath), fs.realpathSync(script));
  });
  await t.test('explicit ask denies only its session and logs exactly one private row per denial', () => {
    const f = fixture();
    assert.equal(f.prompt('  $cf-ask "Sửa giúp luôn."\n').status, 0);
    assert.equal(f.tool('apply_patch', crypto.randomUUID()).status, 0);
    for (let count = 1; count <= 2; count++) {
      const result = f.tool();
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /\$cf-fix/);
      assert.doesNotMatch(result.stderr, /greet|Sửa giúp|Begin Patch/);
      const rows = fs.readFileSync(path.join(f.sessionDir(), 'denials.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(rows.length, count);
      for (const row of rows) {
        assert.deepEqual(Object.keys(row).sort(), ['session_id_sha256', 'timestamp', 'tool_name']);
        assert.equal(row.session_id_sha256, sha256(f.session));
        assert.equal(row.tool_name, 'apply_patch');
        assert.ok(Number.isFinite(Date.parse(row.timestamp)));
      }
    }
    assert.equal(fs.existsSync(path.join(project, '.codex/hooks/.logs')), false);
  });
  await t.test('next non-ask prompt disables a previously persisted ask flag', () => {
    const f = fixture();
    assert.equal(f.prompt('$cf-ask reason').status, 0);
    assert.equal(f.tool().status, 2);
    assert.equal(f.prompt('Please fix it now').status, 0);
    assert.equal(f.tool().status, 0);
  });
  await t.test('/cf:ask activates the guard', () => {
    const f = fixture();
    assert.equal(f.prompt('/cf:ask reason').status, 0);
    assert.equal(f.tool().status, 2);
  });
  for (const prompt of ['Đừng dùng $cf-ask để sửa', '```\n$cf-ask reason\n```', '$cf-asker reason', '$CF-ASK reason']) {
    await t.test(`non-invocation stays inactive: ${JSON.stringify(prompt)}`, () => {
      const f = fixture();
      assert.equal(f.prompt(prompt).status, 0);
      assert.equal(f.tool().status, 0);
    });
  }
  await t.test('Bash and Read are allowed during ask', () => {
    const f = fixture();
    assert.equal(f.prompt('$cf-ask').status, 0);
    for (const name of ['Bash', 'Read', 'exec']) assert.equal(f.tool(name).status, 0);
    assert.equal(f.tool().status, 2);
  });
  await t.test('path-like session IDs stay hashed within the state directory', () => {
    const f = fixture();
    assert.equal(f.prompt('$cf-ask reason', '../x').status, 0);
    assert.equal(f.tool('apply_patch', '../x').status, 2);
    assert.deepEqual(fs.readdirSync(f.stateRoot), [sha256('../x')]);
    assert.equal(fs.existsSync(path.join(temp, 'x')), false);
  });
  await t.test('missing session IDs fail open and record a crash', () => {
    const f = fixture();
    assert.equal(f.call('UserPromptSubmit', { prompt: '$cf-ask' }, null).status, 0);
    assert.equal(f.tool('apply_patch', null).status, 0);
    const rows = fs.readFileSync(path.join(project, '.codex/hooks/.logs/hook-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(rows.some((row) => row.hook === 'ask-guard' && row.status === 'crash'));
    assert.deepEqual(fs.readdirSync(f.stateRoot), []);
  });
  await t.test('state I/O errors fail open and record a crash without leaking input', () => {
    const f = fixture();
    const invalidRoot = path.join(temp, 'not-a-directory');
    fs.writeFileSync(invalidRoot, 'file');
    const result = f.call('PreToolUse', { tool_name: 'apply_patch', tool_input: { command: 'PRIVATE-INPUT' } }, f.session, invalidRoot);
    assert.equal(result.status, 0);
    const log = fs.readFileSync(path.join(project, '.codex/hooks/.logs/hook-log.jsonl'), 'utf8');
    assert.doesNotMatch(log, /PRIVATE-INPUT/);
    assert.equal(JSON.parse(log.trim().split('\n').at(-1)).hook, 'ask-guard');
  });
});
