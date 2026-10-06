'use strict';

// Output styles are a Claude Code surface: Claude Code discovers .claude/output-styles/
// alongside agents, skills and rules, and Codex CLI has no equivalent. These tests pin
// what installs where, and that every style stays loadable — a style with broken
// frontmatter is silently unavailable rather than loudly wrong.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SOURCE_DIR = path.join(PACKAGE_ROOT, 'src/claude/output-styles');
const EXPECTED = [
  'coding-level-0-eli5.md',
  'coding-level-1-junior.md',
  'coding-level-2-mid.md',
  'coding-level-3-senior.md',
  'coding-level-4-lead.md',
  'coding-level-5-god.md',
];

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-output-styles-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, platform) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', platform, '--yes'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
  );
}

/** Parse the leading `---` frontmatter block into a flat key/value map. */
function frontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/i);
    if (pair) fields[pair[1]] = pair[2].trim();
  }
  return fields;
}

test('the source ships exactly the six coding levels', () => {
  const found = fs.readdirSync(SOURCE_DIR).filter((name) => name.endsWith('.md')).sort();
  assert.deepEqual(found, EXPECTED);
});

test('every style carries the frontmatter Claude Code reads', () => {
  for (const name of EXPECTED) {
    const fields = frontmatter(fs.readFileSync(path.join(SOURCE_DIR, name), 'utf8'));
    assert.ok(fields, `${name} has no frontmatter block, so it cannot load`);
    assert.ok(fields.name, `${name} has no name`);
    assert.ok(fields.description, `${name} has no description`);
    // These styles change how answers are written, not what the agent is allowed to do.
    assert.equal(
      fields['keep-coding-instructions'], 'true',
      `${name} must keep the base coding instructions, or the style would replace them`
    );
  }
});

test('each level declares a distinct name and description', () => {
  const names = new Set();
  const descriptions = new Set();
  for (const file of EXPECTED) {
    const fields = frontmatter(fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8'));
    names.add(fields.name);
    descriptions.add(fields.description);
  }
  assert.equal(names.size, EXPECTED.length, 'two styles share a name and would be indistinguishable');
  assert.equal(descriptions.size, EXPECTED.length, 'two styles share a description');
});

test('a Claude install places every style where Claude Code discovers them', () => {
  inTempProject((root) => {
    const result = install(root, 'claude');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const installed = path.join(root, '.claude', 'output-styles');
    for (const name of EXPECTED) {
      assert.equal(fs.existsSync(path.join(installed, name)), true, `missing ${name}`);
      assert.equal(
        fs.readFileSync(path.join(installed, name), 'utf8'),
        fs.readFileSync(path.join(SOURCE_DIR, name), 'utf8'),
        `${name} was altered on the way in`
      );
    }
  });
});

test('a Codex install ships the same styles, since its rules hook injects them', () => {
  inTempProject((root) => {
    const result = install(root, 'codex');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const installed = path.join(root, '.codex', 'output-styles');
    for (const name of EXPECTED) {
      assert.equal(
        fs.readFileSync(path.join(installed, name), 'utf8'),
        fs.readFileSync(path.join(SOURCE_DIR, name), 'utf8'),
        `${name} differs from the one canonical source`
      );
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.codex', 'runtime.json'), 'utf8')).codingLevel, 1);
  });
});

/** Run the installed Codex rules hook and return what it injects. */
function runRulesHook(root, sessionId) {
  const result = spawnSync(process.execPath, [path.join(root, '.codex', 'hooks', 'rules.cjs')], {
    cwd: root,
    input: JSON.stringify({ session_id: sessionId, cwd: root }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function setCodingLevel(root, level) {
  const file = path.join(root, '.codex', 'runtime.json');
  const runtime = JSON.parse(fs.readFileSync(file, 'utf8'));
  runtime.codingLevel = level;
  fs.writeFileSync(file, `${JSON.stringify(runtime, null, 2)}\n`);
}

test('the Codex rules hook injects the style the coding level names', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'codex').status, 0);

    const junior = runRulesHook(root, 'session-junior');
    assert.match(junior, /## Communication style/);
    assert.match(junior, /Junior Developer Communication Mode/);
    // The body uses `---` as a horizontal rule, so check a frontmatter-only marker.
    assert.doesNotMatch(junior, /keep-coding-instructions/, 'the frontmatter must be stripped, not injected');
    assert.doesNotMatch(junior, /^description:/m, 'the frontmatter must be stripped, not injected');
    assert.match(junior, /## Rules/, 'the existing rules injection must survive');

    setCodingLevel(root, 5);
    const expert = runRulesHook(root, 'session-expert');
    assert.match(expert, /God Mode Communication/);
    assert.doesNotMatch(expert, /Junior Developer Communication Mode/);
  });
});

test('the Codex style is injected once per session, not once per turn', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'codex').status, 0);
    const first = runRulesHook(root, 'one-session');
    assert.match(first, /## Communication style/);
    assert.equal(runRulesHook(root, 'one-session'), '', 'a second turn in the same session must inject nothing');
    assert.match(runRulesHook(root, 'another-session'), /## Communication style/);
  });
});

test('an absent or out-of-range coding level injects no style but keeps the rules', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'codex').status, 0);
    for (const [level, label] of [[null, 'null'], [9, 'out of range'], ['1', 'a string']]) {
      setCodingLevel(root, level);
      const out = runRulesHook(root, `session-${label.replace(/\s/g, '-')}`);
      assert.doesNotMatch(out, /## Communication style/, `${label} must not select a style`);
      assert.match(out, /## Rules/, `${label} must not break the existing rules injection`);
    }
  });
});

test('a Claude install seeds the default style but never overwrites the user choice', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'claude').status, 0);
    const settingsPath = path.join(root, '.claude', 'settings.json');
    const seeded = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.equal(seeded.outputStyle, 'Junior Developer Mode (Level 1)');

    seeded.outputStyle = 'God Mode (Level 5)';
    fs.writeFileSync(settingsPath, `${JSON.stringify(seeded, null, 2)}\n`);

    assert.equal(install(root, 'claude').status, 0);
    assert.equal(
      JSON.parse(fs.readFileSync(settingsPath, 'utf8')).outputStyle, 'God Mode (Level 5)',
      'a reinstall reset a preference the user had chosen'
    );

    const forced = spawnSync(process.execPath, [INSTALLER, '--platform', 'claude', '--force-overwrite', '--yes'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
    assert.equal(forced.status, 0, `${forced.stdout}\n${forced.stderr}`);
    assert.equal(
      JSON.parse(fs.readFileSync(settingsPath, 'utf8')).outputStyle, 'God Mode (Level 5)',
      '--force-overwrite repairs managed files; it must not reset taste'
    );
  });
});

test('a style edited by the user survives a reinstall', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'claude').status, 0);
    const target = path.join(root, '.claude', 'output-styles', 'coding-level-5-god.md');
    const edited = `${fs.readFileSync(target, 'utf8')}\n\nAlways answer in Vietnamese.\n`;
    fs.writeFileSync(target, edited);

    assert.equal(install(root, 'claude').status, 0);
    assert.equal(fs.readFileSync(target, 'utf8'), edited, 'the reinstall discarded a user edit');
  });
});
