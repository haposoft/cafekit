# Legacy spec.json read removal
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-07)
- Existing: the Stop gate already splits on `processWorkflow` (`packages/spec/src/claude/hooks/spec-gate.cjs:180`); its legacy-only branches are the 2.1 closeout block (`:186`), stale Flash check (`:218`), `checkTaskReceipt` (`:244`), feature receipt and `completionDecisionForSpec` (`:248-260`). Codex mirrors them (`packages/spec/src/codex/hooks/spec-gate.cjs:105-222`, `spec-state.cjs:63-166`). `resolveWorkflowCandidate` merges legacy candidates (`packages/spec/src/claude/scripts/spec-resolver.cjs:907-930`) and `inspectWorkflowFeature` skips any dir holding `spec.json` (`:224-226`). Legacy receipt functions: `checkTaskReceipt`, `checkFeatureReceipt`, `readTaskProof` (`packages/spec/src/claude/scripts/spec-receipt.cjs:266-299`, `:436`). `spec-final-state.cjs` serves only the resolver's legacy closeout check (`spec-resolver.cjs:771`). Codex and omp installers remove only obsolete `hooks/` files (`packages/spec/bin/phases/codex-runtime.js:34`, `omp-runtime.js:139`).
- Minimum change: hooks, resolver and receipt read only process-first packets (`plan.md` + flat `task-NN-*.md`, inline Receipt); a leftover `spec.json` packet gets one notice per session and never blocks Stop; `workflow-policy.cjs` keeps only what kept callers reach; instructions and the user guide stop describing legacy compatibility; Codex and omp upgrades delete obsolete `scripts/` files.
- Expansion signals: about 30 touched files, one subsystem (the Specs runtime); four sequential tasks. Task 01 is large because the resolver change and every test built on a `spec.json` fixture must move together for the suites to stay green.
- User decision: KEEP, Codex included; a leftover legacy packet gets a one-line notice, the Stop gate never blocks on it.

## Out of scope
- Renaming test files whose names still say legacy or v2 (`validator-grounding`, `specs-v2-*`).
- `docs/` files other than `docs/specs-usage-guide.md`, `docs/installer-architecture.md` and the changelog.
- Migrating any existing `spec.json` packet to `plan.md`.
- The session hook not reading `specs/_shared/active-feature.json` (observed: it reports "Multiple active specs" while the Stop gate honors the file).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | One task changes resolver behavior, both hook sets and every `spec.json`-fixture test together; exports, policy and text follow | Hooks first; resolver alone first | Once the resolver stops returning legacy packets, every legacy-fixture test across six files changes outcome at once; splitting leaves a task that cannot be green | Hooks consume only the resolver/receipt/policy exports listed in task 02–03 | A suite fails because a later-task export is still required → finish the caller change in the current owner task, never restore legacy behavior |
| D-02 | A legacy packet is a direct `specs/<x>/` holding `spec.json` and no `plan.md`; a dir with both is read as process-first | Any `spec.json` marks legacy | Hybrid dirs otherwise become invisible to the gate (F3) | Process-first parsing ignores `spec.json` | A hybrid dir with an unreceipted done task passes Stop → resolver still short-circuits; fix in task 01 |
| D-03 | Prune `workflow-policy.cjs` to a named keep list | Reachability guess; rewrite | Explicit keep list is checkable (F7) | Keep list: `deriveRuntimeContext`, `validateCanonicalReceipt`, `receiptValidatorOptions`, `isTapMetadataHeading`, `executionPolicy` and the CLI path behind `--flash --parallel --json`, plus private helpers they call | A kept caller needs another export → add it to the keep list with its caller cited |
| D-05 | A legacy-fixture test whose subject is receipt or provenance logic is rewritten on a process-first fixture; one whose subject is legacy-only behavior is deleted | Delete all legacy-fixture tests | Keeps coverage of kept logic (closure round 2) | Receipt/provenance checks behave the same for inline Receipts | A rewritten test cannot express its assertion on process-first → record it in the Receipt as deleted with its reason |
| D-04 | Notice printed by `spec-state` before resolve and touch filter, once per session (state in `hookStateDir`) | `session.cjs`; every prompt | `spec-state` already runs on UserPromptSubmit (`packages/spec/src/claude/settings/settings.json:59`); per-session memo avoids repeats (F6) | Session id available in the payload | Missing session id → print at most once per process run |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Process-first Stop/session decisions are unchanged | remove, refactor | resolver; Claude + Codex `spec-gate`, `spec-state`, `precompact` | none | elevated: runs every session | source tests + before/after test-name diff |
| CP-02 | A leftover `spec.json` packet yields one notice per session and never blocks Stop, including when it is the only packet or is named by `active-feature.json` | modify | resolver, Claude + Codex `spec-state`, `spec-gate` | none (GATE-SCOPE) | elevated | source tests |
| CP-03 | A hybrid dir (`plan.md` + `spec.json`) and a malformed process-first packet are still checked and blocked | modify | resolver, `spec-gate` | none | elevated: gate bypass risk | source tests |
| CP-04 | Shared scripts expose only process-first functions; `spec-final-state.cjs` is gone and Claude, Codex and omp upgrades delete obsolete scripts | remove, modify | `spec-resolver.cjs`, `spec-receipt.cjs`, `spec-final-state.cjs`, manifest, Codex/omp installer phases | none | elevated: installed runtime | source tests + reinstall test |
| CP-05 | `workflow-policy.cjs` keeps exactly the D-03 keep list; `--flash --parallel --json` exits 2 | remove | `workflow-policy.cjs` | none | elevated | source tests + positive/negative export check |
| CP-06 | Instructions and the user guide no longer describe legacy compatibility | modify | 10 instruction files, 2 docs, changelogs | none | routine | self-test |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the Stop or session hook runs on a process-first packet, the hook shall produce the same decision as before this change. | kept process-first tests pass; before/after test-name diff lists only removed legacy tests |
| AC-02 | If `specs/<x>/spec.json` exists without `plan.md`, `spec-state` shall print one line naming `<x>` as an unsupported legacy packet once per session, also when it is the only packet, and the Stop gate shall print nothing because of it, also when `active-feature.json` names it. | new tests (Claude + Codex) |
| AC-03 | If a dir holds both `plan.md` and `spec.json`, or a process-first packet is malformed, the Stop gate shall still check it and block a done task without a valid Receipt or the malformed packet. | new tests |
| AC-04 | The resolver and receipt modules shall export no function that reads `spec.json`, `receipts/` or `feature-receipt.md`; reinstalling Claude, Codex or omp shall delete `scripts/spec-final-state.cjs`. | export check + reinstall test |
| AC-05 | `workflow-policy.cjs` shall export every D-03 keep-list function and none of `classifyLane`, `completionDecisionForSpec`, `approvalState`, `planningObligationsFor`; `--flash --parallel --json` shall exit 2. | `node -e` check + develop-contract test |
| AC-06 | Skills, agents, rules, `docs/specs-usage-guide.md` and `docs/installer-architecture.md` shall contain no instruction about legacy `spec.json` packets, separate `receipts/` or `feature-receipt.md`. | grep + self-test |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Resolver and Claude + Codex hooks read only process-first packets; legacy-fixture tests rewritten or removed | P1 | AC-01, AC-02, AC-03 | `spec-resolver.cjs`, Claude + Codex `spec-gate`/`spec-state`/`precompact`, Codex `lib/spec-utils.cjs`/`lib/spec-receipt.cjs`, legacy-fixture tests | - | done |
| 02 | Legacy exports and spec-final-state removed; Codex/omp upgrades delete obsolete scripts | P1 | AC-04 | `spec-resolver.cjs`, `spec-receipt.cjs`, `spec-final-state.cjs`, manifest, `bin/phases/codex-runtime.js`, `omp-runtime.js` | task-01-runtime-reads.md | done |
| 03 | workflow-policy keeps only the D-03 keep list | P2 | AC-05 | `src/claude/scripts/workflow-policy.cjs` | task-02-shared-exports.md | done |
| 04 | Instructions, user guide and changelogs drop legacy compatibility | P2 | AC-06 | instruction files, 2 docs, changelogs | task-03-workflow-policy.md | done |

## Review log
- Round 1 (3 fresh reviewers: fact/contract, failure-mode/flow, assumption/scope/proof): 10 deduplicated findings F1–F10 (1 Critical, 6 High, 3 Medium); user accepted all on 2026-10-07. Applied: task order resolver-first and per-task test ownership (F1, F10), guard replacement (F2), hybrid dir read as process-first (F3), `active-feature.json` ignores legacy dirs (F4), `invalid_specs` branch kept and reworded (F5), notice placement and per-session dedupe (F6), before/after test-name diff and policy keep list (F7), installer scripts cleanup moved to task 04 (F8), instruction file list, wider grep and two docs added (F9). Sweep: 7 files reread / 10 deltas / old task files replaced / 0 conflicts left.
- Round 2 (fresh closure pass): F2–F4, F6–F10 PASS; F1 FAIL (resolver change breaks legacy-fixture tests owned by later tasks) and F5 FAIL on Codex (no malformed-packet test); 5 new contradictions. Repairs within accepted findings: tasks 01–03 merged into task 01 owning every legacy-fixture test (D-01, D-05); Codex malformed-packet test added; kept probes rewritten on process-first fixtures; `active-feature.json` ignores only a dir with `spec.json` and no `plan.md`, a missing dir still yields `explicit_not_found`; hook grep includes `spec\\.json`; task 04 grep excludes `src/codex/hooks`; task 02 owns `spec-narrowing.test.js` calls of `resolvePersistedSpec`. Paper-round limit reached; later findings need runtime evidence. Sweep: 5 files reread / 9 deltas / 6 old task files replaced by 4 / 0 conflicts left.
