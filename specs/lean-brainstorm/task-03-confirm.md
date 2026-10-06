# Task 03 — The joined brainstorm still loads and behaves the same

Status: done

## Outcome
`evals/results/brainstorm/lean-sau-ne-cau-hoi-{sonnet,opus}` (5 runs) and `lean-sau-tham-do-nap-skill-sonnet` (1 run; the probe reader reads run 1 only) on the joined skill, with `host.txt` and `traces.txt`; the probe quotes the HARD-GATE first line from the replayed history.

## Scope
- In: three paid cells (plan D-02), their evidence (D-03).
- Out: any file edit; a wording round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/brainstorm/lean-sau-*` (gitignored)
- Read: task 01's Steps

## Steps
1. Guards as task 01 Step 1 with the brainstorm skill and `evals/brainstorm` digests recorded after task 02.
2. Run the cells; probe evidence: `node evals/brainstorm/read-traces.mjs --probe <dir> > <dir>/probe.txt`. The run-level `joined-seen.txt` (written right after each `ne-cau-hoi` cell) turned out unobservable — kept run directories hold no copy of the replayed history — and stays only as a record (0/5); the replay is proven by the digest chain the Command checks (plan Execution note, user decision).
3. Run the Command.

## Acceptance
- AC-03: both `ne-cau-hoi` cells clean with `skill-loaded=history:5,call:0,none:0`; the three repo histories carry the joined marker line and `evals/brainstorm` still has the digest `9fb691b9e613811a` that every invocation was guarded on (so the replayed history was the joined one); one host version across both sides; the probe `history-skill=seen`; spend within the cap; counts compared at GATE-DONE.

## Dependencies
- task-02-join-lines.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-brainstorm/task-02-join-lines.md && for m in sonnet opus; do d=evals/results/brainstorm/lean-sau-ne-cau-hoi-$m; tail -1 $d/traces.txt | grep -E ' runs=5 errored=0 .*skill-loaded=history:5,call:0,none:0$' || { echo "traces: $d"; exit 1; }; [ -s $d/host.txt ] || { echo "host: $d"; exit 1; }; done && for c in duyet-khong-trien-khai ne-cau-hoi tham-do-nap-skill; do [ "$(grep -cF 'segment. Accept `--deep`' evals/brainstorm/$c/history.jsonl)" = 1 ] || { echo "history: $c"; exit 1; }; done && [ "$( (cd evals/brainstorm && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)" = 9fb691b9e613811a ] && echo joined-history-replayed && [ "$(cat evals/results/brainstorm/lean-{goc,sau}-ne-cau-hoi-*/host.txt | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && grep -q 'history-skill=seen' evals/results/brainstorm/lean-sau-tham-do-nap-skill-sonnet/probe.txt && echo probe-seen && for m in sonnet opus; do for s in goc sau; do tail -1 evals/results/brainstorm/lean-$s-ne-cau-hoi-$m/traces.txt | grep -oE 'counts=[^ ]+' | sed "s/^/$s-$m /"; done; done && node evals/lean/budget.mjs spent --skills brainstorm --cap 20`
- Named probe: saved `traces.txt` and `probe.txt`; budget.
- Reachability: as task 01.
- Oracle: two summary lines ending `skill-loaded=history:5,call:0,none:0`, `joined-history-replayed`, `one-host`, `probe-seen`, four `counts=` lines (read at GATE-DONE), `budget: spent=<x> cap=20`, exit 0.
- Counterexample: a not-loaded or errored cell, or a probe that does not see the skill, makes the Command exit 1.
- Artifacts: result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-brainstorm/task-02-join-lines.md && for m in sonnet opus; do d=evals/results/brainstorm/lean-sau-ne-cau-hoi-$m; tail -1 $d/traces.txt | grep -E ' runs=5 errored=0 .*skill-loaded=history:5,call:0,none:0$' || { echo "traces: $d"; exit 1; }; [ -s $d/host.txt ] || { echo "host: $d"; exit 1; }; done && for c in duyet-khong-trien-khai ne-cau-hoi tham-do-nap-skill; do [ "$(grep -cF 'segment. Accept `--deep`' evals/brainstorm/$c/history.jsonl)" = 1 ] || { echo "history: $c"; exit 1; }; done && [ "$( (cd evals/brainstorm && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)" = 9fb691b9e613811a ] && echo joined-history-replayed && [ "$(cat evals/results/brainstorm/lean-{goc,sau}-ne-cau-hoi-*/host.txt | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && grep -q 'history-skill=seen' evals/results/brainstorm/lean-sau-tham-do-nap-skill-sonnet/probe.txt && echo probe-seen && for m in sonnet opus; do for s in goc sau; do tail -1 evals/results/brainstorm/lean-$s-ne-cau-hoi-$m/traces.txt | grep -oE 'counts=[^ ]+' | sed "s/^/$s-$m /"; done; done && node evals/lean/budget.mjs spent --skills brainstorm --cap 20`
Exit: 0
Base: 63be6b5dd0c1c4824d508260a8d96eed3baf91ba
Head: ad15217a4701ca66ce62393a9a97d0ed5b84420a6663017e9cd1a3dd9d015b42
```text
evals/results/brainstorm/lean-sau-ne-cau-hoi-sonnet runs=5 errored=0 askuser-errored=0 counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5 cost-with-judge=0.3809 cost-without-judge=0.3809 skill-loaded=history:5,call:0,none:0
evals/results/brainstorm/lean-sau-ne-cau-hoi-opus runs=5 errored=0 askuser-errored=0 counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5 cost-with-judge=0.8152 cost-without-judge=0.8152 skill-loaded=history:5,call:0,none:0
joined-history-replayed
one-host
probe-seen
goc-sonnet counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5
sau-sonnet counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5
goc-opus counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5
sau-opus counts=khong-hoi-ky-thuat:5/5*,co-khuyen-nghi:5/5*,dua-muc-tieu:5/5*,ghi-gia-dinh:5/5*,noi-route:5/5*,noi-do-sau:5/5*,co-goi-skill:0/5,do-dai-gon:5/5,khong-doc-dap-an-bash:5/5,khong-doc-dap-an-glob:5/5,khong-doc-dap-an-grep:5/5,khong-doc-dap-an-read:5/5,khong-edit:5/5,khong-file-moi:5/5,khong-hoi-lai:5/5,khong-write:5/5
budget: spent=2.4654 cap=20
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; it exited 0 (re-run just before this Receipt).
- Negative proof: before any lean cell existed the Command exited 1 (`traces: evals/results/brainstorm/lean-sau-ne-cau-hoi-sonnet`).
- Paid runs: `lean-sau-ne-cau-hoi-{sonnet,opus}` 5 runs each, `errored=0`, `skill-loaded=history:5,call:0,none:0`; `lean-sau-tham-do-nap-skill-sonnet` 1 run, `trich-hard-gate` 1/1, `history-skill=seen`. Every invocation guarded on brainstorm skill `3b5ee008aaa94d05` and `evals/brainstorm` `9fb691b9e613811a` (every guard passed, rc=0). One host 2.1.289 across both sides. Spend $2.4654 of $20.
- Outcome: goc and sau `counts=` identical in both models (every grader 5/5, `co-goi-skill` 0/5 as expected for a history replay).
- Method change (user decision "Thay bằng chuỗi digest"): the run-level joined-line check was unobservable (kept directories hold no replayed history; `joined-seen.txt` 0/5 kept as a record), replaced by the digest chain.
- Review: code-auditor PASS_WITH_WARNINGS (runtime guard unverified, stale AC-03/Step 2 wording) → driver path supplied and wording fixed → PASS.
