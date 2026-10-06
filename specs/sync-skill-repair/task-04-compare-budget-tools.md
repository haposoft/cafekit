# Task 04 — Comparison, budget and skill-loaded helpers exist

Status: done

## Outcome
`compare-sync.mjs` merges `result.json`, `verify-run.txt` and `skill-loaded.txt` per cell into one line per grader (Fisher exact p for base vs after), `budget-sync.mjs` sums every `base-*`/`sau-*` cost under `evals/results/sync` against $120, and `skill-loaded.mjs` counts runs that really loaded the skill.

## Scope
- In: `compare-sync.mjs` (`--base-only`, `--strict`, `--root`, `--digest`, `--write-sample <dir>` (one synthetic cell pair, 0/20 vs 20/20), `--self-test`; pinned line formats: `<case> <model> grader=<g> base=<a>/<n> after=<b>/<n> p=<x> primary|watch` with `p` printed as a fixed decimal `toFixed(6)` (never exponent form), `<case> <model> cost base=<usd> after=<usd>`, `<case> <model> loaded base=<a>/<n> after=<b>/<n>`, `instrument=same|differs`, `no cells` on an empty root; `--strict` refuses n ≠ 20, a missing model id, or a `<cell>/instrument.digest` or `verify-run.txt` first line that differs from `instrument.digest`, D-09; under `--base-only` the `after=` fields read `-`); `budget-sync.mjs` (`spent` prints exactly `budget: spent=<usd> cap=120`, `check <next>` exits 1 when spent + next > 120, `estimate <per-run> <runs>`, `--root`, `--self-test`; refuses a negative cap); `skill-loaded.mjs` (trace contains `Launching skill:` and a base directory ending in `/skills/sync`, D-06).
- Out: running any paid cell.

## Coverage
- CP-02

## Ownership
- Create: `evals/compare-sync.mjs`, `evals/budget-sync.mjs`, `evals/sync/skill-loaded.mjs`
- Read: `evals/develop/budget.mjs`, `evals/compare-code-review.mjs`, `../cafekit-fix-git-skill-repair/evals/compare-git.mjs` (patterns)

## Steps
1. Write `skill-loaded.mjs` with self-test (loaded trace → yes; `/cf:sync is not available` trace → no).
2. Write `budget-sync.mjs` → self-test sums pilots and `-lan1` dirs and ignores dirs without `result.json`.
3. Write `compare-sync.mjs` → self-test on synthetic cells gives the expected p (including 0/20 vs 20/20, which prints a fixed decimal), the pinned cost/loaded lines, and `instrument=differs` when a cell's digest differs.

## Acceptance
- AC-02

## Dependencies
- none

## Verification Plan
- Command: `node evals/compare-sync.mjs --self-test && node evals/budget-sync.mjs --self-test && node evals/sync/skill-loaded.mjs --self-test && e=$(mktemp -d) && node evals/compare-sync.mjs --base-only --root "$e" | grep -qx 'no cells' && node evals/budget-sync.mjs spent --root "$e" | grep -qE '^budget: spent=0 cap=120$' && ! node evals/budget-sync.mjs check 121 --root "$e" && node evals/budget-sync.mjs check 1 --root "$e" && s=$(mktemp -d) && node evals/compare-sync.mjs --write-sample "$s" && out=$(node evals/compare-sync.mjs --root "$s") && [ "$(printf '%s\n' "$out" | grep -cE '^[a-z-]+ (opus|sonnet) cost base=[0-9.]+ after=[0-9.]+$')" = 1 ] && [ "$(printf '%s\n' "$out" | grep -cE '^[a-z-]+ (opus|sonnet) loaded base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+$')" = 1 ] && printf '%s\n' "$out" | grep -qE ' p=0\.[0-9]{6} primary$' && rm -rf "$e" "$s"`
- Named probe: self-test cases `pilot-counted`, `rerun-counted`, `no-result-ignored`, `fisher-known-value`, `fisher-extreme-fixed-decimal`, `digest-differs`, `not-available-trace`; `--write-sample` writes one synthetic cell pair (0/20 vs 20/20) whose printed lines the Command checks against the pinned formats.
- Reachability: source level; node v22.23.3; no model.
- Oracle: exit 0; `check 121` exits 1 on an empty root.
- Counterexample: a budget that reads only `base-<case>-<model>` (skipping pilots) must fail `pilot-counted`.
- Artifacts: ephemeral temp root removed by the Command.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node evals/compare-sync.mjs --self-test && node evals/budget-sync.mjs --self-test && node evals/sync/skill-loaded.mjs --self-test && e=$(mktemp -d) && node evals/compare-sync.mjs --base-only --root "$e" | grep -qx 'no cells' && node evals/budget-sync.mjs spent --root "$e" | grep -qE '^budget: spent=0 cap=120$' && ! node evals/budget-sync.mjs check 121 --root "$e" && node evals/budget-sync.mjs check 1 --root "$e" && s=$(mktemp -d) && node evals/compare-sync.mjs --write-sample "$s" && out=$(node evals/compare-sync.mjs --root "$s") && [ "$(printf '%s\n' "$out" | grep -cE '^[a-z-]+ (opus|sonnet) cost base=[0-9.]+ after=[0-9.]+$')" = 1 ] && [ "$(printf '%s\n' "$out" | grep -cE '^[a-z-]+ (opus|sonnet) loaded base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+$')" = 1 ] && printf '%s\n' "$out" | grep -qE ' p=0\.[0-9]{6} primary$' && rm -rf "$e" "$s"
Exit: 0
Base: 07a9225b65371ab022ea2f649a6ee7c1af8aed0a
Head: 45764dc3e57ffde3cf77b5c38c6acea1927387d28719d0fda561794e041e4496
```text
$ node evals/compare-sync.mjs --self-test && node evals/budget-sync.mjs --self-test && node evals/sync/skill-loaded.mjs --self-test && e=$(mktemp -d) && node evals/compare-sync.mjs --base-only --root "$e" | grep -qx 'no cells' && node evals/budget-sync.mjs spent --root "$e" | grep -qE '^budget: spent=0 cap=120$' && ! node evals/budget-sync.mjs check 121 --root "$e" && node evals/budget-sync.mjs check 1 --root "$e" && s=$(mktemp -d) && node evals/compare-sync.mjs --write-sample "$s" && out=$(node evals/compare-sync.mjs --root "$s") && [ "$(printf '%s\n' "$out" | grep -cE '^[a-z-]+ (opus|sonnet) cost base=[0-9.]+ after=[0-9.]+$')" = 1 ] && [ "$(printf '%s\n' "$out" | grep -cE '^[a-z-]+ (opus|sonnet) loaded base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+$')" = 1 ] && printf '%s\n' "$out" | grep -qE ' p=0\.[0-9]{6} primary$' && rm -rf "$e" "$s"
ok fisher-known-value
ok fisher-extreme-fixed-decimal
ok digest-differs
ok strict-refuses-short-cell
ok strict-refuses-duplicate-verdicts
ok strict-refuses-error-verdicts
ok strict-refuses-missing-verdicts
ok grader-names-match-verify-run
self-test ok
ok pilot-counted
ok rerun-counted
ok no-result-ignored
self-test ok
ok not-available-trace
self-test ok: launched=yes, not-available=no, error=no, other skill=no, missing base text=no, unreadable=error
budget: spent=0 next=121 total=121 cap=120
budget: spent=0 next=1 total=1 cap=120
```
