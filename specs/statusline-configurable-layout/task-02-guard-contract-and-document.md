# Task 02 — Guard the contract and document configuration

Status: done

## Outcome
The statusline layout contract is guarded by static probes in the harness, the full regression suite stays green, and operators can configure `statusline`, `statuslineColors`, and `statuslineLayout` from the guides.

## Coverage
- CP-04 (static half), AC-06 guide surface

## Scope
- In: add static probes to the harness pinning **source anchors** of the layout contract — the section-registry literal (its id list), the absent-key fallback branch string, the cost guard expression, and the `seven_day` anchor — plus guide probes pinning `statusline`, `statuslineColors`, and `statuslineLayout` in both `../../README.md` and the package `README.md` (precedent: probe with `file: "../../README.md"` at `run-skill-self-tests.mjs:2843`). Keep the existing colors probe (`run-skill-self-tests.mjs:4933-4939`, both anchors) enforced unchanged in intent. Probes must not pin the `planPart`/ctx-literal region verbatim (PR #55 overlap). Document the three keys in the two guides.
- Out: behavioral test changes beyond what task 01 authored; `cafekit-web` pages; changelogs; any `status.cjs` edit. Static probes pin anchors only; behavior-level identity is proven by task 01's behavioral suite running inside the same `npm` command, not by probes.

## Ownership
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Modify: `README.md`
- Modify: `packages/spec/README.md`
- Read: `packages/spec/src/claude/status.cjs`, `packages/spec/src/claude/hooks/__tests__/statusline.test.js`

## Acceptance
- AC-05: removing a pinned source anchor (registry literal, fallback branch, cost guard, `seven_day`) fails its owning static probe; the pre-existing colors probe stays enforced with both anchors; the full suite exits 0 on canonical bytes with the new behavioral test counted and executed > 0. A behavior change that preserves anchors is caught by the behavioral suite inside the same command, not by probes.
- AC-06: `README.md` and `packages/spec/README.md` document `statusline`, `statuslineColors`, and `statuslineLayout` (modes, section ids, lines[][] shape, absent-key default) without timing or live-adherence claims, and the guide probes pin all three keys in both files.

## Dependencies
- task-01-port-layout-quota-cost.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probe: the new statusline anchor probes and guide probes; `statusline colors respect runtime config` (pre-existing, unchanged in intent); the behavioral suite from task 01 running under the package test entry
- Reachability: `npm test -> hooks/__tests__ suites + runStaticSemanticTests -> statusline probes`
- Oracle: the full suite exits 0 on canonical bytes; each named anchor removal fails its owning probe; zero executed tests is not a pass.
- Counterexample: deleting the absent-key fallback branch string from `status.cjs`, or shipping guides without the three keys, must each fail an owning probe; changing fallback behavior while keeping the string must fail the behavioral default-identity case inside the same command.
- Artifacts: none durable — `git status` identical before and after the command.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ npm --prefix packages/spec test
✔ statusline layout contract keeps registry, fallback, cost gate, and weekly anchors
✔ repository guide documents statusline configuration
✔ package guide documents statusline configuration
✔ statusline colors respect runtime config
✔ statusline default output is byte-identical to the golden fixture when no layout is configured (214.335333ms)
[skill-test] PASS: 1167 tests executed
Exit: 0
Reachability: npm test -> runStaticSemanticTests (statusline anchor + guide probes) + hooks/__tests__ glob (statusline behavioral suite inside the same command).
Negative proof: each pinned anchor is byte-exact and unique in status.cjs (reviewer verified grep -cF = 1 per anchor); guide probes were absent at HEAD and require the quoted "statusline" key so they cannot pass vacuously; behavior-level weakenings are caught by the 10-case behavioral suite in the same run.
Cleanup: git status was identical before and after the command; the suite's transient source-tree .logs artifact was removed after completion (known bug, tracked separately).
Review: PASS — code-auditor (0 Critical, 0 High, 0 Medium; 2 Low non-blocking: comment-anchor softness and guide parity note); probes verified to avoid the PR #55 overlap region.
```
