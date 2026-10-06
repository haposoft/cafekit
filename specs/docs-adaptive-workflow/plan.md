# Docs adaptive workflow
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-09-01)

- Existing: `hapo:docs` v1.0.0 is a 269-line skill with five references (875 lines) and templates, in good structural shape: mode routing with exclusive flags, evidence taxonomy `Observed | Inferred | Unknown` with confidence (`packages/spec/src/claude/skills/docs/SKILL.md:181-197`), scope discipline (`SKILL.md:199-217`), the `Reconstruction Is Not Specs` gate (`SKILL.md:161-179`), two validator scripts, clean prose (no shouting emphasis, no task-tool coupling), and twelve static probes (`packages/spec/scripts/run-skill-self-tests.mjs:4578-4679`). The skill sits in the optional document bundle (`run-skill-self-tests.mjs:4578-4581`).
- Minimum change: close four wave-standard gaps. (1) Delegation is ungated at four sites — `SKILL.md:224`, `references/update-workflow.md:70`, the reader-split table at `references/update-workflow.md:55-56`, and `references/init-workflow.md:87` — reproduce the scout Delegation Gate's three canonical clauses. (2) Develop/Sync end with a docs-impact handoff (`packages/spec/src/claude/skills/develop/SKILL.md:155-156`: `none` reports only, `minor`/`major` update only affected existing docs) but `hapo:docs` has no consuming contract — add a post-task docs checkpoint section, including its no-affected-doc escape path. (3) No mutation checker guards the skill's invariants — add the adaptive contract pair with one nonempty mutation group and at least one forbidden-pattern assertion per invariant. (4) No docs-contract parity assertions exist in the installed projections — add them for both projections, covering the optional-bundle branch. Bump version metadata to 2.0.0.
- Expansion signals: none — one subsystem, about nine touched files across two sequential tasks; the docs-keeper agent remake was explicitly declined at C1.
- User decision: **KEEP** — close the four gaps; keep the existing mode/reference/template structure.

## Out of scope

- Remaking the `docs-keeper` agent; renaming the skill or any reference file.
- The docs-sync hook and its probes (`run-skill-self-tests.mjs:4744,4793`); validator script logic (`validate-docs.cjs`, `validate-docs-reconstruct.cjs`).
- Template content overhaul under `skills/docs/templates/`; reconstruct workflow semantics beyond mechanical anchor consistency.
- `cafekit-web` docs pages for the docs skill, plus the changelog entries for the 2.0.0 bump (`packages/spec/CHANGELOG.md`, `docs/project-changelog.md`) — conscious exclusion; both are deferred to the post-implementation docs-sync flow.
- `rules/manage-docs.md:18,22` assigning `docs-keeper` duties — conscious exclusion: the rule describes agent responsibility; delegation gating semantics live in the docs skill, the sole dispatch surface this packet owns.
- Legacy `spec.json` packets; live-model adherence claims (static checks prove the written contract only).

## Coverage profile

| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Every `docs-keeper`/subagent dispatch within the docs skill passes the scout Delegation Gate's three canonical clauses; otherwise the workflow continues in the main agent | modify | skill contract | none | elevated — ungated sites at `SKILL.md:224`, `update-workflow.md:70`, `update-workflow.md:55-56` (reader split), `init-workflow.md:87` | source + installed |
| CP-02 | A post-task docs checkpoint contract consumes the Develop/Sync docs-impact handoff: `none` reports only; `minor`/`major` update only affected existing docs; no new doc is invented for a checkpoint; when no affected existing doc exists, the checkpoint reports the gap and recommends an explicit `/hapo:docs` invocation instead of auto-selecting `init` | add | skill contract + cross-skill handoff | none | elevated — producer at `develop/SKILL.md:155-156` has no consumer; default mode selection at `SKILL.md:45-49` and `update-workflow.md:23` would auto-`init` on a missing docs root | source + installed |
| CP-03 | Docs work states the smallest-adequate principle: mode selection stays intent-driven, broad scopes still narrow first, and update work stays surgical on affected existing docs | modify | skill contract | none | routine — consistency with `rules/manage-docs.md` | source |
| CP-04 | The adaptive contract pair (`hapo:docs adaptive contract is complete and bounded`, `hapo:docs checker rejects semantic weakenings`) guards the invariants — evidence taxonomy, `Reconstruction Is Not Specs`, Delegation Gate, docs checkpoint, validator-before-handoff — while the twelve existing probes at `run-skill-self-tests.mjs:4578-4679` stay enforced, updated coherently with replacement mutation coverage where anchors move (probe deletion is caught by the code-review diff check, not by the proof command) | add | contract + checker | none | elevated — no mutation coverage exists today | source |
| CP-05 | Installed parity: disposable Claude and Codex copies of the docs contract reject weakenings, including when the skill arrives via the optional document bundle; guides describe the checkpoint and gate without timing or live-adherence claims | add | projection + guides | none | elevated — no docs-contract parity assertions exist today (`bin/__tests__/codex-native.test.js:2992,3010-3011` assert only catalog absence/presence; opt-in fixture precedent at `:2036`) | source + installed |

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | Where a docs workflow would delegate to `docs-keeper` or another subagent — including the reader-split table at `update-workflow.md:55-56` — the skill shall require the scout Delegation Gate's three canonical clauses and otherwise continue in the main agent. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | When a completed task hands off docs impact, the skill shall consume it as a checkpoint: `none` reports only, `minor`/`major` update only affected existing docs, no checkpoint invents a new document, and when no affected existing doc exists the checkpoint shall report the gap and recommend an explicit `/hapo:docs` invocation — overriding the default mode selection at `SKILL.md:45-49` and `update-workflow.md:23` — instead of auto-selecting `init`. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | While any docs mode runs, evidence taxonomy, the `Reconstruction Is Not Specs` gate, and validator-before-handoff shall keep their anchors present, each invariant guarded by a mutation group and at least one forbidden-pattern assertion. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-04 | When the docs contract is weakened in source, the new mutation checker shall fail with the exact owning issue while the twelve pre-existing docs probes stay enforced (coherently updated where anchors move, each with replacement mutation coverage; probe deletion is caught by the code-review diff check, not by the proof command). | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-05 | When a disposable installed copy of the docs contract is weakened (Claude projection and Codex projection, including an install that selected the optional document bundle), the matching regression shall fail with its exact issue set while canonical source bytes remain untouched. | `npm --prefix packages/spec test` |
| AC-06 | Where operators read the repository or package guides, docs usage shall describe the checkpoint and Delegation Gate without timing or live-adherence claims. | `npm --prefix packages/spec test` |

## Tasks

| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author the adaptive docs contract | AC-01–AC-04 | `skills/docs/SKILL.md`, three workflow references, static harness | - | done |
| 02 | Prove installed parity and document usage | AC-05–AC-06 | codex/package projection tests + usage guides | task-01-author-adaptive-docs-contract.md | done |

Tasks are sequential: Task 02 proves the exact contract authored by Task 01.

## Review log

- Round 1 (2026-09-01): two fresh reviewers produced 8 deduplicated findings (2 High, 6 Medium, 0 Critical). User accepted all 8 — F-08 resolved as conscious exclusions (changelogs deferred to docs-sync flow; `rules/manage-docs.md` stays the agent-responsibility surface). Both reviewers confirmed the twelve-probe inventory, all citations, checkpoint consistency with four producers, and optional-bundle feasibility via `--with-document-skills`. All repairs are packet-text edits; C1 scope unchanged. Sweep: 3 files reread / 8 deltas / 1 stale CP-04 clause fixed / 0 conflicts left.
- Round 1 closure (2026-09-01): a fresh-context reviewer replayed every original counterexample against current packet bytes — 8/8 PASS.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| F-01 | accepted → repaired | `major` checkpoint with no docs root auto-`init`s or dead-ends | plan CP-02/AC-02; task-01 AC-02 | task-01:25 escape path overriding `SKILL.md:45-49`, `update-workflow.md:23` | blocked | PASS |
| F-02 | accepted → repaired | Reader-split table dispatches 2-5 readers ungated | plan «Minimum change», CP-01, AC-01; task-01 Scope/AC-01 | plan:7 four sites incl. `update-workflow.md:55-56`, each with mutation coverage | blocked | PASS |
| F-03 | accepted → repaired | `standard-docs-workflow.md` has no delegation wording to align | task-01 Scope | task-01:12 reassigns it as the checkpoint-entry shared-contract home | blocked | PASS |
| F-04 | accepted → repaired | Probe deletion passes the proof command while "never deleted" is claimed | plan CP-04/AC-04; task-01 AC-04 | plan:27,:37 "probe deletion is caught by the code-review diff check" | blocked | PASS |
| F-05 | accepted → repaired | "Are advisory" escape passes anchor-presence checks | plan AC-03; task-01 AC-03 | task-01:26 forbidden-pattern assertion per invariant | blocked | PASS |
| F-06 | accepted → repaired | Packed fixture cannot select the document bundle | task-02 Scope | task-02:12 extend `runInstaller` (`package-inventory.test.js:330-340`; precedent `codex-native.test.js:2036`) | blocked | PASS |
| F-07 | accepted → repaired | "Zero docs assertions" misleads into colliding with `:2992` | plan CP-05; task-02 Scope/AC-05 | plan:28 corrected inventory; task-02:12 respects absent-by-default assertion | blocked | PASS |
| F-08 | revised → conscious exclusion | Changelogs and `manage-docs.md` consumers silently abandoned | plan «Out of scope» | plan:16-17 explicit deferrals with rationale | blocked | PASS |
