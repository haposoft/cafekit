'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, before, after } = require('node:test');

const {
  convertCodexAgentContent,
  normalizeCodexBody,
  transformManagedCodexContent,
  upsertManagedCodexBlock
} = require('../lib/codex-install');
const { createTracker } = require('../lib/manifest');
const { checkVersions } = require('../lib/version-check');
const {
  resolvePlatforms,
  selectLanguage
} = require('../phases/select-platform');
const { MESSAGES } = require('../lib/i18n');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')
).version;
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SPEC_MAKER_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/agents/spec-maker.md');
const SPECS_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/specs');
const DEVELOP_BUNDLE = [
  'SKILL.md',
  'references/quality-gate.md',
  'references/parallel-waves.md',
  'references/subagent-patterns.md'
];
const TEST_BUNDLE = [
  'SKILL.md',
  'references/execution-strategy.md',
  'references/failure-triage.md',
  'references/test-memory.md'
];
const DEBUG_REFERENCE_FILES = [
  'core-philosophy.md',
  'root-cause-tracing.md',
  'verification-protocol.md',
  'log-ci-analysis.md',
  'parallel-agent-hydration.md',
  'side-effect-gate.md'
];
const V3_SPECS_BUNDLE = [
  'SKILL.md',
  'references/review.md',
  'references/templates.md',
  'templates/research.md'
];
const OBSOLETE_SPECS_FILES = [
  'references/archive-workflow.md',
  'references/ask-user-question-gates.md',
  'references/codebase-analysis.md',
  'references/cross-spec-dependency.md',
  'references/research-strategy.md',
  'references/scope-inquiry.md',
  'references/translation-mirror.md',
  'rules/design-discovery-full.md',
  'rules/design-discovery-light.md',
  'rules/design-principles.md',
  'rules/design-review.md',
  'rules/ears-format.md',
  'rules/phase-decision-matrix.md',
  'rules/task-scoring-rubric.md',
  'rules/tasks-generation.md'
];

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-native-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', 'codex', '--yes', ...extraArgs],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: '/usr/bin:/bin' }
    }
  );
}

function installPlatforms(root, platforms, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', platforms.join(','), '--yes', ...extraArgs],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
  );
}

function installedCatalog(root, runtime) {
  const script = path.join(root, runtime === 'codex' ? '.codex' : '.claude', 'scripts', 'generate-skill-catalog.cjs');
  const result = spawnSync(process.execPath, [script, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function allFiles(root, predicate) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...allFiles(target, predicate));
    else if (predicate(target)) found.push(target);
  }
  return found;
}

function allHookLaunchers(config) {
  return Object.entries(config.hooks).flatMap(([event, groups]) => (
    groups.flatMap((group) => group.hooks.map((handler) => ({ event, handler })))
  ));
}

function parseGeneratedTomlString(content, key) {
  const match = content.match(new RegExp(`^${key} = (.+)$`, 'm'));
  assert.ok(match, `missing TOML key: ${key}`);
  return JSON.parse(match[1]);
}

// Read-only tests share one Codex install and one Claude+Codex install; tests that mutate or
// reinstall build their own project.
let sharedRoot;
let codexProject;
let bothProject;

before(() => {
  sharedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-native-shared-'));
  codexProject = path.join(sharedRoot, 'codex');
  bothProject = path.join(sharedRoot, 'both');
  for (const [project, platforms] of [[codexProject, ['codex']], [bothProject, ['claude', 'codex']]]) {
    fs.mkdirSync(project, { recursive: true });
    const result = installPlatforms(project, platforms);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
});

after(() => {
  if (sharedRoot) fs.rmSync(sharedRoot, { recursive: true, force: true });
});

function readSource(relative) {
  const sourcePath = path.join(PACKAGE_ROOT, 'src/claude', relative);
  return { sourcePath, text: fs.readFileSync(sourcePath, 'utf8') };
}

function assertSkillBundleProjection(project, skill, bundle) {
  for (const relative of bundle) {
    const { sourcePath, text } = readSource(`skills/${skill}/${relative}`);
    assert.equal(
      fs.readFileSync(path.join(project, '.agents/skills', skill, relative), 'utf8'),
      normalizeCodexBody(text, sourcePath),
      `Codex ${skill} projection drifted: ${relative}`
    );
  }
}

function readInstalledAgent(project, name) {
  const toml = fs.readFileSync(path.join(project, '.codex/agents', `${name}.toml`), 'utf8');
  const { text } = readSource(`agents/${name.replace(/_/g, '-')}.md`);
  assert.equal(toml, convertCodexAgentContent(text, `${name.replace(/_/g, '-')}.md`), `Codex ${name} projection drifted`);
  return parseGeneratedTomlString(toml, 'developer_instructions');
}

test('installed Codex instructions reference all ten runtime rules', () => {
  const instructions = fs.readFileSync(path.join(codexProject, 'AGENTS.md'), 'utf8');
  const rules = ['workflow', 'ai-dev-rules', 'orchestrator', 'manage-docs', 'skill-workflow-routing', 'skill-domain-routing', 'review-audit-self-decision', 'process-management', 'state-sync', 'hook-protocols'];
  for (const rule of rules) {
    assert.ok(instructions.includes(`.codex/rules/${rule}.md`), rule);
    assert.ok(fs.existsSync(path.join(codexProject, '.codex/rules', `${rule}.md`)), rule);
  }
});

test('installed Codex orchestrator describes high reasoning on the session model', () => {
  const content = fs.readFileSync(path.join(codexProject, '.codex/rules/orchestrator.md'), 'utf8');
  assert.doesNotMatch(content, /strongest|below[^\n]*fable/);
  assert.match(content, /high reasoning effort/);
  assert.match(content, /session model unless[^.]*configur/i);
});

test('installed hook protocols share malformed-output handling and Codex receipt guidance', () => {
  for (const runtime of ['.claude', '.codex']) {
    const content = fs.readFileSync(path.join(bothProject, runtime, 'rules/hook-protocols.md'), 'utf8');
    assert.ok(content.includes('If hook output is malformed, stop and report the exact failure'), runtime);
  }
  assert.match(fs.readFileSync(path.join(bothProject, '.codex/rules/hook-protocols.md'), 'utf8'), /state-sync\.md/);
});

test('installed Claude ignore rules preserve env samples and ignore temporary files', () => {
  const lines = fs.readFileSync(path.join(bothProject, '.claude/.gitignore'), 'utf8').split(/\r?\n/);
  for (const line of ['!.env.sample', '!.env.template', '*.tmp']) assert.ok(lines.includes(line), line);
});

const READ_ONLY_ROLE_SUFFIX = '\n\n## Read-only role\n\nRead-only role: never create, never edit, and never delete files, and never run commands that write to disk; return findings in your reply.';

function assertInstalledAgentFields(content, name) {
  const source = fs.readFileSync(path.join(PACKAGE_ROOT, 'src/claude/agents', `${name.replace(/_/g, '-')}.md`), 'utf8');
  const { frontmatter, body } = require('../lib/codex-frontmatter').splitFrontmatter(source);
  for (const key of ['name', 'description', 'developer_instructions']) {
    assert.equal((content.match(new RegExp(`^${key} =`, 'gm')) || []).length, 1);
  }
  assert.equal(parseGeneratedTomlString(content, 'name'), name);
  assert.equal(parseGeneratedTomlString(content, 'description'), normalizeCodexBody(frontmatter.description));
  const suffix = ['brainstormer', 'code_auditor', 'inspector', 'researcher'].includes(name)
    ? READ_ONLY_ROLE_SUFFIX : '';
  const expectedBody = name === 'git_ops'
    ? body.slice(0, body.indexOf('When instantiated as a team member'))
      + body.split('\n').find(line => line.includes('NEVER arbitrarily use `force push`')).replace(/^3\. /, '- ') + '\n'
    : body;
  assert.equal(parseGeneratedTomlString(content, 'developer_instructions'), normalizeCodexBody(expectedBody).trim() + suffix);
}

test('installed read-only agents carry exactly one read-only sandbox; implementation agents keep defaults', () => {
  const agents = path.join(codexProject, '.codex/agents');
  for (const name of ['brainstormer', 'code_auditor', 'inspector', 'researcher']) {
    const content = fs.readFileSync(path.join(agents, `${name}.toml`), 'utf8');
    assert.deepEqual(content.match(/^sandbox_mode\s*=.*$/gm) || [], ['sandbox_mode = "read-only"'], name);
    assert.ok(parseGeneratedTomlString(content, 'developer_instructions').endsWith(READ_ONLY_ROLE_SUFFIX), name);
    assertInstalledAgentFields(content, name);
  }
  for (const name of ['implementer', 'test_runner', 'debugger', 'git_ops']) {
    const content = fs.readFileSync(path.join(agents, `${name}.toml`), 'utf8');
    assert.doesNotMatch(content, /^sandbox_mode\s*=/m, name);
    assert.doesNotMatch(parseGeneratedTomlString(content, 'developer_instructions'), /## Read-only role/, name);
    assertInstalledAgentFields(content, name);
  }
  const auditor = fs.readFileSync(path.join(agents, 'code_auditor.toml'), 'utf8');
  assert.doesNotMatch(auditor, /CAFEKIT_SEMANTIC_REVIEW_ATTESTATION|Strict Semantic Review Attestation|MAC-protected host-hook observation/);
});

// Wording contracts for Specs, Brainstorm, Research, Fix, and Docs are owned by the skill self-test
// runner and the packed-install parity in package-inventory.test.js; this checks the Codex-only layout.
test('Codex installed Specs tree is exactly the supported bundle and spec_maker matches its source', () => {
  const installedRoot = path.join(codexProject, '.agents/skills/specs');
  const relativeFiles = (directory) => allFiles(directory, () => true)
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(relativeFiles(SPECS_SOURCE_ROOT), V3_SPECS_BUNDLE);
  assert.deepEqual(relativeFiles(installedRoot), V3_SPECS_BUNDLE);
  assertSkillBundleProjection(codexProject, 'specs', V3_SPECS_BUNDLE);
  for (const relative of OBSOLETE_SPECS_FILES) {
    assert.equal(fs.existsSync(path.join(installedRoot, relative)), false, `obsolete Specs file installed: ${relative}`);
  }
  readInstalledAgent(codexProject, 'spec_maker');
});

// The self-test runner pins this exact test name.
test('Codex installed Develop preserves plan-native execution and references', () => {
  assertSkillBundleProjection(codexProject, 'develop', DEVELOP_BUNDLE);
  const develop = fs.readFileSync(path.join(codexProject, '.agents/skills/develop/SKILL.md'), 'utf8');
  assert.match(develop, /\$cf-develop <feature>/);
  assert.match(develop, /\.codex\/scripts\/workflow-policy\.cjs/);
  assert.doesNotMatch(develop, /\/cf:develop|\.claude\/scripts/);
  assert.equal(fs.existsSync(path.join(codexProject, '.claude/skills/develop')), false);
});

test('Codex installed Test, Debug, and Code-review keep plan-native contracts', () => {
  const project = codexProject;
  assertSkillBundleProjection(project, 'test', TEST_BUNDLE);
  const test = fs.readFileSync(path.join(project, '.agents/skills/test/SKILL.md'), 'utf8');
  assert.match(test, /\$cf-test/);
  assert.match(test, /test-proof-v1/);
  assert.doesNotMatch(test, /\/cf:test/);
  const runner = readInstalledAgent(project, 'test_runner');
  assert.match(runner, /test-proof-v1/);
  assert.match(runner, /sole writer of[\s\S]*Status and inline Receipt/i);

  assertSkillBundleProjection(project, 'code-review', ['SKILL.md']);
  const review = fs.readFileSync(path.join(project, '.agents/skills/code-review/SKILL.md'), 'utf8');
  assert.match(review, /controller-validated `test-proof-v1`/);
  assert.match(review, /Never create or search for a separate[\s\S]*process-first receipt/i);

  const debug = fs.readFileSync(path.join(project, '.agents/skills/debug/SKILL.md'), 'utf8');
  assert.match(debug, /^name: cf-debug$/m);
  assert.match(debug, /`cf-debug` is read-only for product code/);
  assert.match(readInstalledAgent(project, 'debugger'), /Never implement the repair/);
  for (const relative of DEBUG_REFERENCE_FILES) {
    const { text } = readSource(`references/debugger/${relative}`);
    assert.equal(
      fs.readFileSync(path.join(project, '.codex/references/debugger', relative), 'utf8'),
      normalizeCodexBody(text, relative),
      relative
    );
  }
  assert.equal(fs.existsSync(path.join(project, '.claude/skills/test')), false);
});


test('Codex payload transform emits native skill and subagent syntax', () => {
  const transformed = normalizeCodexBody(
    'Agent(subagent_type="implementer", prompt="Implement it", description="Code Feature")\n' +
    'Use `/specs auth`, `SendMessage`, `Bash`, `Read`, and `Edit`.'
  );

  assert.match(
    transformed,
    /spawn_agent\(agent_type="implementer", fork_turns="none", message="Implement it", task_name="code_feature"\)/
  );
  assert.match(transformed, /\$cf-specs auth/);
  assert.match(transformed, /`send_message`/);
  assert.match(transformed, /`exec_command`/);
  assert.match(transformed, /`apply_patch`/);
  assert.doesNotMatch(transformed, /Agent\(|subagent_type|\/specs\b|Claude Code/);
});

test('Codex payload transform keeps structured user-input grammar across determiners', () => {
  const cases = [
    ['standalone bare token', 'AskUserQuestion', 'a question in the turn\'s final answer'],
    ['standalone code token', '`AskUserQuestion`', 'a question in the turn\'s final answer'],
    ['standalone multi-backtick token', '``AskUserQuestion``', 'a question in the turn\'s final answer'],
    ['standalone padded multi-backtick token', '`` AskUserQuestion ``', 'a question in the turn\'s final answer'],
    ['one', 'one AskUserQuestion call', 'one question in the turn\'s final answer call'],
    ['one multi-backtick', 'one ``AskUserQuestion`` call', 'one question in the turn\'s final answer call'],
    ['one padded multi-backtick', 'one `` AskUserQuestion `` call', 'one question in the turn\'s final answer call'],
    ['each', 'each AskUserQuestion call', 'each question in the turn\'s final answer call'],
    ['every', 'every AskUserQuestion batch', 'every question in the turn\'s final answer batch'],
    ['another', 'another AskUserQuestion call', 'another question in the turn\'s final answer call'],
    ['this', 'this AskUserQuestion call', 'this question in the turn\'s final answer call'],
    ['that', 'that AskUserQuestion call', 'that question in the turn\'s final answer call'],
    ['a', 'a AskUserQuestion call', 'a question in the turn\'s final answer call'],
    ['an', 'an AskUserQuestion call', 'a question in the turn\'s final answer call'],
    ['capitalized each', 'Each AskUserQuestion call', 'Each question in the turn\'s final answer call'],
    ['capitalized an', 'An AskUserQuestion call', 'A question in the turn\'s final answer call'],
    ['the', 'the AskUserQuestion call', 'the question in the turn\'s final answer call'],
    ['numeric', '27 AskUserQuestion calls', '27 question in the turn\'s final answer calls'],
    ['plural calls', 'AskUserQuestion calls', 'question in the turn\'s final answer calls'],
    ['plural batches', 'AskUserQuestion batches', 'question in the turn\'s final answer batches']
  ];

  for (const [name, input, expected] of cases) {
    const actual = normalizeCodexBody(input, '/fixture/instructions.md');
    assert.equal(actual, expected, name);
    assert.equal(normalizeCodexBody(actual, '/fixture/instructions.md'), expected, `${name} idempotence`);
    assert.doesNotMatch(actual, /\bAskUserQuestion\b/, `${name} Claude-only token`);
    assert.doesNotMatch(actual, /\ban question in the turn\'s final answer\b/i, `${name} incompatible article`);
    assert.doesNotMatch(
      actual,
      /\b(?:a|an|one|each|every|another|this|that|the|[0-9]+)\s+a question in the turn\'s final answer\b/i,
      `${name} doubled article`
    );
  }

  assert.equal(
    normalizeCodexBody('one\nAskUserQuestion call', '/fixture/instructions.md'),
    'one\nquestion in the turn\'s final answer call',
    'a single Markdown soft break must preserve its determiner relationship'
  );
  assert.equal(
    normalizeCodexBody('AskUserQuestion\nCalls', '/fixture/instructions.md'),
    'question in the turn\'s final answer\nCalls',
    'a single Markdown soft break must preserve a plural relationship'
  );
  assert.equal(
    normalizeCodexBody('one\n\nAskUserQuestion call', '/fixture/instructions.md'),
    'one\n\na question in the turn\'s final answer call',
    'a paragraph break must not bind a prior determiner'
  );
  assert.equal(
    normalizeCodexBody('MyAskUserQuestionHelper AskUserQuestionFactory', '/fixture/instructions.md'),
    'MyAskUserQuestionHelper AskUserQuestionFactory',
    'balanced token matching must preserve identifiers'
  );
  assert.equal(
    normalizeCodexBody('[tool](https://example.test/AskUserQuestion)', '/fixture/instructions.md'),
    '[tool](https://example.test/AskUserQuestion)',
    'Markdown link destinations must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('https://example.test/AskUserQuestion', '/fixture/instructions.md'),
    'https://example.test/AskUserQuestion',
    'raw URL tokens must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('one ``AskUserQuestion``` call', '/fixture/instructions.md'),
    'one ``AskUserQuestion``` call',
    'mismatched backtick runs must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('``Use AskUserQuestion here``', '/fixture/instructions.md'),
    '``Use AskUserQuestion here``',
    'non-token code spans must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('```js\nAskUserQuestion\n````', '/fixture/instructions.md'),
    '```js\nAskUserQuestion\n````',
    'a longer closing backtick fence must protect its body'
  );
  assert.equal(
    normalizeCodexBody('~~~text\nAskUserQuestion\n~~~~', '/fixture/instructions.md'),
    '~~~text\nAskUserQuestion\n~~~~',
    'a longer closing tilde fence must protect its body'
  );
  const markerCollision = '\uE000CAFEKIT_0_ASK_999\uE001';
  assert.equal(
    normalizeCodexBody(markerCollision, '/fixture/instructions.md'),
    markerCollision,
    'literal internal-marker-shaped input must stay byte-exact'
  );
  const codeMarkerCollision = '\uE000CAFEKIT_0_CODE_0\uE001 and ``not token``';
  assert.equal(
    normalizeCodexBody(codeMarkerCollision, '/fixture/instructions.md'),
    codeMarkerCollision,
    'mask restoration must not replace a literal marker-shaped prefix'
  );
  assert.equal(
    normalizeCodexBody('one AskUserQuestion call', '/fixture/session.cjs'),
    'one AskUserQuestion call',
    'non-instruction assets must preserve executable text'
  );
  assert.equal(
    normalizeCodexBody('No structured input token here.', '/fixture/instructions.md'),
    'No structured input token here.',
    'token-free instruction text must stay byte-exact'
  );
});

test('Codex structured-input corpus oracle stays differential and production-aware', () => {
  const sourceRoot = path.join(PACKAGE_ROOT, 'src/claude');
  const occurrenceFiles = allFiles(sourceRoot, (file) => /\.(?:md|mdx|txt|cjs|js)$/i.test(file))
    .filter((file) => fs.readFileSync(file, 'utf8').includes('AskUserQuestion'));
  const relative = (file) => path.relative(PACKAGE_ROOT, file).split(path.sep).join('/');
  const actualPaths = occurrenceFiles.map(relative).sort();
  const expectedPaths = [
    'src/claude/agents/spec-maker.md',
    'src/claude/hooks/session.cjs',
    'src/claude/skills/git/SKILL.md',
    'src/claude/skills/scout/SKILL.md',
    'src/claude/skills/sync/references/rebind-and-audit.md'
  ];
  assert.deepEqual(actualPaths, expectedPaths, 'every source occurrence needs an explicit projection oracle');

  const instructionExpectedSnippets = new Map([
    ['src/claude/skills/git/SKILL.md', 'Present options via a question in the turn\'s final answer — header'],
    ['src/claude/skills/scout/SKILL.md', '**Fallback to a question in the turn\'s final answer:**'],
    ['src/claude/skills/sync/references/rebind-and-audit.md', 'End by asking with a question in the turn\'s final answer when the host has']
  ]);
  for (const [relativePath, expectedSnippet] of instructionExpectedSnippets) {
    const sourcePath = path.join(PACKAGE_ROOT, relativePath);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const sentinel = '__CAFEKIT_STRUCTURED_INPUT_SENTINEL__';
    const withSentinel = source.replace(/`?\bAskUserQuestion\b`?/g, sentinel);
    assert.notEqual(withSentinel, source, `${relativePath} differential control must replace a token`);
    const expected = normalizeCodexBody(withSentinel, sourcePath)
      .replaceAll(sentinel, 'a question in the turn\'s final answer');
    const actual = normalizeCodexBody(source, sourcePath);
    assert.equal(actual, expected, `${relativePath} independent differential oracle`);
    assert.match(actual, new RegExp(expectedSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const specMaker = fs.readFileSync(SPEC_MAKER_SOURCE_PATH, 'utf8');
  const convertedAgent = convertCodexAgentContent(specMaker, path.basename(SPEC_MAKER_SOURCE_PATH));
  assert.doesNotMatch(convertedAgent, /\bAskUserQuestion\b/);
  assert.doesNotMatch(convertedAgent, /question in the turn\'s final answer/);

  const sessionPath = path.join(PACKAGE_ROOT, 'src/claude/hooks/session.cjs');
  const session = normalizeCodexBody(fs.readFileSync(sessionPath, 'utf8'), sessionPath);
  assert.equal((session.match(/\bAskUserQuestion\b/g) || []).length, 2);
});

test('Codex payload transform preserves executable keyword arguments', () => {
  const transformed = normalizeCodexBody(
    'parser = ArgumentParser(description="Analyze it")\n' +
    'result = client.generate(prompt=prompt)\n' +
    'skills = ".claude/skills"\n',
    '/fixture/tool.py'
  );

  assert.match(transformed, /description="Analyze it"/);
  assert.match(transformed, /prompt=prompt/);
  assert.match(transformed, /skills = "\.agents\/skills"/);
  assert.doesNotMatch(transformed, /task_name=|message=prompt/);
});

test('Codex managed AGENTS block preserves malformed marker topologies', () => {
  const malformed = [
    'user before\n<!-- CAFEKIT CODEX START -->\nuser tail\n',
    'user before\n<!-- CAFEKIT CODEX END -->\nuser tail\n',
    '<!-- CAFEKIT CODEX END -->\nuser\n<!-- CAFEKIT CODEX START -->\n',
    '<!-- CAFEKIT CODEX START -->\na\n<!-- CAFEKIT CODEX START -->\nb\n<!-- CAFEKIT CODEX END -->\n',
    '<!-- CAFEKIT CODEX START -->\na\n<!-- CAFEKIT CODEX END -->\nb\n<!-- CAFEKIT CODEX END -->\n'
  ];
  for (const content of malformed) {
    assert.equal(upsertManagedCodexBlock(content, 'replacement'), content);
    assert.equal(transformManagedCodexContent(content, () => 'replacement'), content);
  }
});

test('platform resolver keeps saved runtimes and newly detected Codex', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-detect-'));
  const originalCwd = process.cwd();
  try {
    for (const folder of ['.claude', '.codex']) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      options: { platforms: [], forceOverwrite: false },
      interactive: false,
      dryRun: false,
      ui: { info() {} },
      t: (key) => key
    };
    await resolvePlatforms(ctx);
    assert.deepEqual(ctx.platforms, ['claude', 'codex']);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit Codex install restores the Codex locale first', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-locale-'));
  const originalCwd = process.cwd();
  try {
    for (const [folder, responseLanguage] of [
      ['.claude', '日本語'],
      ['.codex', 'Tiếng Việt']
    ]) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
      fs.writeFileSync(
        path.join(root, folder, 'runtime.json'),
        `${JSON.stringify({ locale: { responseLanguage } })}\n`
      );
    }
    process.chdir(root);
    const ctx = {
      options: { platforms: ['codex'] },
      interactive: false,
      lang: 'en',
      setLang(code, locale) {
        this.lang = code;
        this.locale = locale;
      },
      ui: { info() {} },
      t: (key) => key
    };
    await selectLanguage(ctx);
    assert.equal(ctx.locale, 'Tiếng Việt');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same-version install can add Codex beside an existing runtime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      platforms: ['claude', 'codex'],
      dryRun: false,
      interactive: false,
      options: { forceOverwrite: false },
      ui: { info() {}, warn() {} }
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolvePlatforms interactive prompts to add more platforms when prior install exists', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-add-platforms-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      options: { platforms: [], forceOverwrite: false },
      interactive: true,
      dryRun: false,
      ui: {
        info() {},
        confirm: async ({ message }) => {
          if (message.includes('Existing platforms') || message.includes('addPlatformsPrompt')) return true;
          if (message.includes('confirmAllDetected') || message.includes('existing configs')) return true;
          return true;
        },
        select: async ({ message, options }) => {
          if (message.includes('selectPlatform') || message.includes('Select platform')) {
            return ['codex'];
          }
          return options[0].value;
        },
        isCancel: () => false
      },
      t: (key, vars) => {
        const tpl = (MESSAGES.en && MESSAGES.en[key]) || key;
        if (vars) return tpl.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
        return tpl;
      }
    };
    await resolvePlatforms(ctx);
    assert.deepEqual(ctx.platforms.sort(), ['claude', 'codex'].sort());
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolvePlatforms interactive keeps existing platforms when user declines to add more', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-keep-platforms-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      options: { platforms: [], forceOverwrite: false },
      interactive: true,
      dryRun: false,
      ui: {
        info() {},
        confirm: async ({ message }) => {
          // Check that the message is properly rendered without {names} placeholder
          // If i18n uses {existing} but ctx passes {names}, the rendered message will contain {existing}
          if (message.includes('Existing platforms') || message.includes('既存プラットフォーム') || message.includes('Nền tảng hiện có')) {
            assert.ok(!message.includes('{'), `Message should not contain unrendered placeholder: ${message}`);
            assert.ok(!message.includes('}'), `Message should not contain unrendered placeholder: ${message}`);
            return false; // decline to add more
          }
          return true; // confirmAllDetected
        },
        select: async () => ['claude'],
        isCancel: () => false
      },
      t: (key, vars) => {
        const tpl = (MESSAGES.en && MESSAGES.en[key]) || key;
        if (vars) return tpl.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
        return tpl;
      }
    };
    await resolvePlatforms(ctx);
    assert.deepEqual(ctx.platforms, ['claude']);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('addPlatformsPrompt placeholder consistency across all locales', () => {
  const expectedPlaceholders = ['names'];
  const placeholderRegex = /\{(\w+)\}/g;

  for (const [locale, messages] of Object.entries(MESSAGES)) {
    const template = messages.addPlatformsPrompt;
    assert.ok(template, `Missing addPlatformsPrompt key in locale: ${locale}`);

    const placeholders = [];
    let match;
    while ((match = placeholderRegex.exec(template)) !== null) {
      placeholders.push(match[1]);
    }

    assert.deepEqual(
      placeholders,
      expectedPlaceholders,
      `Locale ${locale} addPlatformsPrompt has incorrect placeholders. Template: "${template}". Expected: ${JSON.stringify(expectedPlaceholders)}, Got: ${JSON.stringify(placeholders)}`
    );
  }
});

test('same-version non-interactive install performs a selective refresh', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'codex' })}\n`
    );
    process.chdir(root);
    const messages = [];
    const ctx = {
      platforms: ['codex'],
      dryRun: false,
      interactive: false,
      options: { forceOverwrite: false },
      ui: { info(message) { messages.push(message); }, warn() {} },
      t: (key) => key
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
    assert.equal(ctx.options.forceOverwrite, false);
    assert.deepEqual(messages, ['versionRefreshing']);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same-version interactive refresh does not enable force overwrite', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'codex' })}\n`
    );
    process.chdir(root);
    const ctx = {
      platforms: ['codex'],
      dryRun: false,
      interactive: true,
      options: { forceOverwrite: false },
      ui: {
        info() {},
        warn() {},
        select: async () => 'refresh',
        isCancel: () => false
      },
      t: (key) => key
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
    assert.equal(ctx.options.forceOverwrite, false);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('mixed runtime versions update the stale Codex install', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    for (const [folder, platform, version] of [
      ['.claude', 'claude', PACKAGE_VERSION],
      ['.codex', 'codex', '0.14.1']
    ]) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
      fs.writeFileSync(
        path.join(root, folder, 'cafekit.json'),
        `${JSON.stringify({ version, platform })}\n`
      );
    }
    process.chdir(root);
    const ctx = {
      platforms: ['claude', 'codex'],
      dryRun: false,
      interactive: false,
      options: { forceOverwrite: false },
      ui: { info() {}, warn() {} }
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
    assert.equal(ctx.isUpdate, true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Codex ownership rejects files outside its split managed roots', () => {
  inTempProject((root) => {
    const originalCwd = process.cwd();
    process.chdir(root);
    try {
      const tracker = createTracker('.codex', PACKAGE_VERSION, {
        recordRoot: '.',
        allowedRoots: ['.codex', '.agents']
      });
      assert.throws(() => tracker.keyFor('AGENTS.md'), /outside allowed roots/);
      assert.equal(tracker.keyFor('.agents/skills/specs/SKILL.md'), '.agents/skills/specs/SKILL.md');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

test('Codex dry-run leaves both managed roots untouched', () => {
  inTempProject((root) => {
    const result = install(root, ['--dry-run']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, '.codex')), false);
    assert.equal(fs.existsSync(path.join(root, '.agents')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
  });
});

test('Codex Windows hook launchers stay project-bound without Git from nested cwd', () => {
  inTempProject((root) => {
    const projectRoot = path.join(root, 'project with spaces');
    fs.mkdirSync(projectRoot, { recursive: true });
    const installed = install(projectRoot);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);

    const config = JSON.parse(
      fs.readFileSync(path.join(projectRoot, '.codex', 'hooks.json'), 'utf8')
    );
    const launchers = allHookLaunchers(config);
    assert.ok(launchers.length > 0, 'installed Codex config must register hook launchers');
    for (const { handler } of launchers) {
      assert.doesNotMatch(handler.commandWindows, /\$\(/);
      assert.doesNotMatch(handler.commandWindows, /\bgit\b/i);
      assert.doesNotMatch(handler.commandWindows, /process\.cwd\(\)|existsSync/);
      const encodedPath = handler.commandWindows.match(/\s([A-Za-z0-9_-]+)$/)?.[1];
      assert.ok(encodedPath, `missing encoded hook path in: ${handler.commandWindows}`);
      const target = Buffer.from(encodedPath, 'base64url').toString('utf8');
      assert.equal(path.dirname(target), fs.realpathSync(path.join(projectRoot, '.codex', 'hooks')));
      assert.equal(
        fs.existsSync(target),
        true,
        `missing installed hook: ${path.basename(target)}`
      );
    }

    const nested = path.join(projectRoot, 'nested', 'workspace');
    fs.mkdirSync(nested, { recursive: true });
    const shadowHooks = path.join(projectRoot, 'nested', '.codex', 'hooks');
    const shadowMarker = path.join(root, 'shadow-hook-ran');
    fs.mkdirSync(shadowHooks, { recursive: true });
    fs.writeFileSync(
      path.join(shadowHooks, 'session.cjs'),
      `require('node:fs').writeFileSync(${JSON.stringify(shadowMarker)}, 'unsafe')\n`
    );
    const session = config.hooks.SessionStart[0].hooks[0];
    const nodeCommand = session.commandWindows.replace(/^node /, `"${process.execPath}" `);
    const noGitEnv = { ...process.env, PATH: '' };
    const launched = spawnSync(nodeCommand, {
      cwd: nested,
      encoding: 'utf8',
      input: JSON.stringify({
        session_id: 'windows-launcher-test',
        cwd: nested,
        hook_event_name: 'SessionStart',
        source: 'startup'
      }),
      env: noGitEnv,
      shell: true
    });
    assert.equal(launched.status, 0, launched.stderr);
    assert.match(launched.stdout, /Session startup\./);
    assert.match(launched.stdout, /CafeKit project root:/);
    assert.equal(fs.existsSync(shadowMarker), false);
    assert.match(session.commandWindows, /require\('module'\)\.runMain\(\)/, 'Windows launcher must execute hook main');
  });
});

// Run an installed POSIX launcher verbatim under the environment a macOS GUI host hands
// its children: no `git`, and no `node` on PATH. Nothing here rewrites the command, so a
// launcher that cannot find its own interpreter fails the way it fails in the wild.
const GUI_PATH = '/usr/bin:/bin:/usr/sbin:/sbin';

function runPosixLauncher(command, cwd, pathValue = GUI_PATH) {
  return spawnSync(command, {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify({
      session_id: 'posix-launcher-test',
      cwd,
      hook_event_name: 'SessionStart',
      source: 'startup'
    }),
    env: { PATH: pathValue, HOME: os.homedir() },
    shell: true
  });
}

function sessionLauncher(projectRoot) {
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, '.codex', 'hooks.json'), 'utf8')
  );
  return { config, command: config.hooks.SessionStart[0].hooks[0].command };
}

test('parity regression: moved Codex checkout rebinds both launcher fields and preserves metadata', () => {
  inTempProject((root) => {
    const oldRoot = path.join(root, "old ' quoted project"), newRoot = path.join(root, "new ' quoted project");
    fs.mkdirSync(oldRoot);
    assert.equal(install(oldRoot).status, 0);
    const configPath = path.join(oldRoot, '.codex/hooks.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.hooks.SessionStart[0].matcher = 'custom-startup';
    config.hooks.SessionStart[0].hooks[0].timeout = 41;
    fs.writeFileSync(configPath, JSON.stringify(config));
    fs.renameSync(oldRoot, newRoot);
    const movedConfig = path.join(newRoot, '.codex/hooks.json');
    const before = fs.readFileSync(movedConfig, 'utf8');
    assert.equal(install(newRoot, ['--dry-run']).status, 0);
    assert.equal(fs.readFileSync(movedConfig, 'utf8'), before, 'dry run modified launchers');
    const upgraded = install(newRoot);
    assert.equal(upgraded.status, 0, `${upgraded.stdout}\n${upgraded.stderr}`);
    const rebound = sessionLauncher(newRoot);
    assert.equal(rebound.config.hooks.SessionStart[0].matcher, 'custom-startup');
    assert.equal(rebound.config.hooks.SessionStart[0].hooks[0].timeout, 41);
    const launched = runPosixLauncher(rebound.command, newRoot);
    assert.equal(launched.status, 0, launched.stderr);
    assert.match(launched.stdout, /Session startup\./);
    const windowsCommand = rebound.config.hooks.SessionStart[0].hooks[0].commandWindows.replace(/^node /, `"${process.execPath}" `);
    const launchedWindows = spawnSync(windowsCommand, { cwd: newRoot, encoding: 'utf8', input: JSON.stringify({ session_id: 'moved-windows', hook_event_name: 'SessionStart', source: 'startup', cwd: newRoot }), shell: true });
    assert.equal(launchedWindows.status, 0, launchedWindows.stderr);
    assert.match(launchedWindows.stdout, /Session startup\./);
    for (const { handler } of allHookLaunchers(rebound.config)) {
      const encoded = handler.commandWindows.match(/\s([A-Za-z0-9_-]+)$/)?.[1];
      assert.ok(encoded);
      const target = Buffer.from(encoded, 'base64url').toString('utf8');
      assert.equal(path.dirname(target), fs.realpathSync(path.join(newRoot, '.codex/hooks')));
    }
    const stable = fs.readFileSync(movedConfig, 'utf8');
    assert.equal(install(newRoot).status, 0);
    assert.equal(fs.readFileSync(movedConfig, 'utf8'), stable, 'reinstall changed stable hooks config');
  });
});

test('Codex POSIX hook launchers run without Git and outside the repository root', () => {
  inTempProject((root) => {
    // A launcher that asks Git for its root gets nothing here and the outer root one
    // directory down, and in both cases points at a path that does not exist.
    const plain = path.join(root, 'no-git-project');
    fs.mkdirSync(plain, { recursive: true });
    assert.equal(install(plain).status, 0);

    const repoRoot = path.join(root, 'repo');
    const nested = path.join(repoRoot, 'packages', 'inner');
    fs.mkdirSync(nested, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: repoRoot });
    assert.equal(install(nested).status, 0);

    for (const projectRoot of [plain, nested]) {
      const { config, command } = sessionLauncher(projectRoot);
      for (const { handler } of allHookLaunchers(config)) {
        // A PATH floor, then `node`, then one single-quoted absolute path. Inside single
        // quotes the shell expands nothing, so a project path may safely contain $, a
        // backtick, or the word git — this fixture's own path contains it.
        assert.match(
          handler.command,
          /^PATH="\$PATH"(?::'(?:[^']|'\\'')+')+ node '(?:[^']|'\\'')+'$/,
          `launcher must carry a PATH floor and a quoted path: ${handler.command}`
        );
        assert.doesNotMatch(handler.command, /rev-parse/, `launcher must not consult Git: ${handler.command}`);
        assert.ok(
          handler.command.includes(path.join(projectRoot, '.codex', 'hooks')),
          `launcher must name this project's hooks directory: ${handler.command}`
        );
      }
      const launched = runPosixLauncher(command, projectRoot);
      assert.equal(launched.status, 0, launched.stderr);
      assert.match(launched.stdout, /Session startup\./);
    }
  });
});

// A reinstall treats an already-registered script as the user's placement, so a launcher
// an older installer wrote would otherwise keep its broken command forever.
for (const [label, legacyCommand] of [
  ['resolved their path through Git', (script) => `node "$(git rev-parse --show-toplevel)/.codex/hooks/${script}"`],
  ['looked for node on PATH', (script, root) => `node '${path.join(fs.realpathSync(root), '.codex', 'hooks', script)}'`],
]) {
  test(`a reinstall rebinds Codex launchers that ${label}`, () => {
    inTempProject((root) => {
      assert.equal(install(root).status, 0);
      const configPath = path.join(root, '.codex', 'hooks.json');

      const downgraded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      for (const { handler } of allHookLaunchers(downgraded)) {
        handler.command = legacyCommand(path.basename(handler.command.replace(/'$/, '')), root);
      }
      // A hook the user wrote, in the same shape CafeKit used to emit, must never be
      // rewritten: it points somewhere else entirely.
      const foreign = { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/tools/mine.cjs"' };
      downgraded.hooks.SessionStart[0].hooks.push(foreign);
      fs.writeFileSync(configPath, `${JSON.stringify(downgraded, null, 2)}\n`);

      const again = install(root);
      assert.equal(again.status, 0, again.stderr);
      assert.match(again.stdout, /rebound \d+ launcher/, 'the rebind must be reported, not silent');

      const { config, command } = sessionLauncher(root);
      const commands = allHookLaunchers(config).map(({ handler }) => handler.command);
      assert.ok(commands.includes(foreign.command), 'a foreign hook must survive untouched');
      assert.equal(
        commands.filter((entry) => !entry.startsWith('PATH=')).length,
        1,
        'every CafeKit launcher must be rebound, leaving only the foreign one'
      );
      const launched = runPosixLauncher(command, root);
      assert.equal(launched.status, 0, launched.stderr);
      assert.match(launched.stdout, /Session startup\./);

      // Running the installer again must change nothing.
      const third = install(root);
      assert.doesNotMatch(third.stdout, /rebound \d+ launcher/, 'rebinding must be idempotent');
    });
  });
}

test('Codex install on top of existing Claude installation preserves content and adds Codex', () => {
  inTempProject((root) => {
    // Setup existing Claude installation with content
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );

    // Existing CLAUDE.md with content
    const claudeMdContent = '# CLAUDE.md\n\n## User Instructions\n\nThis is my existing CLAUDE.md content.\n';
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), claudeMdContent);

    // Existing AGENTS.md with content
    const agentsMdContent = '# AGENTS.md\n\n## User Rules\n\nKeep this exact.\n';
    fs.writeFileSync(path.join(root, 'AGENTS.md'), agentsMdContent);

    // Run Codex install
    const result = install(root, ['--platform', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    // Assert .claude/ and its content still exist
    assert.equal(fs.existsSync(path.join(root, '.claude')), true, '.claude should exist');
    assert.equal(fs.existsSync(path.join(root, '.claude', 'cafekit.json')), true, '.claude/cafekit.json should exist');
    const claudeMetadata = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'cafekit.json'), 'utf8'));
    assert.equal(claudeMetadata.platform, 'claude', '.claude/cafekit.json should still be claude platform');

    // Assert .codex/ is created with payload
    assert.equal(fs.existsSync(path.join(root, '.codex')), true, '.codex should be created');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'hooks.json')), true, '.codex/hooks.json should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'runtime.json')), true, '.codex/runtime.json should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'hooks', 'privacy-block.cjs')), true, '.codex/hooks/privacy-block.cjs should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'rules', 'workflow.md')), true, '.codex/rules/workflow.md should exist');
    assert.equal(fs.existsSync(path.join(root, '.agents', '.gitignore')), true, '.agents/.gitignore should exist');
    assert.equal(fs.existsSync(path.join(root, '.agents', 'skills', 'specs', 'SKILL.md')), true, '.agents/skills/specs/SKILL.md should exist');

    // Assert .codex/cafekit.json has platform codex
    const codexMetadata = JSON.parse(fs.readFileSync(path.join(root, '.codex', 'cafekit.json'), 'utf8'));
    assert.equal(codexMetadata.platform, 'codex', '.codex/cafekit.json should have platform codex');
    assert.equal(codexMetadata.version, PACKAGE_VERSION, '.codex/cafekit.json should have current version');

    // Assert AGENTS.md root contains CODEX markers AND preserves original content
    const agentsMd = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    assert.match(agentsMd, /<!-- CAFEKIT CODEX START -->/, 'AGENTS.md should have CODEX START marker');
    assert.match(agentsMd, /<!-- CAFEKIT CODEX END -->/, 'AGENTS.md should have CODEX END marker');
    assert.match(agentsMd, /Keep this exact\./, 'AGENTS.md should preserve original user content');
    assert.ok(agentsMd.startsWith(agentsMdContent), 'AGENTS.md should start with original user content');

    // Assert CLAUDE.md is unchanged
    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.equal(claudeMd, claudeMdContent, 'CLAUDE.md should be unchanged');
  });
});

test('reinstall preserves untracked Codex and omp runtime files', () => {
  for (const platform of ['codex', 'omp']) inTempProject(root => {
    const first = installPlatforms(root, ['codex', 'omp']);
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    const runtime = `.${platform}`;
    const retired = ['change-firewall.cjs', 'spec-final-state.cjs'];
    for (const name of retired) fs.writeFileSync(path.join(root, runtime, 'scripts', name), 'legacy\n');
    // omp installs no skills, so a reinstall of omp alone must leave .agents/skills to Codex.
    const retiredSkillFiles = ['code-review/references/verification-gate.md', 'specs/references/archive-workflow.md'];
    for (const rel of retiredSkillFiles) {
      const target = path.join(root, '.agents/skills', rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'legacy\n');
    }
    const again = installPlatforms(root, [platform], ['--force-overwrite']);
    assert.equal(again.status, 0, `${again.stdout}\n${again.stderr}`);
    const output = again.stdout + again.stderr;
    for (const rel of retiredSkillFiles) assert.equal(fs.existsSync(path.join(root, '.agents/skills', rel)), true, rel);
    for (const name of retired) assert.equal(fs.existsSync(path.join(root, runtime, 'scripts', name)), true, name);
    if (platform === 'codex') assert.match(output, /Preserved 4 obsolete runtime/);
    else {
      assert.match(output, /Preserved 2 obsolete runtime/);
      assert.doesNotMatch(output, /\.agents\/skills/);
    }
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/code-review/SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(root, runtime, 'scripts/spec-resolver.cjs')), true);
  });
});

test('reinstall removes the retired spec.json templates from Claude and Codex but a dry run keeps them', () => {
  inTempProject((root) => {
    const first = installPlatforms(root, ['claude', 'codex']);
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    const templateDirs = ['.claude/skills/specs/templates', '.agents/skills/specs/templates'];
    const retired = ['design.md', 'task.md', 'requirements.md', 'requirements-init.md', 'spec-state.json'];
    for (const dir of templateDirs) {
      for (const name of retired) fs.writeFileSync(path.join(root, dir, name), 'legacy\n');
    }

    const dry = installPlatforms(root, ['claude', 'codex'], ['--force-overwrite', '--dry-run']);
    assert.equal(dry.status, 0, `${dry.stdout}\n${dry.stderr}`);
    for (const dir of templateDirs) {
      for (const name of retired) {
        assert.equal(fs.existsSync(path.join(root, dir, name)), true, `dry run removed ${dir}/${name}`);
      }
    }

    const again = installPlatforms(root, ['claude', 'codex'], ['--force-overwrite']);
    assert.equal(again.status, 0, `${again.stdout}\n${again.stderr}`);
    for (const dir of templateDirs) {
      assert.deepEqual(fs.readdirSync(path.join(root, dir)), ['research.md'], `${dir} keeps only research.md`);
    }
  });
});

test('combined installs bind each catalog to its native runtime inventory', () => {
  inTempProject((root) => {
    const result = installPlatforms(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    fs.cpSync(
      path.join(PACKAGE_ROOT, 'src/claude/skills/docs'),
      path.join(root, '.claude/skills/docs'),
      { recursive: true }
    );
    const claude = installedCatalog(root, 'claude');
    const codex = installedCatalog(root, 'codex');
    assert.equal(claude.root, fs.realpathSync(path.join(root, '.claude/skills')));
    assert.equal(codex.root, fs.realpathSync(path.join(root, '.agents/skills')));
    assert.equal(claude.skills.some((skill) => skill.public_id === 'cf:docs'), true);
    assert.equal(codex.skills.some((skill) => skill.public_id === 'cf:docs'), false);
  });
});

test('Claude and Codex installed rules preserve the ported review and process guidance', () => {
  {
    const root = bothProject;
    const ported = ['review-audit-self-decision.md', 'process-management.md'];
    const renameOnly = (content) => content
      .replace(/\/cf:([a-z0-9-]+)/gi, (_match, name) => `$cf-${name}`)
      .replace(/\bcf:([a-z0-9-]+)/gi, (_match, name) => `cf-${name}`);
    for (const relative of ported) {
      const sourcePath = path.join(PACKAGE_ROOT, 'src/claude/rules', relative);
      const source = fs.readFileSync(sourcePath, 'utf8');
      assert.equal(
        fs.existsSync(path.join(PACKAGE_ROOT, 'src/codex/rules', relative)),
        false,
        `${relative} must not be shadowed by a Codex native override`
      );
      assert.equal(
        fs.readFileSync(path.join(root, '.claude/rules', relative), 'utf8'),
        source,
        `claude:rules/${relative}`
      );
      const installedCodex = fs.readFileSync(path.join(root, '.codex/rules', relative), 'utf8');
      assert.equal(installedCodex, normalizeCodexBody(source, sourcePath), `codex:rules/${relative}`);
      assert.equal(
        installedCodex,
        renameOnly(source),
        `codex:rules/${relative} must differ from source only by skill-name renames`
      );
    }
    const agentsMd = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    const pointerLines = agentsMd
      .split('\n')
      .filter((line) => ported.some((relative) => line.includes(relative)));
    assert.equal(pointerLines.length, ported.length, 'AGENTS.md must point at both ported rules');
    for (const relative of ported) {
      assert.ok(
        pointerLines.some((line) => line.includes(`.codex/rules/${relative}`)),
        `AGENTS.md must name .codex/rules/${relative}`
      );
    }
    const pointerText = pointerLines.join('\n');
    for (const forbidden of ['cf:', 'Claude Code', 'Claude Tasks', 'SendMessage', '.claude/']) {
      assert.equal(
        pointerText.includes(forbidden),
        false,
        `AGENTS.md pointer must stay Codex-native: ${forbidden}`
      );
    }
  }
});
