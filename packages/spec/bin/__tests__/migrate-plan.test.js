'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { planManifestFiles, renderManifestPlan } = require('../lib/migrate-plan');
const { EXCLUDED_SKILLS, EXCLUDED_AGENTS } = require('../lib/plugin-inventory');
const { codexAgentName } = require('../lib/codex-install');
const { sha256 } = require('../lib/manifest');

const INSTALLER = path.join(__dirname, '../install.js');
const DOCUMENT_SKILLS = require('../../src/claude/migration-manifest.json').skills.bundles.documentSkills;
const NPX_ONLY_SKILLS = [...EXCLUDED_SKILLS, ...DOCUMENT_SKILLS];

let work;
let pristine;

function copyFixture(name) {
  const target = path.join(work, name, 'repo');
  fs.cpSync(pristine, target, { recursive: true, verbatimSymlinks: true });
  return target;
}

function treeHash(root) {
  const hash = crypto.createHash('sha256');
  const visit = (rel) => {
    const abs = path.join(root, rel);
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) hash.update(`L ${rel} ${fs.readlinkSync(abs)}\n`);
    else if (stat.isDirectory()) for (const name of fs.readdirSync(abs).sort()) visit(path.join(rel, name));
    else hash.update(`F ${rel} ${sha256(fs.readFileSync(abs))}\n`);
  };
  visit('.');
  return hash.digest('hex');
}

const byPath = (plan) => new Map(plan.entries.map((entry) => [entry.path, entry]));
const ofPlatform = (plan, platform) => plan.entries.filter((entry) => entry.platform === platform);

before(() => {
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-migrate-plan-')));
  pristine = path.join(work, 'pristine', 'repo');
  fs.mkdirSync(pristine, { recursive: true });
  fs.mkdirSync(path.join(work, 'home'));
  spawnSync('git', ['init', '-q'], { cwd: pristine });
  // The installer writes into its cwd, so it must run inside the temp repository.
  const run = spawnSync(process.execPath, [INSTALLER, '--platform', 'claude,codex', '--with-document-skills', '-y'], {
    cwd: pristine,
    env: { ...process.env, HOME: path.join(work, 'home'), CI: '1' },
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('pristine-removed-count: every Codex key is removed except runtime, npx-only, required and ignore files', () => {
  const plan = planManifestFiles(pristine);
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(pristine, '.codex/cafekit-manifest.json'), 'utf8')).files);
  const codex = ofPlatform(plan, 'codex');
  assert.equal(codex.length, keys.length);
  // Codex keys are relative to the repository root, not to .codex/.
  assert.deepEqual(codex.map((entry) => entry.path).sort(), [...keys].sort());

  const npxOnly = keys.filter((key) => NPX_ONLY_SKILLS.some((name) => key.startsWith(`.agents/skills/${name}/`))
    || EXCLUDED_AGENTS.some((name) => key === `.codex/agents/${codexAgentName(name)}.toml`));
  const runtime = keys.filter((key) => key === '.codex/runtime.json' || key === '.codex/runtime.schema.json');
  const counted = (reason) => codex.filter((entry) => entry.reason === reason).length;
  assert.equal(counted('npx-only'), npxOnly.length);
  assert.equal(counted('runtime'), runtime.length);
  for (const entry of codex.filter((item) => item.action !== 'remove')) {
    assert.ok(['runtime', 'npx-only', 'required-by-kept', 'protects-kept'].includes(entry.reason), `${entry.path}: ${entry.reason}`);
  }
  const removed = codex.filter((entry) => entry.action === 'remove').length;
  assert.equal(removed, keys.length - runtime.length - npxOnly.length - counted('required-by-kept') - counted('protects-kept'));
  assert.ok(removed > 100, `only ${removed} Codex files removed`);

  for (const entry of ofPlatform(plan, 'claude')) {
    if (entry.action === 'remove') continue;
    assert.ok(['runtime', 'npx-only', 'required-by-kept', 'protects-kept'].includes(entry.reason), `${entry.path}: ${entry.reason}`);
  }
  assert.deepEqual(plan.untracked, []);
});

test('runtime-kept: runtime.json and its schema stay for both platforms', () => {
  const entries = byPath(planManifestFiles(pristine));
  for (const rel of ['.claude/runtime.json', '.claude/runtime.schema.json', '.codex/runtime.json', '.codex/runtime.schema.json']) {
    assert.equal(entries.get(rel).action, 'keep', rel);
    assert.equal(entries.get(rel).reason, 'runtime', rel);
  }
});

test('npx-only-kept: skills and agents no plugin ships stay whole', () => {
  const plan = planManifestFiles(pristine);
  for (const name of ['chrome-devtools', 'ui-ux', 'ui-ux-pro-max']) {
    for (const prefix of [`.claude/skills/${name}/`, `.agents/skills/${name}/`]) {
      const members = plan.entries.filter((entry) => entry.path.startsWith(prefix));
      assert.ok(members.length > 0, prefix);
      assert.ok(members.every((entry) => entry.reason === 'npx-only'), prefix);
    }
  }
  const entries = byPath(plan);
  assert.equal(entries.get('.claude/agents/ui-ux-designer.md').reason, 'npx-only');
  assert.equal(entries.get('.codex/agents/ui_ux_designer.toml').reason, 'npx-only');
  assert.equal(entries.get('.claude/agents/debugger.md').action, 'remove');
});

test('kept-skill-deps-kept: shared files a kept skill names stay, transitively', () => {
  const entries = byPath(planManifestFiles(pristine));
  for (const rel of ['.claude/scripts/validate-docs.cjs', '.claude/scripts/validate-docs-reconstruct.cjs', '.claude/hooks/docs-sync.cjs',
    '.codex/scripts/validate-docs.cjs', '.codex/hooks/docs-sync.cjs']) {
    assert.equal(entries.get(rel).reason, 'required-by-kept', rel);
  }
  // docs-sync.cjs requires ./lib/config.cjs, which requires ./runtime-dir.cjs.
  assert.equal(entries.get('.claude/hooks/lib/config.cjs').reason, 'required-by-kept');
  assert.equal(entries.get('.claude/hooks/lib/runtime-dir.cjs').reason, 'required-by-kept');
  assert.equal(entries.get('.claude/scripts/provenance.cjs').action, 'remove');

  // A user hook or skill the plugins do not replace keeps what it requires or runs.
  const repo = copyFixture('user-deps');
  fs.writeFileSync(path.join(repo, '.claude/hooks/my-hook.cjs'), "require('./lib/project-root.cjs');\n");
  fs.mkdirSync(path.join(repo, '.claude/skills/my-skill'));
  fs.writeFileSync(path.join(repo, '.claude/skills/my-skill/SKILL.md'), 'Run `node .claude\\scripts\\spec-receipt.cjs`.\n');
  fs.mkdirSync(path.join(repo, '.claude/hooks/.logs'));
  fs.writeFileSync(path.join(repo, '.claude/hooks/.logs/run.log'), 'ran .claude/scripts/workflow-policy.cjs\n');
  const linkedSkill = path.join(work, 'user-deps', 'linked-skill');
  fs.mkdirSync(linkedSkill);
  fs.writeFileSync(path.join(linkedSkill, 'SKILL.md'), 'Run `node .claude/scripts/scan-staged-secrets.cjs`.\n');
  fs.symlinkSync(linkedSkill, path.join(repo, '.claude/skills/linked-skill'), 'dir');
  fs.writeFileSync(path.join(repo, '.claude/settings.local.json'),
    JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node .claude\\hooks\\spec-gate.cjs' }] }] } }));
  fs.writeFileSync(path.join(linkedSkill, 'agent.md'), 'Uses `.claude/scripts/setup-statusline.cjs`.\n');
  fs.symlinkSync(path.join(linkedSkill, 'agent.md'), path.join(repo, '.claude/agents/my-agent.md'));
  fs.writeFileSync(path.join(repo, '.claude/skills/scout/.DS_Store'), '');
  const user = byPath(planManifestFiles(repo));
  assert.equal(user.get('.claude/scripts/scan-staged-secrets.cjs').reason, 'required-by-kept');
  assert.equal(user.get('.claude/hooks/spec-gate.cjs').reason, 'required-by-kept');
  assert.equal(user.get('.claude/scripts/setup-statusline.cjs').reason, 'required-by-kept');
  assert.equal(user.get('.claude/skills/scout/SKILL.md').action, 'remove');
  assert.equal(user.get('.claude/hooks/lib/project-root.cjs').reason, 'required-by-kept');
  assert.equal(user.get('.claude/scripts/spec-receipt.cjs').reason, 'required-by-kept');
  assert.equal(user.get('.claude/scripts/workflow-policy.cjs').action, 'remove');
});

test('selected-style-kept: the output style chosen in settings.json stays', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(pristine, '.claude/settings.json'), 'utf8'));
  assert.ok(settings.outputStyle, 'fixture selects an output style');
  const plan = planManifestFiles(pristine);
  const styles = plan.entries.filter((entry) => entry.path.startsWith('.claude/output-styles/'));
  const kept = styles.filter((entry) => entry.action === 'keep');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].reason, 'required-by-kept');
  assert.match(fs.readFileSync(path.join(pristine, kept[0].path), 'utf8'), new RegExp(`^name: ${settings.outputStyle.replace(/[()]/g, '\\$&')}$`, 'm'));
  assert.ok(styles.filter((entry) => entry.action === 'remove').length >= 1);

  // /output-style writes the choice to settings.local.json, which overrides settings.json.
  const repo = copyFixture('local-style');
  fs.writeFileSync(path.join(repo, '.claude/settings.local.json'), JSON.stringify({ outputStyle: 'ELI5 Mode (Level 0)' }));
  const local = byPath(planManifestFiles(repo));
  assert.equal(local.get('.claude/output-styles/coding-level-0-eli5.md').reason, 'required-by-kept');
  assert.equal(local.get(kept[0].path).reason, 'required-by-kept');
});

test('modified-group-kept: an edited skill stays whole with every shared file it names', () => {
  const repo = copyFixture('modified');
  const skillFile = path.join(repo, '.claude/skills/specs/SKILL.md');
  fs.appendFileSync(skillFile, '\nRun `node .claude/scripts/provenance.cjs` before closing.\n');
  const plan = planManifestFiles(repo);
  const members = plan.entries.filter((entry) => entry.path.startsWith('.claude/skills/specs/'));
  assert.ok(members.length > 1);
  assert.equal(members.find((entry) => entry.path === '.claude/skills/specs/SKILL.md').reason, 'modified');
  for (const entry of members.filter((item) => item.path !== '.claude/skills/specs/SKILL.md')) assert.equal(entry.reason, 'group-kept', entry.path);
  assert.equal(byPath(plan).get('.claude/scripts/provenance.cjs').reason, 'required-by-kept');
  // The Codex copy of the same skill is untouched and still goes.
  assert.ok(plan.entries.filter((entry) => entry.path.startsWith('.agents/skills/specs/')).every((entry) => entry.action === 'remove'));

  // A user file added inside an installed skill folder keeps that skill whole.
  const notes = copyFixture('notes');
  fs.writeFileSync(path.join(notes, '.claude/skills/debug/my-notes.md'), 'team notes\n');
  const withNotes = planManifestFiles(notes);
  assert.ok(withNotes.untracked.includes('.claude/skills/debug/my-notes.md'));
  assert.ok(withNotes.entries.filter((entry) => entry.path.startsWith('.claude/skills/debug/')).every((entry) => entry.reason === 'group-kept'));
});

test('symlinked-kept: a symlinked skill folder is kept and its target is never planned', () => {
  const repo = copyFixture('symlinked');
  const outside = path.join(work, 'symlinked', 'outside-debug');
  fs.cpSync(path.join(repo, '.agents/skills/debug'), outside, { recursive: true });
  fs.rmSync(path.join(repo, '.agents/skills/debug'), { recursive: true });
  fs.symlinkSync(outside, path.join(repo, '.agents/skills/debug'), 'dir');
  const plan = planManifestFiles(repo);
  const members = plan.entries.filter((entry) => entry.path.startsWith('.agents/skills/debug/'));
  assert.ok(members.length > 0);
  assert.ok(members.every((entry) => entry.action === 'keep' && entry.reason === 'symlinked'));
  for (const entry of plan.entries.filter((item) => item.action === 'remove')) {
    assert.ok(!fs.realpathSync(path.join(repo, entry.path)).startsWith(outside), entry.path);
  }
  assert.ok(!plan.untracked.some((rel) => rel.startsWith('.agents/skills/debug')));

  // A link back into the repository keeps the files it reaches.
  const inRepo = copyFixture('in-repo-link');
  fs.rmSync(path.join(inRepo, '.agents/skills/debug'), { recursive: true });
  fs.symlinkSync(path.join(inRepo, '.claude/skills/debug'), path.join(inRepo, '.agents/skills/debug'), 'dir');
  const linked = planManifestFiles(inRepo);
  assert.ok(linked.entries.filter((entry) => entry.path.startsWith('.claude/skills/debug/')).every((entry) => entry.action === 'keep'));

  const linkedFolder = copyFixture('linked-folder');
  const codexCopy = path.join(work, 'linked-folder', 'codex-real');
  fs.renameSync(path.join(linkedFolder, '.codex'), codexCopy);
  fs.symlinkSync(codexCopy, path.join(linkedFolder, '.codex'), 'dir');
  const refused = planManifestFiles(linkedFolder);
  assert.equal(refused.platforms.codex.status, 'refused');
  assert.ok(ofPlatform(refused, 'codex').length === 0);
});

test('outside-root-kept: a manifest key that leaves the platform folders is never removed', () => {
  const repo = copyFixture('outside');
  const outsideFile = path.join(work, 'outside', 'outside.txt');
  fs.writeFileSync(outsideFile, 'not CafeKit\n');
  const manifestFile = path.join(repo, '.claude/cafekit-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  // Claude keys resolve against .claude/, so ../../outside.txt is the repository's parent.
  manifest.files['../../outside.txt'] = { sha256: sha256(fs.readFileSync(outsideFile)), version: '0.18.2' };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  const entry = planManifestFiles(repo).entries.find((item) => item.key === '../../outside.txt');
  assert.equal(entry.action, 'keep');
  assert.equal(entry.reason, 'outside-root');
});

test('corrupt-manifest-refused: a manifest that does not parse plans nothing for its platform', () => {
  const repo = copyFixture('corrupt');
  fs.writeFileSync(path.join(repo, '.codex/cafekit-manifest.json'), '{ "files": ');
  const plan = planManifestFiles(repo);
  assert.equal(plan.platforms.codex.status, 'refused');
  assert.equal(ofPlatform(plan, 'codex').length, 0);
  assert.equal(plan.platforms.claude.status, 'planned');
});

test('unmanaged-reported: cafekit.json without a manifest is reported and nothing is planned', () => {
  const repo = copyFixture('unmanaged');
  fs.rmSync(path.join(repo, '.claude/cafekit-manifest.json'));
  const plan = planManifestFiles(repo);
  assert.equal(plan.platforms.claude.status, 'unmanaged');
  assert.equal(ofPlatform(plan, 'claude').length, 0);
  assert.match(renderManifestPlan(plan), /Claude Code \(\.claude\/\): unmanaged/);
});

test('untracked-listed: user files in the platform folders are listed and kept', () => {
  const repo = copyFixture('untracked');
  fs.mkdirSync(path.join(repo, '.claude/skills/my-skill'));
  fs.writeFileSync(path.join(repo, '.claude/skills/my-skill/SKILL.md'), '---\nname: my-skill\n---\n');
  fs.writeFileSync(path.join(repo, '.claude/.env'), 'TOKEN=[redacted]\n');
  const plan = planManifestFiles(repo);
  assert.ok(plan.untracked.includes('.claude/skills/my-skill/'), plan.untracked.join(', '));
  assert.ok(plan.untracked.includes('.claude/.env'));
  assert.equal(byPath(plan).get('.claude/.gitignore').reason, 'protects-kept');
  assert.match(renderManifestPlan(plan), /\.claude\/skills\/my-skill\//);
});

test('writes-nothing: planning leaves the repository bytes unchanged', () => {
  const repo = copyFixture('readonly');
  const beforeHash = treeHash(repo);
  const plan = planManifestFiles(repo);
  renderManifestPlan(plan);
  assert.equal(treeHash(repo), beforeHash);
});
