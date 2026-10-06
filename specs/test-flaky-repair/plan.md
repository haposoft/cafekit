# Test flaky repair — cf:test reads the tests and reruns a nondeterministic one before an ordinary PASS
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-04)
- Existing:
  - A test whose repeated runs differ is `FAIL` (`packages/spec/src/claude/skills/test/references/failure-triage.md:13`), but nothing tells the agent to read the tests or repeat a run. The ordinary route only derives commands (`references/execution-strategy.md:56-60`); the Execution list (`SKILL.md:85-94`) runs the command once.
  - The process-first route runs every Named probe exactly once (`references/execution-strategy.md:52-54`), so a rerun rule belongs to the ordinary route only.
  - Measured in `specs/test-eval-coverage` (`claude` 2.1.288, the current graders): `rong-chap-chon-sonnet` PASS 2/10 — both runs one green `npm test`, the test file never read, no rerun; `rong-chap-chon-opus` PASS 0/10; `rong-thuong-sach-*` joint 10/10.
  - `evals/test/` holds the cases, graders and tools; `budget.mjs` packets; `compare.mjs --base … --after …`.
- Minimum change: one Execution step in `SKILL.md` and one paragraph in `execution-strategy.md` §2 with pinned clauses and mutations; a `flaky` budget packet; four after-cells `ondinh-{thuong-sach,chap-chon}-{sonnet,opus}` compared with `rong-*`.
- Expansion signals: none (about five files).
- User decision: KEEP — four cells; the rule "read the executed tests, rerun when they depend on a nondeterministic source"; 10 runs per cell, descriptive; cap $100.

## Out of scope
- The process-first and legacy routes (apart from the one-run exclusion sentence); any grader change; new cases; `thuong-do` and the process-first cases as after-cells; a threshold or a significance claim; the test-proof-v1 digest and collation gaps; pushing unless asked.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `SKILL.md` Execution gains, after step 3 (renumbering the rest), the full rule, because the agent loads `SKILL.md` but read `execution-strategy.md` in only 1 of 10 runs per model (GATE-REVIEW F-01): "4. For Ordinary non-Spec testing, before any `PASS` or `PASS_WITH_WARNINGS`, read the tests that cover the target or changed code (every test file when the suite is small). When an assertion or its pass condition depends on a nondeterministic source — the clock, randomness, the network, shared filesystem state or test order — the verdict is `FAIL`, naming the source, even when every run passes. When only setup depends on one, rerun just the suspect tests at least twice more; any differing outcome is `FAIL` as flaky. A single green run of such a test is not `PASS`. This step does not apply to process-first Named probes, which run exactly once." `execution-strategy.md` §2, after the ordinary-scope paragraph, repeats it as backup: "Before an Ordinary non-Spec `PASS` or `PASS_WITH_WARNINGS`, read the tests that cover the target or changed code (every test file when the suite is small). A nondeterministic source in an assertion or its pass condition is `FAIL`, naming the source, even when every run passes. A source only in setup means rerunning just the suspect tests at least twice more; any differing outcome is `FAIL` as flaky (`failure-triage.md`). A process-first Named probe still runs exactly once." `failure-triage.md:13`'s evidence cell becomes "repeated current runs with differing outcomes, or an assertion or pass condition that depends on a nondeterministic source" (user decision at closure). | always rerun once; read only; reruns alone deciding (a 50/50 test agrees three times in 1 of 8) | catches the measured miss whether or not the runs differ (user decision at GATE-REVIEW); bounded to the related tests (user decision) | the agent loads `SKILL.md` | a self-test fails → repair the wording, not the tests |
| D-02 | `run-skill-self-tests.mjs` gains `requireClauses("ordinary-nondeterminism", …)` over the four sentences of the `SKILL.md` step (read; assertion `FAIL`; setup rerun; process-first exclusion), the assertion and process-first sentences of §2 and the triage evidence cell, with mutations `flaky-read`, `flaky-assert`, `flaky-rerun` and `flaky-process-first` (each drops one `SKILL.md` sentence) and `flaky-triage` (drops the new triage clause), registered in the `mutations` list the semantic-weakening check runs | — | pinned wording guards the repair | — | — |
| D-03 | `budget.mjs --packet flaky` sums every `result.json` under a directory whose basename starts with `ondinh-`, at any depth, and `_kept/ondinh/**/*.lost.json`, against $100; ceiling per model the larger of `max(4, ⌈12 × highest pilot⌉)` over the existing `thuong-sach` and `chap-chon` pilots and the before-cells' cap ($4 both); `fits` over two cells per model; other packets unchanged | new pilots (the before-cells already give costs) | equal footing with `rong-*` | — | — |
| D-04 | Cells `ondinh-<case>-<model>` for `thuong-sach`, `chap-chon` × sonnet, opus, 10 runs, the driver of `specs/test-eval-coverage` task 04 with every path under `_kept/ondinh/t03/` and every budget call through `--packet flaky`; ≥7 loaded per cell; at most three cap raises; no grader-repair round; a guard that `evals/test/{thuong-sach,chap-chon,fixture}`, `compare.mjs`, `save-runs.mjs` and `evals/run.sh` match commit `d3f9da7` (the state the before-cells ran under); `compare.mjs --base rong- --after ondinh-`; the Command prints each after-cell's cost beside its before-cell's; hand-reading of every `chap-chon` run (verdict, test file read, real reruns, differing outcome reported) and every `thuong-sach` run's test reads and reruns; the Receipt lists each after-cell's cost beside its before-cell's; no threshold — the user decides at GATE-DONE; `claude` 2.1.288, `node` v22.23.3 | a threshold | as earlier packets | — | another `claude` version → stop for the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Before an Ordinary non-Spec PASS the skill makes the agent read the related tests, return FAIL for a nondeterministic assertion and rerun suspect tests when only setup is nondeterministic | modify | `SKILL.md`, `references/execution-strategy.md`, `references/failure-triage.md`, `run-skill-self-tests.mjs` | none | elevated — installed skill behaviour | source: task 01 |
| CP-02 | The flaky packet is budgeted | modify | `evals/test/budget.mjs` | none | routine — $0 | source: task 02 |
| CP-03 | The repaired skill is measured against `rong-*` | verify | `evals/results/test/ondinh-*` | none | elevated — paid | runtime: task 03 |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the target is Ordinary non-Spec testing, the skill shall tell the agent to read the tests covering the target or changed code before a PASS, to return `FAIL` when an assertion or its pass condition depends on a nondeterministic source, and to rerun suspect tests when only setup does, keeping process-first Named probes at one run; the self-tests shall fail when any of the five pinned clauses is dropped. | task 01 |
| AC-02 | `budget.mjs --packet flaky` shall count only `ondinh-*` cells and `_kept/ondinh/` lost files, with other packets' spend unchanged. | task 02 |
| AC-03 | Four after-cells shall each hold ten clean runs with ≥7 loaded, and `compare.mjs --base rong- --after ondinh-` shall print every grader, `joint` and the run counts, within $100. No conclusion is drawn there. | task 03 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | The skill reads and reruns before an ordinary PASS | P1 | AC-01 | `packages/spec/src/claude/skills/test/{SKILL.md,references/execution-strategy.md,references/failure-triage.md}`, `packages/spec/scripts/run-skill-self-tests.mjs` | - | done |
| 02 | The flaky packet is budgeted | P1 | AC-02 | `evals/test/budget.mjs` | - | done |
| 03 | The repair is measured | P1 | AC-03 | `evals/results/test/ondinh-*` (and `-lan1`, `_capped/` copies), `_saved/ondinh-*`, `_kept/ondinh-*.tar.gz`, `_kept/ondinh/t03/` | task-01-skill-reads-and-reruns.md, task-02-flaky-budget.md | done |

## Cost
- Estimate: four cells ≈ $5–8 (before-cells cost $0.82–1.93 each; reruns may add turns); cap $100.

## Known limits
- The graders read words; `chay-lai` counts Bash calls, not executions.
- n = 10 per cell: 2/10 against 0/10 gives p ≈ 0.47; the numbers describe, they do not prove.
- Changing `evals/test/budget.mjs` changes the `evals-test-digest` that earlier packets' Commands guard (`specs/test-eval-baseline` tasks 04–05, `specs/test-eval-hard` tasks 03–04, `specs/test-proof-repair` task 03, `specs/test-eval-coverage` tasks 03–04); their Receipts are unaffected, but those Commands no longer re-run as written.
- Task 02's Command pins the hard, repair and coverage spends; any new `pilot-thuong-sach-*` or `pilot-chap-chon-*` would move the coverage spend and break it. No such pilot is planned.
- The new `SKILL.md` step sits in the Execution list both routes read; its last sentence keeps process-first Named probes at one run, and no process-first after-cell measures that.
- Whether a test file was read, and whether a source is in an assertion or only setup, is hand-read.
- Sandbox `git` fails with an `xcrun` cache error; the graders read the harness's file state.
- The before-cells ran on skill digest `7b24ad29…f6ad91`; the after-cells run on the repaired skill under the same `claude`, graders and fixture.

## Review log
- GATE-SCOPE (2026-10-04): KEEP; read the executed tests and rerun when nondeterministic; 10 runs, descriptive; cap $100.
- GATE-REVIEW round 1 (2026-10-04): one fresh `code-auditor` review returned 13 findings (2 High). The user accepted all and decided: an assertion or pass condition depending on a nondeterministic source is `FAIL` even when the runs agree (F-02); reading and rerunning are bounded to the related tests (F-05). Applied: the full rule in `SKILL.md` with the process-first exclusion (F-01, F-06), the term "Ordinary non-Spec testing" (F-13), four pinned sentences and mutations (F-03), whitespace-normalised greps (F-04), a guard on the before-cells' instrument (F-07), printed before/after costs (F-08), checked ceilings (F-09), the fixed-spend and digest limits (F-10, F-12), the `SKILL.md:85-94` citation (F-11).
- Closure pass, round 2 (2026-10-04, fresh `code-auditor`): PASS_WITH_WARNINGS, 3 Medium and 5 Low. The user chose to bring `failure-triage.md` into task 01 so its flaky row matches F-02. Applied without new decisions: §2 says "every test file when the suite is small" like `SKILL.md`, and its assertion and rerun clauses are separate sentences; AC-01 and CP-01 restated; a fifth mutation `flaky-triage`; task 01's Command greps the decided clauses verbatim; the cost line is labelled final-directory cost. Paper rounds end here.
