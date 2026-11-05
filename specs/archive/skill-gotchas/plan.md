# Skill gotchas for cf:develop and cf:sync
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-29)
- Existing: no skill under `packages/spec/src` has a Gotchas section (`mobile-development/SKILL.md:175` and `xlsx/SKILL.md:239` carry "Common Pitfalls" only); `cf:develop` (`packages/spec/src/claude/skills/develop/SKILL.md`, 123 lines) and `cf:sync` (`packages/spec/src/claude/skills/sync/SKILL.md`, 50 lines) are well under the 5,000-token budget the source video gives for a compacted skill, so placement inside `SKILL.md` costs nothing in survival.
- Existing: Codex reads the same source through the installer projection, which rewrites `/cf:<name>` to `$cf-<name>` (`packages/spec/bin/lib/codex-install.js:294`); the two committed plugin trees are rebuilt with `packages/spec/scripts/build-claude-plugin.mjs` and `build-codex-plugin.mjs`, each with `--check <dir>` (`build-claude-plugin.mjs:3-7`).
- Minimum change: one `## Gotchas` section in each of the two skills, holding only traps a CafeKit user hits and the current code still produces, each with symptom, cause and fix; a source contract test; rebuilt plugins; two changelog entries.
- Traps checked against current code and kept:
  - Command identity: the Receipt's single `Command:` must equal the last top-level `- Command:` of the Verification Plan before its first `###` sub-heading (`packages/spec/src/claude/scripts/spec-receipt.cjs:102-141`, sub-heading rule at `:122-124`); the gate hint says only "must match exactly" (`spec-receipt.cjs:257`).
  - Head drift: `Head` is a digest of the tracked and untracked, non-ignored files outside the specs root, uncommitted bytes included (`packages/spec/src/claude/scripts/provenance.cjs:185-224`); the live pair is compared while a task file differs from its committed copy (`spec-receipt.cjs:149-186`) and at the final-Head fixed point (`packages/spec/src/claude/skills/develop/references/quality-gate.md:78-97`).
  - Stale active feature: `specs/_shared/active-feature.json` is resolved as an explicit target when the host names none (`packages/spec/src/claude/scripts/spec-resolver.cjs:298-333`); a missing packet directory or `plan.md` (`spec-resolver.cjs:507-508`) blocks the turn's Stop with `explicit_not_found` (`packages/spec/src/claude/hooks/spec-gate.cjs:148-153`), and the message does not name the file.
  - Rebinding a committed done task: a committed task file whose bytes change goes back to live Base/Head binding (`spec-receipt.cjs:149-186`). Mechanism confirmed; no recorded incident.
- Traps checked and dropped: bulleted Receipt fields are accepted now (`spec-receipt.cjs:82-85`); an unborn repository already gets a fix-naming error (`provenance.cjs:92`).
- Expansion signals: none (two skill files, one test, generated plugin trees, two changelogs).
- User decision: KEEP — develop (3 traps) and sync (1 trap), contract test, plugin rebuild, changelogs; no hook-message change and no paid eval.

## Out of scope
- Changing any gate message, hook, resolver or receipt validator.
- Paid eval runs; live-model adherence to the new text stays `[UNVERIFIED]`.
- Gotchas for other skills, and traps only a CafeKit maintainer hits (those belong in the root `AGENTS.md` project notes).
- Commit, push, version bump, npm publish, plugin-repository sync, and reinstalling the git-ignored local copies (`.claude/skills/`, `.agents/skills/`), which keep the old text until the next install.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Gotchas inline in `SKILL.md`, as the last section before `## Attached references` (develop) and at the end (sync) | A new `references/gotchas.md` | Four short entries; a reference file is opened only on demand, and the trap must be seen before it is hit | Both skills stay far below the compaction budget | A skill grows past ~3,500 words → move the section to a reference and link it |
| D-02 | Symptom-first entry: bold symptom naming what the gate prints, then cause, then fix, no MUST/NEVER capitals | A rule list | Matches the source video and agentskills.io guidance; the symptom is what the reader searches for | The symptom text matches what the gate prints | A gate message changes → update the entry in the same change |
| D-03 | Keep only traps the current code produces, stated under the conditions the code applies | Every trap in session memory | One fixed and one self-explaining trap were found while scoping; review found four overstated conditions | Citations above stay current | A cited line moves or behavior changes → re-check before editing |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | A reader of `cf:develop` and `cf:sync` finds a Gotchas section naming each kept trap with its symptom, cause and fix, and no dropped trap | add | skill source text (Claude, projected to Codex) | none | elevated — shipped runtime instructions; citations in Scope decision | source |
| CP-02 | The shipped Claude and Codex plugins carry the same skill text as the source, and the change is recorded in both changelogs | modify | `plugins/cf`, `plugins/cf-codex`, both marketplace files, two changelogs | none | elevated — installed behavior via plugins | source + installed |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The `cf:develop` skill shall contain one `## Gotchas` section with three entries: command identity, Head drift after an edit outside the specs root, and a stale `specs/_shared/active-feature.json`, each naming symptom, cause and fix. | task-01 Command |
| AC-02 | The `cf:sync` skill shall contain one `## Gotchas` section with the committed-done-task entry pointing to `/cf:sync rebind`. | task-01 Command |
| AC-03 | If either Gotchas section lists the bulleted-Receipt trap or uses all-capital MUST/NEVER, the contract test shall fail. | task-01 Command |
| AC-04 | When the plugins are rebuilt, `plugins/cf` and `plugins/cf-codex` shall match a fresh build and the package self-tests shall pass. | task-02 Command |
| AC-05 | Both changelogs shall hold an `[Unreleased]` entry describing the two Gotchas sections. | task-02 Command (`awk` probe bounded by `[0.18.3]`) |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Gotchas sections in develop and sync, pinned by the contract test | P1 | AC-01, AC-02, AC-03 | `packages/spec/src/claude/skills/{develop,sync}/SKILL.md`, `packages/spec/bin/__tests__/develop-contract.test.js` | - | done |
| 02 | Rebuilt plugins and changelog entries | P2 | AC-04, AC-05 | `plugins/cf/`, `plugins/cf-codex/`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md` | task-01 | done |

Closeout note: task-02 changes files outside the specs root, so `Head` moves after task-01 closes; before GATE-DONE the final-Head fixed point (`quality-gate.md:78-97`) re-runs task-01's proof and rebinds its Receipt.

## Review log
- Round 1 (GATE-REVIEW 2026-10-29, two fresh-context reviewers: Fact Checker; Contract Verifier + Assumption destroyer): 10 findings, user accepted all 10 with the proposed repairs.
  - F1 High: task-02 `grep -A3` misses the entry under the blank-line layout of `packages/spec/CHANGELOG.md:8-12` → bounded `sed` range.
  - F2 High: task-01 Command passed before any change, a blocker under `develop/SKILL.md:93-94` → leading `grep -q '^## Gotchas'` probes.
  - F3 Medium: Head-drift entry lacked the binding condition, overstated "every file", claimed Base moves on an edit, and gave a fix order the develop flow cannot follow → rewritten around `provenance`, live comparison conditions, and the final-Head fixed point.
  - F4 Medium: command-identity entry missed the `###` rule and `Commands:` → wording aligned with `sync/references/rebind-and-audit.md:16-18`.
  - F5 Medium: "Every Stop" overstated (`spec-gate.cjs:64` `stop_hook_active`; host target wins) and missing-`plan.md` case omitted → reworded.
  - F6 Medium: sync entry stated the structure-only condition wrongly → "matches its committed copy, or was never committed".
  - F7 Medium: stale citations and the Gotchas claim about `mobile-development`/`xlsx` → corrected above.
  - F8 Medium: "verbatim" in task-01 acceptance with a keyword test → "verbatim" removed.
  - F9 Medium: final-Head consequence of task-02 unstated → closeout note above.
  - F10 Low: `.claude-plugin/marketplace.json` unowned; local installed copies not updated → added to task-02 ownership and Out of scope.
  - Closure (fresh-context replay, 2026-10-29):

    | ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
    |---|---|---|---|---|---|---|
    | F1 | accepted | `grep -A3` misses entry at +4 | task-02 Command | temp file in `CHANGELOG.md:8-12` layout: old probe exit 1, new probe exit 0 | no longer applies | PASS |
    | F2 | accepted | Command passed before change | task-01 Command | unchanged source: `grep -q '^## Gotchas'` exit 1 for develop and sync | fails before change | PASS |
    | F3 | accepted | Head-drift overclaims | task-01 Step 2 | `provenance.cjs:103,186-193`, `spec-receipt.cjs:178-185,261`, `quality-gate.md:78-98` | wording matches code | PASS |
    | F4 | accepted | missing `###` rule | task-01 Step 2 | `spec-receipt.cjs:95-96,121-124,134-138` | matches | PASS |
    | F5 | accepted | "Every Stop" | task-01 Step 2 | `spec-gate.cjs:64,97-104`, `spec-resolver.cjs:225,507-508` | matches | PASS |
    | F6 | accepted | wrong structure-only condition | task-01 Step 3 | `spec-receipt.cjs:180,184-185` | matches | PASS |
    | F7 | accepted | stale citations | Scope decision | all re-run; `build-claude-plugin.mjs:3-5` lacked `--check` (at `:7`) → corrected to `:3-7` after replay | corrected | PASS |
    | F8 | accepted | "verbatim" | task-01 Acceptance | `grep -i verbatim` hits only this log | gone | PASS |
    | F9 | accepted | final-Head unstated | Closeout note | `quality-gate.md:80-98`; packet untracked → structure mode (`spec-receipt.cjs:180`) | stated | PASS |
    | F10 | accepted | marketplace unowned | task-02 Ownership, Out of scope | `build-claude-plugin.mjs:186`, `build-codex-plugin.mjs:209` | stated | PASS |

  - Sweep: 3 files reread / 10 deltas / 1 stale citation fixed / 0 contradictions left; regex replay: all 8 required patterns match the new texts, both forbidden patterns do not.
- Closure-pass observations (round 2 candidates, awaiting user decision): R2-1 Low task-02 probe accepts an `[Unreleased]` block placed below `[0.18.3]`; R2-2 Low sync entry symptom does not name `provenance`; R2-3 Low `explicit_not_found` causes listed are sufficient but not exhaustive (`spec-resolver.cjs:237-238`).
- Round 2 (GATE-REVIEW 2026-10-29): user accepted R2-1 and R2-2, kept R2-3 unchanged (the sentence states a sufficient cause and the skill stays light).
  - R2-1: task-02 changelog probes replaced by an `awk` probe that stops at `[0.18.3]`; replay on four layouts: blank-line and tight `[Unreleased]` above `[0.18.3]` exit 0, block below `[0.18.3]` exit 1, `Gotchas` only under `[0.18.3]` exit 1; both current changelogs exit 1.
  - R2-2: sync entry symptom renamed to "`provenance` fails on a done task after a small edit."
  - Closure (fresh-context replay): R2-1 PASS — the repaired `awk` probe exits 0 for both correct layouts and 1 for the block below `[0.18.3]`, Gotchas only under `[0.18.3]`, no `[Unreleased]`, and both current changelogs; the Command reads as one canonical backtick-wrapped value. R2-2 PASS — the symptom names `provenance`; 8/8 required regexes match, 2/2 forbidden do not.
  - Sweep: 3 files reread / 2 deltas / 0 stale references outside this log / 0 contradictions left. Paper review is closed (two rounds); later findings need runtime evidence.
- Environment blocker (2026-10-29): another session holds uncommitted edits to 7 test files and 2 staged deletions under `packages/spec/`, including `packages/spec/bin/__tests__/develop-contract.test.js` (owned by task-01), and is running the self-test suite. Cleared 2026-10-30: that work was committed (HEAD 7ed6b1fa), the tree holds only `AGENTS.md` and this packet, and no self-test process runs. 2026-10-30: task-02's Command then failed with `command not found: pnpm` (exit 127); the user installed pnpm 12.16.1 globally and the unchanged Command was rerun. Both changelogs already had an `## [Unreleased]` block, so task-02 adds `### Added` inside it instead of a second heading.

- GATE-DONE (2026-11-05): Bro accepted the packet and kept the `## Gotchas` sections on the measurement of `specs/skill-gotchas-eval` (develop command identity 0/20 → 20/20; sync tick-and-rebind 0/20 → 11/20, carried by opus while sonnet warns without rebinding). The local install still needs a reinstall to pick the sections up. Not committed or pushed.
