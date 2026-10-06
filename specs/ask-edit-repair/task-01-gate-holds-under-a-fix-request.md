# Task 01 — The gate holds under a fix request

Status: done

## Outcome
`cf:ask`'s `ANSWER-ONLY-GATE` carries the D-01 sentence, and the self-test `cf:ask skill answers questions with repo-first evidence` requires it.

## Scope
- In: one sentence in `SKILL.md`'s gate block; one clause in the existing self-test.
- Out: other parts of the skill; `templates/question.md`; other skills; `.claude/`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/ask/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/bin/__tests__/{package-inventory,skill-routing-source,optional-skill-inventory}.test.js`

## Steps
1. Insert the D-01 sentence, on one line, in the gate block after its first line.
2. Add `content.includes("answer the cause with evidence, edit nothing")` and `content.includes("point to `cf:fix` for the change")` to the self-test.
3. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-01: the self-tests pass; the pinned Node tests pass; the sentence sits inside the gate block; the Command prints `ask-skill-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$out" | grep -E "cf:ask|skill-test\] PASS" && grep -qxF "✔ cf:ask skill answers questions with repo-first evidence" <<< "$out" && t=$(node --test bin/__tests__/package-inventory.test.js bin/__tests__/skill-routing-source.test.js bin/__tests__/optional-skill-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (tests|pass|fail)" && grep -qx "# fail 0" <<< "$t" && sed -n "/<ANSWER-ONLY-GATE>/,/<\/ANSWER-ONLY-GATE>/p" src/claude/skills/ask/SKILL.md | tr -s "[:space:]" " " | grep -qF "answer the cause with evidence, edit nothing, and point to" && grep -qF "includes(\"answer the cause with evidence, edit nothing\")" scripts/run-skill-self-tests.mjs && sed -n "/<ANSWER-ONLY-GATE>/,/<\/ANSWER-ONLY-GATE>/p" src/claude/skills/ask/SKILL.md | tr -s "[:space:]" " " | grep -qE "edit nothing, and point to .cf:fix. for the change, or to .cf:debug. when the cause is not yet known" && grep -qE "includes\(.point to .cf:fix. for the change.\)" scripts/run-skill-self-tests.mjs && d=$( (cd src/claude && find skills/ask -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "ask-skill-digest: $d"'`
- Named probe: `cf:ask skill answers questions with repo-first evidence` in `run-skill-self-tests.mjs`; the three Node test files
- Reachability: known — `evals/run.sh ask` builds the eval plugin from `packages/spec/src/claude/skills/ask`
- Oracle: the Command exits 0 with the self-test line, `# fail 0` and the digest
- Counterexample: dropping the sentence makes the self-test fail; moving it out of the gate block, or dropping `cf:fix` or `cf:debug` from it, makes the Command fail
- Artifacts: none
- Runtime: the self-test suite takes over 300 s; run the Command in the background or with a longer timeout.

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$out" | grep -E "cf:ask|skill-test\] PASS" && grep -qxF "✔ cf:ask skill answers questions with repo-first evidence" <<< "$out" && t=$(node --test bin/__tests__/package-inventory.test.js bin/__tests__/skill-routing-source.test.js bin/__tests__/optional-skill-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (tests|pass|fail)" && grep -qx "# fail 0" <<< "$t" && sed -n "/<ANSWER-ONLY-GATE>/,/<\/ANSWER-ONLY-GATE>/p" src/claude/skills/ask/SKILL.md | tr -s "[:space:]" " " | grep -qF "answer the cause with evidence, edit nothing, and point to" && grep -qF "includes(\"answer the cause with evidence, edit nothing\")" scripts/run-skill-self-tests.mjs && sed -n "/<ANSWER-ONLY-GATE>/,/<\/ANSWER-ONLY-GATE>/p" src/claude/skills/ask/SKILL.md | tr -s "[:space:]" " " | grep -qE "edit nothing, and point to .cf:fix. for the change, or to .cf:debug. when the cause is not yet known" && grep -qE "includes\(.point to .cf:fix. for the change.\)" scripts/run-skill-self-tests.mjs && d=$( (cd src/claude && find skills/ask -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "ask-skill-digest: $d"'
Exit: 0
Base: f574909fdae87f496e79e0a8dc85c38899396304
Head: fee511c3fbc75657d2ac5322c58c1cf0d49fece18a432f0b585f68df8b00d34b
```text
✔ cf:ask skill answers questions with repo-first evidence
✔ cf:ask template captures answer evidence and gaps
✔ cf:ask is packaged from the ask directory and the question directory is retired
[skill-test] PASS: 1658 tests executed
# tests 35
# pass 34
# fail 0
ask-skill-digest: e69aa781a0072db6644c6eae006512da58b8ea23e2e9e96b4ae83fcabb17519b
```

Fresh code-auditor review: PASS (the sentence equals D-01 verbatim, one line inside the gate, no echo of cam-sua's prompt; the self-test assert fails without the sentence or either pinned clause, and the Command fails when cf:debug is dropped or the sentence leaves the gate; the 35/34/0 Node count is a pre-existing opt-in Codex E2E skip in package-inventory.test.js). Lows: 'answer the cause' presumes a why-question; the self-test alone does not pin cf:debug or the gate position. Re-run at the final-Head fixed point.
