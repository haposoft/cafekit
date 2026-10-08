# Decouple the gate and session hooks from the legacy authority hooks
Specs-Contract: process-first-ready-v1

Packet 3a of `plans/20261006-hook-cleanup-roadmap.md` (packet 3 split into 3a decouple, 3b remove, 3c docs). Work context: worktree `../cafekit-chore-remove-usage-hook`, branch `chore/hook-cleanup` (a5097d8); commands run from `packages/spec/`.

## Scope decision (GATE-SCOPE — 2026-10-06)
- Existing: the Claude Stop gate loads `./completion-authority-check.cjs` inside its policy `try` and blocks every Stop when it fails (`src/claude/hooks/spec-gate.cjs:100-111`), falls back to its `resolveCandidate` only when the resolver lacks `resolveWorkflowCandidate` (`:132-134`), and, for a legacy `schema_version: '2.1'` packet, computes `explicitCloseout` (`:189-190`) and calls `evaluateCloseout` (`:191-204`), which replaces the receipt checks only at closeout (`status` in done/completed/complete or a closeout phase) and returns `active:false` mid-execution so the ordinary receipt checks run (`src/claude/scripts/spec-final-state.cjs:239-285`). The Codex gate requires the same module at load time (`src/codex/hooks/spec-gate.cjs:22`, used at `:59`, `:110-123`). Claude `session.cjs` clears the authority state inside a `try` (`src/claude/hooks/session.cjs:205`); Codex `session.cjs` requires it at load time (`src/codex/hooks/session.cjs:13`, used at `:92`). Existing tests that touch this: `bin/__tests__/specs-v2-execution-closeout.test.js:328-346` (gate on a 2.1 packet) and `src/claude/hooks/__tests__/completion-authority.test.js:501-503,562-564` (session clears pending/grant state).
- Minimum change: the two gates load nothing from `completion-authority-*`; a legacy `2.1` packet whose `explicitCloseout` is true is blocked with a plain message, while a `2.1` packet mid-execution keeps the ordinary receipt checks; the Codex session hook loads the authority state module only inside a `try`, like Claude's, and both keep clearing the state (dropping that clear waits for 3b, when the approval flow is removed). The five legacy hook files — `completion-authority.cjs`, `completion-authority-check.cjs`, `completion-authority-state.cjs`, `semantic-review-authority.cjs`, `task-scaffold-guard.cjs` — stay in place (3b removes them).
- Expansion signals: seven files; one subsystem.
- User decision (2026-10-06): split packet 3 into 3a/3b/3c, in order; legacy `2.1` closeout is blocked with a clear message; Strict validation reports "no longer supported" — done in 3b together with deleting `semantic-review-authority.cjs` and the tests that assert Strict success.

## Out of scope
- Deleting any hook file, registrations, manifest, upgrade pruning, Strict validation (3b); docs, CLAUDE.md/AGENTS.md/rules, web (3c).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Gates drop the `completion-authority-check` require and the `resolveCandidate` fallback; when `!processWorkflow && schema_version === '2.1' && explicitCloseout` the gate blocks with "Legacy spec.json closeout is no longer supported; move the packet to plan.md with flat task files"; otherwise the 2.1 packet falls through to the ordinary receipt checks | Keep the branch until 3b; block every 2.1 packet; use `status === 'done'` | `explicitCloseout` already exists in both gates and covers done/completed/complete and closeout phases (a `completed` status would otherwise slip through silently) | 3b can then delete files without crashing any gate | Every shipped resolver exports `resolveWorkflowCandidate` (Claude `spec-resolver.cjs:866`, Codex `lib/spec-utils.cjs:103`) | A gate falls through to `undefined` resolver → keep a resolver-shape guard |
| D-02 | Codex `session.cjs` loads `completion-authority-state.cjs` inside a `try` and keeps clearing the state; Claude unchanged | Drop the clear now | The approval flow still runs until 3b; dropping the clear would let pending/grant state outlive a session and give contradicting Stop guidance (user decision F4) | A guarded require that fails leaves SessionStart exiting 0 | Codex SessionStart exits non-zero without the file → widen the guard |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Claude and Codex Stop gates and session hooks run with the five legacy hook files absent; process-first gating unchanged with or without them; `2.1` closeout blocked with the message; `2.1` mid-execution still receipt-checked | refactor | `spec-gate.cjs` ×2, Codex `session.cjs`, two existing test files | none | elevated — the Stop gate guards every packet | source + installed |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | With the five legacy hook files present and with them deleted from an install, the Claude and Codex Stop gates shall pass a process-first packet whose done task has a valid Receipt and block one whose done task has none. | task-01 Command |
| AC-02 | When a legacy `spec.json` packet with `schema_version: '2.1'` has `status` `done` or `completed`, both gates shall block with a reason containing `Legacy spec.json closeout is no longer supported`; when it is `in_progress` with a done task lacking a receipt, both shall block with the ordinary missing-receipt reason. | task-01 Command |
| AC-03 | While the five legacy hook files are absent, the Claude and Codex session hooks shall exit 0 on SessionStart; with them present, both still clear the authority state (existing `completion-authority.test.js` cases stay green). | task-01 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Gates load no authority module; Codex session guards it | P1 | AC-01, AC-02, AC-03 | `src/claude/hooks/spec-gate.cjs`, `src/codex/hooks/spec-gate.cjs`, `src/codex/hooks/session.cjs`, `bin/__tests__/legacy-authority-decoupled.test.js`, `bin/__tests__/specs-v2-execution-closeout.test.js` | - | done |

## Review log
- Round 1 (2026-10-06, one fresh-context reviewer with a real install and a temp-copy simulation): 7 findings, all accepted; F4 decided as "defer dropping the session clear to 3b". F1 the Command hid five failing tests (gate on 2.1 in `specs-v2-execution-closeout.test.js:328-346`; four session-clear cases in `completion-authority.test.js`); F2 closeout = `explicitCloseout`, mid-execution 2.1 keeps receipt checks; F3 pin `# tests` and `# fail`; F5 citations; F6 name the five files; F7 compare with and without the files, separate project for the 2.1 fixture.

## Completion (GATE-DONE — 2026-10-06)
- User decision: done ("ok bro"), after the Receipt and the controller's full package run (`[skill-test] PASS: 1630 tests executed`) were shown.
- Accepted limitations as presented: 2.1 stale-semantics detection at closeout no longer exercised; a 2.1 packet mid-execution with an invalid `status` is no longer rejected as invalid.
