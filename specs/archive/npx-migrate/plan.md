# npx migrate — remove a 0.18.x npx install so the plugins take over
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-26)
- Existing: the install manifest records every managed file with its sha256 (`packages/spec/bin/lib/manifest.js:35,56,179`), keyed relative to `.claude/` for Claude and to the repository root for Codex (`ownership.recordRoot`, `packages/spec/bin/lib/context.js:110-113`); backups snapshot and restore explicit targets under `.cafekit-backup/<runId>` (`packages/spec/bin/lib/backup.js:17,87,116`); marker blocks are located by `managedRange` (`packages/spec/bin/lib/instruction-blocks.js:6`); CafeKit Codex handlers are recognized by `managedHandlerScript` (`packages/spec/bin/phases/codex-hooks.js:90`); the root `.gitignore` block is `# CafeKit / Ecosystem` (`packages/spec/bin/phases/root-config.js:104`); the installer has one entry point and ignores unknown arguments (`packages/spec/bin/install.js:145-155`, `packages/spec/bin/lib/context.js:252-289`).
- Observed npx 0.18.2 install (Claude + Codex, temp repo): 270 manifest keys for Claude, 271 for Codex (`.codex/…` 83, `.agents/…` 188); the manifests include `runtime.json`, `runtime.schema.json` and the nested `.gitignore` files. Written outside the manifests: `.claude/settings.json` (statusLine, outputStyle, 8 hook events), `.codex/hooks.json`, `CLAUDE.md` block `CAFEKIT CLAUDE` (holds `@AGENTS.md`), `AGENTS.md` blocks `CAFEKIT CORE` + `CAFEKIT CODEX`, the root `.gitignore` block, `cafekit.json`, `cafekit-manifest.json`, `.cafekit-backup/`; hooks later write session state and logs. Nothing under `$HOME`.
- Problem: beside the Claude plugin an npx install runs every Claude hook twice; beside the npx Codex hooks the Codex plugin stands down (`packages/spec/src/codex/hooks/session.cjs:106-109`, D-07 of `specs/archive/codex-plugin/plan.md`), leaving the gates to npx hooks that may be untrusted.
- Minimum change: a `migrate` subcommand that reports, and with `--apply` removes, the npx install of Claude and Codex while keeping every user byte; the Codex stand-down notice names it.
- User decision: KEEP. Installer stays (plugins not released yet; brief `plans/20261021-plugin-install-brief.md:62`). `runtime.json` stays. GATE-REVIEW revised the `.gitignore` decision: remove only lines for folders that are gone (G-02).

## Out of scope
- Removing or changing the install path; migrating `.omp/` installs (a repository with one is refused, D-06); making the Claude plugin stand down beside npx; installing the plugins; user-level files (`~/.claude`, `~/.codex`); removing skill dependency environments (`.venv`, `node_modules`).

## Release constraint
- The plugin build that carries the new notice ships only with or after the npm release that has `migrate`; the notice names `npx @haposoft/cafekit@latest migrate`, because a bare `npx @haposoft/cafekit` may resolve to 0.18.2, which ignores `migrate` and reinstalls.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | A pure planner builds the full action list; dry-run prints it; `--apply` executes the same list after re-planning | Deciding while deleting | Dry-run must show exactly what apply does | The plan depends on on-disk bytes only | Apply touches a path the dry-run did not list → test fails, stop |
| D-02 | A manifest file is removed only when: its key resolves inside its platform's folders, no path component from the repository root is a symlink, its disk hash equals the recorded hash, it is not `runtime.json`/`runtime.schema.json`, its skill or agent group keeps no other file and has a plugin equivalent, and no kept group names it and it is not the selected output style | Removing whole folders, or per-file hashes alone | A user edit, a shared symlinked folder or an npx-only skill must survive | Manifest hashes are those of the installed bytes | Any other case → keep and list with its reason |
| D-03 | Merged files are edited per entry: only handlers whose command equals a CafeKit template command or runs a manifest hook script; `statusLine` only when `status.cjs` is removed; `outputStyle` unchanged and its style file kept; empty hook containers dropped | Pattern matching on paths; renaming the style to `cf:<name>` | A user hook in `.claude/hooks/` must keep its registration; the plugin style name is unverified and an unknown name silently falls back to Default | — | — |
| D-04 | Kept always: `runtime.json`, `runtime.schema.json` while `runtime.json` stays, `.cafekit-backup/`; `cafekit.json` and `cafekit-manifest.json` stay while `runtime.json` stays (revised 2026-10-26: the manifest still records the kept files, so a later migrate can remove npx-only skills once a plugin ships them) | Removing runtime.json | GATE-SCOPE; plugins read runtime.json | — | — |
| D-05 | `--apply` runs only from the repository root; order: atomic lock → snapshot every target → re-plan and compare → per-file lstat + hash re-check → writes → metadata → empty folders; any error or SIGINT restores every target (continuing past a failed target and printing manual steps) | A new backup format | Reuses `backup.js`/`lock.js`, which are bound to `process.cwd()` | Snapshot covers every touched path | Injected-failure test finds a changed byte → stop |
| D-06 | A repository with `.omp/cafekit-manifest.json` is refused by `--apply` (dry-run reports why) | Partially migrating shared surfaces | omp shares the CORE block, `.claude/skills` and `.agents/skills` (`packages/spec/bin/lib/context.js:121-150`) | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Dry-run lists every action for manifest files and writes nothing | new module | manifests, folders | settled | critical: removal, symlinks | source |
| CP-02 | Dry-run lists every merged-file edit and keeps user entries and ignore protection | new module | settings.json, hooks.json, CLAUDE.md, AGENTS.md, .gitignore | settled | critical: secrets exposure | source |
| CP-03 | Apply removes only planned bytes, backs up, and restores on any failure | new module, lock fix | repository file system | settled | critical: data loss | source |
| CP-04 | `npx @haposoft/cafekit@latest migrate [--apply]` reachable from the bin; after apply the Codex plugin gates act | CLI, hook text | bin, Codex session hook | settled | elevated | source |
| CP-05 | Users find the command | docs | README, changelogs | settled | routine | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When `migrate` plans, the system shall list each manifest file as remove or keep with a reason (modified, symlinked, outside root, npx-only, group kept, runtime) and shall write nothing. | task-01 |
| AC-02 | When `migrate` plans, the system shall produce merged-file contents that keep every user entry, keep ignore protection for every kept path, and report what the plugin will not take over. | task-02 |
| AC-03 | When `migrate --apply` runs, the system shall change only planned paths, keep a backup, and a second run shall find nothing to remove; if any step fails or is interrupted, the system shall restore every target and exit non-zero. | task-03 |
| AC-04 | When a user runs `migrate --apply` in a repository with both npx installs, the Codex plugin hooks shall act there afterwards; the notice shall name `npx @haposoft/cafekit@latest migrate`; an unknown flag after `migrate` and an unknown positional argument shall exit 2 (unknown flags of a plain install keep today's behavior). | task-04 |
| AC-05 | The README and both changelogs shall describe `migrate`, its default dry-run and `--apply`. | task-05 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Plan manifest files safely | P1 | AC-01 | `packages/spec/bin/lib/migrate-plan.js` | - | done |
| 02 | Plan merged files | P1 | AC-02 | `packages/spec/bin/lib/migrate-merged.js` | task-01 | done |
| 03 | Apply with backup, lock and rollback | P1 | AC-03 | `packages/spec/bin/lib/migrate-apply.js` | task-02 | done |
| 04 | CLI subcommand, Codex notice, plugin takes over | P1 | AC-04 | `packages/spec/bin/install.js`, `packages/spec/src/codex/hooks/session.cjs` | task-03 | done |
| 05 | Docs and changelogs | P3 | AC-05 | `README.md`, both changelogs | task-04 | done |

## Review log
- Round 1 (2026-10-26): 3 fresh reviewers (Fact Checker + Contract; Security + Failure-mode; Assumption + Flow + Scope) → 29 findings deduplicated to 15 (G-01 … G-15). Bro: accept all; G-02 revised to "remove `.gitignore` lines only for folders that are gone; always keep `.cafekit-backup/`, `.cafekit.lock`, plan patterns, `specs/_shared/`, `.omp/`; keep nested `.gitignore` while its folder keeps files". Applied: G-01/G-03/G-04/G-05/G-14 (manifest part) → task-01 + D-02/D-04; G-02/G-09/G-10/G-11/G-12/G-13/G-14 (markers, ignore block) → task-02 + D-03/D-06; G-07/G-08/G-15 (lock) → task-03 + D-05; G-06/G-15 (verify) → task-04 + release constraint. Planner split into task-01/02 (G-05 scale). Sweep: 5 files rewritten from the accepted deltas; closure pending.
- B3 sweep (round 1): 6 files reread / 15 deltas / 1 stale reference fixed (CP-04 command without `@latest`) / 0 conflicts left.
- Round 2 closure (fresh reviewer, 2026-10-26):

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| G-01 | accept | symlinked skills folder → outside files deleted | task-01 Scope (lstat per component) | probe `symlinked-kept` | link kept, target untouched | PASS |
| G-02 | accept (revised) | block removal exposes `.claude/.env` | task-02 Scope (.gitignore) | probe `env-stays-ignored` | `.claude/` line kept while files remain | PASS |
| G-03 | accept | runtime.json pristine → removed | D-04, task-01 | probe `runtime-kept` | kept | PASS |
| G-04 | accept | `../../x` key; Codex root | task-01 Scope (resolve) | probes `outside-root-kept`, `pristine-removed-count` | outside-root; count | PASS |
| G-05 | accept | kept skill loses shared files | task-01 `required-by-kept` (round-2 repair) | probe `kept-skill-deps-kept` | — | FAIL → re-repaired; closes on the probe at develop |
| G-06 | accept | bare npx runs 0.18.2 install | Release constraint, task-04 | probes `silent-beside-npx`, `unknown-positional-two` | `@latest` | PASS |
| G-07 | accept | wrong cwd snapshots another tree | task-03 Scope | probe `wrong-cwd-refused` | refused | PASS |
| G-08 | accept | restore stops at first failure | task-03 injectable restore fs (round-2 repair) | probe `restore-continues-past-failure` | — | FAIL → re-repaired; closes on the probe at develop |
| G-09 | accept | `@AGENTS.md` lost | task-02 Scope | probe `agents-import-kept` | kept | PASS |
| G-10 | accept | user hook registration dropped | task-02, D-03 | probe `claude-user-hook-kept` | kept | PASS |
| G-11 | accept | omp broken | D-06 | probe `omp-refused` | refused | PASS |
| G-12 | accept | outputStyle points to removed style | D-03 (style file kept, no rename; round-2 repair) | probe `selected-style-kept` | — | UNKNOWN → re-repaired without the unverified rename; closes on the probe at develop |
| G-13 | accept | user handler keeps plugin down silently | task-02 Scope | probe `codex-standdown-reported` | reported | PASS |
| G-14 | accept | corrupt manifest → orphans | task-01/02 | probes `corrupt-manifest-refused`, `markers-unparsed` | refused | PASS |
| G-15 | accept | non-atomic lock; glob verify | task-03/04 | probes `lock-exclusive`, explicit test file | — | PASS |

- Round 2 new findings N-01 (High, kept skills lose shared files) … N-05 (Low): Bro accepted all with G-05/G-08/G-12 re-repairs (N-02 `ownership?.recordRoot`, N-03 re-export, N-04 stale-lock reclaim + probe, N-05 AC-04 wording). Paper rounds exhausted (B4): the re-repaired rows close only on their named probes during develop.
- Status: all five tasks promoted to `pending` after the round-2 decisions (2026-10-26); develop starts only on a new explicit `/cf:develop` invocation.
- Develop decisions (Bro, 2026-10-26, task-03 after three repair rounds ended PASS_WITH_WARNINGS): (1) the whole-target rollback of `backup.restore` stays — an edit made inside a snapshotted target while apply runs is reverted on failure, and the failure message says so (limitation); (2) D-04 revised as above — metadata stays while `runtime.json` stays; (3) one extra repair round authorized for the lock temp-write ENOSPC path.
- Develop decision (controller, 2026-10-26, task-04 review): when any installed platform is `refused` or `unmanaged`, both the dry-run and `--apply` change nothing and exit 1, naming the platform and why; migrating only the readable platform would leave the other install's hooks in place while reporting success. Shown to Bro at GATE-DONE.
