# Task 02 — Align consumers, prove parity, and document handoff

Status: done

## Outcome
Runner/review consumers, behavioral fixtures, and disposable installs preserve
the plan-native handoff, while the usage guide explains it without runtime or
timing claims.

## Scope
- In: behavioral fixtures, semantic weakening checks, Claude/Codex projection
  parity, concise usage guidance, and regression coverage for proof side effects.
- Out: live-host adherence, actual authenticated-site E2E, package release,
  browser implementation, or benchmark execution.

## Coverage
- CP-03
- CP-04
- CP-05

## Ownership
- Modify: `packages/spec/src/claude/agents/test-runner.md`
- Modify: `packages/spec/src/claude/skills/code-review/SKILL.md`
- Modify: `packages/spec/bin/__tests__/develop-contract.test.js`
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `docs/specs-usage-guide.md`
- Read: `packages/spec/bin/phases/copy-payload.js`
- Read: `packages/spec/bin/lib/codex-install.js`
- Read: `packages/spec/src/claude/skills/develop/SKILL.md`
- Read: `packages/spec/src/claude/skills/develop/references/quality-gate.md`
- Read: `packages/spec/src/claude/skills/develop/references/subagent-patterns.md`

## Acceptance
- AC-03: test-runner emits only `test-proof-v1`; code-review consumes the same
  controller-validated proof without creating or searching for a process-first
  separate receipt. Unknown legacy results fail closed through the four verdicts.
- AC-04: a disposable proof flow asserts memory absence/bytes are unchanged,
  Test-owned temporary outputs are cleaned, project-command tracked/untracked/
  ignored drift is surfaced without relying only on Head, and no automatic
  project-local install, report, cache, or auth-state write occurs.
- AC-05: source/consumer/installed text retains origin-bound auth, destructive
  action consent, secret/PII redaction, and concise proof/report separation.
- AC-06: disposable Claude and Codex installs preserve the updated skill and all
  three references; docs distinguish process-first from legacy handoff.
- AC-06: because Task 01 owns the shared static checker, final stabilization
  reruns Task 01's exact command after Task 02 and before C3 if Head is stale.
- AC-06: behavioral contract tests prove `test-proof-v1` is a strict superset of
  the existing Develop verification handoff fields and that Develop remains the
  sole inline Receipt/Status writer; no Develop source edit is required unless
  the test first demonstrates an incompatible consumer.

## Dependencies
- task-01-author-plan-native-test-contract.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probes: `Test process-first handoff preserves proof ownership and side-effect boundaries`;
  `Claude installed Test preserves plan-native proof and references`;
  `Codex installed Test preserves plan-native proof and references`;
  `specs-usage-guide documents Test proof handoff without timing claims`.
- Reachability: source Test files flow through payload copy and Codex transform
  into disposable native installs; test-runner emits and code-review consumes
  the handoff; existing Develop skill/quality-gate/subagent-patterns consume its
  command, exit, counts, output, reachability, proof level, and observed Head;
  guide text is checked by a named probe.
- Oracle: full runner exits 0 with nonzero execution and every named behavioral,
  negative, consumer, installed, and guide probe executing and passing.
- Counterexample: a consumer emits a legacy verdict, looks for a separate flat
  receipt, drops a payload field, changes ignored memory, leaks auth material,
  loses a reference during projection, or claims measured speed/live adherence;
  its owning probe fails.
- Artifacts: disposable fixtures only; no retained generated report.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
> @haposoft/cafekit@0.16.0-rc.8 test
> node scripts/run-skill-self-tests.mjs
✔ Test process-first handoff preserves proof ownership and side-effect boundaries
✔ Claude installed Test preserves plan-native proof and references
✔ Codex installed Test preserves plan-native proof and references
✔ specs-usage-guide documents Test proof handoff without timing claims
[skill-test] PASS: 1167 tests executed
```
