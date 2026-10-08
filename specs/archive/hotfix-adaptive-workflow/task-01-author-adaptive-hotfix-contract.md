# Task 01 — Author the adaptive hotfix contract

Status: done

## Outcome
`hapo:fix` (authored in the manifest-owned `hotfix` directory; public name renamed post-C3, re-approved 2026-08-30) consumes the adaptive debug handoff, scales depth proportionally, reports through the shared verdict surface, and delegates only through the scout Delegation Gate — with every new invariant guarded by a static mutation checker.

## Coverage
- CP-01, CP-02, CP-03, CP-04, CP-05 (source half)

## Scope
- In: rewrite `SKILL.md` (keep the six-step frame, side-effect gate, scout-first and root-cause gates); update the stale content in `diagnosis-protocol.md`, `review-cycle.md`, `parallel-patterns.md`, `prevention-gate.md`; add the adaptive hotfix contract and mutation groups to the static harness; keep the seven existing hotfix probes (`run-skill-self-tests.mjs:3489-3498,3517-3555`) enforced, updating them coherently where the retoned prose moves their anchor strings.
- Out: reference consolidation or renames; `escalation-tactics.md` and `workflow-specialized.md` beyond mechanical cross-reference fixes; any change to other skills, hooks, or runtime scripts; installed projection tests and guides (task 02).

## Ownership
- Modify: `packages/spec/src/claude/skills/hotfix/SKILL.md`
- Modify: `packages/spec/src/claude/skills/hotfix/references/diagnosis-protocol.md`
- Modify: `packages/spec/src/claude/skills/hotfix/references/review-cycle.md`
- Modify: `packages/spec/src/claude/skills/hotfix/references/parallel-patterns.md`
- Modify: `packages/spec/src/claude/skills/hotfix/references/prevention-gate.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/src/claude/skills/debug/SKILL.md`, `packages/spec/src/claude/skills/inspect/SKILL.md`, `packages/spec/src/claude/skills/test/SKILL.md`, `packages/spec/src/claude/skills/code-review/SKILL.md`

## Acceptance
- AC-01: the root-cause contract lists `Trigger` and `Contributing factors` alongside the existing seven fields; `--from-debug` validation names `Evidence Timeline`, `Elimination Path`, and — when present — `Recurrence-Prevention Handoff`. A `skipped` marker for the timeline is valid in either producer form (`Timeline: skipped - <reason>` or `- skipped: <reason>`); a report missing the required fields routes back to diagnosis instead of implementation.
- AC-02: fix verification and review reporting use only `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`; the numeric confidence score is gone; `PASS_WITH_WARNINGS` routes through the same remediation/user-pause path as `FAIL` and never auto-accepts; the definition of `PASS` defers to `hapo:code-review`; review-only results cannot finish a fix; completion claims require fresh command output.
- AC-03: the side-effect gate keeps its five checks and the stop-with-2–4-options behavior, and each of the five checks becomes an explicit mutation anchor in the new adaptive checker.
- AC-04: every subagent dispatch (parallel scouts, parallel fixes, deep research) is conditioned on the scout Delegation Gate, reproducing its three canonical clauses from `packages/spec/src/claude/skills/inspect/references/internal-inspection.md:10-13` (explicit user request/permission for delegation or parallel agents; runtime Explore/delegation capability; at least two distinct, non-overlapping scopes with useful independent work); task tools are an optional fallback, never a required step; version metadata bumps to 2.0.0.
- Static half of AC-05: the harness gains `hapo:hotfix adaptive contract is complete and bounded` and `hapo:hotfix checker rejects semantic weakenings` with one nonempty mutation group per invariant above, while the seven existing hotfix probes (`run-skill-self-tests.mjs:3489-3498,3517-3555`) stay enforced — a probe whose anchor string moves (e.g. the review-cycle verdict probe at `:3489-3498` when the enum becomes the shared surface) is updated coherently with equivalent-or-stronger assertions plus a replacement mutation group, never deleted or weakened.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes: `hapo:fix adaptive contract is complete and bounded`; `hapo:fix checker rejects 28 semantic weakenings`; `hotfix review cycle consumes severity verdicts`; `hapo:fix is deterministic scout-first without mode selection`; `hapo:fix quick path never skips scout or diagnosis`; `hapo:fix enforces no-side-effect gate with user options`; `hapo:fix references are local and not stale debugger paths`; `hapo:fix prevention gate points back to side-effect sweep`; `hapo:fix review cycle uses pause conditions not mode selection` (re-approved 2026-08-30 after the public rename).
- Reachability: `--static-only -> runStaticSemanticTests() -> hotfix contract tests` (same wiring as the existing six probes)
- Oracle: canonical bytes produce zero issues and exit 0; each disposable mutation produces its exact owning nonempty issue set; missing, extra, or wrong issue detection fails the outer harness nonzero.
- Counterexample: reintroducing a numeric confidence score, dropping `Contributing factors` from the `--from-debug` contract, replacing the shared verdict enum, or allowing subagent dispatch without the Delegation Gate must each produce its owning issue.
- Artifacts: none durable — mutations run on disposable in-memory copies; canonical file SHA-256 values and `git status` must be identical before and after the command.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs --static-only
✔ hapo:fix adaptive contract is complete and bounded
✔ hapo:fix checker rejects 28 semantic weakenings
✔ hotfix review cycle consumes severity verdicts
✔ hapo:fix is deterministic scout-first without mode selection
✔ hapo:fix quick path never skips scout or diagnosis
✔ hapo:fix enforces no-side-effect gate with user options
✔ hapo:fix references are local and not stale debugger paths
✔ hapo:fix prevention gate points back to side-effect sweep
✔ hapo:fix review cycle uses pause conditions not mode selection
[skill-test] PASS: 528 focused static tests executed
Exit: 0
Reachability: --static-only -> runStaticSemanticTests() -> runHotfixAdaptiveContractTests().
Negative proof: exact issue-set assertions covered the current Fix contract and 28 semantic weakenings.
Cleanup: mutations ran on in-memory copies; git status was identical before and after the command.
Review: PASS — current Fix source and semantic guards were independently reviewed with no material finding.
```
