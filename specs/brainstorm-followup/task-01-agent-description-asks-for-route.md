# Task 01 — The agent description asks for the route

Status: done

## Outcome
`brainstormer`'s description asks its caller to say which route applies, naming the four routes of the skill. The self-test requires the sentence and rejects its removal.

## Scope
- In: the sentence (plan D-02) on its own physical line of the folded description; its self-test clause and removal mutation; one CHANGELOG line under 0.16.8.
- Out: the skill's description, `when_to_use` and body; the agent body; the Codex agent configuration; the histories (`make-history.mjs` strips frontmatter, so only `--check` runs); reinstalling `.claude/`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/agents/brainstormer.md` (frontmatter only), `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/CHANGELOG.md`
- Read: `specs/brainstorm-followup/plan.md` (D-02), `packages/spec/scripts/run-skill-self-tests.mjs:1295-1370` (clauses), `:1830-1832` (the repair-clauses check), `:1933-1940` (removal mutations), `:2092` (the mutation count line), `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js`

## Steps
1. Add the sentence as a new line of the folded description (`brainstormer.md:4-7`).
2. Add it to `BRAINSTORM_CONTRACT_CLAUSES` as `agentRouteAsk` (source `agent`) in the repair-clauses check, and one removal mutation `repair-clause-agentRouteAsk-removed`; the proportional mutation count rises from 78 to 79.
3. Add one CHANGELOG line under 0.16.8 Changed: the agent's description asks the caller for the route; compared with the repair's after-cells.
4. Run the Command (allow 15 minutes); write the Receipt after a fresh review returns PASS.

## Acceptance
- AC-01: the sentence is on one physical line of `brainstormer.md`; the bundle at most 506 lines; the self-test runner passes and prints the proportional mutation count 79; the Codex and package tests report `# fail 0`; `make-history.mjs --check` and the checker pass; the Command prints `sources-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && S=packages/spec/src/claude/skills/brainstorm/SKILL.md && A=packages/spec/src/claude/agents/brainstormer.md && grep -qF "Tell it which route applies; the routes are feature delivery; an explicitly authorized fix; diagnosis-only bug work; non-bug exploration." $A && n=$(cat $S packages/spec/src/claude/skills/brainstorm/references/question-framework.md $A | wc -l) && [ $n -le 506 ] && echo "bundle-lines: $n" && (cd packages/spec && st=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$st" | grep -F "cf:brainstorm proportional routing checker rejects semantic weakenings; count=79" && printf "%s\n" "$st" | tail -1 && t=$(node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (pass|fail)" && printf "%s\n" "$t" | grep -qx "# fail 0") && node evals/brainstorm/make-history.mjs --check && bash evals/brainstorm/check-fixtures.sh > /dev/null && echo "checker: ok" && s=$( (cd packages/spec/src/claude && find skills/brainstorm skills/specs agents/brainstormer.md -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s"'`
- Named probe: the clause check, the bundle count, the proportional mutation count line and the runner's last line, the Codex and package tests, `make-history.mjs --check`, the checker
- Reachability: known — `evals/run.sh` copies `brainstormer.md` into the eval plugin, which lists the agent with its description; the Codex copy is generated from it
- Oracle: the Command exits 0 with every line the Acceptance names
- Counterexample: the sentence removed or broken across lines fails its `grep -qF`; its mutation not rejected leaves the count at 78
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && S=packages/spec/src/claude/skills/brainstorm/SKILL.md && A=packages/spec/src/claude/agents/brainstormer.md && grep -qF "Tell it which route applies; the routes are feature delivery; an explicitly authorized fix; diagnosis-only bug work; non-bug exploration." $A && n=$(cat $S packages/spec/src/claude/skills/brainstorm/references/question-framework.md $A | wc -l) && [ $n -le 506 ] && echo "bundle-lines: $n" && (cd packages/spec && st=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$st" | grep -F "cf:brainstorm proportional routing checker rejects semantic weakenings; count=79" && printf "%s\n" "$st" | tail -1 && t=$(node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (pass|fail)" && printf "%s\n" "$t" | grep -qx "# fail 0") && node evals/brainstorm/make-history.mjs --check && bash evals/brainstorm/check-fixtures.sh > /dev/null && echo "checker: ok" && s=$( (cd packages/spec/src/claude && find skills/brainstorm skills/specs agents/brainstormer.md -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s"'
Exit: 0
Base: 1a90015f8244693acf0cba3ab1813d0f556d8c4d
Head: 30ba8822bccabdddb8294527cc03fd821477b97cea3bc75066bcfdc8bd6b7c3e
```text
bundle-lines:      464
✔ cf:brainstorm proportional routing checker rejects semantic weakenings; count=79
[skill-test] PASS: 1574 tests executed
# pass 53
# fail 0
ok: duyet-khong-trien-khai/history.jsonl equals its regeneration from the current SKILL.md
ok: ne-cau-hoi/history.jsonl equals its regeneration from the current SKILL.md
ok: tham-do-nap-skill/history.jsonl equals its regeneration from the current SKILL.md
checker: ok
sources-digest: 4980158c7ff60402838b5d2b064fc3268c66ed188036ae0a108f896fba8ec46b
```

The fenced block is the Command's whole output, re-run at the final Head before GATE-DONE (task 02 changed `compare.mjs` after this task first closed; 2026-10-02, run by the controller via `bash` on this file's Command text; it returned 0). Before the change the same Command returned 1 at its first `grep -qF`. A fresh `code-auditor` review returned PASS on this task's change.
