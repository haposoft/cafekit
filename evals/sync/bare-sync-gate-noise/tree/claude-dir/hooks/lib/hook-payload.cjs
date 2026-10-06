/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * Hook payload normalization.
 *
 * The gate hooks were written against Claude Code's stdin envelope: snake_case keys and
 * capitalised tool names. Two other hosts run the very same scripts with a different
 * spelling. Grok CLI loads `.claude/settings.json` through its Claude-compatibility layer
 * but sends camelCase keys (`toolName`, `stopHookActive`) and its own tool names
 * (`run_terminal_command`, `read_file`, `search_replace`). Oh My Pi's bridge sends
 * Claude-shaped keys with lowercase tool names (`bash`, `read`).
 *
 * A hook that reads `data.tool_name` on a grok payload gets `undefined`, extracts no
 * paths, and allows the call: the gate looks installed and is open. This module is the
 * one place that reconciles those spellings, so every hook keeps a single code path.
 *
 * Two rules earn their keep:
 *
 *   1. The tool name is aliased by VALUE, under any key. omp already sends `tool_name`,
 *      so a key-only translation would silently skip its lowercase names.
 *   2. Every name that can reach a `Bash` matcher must map to `Bash`. Grok expands
 *      matchers by alias, so a shell call can arrive under a name the hook does not
 *      recognise; an unmapped name skips the command scan and a secret-bearing command
 *      is never examined.
 *
 * The reader is total: it never throws. Callers include two fail-closed hooks whose final
 * catch emits a block, so an exception here would block the Stop gate on Claude too.
 */

'use strict';

/** Grok's event values are snake_case; the hooks compare against Claude's PascalCase. */
const EVENT_NAMES = Object.freeze({
  pre_tool_use: 'PreToolUse',
  post_tool_use: 'PostToolUse',
  post_tool_use_failure: 'PostToolUseFailure',
  permission_denied: 'PermissionDenied',
  user_prompt_submit: 'UserPromptSubmit',
  session_start: 'SessionStart',
  session_end: 'SessionEnd',
  stop: 'Stop',
  stop_failure: 'StopFailure',
  stop_cancelled: 'StopCancelled',
  subagent_start: 'SubagentStart',
  subagent_stop: 'SubagentStop',
  pre_compact: 'PreCompact',
  post_compact: 'PostCompact',
  notification: 'Notification',
});

/**
 * Foreign tool names to the Claude names the rules were authored against.
 *
 * Grok's registry and matcher aliases come first, then omp's lowercase registry. Where
 * both hosts use a spelling (`write`, `grep`) they agree on the destination. `write` is
 * grok's file-creating tool and maps to `Write`, while `search_replace` edits an existing
 * file and maps to `Edit`; conflating them would make the scaffold guard reject ordinary
 * edits. `delete_file` maps to `Write` so a delete is gated like any other file write.
 */
const TOOL_ALIASES = Object.freeze({
  // grok — every spelling that reaches a Bash matcher
  run_terminal_command: 'Bash',
  run_terminal_cmd: 'Bash',
  PowerShell: 'Bash',
  // grok — file and search tools
  read_file: 'Read',
  hashline_read: 'Read',
  search_replace: 'Edit',
  hashline_edit: 'Edit',
  write: 'Write',
  delete_file: 'Write',
  grep: 'Grep',
  grep_search: 'Grep',
  hashline_grep: 'Grep',
  list_dir: 'Glob',
  web_search: 'WebSearch',
  web_fetch: 'WebFetch',
  spawn_subagent: 'Task',
  todo_write: 'TodoWrite',
  // omp — lowercase registry
  bash: 'Bash',
  read: 'Read',
  edit: 'Edit',
  glob: 'Glob',
  find: 'Glob',
  ls: 'Glob',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
});

/**
 * Camel-cased foreign key to the snake_case key the hooks read.
 *
 * `transcriptPath` is deliberately absent: grok stores sessions in its own format, and
 * mapping it would make `state.cjs` stream a file it cannot parse. The last three pairs
 * cover fields whose grok spelling is unverified, so both spellings are accepted.
 */
const KEY_ALIASES = Object.freeze({
  hookEventName: 'hook_event_name',
  sessionId: 'session_id',
  stopHookActive: 'stop_hook_active',
  lastAssistantMessage: 'last_assistant_message',
  toolName: 'tool_name',
  toolInput: 'tool_input',
  toolUseId: 'tool_use_id',
  toolResult: 'tool_response',
  subagentType: 'agent_type',
  subagentId: 'agent_id',
  permissionMode: 'permission_mode',
  workspaceRoot: 'workspace_root',
  userPrompt: 'prompt',
  startSource: 'source',
  compactTrigger: 'trigger',
});

const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** The Claude name for a foreign tool, or the input unchanged when unknown. */
function normalizeToolName(name) {
  if (typeof name !== 'string' || name === '') return name;
  return owns(TOOL_ALIASES, name) ? TOOL_ALIASES[name] : name;
}

/** The Claude name for an event value, or the input unchanged (already PascalCase). */
function normalizeEventName(value) {
  if (typeof value !== 'string' || value === '') return value;
  return owns(EVENT_NAMES, value) ? EVENT_NAMES[value] : value;
}

/**
 * A hook payload in the shape the gate scripts read, whatever host sent it.
 *
 * Anything that is not a plain object is returned as-is rather than coerced, so a caller
 * that already guards on shape keeps its own behaviour. The input is never mutated.
 */
function normalizeHookPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

  const out = { ...payload };

  // A snake_case key already present wins: the host that sent it meant it.
  for (const [foreign, native] of Object.entries(KEY_ALIASES)) {
    if (owns(out, foreign) && !owns(out, native)) out[native] = out[foreign];
  }

  if (owns(out, 'hook_event_name')) out.hook_event_name = normalizeEventName(out.hook_event_name);
  // By value, under whichever key carried it — omp sends `tool_name` with a lowercase value.
  if (owns(out, 'tool_name')) out.tool_name = normalizeToolName(out.tool_name);

  // grok's `read_file` carries its argument as `path`; the hooks read `file_path`.
  const input = out.tool_input;
  if (input && typeof input === 'object' && !Array.isArray(input)
      && owns(input, 'path') && !owns(input, 'file_path')) {
    out.tool_input = { ...input, file_path: input.path };
  }

  return out;
}

module.exports = { normalizeHookPayload, normalizeToolName, TOOL_ALIASES, KEY_ALIASES, EVENT_NAMES };
