# Task 08 — runner allowlist, changelogs, full suite

Status: done

## Outcome
The self-test runner no longer allowlists the deleted helpers, both changelogs describe 3b's behaviour change, and the full package suite passes on the finished packet.

## Scope
- In: `run-skill-self-tests.mjs` `runSettingsManifestConsistencyCheck` — remove `hooks/completion-authority-check.cjs` and `hooks/completion-authority-state.cjs` and their two-line comment from `helperAllowlist` (`:6050-6054`); keep `hooks/docs-sync.cjs`.
- In: one `### Removed` entry under `## [Unreleased]` in `CHANGELOG.md` (English) and `../../docs/project-changelog.md` (Vietnamese), tagged `remove-legacy-hooks`, naming the five files and stating: removed from Claude, Codex and omp; an upgrade deletes the installed copies even when edited, their manifest records and the CafeKit registrations (Codex now prunes stale hook files too), and keeps a user's own hook of the same name elsewhere; Strict assurance now fails with `Strict assurance is no longer supported`; legacy `spec.json` closeout is blocked since 3a; `spec.scaffold_guard` stays valid but is deprecated and does nothing; `code-auditor` no longer emits an attestation marker; entries in `.claude/settings.local.json` or `~/.claude/settings.json` and the `~/.cafekit/completion-authority/` directory are not managed by the installer and can be removed by hand; a copy of a CafeKit hook placed under `~/.claude/hooks/` or `~/.codex/hooks/` and registered in the project's settings is also unregistered, because the prune matches `.claude/hooks/<name>` / `.codex/hooks/<name>` in the command; `bin/__tests__/legacy-hooks-retired.test.js` pins it. No note about a user-modified omp bridge (DN-01: the user handles omp separately).
- Out: `run-skill-self-tests.mjs:5358` and every other doc (3c).

## Coverage
- CP-06

## Ownership
- Modify: `scripts/run-skill-self-tests.mjs`, `CHANGELOG.md`, `../../docs/project-changelog.md`

## Steps
1. Edit the allowlist.
2. Write both changelog entries.
3. Run the Command.

## Acceptance
- AC-08: the runner names a removed hook only in the 3c-owned anchor; both `[Unreleased]` blocks carry every required term; the full suite prints `[skill-test] PASS`.

## Dependencies
- task-05-remove-and-prune.md
- task-06-session-clear.md
- task-07-scaffold-guard-deprecated.md

## Verification Plan
- Command: `A=/tmp/ck-3b-08-en.txt; B=/tmp/ck-3b-08-vi.txt; G=/tmp/ck-3b-08-suite.txt; rm -f $A $B $G; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md > $A; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' ../../docs/project-changelog.md > $B; missing=0; for n in remove-legacy-hooks completion-authority.cjs completion-authority-check.cjs completion-authority-state.cjs semantic-review-authority.cjs task-scaffold-guard.cjs scaffold_guard 'Strict assurance is no longer supported' legacy-hooks-retired.test.js; do grep -qF -- "$n" $A || { echo "en missing: $n"; missing=1; }; grep -qF -- "$n" $B || { echo "vi missing: $n"; missing=1; }; done; [ $missing = 0 ] && [ "$(grep -cE 'completion-authority|semantic-review-authority|task-scaffold-guard' scripts/run-skill-self-tests.mjs)" = 1 ] && grep -q 'Not carried: .agent.cjs. (SubagentStart) and .semantic-review-authority.cjs. (SubagentStop)' scripts/run-skill-self-tests.mjs && node scripts/run-skill-self-tests.mjs > $G 2>&1; tail -4 $G; grep -qE '^\[skill-test\] PASS: [0-9]+ tests executed$' $G && grep -qE '^ok [0-9]+ - no source ships, registers or bridges the five legacy hooks$' $G && rm -f $A $B $G`
- Named probe: the runner's settings/manifest consistency check (`✔ settings template and manifest agree on 10 hooks`, 13 today; the simulated removal printed 10), every suite stage, and `no source ships, registers or bridges the five legacy hooks`.
- Reachability: source — `npm test` equivalent from `packages/spec/`; the vi changelog is read at `../../docs/`.
- Oracle: exit 0; no "missing" line; the runner count of removed-hook names is exactly 1 (today 5: `:5358,6050,6051,6053,6054`); `[skill-test] PASS`; the named `ok` line. Neither `[Unreleased]` block names `remove-legacy-hooks` or `task-scaffold-guard` today (checked 2026-10-06).
- Counterexample: an entry placed under a released version fails the awk-scoped greps; deleting the 3c anchor instead of leaving it fails the count and the anchor grep; any red stage fails `[skill-test] PASS`.
- Artifacts: `/tmp/ck-3b-08-{en,vi,suite}.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `A=/tmp/ck-3b-08-en.txt; B=/tmp/ck-3b-08-vi.txt; G=/tmp/ck-3b-08-suite.txt; rm -f $A $B $G; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md > $A; awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' ../../docs/project-changelog.md > $B; missing=0; for n in remove-legacy-hooks completion-authority.cjs completion-authority-check.cjs completion-authority-state.cjs semantic-review-authority.cjs task-scaffold-guard.cjs scaffold_guard 'Strict assurance is no longer supported' legacy-hooks-retired.test.js; do grep -qF -- "$n" $A || { echo "en missing: $n"; missing=1; }; grep -qF -- "$n" $B || { echo "vi missing: $n"; missing=1; }; done; [ $missing = 0 ] && [ "$(grep -cE 'completion-authority|semantic-review-authority|task-scaffold-guard' scripts/run-skill-self-tests.mjs)" = 1 ] && grep -q 'Not carried: .agent.cjs. (SubagentStart) and .semantic-review-authority.cjs. (SubagentStop)' scripts/run-skill-self-tests.mjs && node scripts/run-skill-self-tests.mjs > $G 2>&1; tail -4 $G; grep -qE '^\[skill-test\] PASS: [0-9]+ tests executed$' $G && grep -qE '^ok [0-9]+ - no source ships, registers or bridges the five legacy hooks$' $G && rm -f $A $B $G`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: f3ce1afd4deb454eb68cfd3155fa820ff4e412756af323a7e27d9a03fdeef990
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
[skill-test] PASS: 1580 tests executed
```
Implemented by the controller. No pre-change run: the Command runs the full package suite (several minutes). Before the change the Oracle's facts held as stated in the task (runner named the removed hooks 5 times; neither [Unreleased] block named remove-legacy-hooks). After: allowlist keeps only `hooks/docs-sync.cjs`; one Removed entry per changelog; the Command checks the named `ok` line and the nine phrases in both [Unreleased] blocks against its own temp files and removes them on success.
