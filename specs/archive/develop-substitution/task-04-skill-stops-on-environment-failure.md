# Task 04 — The skill treats a failure of the command itself as BLOCKED

Status: done

## Outcome
`develop/SKILL.md` says, at the pre-change run, that a failure from the command itself is BLOCKED, not FAIL — even when the runner reports `not ok` and even when the Acceptance or a test file shows the right command — and what the blocked task holds; and that a blocked Command is not a failure to remediate. The bundle stays within 400 lines and the self-test requires each part and rejects its removal.

## Scope
- In: the D-06 text appended to `SKILL.md:123` and `:135` without adding a line; a `requireClauses("environment-blocker", …)` group and six `mutateClause` cases in `run-skill-self-tests.mjs`; one CHANGELOG line under 0.16.8.
- Out: `references/quality-gate.md`; hooks; the Codex agent configuration; reinstalling `.claude/`.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/CHANGELOG.md`
- Read: `run-skill-self-tests.mjs:2373-2440` (paths and `requireClauses`), `:2565-2569` (the 400-line bundle), `:2574-2578` (`replaceDevelopClauseOnce` needs a unique anchor), `:2582-2630` (mutations), `:2791` (the success line), `packages/spec/bin/__tests__/develop-contract.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js`

## Steps
1. Append to the end of `SKILL.md:123`, on the same line: ` A failure from the command itself — a wrong path, a missing tool or module, the environment — is BLOCKED, not FAIL, even when the runner reports \`not ok\` and even when the Acceptance or a test file shows the right command: set the task's single \`Status:\` to \`blocked\` with a \`Blocker:\` line naming the command and its error, write no Receipt, revert any edit made in this run, and report; you may suggest a corrected command for the plan, but never run it as proof.` Change `:135` from `Remediate an observed failure, then rerun only` to `Remediate an observed failure (a blocked Command is not a failure to remediate), then rerun only`.
2. A `requireClauses("environment-blocker", { skill: [...] })` group with the key phrases, and six mutations, each with a unique anchor: drop `is BLOCKED, not FAIL`; `to \`blocked\` with a \`Blocker:\` line` → `to \`done\` with a \`Blocker:\` line`; drop `write no Receipt,`; drop `revert any edit made in this run,`; `but never run it as proof.` → `and may run it as proof.`; drop `(a blocked Command is not a failure to remediate)`.
3. One CHANGELOG line; run the Command (allow 15 minutes); Receipt after a fresh review PASS.

## Acceptance
- AC-04: the key phrases present verbatim; `SKILL.md` line count unchanged and the develop bundle ≤ 400 lines; the self-test runner passes and prints `✔ cf:develop plan-native checker rejects semantic weakenings`; `develop-contract` and `package-inventory` tests report `# fail 0`; the Command prints `sources-digest:`.

## Dependencies
- task-03-measure-current-skill.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && C=packages/spec/src/claude && S=$C/skills/develop/SKILL.md && grep -qF "is BLOCKED, not FAIL, even when the runner reports" $S && grep -qF "write no Receipt, revert any edit made in this run, and report" $S && grep -qF "but never run it as proof." $S && grep -qF "(a blocked Command is not a failure to remediate)" $S && b=$(cat $S $C/skills/develop/references/parallel-waves.md $C/skills/sync/SKILL.md $C/skills/sync/references/sync-protocols.md | wc -l) && [ $b -le 400 ] && [ $(wc -l < $S) -eq 178 ] && echo "develop-bundle-lines: $b" && (cd packages/spec && st=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$st" | grep -x "✔ cf:develop plan-native checker rejects semantic weakenings" && printf "%s\n" "$st" | tail -1 && t=$(node --test bin/__tests__/develop-contract.test.js bin/__tests__/package-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (pass|fail)" && printf "%s\n" "$t" | grep -qx "# fail 0") && s=$( (cd $C && find skills/develop -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s"'`
- Named probe: the four phrase checks, the bundle count, the runner's `✔` plan-native line and last line, the two test files
- Reachability: known — `evals/run.sh develop` copies `packages/spec/src/claude/skills/develop/` into the eval plugin
- Oracle: the Command exits 0 with the `✔` line, the runner's `PASS` line and `# fail 0`
- Counterexample: a removed phrase fails its `grep -qF` and its mutation is rejected; a new line changes `SKILL.md` from 178 lines and fails the line check
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && C=packages/spec/src/claude && S=$C/skills/develop/SKILL.md && grep -qF "is BLOCKED, not FAIL, even when the runner reports" $S && grep -qF "write no Receipt, revert any edit made in this run, and report" $S && grep -qF "but never run it as proof." $S && grep -qF "(a blocked Command is not a failure to remediate)" $S && b=$(cat $S $C/skills/develop/references/parallel-waves.md $C/skills/sync/SKILL.md $C/skills/sync/references/sync-protocols.md | wc -l) && [ $b -le 400 ] && [ $(wc -l < $S) -eq 178 ] && echo "develop-bundle-lines: $b" && (cd packages/spec && st=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$st" | grep -x "✔ cf:develop plan-native checker rejects semantic weakenings" && printf "%s\n" "$st" | tail -1 && t=$(node --test bin/__tests__/develop-contract.test.js bin/__tests__/package-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (pass|fail)" && printf "%s\n" "$t" | grep -qx "# fail 0") && s=$( (cd $C && find skills/develop -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s"'
Exit: 0
Base: 5153442844b0b2a838de9574fbd790a383ede36c
Head: 8c07fb49702964b4fcf91e1490c20c34cdb4fa1fadc62686107e39b0df33c9c3
```text
develop-bundle-lines:      399
✔ cf:develop plan-native checker rejects semantic weakenings
[skill-test] PASS: 1580 tests executed
# pass 87
# fail 0
sources-digest: e9aeb65c851d7a3e83039674eada12498ac1e5c35053d75c9e0f215cf43b3d40
```

The fenced block is the Command's whole output (2026-10-02, run by the controller via `bash` on this file's Command text; it returned 0). Before the change the same Command returned 1 at its first `grep -qF`. A fresh `code-auditor` review returned PASS_WITH_WARNINGS (`revert any owned edit` could discard earlier uncommitted work on a resumed task); the user changed it to `revert any edit made in this run`, the Command was re-run, and the review returned PASS.
