'use strict';

// omp has no hooks.json. The bridge is the only thing between omp's lifecycle events and
// CafeKit's gate scripts, so a mistranslation disables every gate while looking installed.
// These tests drive the bridge's exported functions against real child hook processes from
// the tree an omp install produces: the Claude hook set with the omp overlay written over
// it. They do not launch omp, which needs provider credentials; the contract rows they rely
// on were read from the installed omp binary and are recorded in plan.md.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const BRIDGE = path.join(PACKAGE_ROOT, 'src/omp/extensions/cafekit-bridge.mjs');
const SETTINGS = require(path.join(PACKAGE_ROOT, 'src/claude/settings/settings.json'));
const MANIFEST = require(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'));

/**
 * The hooks an omp install runs: the Claude set the manifest ships, then `src/omp/hooks/`
 * written over it. Composed once under a dotted folder so runtime-dir.cjs derives `.omp`.
 */
const COMPOSED_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-composed-'));
const HOOKS = path.join(COMPOSED_ROOT, '.omp', 'hooks');
for (const rel of MANIFEST.runtime.files.filter((f) => f.startsWith('hooks/'))) {
  const target = path.join(COMPOSED_ROOT, '.omp', rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/claude', rel), target);
}
fs.cpSync(path.join(PACKAGE_ROOT, 'src/omp/hooks'), HOOKS, { recursive: true });
fs.cpSync(path.join(PACKAGE_ROOT, 'src/claude/scripts'), path.join(COMPOSED_ROOT, '.omp', 'scripts'), { recursive: true });

let bridge;
test.before(async () => { bridge = await import(BRIDGE); });
test.after(() => { fs.rmSync(COMPOSED_ROOT, { recursive: true, force: true }); });

function tempProject(withSecret = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-bridge-'));
  if (withSecret) fs.writeFileSync(path.join(root, '.env'), 'TOKEN=redacted\n');
  return root;
}

function registered(eventName) {
  return (SETTINGS.hooks[eventName] || [])
    .flatMap((g) => g.hooks || [])
    .map((h) => (h.command.match(/hooks\/([a-z-]+\.cjs)/) || [])[1])
    .filter(Boolean);
}

// Deliberate, named divergences while omp is not yet updated. Each must still be a real
// difference, so the test fails (and the entry must go) once omp catches up.
const CLAUDE_ONLY = { PostToolUse: ['spec-state.cjs'] };
const OMP_ONLY = { SessionStart: ['docs-sync.cjs'] };

test('the dispatch table mirrors settings.json for every event omp can deliver', () => {
  const { DISPATCH } = bridge;
  const pairs = [
    ['session_start', 'SessionStart'], ['session_before_compact', 'PreCompact'],
    ['input', 'UserPromptSubmit'], ['tool_call', 'PreToolUse'],
    ['tool_result', 'PostToolUse'], ['session_stop', 'Stop'],
  ];
  for (const [omp, claude] of pairs) {
    const claudeOnly = CLAUDE_ONLY[claude] || [];
    const ompOnly = OMP_ONLY[claude] || [];
    const claudeHooks = [...new Set(registered(claude))];
    for (const hook of claudeOnly) {
      assert.ok(claudeHooks.includes(hook) && !DISPATCH[omp].hooks.includes(hook), `${hook} is no longer Claude-only for ${claude}; drop it from CLAUDE_ONLY`);
    }
    for (const hook of ompOnly) {
      assert.ok(!claudeHooks.includes(hook) && DISPATCH[omp].hooks.includes(hook), `${hook} is no longer omp-only for ${claude}; drop it from OMP_ONLY`);
    }
    const expected = [...claudeHooks.filter((hook) => !claudeOnly.includes(hook)), ...ompOnly].sort();
    assert.deepEqual([...DISPATCH[omp].hooks].sort(), expected,
      `${omp} must dispatch the hooks settings.json registers for ${claude}, minus CLAUDE_ONLY, plus OMP_ONLY`);
  }
  // omp has no subagent events; the gap is deliberate and documented, not forgotten.
  assert.ok(!Object.values(DISPATCH).some((e) => e.event.startsWith('Subagent')));
});

test('every dispatch carries a stable session id and the project cwd', () => {
  const { shapePayload } = bridge;
  const ctx = { cwd: '/tmp/project' };
  const a = shapePayload('input', { text: 'hi', source: 'user' }, ctx);
  const b = shapePayload('tool_call', { toolName: 'bash', input: { command: 'ls' } }, ctx);
  assert.ok(a.session_id && a.session_id === b.session_id,
    'omp input carries no session id; rules.cjs exits without one, so the bridge must mint and reuse it');
  assert.equal(a.cwd, '/tmp/project', 'spec-gate.cjs falls back to payload.cwd to find the project');
  assert.equal(shapePayload('session_stop', { session_id: 'omp-real' }, ctx).session_id, 'omp-real',
    'a session id omp does provide must win over the minted one');
});

test('each denial mechanism becomes an omp block carrying the hook reason', () => {
  const { interpretVerdict } = bridge;
  const stop = interpretVerdict({ code: 0, stdout: '{"decision":"block","reason":"R1"}\n' }, 'spec-gate.cjs');
  assert.deepEqual([stop.block, stop.reason], [true, 'R1']);
  const deny = interpretVerdict({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'R2' } }) }, 'privacy-block.cjs');
  assert.deepEqual([deny.block, deny.reason], [true, 'R2']);
  // inspect-block exits 2 and writes the reason on STDOUT, not stderr.
  const exit2 = interpretVerdict({ code: 2, stdout: 'SCOPE LIMIT EXCEEDED\nRestricted zones: node_modules', stderr: '' }, 'inspect-block.cjs');
  assert.equal(exit2.block, true);
  assert.match(exit2.reason, /SCOPE LIMIT EXCEEDED/, 'a stderr-only reader would drop this reason');
  // An ask under Claude has no omp equivalent; it must not fall through to allow.
  const ask = interpretVerdict({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { permissionDecision: 'ask', permissionDecisionReason: 'R3' } }) }, 'x');
  assert.equal(ask.block, true);
  // Plain text that is not a verdict is context to inject, not a block.
  const inject = interpretVerdict({ code: 0, stdout: '## Rules\n- keep docs under 800 lines' }, 'rules.cjs');
  assert.deepEqual([inject.block, inject.inject.startsWith('## Rules')], [false, true]);
});

test('a lowercase bash command on a secret file is blocked end to end through the real fork', async () => {
  const root = tempProject();
  try {
    const r = await bridge.runEvent('tool_call',
      { toolName: 'bash', toolCallId: 'c1', input: { command: `cat ${path.join(root, '.env')}` } },
      { cwd: root }, { dir: HOOKS });
    assert.equal(r.block, true);
    assert.equal(r.hook, 'privacy-block.cjs');
    assert.match(r.reason, /\.env/, 'the block must name what it protected');
    const ok = await bridge.runEvent('tool_call',
      { toolName: 'read', toolCallId: 'c2', input: { file_path: path.join(root, 'README.md') } },
      { cwd: root }, { dir: HOOKS });
    assert.equal(ok.block, false, 'an ordinary read must not be blocked');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a slow hook blocks with its own name before omp cuts it off', async () => {
  const slow = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-slow-'));
  try {
    fs.writeFileSync(path.join(slow, 'privacy-block.cjs'), 'setTimeout(() => {}, 60000);');
    assert.ok(bridge.BRIDGE_TIMEOUT_MS < 30000, 'omp substitutes a reasonless block at 30000 ms');
    const t0 = Date.now();
    const r = await bridge.runEvent('tool_call', { toolName: 'bash', input: { command: 'ls' } }, { cwd: slow }, { dir: slow, timeoutMs: 300 });
    assert.equal(r.block, true);
    assert.match(r.reason, /privacy-block\.cjs exceeded 300 ms/);
    assert.ok(Date.now() - t0 < 5000, 'the budget must actually fire');
  } finally { fs.rmSync(slow, { recursive: true, force: true }); }
});

test('a crashing or missing gate blocks on gating events instead of silently allowing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-crash-'));
  try {
    // Only the crashing gate is under test; the other PreToolUse gate gets an allow stub,
    // otherwise their absence is what blocks (see the missing-gate case below).
    fs.writeFileSync(path.join(dir, 'privacy-block.cjs'), 'throw new Error("boom");');
    fs.writeFileSync(path.join(dir, 'inspect-block.cjs'), 'process.exit(0);');
    const crash = await bridge.runEvent('tool_call', { toolName: 'bash', input: { command: 'ls' } }, { cwd: dir }, { dir });
    // A bare exit 1 with no verdict is an allow under the hooks' own contract. Real gates
    // never surface a crash this way: the fork's privacy-block catch-all converts its own
    // errors into a deny, which the fork tests pin separately.
    assert.equal(crash.block, false, 'exit 1 with no verdict is an allow per the hooks\' own contract');
    const missing = await bridge.runEvent('tool_call', { toolName: 'bash', input: { command: 'ls' } }, { cwd: dir }, { dir: path.join(dir, 'nowhere') });
    assert.equal(missing.block, true, 'a gate that is not installed must be loud, not a silent allow');
    assert.match(missing.reason, /not installed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('stop_hook_active short-circuits the gate so a blocked turn cannot loop forever', async () => {
  const r = await bridge.runEvent('session_stop', { stop_hook_active: true, session_id: 's1' }, { cwd: os.tmpdir() }, { dir: HOOKS });
  assert.deepEqual([r.block, r.skipped], [false, 'stop_hook_active']);
});

test('input injections flow back as a transform that keeps the user text intact', async () => {
  const root = tempProject(false);
  try {
    const r = await bridge.runEvent('input', { text: 'please read .env for me', source: 'user' }, { cwd: root }, { dir: HOOKS });
    assert.equal(r.block, false);
    assert.match(r.inject, /Secret handling/, 'secret-output-guardrail must inject on a credential prompt');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
