# Task: Tollgate v2 — move spec-completion enforcement from per-prompt reminder to a Stop-gate hook

> **STATUS: DONE — VERIFIED 2026-07-17** (delegated to grok; verified independently
> by orchestrator on branch `feat/tollgate-v2`).
>
> Verification receipt (all commands run by orchestrator, not agent claims):
> - [x] `spec-gate.cjs` — 173 LOC, registered FIRST on Stop, in manifest `runtime.files:96`;
>       all 8 behaviors implemented (loop guard, escape hatch fail-closed, first-run seed,
>       receipt checks a–d, failing tasks held at old cache status so gate re-fires)
> - [x] `spec-state.cjs` slimmed — grep `URGENT|BẮT BUỘC|CẤM` = 0; block ≤7 lines
> - [x] `runtime.json` — `spec.{scaffold_guard,completion_gate}: true`
> - [x] `node --test spec-gate.test.js` = 7/7 pass; full `npm test` = **PASS 150 tests**
> - [x] Scope clean (9 files per brief); one DU conflict on `delegate/references/codex-delegation.md`
>       (leftover from branch switch, byte-identical to stash@{0}) resolved by `git rm` —
>       delegate WIP still safe in stash@{0}
> - [x] Changelogs + `rules/state-sync.md` updated
>
> NOT committed — user decides. Suggested: commit on `feat/tollgate-v2`, PR after #67 merges.

> Self-contained brief for a fresh-context agent. Date: 2026-07-17.
> FOUNDATION: repo `cafekit` (pnpm monorepo), branch `feat/tollgate-v2` (created from
> `fix/audit-batch-1` @ `197a04b`, which is rebased on latest `dev` incl. PR #65+#66).
> Working tree is CLEAN except this brief file. `npm test` inside `packages/spec/`
> passes: **143 tests**. Do NOT commit/push/stash.

## Context

CafeKit (`packages/spec/`) enforces a spec-driven workflow in Claude Code via hooks.
Today the only completion discipline is `hooks/spec-state.cjs` (UserPromptSubmit): it
*reminds* every prompt that spec state must be synced ("tollgate"), with a full red
ALL-CAPS block on state change. Reminders are advice — the model can still mark a task
`done` in `spec.json`/task-md without real verification evidence, and nothing blocks it.

Claude Code (2026) supports blocking **Stop** hooks: when the assistant is about to end
its turn, a Stop hook receiving stdin JSON can emit
`{"decision": "block", "reason": "<text>"}` (exit 0) to force the assistant to continue
and fix the problem. This task adds a deterministic completion gate on Stop, and slims
the per-prompt reminder. This is audit item §3.4.1
(`docs/audit-cafekit-vs-claude-code-2026-07.md`).

House style for hooks (copy it): crash-wrapper `try/catch` around everything, always
fail-open (`process.exit(0)`) on internal errors, error log appended to
`hooks/.logs/hook-log.jsonl`, config read from `.claude/runtime.json`, caches under
`hooks/.logs/`. Read `packages/spec/src/claude/hooks/spec-state.cjs` and
`task-scaffold-guard.cjs` first as style references.

## Scope

### 1. NEW `packages/spec/src/claude/hooks/spec-gate.cjs` (~150–200 LOC)

Registered on **Stop**. Behavior:

1. Parse stdin JSON: `{ hook_event_name, session_id, transcript_path, cwd, stop_hook_active }`.
2. **Loop guard**: if `stop_hook_active === true`, exit 0 immediately (never re-block a
   continuation caused by our own block — infinite-loop protection).
3. **Escape hatch**: read `.claude/runtime.json`; if `spec.completion_gate === false`,
   exit 0. Missing/malformed runtime.json → gate stays ON (same fail-closed pattern as
   `task-scaffold-guard.cjs` valve 3).
4. Find the active spec exactly like `spec-state.cjs` does (first dir under
   `specs/` whose `spec.json.status` is `in_progress`/`in-progress`; respect
   `runtime.paths.specs` and `PROJECT_ROOT`). No active spec → exit 0.
5. **Detect newly-done tasks**: load cache `hooks/.logs/spec-gate-last.json`
   (shape: `{ "<feature>": { "<task_path>": "<status>" } }`). A task is "newly done"
   when `task_registry[path].status === "done"` now AND cached status differs (or cache
   entry absent while the cache FILE exists). **First run** (cache file absent):
   treat all current `done` as historical — write cache, exit 0, never block. This
   protects legacy specs at adoption time.
6. For each newly-done task, verify a **receipt** in the task markdown
   (`specs/<feature>/<task_path>`). Receipt check (deterministic, all required):
   a. file exists; its `Status` header line contains `done`;
   b. it has an Evidence section — a heading line matching
      `/^#{2,3}\s+(Evidence|Task Test Plan & Verification Evidence|Verification & Evidence)\b/`;
   c. section content (until next same-or-higher heading) contains **no** `{{...}}`
      placeholder AND contains at least one fenced code block (```) **or** one line
      matching `/(PASS|FAIL|exit code|passed|✓)/`;
   d. `task_registry[path].completed_at` is a non-empty string.
7. All newly-done tasks have receipts → update cache, exit 0 (silent).
8. Any newly-done task lacks a receipt → **do NOT update its cache entry** (so the gate
   re-fires next Stop) and emit on stdout
   `JSON.stringify({ decision: "block", reason: <message> })`, exit 0. Message must be
   actionable, ≤8 lines, English, listing each failing task path with which check
   (a–d) failed, and the exact fix ("add a verification receipt to `## Evidence` in
   <file>: commands run + outcomes, then re-sync spec.json"). No ALL-CAPS, max one emoji.

### 2. MODIFY `packages/spec/src/claude/hooks/spec-state.cjs` — slim the reminder

- Keep: active-spec discovery, state fingerprint cache, one-line reminder when unchanged.
- Replace the full red block (lines ~101–121, `### 🔴 URGENT SYSTEM TOLLGATE...` and the
  bilingual MANDATORY wall) with a compact state-change block, ≤7 lines, English only,
  no ALL-CAPS threats. Content to keep: feature, phase, task counts, next unblocked
  task, plus two short rules: "sync `spec.json` + task file after verified work; run
  `node .claude/scripts/validate-spec-output.cjs specs/<feature>` before
  `ready_for_implementation=true`", and one line noting the Stop-gate:
  "A completion gate verifies receipts when you end a turn with newly-done tasks."
- Do not change exit-code behavior, cache mechanics, or the no-active-spec path.

### 3. MODIFY `packages/spec/src/claude/settings/settings.json`

Register the gate FIRST in the existing `Stop` entry's hooks array (before `state.cjs`):
`node "$CLAUDE_PROJECT_DIR/.claude/hooks/spec-gate.cjs"`. No new matcher syntax.

### 4. MODIFY `packages/spec/src/claude/migration-manifest.json`

Add `hooks/spec-gate.cjs` to `runtime.files`.

### 5. MODIFY `packages/spec/src/claude/runtime.json` (template)

Add key `"spec": { "scaffold_guard": true, "completion_gate": true }` (documents both
toggles; hooks must treat a missing key as ON).

### 6. NEW `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`

Follow the existing subprocess pattern (`privacy-block.test.js`): spawn the hook with a
JSON payload on stdin inside a temp dir fixture (`specs/<feature>/spec.json` +
`tasks/task-R0-01-x.md`), assert exit code + stdout. Minimum 7 tests:
1. newly-done task WITHOUT receipt → stdout JSON `decision:"block"`, reason names the
   task path (seed the cache file first with the task as `pending`, then flip to done);
2. newly-done task WITH valid receipt → no block output, cache updated;
3. no active spec → exit 0 silent;
4. `stop_hook_active: true` → exit 0 silent even with a violating task;
5. first run (no cache file) with a done-without-receipt task → exit 0 (historical),
   cache file created;
6. `runtime.json` `spec.completion_gate: false` → exit 0 silent;
7. receipt with `{{...}}` placeholder in Evidence → blocked (check c).

The self-test runner auto-discovers `__tests__/*.test.js` — no wiring needed, but
verify the count goes 143 → 150.

### 7. MODIFY `packages/spec/src/claude/rules/state-sync.md`

Add one short paragraph under the Tollgate section: completion is now machine-gated on
Stop (receipt required for newly-done tasks; escape hatch `spec.completion_gate`).

### 8. Changelogs

`packages/spec/CHANGELOG.md` + `docs/project-changelog.md`, under `## [Unreleased]`:
`### Added` — spec-gate Stop hook (what it blocks, escape hatch, first-run behavior);
`### Changed` — spec-state reminder slimmed (state-change block, no more red wall).

## Constraints

- Do NOT modify: `hooks/state.cjs`, `task-scaffold-guard.cjs`, any skill SKILL.md, any
  agents, the OpenCode tree (`src/opencode/`), installer (`bin/`), `.env*`.
  (SKILL prose diet is a separate task — món 4.)
- Do NOT use any `TaskCompleted`/`TaskCreated` hook event in settings.json — that
  event's output contract is unverified in this codebase's target version; this task
  gates on Stop only. (Note this as a follow-up idea in the changelog if you like.)
- Do NOT run `git commit`, `git push`, `git stash`.
- New hook must never exit non-zero and never write outside `hooks/.logs/`.
- Obey repo `CLAUDE.md`; keep hook file ≲200 lines; comments explain intent, English.

## Completion Criteria

1. `spec-gate.cjs` exists, registered in settings Stop (first), listed in manifest
   `runtime.files`; behavior matches Scope §1 items 1–8.
2. `spec-state.cjs` contains no `URGENT`, no `BẮT BUỘC`, no `CẤM`; state-change block
   ≤7 lines; one-line unchanged path intact.
3. `runtime.json` template has the `spec` key with both toggles `true`.
4. All 7 new tests pass; full suite passes with **150 tests executed**.
5. Both changelogs updated.
6. `git status` shows only the files named in Scope (+ this brief).

## Evidence required

```bash
node --test packages/spec/src/claude/hooks/__tests__/spec-gate.test.js
cd packages/spec && npm test          # expect: PASS: 150 tests executed
grep -c "URGENT\|BẮT BUỘC\|CẤM" packages/spec/src/claude/hooks/spec-state.cjs   # expect 0
grep -n "spec-gate" packages/spec/src/claude/settings/settings.json packages/spec/src/claude/migration-manifest.json
git status --short
```
