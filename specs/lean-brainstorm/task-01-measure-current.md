# Task 01 — The current brainstorm is measured on one history case

Status: done

## Outcome
`evals/results/brainstorm/lean-goc-ne-cau-hoi-{sonnet,opus}` exist, 5 runs each, clean, the skill loaded from the replayed history in every run, each with `host.txt` and `traces.txt`, measured on the skill bytes of `19c2dd0`.

## Scope
- In: two paid cells (plan D-02), their evidence files (D-03).
- Out: any file edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/brainstorm/lean-goc-ne-cau-hoi-*` (gitignored)
- Read: `evals/run.sh`, `evals/brainstorm/read-traces.mjs`, `evals/lean/budget.mjs`

## Steps
1. Guard before each invocation: directory digests (`find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16) of `packages/spec/src/claude/skills/brainstorm` = `fec5aa195b1ef962`, `packages/spec/src/claude/skills/specs` = `f208fb4864a8b11d`, `evals/brainstorm` = `72b212e060051c0f`; `shasum -a 256 packages/spec/src/claude/agents/brainstormer.md` starts `a13544a4da37e07d`; `evals/run.sh` starts `a75cd5b5fbe5b643`; `node evals/lean/budget.mjs check <c> --skills brainstorm --cap 20`.
2. Run the two cells (plan D-02, `--runs 5 --max-cost-usd 4`), one per lane; right after each, write `host.txt` and `node evals/brainstorm/read-traces.mjs <dir> > <dir>/traces.txt`.
3. Run the Command.

## Acceptance
- AC-01: both cells `partial=false`, 5 runs, `errored=0`, `skill-loaded=history:5,call:0,none:0`, one host version.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && for m in sonnet opus; do d=evals/results/brainstorm/lean-goc-ne-cau-hoi-$m; node -e 'const r=require("./'"$d"'/result.json");process.exit(r.partial===false&&r.cases[0].arms.with.length===5?0:1)' || { echo "partial or short: $d"; exit 1; }; tail -1 $d/traces.txt | grep -E ' runs=5 errored=0 .*skill-loaded=history:5,call:0,none:0$' || { echo "traces: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; done && node evals/lean/budget.mjs spent --skills brainstorm --cap 20`
- Named probe: `result.json`, saved `traces.txt` summary, `host.txt`, budget.
- Reachability: `evals/run.sh brainstorm` writes `evals/results/brainstorm/<out>`.
- Oracle: two summary lines ending `skill-loaded=history:5,call:0,none:0`, `budget: spent=<x> cap=20`, exit 0.
- Counterexample: a missing, partial, errored or not-loaded cell makes the Command exit 1.
- Artifacts: result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && for m in sonnet opus; do d=evals/results/brainstorm/lean-goc-ne-cau-hoi-$m; node -e 'const r=require("./'"$d"'/result.json");process.exit(r.partial===false&&r.cases[0].arms.with.length===5?0:1)' || { echo "partial or short: $d"; exit 1; }; tail -1 $d/traces.txt | grep -E ' runs=5 errored=0 .*skill-loaded=history:5,call:0,none:0$' || { echo "traces: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; done && node evals/lean/budget.mjs spent --skills brainstorm --cap 20
Exit: 0
Base: 63be6b5dd0c1c4824d508260a8d96eed3baf91ba
Head: a326c15c79079c8af5373f0fcfb645e56ae03ff4437966fec2f120043754826b
```text
evals/results/brainstorm/lean-goc-ne-cau-hoi-sonnet runs=5 errored=0 askuser-errored=0 counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5 cost-with-judge=0.3797 cost-without-judge=0.3797 skill-loaded=history:5,call:0,none:0
evals/results/brainstorm/lean-goc-ne-cau-hoi-opus runs=5 errored=0 askuser-errored=0 counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5 cost-with-judge=0.8278 cost-without-judge=0.8278 skill-loaded=history:5,call:0,none:0
budget: spent=1.2075 cap=20
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any cell existed the Command exited 1 (`partial or short: evals/results/brainstorm/lean-goc-ne-cau-hoi-sonnet`).
- Paid runs: two cells, one per lane, 5 runs each, `partial=false`, `errored=0`, `skill-loaded=history:5,call:0,none:0`, host `2.1.289 (Claude Code)` before and after; every grader 5/5 except `co-goi-skill` 0/5 (the skill comes from the replayed history, not a call). Guards on the brainstorm and specs skill digests, `evals/brainstorm`, `brainstormer.md`, `evals/run.sh`, node. Spend $1.2075 of $20.
- Review: code-auditor PASS (empty `git diff 19c2dd0` over the guarded paths; suite options per D-02).
