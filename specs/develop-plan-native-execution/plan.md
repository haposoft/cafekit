# Develop plan-native execution
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-26)

- Existing: Develop resolves flat packets, separates proof/review/state ownership,
  supports feature/task modes, and opens C3 after integration
  (`packages/spec/src/claude/skills/develop/SKILL.md:42-123`).
- Minimum change: make the accepted packet an explicit, continuous instruction
  contract with deterministic selection, safe recovery, task-local context, and
  final-Head proof stabilization.
- Expansion signals: more than eight unique Modify paths, executable controller,
  resolver/hook/provenance changes, new state/public modes, or timing evidence.
- User decision: **KEEP** Develop-only on 2026-08-26.

## Out of scope

- Specs/resolver/hooks/provenance/Receipt parser, Sync/Test-agent rewrites,
  legacy migration, executable controller, release, commit, or publish.
- Automatic parallel inference, AK CLI/index/GitHub, new flags/state, mandatory
  agent chains, auto-commit, npm-packed contract proof, or live-model/host E2E.
- Wall-clock claims and all changes or execution under
  `specs/specs-session-timing-benchmark/`.

## Coverage profile

| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Canonical source instructions encode accepted-plan selection, task-local execution, and recovery without routine prompt/replan. | modify | skill routing, queue, resume, dispatch | none/proceed | elevated: workflow authority | source |
| CP-02 | Canonical source instructions encode final-Head, shared-run, parallel, and Flash boundaries without false completion. | modify, fix | verification, handoff, completion | none/proceed | elevated: proof compatibility | source |
| CP-03 | Disposable installed Claude/Codex skills and usage guidance preserve CP-01/02 without timing or runtime-adherence claims. | integrate, document | projection, native transforms, docs | none/proceed | elevated: installed parity | installed |

## Execution contract

- A valid marker-bearing packet reuses C1/C2; only fresh scope-drift evidence may
  reopen C1. Live-model adherence is `[UNVERIFIED]` without a host invocation.
- Feature mode rereads current bytes: `>1 in_progress` stops; exactly one resumes;
  otherwise it selects the first eligible `pending` row in `plan.md` order.
  `paused` stops chaining; `blocked` is never selected or dependency-valid.
- Task mode touches only its target: terminal state reports, paused/blocked/bad
  dependency stops, and successful sync returns without siblings or C3 chaining.
- Recovery discards ephemeral proof, preserves and inspects the owned diff, and
  freshly verifies unmet acceptance. Concurrent invocations are unsupported;
  detected state drift stops before a controller write.
- Load the plan index once, then only the active task's CP rows, dependencies,
  proof, owned code, and consumers; reread before mutation and after sync.
- Before C3, repeat `Head -> stale tasks -> fresh proof -> Head` until stable.
  Proof that mutates non-Specs bytes blocks; the existing repair cap still applies.
- A shared captured run maps each task's exact command, Head, proof level, oracle,
  and uniquely named executed/pass count; skip/todo/cancel/ambiguity cannot close.
- Parallel integration must cover the complete worker range and owned-path tree
  before post-merge proof. Range data stays handoff metadata, not inline Receipt.
- Flash stops `in_progress` without PASS. Only a later explicit non-Flash
  invocation may recover it and close from fresh canonical proof.

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When canonical Develop source receives a valid feature packet, its instructions shall reuse accepted C1/C2 and continuously select tasks without research, replanning, or routine gates before C3. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | For feature or task mode, canonical source shall encode deterministic plan-order selection, paused/blocked/exact-target handling, crash recovery, and fail-stop behavior for multiple active tasks or detected writer drift. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | The source contract shall limit active context to referenced task material and preserve controller-only Status/Receipt writes plus exact-task stopping. | `node --test packages/spec/bin/__tests__/develop-contract.test.js` |
| AC-04 | Before C3, the source contract shall require stable final-Head receipts and reject stale, promoted, remembered, skipped, ambiguous, or incompletely attributed shared proof. | `node --test packages/spec/bin/__tests__/develop-contract.test.js` |
| AC-05 | Where parallel or Flash is explicit, the source contract shall require complete worker-range integration and fresh runtime Base/Head, while Flash remains unfinished until a later non-Flash invocation proves it. | `npm --prefix packages/spec test` |
| AC-06 | When CafeKit installs and documents Develop for Claude and Codex, disposable installed skills shall preserve CP-01/02, existing flags, legacy isolation, line budgets, and the no-timing/no-live-adherence boundary. | `npm --prefix packages/spec test` |

## Tasks

| # | Task | Coverage / criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author plan-native continuous execution | CP-01/02; AC-01–AC-05 | Develop skill + three references + static checker | none | done |
| 02 | Prove native parity and document usage | CP-03; AC-03–AC-06 | behavioral/native tests + static checker + guide | `task-01-author-plan-native-continuous-execution.md` | done |

Task 02 stays queue-gated until Task 01 is done with a valid current Receipt.

## Review log

- C3 — Done: user accepted current receipts and limitations on 2026-08-26.
- Round 1: C2 accepted C2-01–C2-10 on 2026-08-26; two fresh-context closure
  reviewers replayed every original counterexample; all ten repairs PASS.
- Consistency sweep: 4 files reread / 10 accepted deltas / 0 stale references /
  0 conflicts; 3 CP, 6 AC, 8 unique Modify paths; resolver queue ready.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| C2-01 | accepted | Static wording promoted to live behavior | `specs/develop-plan-native-execution/plan.md:29-36`; `specs/develop-plan-native-execution/task-01-author-plan-native-continuous-execution.md:34-36` | `packages/spec/scripts/run-skill-self-tests.mjs:4045-4050` | Live claim remains unverified | PASS |
| C2-02 | accepted | Installed proof deadlocked Task 01/02 | `specs/develop-plan-native-execution/plan.md:29-31,71-72`; both task Coverage sections | `packages/spec/src/claude/skills/specs/references/templates.md:94-102`; `packages/spec/src/claude/scripts/spec-receipt.cjs:296-310` | Source/installed levels split | PASS |
| C2-03 | accepted | Paused/order/exact-target selection ambiguous | `specs/develop-plan-native-execution/plan.md:37-41`; `specs/develop-plan-native-execution/task-01-author-plan-native-continuous-execution.md:37-44` | `packages/spec/src/claude/scripts/spec-resolver.cjs:71-73,241-288` | State cases deterministic | PASS |
| C2-04 | accepted | Crash/multiple-active/Flash reused stale state | `specs/develop-plan-native-execution/plan.md:42-44,53-54`; `specs/develop-plan-native-execution/task-01-author-plan-native-continuous-execution.md:37-44,55-56` | `packages/spec/src/claude/skills/develop/references/subagent-patterns.md:22-31`; `packages/spec/src/claude/skills/develop/references/quality-gate.md:65-80` | Recovery fails closed | PASS |
| C2-05 | accepted | One re-proof pass left another Receipt stale | `specs/develop-plan-native-execution/plan.md:47-48`; `specs/develop-plan-native-execution/task-01-author-plan-native-continuous-execution.md:48-50` | `packages/spec/src/claude/scripts/provenance.cjs:139-190,212-240`; `packages/spec/src/claude/hooks/spec-gate.cjs:228-244` | Fixed point or block | PASS |
| C2-06 | accepted | Shared run hid skipped/duplicate probe | `specs/develop-plan-native-execution/plan.md:49-50`; `specs/develop-plan-native-execution/task-01-author-plan-native-continuous-execution.md:50-52` | `packages/spec/src/claude/scripts/spec-receipt.cjs:239-279` | Per-task attribution required | PASS |
| C2-07 | accepted | Ambient dirt corrupted path audit | `specs/develop-plan-native-execution/research.md:82-84`; `specs/develop-plan-native-execution/task-02-prove-native-parity-and-document-usage.md:53-55,68` | `packages/spec/src/claude/scripts/provenance.cjs:152-183` | Baseline is separate context | PASS |
| C2-08 | accepted | Partial worker range appeared integrated | `specs/develop-plan-native-execution/plan.md:51-52`; `specs/develop-plan-native-execution/task-01-author-plan-native-continuous-execution.md:53-55` | `packages/spec/src/claude/skills/develop/references/parallel-waves.md:17-30,62-85,97-99` | Full range/tree required | PASS |
| C2-09 | accepted | Packed/installed surfaces lacked probes | `specs/develop-plan-native-execution/task-02-prove-native-parity-and-document-usage.md:16-17,49-52,64-68` | `packages/spec/bin/phases/copy-payload.js:130-145`; `packages/spec/bin/lib/codex-install.js:283-304` | Packed removed; installs explicit | PASS |
| C2-10 | accepted | Runtime anchors missing or wrong | `specs/develop-plan-native-execution/research.md:17-32`; `specs/develop-plan-native-execution/task-02-prove-native-parity-and-document-usage.md:31-34,65` | `packages/spec/src/claude/scripts/spec-resolver.cjs:806-834`; `packages/spec/src/claude/scripts/spec-receipt.cjs:239-310`; `packages/spec/src/claude/hooks/spec-gate.cjs:228-244` | Anchors resolve | PASS |
