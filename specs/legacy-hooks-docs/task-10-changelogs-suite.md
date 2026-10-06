# Task 10 — changelogs, in-scope sweep, full suite

Status: done

## Outcome
Both changelogs record the documentation change, a sweep of the in-scope files finds no stale term, and the full package suite passes on the finished packet.

## Scope
- In: One bullet as the first item under `## [Unreleased]` → `### Changed` in `CHANGELOG.md` (English) and `../../docs/project-changelog.md` (Vietnamese), tagged `legacy-hooks-docs`, naming `remove-legacy-hooks`, `cf:sync`, `cf:develop`, `cf:code-review`, `project-manager`, `docs/specs-usage-guide.md` and `docs/installer-architecture.md`, and saying: the legacy-compatibility sections are deleted from the shipped Claude `CLAUDE.md`, Codex `AGENTS.md`, the `workflow`/`state-sync`/`manage-docs` rules, the `cf:specs`, `cf:sync`, `cf:develop` and `cf:code-review` skills and the `project-manager`/`deployer` agents (the `cf:sync` and `cf:develop` descriptions drop their legacy clause); both READMEs, the usage guide and the website lose the same promise; the installer doc describes one Stop gate that blocks legacy schema `2.1` closeout and a validator that refuses Strict, and the omp/grok hook sets without the removed hooks; reinstall to refresh installed copies.
- Out: any further doc edit (each owned by tasks 01-09).

## Coverage
- CP-05

## Ownership
- Modify: `CHANGELOG.md`
- Modify: `../../docs/project-changelog.md`

## Steps
1. Write both bullets.
2. Run the Command (the full runner takes several minutes).

## Acceptance
- AC-08: both `### Changed` blocks carry the eight terms; the sweep prints `stale=0`; the runner prints `[skill-test] PASS: 1580 tests executed`.

## Dependencies
- task-01-runtime-templates.md
- task-02-rules.md
- task-03-specs-sync-skills.md
- task-04-installer-architecture.md
- task-05-readmes-guide.md
- task-06-website-docs.md
- task-07-dead-code.md
- task-08-develop-legacy.md
- task-09-review-agents-legacy.md

## Verification Plan
- Command: `A=/tmp/ck-3c-10-en.txt; B=/tmp/ck-3c-10-vi.txt; G=/tmp/ck-3c-10-suite.txt; rm -f $A $B $G; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | awk '/^### Changed/{f=1;next} /^### /{f=0} f' > $A; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' ../../docs/project-changelog.md | awk '/^### Changed/{f=1;next} /^### /{f=0} f' > $B; missing=0; for n in legacy-hooks-docs remove-legacy-hooks installer-architecture.md cf:sync cf:develop cf:code-review project-manager specs-usage-guide.md; do grep -qF -- "$n" $A || { echo "en missing: $n"; missing=1; }; grep -qF -- "$n" $B || { echo "vi missing: $n"; missing=1; }; done; S=$(grep -rnE 'completion-authority|semantic-review-authority|task-scaffold-guard|installed legacy adapter|installed adapter|stay on their installed|feature-receipt\.md|feature closeout|feature receipt|legacy deployment transition|supports existing legacy' ../../README.md README.md AGENTS.md ../../docs/installer-architecture.md ../../docs/specs-usage-guide.md ../../cafekit-web/public/content/docs src/claude/CLAUDE.md src/codex/AGENTS.md src/claude/rules src/codex/rules src/claude/skills/specs/SKILL.md src/claude/skills/sync src/claude/skills/develop src/claude/skills/code-review src/claude/agents/project-manager.md src/claude/agents/deployer.md | grep -v 'verification-gate\.md:[0-9]*:requires .feature-receipt\.md.\. A receipt never' | wc -l | tr -d ' '); echo "stale=$S"; [ $missing = 0 ] && [ "$S" = 0 ] && node scripts/run-skill-self-tests.mjs > $G 2>&1; tail -2 $G; grep -qx '\[skill-test\] PASS: 1580 tests executed' $G && rm -f $A $B $G`
- Named probe: every runner stage, including the flipped checks of tasks 01, 03, 04, 05, 08 ("Claude runtime template exposes process-first Specs truth", "Codex runtime template exposes process-first Specs truth", "cf:specs SKILL stays lean after slim-flow diet", "Specs primary flow is file-first while legacy kernel remains isolated", "installer architecture documents omp coverage and gaps", "installer architecture documents completion gate identity", "specs-usage-guide teaches Develop and Sync without leaking v2.1 vocabulary", the `cf:develop` plan-native contract), the code-review boundary stage, and the package Node tests.
- Reachability: source — `npm test` equivalent from `packages/spec/`; installed projections are exercised by the suite's install fixtures.
- Oracle: exit 0; no "missing" line; `stale=0`; the exact line `[skill-test] PASS: 1580 tests executed` (baseline on a clone of acfdf6e9: 1580; sequential simulation of this packet: 1580). Today the sweep prints `stale=27` and no `[Unreleased]` block names `legacy-hooks-docs`.
- Counterexample: a bullet placed under `### Removed` or a released version fails the scoped awk greps; any stale term left in an in-scope file raises `stale` (the one kept N-01 line in `verification-gate.md` is excluded by an exact `grep -v`); any red stage or a changed test count fails the exact PASS line.
- Artifacts: `/tmp/ck-3c-10-{en,vi,suite}.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `A=/tmp/ck-3c-10-en.txt; B=/tmp/ck-3c-10-vi.txt; G=/tmp/ck-3c-10-suite.txt; rm -f $A $B $G; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | awk '/^### Changed/{f=1;next} /^### /{f=0} f' > $A; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' ../../docs/project-changelog.md | awk '/^### Changed/{f=1;next} /^### /{f=0} f' > $B; missing=0; for n in legacy-hooks-docs remove-legacy-hooks installer-architecture.md cf:sync cf:develop cf:code-review project-manager specs-usage-guide.md; do grep -qF -- "$n" $A || { echo "en missing: $n"; missing=1; }; grep -qF -- "$n" $B || { echo "vi missing: $n"; missing=1; }; done; S=$(grep -rnE 'completion-authority|semantic-review-authority|task-scaffold-guard|installed legacy adapter|installed adapter|stay on their installed|feature-receipt\.md|feature closeout|feature receipt|legacy deployment transition|supports existing legacy' ../../README.md README.md AGENTS.md ../../docs/installer-architecture.md ../../docs/specs-usage-guide.md ../../cafekit-web/public/content/docs src/claude/CLAUDE.md src/codex/AGENTS.md src/claude/rules src/codex/rules src/claude/skills/specs/SKILL.md src/claude/skills/sync src/claude/skills/develop src/claude/skills/code-review src/claude/agents/project-manager.md src/claude/agents/deployer.md | grep -v 'verification-gate\.md:[0-9]*:requires .feature-receipt\.md.\. A receipt never' | wc -l | tr -d ' '); echo "stale=$S"; [ $missing = 0 ] && [ "$S" = 0 ] && node scripts/run-skill-self-tests.mjs > $G 2>&1; tail -2 $G; grep -qx '\[skill-test\] PASS: 1580 tests executed' $G && rm -f $A $B $G`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: a39e6b36d3d95972f10b8507d8c6919bc5b08e2a501c113293a3cac779bdd8c4
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
stale=0

[skill-test] PASS: 1580 tests executed
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
