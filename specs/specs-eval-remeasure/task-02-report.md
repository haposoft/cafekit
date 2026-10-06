# Task 02 — A failure table maps current specs failures to its laws

Status: done

## Outcome
`specs/specs-eval-remeasure/summary.txt` holds `evals/summarize.mjs` output for the 14 cells; `report.md` tabulates every grader count per case and model beside the old count where one exists (reference only), flags graders below 8/10, and names for each flag the law or gate it measures, ending with a recommendation line: `2a` (which law and why) or `2b`.

## Scope
- In: the two files.
- Out: any skill or eval edit.

## Coverage
- CP-02

## Ownership
- Create: `specs/specs-eval-remeasure/summary.txt`, `specs/specs-eval-remeasure/report.md`
- Read: `evals/results/specs/lean-re-*`, old cells named in plan, `evals/specs/*/graders`

## Steps
1. `node evals/summarize.mjs $(for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do for m in sonnet opus; do d=evals/results/specs/lean-re-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; printf '%s ' $d; done; done) > specs/specs-eval-remeasure/summary.txt` (the same list the Command builds).
2. Write `report.md` per plan D-03 and D-05: one table per case (grader × sonnet/opus now, the invoked-runs count where printed, old count labelled "other world"); `## Flags` only by the D-05 expectations, each naming its surface and law, LLM flags with 1–2 quoted `evidence` lines; `## Coverage`; `## Recommendation` with `2a`, `2b` or `2c`.
3. Run the Command.

## Acceptance
- AC-02: `summary.txt` equals a fresh summarize run; `report.md` names all 7 cases, has `## Flags`, `## Coverage` and `## Recommendation` with one of `2a`, `2b`, `2c`.

## Dependencies
- task-01-measure.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/specs-eval-remeasure/task-01-measure.md && t=$(mktemp -d) && node evals/summarize.mjs $(for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do for m in sonnet opus; do d=evals/results/specs/lean-re-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; printf '%s ' $d; done; done) > $t/s.txt && cmp $t/s.txt specs/specs-eval-remeasure/summary.txt && echo summary-current && f=specs/specs-eval-remeasure/report.md && for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do grep -q "$c" $f || { echo "missing case $c"; exit 1; }; done && grep -q '^## Flags' $f && grep -q '^## Coverage' $f && grep -q '^## Recommendation' $f && awk '/^## Recommendation/{f=1;next} f' $f | grep -qE '\b2[abc]\b' && echo report-ok`
- Named probe: fresh summarize vs saved; report sections.
- Reachability: the report is read at GATE-DONE.
- Oracle: `summary-current`, `report-ok`, exit 0.
- Counterexample: a stale summary or a report missing a case or section makes the Command exit 1.
- Artifacts: the two files (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/specs-eval-remeasure/task-01-measure.md && t=$(mktemp -d) && node evals/summarize.mjs $(for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do for m in sonnet opus; do d=evals/results/specs/lean-re-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; printf '%s ' $d; done; done) > $t/s.txt && cmp $t/s.txt specs/specs-eval-remeasure/summary.txt && echo summary-current && f=specs/specs-eval-remeasure/report.md && for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do grep -q "$c" $f || { echo "missing case $c"; exit 1; }; done && grep -q '^## Flags' $f && grep -q '^## Coverage' $f && grep -q '^## Recommendation' $f && awk '/^## Recommendation/{f=1;next} f' $f | grep -qE '\b2[abc]\b' && echo report-ok
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 5d05a24693edc26df57a7b77c0646d33e6d01a28f3b7adfcf25ef7f96833c8d6
```text
summary-current
report-ok
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before `summary.txt` existed the Command exited 2 (`cmp: specs/specs-eval-remeasure/summary.txt: No such file or directory`).
- Report: per-case tables for all 7 cases with old counts labelled "other world"; no D-05 flag; observations outside D-05: sonnet skipped specs and implemented in 3 of 20 build-case runs (description surface), `khong-code` blind to file writes, four of five `khong-tu-chot` failures meet their rubric on reading; Recommendation `2c`.
- Review: fresh code-auditor round 1 PASS_WITH_WARNINGS (2 Medium, 3 Low: wrong rubric cited for `mo-ho-du-cua`, two codes in Recommendation, three wording points); all fixed; round 2 PASS, counts rechecked against `result.json` and traces.
