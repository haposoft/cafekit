# Plan: Port Claude Hooks → OpenCode Plugins

## Goal
Đưa các runtime hooks của CafeKit từ Claude Code (`.claude/hooks/*.cjs`, declarative trong `settings.json`) sang OpenCode plugin system (`.opencode/plugins/*.ts`, programmatic). Giữ hành vi gates/guardrails tương đương khi user chạy CafeKit dưới OpenCode runtime.

## Constraints
- Không sửa `.claude/hooks/*` flow hiện tại — chỉ thêm path opencode song song.
- OpenCode plugin protocol (event-driven, throw/mutate) khác Claude hook protocol (stdin JSON + exit code) → KHÔNG có path tự động convert; phải viết lại.
- Một số Claude hook KHÔNG có event tương đương trong OpenCode → document gap, đề xuất workaround (AGENTS.md/skill rules thay vì hook).
- KISS: port từng hook một, validate end-to-end trước khi port hook tiếp theo.

## Hooks Inventory (source: `src/claude/hooks/`)

| Hook file | LOC | Claude event | OpenCode event mapping | Port verdict |
|---|---|---|---|---|
| `privacy-block.cjs` | 179 | PreToolUse(Read\|Write\|Edit\|MultiEdit\|Bash\|Glob\|Grep) | `tool.execute.before` | **PORTABLE** |
| `inspect-block.cjs` | 124 | PreToolUse | `tool.execute.before` | **PORTABLE** |
| `state.cjs` | 269 | SessionStart + PostToolUse(Task/TaskUpdate/TodoWrite) + Stop + SubagentStop | `session.created` + `tool.execute.after` + `session.idle` | **PARTIAL** (drop SubagentStop, partial Stop) |
| `spec-state.cjs` | 114 | UserPromptSubmit | (no equivalent) | **DROP** (workaround: AGENTS.md/skill) |
| `docs-sync.cjs` | 103 | SessionStart | `session.created` | **PORTABLE** |
| `session.cjs` | 168 | SessionStart(startup\|resume\|clear\|compact) | `session.created` + `session.compacted` | **PARTIAL** (no context replay, banner only) |
| `agent.cjs` | 106 | SubagentStart | (no equivalent) | **DROP** (workaround: subagent prompt self-contained) |
| `rules.cjs` | 122 | UserPromptSubmit | (no equivalent) | **DROP** (workaround: AGENTS.md routing rules) |
| `usage.cjs` | 190 | UserPromptSubmit + PostToolUse(Edit\|Write\|MultiEdit) | `tool.execute.after` (only) | **PARTIAL** (prompt half drop) |

## OpenCode Plugin Contract (verified)
- Discovery: `.opencode/plugins/*.ts` auto-load (project), `~/.config/opencode/plugins/` (global), `opencode.json#plugin[]` (npm).
- Signature:
  ```ts
  export const Name = async ({ project, client, $, directory, worktree }) => ({
    "tool.execute.before": async (input, output) => { /* throw to block */ },
    "session.created": async (input) => { /* one-shot */ },
  })
  ```
- Bun runtime → TS + ESM + CJS interop available.
- Block semantics: `throw new Error(message)` aborts the tool call; message surfaces to assistant.
- Mutate semantics: edit `output.args` in place to alter call.

## Shared Lib Strategy
`src/claude/hooks/lib/*.cjs` (color, config, context, counter, detect, git, parser) tổng ~2.5K LOC. Quyết định:
- Copy CJS as-is sang `.opencode/plugins/lib/` và `import` qua Bun CJS interop (`import x from './lib/config.cjs'`).
- Lý do: tránh duplicate; tương lai nếu Bun có vấn đề, port từng file lẻ sang TS.

## Task DAG

```
T0 (contract doc)
 └─ T1 (mapping audit)
     ├─ T2.1 (privacy POC)──┐
     ├─ T2.2 (installer wiring)
     └─ T2.3 (smoke test)──┘
         ├─ T3.1 (state PostToolUse port)
         ├─ T3.2 (docs-sync port)
         ├─ T3.3 (session banner port)
         └─ T3.4 (inspect-block port)
             └─ T4 (gap docs + CHANGELOG + e2e verify)
```

## Verification Strategy
- Each port: install opencode-only in `/tmp/cafekit-test-opencode-hooks/`, run scripted opencode CLI (or manual interaction if CLI scripting limited), confirm event handler fires.
- Self-test additions: assert plugin files exist + plugin TS syntax valid (`bun build --no-emit` or `tsc --noEmit`).
- No regression: existing claude-only install + tests still pass.

## Out of Scope (this plan)
- Porting `rules.cjs`, `agent.cjs`, `spec-state.cjs` UserPromptSubmit halves (no OpenCode equivalent; document gap only).
- Statusline (`status.cjs`) — Claude-only TUI feature.
- Migrating OpenCode global plugin distribution to npm.

## Risk Register
| Risk | Mitigation |
|---|---|
| OpenCode tool names differ from Claude (`Read` vs `read`) | Document mapping in T0 doc; centralize tool-name normalization in 1 helper |
| Bun CJS interop edge cases with shared lib | Convert problematic lib to TS as-needed during T6 |
| Plugin throw doesn't surface JSON marker payload to assistant cleanly | Use OpenCode `permission.replied` event or write marker to stderr + throw — test in T2.3 |
| `session.created` fires before runtime.json is loaded | Defer reads to first tool event if init order matters |
