# Specs routing repair — see file writes, then route clear critical work to specs
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-06)
- Existing:
  - `specs/specs-eval-remeasure/report.md` (recommendation `2c`) found two problems:
    - Sonnet skipped specs and implemented the feature in 3 of 20 build-case runs: `lean-re-dung-o-c1-sonnet` runs 9 and 10, and `lean-re-export-csv-sonnet` run 3.
    - `khong-code` still passed those runs. It only regex-matches `last_message` (`evals/specs/dung-o-c1/graders/khong-code.md`).
  - `evals/specs/sau-keep/graders/khong-sua-code.md` and `khong-viet-code.md` already catch Edit and Write on `src/`, using `tool_used` with `input_match: '"file_path":"[^"]*/src/'` and `min: 0` `max: 0`. They read 10/10 in `lean-re-sau-keep-*`. The build-case fixtures keep their code under `src/` (`evals/specs/dung-o-c1/fixture/src/`).
  - The 120 traces of `lean-re-{dung-o-c1,export-csv,mo-ho-c1,mo-ho-du-cua,khong-kich-hoat,sua-typo}-{sonnet,opus}` were copied to `evals/results/specs/_traces/<cell>/run-NN.jsonl` (gitignored) before `/private/tmp` could lose them.
  - The `cf:specs` description is `packages/spec/src/claude/skills/specs/SKILL.md:3`, 996 characters (1000 bytes) against the 1024 host ceiling. Its skip clause "skip only when a change is clear, isolated, reversible, routine, and likely limited to one or two files." is pinned verbatim at:
    - `packages/spec/scripts/run-skill-self-tests.mjs:704`;
    - `packages/spec/bin/__tests__/codex-native.test.js:164`;
    - `packages/spec/bin/__tests__/package-inventory.test.js:93`.
  - `evals/lean/compare.mjs` compares `lean-goc-*` and `lean-sau-*` cells by a per-skill class table (`:26-45`), which currently has entries for `fix`, `debug` and `ask`. `evals/lean/budget.mjs --skills specs` sums `evals/results/specs/lean-*`, which already includes `lean-re-*` ($22.9475).
- Digest command (every guard in this packet): `(cd <dir> && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16`. For `packages/spec/src/claude/skills/specs` it gives `f208fb4864a8b11d`.
- Minimum change:
  - add the two `src/` write graders to the four routed cases and prove from the saved traces that they catch exactly the three implementing runs;
  - measure the current description;
  - rewrite the description so that critical or elevated work still routes to specs when the request is clear or urgent;
  - measure again and compare.
- Expansion signals: none. About 18 small files (8 grader files, one new negative case, 1 replay script, the skill, the helper, 2 changelogs); no new service; one deliverable.
- User decision:
  - KEEP;
  - sonnet build cells run 20 times on each side, every other cell 10;
  - both sides are measured fresh, so both sides carry the same graders;
  - at GATE-REVIEW the user added one negative case, `sua-nho-lam-luon` (D-06), to measure over-triggering of the new clause.

## Out of scope
- The body of `cf:specs`; `references/*`; the `cf:brainstorm` description; any existing grader, case prompt, fixture or `evals/run.sh`; re-measuring `mo-ho-c1` or `mo-ho-du-cua` (the user kept them out); the fast-lane packet; npm publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Add `khong-sua-code.md` and `khong-viet-code.md`, byte-identical to `evals/specs/sau-keep/graders/`, to `dung-o-c1`, `export-csv`, `mo-ho-c1` and `mo-ho-du-cua`. <br>Prove them with `evals/specs/check-write-graders.mjs`, which replays the same rule (tool name, `JSON.stringify(input)` matching `input_match`, `min`/`max`) over `evals/results/specs/_traces`. <br>As a harness check, it also replays `co-goi-skill` the same way, and that must agree with the stored verdict in all 80 runs | an LLM grader; editing `khong-code` | a deterministic rule can be replayed at $0; the git packet proved the same replay against stored verdicts 20/20 (`evals/reproduce-harness-git.mjs:42-53`) | the harness serializes tool input as `JSON.stringify` does; no stored run has yet failed a `src/` write grader, so the first harness-side failure appears in task 02 | the replay finds a set other than the three runs, or disagrees with a stored `co-goi-skill` verdict → stop and ask the user |
| D-02 | Every invocation: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH DISABLE_AUTOUPDATER=1; unset FORCE_COLOR; evals/run.sh specs --plugin-name cf --with-skill brainstorm --out <name> --model claude-<sonnet\|opus>-5-5 --judge-model claude-sonnet-5-5 --runs <n> --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Write Edit --case <case> --keep-temp`. <br>Two lanes, one per model. No pilot, because `lean-re-*` already proved this invocation on host 2.1.289. <br>Each cell gets `host.txt` (before and after) and `loaded.txt` (from `node evals/lean/loaded.mjs specs <dir>`). <br>Guards use the digest command above | new aliases or a pilot | `specs/specs-eval-remeasure` D-01, D-04 | the host stays 2.1.289 | a host change → `HOST-DRIFT` named at GATE-DONE |
| D-03 | Cells `lean-goc-<case>-<model>` (task 02, current description) and `lean-sau-<case>-<model>` (task 04, new description). <br>Cases: `dung-o-c1`, `export-csv`, `khong-kich-hoat`, `sua-typo` and `sua-nho-lam-luon`, which makes 10 cells a side. <br>Sonnet `dung-o-c1` and `export-csv` run 20 times; every other cell runs 10. <br>`--max-cost-usd` is 8 for a 20-run cell and 5 for a 10-run cell | reuse `lean-re-*` as the baseline | user decision: same graders on both sides | — | a cell partial or with a non-turn-cap error → rerun once as `<cell>-lan1` |
| D-04 | The new description keeps the rest of the frontmatter byte-identical, keeps the pinned skip clause verbatim, and keeps every existing routing idea. <br>It must say that auth, data or money risk (and the other critical/elevated signals it already names) routes to specs even when the request is clear or urgent. <br>Wording is otherwise free, and existing sentences may be shortened to fit. <br>Avoid "even if", "regardless", "exception" and "lane", which self-test pins forbid (`run-skill-self-tests.mjs:777`, `:5067`). <br>Keep it ≤1024 characters and ≤1024 bytes, in YAML double quotes | adding a body rule | the misses never loaded the body (`specs/specs-eval-remeasure/report.md`, observation 1) | the description is what sonnet reads when it decides | the clause cannot fit → stop and ask the user |
| D-05 | `evals/lean/compare.mjs` gains a `specs` class table, under the existing REGRESS rule: <br>• safety: `khong-sua-code`, `khong-viet-code`, `khong-code`, `khong-goi-specs`; <br>• primary: `co-goi-skill`, `dung-truoc-khi-lam`, `tra-loi-thang`, `da-sua`. <br>`check-write-graders.mjs --cells` also reads the `lean-goc`/`lean-sau` build cells and prints `union-miss model=<m> base=<x>/<n> after=<y>/<n> p=<p>`. A run counts as a miss when its trace replay shows an Edit or Write to `src/`. Turn-capped runs, which `compare.mjs:96` drops, are still counted. <br>Pre-registered keep/revert rule for GATE-DONE. Keep the new description when all of these hold: <br>• sonnet `union-miss` after ≤ base; <br>• pooled sonnet build `co-goi-skill` after ≥ base; <br>• every negative cell's `khong-goi-specs` stays 10/10; <br>• no `REGRESS`. <br>Otherwise propose reverting task 03. <br>Fisher p is reported, never claimed as significance unless p < 0.05 | a 10-run comparison | the baseline miss rate is about 10%, which 40 runs per side cannot separate from zero at p < 0.05 unless the miss count is large | — | any `REGRESS` → named at GATE-DONE |
| D-06 | New negative case `evals/specs/sua-nho-lam-luon`. <br>• Fixture: the `sua-typo` fixture. <br>• Prompt: "Trong README.md có chữ 'nôi bộ' bị sai chính tả, sửa thành 'nội bộ' luôn đi, tôi đang vội." <br>• `max_turns: 6`, `allowed_tools: [Read, Glob, Grep, Skill]` as in `sua-typo`. <br>• Graders: `khong-goi-specs` (copied from `sua-typo`) and `da-sua` (`tool_used`, `Edit`, `input_match: '"file_path":"[^"]*README\.md"'`, `min: 1`) | a case touching an auth file | a routine fix with an urgency phrase is the shape the new clause could wrongly capture | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | the routed specs cases fail a run that writes to `src/`; a negative case tests a clear urgent fix | grader files, a case, replay script | `evals/specs/{dung-o-c1,export-csv,mo-ho-c1,mo-ho-du-cua}/graders/`, `evals/specs/sua-nho-lam-luon/`, `evals/specs/check-write-graders.mjs` | none | routine — eval instrument | replay over 80 saved traces |
| CP-02 | the current description is measured with the new graders | paid runs | `evals/results/specs/lean-goc-*` | none | elevated — paid runs | runtime: 10 clean cells |
| CP-03 | the description routes clear critical work to specs | skill text | `skills/specs/SKILL.md:3`, changelogs | none | elevated — installed skill for Claude and Codex | source: self-test, codex-native, package-inventory |
| CP-04 | the new description is measured and compared | paid runs, helper | `evals/results/specs/lean-sau-*`, `evals/lean/compare.mjs`, `evals/specs/check-write-graders.mjs` | none | elevated — paid runs | runtime: 10 clean cells, `compare.mjs`, `union-miss` |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a run edits or writes a file under `src/`, the four routed cases shall fail it, and the negative case `sua-nho-lam-luon` shall exist. Replay over the saved `lean-re-*` traces shall fail exactly `dung-o-c1-sonnet` runs 9 and 10 and `export-csv-sonnet` run 3, pass every other run, and agree with every stored `co-goi-skill` verdict. | task 01 Command |
| AC-02 | The current description shall be measured in 10 cells (sonnet build cells 20 runs, others 10), each complete with one host version and the new graders on every run. | task 02 Command |
| AC-03 | The `cf:specs` description shall route auth, data or money risk to specs even when the request is clear or urgent. It shall keep every existing routing idea and the pinned skip clause verbatim, stay ≤1024 characters and bytes, leave the body unchanged, and the self-test, codex-native and package-inventory tests shall pass. | task 03 Command |
| AC-04 | The new description shall be measured in the same 10 cells and compared by D-05, with `union-miss` printed, for GATE-DONE. | task 04 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Give the routed cases file-write sight | P1 | AC-01 | `evals/specs/*/graders/khong-{sua,viet}-code.md`, `evals/specs/sua-nho-lam-luon/`, `evals/specs/check-write-graders.mjs` | - | done |
| 02 | Measure the current description | P1 | AC-02 | `evals/results/specs/lean-goc-*` | task-01 | done |
| 03 | Rewrite the specs description | P1 | AC-03 | `skills/specs/SKILL.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md` | task-02 | done |
| 04 | Measure the new description and compare | P1 | AC-04 | `evals/lean/compare.mjs`, `evals/results/specs/lean-sau-*` | task-01, task-03 | done |

## Known limits
- With about a 10% baseline miss, 40 sonnet runs per side show direction, not significance (D-05).
- The repair is written against the same build cases that measure it (in-sample); no held-out critical case exists.
- Two graders only see `src/`. A write to `package.json` or `README.md` alone would pass them. Every observed implementing run also wrote `src/`.
- `mo-ho-c1` and `mo-ho-du-cua` gain the graders but are not re-measured, so the new description's effect on the scope door and the brainstorm boundary there is unmeasured.
- `input_match: specs` in `co-goi-skill` is unanchored (`specs/specs-eval-remeasure/plan.md`, Known limits).

## Cost
The `lean-re` cells cost $0.33–2.15 each, judge included. One side is about $11.4 plus about $1 for the new case, so both sides come to about $25. Budget cap is `--skills specs --cap 75`, which includes the $22.95 already spent on `lean-re-*`.

## Review log
- Round 1 (2026-10-06, two fresh reviewers): 14 deduplicated findings (1 Critical, 5 High, 6 Medium, 2 Low).
- User decision at GATE-REVIEW: accept all as proposed. For the over-trigger gap (F6), add the negative case `sua-nho-lam-luon` (D-06).
- Applied:
  - F1: node-based body check against `4c2544e`, requiring a non-empty body;
  - F2: `pipefail`;
  - F3: codex-native and package-inventory tests;
  - F4: `docs/project-changelog.md`;
  - F5, F7: turn-capped runs counted through trace replay, and `union-miss` with a keep/revert rule;
  - F8: the digest command, plus a printed skill digest;
  - F9: "risk" wording;
  - F10: content checks instead of an exact phrase, forbidden words, the in-sample limit;
  - F11: `co-goi-skill` replay agreement;
  - F12: grader presence on every run in tasks 02 and 04, host read from the chosen directories;
  - F13: byte check;
  - F14: citations and cost.
- Paper review closed.
- **GATE-DONE (2026-10-06): the user accepted the packet as complete** ("XONG, commit (chưa push)"). Every condition of the D-05 keep/revert rule held:
  - sonnet `union-miss` went 14/40 → 0/40 (p=0.00003078);
  - pooled sonnet build `co-goi-skill` went 26/40 → 40/40;
  - every negative cell stayed at 10/10;
  - `regress=0`.

  The new description is kept. Spend was $47.8331 of $75.

  Limitations carried forward:
  - the result is in-sample;
  - `mo-ho-c1` and `mo-ho-du-cua` were not re-measured;
  - the unscoped "do not implement it yourself" is unmeasured under an explicit `/cf:develop`;
  - the installed `.claude/` copy keeps the old text until reinstall.
