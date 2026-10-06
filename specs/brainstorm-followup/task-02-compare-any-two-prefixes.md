# Task 02 — compare.mjs compares any two prefixes

Status: done

## Outcome
`node evals/brainstorm/compare.mjs --base-prefix <p> --after-prefix <q> [--cells …]` pairs `_regraded/<p><cell>.json` with `_regraded/<q><cell>.json` and runs the integrity check on the `<q><cell>` directories; without the options it prints exactly what it printed for the repair (`base-` against `sau-`).

## Scope
- In: the two options, their defaults, a self-test for them, the header comment.
- Out: graders, `regrade.mjs`, `read-traces.mjs`, `ceiling.mjs`, `budget.mjs`; any result file.

## Coverage
- CP-02

## Ownership
- Modify: `evals/brainstorm/compare.mjs`
- Read: `evals/brainstorm/compare.mjs:57-98` (cell loading and integrity), `:100-129` (self-test), `specs/brainstorm-repair/task-04-measure-compare.md` (Receipt: the repair's comparison output)

## Steps
1. Add `--base-prefix` (default `base-`) and `--after-prefix` (default `sau-`); `--base-only` keeps comparing the base prefix with itself.
2. Add a self-test `--base-prefix sau- --after-prefix sau2- pairs the two after sets` on synthetic files.
3. Run the Command; write the Receipt after a fresh review returns PASS.

## Acceptance
- AC-02: the self-test passes with the new check named in the Command; the default output and the explicit `--base-prefix base- --after-prefix sau-` output are byte-identical and equal the `cell=`/`integrity`/`claude-versions=` lines from the first `cell=` line on in the repair's task 04 Receipt output (frozen at `4b16602`); the checker passes; the Command prints `evals-brainstorm-digest-nohist:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && st=$(node evals/brainstorm/compare.mjs --self-test) && printf "%s\n" "$st" && printf "%s\n" "$st" | grep -qx "ok: compare self-test: --base-prefix sau- --after-prefix sau2- pairs the two after sets" && d=$(node evals/brainstorm/compare.mjs) && e=$(node evals/brainstorm/compare.mjs --base-prefix base- --after-prefix sau-) && [ "$d" = "$e" ] && r=$(awk "/^\`\`\`text/{f=1;next} /^\`\`\`/{f=0} f" specs/brainstorm-repair/task-04-measure-compare.md | sed -n "/^cell=/,\$p" | grep -E "^(cell=|integrity |claude-versions=)") && [ "$(printf "%s\n" "$d" | grep -E "^(cell=|integrity |claude-versions=)")" = "$r" ] && echo "default-and-explicit-equal-repair: $(printf "%s\n" "$d" | grep -c "^cell=") cell lines" && bash evals/brainstorm/check-fixtures.sh > /dev/null && echo "checker: ok" && n=$( (cd evals/brainstorm && find . -type f ! -name .DS_Store ! -name history.jsonl | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-brainstorm-digest-nohist: $n"'`
- Named probe: the compare self-test (the new check by exact line), the default/explicit equality, the equality with the repair's task 04 output, the checker
- Reachability: known — task 03's Command calls `compare.mjs --base-prefix sau- --after-prefix sau2-`
- Oracle: the Command exits 0 with the named lines
- Counterexample: options ignored → the self-test line is missing; a changed default → the repair equality fails
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && st=$(node evals/brainstorm/compare.mjs --self-test) && printf "%s\n" "$st" && printf "%s\n" "$st" | grep -qx "ok: compare self-test: --base-prefix sau- --after-prefix sau2- pairs the two after sets" && d=$(node evals/brainstorm/compare.mjs) && e=$(node evals/brainstorm/compare.mjs --base-prefix base- --after-prefix sau-) && [ "$d" = "$e" ] && r=$(awk "/^\`\`\`text/{f=1;next} /^\`\`\`/{f=0} f" specs/brainstorm-repair/task-04-measure-compare.md | sed -n "/^cell=/,\$p" | grep -E "^(cell=|integrity |claude-versions=)") && [ "$(printf "%s\n" "$d" | grep -E "^(cell=|integrity |claude-versions=)")" = "$r" ] && echo "default-and-explicit-equal-repair: $(printf "%s\n" "$d" | grep -c "^cell=") cell lines" && bash evals/brainstorm/check-fixtures.sh > /dev/null && echo "checker: ok" && n=$( (cd evals/brainstorm && find . -type f ! -name .DS_Store ! -name history.jsonl | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-brainstorm-digest-nohist: $n"'`
Exit: 0
Base: 1a90015f8244693acf0cba3ab1813d0f556d8c4d
Head: 30ba8822bccabdddb8294527cc03fd821477b97cea3bc75066bcfdc8bd6b7c3e
```text
ok: compare self-test: Fisher: 0/10 against 10/10 → p=0.00001083
ok: compare self-test: Fisher: equal counts → p=1.000
ok: compare self-test: a grader pair prints counts and p
ok: compare self-test: report-side and agent-route pairs print
ok: compare self-test: --base-prefix sau- --after-prefix sau2- pairs the two after sets
ok: compare self-test: --base-only prints p=1.000
ok: compare self-test: a regrade made with another grader is refused as stale
ok: compare self-test: a missing cell is refused
default-and-explicit-equal-repair: 154 cell lines
checker: ok
evals-brainstorm-digest-nohist: 5182a30988aebfe565b5c7cbbc46f4f14b2b38b10e5661d73dcef2b03b45eb18
```

The fenced block is the Command's whole output (2026-10-02, run by the controller via `bash` on this file's Command text; it returned 0). Before the change the same Command returned 1 (the new self-test line was absent). A fresh `code-auditor` review returned PASS with two Low notes: a prefix option given without a value falls back to its default, as `--cells` and `--root` already do; the self-test does not exercise integrity on the after prefix, which task 03's Command runs on the real `sau2-` cells.
