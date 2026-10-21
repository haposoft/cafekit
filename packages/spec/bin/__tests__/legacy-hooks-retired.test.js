'use strict';

// The five spec.json-era hooks (completion authority, its check and state modules, the semantic
// review authority and the scaffold guard) are gone from every runtime. Each case pins one way
// they could survive: a fresh install, an upgrade on Claude (settings prune matches by substring,
// so a user's own hook with the same file name must stay), an upgrade on Codex (whose tracker
// keys are `.codex/…` and whose handlers come in three shapes), an upgrade on omp (hash-checked like Codex), an omp bridge
// that still lists the removed gates, and the source lists themselves.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SRC = path.join(PACKAGE_ROOT, 'src');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const MANIFEST = readJson(path.join(SRC, 'claude/migration-manifest.json'));
const SOURCE_SETTINGS = readJson(path.join(SRC, 'claude/settings/settings.json'));
const SOURCE_BRIDGE_PATH = path.join(SRC, 'omp/extensions/cafekit-bridge.js');

const NAMES = [
  'completion-authority.cjs',
  'completion-authority-check.cjs',
  'completion-authority-state.cjs',
  'semantic-review-authority.cjs',
  'task-scaffold-guard.cjs',
];
const REGISTERED = ['completion-authority.cjs', 'semantic-review-authority.cjs', 'task-scaffold-guard.cjs'];
const FOREIGN = REGISTERED.map((name) => `node ~/my-hooks/${name}`);

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-legacy-retired-'));
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
  return result;
}

function commands(settings) {
  return Object.values(settings.hooks || {})
    .flat()
    .flatMap((group) => (group.hooks || []).map((hook) => hook.command));
}

function mentionsName(text) {
  return NAMES.filter((name) => text.includes(name));
}

test('fresh installs ship and register none of the five legacy hooks', () => {
  inTempProject((root) => {
    install(root, ['claude', 'codex', 'omp']);
    for (const dir of ['.claude', '.codex', '.omp']) {
      for (const name of NAMES) assert.equal(fs.existsSync(path.join(root, dir, 'hooks', name)), false, `${dir}/hooks/${name}`);
    }
    const claude = commands(readJson(path.join(root, '.claude', 'settings.json')));
    const codex = commands(readJson(path.join(root, '.codex', 'hooks.json')));
    for (const command of [...claude, ...codex]) assert.deepEqual(mentionsName(command), [], command);
    const bridge = fs.readFileSync(path.join(root, '.omp', 'extensions', 'cafekit-bridge.js'), 'utf8');
    assert.deepEqual(mentionsName(bridge), []);
  });
});

test('claude upgrade preserves edited legacy hooks while removing their CafeKit entries', () => {
  inTempProject((root) => {
    install(root, ['claude']);
    const settingsPath = path.join(root, '.claude', 'settings.json');
    const manifestPath = path.join(root, '.claude', 'cafekit-manifest.json');
    const settings = readJson(settingsPath);
    const kept = commands(settings);

    const manifest = readJson(manifestPath);
    for (const name of NAMES) {
      fs.writeFileSync(path.join(root, '.claude', 'hooks', name), '// user edit\n');
      manifest.files[`hooks/${name}`] = { sha256: '0'.repeat(64) };
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const cmd = (name) => `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${name}"`;
    settings.hooks.UserPromptSubmit[0].hooks.push(
      { type: 'command', command: cmd('completion-authority.cjs') },
      ...FOREIGN.map((command) => ({ type: 'command', command })),
    );
    settings.hooks.Stop[0].hooks.push({ type: 'command', command: cmd('completion-authority.cjs') });
    settings.hooks.PreToolUse.push({ matcher: 'Write', hooks: [{ type: 'command', command: cmd('task-scaffold-guard.cjs') }] });
    settings.hooks.SubagentStop[0].hooks.push({ type: 'command', command: cmd('semantic-review-authority.cjs') });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const upgrade = install(root, ['claude']);
    assert.match(upgrade.stdout + upgrade.stderr, /Preserved 5 obsolete runtime/);
    for (const name of NAMES) assert.equal(fs.readFileSync(path.join(root, '.claude', 'hooks', name), 'utf8'), '// user edit\n', name);
    const after = readJson(manifestPath);
    for (const name of NAMES) assert.equal(after.files[`hooks/${name}`].sha256, '0'.repeat(64), `record ${name}`);
    const afterCommands = commands(readJson(settingsPath));
    for (const name of REGISTERED) {
      assert.equal(afterCommands.some((command) => command.includes(`.claude/hooks/${name}`)), false, name);
    }
    for (const command of FOREIGN) assert.ok(afterCommands.includes(command), `foreign: ${command}`);
    for (const command of kept) assert.ok(afterCommands.includes(command), `kept: ${command}`);
  });
});

test('codex upgrade preserves edited legacy hooks and prunes only absent records', () => {
  inTempProject((root) => {
    install(root, ['codex']);
    const hooksPath = path.join(root, '.codex', 'hooks.json');
    const manifestPath = path.join(root, '.codex', 'cafekit-manifest.json');
    const config = readJson(hooksPath);
    const kept = commands(config);

    // A record whose file is already gone must leave the manifest too.
    const manifest = readJson(manifestPath);
    for (const name of NAMES) {
      if (name !== 'completion-authority-state.cjs') fs.writeFileSync(path.join(root, '.codex', 'hooks', name), '// user edit\n');
      manifest.files[`.codex/hooks/${name}`] = { sha256: '0'.repeat(64) };
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const posix = kept.find((command) => command.includes('spec-gate.cjs'));
    assert.ok(posix, 'the installed spec-gate launcher is the template for the POSIX form');
    const add = (event, command) => config.hooks[event].push({ matcher: '*', hooks: [{ type: 'command', command }] });
    add('Stop', posix.split('spec-gate.cjs').join('completion-authority.cjs'));
    add('PreToolUse', 'node ".codex/hooks/task-scaffold-guard.cjs"');
    add('SubagentStop', "node 'C:\\work\\proj\\.codex\\hooks\\semantic-review-authority.cjs'");
    add('UserPromptSubmit', FOREIGN[0]);
    fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2));

    const upgrade = install(root, ['codex']);
    assert.match(upgrade.stdout + upgrade.stderr, /Preserved 4 obsolete runtime/);
    for (const name of NAMES) {
      const file = path.join(root, '.codex', 'hooks', name);
      if (name === 'completion-authority-state.cjs') assert.equal(fs.existsSync(file), false, name);
      else assert.equal(fs.readFileSync(file, 'utf8'), '// user edit\n', name);
    }
    const after = readJson(manifestPath);
    for (const name of NAMES) {
      if (name === 'completion-authority-state.cjs') assert.equal(after.files[`.codex/hooks/${name}`], undefined, `record ${name}`);
      else assert.equal(after.files[`.codex/hooks/${name}`].sha256, '0'.repeat(64), `record ${name}`);
    }
    const afterCommands = commands(readJson(hooksPath));
    for (const name of REGISTERED) {
      assert.equal(afterCommands.some((command) => command.includes(`.codex/hooks/${name}`) || command.includes(`.codex\\hooks\\${name}`)), false, name);
    }
    assert.ok(afterCommands.includes(FOREIGN[0]), 'a foreign hook with a legacy name survives');
    for (const command of kept) assert.ok(afterCommands.includes(command), `kept: ${command}`);
  });
});

test('omp upgrade removes the legacy hooks and their records', () => {
  inTempProject((root) => {
    install(root, ['omp']);
    const manifestPath = path.join(root, '.omp', 'cafekit-manifest.json');
    const manifest = readJson(manifestPath);
    // omp records keys relative to the project root (recordRoot '.').
    const shipped = '// shipped by an older CafeKit\n';
    for (const name of NAMES) {
      fs.writeFileSync(path.join(root, '.omp', 'hooks', name), shipped);
      manifest.files[`.omp/hooks/${name}`] = { sha256: crypto.createHash('sha256').update(shipped).digest('hex') };
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    install(root, ['omp']);
    const after = readJson(manifestPath);
    for (const name of NAMES) {
      assert.equal(fs.existsSync(path.join(root, '.omp', 'hooks', name)), false, name);
      assert.equal(Object.prototype.hasOwnProperty.call(after.files, `.omp/hooks/${name}`), false, `record ${name}`);
    }
  });
});

test('omp upgrade preserves edited legacy hooks and prunes only absent records', () => {
  inTempProject((root) => {
    install(root, ['omp']);
    const manifestPath = path.join(root, '.omp', 'cafekit-manifest.json');
    const manifest = readJson(manifestPath);
    // A record whose file is already gone must leave the manifest too.
    for (const name of NAMES) {
      if (name !== 'completion-authority-state.cjs') fs.writeFileSync(path.join(root, '.omp', 'hooks', name), '// user edit\n');
      manifest.files[`.omp/hooks/${name}`] = { sha256: '0'.repeat(64) };
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const upgrade = install(root, ['omp']);
    assert.match(`${upgrade.stdout}\n${upgrade.stderr}`, new RegExp(`Preserved ${NAMES.length - 1} obsolete runtime item`));
    const after = readJson(manifestPath);
    for (const name of NAMES) {
      if (name === 'completion-authority-state.cjs') {
        assert.equal(after.files[`.omp/hooks/${name}`], undefined, `record ${name}`);
        continue;
      }
      assert.equal(fs.readFileSync(path.join(root, '.omp', 'hooks', name), 'utf8'), '// user edit\n', name);
      assert.equal(after.files[`.omp/hooks/${name}`].sha256, '0'.repeat(64), `record ${name}`);
    }
  });
});

test('omp upgrade removes a pristine old .mjs bridge, which omp never loads', () => {
  inTempProject((root) => {
    install(root, ['omp']);
    const oldPath = path.join(root, '.omp', 'extensions', 'cafekit-bridge.mjs');
    const manifestPath = path.join(root, '.omp', 'cafekit-manifest.json');
    const old = fs.readFileSync(SOURCE_BRIDGE_PATH, 'utf8')
      .replace("'inspect-block.cjs']", "'inspect-block.cjs', 'task-scaffold-guard.cjs']");
    fs.writeFileSync(oldPath, old);
    const manifest = readJson(manifestPath);
    manifest.files['.omp/extensions/cafekit-bridge.mjs'] = { sha256: crypto.createHash('sha256').update(old).digest('hex') };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    install(root, ['omp']);
    assert.equal(fs.existsSync(oldPath), false, 'the pristine .mjs bridge is removed');
    assert.equal(readJson(manifestPath).files['.omp/extensions/cafekit-bridge.mjs'], undefined, 'and its record');
    const installed = fs.readFileSync(path.join(root, '.omp', 'extensions', 'cafekit-bridge.js'), 'utf8');
    assert.deepEqual(mentionsName(installed), []);
    assert.equal(installed, fs.readFileSync(SOURCE_BRIDGE_PATH, 'utf8'));
  });
});

test('omp upgrade keeps an edited, untracked or symlinked old .mjs bridge and says so', () => {
  for (const shape of ['edited', 'untracked', 'symlink']) {
    inTempProject((root) => {
      install(root, ['omp']);
      const oldPath = path.join(root, '.omp', 'extensions', 'cafekit-bridge.mjs');
      const manifestPath = path.join(root, '.omp', 'cafekit-manifest.json');
      const manifest = readJson(manifestPath);
      if (shape === 'symlink') {
        const target = path.join(root, 'my-bridge.mjs');
        fs.writeFileSync(target, '// mine\n');
        fs.symlinkSync(target, oldPath);
      } else {
        fs.writeFileSync(oldPath, '// edited by the user\n');
        if (shape === 'edited') manifest.files['.omp/extensions/cafekit-bridge.mjs'] = { sha256: '0'.repeat(64) };
      }
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const result = install(root, ['omp']);
      assert.equal(fs.lstatSync(oldPath).isFile() || fs.lstatSync(oldPath).isSymbolicLink(), true, `${shape} .mjs is kept`);
      assert.match(`${result.stdout}\n${result.stderr}`, /Preserved \d+ obsolete runtime item/, `${shape} is reported`);
    });
  }
});

test('no source ships, registers or bridges the five legacy hooks', () => {
  for (const name of NAMES) {
    assert.equal(fs.existsSync(path.join(SRC, 'claude/hooks', name)), false, `claude ${name}`);
    assert.equal(fs.existsSync(path.join(SRC, 'codex/hooks', name)), false, `codex ${name}`);
  }
  for (const test of ['completion-authority.test.js', 'semantic-review-authority.test.js']) {
    assert.equal(fs.existsSync(path.join(SRC, 'claude/hooks/__tests__', test)), false, test);
  }
  const runtimeFiles = MANIFEST.runtime.files.join('\n');
  assert.deepEqual(mentionsName(runtimeFiles), []);
  assert.deepEqual(mentionsName(JSON.stringify(SOURCE_SETTINGS)), []);
  assert.deepEqual(mentionsName(fs.readFileSync(path.join(SRC, 'codex/hooks.json'), 'utf8')), []);
  assert.deepEqual(mentionsName(fs.readFileSync(SOURCE_BRIDGE_PATH, 'utf8')), []);
  for (const name of NAMES) assert.ok(MANIFEST.obsolete.runtimeFiles.includes(`hooks/${name}`), name);
  const substrings = MANIFEST.obsolete.settingsHookCommandSubstrings;
  assert.equal(substrings[0], 'hooks/skill-router.cjs');
  for (const name of REGISTERED) {
    for (const entry of [`.claude/hooks/${name}`, `.codex/hooks/${name}`, `.codex\\hooks\\${name}`]) {
      assert.ok(substrings.includes(entry), entry);
    }
  }
  // The installer's merge drops an empty group, so only the source can show one.
  for (const [event, groups] of Object.entries(SOURCE_SETTINGS.hooks)) {
    for (const group of groups) assert.ok(group.hooks.length > 0, `${event} ${group.matcher} has no hooks`);
  }
});
