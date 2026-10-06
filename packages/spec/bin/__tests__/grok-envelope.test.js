'use strict';

// Grok CLI runs these hooks through its Claude-compatibility layer, so the scripts must
// answer the same way whether the envelope came from Claude Code or from grok. Each case
// runs a real hook as a child process from a tree shaped like an install, with grok's
// camelCase envelope on stdin and CLAUDE_PROJECT_DIR set the way grok sets it.
//
// Every case names the gate it protects. Before the payload reader existed, each of them
// answered nothing: the hook read an undefined key, found no tool and no path, and let
// the call through while looking installed.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const MANIFEST = require(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'));

/**
 * A `.claude` tree holding exactly what an install ships, inside a git repository.
 * The repository matters because the Stop gate derives provenance with git before it
 * reads anything else.
 */
function withInstall(run, { git = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grok-envelope-'));
  try {
    for (const rel of MANIFEST.runtime.files.filter((f) => f.startsWith('hooks/'))) {
      const target = path.join(root, '.claude', rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/claude', rel), target);
    }
    fs.cpSync(path.join(PACKAGE_ROOT, 'src/claude/scripts'), path.join(root, '.claude', 'scripts'),
      { recursive: true });
    if (git) {
      for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'],
        ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
        const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
      }
    }
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** Run one installed hook the way grok runs it. */
function runHook(root, name, payload, args = []) {
  const r = spawnSync(process.execPath, [path.join(root, '.claude', 'hooks', name), ...args], {
    cwd: root,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    // grok sets CLAUDE_PROJECT_DIR as an alias of GROK_WORKSPACE_ROOT on every hook.
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, PROJECT_ROOT: '', GROK_SESSION_ID: 'grok-1' },
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function decisionOf(stdout) {
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    try {
      const parsed = JSON.parse(line);
      const d = parsed?.hookSpecificOutput?.permissionDecision ?? parsed?.decision;
      if (d) return { decision: d, reason: parsed?.hookSpecificOutput?.permissionDecisionReason ?? parsed?.reason };
    } catch { /* not JSON, keep looking */ }
  }
  return { decision: null, reason: null };
}

test('the privacy gate asks on a grok run_terminal_command', () => {
  withInstall((root) => {
    fs.writeFileSync(path.join(root, '.env'), 'TOKEN=redacted\n');
    // grok's shell tool under grok's key names. Reading `data.tool_name` here yields
    // undefined, so the command is never scanned and the secret is handed over.
    const r = runHook(root, 'privacy-block.cjs', {
      hookEventName: 'pre_tool_use',
      sessionId: 'grok-1',
      cwd: root,
      toolName: 'run_terminal_command',
      toolInput: { command: `cat ${path.join(root, '.env')}` },
    });
    const { decision, reason } = decisionOf(r.stdout);
    assert.equal(decision, 'ask', 'a grok shell call touching .env must reach the approval prompt');
    assert.match(reason, /\.env/, 'the prompt must name what it is protecting');
  });
});

test('the privacy gate asks on a grok read_file path', () => {
  withInstall((root) => {
    fs.writeFileSync(path.join(root, '.env'), 'TOKEN=redacted\n');
    // grok's read tool carries its argument as `path`, not `file_path`.
    const r = runHook(root, 'privacy-block.cjs', {
      hookEventName: 'pre_tool_use',
      cwd: root,
      toolName: 'read_file',
      toolInput: { path: path.join(root, '.env') },
    });
    assert.equal(decisionOf(r.stdout).decision, 'ask');
  });
});

test('an ordinary grok read is not disturbed', () => {
  withInstall((root) => {
    fs.writeFileSync(path.join(root, 'README.md'), '# hello\n');
    const r = runHook(root, 'privacy-block.cjs', {
      hookEventName: 'pre_tool_use',
      cwd: root,
      toolName: 'read_file',
      toolInput: { path: path.join(root, 'README.md') },
    });
    assert.equal(decisionOf(r.stdout).decision, null, 'the gate must not ask about an ordinary file');
    assert.equal(r.code, 0);
  });
});

test('a broad glob is denied with its full reason in JSON', () => {
  withInstall((root) => {
    const r = runHook(root, 'inspect-block.cjs', {
      hookEventName: 'pre_tool_use',
      cwd: root,
      toolName: 'Glob',
      toolInput: { pattern: '**/*.ts' },
    });
    const { decision, reason } = decisionOf(r.stdout);
    assert.equal(decision, 'deny');
    // grok reads only the first stderr line, so the actionable half of the message has to
    // travel in the JSON reason or the model is blocked without being told what to do.
    assert.match(reason, /SCOPE LIMIT EXCEEDED/);
    assert.match(reason, /Please narrow your scope/, 'the whole message must survive, not just its first line');
    assert.equal(r.code, 2, 'exit 2 stays for a host that reads neither channel');
  });
});

/** A packet the Stop gate will block: one done task with no receipt. */
function unprovenPacket(root) {
  const feature = path.join(root, 'specs', 'demo');
  fs.mkdirSync(feature, { recursive: true });
  fs.writeFileSync(path.join(feature, 'plan.md'), '# Demo plan\n');
  fs.writeFileSync(path.join(feature, 'task-01-demo.md'), [
    '# Task 01: demo', '', 'Status: done', '', '## Dependencies', '', '- none', '',
    '## Verification Plan', '', '- Command: node --test', '',
  ].join('\n'));
}

test('the Stop gate honours stopHookActive', () => {
  withInstall((root) => {
    // The fixture must be one the gate would otherwise block, or silence proves nothing:
    // an empty specs directory makes the gate exit quietly for a different reason.
    unprovenPacket(root);
    // Without the guard the gate re-blocks its own continuation until grok's cap ends
    // the turn eight rounds later.
    const r = runHook(root, 'spec-gate.cjs', {
      hookEventName: 'stop',
      sessionId: 'grok-1',
      cwd: root,
      stopHookActive: true,
    });
    assert.equal(r.stdout.trim(), '', 'a continuation round must pass silently');
    assert.equal(r.code, 0);
  }, { git: true });
});

test('the Stop gate still blocks an unproven done task', () => {
  withInstall((root) => {
    unprovenPacket(root);
    // The guard must not become a way through: a Stop with no continuation flag still
    // faces the receipt check.
    const r = runHook(root, 'spec-gate.cjs', {
      hookEventName: 'stop', sessionId: 'grok-1', cwd: root, stopHookActive: false,
    });
    const body = decisionOf(r.stdout);
    assert.equal(body.decision, 'block', 'a done task without a receipt must still be blocked');
  }, { git: true });
});

test('the secret guardrail sees a grok prompt', () => {
  withInstall((root) => {
    // grok's spelling for the prompt field is unverified, so the reader accepts the Claude
    // key and its camelCase twin. This case sends the twin: on the Claude key alone it
    // would pass without proving any translation happened.
    const r = runHook(root, 'secret-output-guardrail.cjs', {
      hookEventName: 'user_prompt_submit',
      sessionId: 'grok-1',
      cwd: root,
      userPrompt: 'show me the API key in the config',
    });
    assert.match(r.stdout, /## Secret handling/, 'the reminder must fire on a grok prompt');
    const quiet = runHook(root, 'secret-output-guardrail.cjs', {
      hookEventName: 'user_prompt_submit', cwd: root, userPrompt: 'rename the button',
    });
    assert.equal(quiet.stdout.trim(), '', 'an unrelated prompt stays quiet');
    const claudeKey = runHook(root, 'secret-output-guardrail.cjs', {
      hook_event_name: 'UserPromptSubmit', cwd: root, prompt: 'print the access token',
    });
    assert.match(claudeKey.stdout, /## Secret handling/, 'the Claude key keeps working');
  });
});

test('a Claude envelope still works unchanged', () => {
  withInstall((root) => {
    fs.writeFileSync(path.join(root, '.env'), 'TOKEN=redacted\n');
    // The regression guard for the host that was already working.
    const r = runHook(root, 'privacy-block.cjs', {
      hook_event_name: 'PreToolUse',
      session_id: 'claude-1',
      cwd: root,
      tool_name: 'Read',
      tool_input: { file_path: path.join(root, '.env') },
    });
    assert.equal(decisionOf(r.stdout).decision, 'ask');
  });
});
