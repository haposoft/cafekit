// Codex ignores the `disable-model-invocation` key that keeps a skill explicit-only on Claude Code. Its own
// mechanism is `agents/openai.yaml` beside SKILL.md with `policy.allow_implicit_invocation: false`. These cases
// pin that the Codex install writes that file for every explicit-only skill through the ownership-aware writer
// (so upgrades and removals stay clean), writes it for no other skill, and that the catalog never lists such a skill.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const { PLATFORMS } = require('../lib/context');
const manifestLib = require('../lib/manifest');
const { removeSkill } = require('../phases/skill-inventory');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SOURCE_SKILLS = path.join(PACKAGE_ROOT, 'src/claude/skills');
const POLICY = 'policy:\n  allow_implicit_invocation: false\n';

const explicitOnly = fs.readdirSync(SOURCE_SKILLS)
  .filter((name) => fs.existsSync(path.join(SOURCE_SKILLS, name, 'SKILL.md')))
  .filter((name) => /^disable-model-invocation:\s*(["']?)true\1\s*$/m.test(
    fs.readFileSync(path.join(SOURCE_SKILLS, name, 'SKILL.md'), 'utf8').split(/^---\s*$/m)[1] || ''));

function install(root, platform) {
  const result = spawnSync(process.execPath, [INSTALLER, '--platform', platform, '--yes'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function withTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-policy-'));
  const previous = process.cwd();
  try {
    assert.equal(spawnSync('git', ['-C', root, 'init', '-q']).status, 0);
    process.chdir(root);
    return run(root);
  } finally {
    process.chdir(previous);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const policyFile = (root, skill) => path.join(root, '.agents/skills', skill, 'agents/openai.yaml');
const ownershipKey = (root, file) => path.relative(path.join(root, PLATFORMS.codex.ownership?.recordRoot || PLATFORMS.codex.folder), file).replace(/\\/g, '/');
const readOwnership = (root) => JSON.parse(fs.readFileSync(path.join(root, PLATFORMS.codex.folder, manifestLib.MANIFEST_FILE), 'utf8'));
const writeOwnership = (root, data) => fs.writeFileSync(path.join(root, PLATFORMS.codex.folder, manifestLib.MANIFEST_FILE), JSON.stringify(data, null, 2));

function catalog(root, script, skillsRoot) {
  const result = spawnSync(process.execPath, [path.join(root, script), '--json', '--root', path.join(root, skillsRoot)],
    { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('the explicit-only skills are vibe and adv', () => {
  assert.deepEqual(explicitOnly.sort(), ['adv', 'vibe']);
});

test('a Codex install writes the policy file for every explicit-only skill, owned, and for no other skill', () => {
  withTempProject((root) => {
    install(root, 'codex');
    const ownership = readOwnership(root);
    for (const skill of explicitOnly) {
      const file = policyFile(root, skill);
      assert.equal(fs.readFileSync(file, 'utf8'), POLICY, skill);
      assert.equal(ownership.files[ownershipKey(root, file)]?.sha256, manifestLib.hashFile(file), `${skill} policy is not owned`);
    }
    const others = fs.readdirSync(path.join(root, '.agents/skills')).filter((name) => !explicitOnly.includes(name));
    assert.ok(others.length > 10);
    for (const skill of others) assert.equal(fs.existsSync(policyFile(root, skill)), false, skill);
  });
});

test('reinstalling keeps the policy bytes and its ownership record unchanged', () => {
  withTempProject((root) => {
    install(root, 'codex');
    const before = explicitOnly.map((skill) => readOwnership(root).files[ownershipKey(root, policyFile(root, skill))]?.sha256);
    install(root, 'codex');
    const after = explicitOnly.map((skill) => readOwnership(root).files[ownershipKey(root, policyFile(root, skill))]?.sha256);
    assert.deepEqual(after, before);
    for (const skill of explicitOnly) assert.equal(fs.readFileSync(policyFile(root, skill), 'utf8'), POLICY);
  });
});

test('an owned policy file under a skill that dropped the key is removed on upgrade; a user-created one stays', () => {
  withTempProject((root) => {
    install(root, 'codex');
    // An earlier release that marked ask explicit-only would have written and owned this file.
    const owned = policyFile(root, 'ask');
    fs.mkdirSync(path.dirname(owned), { recursive: true });
    fs.writeFileSync(owned, POLICY);
    const data = readOwnership(root);
    data.files[ownershipKey(root, owned)] = { sha256: manifestLib.hashFile(owned), version: 'old' };
    writeOwnership(root, data);
    // A file the user wrote is never ours to delete.
    const userFile = policyFile(root, 'debug');
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    fs.writeFileSync(userFile, POLICY);

    install(root, 'codex');
    assert.equal(fs.existsSync(owned), false, 'owned stale policy survived the upgrade');
    assert.equal(readOwnership(root).files[ownershipKey(root, owned)], undefined, 'stale policy stayed in the manifest');
    assert.equal(fs.readFileSync(userFile, 'utf8'), POLICY, 'user-created policy was removed');
  });
});

test('a user edit to the policy file is preserved on upgrade', () => {
  withTempProject((root) => {
    install(root, 'codex');
    const file = policyFile(root, 'vibe');
    const edited = 'policy:\n  allow_implicit_invocation: true\n';
    fs.writeFileSync(file, edited);
    install(root, 'codex');
    assert.equal(fs.readFileSync(file, 'utf8'), edited);
  });
});

test('removing an explicit-only skill removes its whole tree, the policy file included', () => {
  withTempProject((root) => {
    install(root, 'codex');
    const ctx = {
      ownership: { [PLATFORMS.codex.folder]: readOwnership(root) },
      trackers: { codex: manifestLib.createTracker(PLATFORMS.codex.folder, 'next', PLATFORMS.codex.ownership) },
      dryRun: false,
      ui: { warn() {}, detail() {} },
      results: { updated: 0, preserved: 0, preservedFiles: [] }
    };
    removeSkill(ctx, 'codex', 'vibe');
    assert.deepEqual(ctx.results.preservedFiles, []);
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/vibe')), false);
  });
});

test('a Claude install writes no policy file', () => {
  withTempProject((root) => {
    install(root, 'claude');
    for (const skill of fs.readdirSync(path.join(root, '.claude/skills'))) {
      assert.equal(fs.existsSync(path.join(root, '.claude/skills', skill, 'agents/openai.yaml')), false, skill);
    }
  });
});

test('neither runtime catalog lists an explicit-only skill, and both still list the others', () => {
  withTempProject((root) => {
    install(root, 'claude,codex');
    for (const [script, skillsRoot] of [['.codex/scripts/generate-skill-catalog.cjs', '.agents/skills'],
      ['.claude/scripts/generate-skill-catalog.cjs', '.claude/skills']]) {
      const parsed = catalog(root, script, skillsRoot);
      const ids = parsed.skills.map((skill) => skill.public_id);
      for (const skill of explicitOnly) {
        assert.equal(ids.includes(`cf:${skill}`), false, `${script} lists cf:${skill}`);
        assert.ok(parsed.diagnostics.some((item) => item.directory === skill && item.code === 'explicit_only'), `${script}: ${skill}`);
      }
      assert.ok(ids.includes('cf:ask') && ids.includes('cf:specs'), script);
    }
  });
});
