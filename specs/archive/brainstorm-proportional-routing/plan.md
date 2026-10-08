# Brainstorm proportional routing
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-25)

- Existing: Brainstorm already scouts before technical design, captures exact requirements, asks only material user decisions, records decision provenance, decomposes three-plus independent subsystems, and keeps its specialist advisory-only (`packages/spec/src/claude/skills/brainstorm/SKILL.md:21-53,75-85,135-139`; `packages/spec/src/claude/skills/brainstorm/references/question-framework.md:17-57,195-222`; `packages/spec/src/claude/agents/brainstormer.md:34-76`).
- Minimum change: add proportional front-door routing and field-level accepted-contract reuse; route bugs through diagnosis with explicit fix authority; make exploration chat-only by default; make alternatives, approval, and persistence conditional; derive technical touchpoints from evidence; align the specialist; prove grammatical Claude/Codex skill/reference/agent parity; and replace enough old ceremony to keep the 506-line authoring bundle ceiling.
- Expansion signals: optional HTML/advice modes, PR supervision, timing instrumentation, more than eight implementation paths, or more than three independent work groups.
- User decision: **KEEP** — implement the two-task minimum and exclude every expansion signal.

## Out of scope

- `--html`, `--advice`, Kongming/PR supervision, release/publish, or changes to `specs-session-timing-benchmark`.
- Direct Develop/Cook dispatch, implementation from Brainstorm, or migration of legacy Specs packets.
- New schemas, approval state, report registry, or a ceremonial risk matrix.

## Coverage profile

| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Brainstorm selects the proportional route and returns either a bounded delivery contract or a chat-only recommendation without unauthorized mutation. | `modify`, `fix` | workflow routing; user authority; diagnosis; approval; persistence; context load | `none` after accepted C2 repairs → proceed | `elevated` — cross-workflow/runtime contract | `source` |
| CP-02 | Codex receives grammatical, semantically equivalent Brainstorm skill, reference, and specialist-agent projections. | `modify`, `fix`, `integrate` | generic normalizer; installed skill/reference/agent; public routing docs | `none` after accepted C2 repairs → proceed | `elevated` — installed/runtime behavior with global transform blast radius | `source`, `installed` |

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the user asks for a direct factual answer, a specific command, or a different workflow, Brainstorm shall exit or route before scout/question/approval/persistence; when a same-target accepted contract exists, it shall reuse each current non-conflicting Outcome, Constraints, Non-goals, and Acceptance field and ask only for material missing or stale fields. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | If a request is a bug or failure, Brainstorm shall frame repaired behavior and evidence, route to Debug until root cause is established, compare 2–3 cause-aligned remedies only when a material choice remains, and hand off to Hotfix only when the user explicitly requested a fix; diagnosis-only work shall report and stop. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | When the user wants feature/docs delivery, Brainstorm shall prepare context for a new explicit Specs invocation; when the user wants non-bug product/architecture exploration only, it shall return a chat recommendation without approval, persistence, or downstream handoff; bug/failure diagnosis-only work shall follow AC-02 through Debug and then stop; Brainstorm shall never invoke Develop. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-04 | Where a material design choice has at least two viable paths, Brainstorm shall compare 2–3 distinct approaches; otherwise it shall state why one direct path is sufficient without inventing alternatives. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-05 | When producing a delivery design, Brainstorm shall derive technical touchpoints from scout evidence, ask only blocking user-owned decisions, run the 4-point review before presentation, request one final approval by default, require an explicit section decision for critical auth/secrets/privacy, destructive/data-loss, money/privilege/safety, or production-mutation boundaries, and persist only approved content with user authority at the configured report path when continuity requires it. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-06 | When Brainstorm sources are projected into Codex, the installed skill, question reference, and `brainstormer` agent shall remain semantically equivalent and grammatical across structured-input determiner contexts, with no doubled article or Claude-only `AskUserQuestion` token. | `npm --prefix packages/spec test` |
| AC-07 | If a routing, authority, approval-order, handoff, decision-provenance, option-cardinality, context-budget, or projection invariant is weakened in a disposable test copy, a named mutation/parity probe shall fail while unrelated normalized inputs and the full runtime/legacy regression remain green. | `npm --prefix packages/spec test` |
| AC-08 | While adding proportional routing, the tracked Brainstorm skill, question reference, and specialist agent shall total at most 506 lines, and documentation shall claim only structural context reduction rather than measured wall-clock improvement. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |

## Tasks

| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author the proportional Brainstorm contract | AC-01–AC-05, AC-07–AC-08 | Brainstorm skill/reference/agent + static contract probes | none | done |
| 02 | Prove Codex projection and installed parity | AC-06–AC-07 | Codex normalizer/native tests + conditional routing docs | `task-01-author-proportional-brainstorm-contract.md` | done |

Tasks are sequential because Task 02 proves the exact contract authored by Task 01. The timing packet and generated local runtime copies are not owned by either task.

## Review log

- Round 1: two fresh reviewers produced F-01–F-12; user accepted all on 2026-08-25. Repairs: F-01 status lifecycle; F-02 CP mapping; F-03 direct precedence; F-04 field provenance/freshness; F-05 fix authority; F-06 exploration stop; F-07 option cardinality; F-08 critical section gate; F-09 agent parity; F-10 normalizer blast radius; F-11 public docs ownership; F-12 506-line ceiling.
- Round 2: projection reviewer replayed 5/5 boundaries PASS; flow reviewer replayed 8/9 PASS and found one overlap between bug diagnosis and generic exploration. Consistency repair gives every bug/failure AC-02 precedence and limits AC-03 exploration-only to non-bug product/architecture work. No third paper-review round.
- Final sweep: 3/3 packet files reread; 8/8 ACs and 2/2 CP rows mapped; exact dependency basename exists; statuses promoted to `pending` after all non-dependency blockers closed; zero stale route terms or unresolved contradictions.
- **C3: ACCEPTED by the user on 2026-08-25.** Completion covers the verified `brainstorm-proportional-routing` scope above; live-model adherence and wall-clock generation timing remain explicitly unclaimed, and `docs/.sync_hash` remains post-source-commit delivery metadata.
