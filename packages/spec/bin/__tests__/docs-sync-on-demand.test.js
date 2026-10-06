'use strict';

// docs-sync printed "Docs sync needed" at every Claude SessionStart, and nothing ever
// cleared it. It now runs only when the docs skill asks for it. The skill text is shared
// with Codex, whose copy crashes silently on an empty stdin, so the command feeds `{}`.
// Each case names the failure it prevents.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const DOCS_SKILL = path.join(PACKAGE_ROOT, 'src/claude/skills/docs');
const ON_DEMAND = "echo '{}' | node .claude/hooks/docs-sync.cjs";

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-docs-sync-'));
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

function commands(settings, event) {
  return (settings.hooks[event] || []).flatMap((group) => (group.hooks || []).map((hook) => hook.command));
}

/** A git project with code, docs and a `.sync_hash` that no longer matches the source. */
function makeStale(root) {
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}\n');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# Docs\n');
  fs.writeFileSync(path.join(root, 'docs', '.sync_hash'), '0000000000000000000000000000000000000000\n');
  execSync('git -c user.email=t@t -c user.name=t add -A && git -c user.email=t@t -c user.name=t commit -qm fixture', { cwd: root });
}

test('fresh claude install runs no docs-sync at SessionStart', () => {
  inTempProject((root) => {
    install(root, ['claude']);
    const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));
    assert.equal(commands(settings, 'SessionStart').some((c) => c.includes('docs-sync.cjs')), false);
    assert.equal(fs.existsSync(path.join(root, '.claude', 'hooks', 'docs-sync.cjs')), true, 'the hook stays installed for on-demand use');
  });
});

test('upgrade drops the SessionStart docs-sync entry', () => {
  inTempProject((root) => {
    install(root, ['claude']);
    const settingsPath = path.join(root, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const kept = commands(settings, 'SessionStart');
    settings.hooks.SessionStart[0].hooks.push({ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/docs-sync.cjs"' });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    install(root, ['claude']);
    const after = commands(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), 'SessionStart');
    assert.equal(after.some((c) => c.includes('docs-sync.cjs')), false);
    for (const command of kept) assert.ok(after.includes(command), `kept: ${command}`);
  });
});

test('the docs skill runs docs-sync on demand', () => {
  for (const rel of ['SKILL.md', 'references/update-workflow.md']) {
    assert.ok(fs.readFileSync(path.join(DOCS_SKILL, rel), 'utf8').includes(ON_DEMAND), `${rel} names the on-demand command`);
  }
  const files = fs.readdirSync(DOCS_SKILL, { recursive: true }).filter((f) => f.endsWith('.md'));
  for (const rel of files) {
    assert.doesNotMatch(fs.readFileSync(path.join(DOCS_SKILL, rel), 'utf8'), /SessionStart docs-sync/, rel);
  }
});

for (const [runtime, folder] of [['claude', '.claude'], ['codex', '.codex']]) {
  test(`the ${runtime === 'claude' ? 'Claude' : 'Codex'} copy prints its signal on demand`, () => {
    inTempProject((root) => {
      install(root, [runtime]);
      makeStale(root);
      const out = execSync(`echo '{}' | node ${folder}/hooks/docs-sync.cjs`, { cwd: root, encoding: 'utf8' });
      assert.match(out, /Docs sync needed/);
    });
  });
}
