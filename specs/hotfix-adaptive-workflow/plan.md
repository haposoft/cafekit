# Hotfix adaptive workflow
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-30)

- Existing: `hapo:hotfix` v1.0.0 is a 300-line six-step skill with six references (512 lines total) and seven static contract tests (`packages/spec/scripts/run-skill-self-tests.mjs:3489-3498,3517-3555`). Its root-cause contract (`packages/spec/src/claude/skills/hotfix/SKILL.md:149-157`) predates the adaptive debug handoff shipped in commit `19f1bb3`; `references/diagnosis-protocol.md` has zero occurrences of `Trigger`, `Contributing factors`, `Evidence Timeline`, or `Elimination Path`; `references/review-cycle.md:7` uses the legacy three-value verdict enum; `SKILL.md:245` emits a numeric confidence score; the subagent table (`SKILL.md:266-279`) spawns `Explore`/`implementer` without the scout Delegation Gate; Step 3 couples to `TaskCreate`/`TodoWrite` (`SKILL.md:173-176`).
- Minimum change: remake `SKILL.md` to the 2026 wave standard — consume the adaptive debug handoff, add proportional depth aligned with debug's Quick/Incident vocabulary, adopt the shared verdict surface `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`, remove the numeric confidence score and hard task-tool coupling, route delegation through the scout Delegation Gate, and rewrite emphasis-heavy prose at normal volume. Update the four references that carry stale content (`diagnosis-protocol.md`, `review-cycle.md`, `parallel-patterns.md`, `prevention-gate.md`), extend the static harness with an adaptive hotfix contract plus mutation checker, and prove installed parity and guide coverage.
- Expansion signals: none — one subsystem; reference consolidation was explicitly declined at C1.
- User decision: **KEEP** — remake to wave standard; keep the six-step frame, the side-effect gate, and the current reference file layout.

## Out of scope

- Merging, splitting, or renaming reference files; renaming the skill.
- Changes to `debug`, `develop`, `test`, `code-review`, `scout`, or `sync` skills, hooks, installer, or runtime scripts.
- Legacy `spec.json` packets and their adapters.
- An `--advice` advisory overlay (absorbed by Brainstorm v3; model-escalation remains deferred to Wave 3).
- Live-model adherence claims; static checks prove the written contract only.
- `cafekit-web` docs pages and skill-detail content for hotfix — conscious exclusion: current content is depth-agnostic with no material drift (`cafekit-web/src/components/docs/skill-detail-content-en.ts:92-102`); refresh is deferred to the post-implementation docs-sync flow.

## Coverage profile

| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Hotfix consumes the adaptive debug handoff: the root-cause contract includes `Trigger` and `Contributing factors`, and `--from-debug` validates `Evidence Timeline` (or its skipped-reason), `Elimination Path`, and `Recurrence-Prevention Handoff` when present | modify | skill contract + cross-skill handoff | none | elevated — debug contract changed in `19f1bb3`; consumer is stale (`SKILL.md:149-157`) | source + installed |
| CP-02 | Proportional depth uses debug-aligned vocabulary: quick/local work skips incident ceremony; incident/deep work consumes the full handoff; depth never skips scout, diagnosis, or before/after proof | modify | skill contract | none | elevated — current Trivial/Standard/Complex table (`SKILL.md:164-178`) is disconnected from debug depth | source |
| CP-03 | Verification and review reporting uses the shared verdict surface with no numeric confidence score; completion requires fresh command output | modify | skill contract | none | elevated — `SKILL.md:245` score; `review-cycle.md:7` legacy enum | source + installed |
| CP-04 | Delegation (parallel scouts, parallel fixes) passes the scout Delegation Gate; task-tool use is optional fallback, not a required step | modify | skill contract | none | elevated — `SKILL.md:145,206-210,266-279` spawn without the gate (`:200` is already gate-conditioned) | source |
| CP-05 | The seven existing static contracts stay enforced — updated coherently with replacement mutation coverage where retoned wording moves their anchor strings, never deleted or weakened — prose moves to normal volume, and the new invariants gain a mutation checker in both Claude and Codex projections | modify | contract + checker + projection | none | elevated — seven tests at `run-skill-self-tests.mjs:3489-3498,3517-3555`; no hotfix projection assertion exists yet (`bin/__tests__/codex-native.test.js:823` is a Brainstorm bug-routing assertion that stays unchanged) | source + installed |

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When `--from-debug` receives an adaptive debug report, hotfix shall validate the full current root-cause contract (including `Trigger` and `Contributing factors`) and shall reject a report that lacks it instead of implementing. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | When hotfix reports fix verification or review results, it shall use `PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED`, shall not emit a numeric confidence score, shall route `PASS_WITH_WARNINGS` through the same remediation/user-pause path as `FAIL` (never auto-accept), and shall defer the definition of `PASS` to `hapo:code-review`. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | If verification reveals a side effect or regression, hotfix shall stop and present 2–4 concrete user options, unchanged from the current gate. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-04 | Where a fix workflow would delegate to subagents, hotfix shall require the scout Delegation Gate conditions and otherwise continue in the main agent. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-05 | When the adaptive hotfix contract is weakened in source or in disposable installed copies, mutation checks shall fail in both Claude and Codex projections while the seven pre-existing hotfix contracts stay enforced (coherently updated where anchors move, each with replacement mutation coverage). | `npm --prefix packages/spec test` |
| AC-06 | Where operators read the repository or package guides, hotfix usage shall describe the adaptive workflow without inventing timing or live-adherence claims. | `npm --prefix packages/spec test` |

## Tasks

| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author the adaptive hotfix contract | AC-01–AC-04, static half of AC-05 | `skills/hotfix/SKILL.md`, four stale references, static harness | - | done |
| 02 | Prove installed parity and document usage | AC-05–AC-06 | codex/package projection tests + usage guides | task-01-author-adaptive-hotfix-contract.md | done |

Tasks are sequential: Task 02 proves the exact contract authored by Task 01.

## Review log

- Round 1 (2026-08-30): two fresh reviewers produced 10 deduplicated findings (1 Critical, 3 High, 6 Medium). User accepted F-01–F-09 — with F-03 resolved as "probes may be updated coherently with replacement mutation coverage" — and resolved F-10 as a conscious `cafekit-web` exclusion. All repairs are packet-text edits; C1 scope unchanged. Sweep: 3 files reread / 10 deltas / 1 stale reference fixed / 0 conflicts left.
- Round 1 closure (2026-08-30): a fresh-context reviewer replayed every original counterexample against current packet bytes — 10/10 PASS.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| F-01 | accepted → repaired | 7th probe (`run-skill-self-tests.mjs:3489-3498`) turns proof red, unowned | plan «Existing», CP-05, AC-05; task-01 Scope/AC-05 | task-01:29 names the `:3489-3498` probe update with replacement coverage | blocked | PASS |
| F-02 | accepted → repaired | "Update" of Brainstorm-owned `codex-native.test.js:823` | plan CP-05; task-02 AC-05 | task-02:23 ":823 … stays unchanged; parity checks are new additions" | blocked | PASS |
| F-03 | accepted → repaired | Retone kills byte-exact probe anchors while "tests stay green" | plan CP-05, AC-05; task-01 Scope/AC-05 | plan.md:28 "updated coherently with replacement mutation coverage … never deleted or weakened" | blocked | PASS |
| F-04 | accepted → repaired | Valid quick report `Timeline: skipped - …` bounced forever | task-01 AC-01 | task-01:25 accepts both producer skipped forms | blocked | PASS |
| F-05 | accepted → repaired | `PASS_WITH_WARNINGS` undefined branch / dual PASS definitions | plan AC-02; task-01 AC-02 | plan.md:35 routing clause + PASS deferred to `hapo:code-review` | blocked | PASS |
| F-06 | accepted → repaired | Quick report without recurrence content deemed incomplete | task-01 AC-01 | task-01:25 "— when present — `Recurrence-Prevention Handoff`" | blocked | PASS |
| F-07 | accepted → repaired | Own-wording gate lets scope-count weakening pass | task-01 AC-04 | task-01:28 three canonical clauses from `internal-inspection.md:10-13` | blocked | PASS |
| F-08 | accepted → repaired | Weakened side-effect check stays green under static proof | task-01 AC-03 | task-01:27 five checks = five explicit mutation anchors | blocked | PASS |
| F-09 | accepted → repaired | Implementer "fixes" gated `:200`, leaves ungated `:145` | plan CP-04 | plan.md:27 "`SKILL.md:145,206-210,266-279` … (`:200` is already gate-conditioned)" | blocked | PASS |
| F-10 | revised → conscious exclusion | `cafekit-web` consumer silently abandoned | plan «Out of scope» | plan.md:18 exclusion bullet with `skill-detail-content-en.ts:92-102` evidence | blocked | PASS |
- Post-C3 (2026-08-30): the public skill name was renamed `hapo:hotfix` → `hapo:fix` outside this packet (breaking, no alias; payload directory stays `hotfix`). The rename invalidated the tasks' named probes; the user re-approved the updated Verification Plans and both tasks were re-closed with fresh receipts at the renamed contract (static 420, full suite 1022, checker 28 mutations). Historical receipts are retained as non-authoritative.
