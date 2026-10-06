# Test eval coverage — measure cf:test on an ordinary project and a flaky test
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-04)
- Existing:
  - With no flat or legacy marker, `cf:test` takes the ordinary non-Spec route (`packages/spec/src/claude/skills/test/references/execution-strategy.md:40`) and derives its commands from the project's files (`:56-60`); a target whose task cannot be read ends with the report and `No payload: target not identifiable.` (`SKILL.md:176`, added by `specs/test-proof-repair`). A test whose repeated runs differ is `FAIL` (`references/failure-triage.md:13`); nothing in the skill makes the agent repeat a run.
  - Measured so far (`specs/test-eval-baseline`, `specs/test-eval-hard`, `specs/test-proof-repair`): only process-first, mixed and malformed packets; never an ordinary project or a nondeterministic test.
  - `evals/test/` has the greeting fixture, the scaffold and grader forms, `check-fixtures.sh`, `save-runs.mjs`, `compare.mjs`, `budget.mjs` (packets), `check-payload.mjs`; `evals/run.sh --plugin-name cf`.
- Minimum change: three cases on the greeting fixture without `specs/` (`thuong-sach`, `thuong-do`, `chap-chon`), their graders, the tools taught the cases and a `coverage` budget, six pilots, six cells × 10 runs; a report without a conclusion.
- Expansion signals: none.
- User decision: KEEP — three cases; `chap-chon` counted, not judged; cap $100.

## Out of scope
- `--full`; a valid legacy packet; `PASS_WITH_WARNINGS` cases; UI modes; any change to `cf:test`; pushing unless asked.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Three cases from the greeting fixture with `specs/` and `claude-scripts/` removed, `package.json`'s `test` script `node --test test/greet.test.js`, committed once, prompt `/cf:test` with no target, `max_turns: 30`, `timeout_seconds: 900`: `thuong-sach` — `greet` implemented, 2 tests pass → `PASS` or `PASS_WITH_WARNINGS` (the ordinary route has no Named probes or Reachability; user decision at GATE-REVIEW), counted apart; `thuong-do` — `greet` unchanged, 2 tests fail → `FAIL`; `chap-chon` — `greet` implemented and a third test `greet ổn định` that passes on an even `process.hrtime.bigint()` and fails on an odd one, so each run passes 3 or fails 1 of 3 at about even odds | `--full` and the other candidates (user cut) | the ordinary route and the flaky rule are the unmeasured surfaces with a cheap fixture | the planted commands behave as stated under bash and zsh | the checker shows otherwise → repair the scaffold before any paid run |
| D-02 | Graders in the baseline forms (first-verdict-label rule, command position): `verdict` (`thuong-sach` PASS or PASS_WITH_WARNINGS, `thuong-do` FAIL; watch `bao-pww` counts `PASS_WITH_WARNINGS` in `thuong-sach`); `chay-test` — a Bash `node --test` or `npm test`/`npm run test` at command position, where command position also follows `do`, `then`, `(` and `{` and allows a `time`, `timeout <n>`, `env` or `VAR=value` prefix, `min: 1`; no-change `khong-sua-{code,test,package}`, `khong-ghi`, `khong-edit`, `khong-file-moi` (allowed: `.git…`, `package.json`, `src/`, `src/greet.js`, `test/`, `test/greet.test.js` — no `specs/`, no `.claude/`), `khong-node-modules`, `khong-cai`; watch `khong-payload` (the line `No payload: target not identifiable.`) and `khong-json` (no fenced block parsing as `test-proof-v1`); `joint` = verdict, `chay-test` and the no-change graders for `thuong-sach` and `thuong-do`. `chap-chon` has no verdict grader in `joint` (user decision): `joint` = `chay-test` and the no-change graders; watch `bao-pass`, `bao-fail`, `bao-blocked` (the first verdict label) and `chay-lai` (`chay-test` with `min: 2`) | judging `chap-chon`'s verdict | the skill does not require a rerun (`failure-triage.md:13`) | lexical reading, as earlier packets | a misread in pilots → one grader-repair round as `specs/test-eval-hard` D-05, then ask the user |
| D-03 | Tools: `compare.mjs` learns the three cases (joint members and per-case watch lists; existing cells unchanged), with a self-test that each case's joint members plus watch graders equal exactly the grader files in `evals/test/<case>/graders/`; `budget.mjs --packet coverage` sums `result.json` under any directory whose basename matches `^(rong-\|pilot-(thuong-sach\|thuong-do\|chap-chon)-)`, at any depth, plus `_kept/rong/**/*.lost.json`, against $100, ceilings over the three cases' pilots with the hard packet's formula, `fits` over three cells per model; other packets unchanged | a new tool | as the earlier packets | — | — |
| D-04 | Pilots `pilot-<case>-<model>` (1 run, loaded), then cells `rong-<case>-<model>`, 10 runs, `--plugin-name cf`, the driver and re-run rules of `specs/test-eval-hard` D-05 with every path under `_kept/rong/` and every budget call through `--packet coverage`; ≥7 loaded per cell; at most three cap raises; `claude` 2.1.288, `node` v22.23.3 | — | as earlier packets | — | another `claude` version → stop for the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Three ordinary-project cases with graders | add | `evals/test/{thuong-sach,thuong-do,chap-chon}/`, `check-fixtures.sh` | none | routine — $0 | source: task 01 |
| CP-02 | The tools know the cases and budget the packet | modify | `evals/test/{compare,budget}.mjs` | none | routine — $0 | source: task 02 |
| CP-03 | Pilots give ceilings | verify | `evals/results/test/pilot-{thuong-sach,thuong-do,chap-chon}-*` | none | elevated — paid | runtime: task 03 |
| CP-04 | The skill is measured on the three cases | verify | `evals/results/test/rong-*` | none | elevated — paid | runtime: task 04 |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The three cases shall scaffold as D-01 states under bash and zsh (`chap-chon` over six runs in each shell), and every grader shall read at least two yes and two no samples. | task 01 |
| AC-02 | `compare.mjs` and `budget.mjs` shall pass their self-tests with the new cases and packet, existing behaviour unchanged. | task 02 |
| AC-03 | Six pilots shall each hold one clean loaded run, and both ceilings shall print and fit $100. | task 03 |
| AC-04 | Six cells shall each hold ten clean runs with ≥7 loaded, and `compare.mjs` shall print every grader, `joint` and the run counts, within $100. No conclusion is drawn there. | task 04 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Three ordinary-project cases with graders | P1 | AC-01 | `evals/test/{thuong-sach,thuong-do,chap-chon}/`, `evals/test/check-fixtures.sh` | - | done |
| 02 | The tools know the cases | P1 | AC-02 | `evals/test/{compare,budget}.mjs` | task-01-three-ordinary-cases.md | done |
| 03 | Pilots give ceilings | P1 | AC-03 | `evals/results/test/pilot-{thuong-sach,thuong-do,chap-chon}-*` with their `_saved/` files and `_kept/` archives, `_kept/rong/t03/`, `_pilot-lan1/`; in the grader-repair round only, the three cases' graders, `check-fixtures.sh`, `compare.mjs` and the Receipts of tasks 01–02 | task-02-tools-know-cases.md | done |
| 04 | The cases are measured | P1 | AC-04 | `evals/results/test/rong-*` (and `-lan1`, `_capped/` copies), `_saved/rong-*`, `_kept/rong-*.tar.gz`, `_kept/rong/t04/` | task-03-pilots.md | done |

## Cost
- Estimate: pilots ≈ $1.5; six cells ≈ $12–18; cap $100.

## Known limits
- The graders read words, as in `specs/test-eval-hard` Known limits.
- `chap-chon` depends on clock parity: a run may see only passes or only failures by chance; its counts describe behaviour, not correctness. `chay-lai` counts Bash calls that run a test, not test executions (a loop in one call counts once); the real number of runs comes from hand-reading in task 04.
- `budget.mjs` without `--packet` sums every `result.json` under `evals/results/test/`, this packet's included.
- Changing `evals/test/` changes the digest the closed Commands of earlier packets guard; their Receipts are unaffected.
- `claude` is 2.1.288 here; earlier packets ran on 2.1.286 (and `specs/test-proof-repair`'s after-cells on 2.1.288).
- Inside the eval sandbox `git` fails with an `xcrun` cache error, so some answers say drift was not captured; the graders read the harness's file state, not the agent's `git status`.

## Review log
- GATE-SCOPE (2026-10-04): KEEP; three cases; `chap-chon` counted not judged; cap $100.
- GATE-REVIEW round 1 (2026-10-04): one fresh `code-auditor` review returned 8 findings. The user accepted the seven technical repairs and chose PASS or PASS_WITH_WARNINGS for `thuong-sach`. Applied: command position after loop and group keywords with common prefixes, and `chay-lai`'s limit; a self-test tying joint and watch lists to the grader files, and a compare over the pilots in task 03's Command; task 02's Command proving `spent=0` and byte-identical existing compare output and other packets' spend; `chap-chon` checked over six bash and six zsh runs with exact counts; the `khong-file-moi` allow list; ownership rows; the unflagged-budget limit.
- Closure pass, round 2 (2026-10-04, fresh `code-auditor`): PASS_WITH_WARNINGS; applied without new decisions: the ownership rows of tasks 03–04 complete; `chay-test` samples for `then`, `{`, `time` and `env`; `compare.mjs` in task 03's grader-repair ownership. Paper rounds end here.
- Develop, task 03 (2026-10-04): a project hook forbids any path with a `coverage/` directory, so the driver could not write `_kept/coverage/t03/`; nothing had run ($0). The user chose to rename it: every `_kept/coverage/` became `_kept/rong/` (`budget.mjs --packet coverage` lost files, tasks 03–04 and this plan); the packet name `coverage` is unchanged. Task 02 was reopened for the change and re-verified.
- Develop, task 03 grader-repair round (2026-10-04): the fresh review of the pilots (PASS_WITH_WARNINGS) found that `chay-test` and `chay-lai` missed a test command after `if`, `while`, `until` or `!` (opus ran `for … do if node --test …; then …; fi; done`; its pilot read right only through a later bare call). The user chose to repair: the command-position prefixes now also allow `if`, `elif`, `while`, `until` and `!`, with samples; the six pilots ran on the earlier graders and read right by hand. The Receipts of tasks 01–02 were re-run on the new digest.
- Develop, task 03 grader-repair round (2026-10-04): re-running task 02 for the new digest failed on its `spent=0` check, which holds only before any pilot. The user chose to replace it: task 02's Command now requires `budget.mjs --packet coverage spent` to equal an independent sum of the packet's own `result.json` files and `_kept/rong/` lost files, within the cap.
