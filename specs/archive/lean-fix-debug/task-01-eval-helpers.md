# Task 01 — Eval helpers report loaded runs, grader comparisons and spend

Status: done

## Outcome
`evals/lean/` holds three Node scripts that later tasks run: `loaded.mjs` (was the skill really loaded in each run), `compare.mjs` (lean-goc vs lean-sau per cell and grader) and `budget.mjs` (spend against the $150 cap), each with a `--self-test`.

## Scope
- In: the three scripts and their synthetic self-tests.
- Out: any paid run; any file under `evals/fix/`, `evals/debug/`, `evals/fix-s55/`, `evals/run.sh`, `evals/compare-fix.mjs`.

## Coverage
- CP-02

## Ownership
- Create: `evals/lean/loaded.mjs`, `evals/lean/compare.mjs`, `evals/lean/budget.mjs`
- Read: `evals/fix-s55/skill-loaded.mjs`, `evals/compare-fix.mjs`, `evals/ask/budget.mjs`, `evals/results/fix/base-red-truoc-opus/result.json`, `evals/results/debug/base2-chi-chan-doan-opus/result.json`

## Steps
1. `loaded.mjs <skill> <result dir>...`: first open each run's kept directory with `chmod -R u+rwX` (the harness seals it mode 000; `evals/test/save-runs.mjs:55-57`, `evals/fix/verify-run-log.mjs:41`); then, per plan D-04, a run is loaded when its trace's init event lists the skill under a plugin prefix (`/^[^:]+:<skill>$/`; the host lists built-ins named `debug` and `code-review`) and either a `Skill` call for it gets a non-error result starting `Launching skill: ` (`evals/fix-s55/skill-loaded.mjs:2-11` with `fix` replaced by `<skill>`) and a user event's own text block (not a tool result) in the trace or in a session transcript (`*.jsonl` under a `projects/` directory below the kept directory `dirname(dirname(tracePath))`, as `evals/test/save-runs.mjs:61-90`) starts `Base directory for this skill: ` with its first line ending `/skills/<skill>`. Per run `<dir> run=<i> loaded=<yes|no|no-trace|unreadable> via=<tool|slash|-> model=<init>`, then `<dir> loaded=<k>/<n> model=<models>`; exit 1 when any run is `unreadable` (a recorded `tracePath` that cannot be read). Self-test on synthetic kept directories: slash load (transcript only); tool load; failed `Skill` call and no transcript; a `Read` of the skill file only; another skill loaded; no tracePath; unreadable tracePath → exit 1; a kept directory sealed mode 000 that still loads; the heading string inside a tool result only (not loaded); another skill's body mentioning `/skills/<skill>` (not loaded); a host built-in of the same bare name only (not loaded); a skill name with `-`.
2. `compare.mjs --skill <fix|debug> [--cells <case>-<model>,…] [--base-only]`: cells `lean-goc-<case>-<model>` vs `lean-sau-<case>-<model>` under `evals/results/<skill>/`, each replaced by its `-lan1` sibling when one exists (plan D-06); cases are the directories of `evals/<skill>/` holding a `case.yaml`; counts exclude runs with `error` or `skippedPaidGraders`. Per cell and grader not starting `dem-`: `cell=<case>-<model> grader=<g> base=<x>/<n> after=<y>/<m> p=<p> <safety|primary|expected|watch> [REGRESS]`; a grader in none of plan D-05's classes → exit 1. Per cell a `dem-*` median line and `cost base= after= seconds base= after= errored base= after= host base=<v> after=<v> [HOST-DRIFT]` (host from each side's `host.txt`, first line, `HOST-DRIFT` when the sides differ or a `host.txt` holds two different versions). Then per model and safety/primary grader a pooled line `pooled=<model> grader=<g> base=<x>/<n> after=<y>/<m> p=<p> [REGRESS]`. `REGRESS` follows plan D-05 (bad direction inverted for the derived `cao-chua-chay`, added to every debug run that carries both `noi-do-tin-cao` and `da-chay`). An unknown `--cells` name or an empty selection → exit 1. Last line `regress=<k> host-drift=<h>`. Fisher two-sided as `evals/compare-fix.mjs:26-38`, `toPrecision(4)`. Exit 1 when a cell is missing or partial; exit 0 with regressions (GATE-DONE reads them). `--base-only` checks only that every goc cell exists, is complete and has a `host.txt`. Self-test on a `mktemp -d` root: equal cells → `regress=0`; a safety grader 10/10 → 9/10 → `REGRESS`; a primary 6/10 → 4/10 → `REGRESS`; a primary 6/10 → 5/10 → none; a primary 6/10 → 5/8 (rate rises) → none; pooled 36/40 → 26/40 → pooled `REGRESS`; an expected grader 10 → 0 → none; derived `cao-chua-chay` 0 → 1 → `REGRESS` while `noi-do-tin-cao` alone is `watch`; an unknown `--cells` name → exit 1; an unclassified grader → exit 1; a missing cell → exit 1; a `-lan1` sibling used; differing `host.txt` → `HOST-DRIFT`.
3. `budget.mjs spent|check <next> [--root <results>]`: sum top-level `costUsd` plus every run's `judgeCostUsd` of every `result.json` directly under `evals/results/{fix,debug}/lean-*`; print `budget: spent=<x> cap=150` (`check` adds `next= total=`), exit 1 above the cap. Self-test on a `mktemp -d` root.

## Acceptance
- AC-01: the three self-tests print `self-test: ok` and exit 0.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/loaded.mjs --self-test && node evals/lean/compare.mjs --self-test && node evals/lean/budget.mjs --self-test && node evals/lean/budget.mjs spent && t=$(mktemp -d) && ! node evals/lean/loaded.mjs fix evals/results/fix/base-red-truoc-opus > $t/old.txt && echo old-cell-exit=1 && tail -1 $t/old.txt && [ "$(grep -c ' loaded=unreadable ' $t/old.txt)" = 10 ] && echo unreadable=10`
- Named probe: the three `--self-test` runs; `budget.mjs spent` on the real tree (`spent=0` before task 02); `loaded.mjs` on a real old cell whose kept traces under `/private/tmp` are gone, so every run reports `unreadable` and the script exits 1 — the probe records that exit and counts the lines.
- Reachability: tasks 02 and 04 run these scripts by these paths.
- Oracle: three `self-test: ok` lines, `budget: spent=0 cap=150`, `old-cell-exit=1`, a summary line `… loaded=0/10 …`, `unreadable=10`, exit 0.
- Counterexample: a loaded check that misses a slash load, a compare that ignores `-lan1`, flags an expected grader, misses the derived `cao-chua-chay` or its direction or the pooled test, or accepts an unclassified grader fails its self-test.
- Artifacts: the three scripts (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/loaded.mjs --self-test && node evals/lean/compare.mjs --self-test && node evals/lean/budget.mjs --self-test && node evals/lean/budget.mjs spent && t=$(mktemp -d) && ! node evals/lean/loaded.mjs fix evals/results/fix/base-red-truoc-opus > $t/old.txt && echo old-cell-exit=1 && tail -1 $t/old.txt && [ "$(grep -c ' loaded=unreadable ' $t/old.txt)" = 10 ] && echo unreadable=10
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: a7e96572b408dd10f597b3cd348c07c37382a937cd2eea750e7b0c803a2741c1
```text
ok: slash load (transcript only) → run=1 loaded=yes via=slash model=claude-sonnet-5-5
ok: tool load → run=1 loaded=yes via=tool model=claude-sonnet-5-5
ok: failed Skill call, no transcript → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: Read of the skill file only → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: another skill loaded → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: skill not in init → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: host built-in of the same name only → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: sealed kept directory still loads → run=1 loaded=yes via=slash model=claude-sonnet-5-5
ok: heading string inside a tool result only → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: another skill body mentioning /skills/fix later → run=1 loaded=no via=- model=claude-sonnet-5-5
ok: bare-name Skill call counts as tool → run=1 loaded=yes via=tool model=claude-sonnet-5-5
ok: skill name with - → run=1 loaded=yes via=slash model=claude-sonnet-5-5
ok: no tracePath → run=1 loaded=no-trace via=- model=-
ok: unreadable tracePath → run=1 loaded=unreadable via=- model=-
ok: summary line → loaded=0/2 model=-
self-test: ok
ok: equal cells → regress=0
ok: safety 10/10 → 9/10 → REGRESS
ok: primary 6/10 → 4/10 → REGRESS
ok: expected 10 → 0 → none
ok: primary 6/10 → 5/8 (rate rises) → none
ok: primary 6/10 → 5/10 → none
ok: pooled 36/40 → 26/40 → pooled REGRESS
ok: high confidence without running 0 → 1 → REGRESS
ok: noi-do-tin-cao alone is watch
ok: unreadable da-chay count → bad
ok: unknown --cells name → bad
ok: unclassified grader → bad
ok: missing cell → bad
ok: -lan1 sibling used
ok: differing host.txt → HOST-DRIFT
ok: partial cell → bad
ok: --base-only needs host.txt
ok: fisher 10/10 vs 0/10
self-test: ok
ok: empty root → 0
ok: sums lean-* under fix and debug only
budget: spent=4.85 next=100 total=104.85 cap=150
ok: check within cap → 0
budget: spent=4.85 next=146 total=150.85 cap=150
ok: check above cap → 1
budget: spent=4.85 cap=150
ok: spent within cap → 0
budget: spent=204.85 cap=150
ok: spent above cap → 1
usage: node evals/lean/budget.mjs spent | check <next> [--root <results root>] | --self-test
ok: bad usage → 2
self-test: ok
budget: spent=0 cap=150
old-cell-exit=1
evals/results/fix/base-red-truoc-opus loaded=0/10 model=-
unreadable=10
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any file existed the first probe failed (`Cannot find module …/evals/lean/loaded.mjs`, exit 1). The real-cell probe records `old-cell-exit=1` and `unreadable=10` (that cell's kept traces under /private/tmp are gone).
- Extra evidence: `loaded.mjs test` on the 10 slash-loaded traces of `evals/results/test/_kept/base-sach-sonnet.tar.gz` → `loaded=10/10`; every one of the 45 real non-`dem-` graders classified exactly once.
- Review: code-auditor FAIL (H-1 heading match on raw JSONL gave a false `loaded=yes`; M-1 `--cells` typo passed; M-2 the inverted `noi-do-tin-cao` guard could never fire) → repair round 1 → re-review PASS; its three Low notes applied before this run.
- Artifacts: `evals/lean/loaded.mjs`, `evals/lean/compare.mjs`, `evals/lean/budget.mjs` (untracked until commit).
