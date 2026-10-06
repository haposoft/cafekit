'use strict';

// `.codex/hooks.json` is a shared configuration file, not a CafeKit payload. It used to be
// copied verbatim, so a single user-added hook turned the whole file into a user-modified
// artifact: a normal install then preserved CafeKit's stale hooks, and `--force-overwrite`
// destroyed the user's. These tests pin the merge that replaced that copy, mirroring how
// `.claude/settings.json` has always been handled.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const TEMPLATE = path.join(PACKAGE_ROOT, 'src/codex/hooks.json');
const MANIFEST = require(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'));
const { hookScript } = require(path.join(PACKAGE_ROOT, 'bin/phases/codex-hooks.js'));

const USER_STOP_COMMAND = 'node "$(git rev-parse --show-toplevel)/scripts/my-own-stop.js"';
const USER_PRETOOL_COMMAND = 'echo user-owned-pretooluse';

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-hooks-own-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', 'codex', '--yes', ...extraArgs],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
  );
}

function hooksPath(root) {
  return path.join(root, '.codex', 'hooks.json');
}

function readHooks(root) {
  return JSON.parse(fs.readFileSync(hooksPath(root), 'utf8'));
}

/** Every handler across every event, flattened. */
function allHandlers(config) {
  return Object.values(config.hooks || {})
    .flatMap((groups) => (Array.isArray(groups) ? groups : []))
    .flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []));
}

function allCommands(config) {
  return allHandlers(config).map((handler) => handler?.command).filter(Boolean);
}

/** The CafeKit hook scripts the template registers, per event. */
function managedScripts() {
  const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  const byEvent = {};
  for (const [eventName, groups] of Object.entries(template.hooks || {})) {
    byEvent[eventName] = groups
      .flatMap((group) => group.hooks || [])
      .map((handler) => hookScript(handler.command))
      .filter(Boolean);
  }
  return byEvent;
}

/** Add two hooks CafeKit does not author: one under an event it owns, one under a new event. */
function addUserHooks(root) {
  const config = readHooks(root);
  config.hooks.Stop.push({ matcher: '*', hooks: [{ type: 'command', command: USER_STOP_COMMAND }] });
  config.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: USER_PRETOOL_COMMAND }] });
  fs.writeFileSync(hooksPath(root), `${JSON.stringify(config, null, 2)}\n`);
}

test('a fresh install registers every CafeKit hook under its own event', () => {
  inTempProject((root) => {
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installed = readHooks(root);
    for (const [eventName, scripts] of Object.entries(managedScripts())) {
      const registered = (installed.hooks[eventName] || [])
        .flatMap((group) => group.hooks || [])
        .map((handler) => hookScript(handler.command))
        .filter(Boolean);
      for (const script of scripts) {
        assert.ok(registered.includes(script), `${script} missing from ${eventName}`);
      }
    }
  });
});

test('a reinstall preserves user-added hooks instead of overwriting them', () => {
  inTempProject((root) => {
    assert.equal(install(root).status, 0);
    addUserHooks(root);

    const second = install(root);
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);

    const commands = allCommands(readHooks(root));
    assert.ok(commands.includes(USER_STOP_COMMAND), 'user Stop hook was erased by the reinstall');
    assert.ok(commands.includes(USER_PRETOOL_COMMAND), 'user PreToolUse hook was erased by the reinstall');
  });
});

test('--force-overwrite does not destroy hooks CafeKit did not author', () => {
  inTempProject((root) => {
    assert.equal(install(root).status, 0);
    addUserHooks(root);

    const forced = install(root, ['--force-overwrite']);
    assert.equal(forced.status, 0, `${forced.stdout}\n${forced.stderr}`);

    const commands = allCommands(readHooks(root));
    assert.ok(commands.includes(USER_STOP_COMMAND), '--force-overwrite erased the user Stop hook');
    assert.ok(commands.includes(USER_PRETOOL_COMMAND), '--force-overwrite erased the user PreToolUse hook');
  });
});

test('repeated installs never duplicate a CafeKit hook', () => {
  inTempProject((root) => {
    assert.equal(install(root).status, 0);
    const afterFirst = allHandlers(readHooks(root)).length;

    assert.equal(install(root).status, 0);
    assert.equal(install(root).status, 0);

    const config = readHooks(root);
    assert.equal(allHandlers(config).length, afterFirst, 'a reinstall added handlers that were already registered');

    // Uniqueness is per event, not global: state.cjs registers under several events by
    // design.
    for (const [eventName, groups] of Object.entries(config.hooks)) {
      const scripts = groups
        .flatMap((group) => group.hooks || [])
        .map((handler) => hookScript(handler.command))
        .filter(Boolean);
      assert.equal(
        new Set(scripts).size, scripts.length,
        `duplicate hook scripts under ${eventName}: ${scripts.join(', ')}`
      );
    }
  });
});

test('a hook the user moved to another event is not re-added to the one CafeKit chose', () => {
  inTempProject((root) => {
    assert.equal(install(root).status, 0);

    // Move a CafeKit hook out of the group the template put it in, the way a user editing
    // matchers would. Re-adding it on the next install would fire it twice.
    const config = readHooks(root);
    let moved = null;
    for (const group of config.hooks.PreToolUse) {
      const index = (group.hooks || []).findIndex((handler) => hookScript(handler.command) === 'inspect-block.cjs');
      if (index >= 0) { moved = group.hooks.splice(index, 1)[0]; break; }
    }
    assert.ok(moved, 'fixture expects inspect-block.cjs under PreToolUse');
    config.hooks.PreToolUse.push({ matcher: 'Read|Grep', hooks: [moved] });
    fs.writeFileSync(hooksPath(root), `${JSON.stringify(config, null, 2)}\n`);

    assert.equal(install(root).status, 0);

    const scripts = allCommands(readHooks(root)).map(hookScript).filter(Boolean);
    assert.equal(
      scripts.filter((script) => script === 'inspect-block.cjs').length, 1,
      'the moved hook was re-added under its original matcher'
    );
  });
});

test('obsolete CafeKit hooks are pruned while similarly named foreign hooks stay', () => {
  const obsolete = MANIFEST.obsolete.settingsHookCommandSubstrings;
  assert.ok(obsolete.length > 0, 'fixture requires at least one retired hook substring');

  inTempProject((root) => {
    assert.equal(install(root).status, 0);

    const config = readHooks(root);
    const retired = `node ".codex/${obsolete[0]}"`;
    const foreign = 'node "scripts/my-skill-router.cjs"';
    config.hooks.UserPromptSubmit.push({
      matcher: '*',
      hooks: [{ type: 'command', command: retired }, { type: 'command', command: foreign }]
    });
    fs.writeFileSync(hooksPath(root), `${JSON.stringify(config, null, 2)}\n`);

    const second = install(root);
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);

    const commands = allCommands(readHooks(root));
    assert.ok(!commands.includes(retired), 'retired CafeKit hook survived the prune');
    assert.ok(commands.includes(foreign), 'prune removed a hook CafeKit never authored');
  });
});

test('a malformed hooks.json is reported and left byte-identical, never overwritten', () => {
  inTempProject((root) => {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    const broken = '{ "hooks": { "Stop": [ }\n';
    fs.writeFileSync(hooksPath(root), broken);

    const result = install(root);
    assert.notEqual(result.status, 0, 'a malformed hooks.json must fail the install, not pass silently');
    assert.match(`${result.stdout}${result.stderr}`, /not valid JSON/);
    assert.equal(fs.readFileSync(hooksPath(root), 'utf8'), broken, 'the malformed file was overwritten');
  });
});

test('a dry run reports the merge without writing hooks.json', () => {
  inTempProject((root) => {
    const result = install(root, ['--dry-run']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Codex hooks/);
    assert.equal(fs.existsSync(hooksPath(root)), false, 'a dry run wrote hooks.json');
  });
});

test('hooks.json stays outside the ownership manifest, like settings.json', () => {
  inTempProject((root) => {
    assert.equal(install(root).status, 0);

    const manifestPath = path.join(root, '.codex', 'cafekit-manifest.json');
    assert.equal(fs.existsSync(manifestPath), true, 'the install manifest is missing');
    const tracked = Object.keys(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files || {});
    assert.ok(
      !tracked.some((file) => file.endsWith('hooks.json')),
      'hooks.json is tracked as a payload file, so a user edit would be classified user-modified again'
    );
  });
});
