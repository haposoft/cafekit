'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { test, before, after } = require('node:test');

const {
  convertCodexAgentContent,
  normalizeCodexBody,
} = require('../lib/codex-install');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
const OLD_FIXTURE_VERSION = '0.14.1';
const REQUIRED_PAYLOAD = [
  'bin/install.js',
  'src/claude/migration-manifest.json',
  'src/claude/scripts/scan-staged-secrets.cjs',
  'src/claude/scripts/workflow-policy.cjs',
  'src/claude/scripts/provenance.cjs',
  'src/claude/scripts/spec-receipt.cjs',
  'src/claude/scripts/generate-skill-catalog.cjs',
  'src/claude/rules/process-management.md',
  'src/claude/rules/review-audit-self-decision.md',
  'src/claude/rules/skill-domain-routing.md',
  'src/claude/rules/skill-workflow-routing.md',
  'src/claude/skills/orca/SKILL.md',
  'src/claude/skills/brainstorm/SKILL.md',
  'src/claude/skills/brainstorm/references/question-framework.md',
  'src/claude/agents/brainstormer.md',
  'src/claude/skills/research/SKILL.md',
  'src/claude/agents/researcher.md',
  'src/claude/skills/docs/SKILL.md',
  'src/claude/skills/docx/SKILL.md',
  'src/claude/skills/pdf/SKILL.md',
  'src/claude/skills/pptx/SKILL.md',
  'src/claude/skills/xlsx/SKILL.md',
  'src/claude/skills/ai-multimodal/SKILL.md',
];
const FORBIDDEN_PAYLOAD = [
  /(^|\/)\.logs(\/|$)/,
  /\.log$/,
  /\.coverage(?:\/|$)/,
  /__pycache__(?:\/|$)/,
  /\.pyc$/,
  /(^|\/)\.(?:cache|state|tmp)(\/|$)/,
  /^src\/\.codex(?:\/|$)/,
  /^src\/claude\/skills\/(?:backend-development|frontend-development|frontend-design|mobile-development|devops|react-best-practices)(?:\/|$)/,
];
const RUNTIMES = {
  claude: {
    root: '.claude',
    rules: '.claude/hooks/rules.cjs',
    manifest: '.claude/cafekit-manifest.json',
    templatesManifestPath: 'skills/specs/references/templates.md',
    templates: '.claude/skills/specs/references/templates.md',
  },
  codex: {
    root: '.codex',
    rules: '.codex/hooks/rules.cjs',
    manifest: '.codex/cafekit-manifest.json',
    templatesManifestPath: '.agents/skills/specs/references/templates.md',
    templates: '.agents/skills/specs/references/templates.md',
  },
};

// Contract files an installed project must carry byte-for-byte as the production projection of the
// source. scripts/run-skill-self-tests.mjs owns the wording contracts on these sources, so equality
// here proves the install carries exactly the bytes that runner checked.
const CORE_CONTRACT_SOURCES = [
  'skills/specs/SKILL.md',
  'agents/spec-maker.md',
  'skills/specs/references/templates.md',
  'skills/specs/references/review.md',
  'skills/brainstorm/SKILL.md',
  'skills/brainstorm/references/question-framework.md',
  'agents/brainstormer.md',
  'skills/research/SKILL.md',
  'agents/researcher.md',
  'rules/skill-workflow-routing.md',
  'rules/skill-domain-routing.md',
  'skills/fix/SKILL.md',
  'skills/fix/references/review-cycle.md',
  'skills/fix/references/parallel-patterns.md',
  'skills/fix/references/workflow-specialized.md',
];
const DOCS_CONTRACT_SOURCES = [
  'skills/docs/SKILL.md',
  'skills/docs/references/init-workflow.md',
  'skills/docs/references/update-workflow.md',
  'skills/docs/references/standard-docs-workflow.md',
];

function npmPack(args, cwd) {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-npm-pack-cache-'));
  try {
    const result = spawnSync('npm', ['pack', '--ignore-scripts', ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cache },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return JSON.parse(result.stdout)[0];
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
}

function packedInventory(tarball) {
  const result = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, '').replace(/\/$/, ''))
    .filter(Boolean)
    .sort();
}

function assertCleanInventory(inventory) {
  assert.deepEqual(inventory, [...inventory].sort(), 'package inventory must be sorted');
  assert.equal(new Set(inventory).size, inventory.length, 'package inventory must not contain duplicates');
  for (const required of REQUIRED_PAYLOAD) assert.ok(inventory.includes(required), `missing payload: ${required}`);
  for (const entry of inventory) {
    for (const pattern of FORBIDDEN_PAYLOAD) {
      assert.doesNotMatch(entry, pattern, `forbidden generated payload: ${entry}`);
    }
  }
}

function packageDirectory(name, from) {
  let directory = path.dirname(require.resolve(name, { paths: [from] }));
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (metadata.name === name) return { directory, metadata };
    }
    directory = path.dirname(directory);
  }
  throw new Error(`cannot resolve local runtime dependency ${name}`);
}

function packedRuntimeClosure(destination) {
  fs.mkdirSync(destination, { recursive: true });
  const rootManifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const queue = Object.keys(rootManifest.dependencies || {});
  const visited = new Set();
  const tarballs = [];
  while (queue.length > 0) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    const resolved = packageDirectory(name, PACKAGE_ROOT);
    const packed = npmPack(['--ignore-scripts', '--pack-destination', destination, '--json'], resolved.directory);
    tarballs.push(path.join(destination, packed.filename));
    queue.push(...Object.keys(resolved.metadata.dependencies || {}));
  }
  return tarballs.sort();
}

function installPacked(tarball, root, runtimeClosure) {
  fs.mkdirSync(root, { recursive: true });
  const result = spawnSync('npm', [
    'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    '--package-lock=false', '--prefix', root, tarball, ...runtimeClosure,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(root, '.cafekit-npm-cache') },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const installer = path.join(root, 'node_modules', '@haposoft', 'cafekit', 'bin', 'install.js');
  assert.ok(fs.existsSync(installer), 'npm install must resolve packed package bin');
  return installer;
}

function runInstaller(installer, root, platforms, lang, extraArgs = []) {
  const args = ['--platform', platforms.join(','), '--yes', ...extraArgs];
  if (lang) args.push('--lang', lang);
  const result = spawnSync(process.execPath, [installer, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(root, 'home'), PATH: '/usr/bin:/bin' },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result;
}

// One pack, one runtime closure, and one install per platform shared by every read-only test.
let shared;

before(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-package-matrix-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
  const tarball = path.join(destination, packed.filename);
  const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
  const installs = {};
  for (const [name, platforms, extra] of [
    ['claude', ['claude'], []],
    ['codex', ['codex'], []],
    ['docs', ['claude', 'codex'], ['--with-document-skills']],
  ]) {
    const project = path.join(root, name);
    const installer = installPacked(tarball, project, runtimeClosure);
    runInstaller(installer, project, platforms, null, extra);
    installs[name] = project;
  }
  shared = { root, tarball, runtimeClosure, installs };
});

after(() => {
  if (shared) fs.rmSync(shared.root, { recursive: true, force: true });
});

function installedRelative(platform, source) {
  const [kind, ...rest] = source.split('/');
  const tail = rest.join('/');
  if (platform === 'claude') return `.claude/${source}`;
  if (kind === 'skills') return `.agents/skills/${tail}`;
  if (kind === 'agents') return `.codex/agents/${tail.replace(/\.md$/, '.toml').replace(/-/g, '_')}`;
  return `.codex/${source}`;
}

function assertContractParity(project, platform, sources) {
  for (const source of sources) {
    const sourcePath = path.join(PACKAGE_ROOT, 'src/claude', source);
    const text = fs.readFileSync(sourcePath, 'utf8');
    let expected = text;
    if (platform === 'codex') {
      expected = source.startsWith('agents/')
        ? convertCodexAgentContent(text, path.basename(sourcePath))
        : normalizeCodexBody(text, sourcePath);
    }
    assert.equal(
      fs.readFileSync(path.join(project, installedRelative(platform, source)), 'utf8'),
      expected,
      `${platform} installed ${source} must equal its production projection`
    );
  }
}

function skillsRoot(project, platform) {
  return path.join(project, platform === 'codex' ? '.agents/skills' : '.claude/skills');
}

function assertSkillLayout(project, platform) {
  const skills = skillsRoot(project, platform);
  const manifest = JSON.parse(fs.readFileSync(path.join(project, RUNTIMES[platform].manifest), 'utf8'));
  const researchPrefix = platform === 'codex' ? '.agents/skills/research/' : 'skills/research/';
  const loopPrefix = platform === 'codex' ? '.agents/skills/loop/' : 'skills/loop/';
  const listed = Object.keys(manifest.files);
  assert.ok(listed.some((entry) => entry.startsWith(researchPrefix)), `${platform} manifest lists Research`);
  assert.equal(listed.some((entry) => entry.startsWith(loopPrefix)), false, `${platform} manifest lists Loop`);
  assert.equal(fs.existsSync(path.join(skills, 'fix', 'SKILL.md')), true, `${platform} installs Fix`);
  for (const retired of ['route', 'loop', 'autoresearch', 'hotfix', 'inspect', 'question']) {
    assert.equal(fs.existsSync(path.join(skills, retired)), false, `${platform} must not install ${retired}`);
  }
}

function assertCoreOnlyCatalog(project, platform) {
  const script = path.join(project, RUNTIMES[platform].root, 'scripts/generate-skill-catalog.cjs');
  const result = spawnSync(process.execPath, [script, '--json'], { cwd: project, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const ids = JSON.parse(result.stdout).skills.map((skill) => skill.public_id);
  assert.equal(ids.includes('cf:route'), false);
  assert.equal(ids.includes('cf:docs'), false, 'document skills install only with --with-document-skills');
}

// Routing rules are the only place the authority boundaries are pinned: a route never grants
// mutation or delivery authority, and the live catalog is evidence, not inventory.
function assertRoutingRuleBoundaries(project, platform) {
  const rules = path.join(project, RUNTIMES[platform].root, 'rules');
  const read = (name) => fs.readFileSync(path.join(rules, name), 'utf8').replace(/\s+/g, ' ');
  const workflow = read('skill-workflow-routing.md');
  const domain = read('skill-domain-routing.md');
  const required = [
    [workflow, 'If the user names a valid installed skill, use it directly'],
    [workflow, 'If one obvious low-risk installed skill covers the intent, use it directly'],
    [workflow, 'do not spawn agents for ceremony'],
    [workflow, 'Resolve every abstract link against the current runtime catalog'],
    [workflow, 'Diagnosis does not authorize repair'],
    [workflow, 'implementation does not authorize commit, push, deploy, publish, or release'],
    [workflow, "no route expands the user's existing authority"],
    [domain, 'examples below are intent hints, not a copied installed inventory'],
    [domain, 'use only a matching installed optional capability'],
    [domain, 'Never infer an optional document capability from this rule'],
    [domain, 'do not auto-route; require explicit user disambiguation'],
  ];
  for (const [text, clause] of required) assert.ok(text.includes(clause), `${platform} routing rule lost: ${clause}`);
  const corpus = `${workflow} ${domain}`.toLowerCase();
  assert.doesNotMatch(corpus, /successful review permits push|implementation authorizes (?:push|deploy)|diagnosis authorizes repair/);
  assert.doesNotMatch(corpus, /(?<!no )(?:live catalog|route)(?:(?!\b(?:never|not|cannot|can't)\b).){0,40}(?:grants|expands)(?:(?!\b(?:no|never|not|cannot|can't)\b).){0,30}(?:mutation|delivery|user )?authority/);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

// A pristine old-version file is upgraded in place; a user-modified one is preserved untouched.
function assertPristineUpgradeAndUserPreservation(installer, project, platform) {
  const runtime = RUNTIMES[platform];
  const templatesPath = path.join(project, runtime.templates);
  const manifestPath = path.join(project, runtime.manifest);
  const metadataPath = path.join(project, runtime.root, 'cafekit.json');
  const baseline = fs.readFileSync(templatesPath, 'utf8');
  const edited = `${baseline}\n<!-- local edit -->\n`;
  try {
    fs.writeFileSync(templatesPath, edited);
    const oldManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(oldManifest.files[runtime.templatesManifestPath], `${platform} templates ownership record missing`);
    oldManifest.files[runtime.templatesManifestPath] = {
      ...oldManifest.files[runtime.templatesManifestPath], sha256: sha256(edited), version: OLD_FIXTURE_VERSION,
    };
    writeJson(manifestPath, oldManifest);
    const oldMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    oldMetadata.version = OLD_FIXTURE_VERSION;
    writeJson(metadataPath, oldMetadata);

    runInstaller(installer, project, [platform], null);
    assert.equal(fs.readFileSync(templatesPath, 'utf8'), baseline, `${platform} pristine old file must upgrade`);
    assert.equal(JSON.parse(fs.readFileSync(metadataPath, 'utf8')).version, PACKAGE_VERSION);
    const upgraded = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files[runtime.templatesManifestPath];
    assert.equal(upgraded.sha256, sha256(baseline));
    assert.equal(upgraded.version, PACKAGE_VERSION);

    fs.writeFileSync(templatesPath, edited);
    const manifestBefore = fs.readFileSync(manifestPath, 'utf8');
    const preserved = runInstaller(installer, project, [platform], null);
    assert.equal(fs.readFileSync(templatesPath, 'utf8'), edited, `${platform} user edit must be preserved`);
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestBefore, `${platform} user-modified manifest must stay unchanged`);
    assert.match(`${preserved.stdout}\n${preserved.stderr}`, /preserved \(user-modified\): Skill: specs/);
  } finally {
    fs.writeFileSync(templatesPath, baseline);
  }
}

function createProvenanceFixture(root) {
  const feature = 'installer-provenance';
  const specFile = path.join('specs', feature, 'spec.json');
  fs.mkdirSync(path.join(root, path.dirname(specFile)), { recursive: true });
  fs.writeFileSync(
    path.join(root, specFile),
    JSON.stringify({ feature_name: feature, status: 'in_progress' }) + '\n'
  );
  fs.writeFileSync(path.join(root, 'tracked-fixture.txt'), 'tracked fixture\n');

  for (const args of [
    ['init', '-q'],
    ['add', '--', 'tracked-fixture.txt', specFile],
    ['-c', 'user.name=CafeKit Fixture', '-c', 'user.email=cafekit-fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'provenance fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }

  return {
    specsRoot: 'specs',
    specFile,
    feature,
    session: `package-${path.basename(root)}`,
  };
}

function assertInstalledProvenance(root, platform, fixture) {
  const scripts = path.join(root, RUNTIMES[platform].root, 'scripts');
  const helper = path.join(scripts, 'provenance.cjs');
  const policy = path.join(scripts, 'workflow-policy.cjs');
  for (const file of [helper, policy, path.join(scripts, 'spec-resolver.cjs'), path.join(scripts, 'spec-receipt.cjs'),
    path.join(root, RUNTIMES[platform].root, 'hooks/spec-gate.cjs')]) {
    assert.equal(fs.existsSync(file), true, `${platform} installed file missing: ${file}`);
  }

  const helperRun = spawnSync(process.execPath, [
    helper, '--json', '--project-root', root, '--specs-root', fixture.specsRoot,
    '--spec-file', fixture.specFile, '--feature-name', fixture.feature, '--session', fixture.session,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(helperRun.status, 0, `${helperRun.stdout}\n${helperRun.stderr}`);
  const output = JSON.parse(helperRun.stdout);
  assert.equal(output.ok, true);
  assert.match(output.Base, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  assert.match(output.Head, /^[a-f0-9]{64}$/);
  assert.match(output.context_id, /^[a-f0-9]{64}$/);
  assert.equal(output.context.runtime_session, fixture.session);

  const policyLoad = spawnSync(process.execPath, [policy, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(policyLoad.status, 0, `${policyLoad.stdout}\n${policyLoad.stderr}`);
  assert.equal(JSON.parse(policyLoad.stdout).ok, true);
}

function managedBlock(content, start, end) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing managed block: ${start}`);
  return content.slice(startIndex + start.length, endIndex);
}

function assertCombinedInstructionIsolation(root) {
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const claude = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  const core = managedBlock(agents, '<!-- CAFEKIT CORE START -->', '<!-- CAFEKIT CORE END -->');
  const claudeBlock = managedBlock(claude, '<!-- CAFEKIT CLAUDE START -->', '<!-- CAFEKIT CLAUDE END -->');
  const codexBlock = managedBlock(agents, '<!-- CAFEKIT CODEX START -->', '<!-- CAFEKIT CODEX END -->');

  for (const [content, marker] of [
    [agents, '<!-- CAFEKIT CORE START -->'],
    [agents, '<!-- CAFEKIT CODEX START -->'],
    [claude, '<!-- CAFEKIT CLAUDE START -->'],
  ]) assert.equal((content.match(new RegExp(marker, 'g')) || []).length, 1);

  assert.doesNotMatch(core, /Claude|Codex|\.claude|\.codex|\/cf:|\$cf-/i);
  assert.doesNotMatch(claudeBlock, /Codex|\.codex|\$cf-|<!-- CAFEKIT CODEX /i);
  assert.match(codexBlock, /If you are Claude Code or any other runtime, ignore this entire Codex block/i);
  assert.doesNotMatch(codexBlock, /If you are Codex CLI or any other runtime, ignore this entire Codex block/i);
}

function stableInstallSnapshot(root, platforms) {
  const files = ['AGENTS.md', 'CLAUDE.md', '.gitignore'];
  for (const platform of platforms) files.push(RUNTIMES[platform].root);
  const snapshot = {};
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) continue;
    const walk = (current, relative = '') => {
      const stat = fs.lstatSync(current);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(current).sort()) walk(path.join(current, entry), path.join(relative, entry));
      } else if (path.basename(current) === 'cafekit.json') {
        const metadata = JSON.parse(fs.readFileSync(current, 'utf8'));
        delete metadata.lastInstalledAt;
        snapshot[path.join(file, relative)] = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`);
      } else {
        snapshot[path.join(file, relative)] = fs.readFileSync(current);
      }
    };
    walk(absolute);
  }
  return snapshot;
}

function assertHookLanguage(root, platform, lang, sessionId) {
  const runtime = RUNTIMES[platform];
  const runtimeJson = JSON.parse(fs.readFileSync(path.join(root, runtime.root, 'runtime.json'), 'utf8'));
  assert.equal(runtimeJson.locale.responseLanguage, lang || null);
  const rulesPath = path.join(root, runtime.rules);
  assert.ok(fs.existsSync(rulesPath), `installed rules path missing: ${rulesPath}`);
  const result = spawnSync(process.execPath, [rulesPath], {
    cwd: root,
    input: JSON.stringify({ cwd: root, session_id: sessionId }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  if (lang) assert.match(result.stdout, /Respond in vi/);
  else assert.doesNotMatch(result.stdout, /Respond in/);
}

function assertInstalledScripts(root, platform) {
  const scripts = path.join(root, RUNTIMES[platform].root, 'scripts');
  const policy = path.join(scripts, 'workflow-policy.cjs');
  const scanner = path.join(scripts, 'scan-staged-secrets.cjs');
  assert.ok(fs.existsSync(policy), `installed policy missing: ${policy}`);
  assert.ok(fs.existsSync(scanner), `installed scanner missing: ${scanner}`);

  const policyRun = spawnSync(process.execPath, [policy, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(policyRun.status, 0, `${policyRun.stdout}\n${policyRun.stderr}`);
  assert.equal(JSON.parse(policyRun.stdout).contract, 'execution-policy');

  fs.writeFileSync(path.join(root, 'safe.txt'), 'mode=safe\n');
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['add', 'safe.txt'], { cwd: root });
  const scannerRun = spawnSync(process.execPath, [scanner], { cwd: root, encoding: 'utf8' });
  assert.equal(scannerRun.status, 0, `${scannerRun.stdout}\n${scannerRun.stderr}`);
  assert.match(scannerRun.stdout, /No staged secrets found/);
}

// Codex rewrites public command syntax; Claude keeps it.
function assertTransforms(root, platform) {
  const skills = skillsRoot(root, platform);
  const develop = fs.readFileSync(path.join(skills, 'develop', 'SKILL.md'), 'utf8');
  const scout = fs.readFileSync(path.join(skills, 'scout', 'SKILL.md'), 'utf8');
  if (platform === 'codex') {
    assert.match(develop, /\$cf-develop/);
    assert.doesNotMatch(develop, /\/cf:develop/);
    assert.match(scout, /^name:\s*cf-scout$/m);
  } else {
    assert.match(develop, /\/cf:develop/);
    assert.match(scout, /^name:\s*cf:scout$/m);
  }
}

test('npm pack inventory is deterministic and preserves runtime payload', () => {
  const first = npmPack(['--dry-run', '--json'], PACKAGE_ROOT);
  const second = npmPack(['--dry-run', '--json'], PACKAGE_ROOT);
  const firstInventory = first.files.map(({ path: filePath }) => filePath).sort();
  assert.deepEqual(firstInventory, second.files.map(({ path: filePath }) => filePath).sort());
  assertCleanInventory(firstInventory);
  assertCleanInventory(packedInventory(shared.tarball));
});

test('packed core installs carry the contract files byte-for-byte and no retired capability', () => {
  for (const platform of ['claude', 'codex']) {
    const project = shared.installs[platform];
    assertContractParity(project, platform, CORE_CONTRACT_SOURCES);
    assertSkillLayout(project, platform);
    assertCoreOnlyCatalog(project, platform);
    assertRoutingRuleBoundaries(project, platform);
  }
  const domain = fs.readFileSync(path.join(shared.installs.claude, '.claude/rules/skill-domain-routing.md'), 'utf8');
  assert.doesNotMatch(domain, /\/cf:(?:docs|docx|pdf|pptx|xlsx|ai-multimodal)/);
});

test('packed document-skill installs carry the Docs contract files byte-for-byte', () => {
  for (const platform of ['claude', 'codex']) {
    assertContractParity(shared.installs.docs, platform, DOCS_CONTRACT_SOURCES);
  }
});

test('install matrix keeps language, scripts, transforms, idempotence, isolation, and upgrade behavior', () => {
  const cases = [
    { name: 'claude', platforms: ['claude'] },
    { name: 'codex', platforms: ['codex'] },
    { name: 'combined', platforms: ['claude', 'codex'] },
    { name: 'combined-rerun', platforms: ['claude', 'codex'], rerun: true },
  ];
  for (const matrixCase of cases) {
    for (const lang of [null, 'vi']) {
      const project = path.join(shared.root, `${matrixCase.name}-${lang ? 'lang-vi' : 'no-lang'}`);
      const installer = installPacked(shared.tarball, project, shared.runtimeClosure);
      runInstaller(installer, project, matrixCase.platforms, lang);
      for (const platform of matrixCase.platforms) {
        assertHookLanguage(project, platform, lang, `${project}-${matrixCase.name}-${lang || 'none'}`);
        assertInstalledScripts(project, platform);
        assertTransforms(project, platform);
        if (matrixCase.platforms.length === 1 && lang === null) {
          assertPristineUpgradeAndUserPreservation(installer, project, platform);
        }
      }
      if (matrixCase.platforms.length === 2) assertCombinedInstructionIsolation(project);
      if (matrixCase.rerun) {
        fs.appendFileSync(path.join(project, 'AGENTS.md'), '\n## User matrix note\nKeep this exact.\n');
        fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\n## User Claude matrix note\nKeep this exact.\n');
        const before = stableInstallSnapshot(project, matrixCase.platforms);
        runInstaller(installer, project, matrixCase.platforms, lang);
        const after = stableInstallSnapshot(project, matrixCase.platforms);
        const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter((file) => !before[file] || !after[file] || !before[file].equals(after[file]));
        assert.deepEqual(changed, [], `${matrixCase.name} rerun must be byte-idempotent`);
        assertCombinedInstructionIsolation(project);
        assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /User matrix note\nKeep this exact\./);
        assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /User Claude matrix note\nKeep this exact\./);
      }
    }
  }
});

test('repository and package guides name the current skills and no retired ones', () => {
  const guides = {
    repository: fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../README.md'), 'utf8'),
    package: fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  };
  for (const [name, guide] of Object.entries(guides)) {
    for (const required of [/cf:research/, /\$cf-research/, /cf:fix/, /cf:docs/, /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/]) {
      assert.match(guide, required, `${name} names ${required}`);
    }
    assert.doesNotMatch(guide, /cf[:-](?:loop|autoresearch|hotfix)/, `${name} advertises a retired skill`);
  }
  for (const guide of [
    fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../docs/specs-usage-guide.md'), 'utf8'),
    guides.package,
  ]) {
    for (const flag of ['--deep', '--visual', '--advice']) assert.ok(guide.includes(flag), `guide documents ${flag}`);
  }
});

test('packed installs self-contain runtime provenance and fail closed without it', () => {
  for (const platform of ['claude', 'codex']) {
    const project = path.join(shared.root, `provenance-${platform}`);
    const installer = installPacked(shared.tarball, project, shared.runtimeClosure);
    runInstaller(installer, project, [platform], null);

    const packedSource = path.resolve(path.dirname(installer), '..', 'src');
    fs.rmSync(packedSource, { recursive: true, force: true });
    assert.equal(fs.existsSync(packedSource), false, 'installed gate must not need package source fallback');

    assertInstalledProvenance(project, platform, createProvenanceFixture(project));
  }
});
