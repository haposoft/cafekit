'use strict';

// The gate hooks read Claude Code's envelope. Grok CLI runs the same scripts through its
// Claude-compatibility layer but sends camelCase keys and its own tool names, and omp's
// bridge sends Claude keys with lowercase tool names. Each case below states the failure
// it prevents, because every one of them is a gate that looks installed and answers
// nothing when the reader gets a spelling wrong.
//
// Envelope samples follow grok 1.0.13's embedded hooks documentation; regenerate it with
// `strings -n 6 ~/.grok/downloads/grok-1.0.13-macos-aarch64`.

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const { normalizeHookPayload, normalizeToolName } = require(
  path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/hook-payload.cjs'));

test('a grok PreToolUse envelope becomes the Claude payload', () => {
  const grok = {
    hookEventName: 'pre_tool_use',
    sessionId: 'abc-123',
    cwd: '/Users/you/project',
    workspaceRoot: '/Users/you/project',
    permissionMode: 'default',
    toolName: 'run_terminal_command',
    toolInput: { command: 'npm test' },
    toolUseId: 'call_1',
    timestamp: '2026-04-14T12:00:00Z',
  };
  const out = normalizeHookPayload(grok);
  // The four keys every gate reads first. Without them privacy-block sees no tool and
  // no command, and allows a call it was installed to examine.
  assert.equal(out.hook_event_name, 'PreToolUse');
  assert.equal(out.session_id, 'abc-123');
  assert.equal(out.tool_name, 'Bash');
  assert.deepEqual(out.tool_input, { command: 'npm test' });
  assert.equal(out.tool_use_id, 'call_1');
  assert.equal(out.permission_mode, 'default');
  assert.equal(out.workspace_root, '/Users/you/project');
  assert.equal(out.cwd, '/Users/you/project', 'cwd is already Claude-shaped and must survive');
});

test('read_file path becomes file_path', () => {
  const out = normalizeHookPayload({
    hookEventName: 'pre_tool_use',
    toolName: 'read_file',
    toolInput: { path: '/p/.env' },
  });
  assert.equal(out.tool_name, 'Read');
  // privacy-block and inspect-block both read file_path first, so the normalized key
  // must be file_path.
  assert.equal(out.tool_input.file_path, '/p/.env');
  assert.equal(out.tool_input.path, '/p/.env', 'the original key stays for hooks that read it');
});

test('an existing file_path is never overwritten by path', () => {
  const out = normalizeHookPayload({
    toolName: 'read_file',
    toolInput: { file_path: '/p/real.txt', path: '/p/other.txt' },
  });
  assert.equal(out.tool_input.file_path, '/p/real.txt');
});

test('Stop and subagent fields map', () => {
  const stop = normalizeHookPayload({
    hookEventName: 'stop',
    sessionId: 's1',
    stopHookActive: true,
    lastAssistantMessage: 'done',
    reason: 'end_turn',
  });
  // Without stop_hook_active the Stop gate loses its loop guard and blocks every
  // continuation round until the host's own cap ends the turn.
  assert.equal(stop.hook_event_name, 'Stop');
  assert.equal(stop.stop_hook_active, true);
  assert.equal(stop.last_assistant_message, 'done');

  const sub = normalizeHookPayload({
    hookEventName: 'subagent_stop',
    subagentType: 'code-auditor',
    subagentId: 'agent-7',
    lastAssistantMessage: 'REVIEW: PASS',
  });
  assert.equal(sub.hook_event_name, 'SubagentStop');
  assert.equal(sub.agent_type, 'code-auditor');
  assert.equal(sub.agent_id, 'agent-7');

  const post = normalizeHookPayload({ hookEventName: 'post_tool_use', toolResult: { ok: true } });
  assert.deepEqual(post.tool_response, { ok: true });
});

test('every name reaching a Bash matcher becomes Bash', () => {
  // Grok expands the Bash matcher to its own shell tools, so a call can arrive under any
  // of these names. One unmapped name means privacy-block skips its command scan and a
  // secret-bearing command is never examined.
  for (const name of ['run_terminal_command', 'run_terminal_cmd', 'PowerShell', 'bash']) {
    assert.equal(normalizeToolName(name), 'Bash', `${name} must reach the Bash rule`);
  }
});

test('write and search_replace map to different Claude tools', () => {
  // Grok creates files with `write` and edits them with `search_replace`; they must stay
  // distinct Claude tools so a hook matcher on Write or on Edit sees the event it names.
  assert.equal(normalizeToolName('write'), 'Write');
  assert.equal(normalizeToolName('delete_file'), 'Write');
  assert.equal(normalizeToolName('search_replace'), 'Edit');
  assert.equal(normalizeToolName('read_file'), 'Read');
  assert.equal(normalizeToolName('grep'), 'Grep');
  assert.equal(normalizeToolName('grep_search'), 'Grep');
  assert.equal(normalizeToolName('list_dir'), 'Glob');
  assert.equal(normalizeToolName('spawn_subagent'), 'Task');
});

test('omp lowercase names are aliased even under a snake_case key', () => {
  // omp's bridge sends Claude-shaped keys with lowercase values, so a reader that only
  // translated camelCase keys would leave `bash` unmapped and reopen the exact gap the
  // omp tool-name table was written to close.
  const out = normalizeHookPayload({
    hook_event_name: 'PreToolUse',
    session_id: 'omp-1',
    tool_name: 'bash',
    tool_input: { command: 'cat .env' },
  });
  assert.equal(out.tool_name, 'Bash');
  for (const [omp, claude] of [['read', 'Read'], ['edit', 'Edit'], ['write', 'Write'], ['grep', 'Grep'], ['ls', 'Glob']]) {
    assert.equal(normalizeToolName(omp), claude);
  }
});

test('a Claude payload keeps its keys', () => {
  const claude = {
    hook_event_name: 'PreToolUse',
    session_id: 's1',
    cwd: '/p',
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    transcript_path: '/p/t.jsonl',
  };
  const before = JSON.stringify(claude);
  const out = normalizeHookPayload(claude);
  assert.deepEqual(out, claude, 'a Claude payload must come back with the same keys and values');
  assert.notEqual(out, claude, 'the reader returns a copy');
  assert.equal(JSON.stringify(claude), before, 'the input must not be mutated');
});

test('an unknown tool name is left alone', () => {
  // A future host tool degrades to "not specially handled" rather than being renamed into
  // a privileged rule it does not belong to.
  assert.equal(normalizeToolName('some_future_tool'), 'some_future_tool');
  assert.equal(normalizeToolName('Bash'), 'Bash');
  const out = normalizeHookPayload({ toolName: 'some_future_tool', toolInput: {} });
  assert.equal(out.tool_name, 'some_future_tool');
});

test('hostile input never throws', () => {
  // The Stop gate and the approval hook end in a catch that emits a block, so an
  // exception raised here would block completion on Claude, not just under grok.
  const hostile = [
    null, undefined, 42, 'string', true, [],
    { toolName: 42, toolInput: 'not-an-object' },
    { toolInput: [] },
    { hookEventName: {} },
    JSON.parse('{"__proto__": {"polluted": true}, "toolName": "read_file"}'),
    Object.create(null),
  ];
  for (const input of hostile) {
    assert.doesNotThrow(() => normalizeHookPayload(input), `threw on ${JSON.stringify(input)}`);
  }
  assert.equal(normalizeHookPayload(null), null);
  assert.equal(normalizeHookPayload(42), 42);
  assert.deepEqual(normalizeHookPayload([]), []);
  assert.equal({}.polluted, undefined, 'a __proto__ key must not reach Object.prototype');
});

test('the event map covers every event grok emits', () => {
  const expected = {
    pre_tool_use: 'PreToolUse', post_tool_use: 'PostToolUse',
    post_tool_use_failure: 'PostToolUseFailure', permission_denied: 'PermissionDenied',
    user_prompt_submit: 'UserPromptSubmit', session_start: 'SessionStart',
    session_end: 'SessionEnd', stop: 'Stop', stop_failure: 'StopFailure',
    stop_cancelled: 'StopCancelled', subagent_start: 'SubagentStart',
    subagent_stop: 'SubagentStop', pre_compact: 'PreCompact', post_compact: 'PostCompact',
    notification: 'Notification',
  };
  for (const [snake, pascal] of Object.entries(expected)) {
    assert.equal(normalizeHookPayload({ hookEventName: snake }).hook_event_name, pascal);
  }
  assert.equal(normalizeHookPayload({ hook_event_name: 'Stop' }).hook_event_name, 'Stop',
    'an already-PascalCase value is kept');
});
