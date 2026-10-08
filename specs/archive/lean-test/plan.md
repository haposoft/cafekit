# Lean test — goal, constraints and output standards instead of numbered steps
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-07)
- Existing:
  - `packages/spec/src/claude/skills/test/SKILL.md` is 197 lines, hard-wrapped near 80 columns: Usage (`:20-32`), Hard gates (`:34-45`), Target routing (`:47-60`), `<SCOPE-GATE>` (`:64-68`), five numbered Spec-Aware steps (`:70-81`), seven numbered Execution steps (`:83-101`, step 4 is the flaky rule from `specs/test-flaky-repair`), the proof table (`:103-113`), the handoff (`:115-134`), the write/auth boundary (`:136-149`), Verdict and report (`:151-183`, the placement paragraph from `specs/test-proof-repair`), Flash (`:185-190`), References (`:192-197`). Joining the hard wraps alone gives 144 lines.
  - Pins: `packages/spec/scripts/run-skill-self-tests.mjs:2074-2204` (`TEST_PLAN_NATIVE_PATHS`, whitespace-normalized clauses, among them the whole sentence "This step does not apply to process-first Named probes, which run exactly once." at `:2204`), raw `indexOf` mutation anchors at `:2280-2320` applied by `replaceDevelopClauseOnce` (`:2575-2580`, throws when an anchor is missing; on `SKILL.md` only `profile-cross-origin` spans a line break, `SKILL.md:145-146`), `:4684-4691` (`Spec-Aware Mode`, `/cf:test <feature-name>`), `packages/spec/bin/__tests__/develop-contract.test.js:206-207`, `:422`; `evals/test/save-runs.mjs:23` detects loading by the title `# Test — execution proof owner`.
  - Instruments: `evals/test` (10 cases), `evals/run.sh` (sha256 `a75cd5b5…`), `evals/lean/{loaded,compare,budget}.mjs`. Old cells cost $0.9–1.8 (sonnet) and $1.7–3.6 (opus) each (`evals/results/test/{base,kho,sau,ondinh,rong}-*`).
- Minimum change: rewrite `test/SKILL.md` to at most 120 lines — the twelve numbered steps become standard lines, hard wraps are joined, every pinned clause and every rule in task 03's rule map stays; teach the lean helpers the test graders; measure the current and lean skill side by side.
- Expansion signals: none — 1 skill, 2 test files, 3 helper files.
- User decision: KEEP (test only; code-review, develop and the rest are later packets), ≤120 lines, 10 runs per cell on sonnet and opus, eval cap $200; win = no `REGRESS` while line count falls.

## Out of scope
- `test/references/*`, the test frontmatter and description, any `evals/test` case, grader or scaffold, `evals/run.sh`; other skills; npm publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `test/SKILL.md` keeps frontmatter and `<SCOPE-GATE>` byte-identical, the title line, every heading (including `## Spec-Aware Mode`), Hard gates, the routing table, the proof table, the handoff key list, the boundary rules, the Verdict template and its placement paragraph, Flash and References with words unchanged; wrapped prose may be joined, but no sentence is split across lines and no pinned word changes (the flaky rule keeps "This step"); the five Spec-Aware and seven Execution numbered steps become unnumbered standard lines under their existing headings, keeping every rule-map phrase (task 03); Usage keeps the line `/cf:test <feature-name>` and may otherwise list the same forms on fewer lines; the self-test may change only the `profile-cross-origin` anchor string to its joined form (same mutation name, issue and replacement) | a deeper ≤90 rewrite that edits rule wording | user decision at GATE-SCOPE; prior lean packets lost behaviour only where wording was dropped (`specs/lean-ask` Review log) | the model follows standards without the step skeleton | ≤120 is not reachable with every kept item → stop and ask the user; a `REGRESS` → reported at GATE-DONE |
| D-02 | Measure 9 cases (all but `tron-legacy`) × 2 models, both sides fresh: `lean-goc-<case>-<model>` on the skill bytes of `13304cd4` (the last commit touching the skill; HEAD `7ff52692` holds the same bytes) in task 02, `lean-sau-<case>-<model>` on the lean skill (task 04) | measuring `tron-legacy`; reusing `base-*`/`sau-*` | `tron-legacy` expects `BLOCKED` for a `plan.md` + `spec.json` packet (`evals/test/tron-legacy/scaffold.sh:2`) while `specs/legacy-specs-read-removal` D-02 made that packet process-first, so its grader no longer matches the skill on either side; old cells ran on 2.1.286/2.1.288 | the host stays 2.1.291 (`DISABLE_AUTOUPDATER=1`) | `HOST-DRIFT` → named at GATE-DONE |
| D-03 | Every invocation: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH DISABLE_AUTOUPDATER=1; unset FORCE_COLOR`; `evals/run.sh test --plugin-name cf --out <name> --model claude-<sonnet|opus>-5-5 --judge-model claude-sonnet-5-5 --runs <n> --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Write Edit Bash --case <case> --keep-temp`; two lanes, one per model, one invocation at a time per lane; pilots `--case sach`, sonnet 3 runs, opus 1 | the bare `sonnet`/`opus` alias | settled method of `specs/lean-ask` D-03 and `specs/test-eval-baseline` | — | a pilot not loaded → stop and ask the user |
| D-04 | `evals/test/compare.mjs` exports `JOINT` (keyword only; its CLI is already guarded at `:205`); `evals/lean/compare.mjs` gains a `test` class table (D-05), excludes `tron-legacy` from its case list, and derives `joint` per run as `JOINT[case](Object.fromEntries(r.graders.map((g) => [g.name, g.passed === true])))` (it takes a name → bool map, `evals/test/compare.mjs:35`); every cell is saved with `evals/test/save-runs.mjs` right after it runs and archived under `evals/results/test/_kept/`, and task 04 pairs the six process-first cases with `evals/test/check-payload.mjs --pair` (delivered, valid, placed); `budget.mjs` is used as is with `--skills test --cap 200` | new helpers; `evals/test/compare.mjs` alone (no `REGRESS` rule) | one home for the lean comparison | — | — |
| D-05 | Classes for test. Safety — `khong-sua-*`, `khong-ghi`, `khong-edit`, `khong-file-moi`, `khong-node-modules`, `khong-cai`. Primary — `verdict`, `chay-dung-lenh`, `chay-test`, `bao-fail`, `bao-pass` (inverted: passing means a PASS verdict on the flaky `chap-chon` case, so a rise is worse), `khong-payload`, `joint`. Watch — `chay-lenh-thay`, `chi-blocked`, `kiem-cong-cu`, `neu-nguyen-nhan`, `bao-pww`, `bao-blocked`, `chay-lai`, `khong-json`; and `chay-dung-lenh` in `trung-probe`, `thieu-cong-cu` and `khong-cham-code` (a per-case override: there a correct `BLOCKED` may stand in for running it). `REGRESS` as `specs/lean-fix-debug` D-05 (safety off its best value, a 0.2 bad move, or a pooled Fisher p < 0.05) | per-cell p only; flaky and payload graders as watch | the flaky rule (`specs/test-flaky-repair`: `bao-pass` 2→0/10, `bao-fail` 8→10/10 on `chap-chon` sonnet) and the payload placement (`specs/test-proof-repair`) moved behaviour and must be able to flag; the ALT members count only through `joint` (`evals/test/compare.mjs:30-35`); either-or graders as watch follows `specs/specs-fast-lane` D-07 | — | any `REGRESS` → named at GATE-DONE |
| D-07 | Cross-packet schedule (user decision at GATE-REVIEW, 2026-10-07, for every lean packet): task 01 and task 03 run only when no sibling lean packet (lean-develop, lean-code-review, lean-research, lean-sync) has its task 01 or task 03 `in_progress` (its paid tasks 02 and 04, which edit no shared file, do not block) and `git status --short evals/lean packages/spec` shows no change outside the task's owned files; `specs/_shared/active-feature.json` names `lean-test` before any task of this packet starts; self-test edits are located by string, not line number; paid cells run while `pgrep -f '[c]laude plugin eval' | wc -l` is below 2 (wait otherwise), the counts before and after go to `<dir>/lane.txt`; a quota error stops the task and asks the user | parallel edits of `evals/lean/compare.mjs` and `run-skill-self-tests.mjs`; unbounded lanes | sibling reviews: shared files and machine load can fail or skew a cell for reasons outside the packet | — | a sibling edit in progress → wait |
| D-06 | A cell that errors, stops early, comes back partial or below 10 loaded runs reruns once into `<cell>-lan1`; the helpers use `-lan1` when it exists | rerun until clean | packet rule since `specs/lean-fix-debug` | — | a short `-lan1` → task `blocked`, ask the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | test is written as goal/constraints/standards, ≤120 lines, gate, pins, anchors, every step rule and the words of every kept part intact | skill text, tests | `skills/test/SKILL.md`, self-test (one anchor string) | none | elevated — installed skill for Claude and Codex | source: self-test (with the node suite) |
| CP-02 | the lean skill is measured against the current one on the same nine cases | helper extension, paid runs | `evals/lean/compare.mjs`, `evals/test/compare.mjs`, `evals/results/test/lean-*` | none | elevated — paid runs | runtime: 36 result directories, loaded 10/10 each, saved, digest-stamped; payload pairs |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The lean helpers shall compare test cells by D-05's classes with a derived `joint`, and their self-tests and `evals/test/compare.mjs --self-test` shall pass. | task 01 Command |
| AC-02 | The current test skill shall be measured in 18 cells (9 cases × 2 models), each loaded 10/10, before any skill edit. | task 02 Command |
| AC-03 | `test/SKILL.md` shall be at most 120 lines with no numbered list outside fenced blocks, keep frontmatter and `<SCOPE-GATE>` byte-identical, every heading and every rule-map phrase, keep the words of every kept part after whitespace normalization, and the full self-test shall pass. | task 03 Command |
| AC-04 | The lean skill shall be measured in the same 18 cells on task 03's final bytes and compared with AC-02's cells, graders and payload pairs, for GATE-DONE. | task 04 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Teach the lean helpers the test graders | P1 | AC-01 | `evals/lean/compare.mjs`, `evals/test/compare.mjs` | - | done |
| 02 | Measure the current test skill | P1 | AC-02 | `evals/results/test/lean-goc-*` | task-01 | done |
| 03 | Rewrite test lean | P1 | AC-03 | `skills/test/SKILL.md`, self-test | task-02 | done |
| 04 | Measure the lean test skill and compare | P1 | AC-04 | `evals/results/test/lean-sau-*`, `compare-test.txt` | task-01, task-03 | done |

## GATE-DONE report
- As in `specs/lean-ask`: per-section source comparison before/after (kept verbatim, joined, rewritten, removed with reason, line counts) from `git diff 13304cd4 -- packages/spec/src/claude/skills/test`.

## Known limits
- `tron-legacy` is not measured (D-02); a stale case is a later instrument packet.
- Rules the rewrite touches with no grader: task selection by dependencies, `--full`, the compile/typecheck precheck, "Inspect negative paths, runtime reachability, and declared artifacts", drift captured apart from Head, redaction, "read the tests that cover the target" (measured once by other tooling in `specs/test-flaky-repair`), and the Usage forms (every case uses one fixed prompt). Their wording is guarded only by the rule map.
- Kept traces live under `/private/tmp` and vanish on reboot; each cell is checked, saved and archived in the same step that runs it.
- `budget.mjs` counts only finished `result.json`; two lanes may overshoot the cap by at most one cell (≈ $8).
- A server-side model change between the two sides cannot be detected beyond `host.txt`.
- Ten runs a side detect only large per-cell moves; the safety rule and the pooled test are the guard.
- The lean comparison counts runs that hit the turn or time cap; `evals/test/compare.mjs` leaves them out.

## Cost
18 cells a side at ≈ $1.3 (sonnet) and ≈ $2.8 (opus) ≈ $37; both sides plus 4 pilots ≈ $80. Cap $200.

## Review log
- Round 1 (2026-10-07, two fresh reviewers): 9 deduplicated findings, verdict FAIL before repair. User at GATE-REVIEW: accept all 9. Applied: keep "This step" (pin `:2204`) (1); raw anchors and the `Spec-Aware Mode` / `/cf:test <feature-name>` pins named, the `profile-cross-origin` anchor may follow the joined line (2); `bao-fail`, inverted `bao-pass` primary (3); `save-runs`, `check-payload --pair`, `khong-payload` primary (4); rule map +3 phrases and a words-unchanged check (5); `chay-dung-lenh` watch in the ALT cases (6); Known limits (7); `skill-digest.txt` per cell (8); exit code, `JOINT` map, HEAD wording, backtick note (9). Paper review closed after this round (B4).
- Task 02 (2026-10-07): the first Receipt was written and then withdrawn by the controller: runs that failed on the account's session limit or a revoked OAuth token (not the skill) left cells with fewer than 10 counted runs, and the Command did not count `base ok runs=10` lines although the Oracle required them. The Command now asserts 18 such lines (task 04 asserts 18 `errored base=0 after=0` lines); the failed cells rerun into `-lan1` (D-06).
- **GATE-DONE (2026-10-08): the user accepted the packet as complete** ("XONG 4 gói, develop vá thêm"), from current receipts: full self-test PASS 1351 after all lean packets; the limits named in each task 04 Receipt stand. Not committed yet.
