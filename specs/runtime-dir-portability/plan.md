# Runtime-directory portability for the gate hooks
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-09-08)
- Existing: `src/claude/hooks/lib/hook-state-dir.cjs:24` derives a directory from the hook's own location; `src/codex/hooks/lib/hook-context.cjs:13` does the same for the project root. The pattern exists and is not applied to the remaining literal `.claude` sites.
- Minimum change: one helper deriving the runtime directory from the hook's location; every project-runtime read, write, and model-facing path string goes through it; the omp fork shrinks to an overlay so it cannot drift.
- Expansion signals: about thirteen hook files plus one helper, above the eight-file threshold; one subsystem since every edit uses the same helper.
- User decision: C1 KEEP — categories A and C; category B (`~/.claude/` Claude Code globals) stays. C2 "sửa gốc + overlay": the omp scripts defect was fixed first in `omp-runtime-support` task 05, and the omp fork becomes an overlay of the files that genuinely differ.

## Census of literal `.claude` in `src/claude/hooks` (recounted 2026-09-08 after review)
66 lines total. Classification below was read line by line; the round 1 draft miscounted every category.
| Category | Sites | Count | Effect on a non-Claude install |
|---|---|---|---|
| A — project runtime dir, reachable | `rules.cjs:21`, `agent.cjs:21,29-30`, `inspect-block.cjs:65`, `usage.cjs:32`, `spec-state.cjs:72`, `task-scaffold-guard.cjs:57`, `session.cjs:52,61,151,168`, `state.cjs:35-36`, `completion-authority.cjs:30,53`, `semantic-review-authority.cjs:31,73`, `spec-gate.cjs:28,111`, `privacy-block.cjs:46`, `lib/config.cjs:12` (via `docs-sync.cjs:24`) | 22 | Broken: no config read, wrong installed-root detection, state written to a directory that does not exist. |
| A′ — literal `claude` without a dot | `semantic-review-authority.cjs:85` (`basename(sourceRuntime) !== 'claude'` throws "runtime root is not recognized" for any other tree), `lib/hook-state-dir.cjs:35` (`'cafekit-hook-logs', 'claude'`) | 2 | Broken for omp when run from a source tree; log dir mislabelled. |
| B — Claude Code globals (`~/.claude/`) | `usage.cjs:68` credentials, `state.cjs:42`, `lib/counter.cjs:74,82`, `lib/context.cjs:54,57,61,64,77,79,94,103,104` | 13 (4 reachable) | Not broken. Claude Code's own files; omp and grok have no equivalent. Kept. |
| C — model-facing strings, reachable | `task-scaffold-guard.cjs:24,53,63,78`, `usage.cjs:20`, `inspect-block.cjs:11`, `spec-state.cjs:229`, `session.cjs:58,146,161`, `agent.cjs:18,70,76`, `state.cjs:15`, `lib/counter.cjs:88-95` (reads `.claude/settings*.json`, reachable only from `status.cjs`) | ≈20 | Misleading advice. After the omp scripts hotfix, `.omp/scripts/` exists, so a derived `node .omp/scripts/…` is true; `.omp/skills/` still does not exist (omp reads `.agents/skills`), so skill paths derive from `PLATFORMS[*].skillsRef`, not the runtime dir. |
| D — dead code | `lib/context.cjs` (18 lines), `lib/detect.cjs` (2 lines): no importer anywhere in `src`, `bin`, `scripts` | 20 | None. Left untouched and recorded; deleting dead modules is a separate decision. |

## Verified contract
- Installed layout `<project>/<folder>/hooks/…` with folder `.claude`, `.codex`, `.omp` (`bin/lib/context.js:78,100,123`). Source layout `packages/spec/src/<platform>/hooks/…`; `hook-state-dir.cjs:25-29` detects the source tree by substring `SOURCE_MARKER`.
- A dotted basename must win over the source marker, so an install whose absolute path happens to contain `/packages/spec/src/` still derives its real folder.
- Five test fixtures copy hooks by hand into `<tmp>/.claude/hooks/` with an explicit lib allow-list: `src/claude/hooks/__tests__/spec-gate.test.js:285-305` (`installClaudeGate`), `state.test.js:41-50`, `semantic-review-authority.test.js:24-41`, `bin/__tests__/develop-contract.test.js:77-97`, `bin/__tests__/specs-v2-execution-closeout.test.js:266`. Each allow-list must gain `lib/runtime-dir.cjs`; there is no honest "zero fixture edits".
- `node --test <directory>` fails on Node 24 with "Cannot find module"; the hook suite is `node --test src/claude/hooks/__tests__/*.test.js` (baseline 219 pass).
- `projectRoot()` order in `spec-gate.cjs:19-42` and `completion-authority.cjs:21-44` is `CLAUDE_PROJECT_DIR` → installed-hook detection → `PROJECT_ROOT` → `payload.cwd` → `process.cwd()`; `semantic-review-authority.cjs:29-39` puts detection first. With a derived name the detection becomes true for any dotted folder, so on omp the root becomes `path.resolve(__dirname, '..', '..')` instead of the bridge's `PROJECT_ROOT`/`payload.cwd`. For Claude nothing changes. `spec-state.cjs:80` still reads `PROJECT_ROOT || cwd` and must follow the same rule.
- `.omp/` holds omp's own `config.yml`, `settings.json`, `extensions/`, `rules/`, `agents/`; omp does not read or reject a `runtime.json` there (strings of omp 18.1.11). `--force-overwrite` prunes nothing it did not write.
- Shared stores are already runtime-independent: completion-authority and semantic-review keep state under `~/.cafekit/completion-authority/projects/<sha256(realpath root)>` (`completion-authority-state.cjs:53-73`).

## Out of scope
- Category B and category D, as recorded above.
- grok; it inherits this work.
- The three omp contract edits (`privacy-block.cjs` ask→deny and catch-all, `task-scaffold-guard.cjs` Write normalisation, `lib/omp-tool-names.cjs`). They are preserved as the overlay's content.
- Removing `.omp/` from `RUNTIME_STATE_ROOTS` handling: `provenance.cjs:154-157` lists `.claude/*` and `.codex/*`; adding `.omp/hooks/.logs` and `.omp/runtime.json` is in scope (task 03) because otherwise a hook crash log under `.omp/` shifts the worktree digest.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | A hook knows its own runtime directory | add helper | `src/claude/hooks/lib/runtime-dir.cjs` | settled — dotted basename wins over source marker | elevated — every gate depends on it | source |
| CP-02 | Claude gate hooks read, write, and advise through the helper | modify 13 hooks, 5 fixtures | `src/claude/hooks/*.cjs`, five test allow-lists | settled | elevated — two shipped platforms; suite is the guard | source + installed |
| CP-03 | An omp-only install has working rules and a stable digest | overlay fork, ship runtime.json, extend state roots | `src/omp/hooks/`, `src/omp/runtime.json`, `bin/phases/omp-runtime.js`, `scripts/provenance.cjs` | settled by C2 | elevated — user-visible outcome | source + installed |
| CP-04 | Docs record what is portable and what stays Claude-only | modify docs | `docs/installer-architecture.md`, changelogs | settled | routine | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a file under `<X>/hooks/` asks for its runtime directory name, the helper shall return `basename(<X>)` when it starts with a dot, else `.`+`<platform>` for `packages/spec/src/<platform>/hooks/`, else `.claude`; the dotted case shall win when both apply. | `node --test bin/__tests__/runtime-dir.test.js` |
| AC-02 | When the whole `src/claude/hooks/` tree plus `src/claude/scripts/` is copied under `<tmp>/.omp/`, each category-A and A′ hook run against `<tmp>/.omp/runtime.json` holding a sentinel shall reflect the sentinel, with no `.claude` path present in `<tmp>`. | `node --test bin/__tests__/runtime-dir.test.js` |
| AC-03 | When the hook suite and the two installer suites that copy hooks run after the edits and the five allow-list additions, they shall pass at their prior counts. | `node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js` |
| AC-04 | When a hook prints advice naming a runtime path, the path shall derive from the runtime directory for `runtime.json` and `scripts/`, and from `PLATFORMS[*].skillsRef` for skills; under `.omp/` the strings shall read `.omp/runtime.json`, `.omp/scripts/…`, `.agents/skills/`. | `node --test bin/__tests__/runtime-dir.test.js` |
| AC-05 | When `src/omp/hooks/` is compared to `src/claude/hooks/`, it shall contain only `privacy-block.cjs`, `task-scaffold-guard.cjs`, and `lib/omp-tool-names.cjs`; `omp-runtime.js` shall copy the Claude tree and overlay those files. | `node --test bin/__tests__/omp-hooks.test.js` |
| AC-06 | When `--platform omp` runs into a project with no `.claude/`, it shall ship `.omp/runtime.json` (`codingLevel: 1`, `usage.enabled: false`, no statusline keys) and `.omp/runtime.schema.json`, and `.omp/hooks/rules.cjs` shall print `## Rules`; `runtime-schema.test.js` shall cover the omp runtime file. | `node --test bin/__tests__/omp-runtime.test.js bin/__tests__/runtime-schema.test.js` |
| AC-07 | When `provenance.cjs` computes the worktree digest, `.omp/hooks/.logs` and `.omp/runtime.json` shall be excluded like their `.claude` and `.codex` counterparts. | `node --test bin/__tests__/develop-contract.test.js` |
| AC-08 | When documentation describes hook portability, it shall name the helper, the categories ported, the 13 `~/.claude/` sites kept, and the 20 dead-code lines left in place. | `node scripts/run-skill-self-tests.mjs` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Derive the runtime directory from the hook's location | AC-01 | `src/claude/hooks/lib/runtime-dir.cjs`, `bin/__tests__/runtime-dir.test.js` | - | done |
| 02 | Route reads, writes, and advice through the helper | AC-02, AC-03, AC-04 | 13 hook files, 5 fixture allow-lists, `bin/__tests__/runtime-dir.test.js` | task-01-derive-runtime-dir.md | done |
| 03 | Make the omp fork an overlay and give an omp-only install working rules | AC-05, AC-06, AC-07 | `src/omp/hooks/`, `src/omp/runtime.json`, `bin/phases/omp-runtime.js`, `src/claude/scripts/provenance.cjs`, `bin/__tests__/omp-hooks.test.js`, `bin/__tests__/omp-runtime.test.js`, `bin/__tests__/runtime-schema.test.js` | task-02-route-runtime-paths.md | done |
| 04 | Document portability and the Claude-only remainder | AC-08 | `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | task-03-omp-overlay-and-runtime.md | done |

## Review log
- Round 1 (2026-09-08): two fresh-context reviewers, both FAIL; 13 deduplicated defects accepted, none rejected. Rewrites: AC-03 no longer claims zero fixture edits and names the five allow-lists; the verification command is a glob, since `node --test <dir>` fails on Node 24; the census was recounted line by line and gained `privacy-block.cjs:46`, `spec-gate.cjs:111`, `lib/config.cjs:12`, and the undotted `semantic-review-authority.cjs:85`; `spec-gate.cjs:14` corrected to `:28`; "six" category-B sites corrected to 13 with 4 reachable; 20 dead-code lines in `lib/context.cjs` and `lib/detect.cjs` recorded as category D; the `derived:false` flag dropped as a flag nobody would read; the projectRoot resolution change on omp is recorded; tasks 02 and 03 merged because they touched the same files in sequence; `src/omp/runtime.json` gained a defined key set and schema-test ownership; `RUNTIME_STATE_ROOTS` gains `.omp`. Two findings were decisions and went to the user: the omp scripts defect was fixed first as `omp-runtime-support` task 05 so category-C strings become true (KEEP stands), and the omp fork becomes an overlay (reversing that packet's C2 on this new evidence).
- C3 (2026-09-08): user accepted completion at 4/4 with the recorded limitations — `codingLevel: 1` ships in `src/omp/runtime.json` but no omp hook consumes it yet (only the Codex rules hook injects the style); `agent.cjs:28` keeps one deliberate `.claude` literal for the platform skills mapping; the "20 dead-code lines" figure is the planning census, while a grep finds 21 `.claude` mentions across `lib/context.cjs` and `lib/detect.cjs` of which 9 are the `~/.claude/` sites already counted in category B; four files moved outside task ownership as forced consequences and are disclosed in their commits (`migration-manifest.json` and the static probe in task 02; `develop-contract.test.js` and `omp-bridge.test.js` in task 03); the dogfood install in this repository still runs the pre-portability hook bytes until a `--force-overwrite` reinstall. Receipts: 01 `86e4273`, 02 `2a8724d`, 03 `a6d7012`, 04 `e516a89`.
