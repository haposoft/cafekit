'use strict';

// usage.cjs read the Claude Code OAuth token from the macOS Keychain to call an undocumented
// quota endpoint; the statusline now reads Claude Code's own rate_limits instead. Each case
// pins one way the hook could survive the removal: a fresh install, an upgrade on Claude
// (removeObsoleteClaudeRuntimeFiles deletes unconditionally; the settings prune matches by
// substring, so it must not take a user's own hook), an upgrade on omp (whose tracker keys
// are `.omp/…`), and the source lists themselves.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'), 'utf8'));
const SOURCE_SETTINGS = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'src/claude/settings/settings.json'), 'utf8'));
const BRIDGE = fs.readFileSync(path.join(PACKAGE_ROOT, 'src/omp/extensions/cafekit-bridge.mjs'), 'utf8');

const CAFEKIT_USAGE_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/usage.cjs"';
const FOREIGN_USAGE_COMMAND = 'node ~/my-hooks/usage.cjs';

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-usage-retired-'));
  try {
    const init = spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, platforms) {
  const result = spawnSync(process.execPath, [INSTALLER, '--platform', platforms.join(','), '--yes'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function commands(settings) {
  return Object.values(settings.hooks || {})
    .flat()
    .flatMap((group) => (group.hooks || []).map((hook) => hook.command));
}

test('fresh claude install ships no usage hook', () => {
  inTempProject((root) => {
    install(root, ['claude']);
    assert.equal(fs.existsSync(path.join(root, '.claude', 'hooks', 'usage.cjs')), false);
    const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));
    assert.equal(commands(settings).some((command) => command.includes('usage.cjs')), false);
  });
});

test('upgrade removes an installed usage hook and its CafeKit entries but keeps a foreign one', () => {
  inTempProject((root) => {
    install(root, ['claude']);
    const settingsPath = path.join(root, '.claude', 'settings.json');
    const before = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const kept = commands(before);

    // An older install, edited by the user: the file differs from anything CafeKit shipped.
    fs.writeFileSync(path.join(root, '.claude', 'hooks', 'usage.cjs'), '// user edit\n');
    before.hooks.UserPromptSubmit[0].hooks.push(
      { type: 'command', command: CAFEKIT_USAGE_COMMAND, timeout: 30 },
      { type: 'command', command: FOREIGN_USAGE_COMMAND },
    );
    before.hooks.PostToolUse.push({
      matcher: 'Edit|Write|MultiEdit',
      hooks: [{ type: 'command', command: CAFEKIT_USAGE_COMMAND, timeout: 30 }],
    });
    fs.writeFileSync(settingsPath, JSON.stringify(before, null, 2));

    install(root, ['claude']);
    assert.equal(fs.existsSync(path.join(root, '.claude', 'hooks', 'usage.cjs')), false, 'an edited copy is removed too');
    const after = commands(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
    assert.equal(after.includes(CAFEKIT_USAGE_COMMAND), false, 'both CafeKit entries are pruned');
    assert.equal(after.includes(FOREIGN_USAGE_COMMAND), true, 'a hook outside .claude/hooks/ survives');
    for (const command of kept) assert.ok(after.includes(command), `kept: ${command}`);
  });
});

test('omp upgrade removes an installed usage hook and its manifest record', () => {
  inTempProject((root) => {
    install(root, ['omp']);
    const hookPath = path.join(root, '.omp', 'hooks', 'usage.cjs');
    const manifestPath = path.join(root, '.omp', 'cafekit-manifest.json');
    fs.writeFileSync(hookPath, '// shipped by an older CafeKit\n');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // omp records keys relative to the project root (recordRoot '.').
    manifest.files['.omp/hooks/usage.cjs'] = { sha256: '0'.repeat(64) };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    install(root, ['omp']);
    assert.equal(fs.existsSync(hookPath), false);
    const afterManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(Object.prototype.hasOwnProperty.call(afterManifest.files, '.omp/hooks/usage.cjs'), false);
  });
});

test('no runtime ships or bridges usage.cjs', () => {
  assert.equal(MANIFEST.runtime.files.includes('hooks/usage.cjs'), false);
  assert.equal(BRIDGE.includes("'usage.cjs'"), false);
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'src/claude/hooks/usage.cjs')), false);
  assert.ok(MANIFEST.obsolete.runtimeFiles.includes('hooks/usage.cjs'));
  assert.ok(MANIFEST.obsolete.settingsHookCommandSubstrings.includes('.claude/hooks/usage.cjs'));
  // The installer's merge drops an empty group, so only the source can show one.
  for (const [event, groups] of Object.entries(SOURCE_SETTINGS.hooks)) {
    for (const group of groups) assert.ok(group.hooks.length > 0, `${event} ${group.matcher} has no hooks`);
  }
});
