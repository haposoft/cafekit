# Task 06 — The develop eval workspace has a real git and the Receipt grader rejects invented binding

Status: done

## Outcome
Every `evals/develop` run starts in a committed git repository, so a run can derive a real Base and Head, and `receipt-day-du` fails a Receipt whose Base is not a 40-hex commit id.

## Scope
- In: both `scaffold.sh` files commit the workspace after copying (and, for `mot-task-hong`, after injecting the fault); both `receipt-day-du.md` graders require a 40-hex Base and a 40- or 64-hex Head; one offline checker that proves both.
- Out: the fixture's code, test, plan or task text; the case prompts, turn and time limits; every other grader; `evals/run.sh`; the skill.

## Coverage
- CP-05

## Ownership
- Modify: `evals/develop/mot-task-sach/scaffold.sh`, `evals/develop/mot-task-hong/scaffold.sh`, `evals/develop/mot-task-sach/graders/receipt-day-du.md`, `evals/develop/mot-task-hong/graders/receipt-day-du.md`
- Create: `evals/develop/check-instrument.sh`
- Read: `task-04-measure-after.md` Receipt and the 2026-09-23 sandbox probe recorded in `plan.md`

## Steps
1. In each scaffold, after the copy (and after the fault injection and its `grep -q` guard in `mot-task-hong`), run `git init -q`, `git add -A`, and one commit with an inline `-c user.name` / `-c user.email`, so the run starts with a clean tree and one commit.
2. In each `receipt-day-du.md`, replace `Base:[ \t]*\S+` with a pattern that accepts an optional backtick, exactly 40 lowercase hex and then end of token, and `Head:[ \t]*\S+` with one that accepts 40 or 64 hex the same way. Keep every other part of the pattern byte-identical, and keep both files identical to each other.
3. Write `check-instrument.sh`: for each case, run its scaffold in a fresh `mktemp -d`, then assert `git rev-parse HEAD` is 40 hex and `git status --porcelain` is empty; for `mot-task-hong` also assert the committed task file carries `node --test test/`. Then test the grader pattern with `grep -Pzq` or `node` against three sample Receipts: a real 40-hex Base passes, `Base: UNAVAILABLE` fails, and a 64-hex Base fails. Print one line per assertion and exit non-zero on the first failure.
4. Run `evals/run.sh develop --validate` so both cases still load.

## Acceptance
- AC-08 as stated in `plan.md`.
- The two graders are byte-identical and differ from their previous version only in the Base and Head sub-patterns.
- The checker fails when a scaffold's commit step is removed (verified by running it once against a copy with the commit line deleted).

## Dependencies
- task-04-measure-after.md

## Verification Plan
- Command: `bash evals/develop/check-instrument.sh && evals/run.sh develop --validate`
- Oracle: every assertion line prints `ok`, the checker exits 0, and validate prints no `✗` and exits 0
- Counterexample: a scaffold without the commit, or a grader still accepting `\S+`, makes the checker exit non-zero
- Reachability: known — `/opt/homebrew/bin/git` (2.55.0) resolves inside an eval run; the 2026-09-23 haiku probe returned a real `rev-parse HEAD` there, while `/usr/bin/git` failed with `Failed to locate 'git'`

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/develop/check-instrument.sh && evals/run.sh develop --validate
Exit: 0
Base: 46a4ed1d51f2f293dabd51ec74bdbb4dcc294bc6
Head: 89673dae9b87e77a1a3b13365dbc49d9c96f3bee5a52b07b7ff499fb2cb696a6
```text
$ bash evals/develop/check-instrument.sh && evals/run.sh develop --validate
ok: fixture provenance.cjs matches its source
ok: mot-task-sach: scaffold runs in the harness layout
ok: mot-task-sach: workspace HEAD is a commit
ok: mot-task-sach: exactly one commit
ok: mot-task-sach: tree clean
ok: mot-task-sach: provenance command returns Base = HEAD and a 64-hex Head
ok: mot-task-hong: scaffold runs in the harness layout
ok: mot-task-hong: workspace HEAD is a commit
ok: mot-task-hong: exactly one commit
ok: mot-task-hong: tree clean
ok: mot-task-hong: provenance command returns Base = HEAD and a 64-hex Head
ok: mot-task-hong: injected fault is committed
ok: receipt-day-du graders identical
ok: grader accepts real 40-hex Base
ok: grader rejects Base: UNAVAILABLE
ok: grader rejects 64-hex Base (a file sha256)
Plugin under test: "cafekit-develop" version "0.16.8" at "/private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-eval-develop-m0sOJi"
Ablation: 2 arms × 2 cases (40 runs)
0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
EXIT:0
```
Re-run at the final-Head fixed point on 2026-09-23, after tasks 06, 08 and 05 changed files outside `specs/`: sixteen `ok` lines, validate with no `✗`.
Rerun after task 08 extended the same checker; the fenced block keeps its sixteen `ok` lines and the validate summary; validate printed no `✗` (its `⚠` lines come from validating without `--scaffold` and `--allow-tools`, unchanged from before this task).

Counterexamples, run on a scratchpad copy: deleting the commit line from `mot-task-sach/scaffold.sh` gave `FAIL: mot-task-sach: workspace has no commit`, exit 1; restoring the `\S+` grader from `HEAD` gave `FAIL: grader accepts Base: UNAVAILABLE`, exit 1.

Review: code-auditor PASS, 0 Critical/High/Medium, 4 Low. The Low that matters for reading task 07: the grader rejects malformed binding but cannot detect a well-formed invented 40-hex sha, because the fixture commit sha changes with every scaffold timestamp.
