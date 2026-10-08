# Task 04 — changelogs record the quieter Claude hooks

Status: done

## Outcome
Both changelogs' `[Unreleased]` blocks describe the three changes and that they apply to Claude only.

## Scope
- In: one `### Changed` bullet in each changelog (English / Vietnamese) under the existing `[Unreleased]`.
- Out: version bump; web docs.

## Coverage
- CP-04

## Ownership
- Modify: `CHANGELOG.md`, `../../docs/project-changelog.md`

## Steps
1. Run the Command and expect failure.
2. Write the bullets naming `` `spec-state.cjs` ``, `` `docs-sync.cjs` `` and `` `state.cjs` ``: touch rule, PostToolUse registration, `docs-sync` on demand and upgrade pruning, `state` silence rule, "Claude only" / "chỉ Claude" (omp, Codex and grok unchanged).
3. Run the Command.

## Acceptance
- AC-05.

## Dependencies
- task-03-state-quiet.md

## Verification Plan
- Command: `U=$(mktemp) && for f in CHANGELOG.md ../../docs/project-changelog.md; do awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' "$f" > "$U"; grep -q '`spec-state.cjs`' "$U" && grep -q '`docs-sync.cjs`' "$U" && grep -qE '(^|[^-])`state\.cjs`' "$U" && grep -qE 'Claude only|chỉ Claude' "$U" || { rm -f "$U"; exit 1; }; done && rm -f "$U" && echo CHANGELOG_OK`
- Named probe: the per-file `[Unreleased]` greps.
- Reachability: source.
- Oracle: exit 0 and `CHANGELOG_OK`.
- Counterexample: an entry in only one file, or outside `[Unreleased]`, fails.
- Artifacts: a `mktemp` file, removed on success and on failure.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `U=$(mktemp) && for f in CHANGELOG.md ../../docs/project-changelog.md; do awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' "$f" > "$U"; grep -q '`spec-state.cjs`' "$U" && grep -q '`docs-sync.cjs`' "$U" && grep -qE '(^|[^-])`state\.cjs`' "$U" && grep -qE 'Claude only|chỉ Claude' "$U" || { rm -f "$U"; exit 1; }; done && rm -f "$U" && echo CHANGELOG_OK`
Exit: 0
Base: c11904f09ca62aca260785f47df85d061e1f8cd7
Head: 95d16050947fdd0f0a0ca9c5fa82bd96d4f0b746caf5bc0fd37c7388ecf5f887
```text
$ (packages/spec) <Command above>
CHANGELOG_OK
```
Pre-change run exited 1 (neither `[Unreleased]` block named `spec-state.cjs`).
