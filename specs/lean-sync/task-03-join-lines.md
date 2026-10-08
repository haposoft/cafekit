# Task 03 — sync's prose is joined and its checklist becomes bullets, every word kept

Status: done

## Outcome
`packages/spec/src/claude/skills/sync/SKILL.md` is at most 52 lines (estimate 50): hard-wrapped prose joined by plan D-01, the six checklist markers `1.`–`6.` are `- `, no numbered list outside fences; against `13304cd4` with its markers normalised, the word stream and block structure are identical; frontmatter, the Commands fence and table lines byte-identical; `references/` unchanged; the full self-test passes.

## Scope
- In: `sync/SKILL.md` only.
- Out: any word change; frontmatter; `sync/references/*`; any test file (no pin crosses a line break the join removes — plan Scope).

## Coverage
- CP-01

## Kept pins
Each stays on one line after the join (no edit needed): "An audit writes nothing until the user confirms the named changes" (`:64`, raw anchor `run-skill-self-tests.mjs:4156`), "references/rebind-and-audit.md" (`:66`, `:4159`), the Commands fence with `/cf:sync rebind <feature> [<task-NN-slug.md>]` and the bare `/cf:sync` line (`:21-29`, `:4158` and the `/\n\/cf:sync\n/` regex), "current inline Receipt" (`:43`), "`specs/<feature>/task-*.md` beside `plan.md`" (`:59`), `sync-finalize` (`:52`, `develop-contract.test.js:208`).

## Ownership
- Modify: `packages/spec/src/claude/skills/sync/SKILL.md`
- Read: plan D-01, `specs/lean-brainstorm/task-02-join-lines.md` (the same joiner)

## Steps
0. Preflight per plan D-08: set `specs/_shared/active-feature.json` to `{"featureName":"lean-sync"}`; wait until no sibling lean packet (`lean-test`, `lean-develop`, `lean-code-review`, `lean-research`) has its task 01 or task 03 `in_progress` and `git status --short evals/lean packages/spec` lists nothing outside `packages/spec/src/claude/skills/sync/SKILL.md`.
1. Join per plan D-01 and turn the six `N. ` markers at `:37-50` into `- `; nothing else.
2. Run the Command. Its output ends with `sync-digest=<16hex>` (plan Scope digest of the joined skill directory), which the Receipt's fenced output carries; task 04 checks every lean cell against it.

## Acceptance
- AC-03: ≤52 lines; no numbered list outside fences; words and structure identical after marker normalisation; frontmatter, fences and tables byte-identical; references unchanged; `[skill-test] PASS`; `sync-digest=` printed for task 04.

## Dependencies
- task-02-measure-current.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-02-measure-current.md && f=packages/spec/src/claude/skills/sync/SKILL.md && B=13304cd4 && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 52 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! awk '/^```/{c=!c;next} !c && /^[0-9]+\. /' $f | grep . && base() { git show $B:$f | sed -E 's/^([[:space:]]*)[0-9]+\. /\1- /'; } && cmp <(base | tr -s ' \n\t' '\n\n\n') <(tr -s ' \n\t' '\n\n\n' < $f) && echo words-identical && re='^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' && sx='s/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/' && [ "$(base | grep -E "$re" | sed -E "$sx")" = "$(grep -E "$re" $f | sed -E "$sx")" ] && echo structure-identical && diff <(git show $B:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show $B:$f | awk '/^```/{c=!c;print;next} c') <(awk '/^```/{c=!c;print;next} c' $f) && diff <(git show $B:$f | grep '^|') <(grep '^|' $f) && echo "frontmatter fences tables identical" && git diff --quiet $B -- packages/spec/src/claude/skills/sync/references && echo references-unchanged && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS: [0-9]+ tests executed') && echo "sync-digest=$(cd packages/spec/src/claude/skills/sync && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)"`
- Named probe: line count, numbered-list scan, word-stream `cmp`, block-structure comparison, frontmatter/fence/table diffs, references diff; `run-skill-self-tests.mjs` (`[skill-test] PASS`, which includes the node suite with `develop-contract.test.js` and `codex-native.test.js`).
- Reachability: the installer copies `skills/sync` to every runtime; `evals/run.sh` copies it for task 04.
- Oracle: `lines=<n>` ≤52, `words-identical`, `structure-identical`, `frontmatter fences tables identical`, `references-unchanged`, `[skill-test] PASS: <n> tests executed`, `sync-digest=<16hex>` (not `1cab4e4dca9e4763`), exit 0.
- Counterexample: a changed word, a moved block, a remaining numbered list, a touched fence or reference, or a failing pin makes the Command exit 1 (`set -o pipefail` keeps a failing self-test from passing through `grep`). Before the edit it exits 1 at the task-02 `Status: done` check, and with that met at `too long: 72`.
- Artifacts: the edited skill file (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-02-measure-current.md && f=packages/spec/src/claude/skills/sync/SKILL.md && B=13304cd4 && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 52 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! awk '/^```/{c=!c;next} !c && /^[0-9]+\. /' $f | grep . && base() { git show $B:$f | sed -E 's/^([[:space:]]*)[0-9]+\. /\1- /'; } && cmp <(base | tr -s ' \n\t' '\n\n\n') <(tr -s ' \n\t' '\n\n\n' < $f) && echo words-identical && re='^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' && sx='s/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/' && [ "$(base | grep -E "$re" | sed -E "$sx")" = "$(grep -E "$re" $f | sed -E "$sx")" ] && echo structure-identical && diff <(git show $B:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show $B:$f | awk '/^```/{c=!c;print;next} c') <(awk '/^```/{c=!c;print;next} c' $f) && diff <(git show $B:$f | grep '^|') <(grep '^|' $f) && echo "frontmatter fences tables identical" && git diff --quiet $B -- packages/spec/src/claude/skills/sync/references && echo references-unchanged && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS: [0-9]+ tests executed') && echo "sync-digest=$(cd packages/spec/src/claude/skills/sync && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)"`
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 0ba625abfa5ec016efda3e491fae679347f99ebf4594bef880d217609afdf433
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-02-measure-current.md && f=packages/spec/src/claude/skills/sync/SKILL.md && B=13304cd4 && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 52 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! awk '/^```/{c=!c;next} !c && /^[0-9]+\. /' $f | grep . && base() { git show $B:$f | sed -E 's/^([[:space:]]*)[0-9]+\. /\1- /'; } && cmp <(base | tr -s ' \n\t' '\n\n\n') <(tr -s ' \n\t' '\n\n\n' < $f) && echo words-identical && re='^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' && sx='s/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/' && [ "$(base | grep -E "$re" | sed -E "$sx")" = "$(grep -E "$re" $f | sed -E "$sx")" ] && echo structure-identical && diff <(git show $B:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show $B:$f | awk '/^```/{c=!c;print;next} c') <(awk '/^```/{c=!c;print;next} c' $f) && diff <(git show $B:$f | grep '^|') <(grep '^|' $f) && echo "frontmatter fences tables identical" && git diff --quiet $B -- packages/spec/src/claude/skills/sync/references && echo references-unchanged && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS: [0-9]+ tests executed') && echo "sync-digest=$(cd packages/spec/src/claude/skills/sync && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)"
lines=50
words-identical
structure-identical
frontmatter fences tables identical
references-unchanged
[skill-test] PASS: 1340 tests executed
sync-digest=72c437df1ea657c6
```

sync-digest=72c437df1ea657c6. Review: code-auditor PASS (join-only, 1.–6. → bullets in order, pins and raw anchors still match, references unchanged). Pre-change run: too long: 72. SKILL.md 72 → 50 lines. Deviation from Step 0: git status of evals/lean and packages/spec also lists the uncommitted, finished changes of lean-develop task 03 and the task 01s of the lean packets (no commit was authorized); no sibling task 01 or 03 was in progress.
