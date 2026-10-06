# Scout as a short subroutine
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-23)
- Existing: the scope gate and no-scan lists (`packages/spec/src/claude/skills/inspect/SKILL.md:29-68`) work in practice — 102 of 480 Codex sessions that read the skill added `!node_modules` globs and none scanned a no-scan path by accident; the smallest-route table (`:78-86`); the delegation gate (`:88-98`) and `references/internal-inspection.md` (70 lines), which can absorb the delegation mechanics; callers already own their report shapes (`brainstorm/SKILL.md:95-97` folds findings into 3–6 bullets, `debug/SKILL.md:89-90` names its fallback).
- Minimum change: `SKILL.md` from 142 lines to about 60 — keep scope, no-scan and smallest route; replace the `Scout Report` template (used in 1 of 480 sessions) with a findings shape a caller folds into its own report (files with `path:line`, entrypoint, call path, blast radius, unknowns); one sentence saying a host's own delegation mode is not the user's permission (Codex's proactive mode overrode "the user permitted" in 82 sessions); move Phase 1/2 and task registration into the reference and drop the three-minute timeout, which no tool can enforce; one line placing the `inspector` agent and Explore; `rules/workflow.md:11` names the skill by its public name.
- Expansion signals: four skill-side files, one new eval directory and `evals/summarize.mjs`, one deliverable group, no new service — below the split threshold.
- User decision: **KEEP**, plus the `inspector` role line, plus **an eval measuring the scout step inside `cf:debug`, before and after**.

## Scope reopened (GATE-SCOPE — 2026-09-23)
- New evidence from the first pilot: `/cf:debug` ran, but its only Skill call was `cafekit-inspect:debug`; scout was never invoked and the run used debug's fallback. The harness names plugin skills `<plugin>:<directory>`, and Claude Code shows project skills under their directory name as well — this very session lists `develop`, not the frontmatter's `cf:develop`, and the user's `/develop` command resolved. Whether the host always uses the directory or falls back to it because `cf:` is not a valid frontmatter name is `[UNVERIFIED]`; either way callers asking for `cf:scout` point at a name no Claude host shows, and the skill appears as `inspect`. This plausibly explains why Claude Code never invoked scout in its whole history `[UNVERIFIED as the cause]`, while Codex, which opens skill files by path, read it in 480 sessions.
- Three skills share the defect: `inspect` (called as `cf:scout`, 18 references), `hotfix` (`cf:fix`, 11), `question` (`cf:ask`, 7).
- The user chose to **rename the directories**, then **EXPAND to all three**. This reverses the earlier deliberate choice pinned by `bin/__tests__/codex-native.test.js:2270` ("must keep the manifest-owned inspect directory"); that choice kept the physical directories and routed the public rename through the frontmatter `name` (`plans/20260830-hapo-fix-hotfix-learning/plan.md:26,55`), which assumed the host reads `name` — the assumption this evidence breaks. The installer already retires directories through `obsolete.skills` (`src/claude/migration-manifest.json:82-90`, `bin/phases/skill-inventory.js:21-66`), removing only pristine managed trees; a user-modified old directory stays on disk, where the host still shows it, but CafeKit's catalog marks it `retired_skill` once it is listed in `RETIRED_DIRECTORIES` (`src/claude/scripts/generate-skill-catalog.cjs:9-18`; `bin/__tests__/optional-skill-inventory.test.js:226`).
- Visible consequence: typed commands become `/scout`, `/fix`, `/ask` — the public names the docs already use.

## Out of scope
- The `"inspect"` runtime key and `hooks/inspect-block.cjs` (a broad-search guard, not the skill); the `cafekit-web` docs slugs; `cf-scout` on Codex stays the installer's projection (`bin/lib/codex-install.js:247`).
- Removing or rewriting `agents/inspector.md`.
- `bin/lib/codex-install.js`'s slash-command list: no bare `/scout`, `/fix` or `/ask` occurs in `src/claude`, and adding common words would rewrite prose (R2-10).

## Known limits
- A user-modified old directory survives an upgrade and the host still lists it beside the new one; only CafeKit's catalog excludes it.
- An omp-only install over a project that Codex installed earlier warns `Preserved user-owned skill` for the Codex copies and leaves them (`bin/lib/context.js:130-140`).
- Downgrading with an older `npx @haposoft/cafekit@<version>` restores the old directory beside the new one; both carry the same public name and the older catalog drops both as duplicates.
- `packages/spec/CLAUDE.md:18,49` still says `/question`; it is internal and not shipped.
- Only `scout` gets a runtime check (task 02's pilot); `fix` and `ask` are covered by the upgrade script and the suite, not by a live host.
- On the 63-file fixture scout was invoked in 2 of 5 sonnet runs: 1 of 4 with the pre-rewrite text (0/3 in `pilot-lon`, then 1/1) and 1 of 1 with the rewrite (the fixed-point re-run of task 02). The fallback was taken on the 0/3; five runs cannot compare the two texts.
- `agents/inspector.md:53` still prints a `# Scout Report` heading; the agent is out of this packet's scope, so its output shape now differs from scout's findings.
- The decoy graders see `Read` paths and `Grep` calls that pass a `path` only; a `Grep` with no `path`, any `Glob` and any Bash scan are ungraded, and every enlarged-fixture run used `Grep`.
- `~/.codex/agents/code_reviewer.toml` (ClaudeKit, points at `/ck:scout`, 157 sessions) — outside this repository.
- Every caller's own text (`debug`, `hotfix`, `brainstorm`, `docs`, `question`, `debugger`).
- Reinstalling other projects; 443 of 480 sessions ran an older install, which only a reinstall fixes.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-05 | Rename `inspect`→`scout`, `hotfix`→`fix`, `question`→`ask`; retire the old directories through `obsolete.skills` and `RETIRED_DIRECTORIES` | Keep the directories and annotate callers; rename scout only | the host shows directory names, so the fix belongs where the name is read; one mechanism fixes all three (user decision) | ownership-aware removal keeps user edits, and the catalog marks retired directories | the upgrade script finds `cf:scout`, `cf:fix` or `cf:ask` missing from a generated catalog → stop |
| D-01 | Scout returns findings in a fixed shape for the caller to fold in | Keep a standalone `Scout Report` | 81% of reads came through another skill and the output always took the caller's format; the template was used once in 480 sessions | callers keep their own report shapes | a caller starts quoting `Scout Report` → revisit |
| D-02 | A host or runtime mode that enables delegation on its own does **not** replace the user's permission; without it scout stays in the main agent | Treat host mode as permission (the first draft); ignore host mode | whether Codex's proactive mode is a default or a user opt-in is `[UNVERIFIED]`, and only the stricter reading is safe under both (user decision at GATE-REVIEW, F-13) | the user can still permit delegation in the request | users report scout refusing delegation they configured → revisit with the host's documented default |
| D-03 | Measure through `cf:debug`, the path real use takes | A direct `/cf:scout` prompt | Claude Code never invoked scout directly; the eval sandbox reads only `SKILL.md`, so the measured text is the text that changes | the harness loads `debug` beside `scout` with `--with-skill` | the pilot shows scout never invoked → the case measures `debug` alone; stop the whole packet and ask the user (task 03 waits on task 02 by user decision, F-12) |
| D-04 | Keep the `AskUserQuestion` fallback sentence | Drop it for length | `codex-native.test.js:1560-1570` pins its Codex projection | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-00 | Each of the three skills lives in a directory named after its public suffix, and an upgrade retires the old directory | move, modify | `skills/{scout,fix,ask}/`, `migration-manifest.json`, `generate-skill-catalog.cjs`, four `bin/__tests__` files, `run-skill-self-tests.mjs`, `scripts/check-skill-rename.sh` | none | **critical** — the installer removes directories in users' projects (pristine managed trees only) | static: self-test suite and residual-name scan; installed: a migration test on both platforms and a real upgrade from `e083bd9` with a `--dry-run` negative control |
| CP-01 | A debug run that scouts can be measured for where it looked and what it found | create, modify | `evals/scout/`, `evals/summarize.mjs` | none | elevated — paid runs; reachability shown by a one-run pilot | static: `check-fixture.sh`, `evals/run.sh scout --with-skill debug --validate`; runtime: one pilot run with its kept trace |
| CP-02 | Scout is a short subroutine with a caller-facing findings shape, a host-delegation rule and a role line | modify | `scout/SKILL.md`, `scout/references/internal-inspection.md`, `rules/workflow.md`, `scripts/run-skill-self-tests.mjs` | none | elevated — eight callers and two installs read it | static: self-test suite with counterexamples; installed: the Codex projection tests |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-00 | When CafeKit upgrades a project installed from `e083bd9`, it shall leave `scout/`, `fix/` and `ask/` and none of the three pristine old directories, shall change nothing under `--dry-run`, shall preserve a user-modified old directory with `Preserved user-owned skill`, and its generated catalog shall list `cf:scout`, `cf:fix` and `cf:ask` with any preserved old directory marked `retired_skill`. | task 01's Command |
| AC-01 | When `evals/run.sh scout --with-skill debug` runs the new case, it shall load with no `✗`, `check-fixture.sh` shall pass, `evals/summarize.mjs` shall print the `dem-*` medians and invoked-only counts, and one pilot run shall show every grader scored and, from its kept trace, whether and under which name scout was invoked. | task 02's Command |
| AC-02 | `scout/SKILL.md` shall be at most 70 lines, keep the scope gate, no-scan lists and smallest-route table, carry the findings shape, the host-delegation rule and the `inspector`/Explore line, and contain no standalone `Scout Report` template and no three-minute timeout. | self-test suite, with a counterexample per clause |
| AC-03 | `rules/workflow.md` shall name the skill `cf:scout` rather than `inspect`. | same suite |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Three skills live in the directory their public name says | P1 | AC-00 | `skills/{scout,fix,ask}/`, `migration-manifest.json`, `scripts/generate-skill-catalog.cjs`, `bin/__tests__/*`, `scripts/run-skill-self-tests.mjs`, `scripts/check-skill-rename.sh` | - | done |
| 02 | A debug run that scouts can be measured | P1 | AC-01 | `evals/scout/`, `evals/summarize.mjs` | task-01 | done |
| 03 | Scout becomes a short subroutine | P1 | AC-02, AC-03 | `skills/scout/SKILL.md`, `skills/scout/references/internal-inspection.md`, `rules/workflow.md`, `scripts/run-skill-self-tests.mjs` | task-02 | done |

## Review log
- GATE-REVIEW (2026-09-23): one fresh-context reviewer (spec-maker), 15 findings (6 High, 7 Medium, 2 Low), verdict FAIL. Its citation sample matched every checked `path:line`; the 480-session figures stay `[UNVERIFIED]` inside the repository because the source logs live outside it.
- User decisions: accept F-01–F-11, F-14, F-15 as proposed; F-12 — task 02 **keeps** its dependency on task 01, so a pilot that shows no scout call stops the packet; F-13 — a host's own delegation mode does not count as permission (D-02 rewritten).
- Applied: F-01 summarizer joins task 01; F-02 decoy stored as `fake_node_modules`; F-03 decoy graded on `Read`/`Grep` inputs, Bash left ungraded with the reason; F-04 statuses rederived; F-05 invoked-only counts and a 5/10 floor per cell; F-06 pilot copies the exact `Skill` inputs, looser pattern, `goi-debug` informational; F-07 looser regex and an honest reason; F-08 `khong-sua-code` reads the file; F-09 one mutation per clause and the no-scan lists pinned; F-10 the fallback sentence stays verbatim in `SKILL.md`; F-11 `sha256` of the loaded skill per cell and `description` out of scope; F-14 `check-fixture.sh`; F-15 wording, prerequisites in the Receipt, opus ceiling labelled a stop.
- Status after round 1: the then-first two tasks `pending`; the measurement task `blocked` on `UNKNOWN` reachability.
- Execution, first pilot (2026-09-23): scout never invoked (see Scope reopened). GATE-SCOPE reopened; the user chose to rename the directories, then EXPAND to all three. Tasks renumbered: the rename is task 01, the eval case task 02, the rewrite task 03, the measurement task 04.
- GATE-REVIEW round 2 (2026-09-23, the last paper round): one fresh-context reviewer, 13 findings (2 High, 7 Medium, 4 Low), verdict FAIL. User decision: accept as proposed — R2-01…R2-09 applied, R2-10 dropped from scope, R2-11…R2-13 recorded under Known limits.
- Applied: R2-01 the catalog generator joins task 01 and its retired list; R2-02 the grep became an allowlisted residual scan in `check-skill-rename.sh`; R2-03 all five pins and two probes listed for deliberate inversion; R2-04 AC-00 and D-05 name the catalog, and the host-still-lists limit is recorded; R2-05 a real upgrade from `e083bd9` with a `--dry-run` control; R2-06 outcome reworded and host naming marked `[UNVERIFIED]`; R2-07 stale references fixed and the old choice cited; R2-08 closure table below; R2-09 oracles take the preceding receipt's count.

- Execution, second pilot (2026-09-23, after the rename): the skill list showed `cafekit-scout:scout`, but the run chose direct reconnaissance on the thirteen-file fixture ("Small project…"). User decision: **enlarge the fixture** (about 70 files, the defect several calls deep, look-alike files inside the project) and pilot three runs; if scout is still not invoked, fall back to rewriting with probes only and dropping the measurement.

- Execution, three pilots on the enlarged fixture (63 files, the defect five calls deep, look-alikes in `src/legacy/` and `src/promo/`; `evals/results/scout/pilot-lon/`): scout invoked 0/3, diagnosis correct 3/3 (`nguyen-nhan`, `dung-cho-loi`, `khong-sua-code` 3/3). Every run invoked `cafekit-scout:debug` and then performed debug's "Step 1: Scout" itself (one wrote "Bắt đầu bằng bước Scout…") with `Grep`, `Glob`, `Read` and `Bash`. So callers that say "Activate `cf:scout`" are read as an instruction to scout, not to invoke the skill — a finding about the callers, outside this packet's scope.
- Per the fallback the user chose before this pilot: **task 04 and its CP-03/AC-04 are dropped**; task 03 proceeds with probes only; task 02 keeps the case as a measurement of debug's own scouting.

- **GATE-DONE (2026-09-23): the user accepted the packet as complete** after current receipts for tasks 01–03 and these limits: scout invoked 2 of 5 runs (callers read "Step 1: Scout" as a step to do themselves — left for a later packet), task 04 dropped by the pre-chosen fallback, typed commands renamed, a user-modified old directory still visible to the host, `inspector.md`'s `Scout Report`, the unpinned Patterns line.

### Accepted-repair closure
| Finding | Repaired at | Proved at | Closure |
|---|---|---|---|
| F-01 | task-02 Steps 5 | task-02 Command (summary prints medians and invoked-only counts) | open until task 02 |
| F-02, F-14 | task-02 Steps 1–2 | `check-fixture.sh` (6 `ok`; decoy-removed and threshold-fixed controls exit 1, observed 2026-09-23) | closed |
| F-03, F-06, F-07, F-08 | task-02 Step 4 graders | first pilot scored all eleven graders (2026-09-23) | closed for scoring; F-06 name check reopens with the rename |
| F-05, F-11 | task-04 (dropped) | — | void: the measurement was dropped by user decision |
| F-09, F-10 | task-03 Steps 2, 5 | task-03 Command | open until task 03 |
| F-13 | D-02 | task-03 probe for the host rule | open until task 03 |
| F-15 | task wording | this sweep | closed |

### Sweep (round 2)
Re-read plan.md and all four tasks; fixed D-03's names, CP-01's command, AC-01's owner, the old-choice citation, task-02's resolved blocker text and task-04's skill path; no conflicts left open.
