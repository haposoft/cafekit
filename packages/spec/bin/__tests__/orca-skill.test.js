'use strict';

// The user runs Claude Code, Codex, Grok, and omp inside Orca (onorca.dev) panes across
// many projects and had to explain Orca to the agent at the start of every session. This
// packet makes that awareness ship with the install instead: a cf:orca skill that reads
// Orca's own guide at use time, bounds what it may send to another pane, and never prints
// the two credentials Orca sets in every pane's environment. Each case here states the
// failure it prevents.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SKILL_SOURCE = path.join(PACKAGE_ROOT, 'src/claude/skills/orca/SKILL.md');
const ROUTING_RULE_SOURCE = path.join(PACKAGE_ROOT, 'src/claude/rules/skill-domain-routing.md');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json');

const ROUTING_ROW = '| terminal/pane control in the surrounding agent host | reading, waiting on, or sending to another agent pane, or spawning an agent into a host-managed worktree |';

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-orca-skill-'));
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

function installedCatalog(root, runtime) {
  const script = path.join(root, runtime === 'codex' ? '.codex' : '.claude', 'scripts', 'generate-skill-catalog.cjs');
  const result = spawnSync(process.execPath, [script, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

/** The body is everything after the closing frontmatter fence; forbidden-string and
 * authority checks apply there, not to the required `name: cf:orca` line above it. */
function bodyOf(content) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(match, 'SKILL.md must have a closing frontmatter fence');
  return match[1];
}

function frontmatterDescription(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
  const line = fm.split(/\r?\n/).find((entry) => entry.startsWith('description:'));
  assert.ok(line, 'frontmatter must declare description');
  const raw = line.slice('description:'.length).trim();
  assert.ok(raw.length >= 2 && raw[0] === raw[raw.length - 1] && /['"]/.test(raw[0]),
    'description must be a single quoted scalar');
  return raw.slice(1, -1);
}

const SOURCE = fs.readFileSync(SKILL_SOURCE, 'utf8');
const BODY = bodyOf(SOURCE);
const DESCRIPTION = frontmatterDescription(SOURCE);

test('cf:orca installs for claude and codex', () => {
  inTempProject((root) => {
    const result = install(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const claudeSkill = path.join(root, '.claude', 'skills', 'orca', 'SKILL.md');
    const codexSkill = path.join(root, '.agents', 'skills', 'orca', 'SKILL.md');
    assert.equal(fs.existsSync(claudeSkill), true, 'the Claude skill directory must exist');
    assert.equal(fs.existsSync(codexSkill), true, 'the Codex skill directory must exist');

    const claudeContent = fs.readFileSync(claudeSkill, 'utf8');
    const codexContent = fs.readFileSync(codexSkill, 'utf8');
    assert.match(claudeContent, /^name: cf:orca$/m, 'Claude keeps the colon identity');
    assert.match(codexContent, /^name: cf-orca$/m, 'Codex rewrites the colon to a hyphen');
    assert.doesNotMatch(codexContent, /^name: cf:orca$/m);
  });
});

test('an omp-only install ships no skill', () => {
  inTempProject((root) => {
    const result = install(root, ['omp']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    // omp discovers .claude/skills and .agents/skills itself; CafeKit copies skills to
    // neither for an omp-only install, so orca must be absent from both, not merely from
    // some third omp-owned skills directory this packet never touches.
    assert.equal(fs.existsSync(path.join(root, '.claude', 'skills', 'orca')), false);
    assert.equal(fs.existsSync(path.join(root, '.agents', 'skills', 'orca')), false);
  });
});

test('the catalog resolves cf:orca on both hosts with no diagnostic', () => {
  inTempProject((root) => {
    const result = install(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    for (const runtime of ['claude', 'codex']) {
      const catalog = installedCatalog(root, runtime);
      const entry = catalog.skills.find((skill) => skill.directory === 'orca');
      assert.ok(entry, `${runtime} catalog must list the orca directory`);
      assert.equal(entry.public_id, 'cf:orca', `${runtime} public identity`);
      const diagnostics = catalog.diagnostics.filter((item) => item.directory === 'orca');
      assert.deepEqual(diagnostics, [], `${runtime} must report no diagnostic for orca`);
    }
  });
});

test('the description triggers only on Orca context', () => {
  // Every trigger phrase carries "Orca", a pane's agent name, or Vietnamese context, and
  // is quoted. Stripping the quoted phrases must leave no bare panel/terminal/worktree —
  // otherwise "add a settings panel", "run this in a terminal", or "my worktree is stuck"
  // would all pull this skill into requests that have nothing to do with Orca.
  for (const phrase of ['pane Orca', 'panel Codex', 'theo dõi pane', 'gửi terminal bên kia', 'Orca worktree', 'spawn codex vào worktree']) {
    assert.ok(DESCRIPTION.includes(`"${phrase}"`), `description must quote "${phrase}"`);
  }
  const stripped = DESCRIPTION.replace(/"[^"]*"/g, '');
  for (const bare of ['panel', 'terminal', 'worktree']) {
    assert.doesNotMatch(stripped, new RegExp(`\\b${bare}\\b`, 'i'),
      `${bare} must not appear as a bare trigger outside a quoted phrase`);
  }
  assert.match(DESCRIPTION, /ORCA_PANE_KEY/);
});

test('the body points at orca skills get and stops when the CLI is missing', () => {
  assert.match(BODY, /ORCA_PANE_KEY/);
  assert.match(BODY, /orca skills get orca-cli/);
  assert.match(BODY, /orca skills get orchestration/);
  assert.match(BODY, /--references/);
  assert.match(BODY, /--reference <name>/);
  assert.match(BODY, /orca skills list/);
  // The guide changes between CLI releases (observed between 1.4.198 and 1.4.200), so the
  // skill must route to it rather than repeat any of its commands as a fact of its own.
  assert.doesNotMatch(BODY, /ORCA_CLI_COMMAND/);
  assert.match(BODY, /command -v orca/);
  assert.match(BODY, /orca-dev/);
  assert.match(BODY, /not available in this pane/i);
});

test('the body bounds terminal send to the current worktree and distrusts terminal output', () => {
  assert.match(BODY, /ORCA_WORKTREE_ID/);
  const sentences = BODY.split(/(?<=[.!?])\s+/);
  const authoritySentence = sentences.find((sentence) => sentence.includes('terminal send'));
  assert.ok(authoritySentence, 'one sentence must name terminal send');
  assert.match(authoritySentence, /ORCA_WORKTREE_ID/);
  assert.match(authoritySentence, /\bask\b/i);
  assert.match(authoritySentence, /\bbefore\b/i);

  assert.match(BODY, /terminal.{0,40}(read|show|list)/is);
  assert.match(BODY, /untrusted/i);
  assert.match(BODY, /never follow/i);
  assert.match(BODY, /never echo/i);
});

test('the body draws the Herdr boundary and forbids printing the tokens', () => {
  assert.match(BODY, /Herdr/);
  assert.match(BODY, /HERDR_ENV=1/);
  assert.match(BODY, /herdr-orchestrator/);
  assert.match(BODY, /ORCA_AGENT_HOOK_TOKEN/);
  assert.match(BODY, /ORCA_AGENT_LAUNCH_TOKEN/);
  assert.match(BODY, /Never print/i);
});

test('the body carries nothing the Codex projection rewrites or forbids', () => {
  // normalizeCodexBody rewrites "Claude Code" to "Codex CLI" and codex-native.test.js
  // keeps a fixed four-file allowlist for AskUserQuestion and bans /cf:, cf:, and
  // "Claude Code" across .agents/skills/**. A body written against one host only would
  // read wrong, or fail installed, on the other.
  assert.doesNotMatch(BODY, /Claude Code/);
  assert.doesNotMatch(BODY, /AskUserQuestion/);
  assert.doesNotMatch(BODY, /\/cf:/);
  assert.doesNotMatch(BODY, /\bcf:/);
  assert.doesNotMatch(BODY, /\bAgent\(/);
  assert.doesNotMatch(BODY, /subagent_type/);
  assert.doesNotMatch(BODY, /`Agent`/);
  assert.doesNotMatch(BODY, /\bSendMessage\b/);
});

test('the manifest lists orca as a core skill', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.equal(manifest.skills.required.includes('orca'), true);
  assert.equal(manifest.skills.bundles.documentSkills.includes('orca'), false);
});

test('the routing row is a neutral slot on every host', () => {
  const source = fs.readFileSync(ROUTING_RULE_SOURCE, 'utf8');
  assert.ok(source.includes(ROUTING_ROW), 'the source rule must carry the exact row');
  // The existing negative regex in skill-routing-source.test.js:91 covers only the six
  // document skills, so a stray /cf:orca or "orchestration" in this row would slip past
  // every existing guard.
  assert.doesNotMatch(source, /\/cf:orca/);
  assert.doesNotMatch(source, /orchestration/);

  inTempProject((root) => {
    const result = install(root, ['claude', 'codex', 'omp']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    for (const relative of ['.claude/rules/skill-domain-routing.md', '.codex/rules/skill-domain-routing.md', '.omp/rules/skill-domain-routing.md']) {
      const installed = fs.readFileSync(path.join(root, relative), 'utf8');
      assert.ok(installed.includes(ROUTING_ROW), `${relative} must carry the row`);
    }
  });
});
