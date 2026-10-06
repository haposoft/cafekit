'use strict';

// The privacy hook gates whether a sensitive file may be READ. Nothing gated what
// happens after that approval, so an approved read could still put a raw key into the
// transcript — which is written to disk, survives compaction, and is replayed to the
// model every later turn. This hook closes that gap with a reminder, on both runtimes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const KEYWORDS = require(path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/secret-keywords.cjs'));

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-secret-guardrail-'));
  try {
    spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, platform) {
  const result = spawnSync(process.execPath, [INSTALLER, '--platform', platform, '--yes'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return path.join(root, `.${platform}`, 'hooks', 'secret-output-guardrail.cjs');
}

function run(hookPath, root, prompt) {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input: JSON.stringify({ session_id: 'guardrail-session', prompt, cwd: root }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `hook must fail open: ${result.stderr}`);
  return result.stdout;
}

test('the matcher fires on credential topics and stays quiet otherwise', () => {
  for (const prompt of [
    'read the .env file', 'rotate our credentials', 'where is the secret stored',
    'print the API key', 'the access key expired', 'this token is stale',
    'send a bearer header', 'decode the JWT', 'load the private key',
    'the oauth client secret', 'client secret rotation', 'our cloud keys', 'check the env file',
  ]) {
    assert.equal(KEYWORDS.containsSecretKeyword(prompt), true, `should match: ${prompt}`);
  }
  for (const prompt of [
    'add two numbers', 'refactor the tokenizer', 'update the environment setup docs',
    'fix the keyboard shortcut', '', '   ',
  ]) {
    assert.equal(KEYWORDS.containsSecretKeyword(prompt), false, `should not match: ${prompt}`);
  }
});

test('the reminder separates permission to read from permission to print', () => {
  assert.match(KEYWORDS.REMINDER, /does not grant permission to print raw values/);
  assert.match(KEYWORDS.REMINDER, /\[redacted\]/);
  assert.match(KEYWORDS.REMINDER, /report only success or failure/);
});

for (const platform of ['claude', 'codex']) {
  test(`${platform}: a credential prompt gets the reminder, an ordinary one gets nothing`, () => {
    inTempProject((root) => {
      const hook = install(root, platform);
      assert.equal(fs.existsSync(path.join(root, `.${platform}`, 'hooks', 'lib', 'secret-keywords.cjs')), true,
        'the shared matcher must install beside the hook');

      const flagged = run(hook, root, 'please read .env and tell me what is set');
      assert.match(flagged, /## Secret handling/);
      assert.match(flagged, /does not grant permission to print raw values/);

      assert.equal(run(hook, root, 'rename this variable'), '', 'an unrelated prompt must inject nothing');
    });
  });

  test(`${platform}: the guardrail never echoes the prompt or a matched value`, () => {
    inTempProject((root) => {
      const hook = install(root, platform);
      // A realistic-looking secret in the prompt must not come back in the output —
      // a guardrail that quotes its input would itself write the value to the transcript.
      const out = run(hook, root, 'my api key is sk-live-abc123SECRETVALUE, is it valid?');
      assert.match(out, /## Secret handling/);
      assert.doesNotMatch(out, /sk-live-abc123SECRETVALUE/, 'the hook echoed the secret it was warning about');
      assert.doesNotMatch(out, /is it valid/, 'the hook echoed the prompt');
    });
  });

  test(`${platform}: the hook fails open on malformed input`, () => {
    inTempProject((root) => {
      const hook = install(root, platform);
      for (const input of ['not json', '', '{"prompt":null}']) {
        const result = spawnSync(process.execPath, [hook], { cwd: root, input, encoding: 'utf8' });
        assert.equal(result.status, 0, `malformed input must not fail the turn: ${JSON.stringify(input)}`);
      }
    });
  });

  test(`${platform}: the hook is registered for UserPromptSubmit`, () => {
    inTempProject((root) => {
      install(root, platform);
      const configPath = platform === 'claude'
        ? path.join(root, '.claude', 'settings.json')
        : path.join(root, '.codex', 'hooks.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const commands = (config.hooks.UserPromptSubmit || [])
        .flatMap((group) => group.hooks || [])
        .map((handler) => handler.command || '');
      assert.ok(
        commands.some((command) => command.includes('secret-output-guardrail.cjs')),
        `${platform} never runs the guardrail`
      );
    });
  });
}
