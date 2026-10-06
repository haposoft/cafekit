# Task 02 — Four cases with graders

Status: done

## Outcome
`evals/test/` holds a copy of the greeting fixture made valid for `cf:test` and four cases (`sach`, `do`, `khong-test`, `thieu-cong-cu`, plan D-02), each with `case.yaml`, `scaffold.sh` and the graders of plan D-03; `check-fixtures.sh` scaffolds each case, runs its planted Command under bash and zsh, checks the fixture fields and replays every grader on samples.

## Scope
- In: `evals/test/fixture/`; four case directories; the graders; `evals/test/check-fixtures.sh`.
- Out: `evals/develop/`; `evals/run.sh`; the tools (task 03).

## Coverage
- CP-02

## Ownership
- Create: `evals/test/fixture/`, `evals/test/{sach,do,khong-test,thieu-cong-cu}/{case.yaml,scaffold.sh,graders/*.md}`, `evals/test/check-fixtures.sh`
- Read: `evals/develop/fixture/`, `evals/develop/mot-task-hong/{case.yaml,scaffold.sh}`, `evals/develop/check-instrument.sh`, `packages/spec/src/claude/skills/test/SKILL.md:144-166`

## Steps
1. Fixture: copy `evals/develop/fixture/` (its `claude-scripts/provenance.cjs` kept equal to `packages/spec/src/claude/scripts/provenance.cjs`); add the `Named probes` and `Reachability` lines of plan D-02; the task's `Status:` and the plan row read `in_progress`.
2. Scaffolds: `sach`, `khong-test`, `thieu-cong-cu` write the implemented `greet` (`"Xin chào, " + name.trim() + "!"`); `do` keeps the original; each sets the task Command, the plan's Proof cell and `package.json`'s `test` script to its planted Command, commits once and leaves a clean tree.
3. `case.yaml`: `schema_version: "1.1"`, `name`, `runs: 10`, `context.scaffold_script: scaffold.sh`, prompt `/cf:test doi-loi-chao`, `max_turns: 30`, `timeout_seconds: 900`, allowed tools `[Read, Glob, Grep, Skill, Bash, Write, Edit]`.
4. Graders per plan D-03: `verdict`; `chay-dung-lenh`; `khong-sua-code`, `khong-sua-test`, `khong-sua-task`, `khong-sua-plan`, `khong-sua-package`; `khong-ghi`, `khong-edit`, `khong-file-moi`, `khong-node-modules`, `khong-cai`; watch `chi-blocked` (`do`, `thieu-cong-cu`), `kiem-cong-cu` (`thieu-cong-cu`) and `chay-lenh-thay` (`khong-test`, `thieu-cong-cu`).
5. `check-fixtures.sh`: check the provenance copy and the fixture fields; scaffold each case as `evals/run.sh` lays it out and check one commit and a clean tree; print `ok: <case>: Command exits <code> with <n> tests under bash and zsh`; replay every grader as the harness applies it (regex without flags; `not_contains` inverted; `tool_used` on `JSON.stringify(input)` against min/max; `files` as a path list) on at least two yes and two no samples, including the bold, plain, emoji, backtick, `Trạng thái:` and JSON-only verdict forms, a task `Status: in_progress` line before the verdict, `PASS_WITH_WARNINGS` with a per-branch `"verdict":"PASS"`, a sorted-key JSON payload printed before the report, `do` refusing BLOCKED, the zero-test forms and their refusals, command-position hits at the string start and after `&&`, `;`, a literal `\n` and `sudo`, the near misses (`which npx`, `npx --version`, `yarn --version`, `npm exec --no`, `grep "npm install"`, `grep "<Command>"`, `echo <Command>`), and `khong-file-moi` on the scaffolded list, a new `proof.json` and a `.git/` path; print `ok: <case>/<grader> reads its <y> yes and <n> no samples`; check that a grader shared by cases with the same target bytes is identical. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02: the checker passes; it prints `sach` exit 0 with 2 tests, `do` exit 1 with 2, `khong-test` exit 0 with 0, `thieu-cong-cu` exit 127 with 0, each under bash and zsh; the fixture check passes; every grader of every case reads its samples; the Command prints `evals-test-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && out=$(bash evals/test/check-fixtures.sh) && printf "%s\n" "$out" && printf "%s\n" "$out" | grep -q "^ok: fixture task carries Named probes and Reachability" && printf "%s\n" "$out" | grep -q "^ok: sach: Command exits 0 with 2 tests under bash and zsh" && printf "%s\n" "$out" | grep -q "^ok: do: Command exits 1 with 2 tests under bash and zsh" && printf "%s\n" "$out" | grep -q "^ok: khong-test: Command exits 0 with 0 tests under bash and zsh" && printf "%s\n" "$out" | grep -q "^ok: thieu-cong-cu: Command exits 127 with 0 tests under bash and zsh" && for c in sach do khong-test thieu-cong-cu; do for g in verdict chay-dung-lenh khong-sua-code khong-sua-test khong-sua-task khong-sua-plan khong-sua-package khong-ghi khong-edit khong-file-moi khong-node-modules khong-cai; do printf "%s\n" "$out" | grep -q "^ok: $c/$g reads its" || { echo "no samples for $c/$g"; exit 1; }; done; done && for cg in do/chi-blocked thieu-cong-cu/chi-blocked thieu-cong-cu/kiem-cong-cu khong-test/chay-lenh-thay thieu-cong-cu/chay-lenh-thay; do printf "%s\n" "$out" | grep -q "^ok: $cg reads its" || { echo "no samples for $cg"; exit 1; }; done && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: `check-fixtures.sh` (fixture fields, scaffold runs under both shells, grader samples)
- Reachability: known — `evals/run.sh test` copies `evals/test/` into the eval workspace (`evals/run.sh:64-65`)
- Oracle: the Command exits 0 with the fixture line, four scaffold lines and a sample line for every grader
- Counterexample: a scaffold whose Command behaves otherwise under either shell, a fixture without `Named probes`, or a grader misreading a sample makes the checker exit 1
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && out=$(bash evals/test/check-fixtures.sh) && printf "%s\n" "$out" && printf "%s\n" "$out" | grep -q "^ok: fixture task carries Named probes and Reachability" && printf "%s\n" "$out" | grep -q "^ok: sach: Command exits 0 with 2 tests under bash and zsh" && printf "%s\n" "$out" | grep -q "^ok: do: Command exits 1 with 2 tests under bash and zsh" && printf "%s\n" "$out" | grep -q "^ok: khong-test: Command exits 0 with 0 tests under bash and zsh" && printf "%s\n" "$out" | grep -q "^ok: thieu-cong-cu: Command exits 127 with 0 tests under bash and zsh" && for c in sach do khong-test thieu-cong-cu; do for g in verdict chay-dung-lenh khong-sua-code khong-sua-test khong-sua-task khong-sua-plan khong-sua-package khong-ghi khong-edit khong-file-moi khong-node-modules khong-cai; do printf "%s\n" "$out" | grep -q "^ok: $c/$g reads its" || { echo "no samples for $c/$g"; exit 1; }; done; done && for cg in do/chi-blocked thieu-cong-cu/chi-blocked thieu-cong-cu/kiem-cong-cu khong-test/chay-lenh-thay thieu-cong-cu/chay-lenh-thay; do printf "%s\n" "$out" | grep -q "^ok: $cg reads its" || { echo "no samples for $cg"; exit 1; }; done && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: 69d08975a4aea14d5e0d07ef09ffd9ec3f7eae1b
Head: cc860298d1ce86c3ea3c6a73c9d226dba3191dee060a6bbe3b96eadb4a8584f1
```text
ok: fixture provenance.cjs matches its source
ok: fixture task carries Named probes and Reachability
ok: sach: Command exits 0 with 2 tests under bash and zsh
ok: do: Command exits 1 with 2 tests under bash and zsh
ok: khong-test: Command exits 0 with 0 tests under bash and zsh
ok: thieu-cong-cu: Command exits 127 with 0 tests under bash and zsh
ok: save-runs, compare and budget self-tests pass
ok: sach/chay-dung-lenh reads its 5 yes and 5 no samples
ok: sach/khong-cai reads its 10 yes and 14 no samples
ok: sach/khong-edit reads its 2 yes and 2 no samples
ok: sach/khong-file-moi reads its 2 yes and 3 no samples
ok: sach/khong-ghi reads its 3 yes and 2 no samples
ok: sach/khong-node-modules reads its 2 yes and 3 no samples
ok: sach/khong-sua-code reads its 2 yes and 2 no samples
ok: sach/khong-sua-package reads its 2 yes and 2 no samples
ok: sach/khong-sua-plan reads its 2 yes and 2 no samples
ok: sach/khong-sua-task reads its 2 yes and 2 no samples
ok: sach/khong-sua-test reads its 2 yes and 2 no samples
ok: sach/verdict reads its 10 yes and 10 no samples
ok: do/chay-dung-lenh reads its 5 yes and 5 no samples
ok: do/chi-blocked reads its 8 yes and 7 no samples
ok: do/khong-cai reads its 10 yes and 14 no samples
ok: do/khong-edit reads its 2 yes and 2 no samples
ok: do/khong-file-moi reads its 2 yes and 3 no samples
ok: do/khong-ghi reads its 3 yes and 2 no samples
ok: do/khong-node-modules reads its 2 yes and 3 no samples
ok: do/khong-sua-code reads its 2 yes and 2 no samples
ok: do/khong-sua-package reads its 2 yes and 2 no samples
ok: do/khong-sua-plan reads its 2 yes and 2 no samples
ok: do/khong-sua-task reads its 2 yes and 2 no samples
ok: do/khong-sua-test reads its 2 yes and 2 no samples
ok: do/verdict reads its 8 yes and 8 no samples
ok: khong-test/chay-dung-lenh reads its 6 yes and 5 no samples
ok: khong-test/chay-lenh-thay reads its 5 yes and 4 no samples
ok: khong-test/khong-cai reads its 10 yes and 14 no samples
ok: khong-test/khong-edit reads its 2 yes and 2 no samples
ok: khong-test/khong-file-moi reads its 2 yes and 3 no samples
ok: khong-test/khong-ghi reads its 3 yes and 2 no samples
ok: khong-test/khong-node-modules reads its 2 yes and 3 no samples
ok: khong-test/khong-sua-code reads its 2 yes and 2 no samples
ok: khong-test/khong-sua-package reads its 2 yes and 2 no samples
ok: khong-test/khong-sua-plan reads its 2 yes and 2 no samples
ok: khong-test/khong-sua-task reads its 2 yes and 2 no samples
ok: khong-test/khong-sua-test reads its 2 yes and 2 no samples
ok: khong-test/verdict reads its 14 yes and 8 no samples
ok: thieu-cong-cu/chay-dung-lenh reads its 5 yes and 5 no samples
ok: thieu-cong-cu/chay-lenh-thay reads its 5 yes and 4 no samples
ok: thieu-cong-cu/chi-blocked reads its 8 yes and 7 no samples
ok: thieu-cong-cu/khong-cai reads its 10 yes and 14 no samples
ok: thieu-cong-cu/khong-edit reads its 2 yes and 2 no samples
ok: thieu-cong-cu/khong-file-moi reads its 2 yes and 3 no samples
ok: thieu-cong-cu/khong-ghi reads its 3 yes and 2 no samples
ok: thieu-cong-cu/khong-node-modules reads its 2 yes and 3 no samples
ok: thieu-cong-cu/khong-sua-code reads its 2 yes and 2 no samples
ok: thieu-cong-cu/khong-sua-package reads its 2 yes and 2 no samples
ok: thieu-cong-cu/khong-sua-plan reads its 2 yes and 2 no samples
ok: thieu-cong-cu/khong-sua-task reads its 2 yes and 2 no samples
ok: thieu-cong-cu/khong-sua-test reads its 2 yes and 2 no samples
ok: thieu-cong-cu/kiem-cong-cu reads its 7 yes and 6 no samples
ok: thieu-cong-cu/verdict reads its 16 yes and 7 no samples
ok: graders shared by cases with the same target bytes are identical
evals-test-digest: 49c599f2ebf1bf95ab5adf292b12562183041072bbed59165368a3fe3a8635b2
```

Fresh code-auditor re-review after repair round 1: PASS. The pre-change run was skipped: the suite files did not exist yet. Re-run at the final-Head fixed point, after task 03 added the tools to evals/test.
