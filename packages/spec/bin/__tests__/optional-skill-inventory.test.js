const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const {
  loadClaudeMigrationManifest,
  parseInstallerArgs,
  PLATFORMS
} = require('../lib/context');
const manifestLib = require('../lib/manifest');
const { selectDocumentSkills } = require('../phases/select-skill-bundles');
const { reconcileSkillInventory } = require('../phases/skill-inventory');
const installerPath = path.resolve(__dirname, '..', 'install.js');

function withTempProject(run) {
  const previous = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-optional-skills-'));
  process.chdir(root);
  try {
    return run(root);
  } finally {
    process.chdir(previous);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function withTempProjectAsync(run) {
  const previous = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-optional-skills-'));
  process.chdir(root);
  try {
    return await run(root);
  } finally {
    process.chdir(previous);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function silentUi() {
  return {
    confirm: async (_options, fallback) => fallback,
    isCancel: () => false,
    warn: () => {},
    detail: () => {}
  };
}

test('manifest separates core, optional documents, and retired skills', () => {
  const manifest = loadClaudeMigrationManifest();
  assert.equal(manifest.skills.required.includes('route'), true);
  assert.deepEqual(manifest.skills.bundles.documentSkills, [
    'ai-multimodal', 'docs', 'docx', 'pdf', 'pptx', 'xlsx'
  ]);
  for (const skill of manifest.skills.bundles.documentSkills) {
    assert.equal(manifest.skills.required.includes(skill), false);
  }
  assert.deepEqual(manifest.obsolete.skills, [
    'backend-development', 'frontend-development', 'frontend-design',
    'mobile-development', 'devops', 'react-best-practices',
    'inspect', 'hotfix', 'question'
  ]);
});

test('document skill flags are mutually exclusive', () => {
  assert.throws(
    () => parseInstallerArgs(['node', 'install', '--with-document-skills', '--without-document-skills']),
    /cannot be used together/
  );
});

test('selection defaults fresh non-interactive OFF and preserves legacy upgrade ON', async () => {
  await withTempProjectAsync(async () => {
    const base = {
      platforms: ['claude', 'codex'],
      options: {},
      documentSkills: {},
      interactive: false,
      ui: silentUi(),
      t: (key) => key
    };
    fs.mkdirSync('.codex', { recursive: true });
    fs.writeFileSync('.codex/cafekit.json', '{"schemaVersion":1,"platform":"codex"}\n');

    await selectDocumentSkills(base);
    assert.deepEqual(base.documentSkills.claude, {
      enabled: false,
      selectionSource: 'default-fresh'
    });
    assert.deepEqual(base.documentSkills.codex, {
      enabled: true,
      selectionSource: 'legacy-upgrade'
    });
  });
});

test('interactive cancellation stops before selecting a fresh bundle', async () => {
  await withTempProjectAsync(async () => {
    const ctx = {
      platforms: ['claude'],
      options: {},
      documentSkills: {},
      interactive: true,
      cancelled: false,
      ui: {
        confirm: async () => 'cancel',
        isCancel: (value) => value === 'cancel'
      },
      t: (key) => key
    };
    await selectDocumentSkills(ctx);
    assert.equal(ctx.cancelled, true);
    assert.equal(ctx.documentSkills.claude, undefined);
  });
});

for (const platformKey of ['claude', 'codex']) {
  test(`${platformKey} prunes pristine optional skills and preserves modified skills`, () => {
    withTempProject(() => {
      const platform = PLATFORMS[platformKey];
      const docsFile = path.join(platform.skillsDir, 'docs', 'SKILL.md');
      const pdfFile = path.join(platform.skillsDir, 'pdf', 'SKILL.md');
      fs.mkdirSync(path.dirname(docsFile), { recursive: true });
      fs.mkdirSync(path.dirname(pdfFile), { recursive: true });
      fs.writeFileSync(docsFile, 'owned\n');
      fs.writeFileSync(pdfFile, 'owned then edited\n');

      const ownership = {
        schemaVersion: 1,
        version: 'old',
        files: {}
      };
      const recordRoot = platform.ownership?.recordRoot || platform.folder;
      const key = (file) => path.relative(recordRoot, file).replace(/\\/g, '/');
      ownership.files[key(docsFile)] = { sha256: manifestLib.hashFile(docsFile), version: 'old' };
      ownership.files[key(pdfFile)] = { sha256: manifestLib.sha256('before edit\n'), version: 'old' };

      const ctx = {
        manifest: { obsolete: { skills: [] }, skills: { bundles: { documentSkills: ['docs', 'pdf'] } } },
        documentSkills: { [platformKey]: { enabled: false, selectionSource: 'cli-opt-out' } },
        ownership: { [platform.folder]: ownership },
        trackers: {
          [platformKey]: manifestLib.createTracker(platform.folder, 'next', platform.ownership)
        },
        dryRun: false,
        ui: silentUi(),
        results: { updated: 0, preserved: 0, preservedFiles: [] }
      };

      reconcileSkillInventory(ctx, platformKey);
      assert.equal(fs.existsSync(path.dirname(docsFile)), false);
      assert.equal(fs.existsSync(path.dirname(pdfFile)), true);
      assert.equal(ctx.results.updated, 1);
      assert.equal(ctx.results.preserved, 1);
    });
  });
}

test('fresh combined install defaults optional bundle OFF', () => {
  withTempProject((root) => {
    const result = spawnSync(process.execPath, [
      installerPath, '--platform', 'claude,codex', '--yes'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    for (const platformKey of ['claude', 'codex']) {
      const platform = PLATFORMS[platformKey];
      assert.equal(fs.existsSync(path.join(platform.skillsDir, 'docs')), false);
      assert.equal(fs.existsSync(path.join(platform.skillsDir, 'route', 'SKILL.md')), true);
      const metadata = JSON.parse(fs.readFileSync(path.join(platform.folder, 'cafekit.json'), 'utf8'));
      assert.equal(metadata.schemaVersion, 2);
      assert.equal(metadata.documentSkills.enabled, false);
    }
  });
});

test('explicit opt-in installs all six optional skills on both runtimes', () => {
  withTempProject((root) => {
    const result = spawnSync(process.execPath, [
      installerPath, '--platform', 'claude,codex', '--yes', '--with-document-skills'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const optional = loadClaudeMigrationManifest().skills.bundles.documentSkills;
    for (const platformKey of ['claude', 'codex']) {
      const platform = PLATFORMS[platformKey];
      for (const skill of optional) {
        assert.equal(fs.existsSync(path.join(platform.skillsDir, skill, 'SKILL.md')), true, `${platformKey}:${skill}`);
      }
      const catalog = spawnSync(process.execPath, [
        path.join(platform.folder, 'scripts', 'generate-skill-catalog.cjs'), '--json'
      ], { cwd: root, encoding: 'utf8' });
      assert.equal(catalog.status, 0, catalog.stderr);
      const catalogData = JSON.parse(catalog.stdout);
      assert.equal(catalogData.skills.some((skill) => skill.public_id === 'cf:route'), true);
      assert.equal(catalogData.skills.some((skill) => skill.public_id === 'cf:docs'), true);
      const metadata = JSON.parse(fs.readFileSync(path.join(platform.folder, 'cafekit.json'), 'utf8'));
      assert.deepEqual(metadata.documentSkills, {
        enabled: true,
        selectionSource: 'cli-opt-in'
      });
    }
  });
});

test('corrupt metadata preserves an installed document bundle', () => {
  withTempProject((root) => {
    const install = (...args) => spawnSync(process.execPath, [
      installerPath, '--platform', 'claude', '--yes', ...args
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(install('--with-document-skills').status, 0);
    fs.writeFileSync(path.join(root, '.claude', 'cafekit.json'), '{broken\n');

    const recovered = install();
    assert.equal(recovered.status, 0, recovered.stderr || recovered.stdout);
    assert.equal(fs.existsSync(path.join(root, '.claude', 'skills', 'docs', 'SKILL.md')), true);
    const metadata = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'cafekit.json'), 'utf8'));
    assert.deepEqual(metadata.documentSkills, {
      enabled: true,
      selectionSource: 'metadata-recovery'
    });
  });
});

test('modified retired skill is preserved but excluded from automatic routing', () => {
  withTempProject((root) => {
    const retiredRoot = path.join(root, '.claude', 'skills', 'backend-development');
    fs.mkdirSync(retiredRoot, { recursive: true });
    fs.writeFileSync(path.join(retiredRoot, 'SKILL.md'), [
      '---', 'name: cf:backend-development',
      'description: "User-modified retired skill."', '---', '# Preserved', '',
    ].join('\n'));
    const result = spawnSync(process.execPath, [
      installerPath, '--platform', 'claude', '--yes'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(retiredRoot, 'SKILL.md')), true);

    const catalog = spawnSync(process.execPath, [
      path.join(root, '.claude', 'scripts', 'generate-skill-catalog.cjs'), '--json'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(catalog.status, 0, catalog.stderr);
    const parsed = JSON.parse(catalog.stdout);
    assert.equal(parsed.skills.some((skill) => skill.directory === 'backend-development'), false);
    assert.ok(parsed.diagnostics.some((item) =>
      item.directory === 'backend-development' && item.code === 'retired_skill'));
  });
});

for (const platformKey of ['claude', 'codex']) {
  test(`${platformKey} upgrade retires the inspect, hotfix and question directories`, () => {
    withTempProject((root) => {
      const platform = PLATFORMS[platformKey];
      const recordRoot = platform.ownership?.recordRoot || platform.folder;
      const key = (file) => path.relative(recordRoot, file).replace(/\\/g, '/');
      const ownership = { schemaVersion: 1, version: 'old', files: {} };
      for (const old of ['inspect', 'hotfix', 'question']) {
        const file = path.join(platform.skillsDir, old, 'SKILL.md');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `pristine ${old}\n`);
        ownership.files[key(file)] = { sha256: manifestLib.hashFile(file), version: 'old' };
      }
      const ctx = {
        manifest: loadClaudeMigrationManifest(),
        documentSkills: { [platformKey]: { enabled: true, selectionSource: 'cli-opt-in' } },
        ownership: { [platform.folder]: ownership },
        trackers: { [platformKey]: manifestLib.createTracker(platform.folder, 'next', platform.ownership) },
        dryRun: false,
        ui: silentUi(),
        results: { updated: 0, preserved: 0, preservedFiles: [] }
      };
      reconcileSkillInventory(ctx, platformKey);
      for (const old of ['inspect', 'hotfix', 'question']) {
        assert.equal(fs.existsSync(path.join(root, platform.skillsDir, old)), false, old);
      }
      assert.equal(ctx.results.updated, 3);

      // A user-modified retired copy survives with a warning, and the catalog serves cf:fix from fix/
      // while marking the old directory retired rather than reporting a folder mismatch.
      const edited = path.join(root, platform.skillsDir, 'hotfix', 'SKILL.md');
      fs.mkdirSync(path.dirname(edited), { recursive: true });
      fs.writeFileSync(edited, [
        '---', `name: ${platformKey === 'codex' ? 'cf-fix' : 'cf:fix'}`,
        'description: "User-modified retired copy."', '---', '# Preserved', '',
      ].join('\n'));
      const result = spawnSync(process.execPath, [
        installerPath, '--platform', platformKey, '--yes'
      ], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(fs.existsSync(edited), true);
      assert.match(`${result.stdout}\n${result.stderr}`, /Preserved user-owned skill: .*hotfix/);
      for (const renamed of ['scout', 'fix', 'ask']) {
        assert.equal(fs.existsSync(path.join(root, platform.skillsDir, renamed, 'SKILL.md')), true, renamed);
      }
      const scriptRoot = platformKey === 'codex' ? '.codex' : '.claude';
      const catalog = spawnSync(process.execPath, [
        path.join(root, scriptRoot, 'scripts', 'generate-skill-catalog.cjs'), '--json'
      ], { cwd: root, encoding: 'utf8' });
      assert.equal(catalog.status, 0, catalog.stderr);
      const parsed = JSON.parse(catalog.stdout);
      for (const id of ['cf:scout', 'cf:fix', 'cf:ask']) {
        assert.ok(parsed.skills.some((skill) => skill.public_id === id), id);
      }
      assert.equal(parsed.skills.find((skill) => skill.public_id === 'cf:fix').directory, 'fix');
      assert.ok(parsed.diagnostics.some((item) => item.directory === 'hotfix' && item.code === 'retired_skill'));
      assert.equal(parsed.diagnostics.some((item) => item.code === 'duplicate_public_name'), false);
    });
  });
}

test('the catalog retires exactly the directories the manifest retires', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'src', 'claude', 'scripts', 'generate-skill-catalog.cjs'), 'utf8');
  const block = source.match(/const RETIRED_DIRECTORIES = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(block, 'RETIRED_DIRECTORIES not found');
  const retired = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual([...retired].sort(), [...loadClaudeMigrationManifest().obsolete.skills].sort());
});
