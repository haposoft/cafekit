# Task 01 — One reader turns any supported envelope into the Claude payload

Status: done

## Outcome
`src/claude/hooks/lib/hook-payload.cjs` exports `normalizeHookPayload(payload)` and `normalizeToolName(name)`. Given grok's camelCase envelope it returns the snake_case, Claude-named payload every gate hook was written against; given a Claude payload it keeps every key spelling and value except the tool name, which always passes through the alias table so omp's lowercase names reach the Claude names. The alias table is the single home for tool-name mapping across platforms, and the reader never throws.

## Scope
- In: key renaming (`hookEventName`→`hook_event_name` with `pre_tool_use`→`PreToolUse` style value mapping for every event grok emits, `sessionId`, `stopHookActive`, `lastAssistantMessage`, `toolName`, `toolInput`, `toolUseId`, `toolResult`→`tool_response`, `subagentType`→`agent_type`, `subagentId`→`agent_id`, `permissionMode`, `workspaceRoot`, plus `prompt`/`userPrompt`, `source`/`startSource`, `trigger`/`compactTrigger`); the tool-name alias table for grok and omp; `tool_input.path`→`tool_input.file_path` when `file_path` is absent. Pure functions, no I/O.
- Out: reading stdin (each hook keeps its own read and empty-input handling); any call site; output translation (grok reads the Claude output vocabulary unchanged); `transcriptPath`, deliberately unmapped so `state.cjs` keeps skipping rather than streaming a grok session file of unknown format.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/hooks/lib/hook-payload.cjs`
- Create: `packages/spec/bin/__tests__/hook-payload.test.js`
- Read: `packages/spec/src/omp/hooks/lib/omp-tool-names.cjs`, `packages/spec/src/omp/extensions/cafekit-bridge.mjs` (`shapePayload`), `packages/spec/src/claude/settings/settings.json` (which matchers a name must reach)

## Acceptance
- AC-01 as stated in `plan.md`, with these fixed rules.
- **Tool-name aliasing is by value, not by key.** Whether the name arrives as `toolName` or as an existing snake_case `tool_name`, it goes through `normalizeToolName`. This is what keeps omp working: its bridge sends snake_case keys with lowercase values (`cafekit-bridge.mjs:81,86`), so a key-only pass-through would silently reopen the gap `omp-tool-names.cjs` was written to close.
- **Every name that can reach a `Bash` matcher maps to `Bash`.** Grok expands matchers by alias, so a call can arrive at `privacy-block.cjs` under a name the hook does not recognize; an unmapped name skips the command-scanning branch entirely and a secret-bearing command is never examined. The table therefore carries `run_terminal_command`, `run_terminal_cmd`, `PowerShell`, and omp's `bash`. Grok's file-creating tool is `write`→`Write`, while `search_replace`→`Edit` because it edits an existing file; `delete_file`→`Write`, `grep`/`grep_search`→`Grep`, `list_dir`→`Glob`, `read_file`→`Read`, `spawn_subagent`→`Task`.
- **Other rules.** A snake_case key already present wins over its camelCase twin for every field except the tool name. An unknown tool name is returned unchanged, never mapped to a privileged name. `path` fills `file_path` only when `file_path` is absent. The input object is not mutated.
- **The reader is a total function.** A non-object input, an array, `null`, a non-string `toolName`, a non-object `toolInput`, or a prototype-polluted object returns a value without throwing. Task 02 places the call inside two fail-closed hooks whose final catch emits a block, so a throw here would block Stop.
- The event-name map covers `pre_tool_use`, `post_tool_use`, `post_tool_use_failure`, `permission_denied`, `user_prompt_submit`, `session_start`, `session_end`, `stop`, `stop_failure`, `stop_cancelled`, `subagent_start`, `subagent_stop`, `pre_compact`, `post_compact`, `notification`; an already-PascalCase value is kept.
- Field names for `prompt`, `source`, and `trigger` are `[UNVERIFIED]` per `plan.md`; the reader accepts the Claude spelling and the obvious camelCase twin so either shape works, and no acceptance case claims grok's actual spelling.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/hook-payload.test.js`
- Named probe: `a grok PreToolUse envelope becomes the Claude payload`, `read_file path becomes file_path`, `Stop and subagent fields map`, `every name reaching a Bash matcher becomes Bash`, `write and search_replace map to different Claude tools`, `omp lowercase names are aliased even under a snake_case key`, `a Claude payload keeps its keys`, `an unknown tool name is left alone`, `hostile input never throws`.
- Reachability: known — the test requires the module directly from `src/claude/hooks/lib/`.
- Oracle: `assert.deepEqual` on the whole normalized object per sample; `assert.doesNotThrow` for the hostile-input case.
- Counterexample: mapping an unknown tool name to `Bash` must fail the unknown-name case; aliasing only when the key is camelCase must fail the omp case; mapping `search_replace` to `Write` must fail the write/search_replace case; letting a non-object input throw must fail the hostile-input case; mutating the input must fail the pass-through case.
- Artifacts: none.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/hook-payload.test.js
Exit: 0
Base: 197c0994137e8bad6f48dba6f6724bb1378b07ad
Head: 97aabe9760afbca62557bace5d4487f571a1cb7a791a8f13605b8ee7d5d4a64b
```text
$ node --test bin/__tests__/hook-payload.test.js
✔ a grok PreToolUse envelope becomes the Claude payload (1.620292ms)
✔ read_file path becomes file_path (0.0815ms)
✔ an existing file_path is never overwritten by path (0.060917ms)
✔ Stop and subagent fields map (0.096417ms)
✔ every name reaching a Bash matcher becomes Bash (0.061542ms)
✔ write and search_replace map to different Claude tools (0.058708ms)
✔ omp lowercase names are aliased even under a snake_case key (0.0835ms)
✔ a Claude payload keeps its keys (0.085667ms)
✔ an unknown tool name is left alone (0.076ms)
✔ hostile input never throws (0.218625ms)
✔ the event map covers every event grok emits (0.16025ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Counterexamples ran on a disposable copy under a temp root, never the tracked bytes. Each mutation turned 11 pass into 10 pass 1 fail: an unknown tool name mapped to `Bash`; aliasing only when the key is camelCase; `search_replace` mapped to `Write`; a non-object input throwing; the input mutated in place.
