# Task 05 — Docs and changelogs

Status: done

## Outcome
A user reading the README or a changelog learns that `npx @haposoft/cafekit@latest migrate` previews the removal of an npx install, `--apply` performs it with a backup, edited files and runtime.json stay, and a repository with an `.omp/` install is refused.

## Scope
- In: one short README section after the install commands (`README.md:8-24`); one `[Unreleased]` entry in each changelog (`docs/project-changelog.md:6`, `packages/spec/CHANGELOG.md:8`).
- Out: release notes, version bumps, plugin install docs.

## Coverage
- CP-05

## Ownership
- Modify: `README.md`
- Modify: `docs/project-changelog.md`
- Modify: `packages/spec/CHANGELOG.md`

## Steps
1. Write the three entries.

## Acceptance
- AC-05: each file names `cafekit@latest migrate` and `--apply`; the README states the default is a dry-run.

## Dependencies
- task-04-cli-takeover.md

## Verification Plan
- Command: `for f in README.md docs/project-changelog.md packages/spec/CHANGELOG.md; do grep -q 'cafekit@latest migrate' "$f" && grep -q -- '--apply' "$f" || { echo "missing in $f"; exit 1; }; done && grep -qi 'dry-run' README.md && echo docs-ok`
- Named probe: the command's `docs-ok` line.
- Reachability: source — the three files.
- Oracle: `docs-ok` printed, exit 0.
- Counterexample: an entry without `--apply` → `missing in <file>`, exit 1.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: for f in README.md docs/project-changelog.md packages/spec/CHANGELOG.md; do grep -q 'cafekit@latest migrate' "$f" && grep -q -- '--apply' "$f" || { echo "missing in $f"; exit 1; }; done && grep -qi 'dry-run' README.md && echo docs-ok
Exit: 0
Base: 32ef63d6daf052d6bb6e938e73714e8930f70f88
Head: de24c4764f214476925303804e5bc286001c18c47250a2840c6aff615c44be4c
```text
$ for f in README.md docs/project-changelog.md packages/spec/CHANGELOG.md; do grep -q 'cafekit@latest migrate' "$f" && grep -q -- '--apply' "$f" || { echo "missing in $f"; exit 1; }; done && grep -qi 'dry-run' README.md && echo docs-ok
docs-ok
EXIT=0
```

Reachability: source — the three files.
Negative proof: on a temp copy with `--apply` replaced in packages/spec/CHANGELOG.md the command printed `missing in packages/spec/CHANGELOG.md` and exited 1.
Review: code-auditor round 1 CONCERNS (Medium: rollback promised for any interrupt, only Ctrl-C is handled; the release-order reason was attached to the wrong clause), round 2 PASS.
Limitations: the docs state the main removal rule; the planner also keeps a whole skill holding an edited or added file, symlinked paths and nested `.gitignore` files that still protect something; the CLI line "see the CafeKit README" points to plugin install docs that do not exist until the plugins ship.
