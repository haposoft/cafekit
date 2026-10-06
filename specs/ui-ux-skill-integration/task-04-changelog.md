# Task 04 — both changelogs record the new skill

Status: done

## Outcome
`packages/spec/CHANGELOG.md` and `docs/project-changelog.md` each carry a new `## [Unreleased]` entry that names `cf:ui-ux`, its upstream, version, and commit, the one-line body patch, the `--with-skills-deps` cost, the `--pw` note, the kept upstream behaviours, and the pro-max `when_to_use` change.

## Scope
- In: a new `## [Unreleased]` section inserted above `## [0.16.8] - 2026-09-22` in each file (neither file has one today: `CHANGELOG.md:8`, `docs/project-changelog.md:6`), with one `### Added` bullet and one `### Changed` bullet, in the existing Keep a Changelog style; English in `packages/spec/CHANGELOG.md`, Vietnamese in `docs/project-changelog.md` (its existing entries are Vietnamese).
- Out: version bump, release, README or `cafekit-web` text, `docs/.sync_hash`.

## Coverage
- CP-05

## Ownership
- Modify: `CHANGELOG.md` (packages/spec), `../../docs/project-changelog.md`
- Read: the top 15 lines of each file for the current format

## Steps
1. In `CHANGELOG.md`, insert directly above line 8 (`## [0.16.8] - 2026-09-22`): `## [Unreleased]`, then `### Added` with the bullet "**`cf:ui-ux`** — evondevKit's `ui-ux` skill (https://github.com/evondev/evondevKit, 0.3.13, commit `6465d4c`, MIT) vendored under `skills/ui-ux/` byte-identical except a CafeKit frontmatter and one body line (`count_files`' `"$1"` → `"$*"`, because Claude Code substitutes `$0`–`$9` in a loaded skill body), with `LICENSE` and a `scripts/package.json` that makes `--with-skills-deps` provision Playwright and download its Chromium for `probe.mjs` (a default `--yes` install downloads nothing). A designer-style flow (brief → 2–3 wireframes → pick → build) for in-app screens, plus review, rebuild-keeping-brand, refactor, design-system-first and logo routes. Kept as upstream ships them: the body is Vietnamese; `probe.mjs` clicks popups and openers and taps truncated text on the page it measures, loads Playwright from `--pw`, then the current directory, then its own directory (a project with its own Playwright should pass `--pw .claude/skills/ui-ux/scripts`), and falls back to the system Chrome; the skill asks the model to hotlink Unsplash/randomuser mock images and to run a background `http.server` — CafeKit's process and scope rules still apply; `scripts/lint-skill.mjs` ships unused.", then `### Changed` with the bullet "`cf:ui-ux-pro-max` `when_to_use` now names lookups only (palettes, fonts, product-type styles, UX guidelines) and points screen work to `cf:ui-ux`." → the bullets name `cf:ui-ux`, `evondev/evondevKit`, `0.3.13`, `6465d4c`.
2. In `docs/project-changelog.md`, insert directly above line 6 (`## [0.16.8] - 2026-09-22`) a `## [Unreleased]` section with the same two bullets written in Vietnamese, keeping the identifiers `cf:ui-ux`, `evondev/evondevKit`, `0.3.13`, `6465d4c` verbatim.
3. Run the Verification Plan Command → every `grep` succeeds, one matching line printed per file.

## Acceptance
- AC-06: each file separately contains `cf:ui-ux` and a line matching `evondev/evondevKit.*0\.3\.13.*6465d4c`, and each contains `## [Unreleased]`.

## Dependencies
- task-02-register-and-route.md

## Verification Plan
- Command: `grep -q "^## \[Unreleased\]" CHANGELOG.md && grep -q "^## \[Unreleased\]" ../../docs/project-changelog.md && grep -q "cf:ui-ux" CHANGELOG.md && grep -q "cf:ui-ux" ../../docs/project-changelog.md && grep -n "evondev/evondevKit.*0\.3\.13.*6465d4c" CHANGELOG.md && grep -n "evondev/evondevKit.*0\.3\.13.*6465d4c" ../../docs/project-changelog.md`
- Named probe: the six `grep` invocations above, one file each (a multi-file `grep -c` would exit 0 when only one file matches).
- Reachability: source — run from `packages/spec/`.
- Oracle: exit 0; the two `grep -n` lines print `N:…` for `CHANGELOG.md` and `M:…` for `../../docs/project-changelog.md`.
- Counterexample: editing only one of the two files, or an entry missing the commit hash or the version, must make one `grep` exit 1 and the Command fail.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `grep -q "^## \[Unreleased\]" CHANGELOG.md && grep -q "^## \[Unreleased\]" ../../docs/project-changelog.md && grep -q "cf:ui-ux" CHANGELOG.md && grep -q "cf:ui-ux" ../../docs/project-changelog.md && grep -n "evondev/evondevKit.*0\.3\.13.*6465d4c" CHANGELOG.md && grep -n "evondev/evondevKit.*0\.3\.13.*6465d4c" ../../docs/project-changelog.md`
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: 656c1c83c7825432d1021bef914774d90001f1d65b538fff2cbc631404a170eb
```text
$ (packages/spec) <Command above>   # matching lines truncated after the identifiers; EXIT=0
12:- **`cf:ui-ux`** — evondevKit's `ui-ux` skill (https://github.com/evondev/evondevKit, 0.3.13, commit `6465d4c`, MIT) vendored under `skills/ui-ux/` …
8:- **`cf:ui-ux`** — skill `ui-ux` của evondevKit (https://github.com/evondev/evondevKit, 0.3.13, commit `6465d4c`, MIT) được chép vào `skills/ui-ux/` …
```
Pre-change run exited 1 at the first `grep -q "^## \[Unreleased\]"` (neither file had the section).
