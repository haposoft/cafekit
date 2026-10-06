# Task 01 — The skill reads and reruns before an ordinary PASS

Status: done

## Outcome
`cf:test` tells the agent, for Ordinary non-Spec testing, to read the related tests before a `PASS` or `PASS_WITH_WARNINGS`, to return `FAIL` when an assertion or its pass condition depends on a nondeterministic source, and to rerun the suspect tests when only setup does, with the wording of plan D-01 in `SKILL.md`, §2 and the triage flaky row; the skill self-tests pin the sentences (plan D-02).

## Scope
- In: one Execution step in `SKILL.md`; one paragraph in `references/execution-strategy.md` §2; the evidence cell of the flaky row in `references/failure-triage.md`; required clauses and five mutations in `run-skill-self-tests.mjs`.
- Out: the process-first and legacy routes; other rows of `failure-triage.md`; the payload; other skills; `.claude/`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/test/SKILL.md`, `packages/spec/src/claude/skills/test/references/execution-strategy.md`, `packages/spec/src/claude/skills/test/references/failure-triage.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/bin/__tests__/develop-contract.test.js`, `packages/spec/bin/__tests__/codex-native.test.js`

## Steps
1. `SKILL.md` Execution: insert the D-01 step after step 3 and renumber; repeat no existing anchor.
2. `execution-strategy.md` §2: the D-01 paragraph after the ordinary-scope paragraph; `failure-triage.md`: the D-01 evidence cell in the flaky row.
3. `run-skill-self-tests.mjs`: `requireClauses("ordinary-nondeterminism", …)` per plan D-02, with mutations `flaky-read`, `flaky-assert`, `flaky-rerun`, `flaky-process-first` and `flaky-triage` in the `mutations` list of the semantic-weakening check (the reviewer confirms each raises `ordinary-nondeterminism`); the existing checks keep passing.
4. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-01: the skill self-tests pass with the new clause check and its five mutations; the pinned Node tests pass; the Command prints `test-skill-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$out" | grep -E "cf:test|skill-test\] PASS" && grep -qxF "✔ cf:test plan-native checker rejects semantic weakenings" <<< "$out" && t=$(node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (tests|pass|fail)" && grep -qx "# fail 0" <<< "$t" && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "read the tests that cover the target or changed code" && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "This step does not apply to process-first Named probes, which run exactly once." && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "or its pass condition depends on a nondeterministic source" && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "rerun just the suspect tests at least twice more" && tr -s "[:space:]" " " < src/claude/skills/test/references/execution-strategy.md | grep -qF "even when every run passes" && tr -s "[:space:]" " " < src/claude/skills/test/references/failure-triage.md | grep -qF "or an assertion or pass condition that depends on a nondeterministic source" && for m in flaky-read flaky-assert flaky-rerun flaky-process-first flaky-triage; do grep -qF "\"$m\"" scripts/run-skill-self-tests.mjs || { echo "no mutation $m"; exit 1; }; done && d=$( (cd src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "test-skill-digest: $d"'`
- Named probe: `cf:test plan-native checker rejects semantic weakenings` in `run-skill-self-tests.mjs`; `develop-contract.test.js`, `codex-native.test.js`
- Reachability: known — `evals/run.sh test` builds the eval plugin from `packages/spec/src/claude/skills/test`
- Oracle: the Command exits 0 with the self-test PASS line, `# fail 0` and the digest
- Counterexample: dropping the read, assertion-`FAIL`, rerun or process-first sentence, or the triage clause, makes the semantic-weakening check fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$out" | grep -E "cf:test|skill-test\] PASS" && grep -qxF "✔ cf:test plan-native checker rejects semantic weakenings" <<< "$out" && t=$(node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (tests|pass|fail)" && grep -qx "# fail 0" <<< "$t" && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "read the tests that cover the target or changed code" && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "This step does not apply to process-first Named probes, which run exactly once." && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "or its pass condition depends on a nondeterministic source" && tr -s "[:space:]" " " < src/claude/skills/test/SKILL.md | grep -qF "rerun just the suspect tests at least twice more" && tr -s "[:space:]" " " < src/claude/skills/test/references/execution-strategy.md | grep -qF "even when every run passes" && tr -s "[:space:]" " " < src/claude/skills/test/references/failure-triage.md | grep -qF "or an assertion or pass condition that depends on a nondeterministic source" && for m in flaky-read flaky-assert flaky-rerun flaky-process-first flaky-triage; do grep -qF "\"$m\"" scripts/run-skill-self-tests.mjs || { echo "no mutation $m"; exit 1; }; done && d=$( (cd src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "test-skill-digest: $d"'
Exit: 0
Base: 0920a6171805ca51bf4662fdc803f7b5f437b40e
Head: 9bcbe289ec3a2ded5f1e627b17d0e459ef640cf5b043e38ee72ba11a172af951
```text
✔ cf:test plan-native proof contract is complete and bounded
✔ cf:test plan-native checker rejects semantic weakenings
✔ cf:test supports spec-aware feature testing
[skill-test] PASS: 1658 tests executed
# tests 104
# pass 104
# fail 0
test-skill-digest: ec7beef9fb1d8a8d89a16b4bd6d99332f53cf4378ea2d660382b1292f13578eb
```

Fresh code-auditor review: PASS (wording matches D-01 in SKILL.md, §2 and the triage row; the renumbering breaks no reference; all five mutations raise ordinary-nondeterminism; 3 Low notes: the canonical FAIL definition, the unpinned single-green-run sentence, additive weakenings not caught). Re-run at the final-Head fixed point.
