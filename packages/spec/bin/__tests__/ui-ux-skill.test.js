'use strict';

// cf:ui-ux is evondevKit's ui-ux skill vendored byte-identical apart from its frontmatter
// and one body line. A resync copies the upstream tree again, so each case here pins what
// that copy must not lose, and states the failure it prevents.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const { loadClaudeMigrationManifest } = require('../lib/context');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SKILL_DIR = path.join(PACKAGE_ROOT, 'src/claude/skills/ui-ux');
const SKILL_SOURCE = path.join(SKILL_DIR, 'SKILL.md');
const PRO_MAX_SOURCE = path.join(PACKAGE_ROOT, 'src/claude/skills/ui-ux-pro-max/SKILL.md');

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-ui-ux-skill-'));
  try {
    const init = spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, platforms, extra = []) {
  return spawnSync(process.execPath, [INSTALLER, '--platform', platforms.join(','), '--yes', ...extra],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
}

function frontmatterLines(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'SKILL.md must open with a frontmatter block');
  return match[1].split(/\r?\n/);
}

function field(lines, key) {
  const line = lines.find((entry) => entry.startsWith(`${key}:`));
  return line === undefined ? undefined : line.slice(key.length + 1).trim();
}

test('manifest requires ui-ux', () => {
  // Without the entry the installer never copies the skill, and nothing else fails.
  const required = loadClaudeMigrationManifest().skills.required;
  assert.equal(required.includes('ui-ux'), true);
  assert.equal(required.includes('ui-ux-pro-max'), true, 'the lookup skill stays installed beside it');
});

test('cf:ui-ux frontmatter carries routing metadata and the MIT license', () => {
  // A resync that copies upstream SKILL.md whole brings back `name: ui-ux` (no catalog
  // identity), the Vietnamese description, and `grep -rlE "$1"`, which Claude Code fills
  // with the invocation arguments and so corrupts the style audit.
  const content = fs.readFileSync(SKILL_SOURCE, 'utf8');
  const lines = frontmatterLines(content);
  assert.equal(field(lines, 'name'), 'cf:ui-ux');
  assert.equal(field(lines, 'license'), 'MIT');
  assert.equal(field(lines, 'category'), 'frontend');
  assert.ok(field(lines, 'when_to_use'), 'when_to_use must be set');
  assert.match(field(lines, 'keywords') || '', /^\[.+\]$/, 'keywords must be a non-empty list');

  const description = field(lines, 'description') || '';
  assert.ok(description.length > 2 && description.length <= 1024, `description length ${description.length}`);

  assert.doesNotMatch(content, /\$[0-9]/, 'no positional argument placeholder in the skill body');
  assert.doesNotMatch(content, /\$ARGUMENTS/);

  // MIT requires the copyright and permission notice to travel with the copy.
  assert.equal(fs.existsSync(path.join(SKILL_DIR, 'LICENSE')), true);
  const pkg = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies && pkg.dependencies.playwright, 'the installer provisions Playwright only when declared');
});

test('ui-ux-pro-max when_to_use no longer claims layout or design systems', () => {
  // Both skills advertising layout and design systems leaves the host to pick at random.
  const lines = frontmatterLines(fs.readFileSync(PRO_MAX_SOURCE, 'utf8'));
  const whenToUse = field(lines, 'when_to_use') || '';
  assert.doesNotMatch(whenToUse, /layout/i);
  assert.doesNotMatch(whenToUse, /design system/i);
  assert.match(whenToUse, /cf:ui-ux/);
});

test('fresh claude install copies ui-ux with its playwright package manifest', () => {
  // The package manifest is what makes --with-skills-deps install Playwright for probe.mjs.
  inTempProject((root) => {
    const result = install(root, ['claude']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedSkill = path.join(root, '.claude', 'skills', 'ui-ux', 'SKILL.md');
    const installedPackage = path.join(root, '.claude', 'skills', 'ui-ux', 'scripts', 'package.json');
    assert.equal(fs.existsSync(installedSkill), true, 'the skill directory must be installed');
    assert.equal(fs.existsSync(installedPackage), true, 'scripts/package.json must be installed');
    assert.match(fs.readFileSync(installedSkill, 'utf8'), /^name: cf:ui-ux$/m);
  });
});
