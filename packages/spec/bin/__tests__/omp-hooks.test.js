'use strict';

// The gate scripts were authored against Claude Code's vocabulary. omp speaks a
// different one: its tool registry uses lowercase names, and its tool_call result has
// only { block, reason } — there is no ask state. `src/omp/hooks/` is an overlay holding
// only the files that carry those contract differences; the installer writes it over the
// portable Claude set. Each test states the failure it prevents, because an overlay that
// silently drifts back to the Claude contract disables a gate while looking installed.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const OMP_HOOKS = path.join(PACKAGE_ROOT, 'src/omp/hooks');
const CLAUDE_HOOKS = path.join(PACKAGE_ROOT, 'src/claude/hooks');
const { normalizeToolName } = require(path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/hook-payload.cjs'));
const MANIFEST = require(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'));

/**
 * The overlay is not runnable on its own: it requires the shared libraries the Claude set
 * carries. Behaviour is therefore exercised on what an install produces — the manifest's
 * hook set with the overlay written over it, under a dotted folder so runtime-dir derives
 * `.omp` — while the source-shape checks below read `src/omp/hooks/` directly.
 */
const INSTALLED_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-installed-'));
const INSTALLED = path.join(INSTALLED_ROOT, '.omp', 'hooks');
for (const rel of MANIFEST.runtime.files.filter((f) => f.startsWith('hooks/'))) {
  const target = path.join(INSTALLED_ROOT, '.omp', rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/claude', rel), target);
}
fs.cpSync(OMP_HOOKS, INSTALLED, { recursive: true });
test.after(() => { fs.rmSync(INSTALLED_ROOT, { recursive: true, force: true }); });

function withSecretProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-hooks-'));
  try {
    fs.writeFileSync(path.join(root, '.env'), 'API_TOKEN=redacted\n');
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** Run a hook as a real child process and return its verdict, if any. */
function verdict(hookPath, payload) {
  const result = spawnSync(process.execPath, [hookPath], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  const out = (result.stdout || '').trim();
  let decision = null;
  try {
    decision = out ? JSON.parse(out)?.hookSpecificOutput?.permissionDecision ?? null : null;
  } catch { decision = null; }
  return { code: result.status, out, decision };
}

test('omp tool names map to the Claude names the rules were written against', () => {
  for (const [omp, claude] of [['bash', 'Bash'], ['read', 'Read'], ['edit', 'Edit'], ['write', 'Write'], ['grep', 'Grep']]) {
    assert.equal(normalizeToolName(omp), claude, `${omp} must reach the ${claude} rule`);
  }
  // An unknown tool is left alone rather than renamed into a rule it does not belong to.
  assert.equal(normalizeToolName('some_future_tool'), 'some_future_tool');
  assert.equal(normalizeToolName('Bash'), 'Bash', 'a Claude name must survive unchanged');
});

test('a lowercase bash command reading a secret file is denied, where Claude asks', () => {
  withSecretProject((root) => {
    const payload = { tool_name: 'bash', tool_input: { command: `cat ${path.join(root, '.env')}` }, cwd: root };

    // Both hooks now see the lowercase name, because the shared payload reader aliases it.
    // What still differs is the answer: omp's tool_call result carries only block and
    // reason, so an ask there would be dropped and the access allowed.
    const claude = verdict(path.join(CLAUDE_HOOKS, 'privacy-block.cjs'), payload);
    assert.equal(claude.decision, 'ask', 'the Claude hook now recognises the lowercase name and asks');

    const omp = verdict(path.join(INSTALLED, 'privacy-block.cjs'), payload);
    assert.equal(omp.decision, 'deny');
    assert.match(omp.out, /\.env/, 'the denial must name what it protected');
  });
});

test('a capitalised tool name keeps working, so the fork adds a case rather than swapping one', () => {
  withSecretProject((root) => {
    const omp = verdict(path.join(INSTALLED, 'privacy-block.cjs'),
      { tool_name: 'Bash', tool_input: { command: `cat ${path.join(root, '.env')}` }, cwd: root });
    assert.equal(omp.decision, 'deny');
  });
});

test('the privacy hook denies where Claude asks, since omp tool_call has no ask state', () => {
  const source = fs.readFileSync(path.join(OMP_HOOKS, 'privacy-block.cjs'), 'utf8');
  assert.ok(!source.includes("permissionDecision: 'ask'"),
    "omp's tool_call result carries only block and reason; an ask would be dropped and the access allowed");
  assert.ok(source.includes("permissionDecision: 'deny'"));

  withSecretProject((root) => {
    const omp = verdict(path.join(INSTALLED, 'privacy-block.cjs'),
      { tool_name: 'read', tool_input: { file_path: path.join(root, '.env') }, cwd: root });
    assert.equal(omp.decision, 'deny');
  });
});

test('an unevaluable access denies rather than allows', () => {
  for (const malformed of ['not json', '', '{"tool_name":']) {
    const omp = verdict(path.join(INSTALLED, 'privacy-block.cjs'), malformed);
    assert.equal(omp.code, 0, 'the hook must not crash the turn');
    if (malformed === 'not json' || malformed === '{"tool_name":') {
      assert.equal(omp.decision, 'deny',
        'a hook that cannot evaluate an access must not hand the model a secret-bearing path');
    }
  }
});

/** Every file under a directory, relative and sorted. */
function walk(dir, prefix = '') {
  return fs.readdirSync(dir).flatMap((name) => {
    const rel = prefix ? `${prefix}/${name}` : name;
    return fs.statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name), rel) : [rel];
  }).sort();
}

/** The contract edits, applied to the portable Claude bytes. This is the whole overlay. */
function expectedOverlay(name) {
  let source = fs.readFileSync(path.join(CLAUDE_HOOKS, name), 'utf8');
  const edit = (from, to) => {
    assert.equal(source.split(from).length - 1, 1, `${name} must contain exactly one "${from.trim()}"`);
    source = source.replace(from, to);
  };
  if (name === 'privacy-block.cjs') {
    edit("        permissionDecision: 'ask',\n        permissionDecisionReason: `Sensitive file access requires approval: ${basename}`\n",
      "        // omp has no ask state on tool_call, so an ask under Claude becomes a denial here.\n"
      + "        permissionDecision: 'deny',\n        permissionDecisionReason: `Sensitive file access requires approval: ${basename}`\n");
    edit("      permissionDecision: 'ask',\n      permissionDecisionReason: 'Sensitive access could not be evaluated safely.'\n",
      "      permissionDecision: 'deny',\n      permissionDecisionReason: 'Sensitive access could not be evaluated safely.'\n");
  }
  return source;
}

test('the fork differs from Claude only by its overlay', () => {
  // A second file here would be a hook the installer stops taking from Claude, so a
  // Claude fix would silently miss omp. A shared file that differs beyond its contract
  // edits is the same drift in the other direction. Every lowercase tool name omp sends
  // is handled by the shared payload reader, so only the ask-versus-deny difference —
  // which is a contract, not a spelling — still needs a file of its own.
  assert.deepEqual(walk(OMP_HOOKS), ['privacy-block.cjs']);
  for (const name of ['privacy-block.cjs']) {
    assert.equal(fs.readFileSync(path.join(OMP_HOOKS, name), 'utf8'), expectedOverlay(name),
      `${name} must be the portable Claude file plus its omp contract edits, nothing else`);
  }
  const phase = fs.readFileSync(path.join(PACKAGE_ROOT, 'bin/phases/omp-runtime.js'), 'utf8');
  assert.match(phase, /claudeHookFiles/, 'the phase must install the Claude set first');
  assert.match(phase, /overlayFiles/, 'the phase must write the overlay over it');
});
