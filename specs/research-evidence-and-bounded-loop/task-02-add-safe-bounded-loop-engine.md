# Task 02 — Add safe bounded Loop engine

Status: done

## Outcome
CafeKit gains an explicit optimization loop that can improve a numeric metric
without trading away correctness or endangering the user's working branch.

## Scope
- In: preflight, metric/guard contract, disposable isolation, one-change
  iterations, keep/discard rule, drift and stop handling, final handoff.
- Out: Autoresearch router, subjective scoring, automatic delivery to the user's
  branch, deploy/publish, or autonomous test/guard edits.

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/src/claude/skills/loop/SKILL.md`
- Create: `packages/spec/src/claude/skills/loop/references/bounded-loop-protocol.md`
- Create: `packages/spec/src/claude/skills/loop/references/metric-and-guard-contract.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-04: preflight freezes the complete numeric sampling/formula contract,
  distinct immutable Guard, pinned base/dirty state, unique run identity,
  canonical root, budget, stop conditions, and exact cleanup/export consent.
- AC-05: each iteration uses a unique detached worktree rebuilt from pinned base
  plus accepted-best patch. Trusted commands run as screened argv with canonical
  `cwd`; shell/interpreter wrappers and Git targeting outside the loop root are
  forbidden, while arbitrary executable side effects remain outside the proven
  boundary without an OS sandbox.
- AC-05: Metric and Guard run on identical fingerprinted bytes. Any tracked or
  untracked oracle mutation is drift. Only one attributable change whose finite
  aggregated value improves current best beyond both noise and minimum delta,
  with the distinct Guard passing, may become the accepted-best patch.
- AC-06: timeout owns an isolated process group/job, terminate-to-kill escalation,
  reap/quiescence, and a never-reused run path. Failure cleans only an exact
  ownership-marked path with upfront consent; uncertainty retains residue and
  returns `BLOCKED`, never destructive recovery.
- Final output is a base-OID-bound patch plus complete scoped file manifest,
  untracked/binary policy, SHA-256, secret/redaction result, accepted/rejected
  ledger, Guard evidence, limitations, and explicit artifact lifetime. It is
  never applied, committed, or stored in the primary worktree implicitly.

## Dependencies
- `task-01-strengthen-adaptive-research-contract.md`

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes: `hapo:loop bounded experiment contract is complete and fail-closed`;
  `hapo:loop checker rejects unsafe semantic weakenings`.
- Reachability: canonical Loop skill and both references.
- Oracle: the runner exits 0 only when mandatory preflight, cooperative command
  trust, detached isolation,
  one-change attribution, metric-plus-Guard keep rule, stop rules, and forbidden
  Git/shell actions coexist.
- Counterexample: a mutation makes Guard optional/non-distinct, accepts NaN or
  ambiguous samples, uses a shell wrapper or external Git `-C`, imports dirty
  scope, permits oracle mutation/surviving descendants, commits the primary
  branch, edits the benchmark, cleans an unowned path, or emits an unbound patch;
  its named probe fails.
- Artifacts: source instruction contract only; live adherence is `[UNPROVEN]`.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ hapo:loop bounded experiment contract is complete and fail-closed
✔ hapo:loop checker rejects unsafe semantic weakenings; count=30
[skill-test] PASS: 528 focused static tests executed
```
