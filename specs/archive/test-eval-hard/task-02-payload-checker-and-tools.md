# Task 02 — Payload checker and tool updates

Status: done

## Outcome
`evals/test/check-payload.mjs` (plan D-03) reports, per cell, how many runs delivered a `test-proof-v1` payload and how many delivered payloads are valid; `compare.mjs` knows the joint members of the three new cases (plan D-02); `budget.mjs --packet hard` budgets this packet (plan D-04). The checker runs on the eight baseline cells at $0.

## Scope
- In: `check-payload.mjs` with a self-test; `compare.mjs` and `budget.mjs` changes with self-tests; `check-fixtures.sh` running the new self-test.
- Out: graders; paid runs.

## Coverage
- CP-02

## Ownership
- Create: `evals/test/check-payload.mjs`
- Modify: `evals/test/compare.mjs`, `evals/test/budget.mjs`, `evals/test/save-runs.mjs`, `evals/test/check-fixtures.sh`
- Read: `references/execution-strategy.md:92-165`, `evals/results/test/_saved/base-*.txt`

## Steps
1. `check-payload.mjs <cell>... | --self-test`: apply plan D-03 (run basis and stale checks as `compare.mjs`); print `cell=<c> delivered=<n>/<comparable> valid=<m>/<n>` (`valid=n/a` in `trung-probe`) and `cell=<c> check=<name> failed=<k>` per check; exit 1 when a cell or saved file is missing or stale. Self-tests include duplicate branch ids, the `chào`/`cắt` order, a pretty-printed payload in a plain fence, a JSON-only answer (`report-verdict missing`), a `-lan1` cell, a stale saved file, and a `*-trung-probe-*` cell printing `valid=n/a`.
2. `compare.mjs`: joint members for `tron-legacy`, `trung-probe`, `khong-cham-code`; watch graders listed per case (`chay-dung-lenh` watch only in the two `BLOCKED` cases, `neu-nguyen-nhan` and `chi-blocked` where plan D-02 says); self-tests for each, and one that `base-sach-*` keeps `chay-dung-lenh dir=higher`.
3. `budget.mjs --packet hard` as plan D-04 (every depth, `_capped/` and `_pilot-lan1/` included, `base-*` excluded, `fits` over three cells per model); the default behaviour unchanged; self-tests including `_capped/kho-x-opus-cap1` (counted) and `_capped/base-x-opus-cap1` (not). `save-runs.mjs` saves `test/greet-impl.js` and `specs/doi-loi-chao/spec.json` when present, with a self-test that both appear in the saved file and round-trip through `parseSaved`.
4. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02: the four self-tests (`check-payload`, `compare`, `budget`, `save-runs`) pass; the Command prints a `delivered=` and `valid=` line for each of the eight baseline cells and `evals-test-digest:`.

## Dependencies
- task-01-three-hard-cases.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in check-payload compare budget save-runs; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && R=evals/results/test && node evals/test/check-payload.mjs $R/base-sach-sonnet $R/base-sach-opus $R/base-do-sonnet $R/base-do-opus $R/base-khong-test-sonnet $R/base-khong-test-opus $R/base-thieu-cong-cu-sonnet $R/base-thieu-cong-cu-opus && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: the four self-tests; `check-payload.mjs` over the baseline cells
- Reachability: known — task 04 calls `compare.mjs` and `check-payload.mjs`, tasks 03–04 call `budget.mjs --packet hard`
- Oracle: the Command exits 0 with four self-test lines and eight `delivered=` lines
- Counterexample: a payload with a wrong digest, an extra key or a missing branch passing as valid makes the self-test fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in check-payload compare budget save-runs; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && R=evals/results/test && node evals/test/check-payload.mjs $R/base-sach-sonnet $R/base-sach-opus $R/base-do-sonnet $R/base-do-opus $R/base-khong-test-sonnet $R/base-khong-test-opus $R/base-thieu-cong-cu-sonnet $R/base-thieu-cong-cu-opus && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: d9529f2859a5ff4c08e62bef97d48b38ec183f16
Head: d8774fb227188ca5b313dd488e72c23204b8c03c0dc33e7769df18ec4543e918
```text
check-payload self-test: ok
compare self-test: ok
budget self-test: ok
save-runs self-test: ok
checker: ok
cell=base-sach-sonnet delivered=10/10 valid=10/10
cell=base-sach-sonnet check=keys failed=0
cell=base-sach-sonnet check=target failed=0
cell=base-sach-sonnet check=counts failed=0
cell=base-sach-sonnet check=branch-keys failed=0
cell=base-sach-sonnet check=branch-ids failed=0
cell=base-sach-sonnet check=branch-order failed=0
cell=base-sach-sonnet check=branch-counts failed=0
cell=base-sach-sonnet check=verdict failed=0
cell=base-sach-sonnet check=digest failed=0
cell=base-sach-sonnet report-verdict missing=0
cell=base-sach-sonnet errored=0 unloaded=0 capped=0
cell=base-sach-opus delivered=5/10 valid=5/5
cell=base-sach-opus check=keys failed=0
cell=base-sach-opus check=target failed=0
cell=base-sach-opus check=counts failed=0
cell=base-sach-opus check=branch-keys failed=0
cell=base-sach-opus check=branch-ids failed=0
cell=base-sach-opus check=branch-order failed=0
cell=base-sach-opus check=branch-counts failed=0
cell=base-sach-opus check=verdict failed=0
cell=base-sach-opus check=digest failed=0
cell=base-sach-opus report-verdict missing=0
cell=base-sach-opus errored=0 unloaded=0 capped=0
cell=base-do-sonnet delivered=6/10 valid=6/6
cell=base-do-sonnet check=keys failed=0
cell=base-do-sonnet check=target failed=0
cell=base-do-sonnet check=counts failed=0
cell=base-do-sonnet check=branch-keys failed=0
cell=base-do-sonnet check=branch-ids failed=0
cell=base-do-sonnet check=branch-order failed=0
cell=base-do-sonnet check=branch-counts failed=0
cell=base-do-sonnet check=verdict failed=0
cell=base-do-sonnet check=digest failed=0
cell=base-do-sonnet report-verdict missing=0
cell=base-do-sonnet errored=0 unloaded=0 capped=0
cell=base-do-opus delivered=4/10 valid=4/4
cell=base-do-opus check=keys failed=0
cell=base-do-opus check=target failed=0
cell=base-do-opus check=counts failed=0
cell=base-do-opus check=branch-keys failed=0
cell=base-do-opus check=branch-ids failed=0
cell=base-do-opus check=branch-order failed=0
cell=base-do-opus check=branch-counts failed=0
cell=base-do-opus check=verdict failed=0
cell=base-do-opus check=digest failed=0
cell=base-do-opus report-verdict missing=0
cell=base-do-opus errored=0 unloaded=0 capped=0
cell=base-khong-test-sonnet delivered=1/10 valid=1/1
cell=base-khong-test-sonnet check=keys failed=0
cell=base-khong-test-sonnet check=target failed=0
cell=base-khong-test-sonnet check=counts failed=0
cell=base-khong-test-sonnet check=branch-keys failed=0
cell=base-khong-test-sonnet check=branch-ids failed=0
cell=base-khong-test-sonnet check=branch-order failed=0
cell=base-khong-test-sonnet check=branch-counts failed=0
cell=base-khong-test-sonnet check=verdict failed=0
cell=base-khong-test-sonnet check=digest failed=0
cell=base-khong-test-sonnet report-verdict missing=0
cell=base-khong-test-sonnet errored=0 unloaded=0 capped=0
cell=base-khong-test-opus delivered=4/10 valid=2/4
cell=base-khong-test-opus check=keys failed=0
cell=base-khong-test-opus check=target failed=2
cell=base-khong-test-opus check=counts failed=0
cell=base-khong-test-opus check=branch-keys failed=0
cell=base-khong-test-opus check=branch-ids failed=0
cell=base-khong-test-opus check=branch-order failed=0
cell=base-khong-test-opus check=branch-counts failed=0
cell=base-khong-test-opus check=verdict failed=0
cell=base-khong-test-opus check=digest failed=0
cell=base-khong-test-opus report-verdict missing=0
cell=base-khong-test-opus errored=0 unloaded=0 capped=0
cell=base-thieu-cong-cu-sonnet delivered=3/10 valid=2/3
cell=base-thieu-cong-cu-sonnet check=keys failed=0
cell=base-thieu-cong-cu-sonnet check=target failed=0
cell=base-thieu-cong-cu-sonnet check=counts failed=0
cell=base-thieu-cong-cu-sonnet check=branch-keys failed=0
cell=base-thieu-cong-cu-sonnet check=branch-ids failed=0
cell=base-thieu-cong-cu-sonnet check=branch-order failed=0
cell=base-thieu-cong-cu-sonnet check=branch-counts failed=0
cell=base-thieu-cong-cu-sonnet check=verdict failed=0
cell=base-thieu-cong-cu-sonnet check=digest failed=1
cell=base-thieu-cong-cu-sonnet report-verdict missing=0
cell=base-thieu-cong-cu-sonnet errored=0 unloaded=0 capped=0
cell=base-thieu-cong-cu-opus delivered=6/10 valid=4/6
cell=base-thieu-cong-cu-opus check=keys failed=0
cell=base-thieu-cong-cu-opus check=target failed=2
cell=base-thieu-cong-cu-opus check=counts failed=0
cell=base-thieu-cong-cu-opus check=branch-keys failed=2
cell=base-thieu-cong-cu-opus check=branch-ids failed=0
cell=base-thieu-cong-cu-opus check=branch-order failed=0
cell=base-thieu-cong-cu-opus check=branch-counts failed=0
cell=base-thieu-cong-cu-opus check=verdict failed=0
cell=base-thieu-cong-cu-opus check=digest failed=0
cell=base-thieu-cong-cu-opus report-verdict missing=0
cell=base-thieu-cong-cu-opus errored=0 unloaded=0 capped=0
evals-test-digest: cd76c9493d8dad7584b2eeaae88e7f08036612f5e29143e48f0a899ca5a131bc
```

Fresh code-auditor re-review after repair round 1: PASS (39 of 41 mutants killed; the baseline compare output and budget unchanged). Re-run at the final-Head fixed point.
