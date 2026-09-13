# Task 03 — Documentation records the delivery matrix and the limits

Status: pending

## Outcome
The installer architecture document has an Orca section that says what a CafeKit install brings for Orca, which host receives which piece, where it stops, and why the skill reads Orca's guide live instead of carrying a copy; `packages/spec/README.md` lists `/cf:orca` beside the other core skills; both changelogs carry an `Added` entry; a static probe keeps the section honest.

## Scope
- In: a `## Orca (onorca.dev)` section in `docs/installer-architecture.md` covering: Orca is a host the agents run inside, not a runtime CafeKit installs into, so there is no `PLATFORMS` entry and no `.orca/` payload; the `cf:orca` skill reads `orca skills get` at use time rather than vendoring, because the guide changed between two CLI versions at constant length; the delivery matrix from `plan.md` for Claude Code, Codex, omp, and Grok — including that omp receives the skill only beside a Claude or Codex install and no session line because the bridge discards `session_start` stdout, and that Grok gets no session line; `ORCA_PANE_KEY` as an observed, undocumented presence marker; `ORCA_AGENT_HOOK_TOKEN` and `ORCA_AGENT_LAUNCH_TOKEN` as credentials the hooks never print; the same-worktree default for `terminal send` and the untrusted-output rule; the Orca/Herdr boundary; the four `[UNVERIFIED]` items with the command that settles each. One README bullet for `/cf:orca` in the skill list (`packages/spec/README.md:166` area), shaped like the `/cf:route` bullet. One `Added` entry in each changelog under `[Unreleased]`, dated 2026-09-13. One static probe in `runStaticSemanticTests()`.
- Out: the root `README.md` (precedent: `cf:loop` is listed only in `packages/spec/README.md`); entries under a released version heading; Orca's own documentation.

## Coverage
- CP-03

## Ownership
- Modify: `docs/installer-architecture.md`
- Modify: `packages/spec/README.md`
- Modify: `packages/spec/CHANGELOG.md`
- Modify: `docs/project-changelog.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-03 as stated in `plan.md`.
- The probe asserts the heading, the phrase "reads `orca skills get`", `ORCA_PANE_KEY`, the two token names with "never", `ORCA_WORKTREE_ID`, "Orca is not Herdr", the omp row stating "beside a Claude or Codex install", and the Grok row stating no session line.
- The changelog entries say plainly that Orca awareness now ships with the install instead of living in a per-machine setup, and name the same-worktree default as the safety property of the skill.

## Dependencies
- task-01-orca-skill.md
- task-02-session-line.md

## Verification Plan
- Command: `node scripts/run-skill-self-tests.mjs`
- Named probe: `installer architecture documents orca awareness` in `runStaticSemanticTests()`.
- Reachability: known — same shape as `installer architecture documents grok compatibility`; `--static-only` runs it in seconds for the counterexample.
- Oracle: suite PASS with the probe executed.
- Counterexample: deleting the Orca section must fail the probe under `--static-only`; deleting only the omp row of the matrix must also fail it.
- Artifacts: none.

## Receipt
