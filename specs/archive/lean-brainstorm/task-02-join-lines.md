# Task 02 — brainstorm's prose is joined, every word kept

Status: done

## Outcome
`SKILL.md` under `packages/spec/src/claude/skills/brainstorm/` has fewer lines with a whitespace-normalised word stream and block structure identical to `19c2dd0`, and `references/question-framework.md` (no hard-wrapped prose) is unchanged; frontmatter and every `<…>` gate block byte-identical; the three replay histories regenerated; the full self-test passes.

## Scope
- In: line joins per plan D-01; `node evals/brainstorm/make-history.mjs`.
- Out: any word change, graders, `agents/brainstormer.md`; tests other than the `\n`-bearing brainstorm mutation anchors (nine in `codex-native.test.js`, twelve in `package-inventory.test.js`) (the self-test clause checks normalise whitespace; its bundle check is an upper line budget, `run-skill-self-tests.mjs:2072-2079`).

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/src/claude/skills/brainstorm/references/question-framework.md`, `evals/brainstorm/{duyet-khong-trien-khai,ne-cau-hoi,tham-do-nap-skill}/history.jsonl` (`HISTORY_CASES` in `make-history.mjs`), `packages/spec/bin/__tests__/codex-native.test.js` (the nine anchors at about `:2431-2496` only), `packages/spec/bin/__tests__/package-inventory.test.js` (its twelve brainstorm mutation anchors at about `:201-234` only; added in repair round 1)
- Read: `evals/brainstorm/make-history.mjs`

## Steps
1. Join lines per D-01 in both files.
2. In `codex-native.test.js`, replace each `\n` inside the nine brainstorm mutation `from:` anchors with the single space the join produced (their `to:` strings unchanged unless they repeat the same text); no assertion removed.
3. `node evals/brainstorm/make-history.mjs`, then `--check`.
4. Run the Command.

## Acceptance
- AC-02: `SKILL.md` shorter with words and structure identical; the framework file unchanged; frontmatter and gate blocks byte-identical; `make-history.mjs --check` exits 0; `[skill-test] PASS`.

## Dependencies
- task-01-measure-current.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-brainstorm/task-01-measure-current.md && git diff --quiet 19c2dd0 -- packages/spec/src/claude/skills/brainstorm/references/question-framework.md && echo framework-unchanged && for f in packages/spec/src/claude/skills/brainstorm/SKILL.md; do a=$(git show 19c2dd0:$f | wc -l | tr -d ' '); b=$(wc -l < $f | tr -d ' '); [ "$b" -lt "$a" ] || { echo "not shorter: $f"; exit 1; }; cmp <(git show 19c2dd0:$f | tr -s ' \n\t' '\n\n\n') <(tr -s ' \n\t' '\n\n\n' < $f) || { echo "words changed: $f"; exit 1; }; s1=$(git show 19c2dd0:$f | grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/'); s2=$(grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' $f | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/'); [ "$s1" = "$s2" ] || { echo "structure changed: $f"; exit 1; }; echo "$f $a -> $b words-identical structure-identical"; done && f=packages/spec/src/claude/skills/brainstorm/SKILL.md && diff <(git show 19c2dd0:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show 19c2dd0:$f | awk '/^<[A-Z-]+>$/,/^<\/[A-Z-]+>$/') <(awk '/^<[A-Z-]+>$/,/^<\/[A-Z-]+>$/' $f) && echo "frontmatter and gates identical" && node evals/brainstorm/make-history.mjs --check && cd packages/spec && node --test bin/__tests__/codex-native.test.js 2>&1 | grep -qE '^# fail 0$' && echo codex-native-ok && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
- Named probe: line counts, word-stream `cmp`, frontmatter and gate diffs, `make-history.mjs --check`, the full self-test.
- Reachability: the installer and `evals/run.sh` copy `skills/brainstorm`; the replay cases read the regenerated histories.
- Oracle: `framework-unchanged`, one `words-identical structure-identical` line with a smaller count, `codex-native-ok`, `frontmatter and gates identical`, a clean `--check`, `[skill-test] PASS`, exit 0.
- Counterexample: a changed word, a moved gate line, a stale history or a failing self-test makes the Command exit 1.
- Artifacts: the edited files (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-brainstorm/task-01-measure-current.md && git diff --quiet 19c2dd0 -- packages/spec/src/claude/skills/brainstorm/references/question-framework.md && echo framework-unchanged && for f in packages/spec/src/claude/skills/brainstorm/SKILL.md; do a=$(git show 19c2dd0:$f | wc -l | tr -d ' '); b=$(wc -l < $f | tr -d ' '); [ "$b" -lt "$a" ] || { echo "not shorter: $f"; exit 1; }; cmp <(git show 19c2dd0:$f | tr -s ' \n\t' '\n\n\n') <(tr -s ' \n\t' '\n\n\n' < $f) || { echo "words changed: $f"; exit 1; }; s1=$(git show 19c2dd0:$f | grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/'); s2=$(grep -E '^[[:space:]]*$|^#|^[[:space:]]*([-*]|[0-9]+\.) |^\||^```|^<' $f | sed -E 's/^([[:space:]]*([-*]|[0-9]+\.|#+|\||```|<)?).*/\1/'); [ "$s1" = "$s2" ] || { echo "structure changed: $f"; exit 1; }; echo "$f $a -> $b words-identical structure-identical"; done && f=packages/spec/src/claude/skills/brainstorm/SKILL.md && diff <(git show 19c2dd0:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show 19c2dd0:$f | awk '/^<[A-Z-]+>$/,/^<\/[A-Z-]+>$/') <(awk '/^<[A-Z-]+>$/,/^<\/[A-Z-]+>$/' $f) && echo "frontmatter and gates identical" && node evals/brainstorm/make-history.mjs --check && cd packages/spec && node --test bin/__tests__/codex-native.test.js 2>&1 | grep -qE '^# fail 0$' && echo codex-native-ok && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
Exit: 0
Base: 63be6b5dd0c1c4824d508260a8d96eed3baf91ba
Head: ad15217a4701ca66ce62393a9a97d0ed5b84420a6663017e9cd1a3dd9d015b42
```text
framework-unchanged
packages/spec/src/claude/skills/brainstorm/SKILL.md 221 -> 121 words-identical structure-identical
frontmatter and gates identical
ok: duyet-khong-trien-khai/history.jsonl equals its regeneration from the current SKILL.md
ok: ne-cau-hoi/history.jsonl equals its regeneration from the current SKILL.md
ok: tham-do-nap-skill/history.jsonl equals its regeneration from the current SKILL.md
codex-native-ok
[skill-test] PASS: 1603 tests executed
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before the edit the Command exited 1 (`not shorter: packages/spec/src/claude/skills/brainstorm/SKILL.md`). Repair round 1: the first full run failed on `package-inventory.test.js` (`claude/direct-precedence anchor must exist`) until its twelve brainstorm anchors were repaired like the nine Codex ones.
- Change: `SKILL.md` 221 → 121 lines by D-01 joins only; `references/question-framework.md` unchanged; 9 + 12 mutation anchors each changed only by a line break plus indent becoming one space (no `to:`/`expected` changed, no assertion removed); three histories regenerated, `make-history.mjs --check` clean.
- Review: code-auditor PASS (an independent D-01 joiner reproduces the new `SKILL.md` byte for byte; all 21 anchor edits match `old.replace(/\\n\\s*/g, ' ')`; two Low wording notes in this task file fixed).
