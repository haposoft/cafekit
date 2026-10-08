# Task 01 — Port layout, quota, and cost into status.cjs with behavioral proof

Status: done

## Outcome
The shipped statusline renders a config-driven `statuslineLayout`, weekly quota with reset countdowns, and billing-guarded cost — staying self-contained and byte-identical to today when the new key is absent — proven by a behavioral fixture test.

## Coverage
- CP-01, CP-02, CP-03, CP-04 (behavioral half)

## Scope
- In: extend `status.cjs` with a small internal section registry (section id → renderer; ids `model`, `context`, `quota`, `directory`, `git`, `plan`, `cost`, `changes`) resolved from a global `config.statuslineLayout = { lines: [[id, ...], ...] }`; each inner array is one output line; modes only slice line count (minimal = first line, compact = first two, full = all); agents/todos rendering stays outside `lines` behind their own enable flags; unknown ids are ignored, empty or invalid values fall back to defaults. Add the weekly quota window + reset countdown with the 300000ms freshness gate; enable `cost` as a layout-gated default-disabled section (`💵`, two decimals). Keep the `ck-context-<session>.json` write unconditional and independent of layout. Surface `statuslineLayout` pass-through in `hooks/lib/config.cjs`; ship **no** template key. Add `hooks/__tests__/statusline.test.js` driving `status.cjs` as a child process (default-identity, custom-layout order, unknown-id, mode-slice, quota fresh/stale, cost-gate combinations, context-file write, NO_COLOR).
- Out: any `cafekit-ref` lib import; PR #55's spec-slug feature; `runtime.json` template edits; static harness probes and guides (task 02); Codex surfaces.

## Ownership
- Modify: `packages/spec/src/claude/status.cjs`
- Modify: `packages/spec/src/claude/hooks/lib/config.cjs`
- Create: `packages/spec/src/claude/hooks/__tests__/statusline.test.js`
- Read: `~/Desktop/cafekit-ref/.claude/ak-engineer-statusline.cjs`, `~/Desktop/cafekit-ref/.claude/hooks/lib/statusline-section-registry.cjs`, `~/Desktop/cafekit-ref/.claude/hooks/lib/statusline-render-modes.cjs`, `packages/spec/src/claude/hooks/lib/context.cjs`

## Acceptance
- AC-01: with no `statuslineLayout` key and a fixture carrying no fresh usage cache and no cost data, rendered output is byte-identical to the pre-change implementation under the pinned environment.
- AC-02: `lines[][]` renders exactly the named known sections in order per line; modes slice the line count; unknown ids are ignored with no crash and no placeholder; empty or invalid layout falls back to defaults.
- AC-03: a fresh cache (`Date.now() − timestamp < 300000`, `status: 'available'`) renders `5h` and `wk` windows with reset countdowns (digits asserted by pattern, not golden bytes); a stale or missing cache renders no quota area — the freshness gate on the previously ungated five-hour path is a deliberate, declared behavior change.
- AC-04: cost renders only when the layout enables it AND billing mode is API AND cost data exists (`💵`, two decimals); the `ck-context-<session>.json` write occurs regardless of layout with `percent`/`tokens` asserted; both existing colors-probe anchors stay intact — the `colors.setColorEnabled(config.statuslineColors !== false)` call form and a real `colors.shouldUseColor` usage.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js`
- Named probe: default-identity; custom-layout order; unknown-id; mode-slice; quota-fresh; quota-stale; cost-gate matrix; context-file write; NO_COLOR
- Reachability: `node --test -> spawn status.cjs as a child process -> assert stdout sections and the context temp file`
- Environment pins (all mandatory): spawn `cwd` = a fixture root containing its own `.claude/runtime.json`; isolated `TMPDIR` (and `TEMP`/`TMP` on Windows) per case; `NO_COLOR`/`FORCE_COLOR` scrubbed from the child env except in the NO_COLOR case; `COLUMNS` pinned; the identity fixture contains no usage cache and no cost data; countdown digits asserted by regex; fixtures resolved via `__dirname` so the test passes from any cwd.
- Oracle: all behavioral cases pass with executed > 0 and exit 0; the default-identity case fails if any byte of default output changes under the pinned environment.
- Counterexample: reordering two ids within one line, rendering a placeholder for an unknown id, showing quota from a stale cache, rendering cost without layout enablement, or skipping the context-file write under a custom layout must each fail its owning case.
- Artifacts: none durable — fixtures live beside the test; temp state under the per-case isolated TMPDIR; `git status` identical before and after the command.

## Receipt

Verification: PASS
Command: node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js
✔ statusline default output is byte-identical to the golden fixture when no layout is configured
✔ statusline custom layout renders named sections in order per line
✔ statusline ignores unknown section ids without crashing or rendering placeholders
✔ statusline modes slice the layout line count (minimal renders only the first line)
✔ statusline empty or invalid layout falls back to the default renderers
✔ statusline shows five-hour and weekly windows with countdowns when the cache is fresh
✔ statusline hides the quota area when the cache is stale
✔ statusline cost renders only when the layout enables it, billing is api, and data exists
✔ statusline writes the ck-context session file regardless of layout
✔ statusline honors NO_COLOR with no ANSI escapes in output
10/10 behavioral cases executed, 0 failed
Exit: 0
Reachability: node --test -> spawn status.cjs as a child process under pinned env (fixture cwd + isolated TMPDIR/TEMP/TMP + scrubbed color vars + COLUMNS) -> assert stdout bytes and the ck-context temp file.
Negative proof: default-identity compares bytes against a golden captured from the pre-change HEAD renderer (reviewer independently replayed HEAD and confirmed byte-equality); fallback re-verified across four invalid-layout variants; the cost matrix covers all four gate combinations with exit-0 asserted on every branch.
Cleanup: per-case mkdtemp roots removed on exit; git status was identical before and after the command.
Review: PASS — code-auditor (0 Critical, 0 High, 0 Medium; 5 Low, of which three — escape-sequence style and missing negative-branch status asserts — were applied and the command rerun fresh; two remain documented non-blocking).
```
