# Statusline configurable layout
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-09-01)

- Existing: CafeKit ships a self-contained statusline `packages/spec/src/claude/status.cjs` (544 lines; five lib deps at `status.cjs:17-22` — color, parser, counter, config, git) with three render modes (`renderMinimal` at `status.cjs:309`, `renderCompact` at `:325`, full), git staged/unstaged/ahead/behind indicators (`:125-131`), a five-hour quota read (`:465`), and cost display present but commented out (`:157`, data read at `:483`). The renderer also writes the session context file `ck-context-<session>.json` (`status.cjs:432-445`) consumed by `hooks/lib/context.cjs:267-283` — a load-bearing side contract. Config flows through `hooks/lib/config.cjs:521-522` (defaults `:56-57`) from `runtime.json` keys `statusline`/`statuslineColors` (`runtime.json:6-7`). One static probe pins the colors contract with two anchors (`run-skill-self-tests.mjs:4933-4939`, including `colors.shouldUseColor` used inside `render()` at `status.cjs:364`); no behavioral statusline test exists. `status.cjs` is manifest-tracked (`migration-manifest.json:123`). The reference implementation `~/Desktop/cafekit-ref/.claude/ak-engineer-statusline.cjs` (221 lines + 8 lib modules, 2,202 lines) adds a config-driven `statuslineLayout` (global `{ lines: [[sectionId, ...], ...] }` shape at `statusline-section-registry.cjs:156-225`; modes only slice line count), a weekly quota window with reset countdowns, and layout-gated cost text (default-disabled at `statusline-section-registry.cjs:21`).
- Minimum change: port the reference **semantics** into the existing self-contained `status.cjs` — never the AgentKit lib cluster. (1) Add `statuslineLayout`: a global `{ lines: [[sectionId, ...], ...] }` value resolved from project runtime config; each inner array is one output line; modes only slice the line count (minimal = first line, compact = first two, full = all); agents/todos rendering stays outside `lines` behind their own enable flags; valid section ids are `model`, `context`, `quota`, `directory`, `git`, `plan`, `cost`, `changes`. When the key is absent and the fixture carries no fresh usage cache and no cost data, output is byte-identical to today. (2) Add the weekly quota window plus reset countdowns — a deliberate, declared default-output change whenever the usage cache is fresh (`Date.now() − cache.timestamp < 300000` and `status: 'available'`). (3) Enable cost as a layout-gated section, default-disabled, rendered only when the layout enables it, billing mode is API, and cost data exists (`💵` with two decimals, preserving the expression commented at `status.cjs:157`). (4) Preserve the `ck-context-<session>.json` write unconditionally, independent of layout. (5) Add a behavioral statusline test plus static probes, keeping both existing colors-probe anchors intact. The `runtime.json` template ships **no** `statuslineLayout` key, so the absent-key state stays real on fresh installs; the key is documented in the guides instead.
- Expansion signals: none — one subsystem, about seven touched files across two sequential tasks; importing the AgentKit lib cluster was explicitly rejected at C1.
- User decision: **KEEP** — port features into `status.cjs`, stay self-contained. PR #55 (active-spec-slug, touches the same file) is deliberately left open and untouched; its feature is out of scope and the merge-conflict risk is accepted by the user.

## Out of scope

- Importing or adapting any `cafekit-ref` lib module (`ck-config-utils`, section-registry, render-modes files); AgentKit branding or config keys.
- PR #55's active-spec-slug feature and any edit intended to ease or block that PR. Quantified overlap: PR #55 carries four hunks on `status.cjs`, three of which intersect the port region (`renderSessionLines`, the `main()` activePlan block, the ctx literal); after this packet lands, PR #55 must rebase and refresh its own fixtures/probes. Task-02 probes must avoid pinning the `planPart`/ctx region verbatim.
- The `docs/` living documents (e.g. `docs/installer-architecture.md:149` mentions the statusline) — deferred to the docs-sync flow.
- Codex projection (statusline is a Claude Code runtime surface; `.codex` has no statusline).
- `cafekit-web` docs pages — conscious exclusion; refresh deferred to the post-implementation docs-sync flow, same as prior packets.
- Changelog entries for this feature — deferred to the docs-sync flow.
- Live rendering guarantees inside a real Claude Code session; proof is fixture-driven process output plus static contracts.

## Coverage profile

| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | `statuslineLayout` (global `{ lines: [[sectionId, ...], ...] }`; modes slice line count; agents/todos behind separate flags; unknown ids ignored; empty/invalid value falls back to defaults) selects and orders output lines; when the key is absent and the input carries no fresh usage cache and no cost data, rendered output stays byte-identical to today | add | installed runtime UI + config schema | none | elevated — config surface at `config.cjs:521-522`, manifest-tracked file | source + installed |
| CP-02 | The quota area shows five-hour and weekly windows with reset countdowns when the usage cache is fresh (`Date.now() − timestamp < 300000` and `status: 'available'`); a stale or missing cache hides the quota area — a deliberate, declared change to today's ungated five-hour render | add | installed runtime UI | none | routine — extends the cache read at `status.cjs:465`; `seven_day` already cached verbatim by `usage.cjs:137-138` | source |
| CP-03 | Cost renders as a layout-gated, default-disabled section: only when the layout enables it, billing mode is API, and cost data exists; format `💵` with two decimals | modify | installed runtime UI | none | routine — `status.cjs:157,:483` | source |
| CP-04 | The `ck-context-<session>.json` write survives the registry rewrite unconditionally (independent of layout), and a behavioral case asserts the file's `percent`/`tokens` after render | modify | cross-hook side contract | none | elevated — producer `status.cjs:432-445`, consumer `context.cjs:267-283` | source |
| CP-05 | A behavioral test drives `status.cjs` as a child process with fully pinned environment and asserts default-identity, layout order, unknown-id, mode-slice, quota-freshness, cost-gate, context-file, and NO_COLOR cases; static probes pin source anchors (registry literal, fallback branch, cost guard, `seven_day`) while both existing colors-probe anchors stay enforced | add | test + checker | none | elevated — zero behavioral coverage today; colors probe anchors at `run-skill-self-tests.mjs:4933-4939` | source |

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | Where project runtime config carries no `statuslineLayout` and the fixture carries no fresh usage cache and no cost data, the statusline shall render byte-identical output to the current implementation under the pinned test environment. | `node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js` |
| AC-02 | When `statuslineLayout.lines` names ordered known section ids, the statusline shall render exactly those sections in that order per line, slice lines by mode, ignore unknown ids without crashing or rendering placeholders, and fall back to defaults for an empty or invalid value. | `node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js` |
| AC-03 | While the usage cache is fresh (`Date.now() − timestamp < 300000`, `status: 'available'`), the statusline shall show five-hour and weekly windows with reset countdowns (digits asserted by pattern, not golden bytes); a stale or missing cache shall hide the quota area. | `node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js` |
| AC-04 | When the layout enables the `cost` section, billing mode is API, and cost data exists, the statusline shall render `💵` with two decimals; in every other combination it shall render no cost text. The `ck-context-<session>.json` write shall occur regardless of layout, with `percent`/`tokens` asserted after render. | `node --test packages/spec/src/claude/hooks/__tests__/statusline.test.js` |
| AC-05 | When the statusline contract is weakened in source, static probes pinning source anchors (registry literal, fallback branch, cost guard, `seven_day`) shall fail, both anchors of the pre-existing colors probe (`colors.setColorEnabled(config.statuslineColors !== false)` and `colors.shouldUseColor`) shall stay enforced, and the full regression suite shall stay green on canonical bytes; behavior-level weakenings are caught by the behavioral suite running inside the same command. | `npm --prefix packages/spec test` |
| AC-06 | Where operators read the repository or package guides, statusline configuration (`statusline`, `statuslineColors`, `statuslineLayout`) shall be documented without timing or live-adherence claims, pinned by static probes on both guide files. | `npm --prefix packages/spec test` |

## Tasks

| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Port layout, quota, and cost into status.cjs with behavioral proof | AC-01–AC-04 | `status.cjs`, `hooks/lib/config.cjs`, new behavioral test | - | done |
| 02 | Guard the contract and document configuration | AC-05–AC-06 | static probes in the harness + usage guides | task-01-port-layout-quota-cost.md | done |

Tasks are sequential: Task 02 guards and documents the exact contract authored by Task 01.

## Review log

- Round 1 (2026-09-01): two fresh reviewers produced 12 deduplicated findings (4 High, 7 Medium, 1 Low). User accepted all 12 — cost resolved as layout-gated default-disabled; the weekly window is a deliberate, declared default change when the cache is fresh; no `statuslineLayout` key ships in the `runtime.json` template. Reviewers also confirmed: every environment seam needed for deterministic testing already exists, `seven_day` is already cached verbatim by `usage.cjs:137-138`, and the hooks test runner globs `hooks/__tests__/*.test.js` automatically (no wiring debt). All repairs are packet-text edits; C1 scope unchanged. Sweep: 3 files reread / 12 deltas / 1 stale ownership cell fixed post-closure / 0 conflicts left.
- Round 1 closure (2026-09-01): a fresh-context reviewer replayed all twelve counterexamples against current packet bytes — 12/12 PASS, every cited repo/reference/PR fact verified (including PR #55's four-hunk overlap). Residual cosmetic drift (Task 01 ownership cell naming `runtime.json`) fixed in the same sweep.
