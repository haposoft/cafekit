# Task 03 — develop reads as joined standards, words unchanged

Status: done

## Outcome
`packages/spec/src/claude/skills/develop/SKILL.md` is at most 125 lines: no numbered list outside fences; frontmatter, every heading (title `# Develop — implement, prove, synchronize`, `## Task cycle`, `### 1. Scout` … `### 4. Finish the requested boundary`) the selection table (`:70-78`), the Attached references bullets and the two repair lines `:122`, `:123` byte-identical to `13304cd4`; the line-prefix structure (blank lines, headings, list markers, table rows, fences) and the whitespace-normalized word stream equal to `13304cd4` once its four Resolve list markers read `- `; every existing pin passes.

## Scope
- In: `develop/SKILL.md` layout (plan D-01); in `packages/spec/scripts/run-skill-self-tests.mjs` only what plan D-02 names.
- Out: frontmatter, any word change, `develop/references/*`, `develop-contract.test.js` and every other test file, any other skill.

## Coverage
- CP-01

## Rule map
The only removed step list is Resolve the work packet (`13304cd4` `SKILL.md:44-47`). Each rule stays verbatim on one bullet line.

| Rule | Kept phrase |
|---|---|
| packet | "Resolve one `specs/<feature>/plan.md` plus flat `task-NN-*.md`; an explicit task path wins." |
| scope read | "Read GATE-SCOPE scope, exclusions, acceptance mapping, ownership, and task order." |
| dependency | "A task is unblocked only when every named dependency is `done` with a valid current inline Receipt." |
| no packet | "Without a packet, work directly only when the change is clear, isolated, reversible, and low-risk." |

Protected repair lines (whole lines, not joined): `13304cd4` `SKILL.md:122` ("Unless under `--flash` or the command costs money …") and `:123` ("Passing before any change, outside a resumed task, … but never run it as proof.").

## Self-test anchors to rewrite (plan D-02)
Same mutation name and issue; only the `\n` inside the anchor becomes one space, in `from` and in any `to` that repeats it:
- `run-skill-self-tests.mjs:2590` `specificTaskBoundary` (`"Specific-task\nmode never touches a sibling …"`) and the three `to` strings at `:2681-2683`;
- `:2670` `"Do not blindly replay a non-idempotent\nmutation."`;
- `:2695` and `:2696` `"detected state, task, or owned-path drift stops\nbefore any Status or Receipt write."`.
Every other skill anchor was checked against a joined draft and stays a single raw match (23 anchors incl. `## Task cycle` `:2737`, `name: cf:develop`, `/cf:develop specs/<feature>`, and the consumer clause `:983`). Line floor (decided at GATE-REVIEW 2026-10-07, plan D-02), located by string, not line number: `skillLines < 140 || skillLines > 200` → `skillLines < 115 || skillLines > 200` (near `:2570`); in the entry labelled `cf:develop SKILL stays within directional context budget` (near `:5248`) `>= 140` → `>= 115`; the 200 ceiling and core ≤400 stay. The `cf:specs SKILL stays lean after slim-flow diet` entry also reads `>= 140` and is not touched.

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `specs/lean-develop/plan.md` D-01, D-02

## Steps
1. Schedule (plan D-08): start only when no sibling lean packet (`lean-test`, `lean-code-review`, `lean-research`, `lean-sync`) has its task 01 or task 03 `in_progress` (its paid tasks 02 and 04, which edit no shared file, do not block) and `git status --short evals/lean packages/spec` shows no change outside this task's owned files; `specs/_shared/active-feature.json` is `{"featureName":"lean-develop"}`.
2. Rewrite as plan D-01: join plain-prose continuation lines outside frontmatter, fences and the table (words unchanged); keep `:122` and `:123` as two whole lines; turn the four numbered Resolve items into `- ` bullets; leave every heading, the table, every bullet and every blank line as is (paragraph boundaries stay).
3. Self-test: apply the anchor and floor changes above; add one test entry that pins the four rule-map phrases on single lines, the two protected lines, and the absence of a numbered list outside fenced blocks in `develop/SKILL.md`, with two in-test mutations in the existing mutation style: dropping one rule-map phrase and re-adding `1. ` to a Resolve bullet must each fail the entry.
4. Record the lean skill digest for task 04 as a Receipt note line `skill=<16 hex>` (`cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16`); it is the only `skill=` followed by 16 hex in this file.
5. Run the Command.

## Acceptance
- AC-03: ≤125 lines; no numbered list outside fences; frontmatter, headings, selection table and Attached references bullets byte-identical; line-prefix structure (blank lines included) identical; protected lines present; word stream unchanged; every rule-map phrase present; `[skill-test] PASS`.

## Dependencies
- task-02-measure-current.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-02-measure-current.md && f=packages/spec/src/claude/skills/develop/SKILL.md && b=$(mktemp) && git show 13304cd4:$f > $b && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 125 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! awk '/^```/{c=!c;next} !c && /^[0-9]+\. /' $f | grep . && diff <(awk '/^---$/{c++} c<2' $b) <(awk '/^---$/{c++} c<2' $f) && diff <(grep '^#' $b) <(grep '^#' $f) && diff <(sed -n 70,78p $b) <(grep '^|' $f) && diff <(sed -n '/^## Attached references/,$p' $b | grep '^- ') <(sed -n '/^## Attached references/,$p' $f | grep '^- ') && s1=$(sed -E 's/^[0-9]+\. /- /' $b | grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/') && s2=$(grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' $f | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/') && { [ "$s1" = "$s2" ] || { echo "structure changed"; exit 1; }; } && echo structure-identical && sed -n '122p;123p' $b | while IFS= read -r x; do grep -qxF -- "$x" $f || { echo "repair line lost"; exit 1; }; done && diff <(sed -E 's/^[0-9]+\. /- /' $b | tr -s ' \t\n' '\n\n\n') <(tr -s ' \t\n' '\n\n\n' < $f) > /dev/null && echo words-unchanged && for p in 'Resolve one `specs/<feature>/plan.md` plus flat `task-NN-*.md`; an explicit task path wins.' 'Read GATE-SCOPE scope, exclusions, acceptance mapping, ownership, and task order.' 'A task is unblocked only when every named dependency is `done` with a valid current inline Receipt.' 'Without a packet, work directly only when the change is clear, isolated, reversible, and low-risk.'; do grep -qxF -- "- $p" $f || { echo "rule lost: $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
- Named probe: line count, numbered-list scan, frontmatter, heading, selection-table and Attached-references diffs, line-prefix structure, protected lines, word-stream diff against `13304cd4`, rule-map bullets; `run-skill-self-tests.mjs` (`[skill-test] PASS`, which includes the node suite, `develop-contract.test.js` and `codex-native.test.js`).
- Reachability: the installer copies `skills/develop` for Claude and Codex (`develop-contract.test.js:401-419`, `codex-native.test.js:2560-2585`); `evals/run.sh` copies it for task 04; `evals/develop/save-runs.mjs:22` finds the unchanged title.
- Oracle: `lines=<n>` ≤125, `structure-identical`, `words-unchanged`, `[skill-test] PASS: <n> tests executed`, exit 0.
- Counterexample: a reworded sentence, a dropped or renamed heading, a merged paragraph (lost blank line), a changed table row or reference bullet, a joined repair line, a numbered list left, or a lost rule-map phrase makes the Command exit 1.
- Artifacts: the edited source files (tracked); the lean skill digest as a Receipt note `skill=<16 hex>` for task 04.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-02-measure-current.md && f=packages/spec/src/claude/skills/develop/SKILL.md && b=$(mktemp) && git show 13304cd4:$f > $b && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 125 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! awk '/^```/{c=!c;next} !c && /^[0-9]+\. /' $f | grep . && diff <(awk '/^---$/{c++} c<2' $b) <(awk '/^---$/{c++} c<2' $f) && diff <(grep '^#' $b) <(grep '^#' $f) && diff <(sed -n 70,78p $b) <(grep '^|' $f) && diff <(sed -n '/^## Attached references/,$p' $b | grep '^- ') <(sed -n '/^## Attached references/,$p' $f | grep '^- ') && s1=$(sed -E 's/^[0-9]+\. /- /' $b | grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/') && s2=$(grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' $f | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/') && { [ "$s1" = "$s2" ] || { echo "structure changed"; exit 1; }; } && echo structure-identical && sed -n '122p;123p' $b | while IFS= read -r x; do grep -qxF -- "$x" $f || { echo "repair line lost"; exit 1; }; done && diff <(sed -E 's/^[0-9]+\. /- /' $b | tr -s ' \t\n' '\n\n\n') <(tr -s ' \t\n' '\n\n\n' < $f) > /dev/null && echo words-unchanged && for p in 'Resolve one `specs/<feature>/plan.md` plus flat `task-NN-*.md`; an explicit task path wins.' 'Read GATE-SCOPE scope, exclusions, acceptance mapping, ownership, and task order.' 'A task is unblocked only when every named dependency is `done` with a valid current inline Receipt.' 'Without a packet, work directly only when the change is clear, isolated, reversible, and low-risk.'; do grep -qxF -- "- $p" $f || { echo "rule lost: $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 319d36d84c51bf017f6f91a09623918bd3f02fbb4e44fa8d10a759c45b2a0da1
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-02-measure-current.md && f=packages/spec/src/claude/skills/develop/SKILL.md && b=$(mktemp) && git show 13304cd4:$f > $b && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 125 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! awk '/^```/{c=!c;next} !c && /^[0-9]+\. /' $f | grep . && diff <(awk '/^---$/{c++} c<2' $b) <(awk '/^---$/{c++} c<2' $f) && diff <(grep '^#' $b) <(grep '^#' $f) && diff <(sed -n 70,78p $b) <(grep '^|' $f) && diff <(sed -n '/^## Attached references/,$p' $b | grep '^- ') <(sed -n '/^## Attached references/,$p' $f | grep '^- ') && s1=$(sed -E 's/^[0-9]+\. /- /' $b | grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/') && s2=$(grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' $f | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/') && { [ "$s1" = "$s2" ] || { echo "structure changed"; exit 1; }; } && echo structure-identical && sed -n '122p;123p' $b | while IFS= read -r x; do grep -qxF -- "$x" $f || { echo "repair line lost"; exit 1; }; done && diff <(sed -E 's/^[0-9]+\. /- /' $b | tr -s ' \t\n' '\n\n\n') <(tr -s ' \t\n' '\n\n\n' < $f) > /dev/null && echo words-unchanged && for p in 'Resolve one `specs/<feature>/plan.md` plus flat `task-NN-*.md`; an explicit task path wins.' 'Read GATE-SCOPE scope, exclusions, acceptance mapping, ownership, and task order.' 'A task is unblocked only when every named dependency is `done` with a valid current inline Receipt.' 'Without a packet, work directly only when the change is clear, isolated, reversible, and low-risk.'; do grep -qxF -- "- $p" $f || { echo "rule lost: $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'
lines=121
structure-identical
words-unchanged
[skill-test] PASS: 1340 tests executed
```

skill=ca5a3b6d6546262b. Review: code-auditor PASS with 2 Low, both applied in repair round 1: the repair-line check now needs each line to start and end with its own text, and the entry gains two mutations (an extra numbered line outside fences; the second repair line joined to the next paragraph). Pre-change run: too long: 169. SKILL.md 169 → 121 lines, join-only; floor 140 → 115 (GATE-REVIEW).
