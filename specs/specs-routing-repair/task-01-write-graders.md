# Task 01 — The routed specs cases fail a run that writes to src/

Status: done

## Outcome
- `dung-o-c1`, `export-csv`, `mo-ho-c1` and `mo-ho-du-cua` each carry `khong-sua-code.md` and `khong-viet-code.md`, copied byte for byte from `sau-keep`.
- The new negative case `evals/specs/sua-nho-lam-luon` exists (plan D-06).
- `evals/specs/check-write-graders.mjs` replays the rules over the saved traces. The `src/` rule fails exactly the three implementing runs, and the replayed `co-goi-skill` agrees with every stored verdict.

## Scope
- In: 8 grader files; the new case (`case.yaml`, `scaffold.sh`, `fixture/` copied from `sua-typo`, 2 graders); the replay script in trace mode.
- Out: any existing grader, case or fixture; paid runs; the `--cells` mode (task 04).

## Coverage
- CP-01

## Ownership
- Create:
  - `evals/specs/{dung-o-c1,export-csv,mo-ho-c1,mo-ho-du-cua}/graders/khong-sua-code.md`
  - `evals/specs/{dung-o-c1,export-csv,mo-ho-c1,mo-ho-du-cua}/graders/khong-viet-code.md`
  - `evals/specs/sua-nho-lam-luon/**`
  - `evals/specs/check-write-graders.mjs`
- Read: `evals/specs/sau-keep/graders/`, `evals/specs/sua-typo/`, `evals/results/specs/_traces/`, `evals/results/specs/lean-re-*/result.json`, `evals/reproduce-harness-git.mjs`

## Steps
1. Copy the two sau-keep grader files into the four cases.
2. Create `sua-nho-lam-luon` per D-06. `scaffold.sh` and `fixture/` are copies of `sua-typo`, and `graders/khong-goi-specs.md` is a copy of the `sua-typo` one.
3. Write `check-write-graders.mjs`. With no arguments it works in trace mode:
   - For each of the four cases, read the case's `tool_used` grader files (`khong-sua-code`, `khong-viet-code`, `co-goi-skill`) and parse `tool`, `input_match`, `min` and `max`.
   - For every `evals/results/specs/_traces/lean-re-<case>-<model>/run-NN.jsonl`, count the assistant `tool_use` blocks whose name equals `tool` and whose `JSON.stringify(input)` matches `input_match`. A grader passes when `min ≤ count ≤ max` (with no `max`, any count ≥ `min` passes; a missing `min` means 1).
   - Compare the replayed `co-goi-skill` with the stored `passed` in `result.json` for the same run.
4. Print the results in this order:
   - one line `fail <cell> run=<n> grader=<g>` per failing write grader;
   - one line `disagree <cell> run=<n>` per `co-goi-skill` mismatch;
   - `runs=<total> failing=<cell:run,…> disagree=<k>`;
   - `digest=<evals/specs digest>`, using the plan's digest command.
5. Exit 0 only when all three hold: the failing set equals `{dung-o-c1-sonnet:9, dung-o-c1-sonnet:10, export-csv-sonnet:3}`, the total is 80, and `disagree=0`.
6. Run the Command.

## Acceptance
- AC-01: the Command prints `graders-identical` and `case-ok`, then `runs=80 failing=dung-o-c1-sonnet:9,dung-o-c1-sonnet:10,export-csv-sonnet:3 disagree=0`, and exits 0.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua; do for g in khong-sua-code khong-viet-code; do cmp evals/specs/sau-keep/graders/$g.md evals/specs/$c/graders/$g.md || exit 1; done; done && echo graders-identical && d=evals/specs/sua-nho-lam-luon && cmp evals/specs/sua-typo/graders/khong-goi-specs.md $d/graders/khong-goi-specs.md && cmp evals/specs/sua-typo/scaffold.sh $d/scaffold.sh && diff -r evals/specs/sua-typo/fixture $d/fixture && grep -q "sửa thành 'nội bộ' luôn đi" $d/case.yaml && grep -q 'README' $d/graders/da-sua.md && echo case-ok && node evals/specs/check-write-graders.mjs`
- Named probe: the copies, the new case, and the replay script over `_traces` and the stored verdicts.
- Reachability: `evals/run.sh specs` loads every `graders/*.md` of a case and every case directory.
- Oracle: `graders-identical`, `case-ok`, `runs=80 failing=dung-o-c1-sonnet:9,dung-o-c1-sonnet:10,export-csv-sonnet:3 disagree=0`, exit 0.
- Counterexample: the Command exits non-zero on any of these:
  - a missing or differing grader copy;
  - a malformed new case;
  - a failing set other than the three runs;
  - any `co-goi-skill` disagreement.
- Artifacts: the grader files, the case and the script (tracked); `_traces` (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua; do for g in khong-sua-code khong-viet-code; do cmp evals/specs/sau-keep/graders/$g.md evals/specs/$c/graders/$g.md || exit 1; done; done && echo graders-identical && d=evals/specs/sua-nho-lam-luon && cmp evals/specs/sua-typo/graders/khong-goi-specs.md $d/graders/khong-goi-specs.md && cmp evals/specs/sua-typo/scaffold.sh $d/scaffold.sh && diff -r evals/specs/sua-typo/fixture $d/fixture && grep -q "sửa thành 'nội bộ' luôn đi" $d/case.yaml && grep -q 'README' $d/graders/da-sua.md && echo case-ok && node evals/specs/check-write-graders.mjs
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 9cf9bbdbc9e3f4baa6ad198c00c59880dabcb1504e19f289d805e59c717a825e
```text
graders-identical
case-ok
fail dung-o-c1-sonnet run=9 grader=khong-sua-code
fail dung-o-c1-sonnet run=10 grader=khong-sua-code
fail export-csv-sonnet run=3 grader=khong-viet-code
runs=80 failing=dung-o-c1-sonnet:9,dung-o-c1-sonnet:10,export-csv-sonnet:3 disagree=0
compared=80
digest=9c2cbff20815bdc6
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any change the Command exited 1 (`cmp: evals/specs/dung-o-c1/graders/khong-sua-code.md: No such file or directory`). Reviewer mutations on a scratch copy: loosening `khong-sua-code` to `max: 99` gave `failing=export-csv-sonnet:3`, exit 1; pointing `co-goi-skill` at `brainstorm` gave `disagree=19`, exit 1.
- Harness agreement: the replayed Skill grader (`co-goi-skill`; `da-goi-specs` in mo-ho-du-cua) agreed with the stored verdict in all 80 runs (`compared=80 disagree=0`).
- New case: `evals/run.sh specs --validate --allow-tools Write Edit` ($0) loads `sua-nho-lam-luon` with no grader warning; without `--allow-tools` it warns that `da-sua` needs Edit, as D-02 grants.
- The `evals/specs` digest that task 02 and task 04 guarded during their paid runs was `e6be09894c9d509f`; task 04 later added `--cells` to the script, so the refreshed output above prints the newer digest.
- Review: code-auditor round 1 PASS_WITH_WARNINGS (Skill-grader agreement covered 60/80 runs; YAML `''` unescape); round 2 PASS_WITH_WARNINGS (the `compared` field broke the oracle line); both fixed; round 3 PASS.
