# Task 02 — The skill and the agent carry the four decisions

Status: done

## Outcome
`cf:brainstorm` sends a plan-and-tasks request to Specs before scout or questions, opens every non-direct answer with its route and depth, states a delegated choice as made on the user's behalf, and calls a `brainstormer` the user names with its route; `brainstormer` states a single-path conclusion in one line and writes its labels in English. The self-test requires each clause and rejects its removal; the replayed histories follow the new skill text.

## Scope
- In: the clauses below in `SKILL.md` and `brainstormer.md`; their self-test clauses and removal mutations; one CHANGELOG line under 0.16.8; regenerating the three `history.jsonl` files with `make-history.mjs`.
- Out: the description and `when_to_use`; `references/question-framework.md`; the Codex agent configuration; reinstalling `.claude/`.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/src/claude/agents/brainstormer.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/CHANGELOG.md`, `evals/brainstorm/{duyet-khong-trien-khai,ne-cau-hoi,tham-do-nap-skill}/history.jsonl` (regenerated only)
- Read: `specs/brainstorm-repair/plan.md` (D-03), `packages/spec/scripts/run-skill-self-tests.mjs:1294-2073` (clauses, scans, mutations; a new mutation's `group` must be in `BRAINSTORM_ADAPTIVE_GROUPS`, `:2058-2066`), `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js:209-246` (pinned `SKILL.md` anchors)

## The clauses
- `SKILL.md` front door, a new route after **Direct request**: `**Plan-and-tasks request:** when the user asks for a plan, a task list, or work split into tasks rather than a choice between designs, leave Brainstorm before scout or questions: say in one or two sentences that Specs owns plans and tasks, and ask the user to invoke \`cf:specs\` in a new request. Do not interview, compare options, write the list, or start Specs.` followed by `Open this answer with \`Route: plan-and-tasks · Depth: Standard\`.` The numbering of the later routes moves by one.
- `SKILL.md` adaptive depth, a closing sentence: `Open every non-direct answer with one line naming its route and depth, for example \`Route: feature delivery · Depth: Standard\`. When the answer is a \`cf:debug\` report, that report's heading comes first and this line follows it.`
- `SKILL.md` Discovery Question Framework, a closing paragraph: `When the user delegates a choice ("pick whichever is fastest"), choose from the recorded evidence, say that you chose on the user's behalf and why, record it in the Decision register as a delegated choice, and ask only for the approvals its route requires.`
- `SKILL.md` Options and specialist use: the existing sentence `Call \`brainstormer\` only for a material architectural choice …` (`SKILL.md:145`) becomes `Unless the user names \`brainstormer\`, call it only for a material architectural choice …`, followed by `When the user names \`brainstormer\`, call it; tell it which route applies; the routes are feature delivery; an explicitly authorized fix; diagnosis-only bug work; non-bug exploration. Pass the contract with it; it may return a single-path conclusion.` (the routes separated by `;` so the self-test's fix-dispatch scan, `run-skill-self-tests.mjs:1693-1700`, does not read it as a dispatch to Fix).
- `brainstormer.md` entry gate, after the single-path sentence: `State a single-path conclusion in one line, for example \`Only one viable path: <path>\`, and list each other option as \`rejected\` with why.`; Advisory process step 6, a closing sentence: `Write these labels in English exactly as listed, whatever language the report uses.`; Output, a last item: `End the report with \`Relay: keep the single-path line and every English label when you summarize this report.\``; the description gains one sentence: `Its report states a single-path conclusion in one line and English labels; keep both when relaying it.` (the controller's final answer is what case 4 grades, and the baseline reports already carried labels the answers dropped — `research-repair` fixed the same relay loss with a `Relay:` line).
- `CHANGELOG.md` 0.16.8 Changed: one line naming the four behaviors and that the brainstorm baseline (`specs/brainstorm-eval-baseline`) is the comparison.

## Steps
1. Add the clauses; keep the bundle within 506 lines.
2. Add a self-test group requiring each clause and mutations removing each one (the runner reports each mutation as rejected).
3. `node evals/brainstorm/make-history.mjs`, then `--check`; then the checker.
4. Run the Command; write the Receipt after a fresh review returns PASS.

## Acceptance
- AC-02: each grepped clause prefix present verbatim (the rest of a clause may be reworded only to satisfy a self-test scan, keeping its meaning); the bundle at most 506 lines; the self-test runner passes with the new group and mutations; the Codex and package tests pass; `make-history.mjs --check` and the checker pass; the `sources-digest:` and `evals-brainstorm-digest-nohist:` lines (the latter equal to task 01's).

## Dependencies
- task-01-instrument-v2-regrade.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && S=packages/spec/src/claude/skills/brainstorm/SKILL.md && A=packages/spec/src/claude/agents/brainstormer.md && grep -qF "**Plan-and-tasks request:** when the user asks for a plan, a task list, or work split into tasks rather than a choice between designs" $S && grep -qF "Open every non-direct answer with one line naming its route and depth" $S && grep -qF "say that you chose on the user" $S && grep -qF "Unless the user names \`brainstormer\`, call it only for a material architectural choice" $S && grep -qF "When the user names \`brainstormer\`, call it; tell it which route applies" $S && grep -qF "Open this answer with \`Route: plan-and-tasks" $S && grep -qF "State a single-path conclusion in one line" $A && grep -qF "Write these labels in English exactly as listed" $A && grep -qF "Relay: keep the single-path line and every English label" $A && grep -qF "keep both when relaying it" $A && n=$(cat $S packages/spec/src/claude/skills/brainstorm/references/question-framework.md $A | wc -l) && [ $n -le 506 ] && echo "bundle-lines: $n" && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | tail -3 && t=$(node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (pass|fail)" && printf "%s\n" "$t" | grep -qx "# fail 0") && node evals/brainstorm/make-history.mjs --check && bash evals/brainstorm/check-fixtures.sh > /dev/null && echo "checker: ok" && s=$( (cd packages/spec/src/claude && find skills/brainstorm skills/specs agents/brainstormer.md -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s" && n2=$( (cd evals/brainstorm && find . -type f ! -name .DS_Store ! -name history.jsonl | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-brainstorm-digest-nohist: $n2" && grep -qF "evals-brainstorm-digest-nohist: $n2" specs/brainstorm-repair/task-01-instrument-v2-regrade.md'`
- Named probe: the ten `grep -qF` clause checks, the bundle count, the self-test runner (pass and fail counts in its tail), the Codex and package tests (`# fail 0`), `make-history.mjs --check`, the checker, the two digests
- Reachability: known — `evals/run.sh` copies these two files into the eval plugin; the Codex copy is generated from them
- Oracle: the Command exits 0, the runner's tail reports no failure, both test files report `# fail 0`
- Counterexample: a removed clause fails its `grep -qF` and its self-test mutation is rejected; a history not regenerated fails `--check`; a bundle over 506 lines fails the count
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && S=packages/spec/src/claude/skills/brainstorm/SKILL.md && A=packages/spec/src/claude/agents/brainstormer.md && grep -qF "**Plan-and-tasks request:** when the user asks for a plan, a task list, or work split into tasks rather than a choice between designs" $S && grep -qF "Open every non-direct answer with one line naming its route and depth" $S && grep -qF "say that you chose on the user" $S && grep -qF "Unless the user names \`brainstormer\`, call it only for a material architectural choice" $S && grep -qF "When the user names \`brainstormer\`, call it; tell it which route applies" $S && grep -qF "Open this answer with \`Route: plan-and-tasks" $S && grep -qF "State a single-path conclusion in one line" $A && grep -qF "Write these labels in English exactly as listed" $A && grep -qF "Relay: keep the single-path line and every English label" $A && grep -qF "keep both when relaying it" $A && n=$(cat $S packages/spec/src/claude/skills/brainstorm/references/question-framework.md $A | wc -l) && [ $n -le 506 ] && echo "bundle-lines: $n" && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | tail -3 && t=$(node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (pass|fail)" && printf "%s\n" "$t" | grep -qx "# fail 0") && node evals/brainstorm/make-history.mjs --check && bash evals/brainstorm/check-fixtures.sh > /dev/null && echo "checker: ok" && s=$( (cd packages/spec/src/claude && find skills/brainstorm skills/specs agents/brainstormer.md -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s" && n2=$( (cd evals/brainstorm && find . -type f ! -name .DS_Store ! -name history.jsonl | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-brainstorm-digest-nohist: $n2" && grep -qF "evals-brainstorm-digest-nohist: $n2" specs/brainstorm-repair/task-01-instrument-v2-regrade.md'`
Exit: 0
Base: b6936d947d12cb16e9ef61cbb9e09e58aa953a47
Head: f411ebe4b2b7a98ece7126d8f2b61b7c6ec45872e9e3943365017135e8f562d8
```text
bundle-lines:      463
Ran 122 tests in code-review review boundary

[skill-test] PASS: 1573 tests executed
# pass 53
# fail 0
ok: duyet-khong-trien-khai/history.jsonl equals its regeneration from the current SKILL.md
ok: ne-cau-hoi/history.jsonl equals its regeneration from the current SKILL.md
ok: tham-do-nap-skill/history.jsonl equals its regeneration from the current SKILL.md
checker: ok
sources-digest: 84c702169949af60020be08891669c735fce2ed95e11d3445b6b758a0358d344
evals-brainstorm-digest-nohist: 73683fc126c9eaf2ce4dbf101646978596460b8dd2b468d8b9aac663851ec922
```

Re-run at the final Head before GATE-DONE (task 03's grader repairs moved Head after this task first closed); the sources digest is unchanged and the no-history digest equals task 01's current line. A fresh `code-auditor` review returned PASS on this task's change set after the user's five repairs.
