'use strict';

// Grok CLI has no runtime directory of its own: it reads the Claude install through its
// compatibility layer. `--platform grok` therefore provisions `.claude/` and prints the
// one thing a user cannot infer, which is that project hooks stay inert until the folder
// is trusted. These cases run the real installer into a temp git repository.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const { PLATFORMS, resolvePlatformAliases, detectPlatforms } = require(path.join(PACKAGE_ROOT, 'bin/lib/context'));
const I18N = require(path.join(PACKAGE_ROOT, 'bin/lib/i18n'));

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grok-platform-'));
  try {
    const init = spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, platform, extra = []) {
  return spawnSync(process.execPath, [INSTALLER, '--platform', platform, '--yes', ...extra],
    { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: path.join(root, 'home'), PATH: '/usr/bin:/bin' } });
}

test('grok is an alias, not a platform of its own', () => {
  assert.equal(PLATFORMS.grok, undefined, 'a registry entry would create a .grok payload');
  assert.deepEqual(resolvePlatformAliases(['grok']).platforms, ['claude']);
  assert.equal(resolvePlatformAliases(['grok']).aliased, true);
  assert.equal(resolvePlatformAliases(['claude']).aliased, false);
});

test('--platform grok installs the Claude runtime and no .grok directory', () => {
  inTempProject((root) => {
    const result = install(root, 'grok');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    assert.equal(fs.existsSync(path.join(root, '.claude', 'hooks', 'privacy-block.cjs')), true,
      'grok runs the Claude gate scripts, so they have to be installed');
    assert.equal(fs.existsSync(path.join(root, '.claude', 'settings.json')), true,
      'grok discovers the hooks through this file');
    assert.equal(fs.existsSync(path.join(root, '.grok')), false, 'CafeKit ships nothing under .grok');

    const metadata = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'cafekit.json'), 'utf8'));
    assert.equal(metadata.platform, 'claude', 'the install is a Claude install and must record itself as one');
  });
});

test('the trust reminder is printed once in the selected language', () => {
  inTempProject((root) => {
    const en = install(root, 'grok', ['--lang', 'en']);
    assert.equal(en.status, 0, en.stderr);
    const occurrences = en.stdout.split('grok --trust').length - 1;
    assert.equal(occurrences, 1, 'the notice must appear exactly once');
    assert.match(en.stdout, /\/hooks-trust/, 'both ways to grant trust are named');
  });

  inTempProject((root) => {
    const vi = install(root, 'grok', ['--lang', 'vi']);
    assert.equal(vi.status, 0, vi.stderr);
    // The Vietnamese string, not the English one: the notice follows --lang like every
    // other installer line.
    assert.match(vi.stdout, /lớp tương thích Claude/);
  });
});

test('grok and claude together install once', () => {
  inTempProject((root) => {
    const result = install(root, 'grok,claude');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const lines = result.stdout.split('\n').filter((l) => l.includes('Claude Code'));
    assert.ok(lines.length > 0, 'the Claude install must be reported');
    const metadata = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'cafekit.json'), 'utf8'));
    assert.equal(metadata.platform, 'claude');
    assert.equal(fs.existsSync(path.join(root, '.grok')), false);
  });
});

test('a plain claude install prints no grok notice', () => {
  inTempProject((root) => {
    const result = install(root, 'claude');
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /grok --trust/, 'the alias must leave the Claude path unchanged');
  });
});

test('.grok is not a detection marker', () => {
  // A repository that merely holds `.grok/` has not asked for CafeKit. Adding `.grok` to
  // Claude's detection markers would make a reinstall in a Codex project silently grow a
  // `.claude/` tree beside it, because detected platforms are unioned with saved ones.
  // (An install with no platform at all still defaults to Claude; that is separate, and
  // predates this alias.)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grok-detect-'));
  const cwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.grok', 'agents'), { recursive: true });
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    process.chdir(root);
    const detected = detectPlatforms();
    assert.deepEqual(detected, ['codex'], 'only the platform with a real payload may be detected');
  } finally {
    process.chdir(cwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an unknown platform is still rejected', () => {
  inTempProject((root) => {
    const result = install(root, 'nonesuch');
    assert.notEqual(result.status, 0, 'the alias table must not swallow a typo');
    assert.match(`${result.stdout}${result.stderr}`, /Unknown platform/);
  });
});

test('the notice exists in every shipped locale', () => {
  // A missing key renders as the key name, which is how a translation gap ships silently.
  for (const code of I18N.SUPPORTED) {
    const text = I18N.MESSAGES?.[code]?.grokCompatNotice ?? I18N[code]?.grokCompatNotice;
    assert.ok(typeof text === 'string' && text.length > 0, `missing grokCompatNotice for ${code}`);
    assert.match(text, /grok --trust/, `${code} must name the command`);
    assert.match(text, /hooks-trust/, `${code} must name the slash command`);
  }
});
