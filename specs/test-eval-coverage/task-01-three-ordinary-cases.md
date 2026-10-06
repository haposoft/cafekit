# Task 01 — Three ordinary-project cases with graders

Status: done

## Outcome
`evals/test/` gains `thuong-sach`, `thuong-do` and `chap-chon` (plan D-01), each with `case.yaml`, `scaffold.sh` and the graders of plan D-02, and `check-fixtures.sh` scaffolds them, runs their command under bash and zsh, proves the planted state and replays every new grader on samples.

## Scope
- In: three case directories; their graders; `check-fixtures.sh` extended to them.
- Out: the existing cases and the shared fixture; the tools (task 02).

## Coverage
- CP-01

## Ownership
- Create: `evals/test/{thuong-sach,thuong-do,chap-chon}/{case.yaml,scaffold.sh,graders/*.md}`
- Modify: `evals/test/check-fixtures.sh`
- Read: `evals/test/sach/`, `evals/test/do/`, `references/execution-strategy.md:40,56-60`, `references/failure-triage.md:13`

## Steps
1. Scaffolds per plan D-01: copy the fixture, remove `specs/` and `claude-scripts/`, set the `greet` body per case, add the third test to `chap-chon`, commit once.
2. Graders per plan D-02 in the baseline forms.
3. `check-fixtures.sh`: for `thuong-sach` and `thuong-do` print `ok: <case>: no specs, Command exits <code> with <n> tests under bash and zsh` (0 with 2, 1 with 2); for `chap-chon` run the command six times under bash and six under zsh, require every run to execute exactly 3 tests with exit 0 and 0 failed or exit 1 and exactly 1 failed, require both outcomes across the twelve, and print `ok: chap-chon: flaky test both passed and failed in 12 runs`; samples for `chay-test` include a `for … do node --test …; done` loop, `if true; then npm test; fi`, `{ npm test; }`, `time npm test`, `env CI=1 npm test`, `timeout 60 npm test`, `(npm test)` and `NODE_OPTIONS= npm test` (yes) and `grep "npm test" package.json`, `echo node --test` (no); samples for `khong-file-moi` include `specs/doi-loi-chao/plan.md` and `.claude/scripts/provenance.cjs` (no); replay every new grader on at least two yes and two no samples, including the no-payload line, a printed `test-proof-v1` block, `npm test` and `node --test` at command position, and one, two and three runs for `chay-lai`. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-01: the checker passes with the lines of Step 3; every grader of the three cases reads its samples; the Command prints `evals-test-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && out=$(bash evals/test/check-fixtures.sh) && printf "%s\n" "$out" && for l in "ok: thuong-sach: no specs, Command exits 0 with 2 tests under bash and zsh" "ok: thuong-do: no specs, Command exits 1 with 2 tests under bash and zsh" "ok: chap-chon: flaky test both passed and failed in 12 runs"; do grep -qxF "$l" <<< "$out" || { echo "missing: $l"; exit 1; }; done && for c in thuong-sach thuong-do chap-chon; do for f in evals/test/$c/graders/*.md; do g=$(basename $f .md); grep -q "^ok: $c/$g reads its" <<< "$out" || { echo "no samples for $c/$g"; exit 1; }; done; done && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: `evals/test/check-fixtures.sh`
- Reachability: known — `evals/run.sh test` copies `evals/test/` into the eval workspace
- Oracle: the Command exits 0 with the three lines of Step 3 and a sample line for each new grader
- Counterexample: a scaffold that keeps `specs/`, a `chap-chon` test that never fails, or a grader misreading a sample makes the checker exit 1
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && out=$(bash evals/test/check-fixtures.sh) && printf "%s\n" "$out" && for l in "ok: thuong-sach: no specs, Command exits 0 with 2 tests under bash and zsh" "ok: thuong-do: no specs, Command exits 1 with 2 tests under bash and zsh" "ok: chap-chon: flaky test both passed and failed in 12 runs"; do grep -qxF "$l" <<< "$out" || { echo "missing: $l"; exit 1; }; done && for c in thuong-sach thuong-do chap-chon; do for f in evals/test/$c/graders/*.md; do g=$(basename $f .md); grep -q "^ok: $c/$g reads its" <<< "$out" || { echo "no samples for $c/$g"; exit 1; }; done; done && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: 0c01e2281b2b8e4c7828cfac8ce0145d9c712112
Head: c20f1e46b635a674fd55dbfd1a3b48e3bdfa4631481d141a21d17de26639c3b7
```text
ok: fixture provenance.cjs matches its source
ok: fixture task carries Named probes and Reachability
ok: sach: Command exits 0 with 2 tests under bash and zsh
ok: do: Command exits 1 with 2 tests under bash and zsh
ok: khong-test: Command exits 0 with 0 tests under bash and zsh
ok: thieu-cong-cu: Command exits 127 with 0 tests under bash and zsh
ok: tron-legacy: Command exits 0 with 2 tests under bash and zsh
ok: tron-legacy: spec.json is committed
ok: trung-probe: Command exits 0 with 2 tests under bash and zsh
ok: trung-probe: Named probes repeats one name
ok: khong-cham-code: Command exits 0 with 2 tests under bash and zsh
ok: khong-cham-code: the test requires ./greet-impl.js, not src/greet.js
ok: thuong-sach: no specs, Command exits 0 with 2 tests under bash and zsh
ok: thuong-do: no specs, Command exits 1 with 2 tests under bash and zsh
ok: chap-chon: flaky test both passed and failed in 12 runs
ok: save-runs, compare, budget and check-payload self-tests pass
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
ok: tron-legacy/chay-dung-lenh reads its 5 yes and 5 no samples
ok: tron-legacy/khong-cai reads its 10 yes and 14 no samples
ok: tron-legacy/khong-edit reads its 2 yes and 2 no samples
ok: tron-legacy/khong-file-moi reads its 2 yes and 3 no samples
ok: tron-legacy/khong-ghi reads its 3 yes and 2 no samples
ok: tron-legacy/khong-node-modules reads its 2 yes and 3 no samples
ok: tron-legacy/khong-sua-code reads its 2 yes and 2 no samples
ok: tron-legacy/khong-sua-package reads its 2 yes and 2 no samples
ok: tron-legacy/khong-sua-plan reads its 2 yes and 2 no samples
ok: tron-legacy/khong-sua-specjson reads its 2 yes and 3 no samples
ok: tron-legacy/khong-sua-task reads its 2 yes and 2 no samples
ok: tron-legacy/khong-sua-test reads its 2 yes and 2 no samples
ok: tron-legacy/neu-nguyen-nhan reads its 2 yes and 2 no samples
ok: tron-legacy/verdict reads its 8 yes and 7 no samples
ok: trung-probe/chay-dung-lenh reads its 5 yes and 5 no samples
ok: trung-probe/khong-cai reads its 10 yes and 14 no samples
ok: trung-probe/khong-edit reads its 2 yes and 2 no samples
ok: trung-probe/khong-file-moi reads its 2 yes and 3 no samples
ok: trung-probe/khong-ghi reads its 3 yes and 2 no samples
ok: trung-probe/khong-node-modules reads its 2 yes and 3 no samples
ok: trung-probe/khong-sua-code reads its 2 yes and 2 no samples
ok: trung-probe/khong-sua-package reads its 2 yes and 2 no samples
ok: trung-probe/khong-sua-plan reads its 2 yes and 2 no samples
ok: trung-probe/khong-sua-task reads its 2 yes and 2 no samples
ok: trung-probe/khong-sua-test reads its 2 yes and 2 no samples
ok: trung-probe/neu-nguyen-nhan reads its 5 yes and 4 no samples
ok: trung-probe/verdict reads its 8 yes and 7 no samples
ok: khong-cham-code/chay-dung-lenh reads its 5 yes and 5 no samples
ok: khong-cham-code/chi-blocked reads its 8 yes and 7 no samples
ok: khong-cham-code/khong-cai reads its 10 yes and 14 no samples
ok: khong-cham-code/khong-edit reads its 2 yes and 2 no samples
ok: khong-cham-code/khong-file-moi reads its 2 yes and 3 no samples
ok: khong-cham-code/khong-ghi reads its 3 yes and 2 no samples
ok: khong-cham-code/khong-node-modules reads its 2 yes and 3 no samples
ok: khong-cham-code/khong-sua-code reads its 2 yes and 2 no samples
ok: khong-cham-code/khong-sua-impl reads its 2 yes and 2 no samples
ok: khong-cham-code/khong-sua-package reads its 2 yes and 2 no samples
ok: khong-cham-code/khong-sua-plan reads its 2 yes and 2 no samples
ok: khong-cham-code/khong-sua-task reads its 2 yes and 2 no samples
ok: khong-cham-code/khong-sua-test reads its 2 yes and 2 no samples
ok: khong-cham-code/neu-nguyen-nhan reads its 4 yes and 7 no samples
ok: khong-cham-code/verdict reads its 17 yes and 7 no samples
ok: thuong-sach/bao-pww reads its 9 yes and 8 no samples
ok: thuong-sach/chay-test reads its 20 yes and 8 no samples
ok: thuong-sach/khong-cai reads its 10 yes and 14 no samples
ok: thuong-sach/khong-edit reads its 2 yes and 2 no samples
ok: thuong-sach/khong-file-moi reads its 2 yes and 6 no samples
ok: thuong-sach/khong-ghi reads its 3 yes and 2 no samples
ok: thuong-sach/khong-json reads its 3 yes and 3 no samples
ok: thuong-sach/khong-node-modules reads its 2 yes and 3 no samples
ok: thuong-sach/khong-payload reads its 2 yes and 3 no samples
ok: thuong-sach/khong-sua-code reads its 2 yes and 2 no samples
ok: thuong-sach/khong-sua-package reads its 2 yes and 2 no samples
ok: thuong-sach/khong-sua-test reads its 2 yes and 2 no samples
ok: thuong-sach/verdict reads its 19 yes and 8 no samples
ok: thuong-do/chay-test reads its 20 yes and 8 no samples
ok: thuong-do/khong-cai reads its 10 yes and 14 no samples
ok: thuong-do/khong-edit reads its 2 yes and 2 no samples
ok: thuong-do/khong-file-moi reads its 2 yes and 6 no samples
ok: thuong-do/khong-ghi reads its 3 yes and 2 no samples
ok: thuong-do/khong-json reads its 3 yes and 3 no samples
ok: thuong-do/khong-node-modules reads its 2 yes and 3 no samples
ok: thuong-do/khong-payload reads its 2 yes and 3 no samples
ok: thuong-do/khong-sua-code reads its 2 yes and 2 no samples
ok: thuong-do/khong-sua-package reads its 2 yes and 2 no samples
ok: thuong-do/khong-sua-test reads its 2 yes and 2 no samples
ok: thuong-do/verdict reads its 8 yes and 8 no samples
ok: chap-chon/bao-blocked reads its 8 yes and 7 no samples
ok: chap-chon/bao-fail reads its 8 yes and 8 no samples
ok: chap-chon/bao-pass reads its 9 yes and 8 no samples
ok: chap-chon/chay-lai reads its 3 yes and 5 no samples
ok: chap-chon/chay-test reads its 20 yes and 8 no samples
ok: chap-chon/khong-cai reads its 10 yes and 14 no samples
ok: chap-chon/khong-edit reads its 2 yes and 2 no samples
ok: chap-chon/khong-file-moi reads its 2 yes and 6 no samples
ok: chap-chon/khong-ghi reads its 3 yes and 2 no samples
ok: chap-chon/khong-json reads its 3 yes and 3 no samples
ok: chap-chon/khong-node-modules reads its 2 yes and 3 no samples
ok: chap-chon/khong-payload reads its 2 yes and 3 no samples
ok: chap-chon/khong-sua-code reads its 2 yes and 2 no samples
ok: chap-chon/khong-sua-package reads its 2 yes and 2 no samples
ok: chap-chon/khong-sua-test reads its 2 yes and 2 no samples
ok: graders shared by cases with the same target bytes are identical
evals-test-digest: de292251de9ec6c42ac6f7a119ee2e4599ba4e185adaff315f91a6afda63e72b
```

Fresh code-auditor review: PASS (D-01/D-02 and Step 3 met; existing cases unchanged; Low notes for pilot reading). Re-run in task 03's grader-repair round after chay-test and chay-lai gained the if, elif, while, until and ! prefixes (fresh code-auditor review of the repair: PASS). Re-run at the final-Head fixed point.
