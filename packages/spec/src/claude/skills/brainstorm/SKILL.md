---
name: cf:brainstorm
description: "Shape an unsettled piece of work into a decided one before anyone builds it. Use when the outcome is already agreed but two or more approaches would each satisfy it with meaningfully different consequences — setup cost, migration, failure behaviour, who carries the work afterwards; use it too when an idea still wants exploring, or when only one approach is viable but the contract and the candidate design still need a decision. It weighs viable approaches against a bounded contract of Outcome, Constraints, Non-goals and Acceptance, records what was chosen and what was rejected and why, and stops there; it writes no code and carries nothing onward by itself. Skip it for a direct factual answer, skip it for a bug or failure that still needs its root cause, and skip it when the request needs a plan and its tasks rather than a choice between designs."
user-invocable: true
when_to_use: "Use when an outcome is agreed and designs compete, an idea wants exploring, or a candidate needs a decision; skip direct factual answers, undiagnosed bugs, and requests that need a plan and its tasks."
category: utilities
keywords: [ideation, tradeoffs, decisions, scope]
argument-hint: "<idea_or_problem>"
metadata:
  author: haposoft
  version: "3.0.0"
---
# Brainstorm — proportional pre-delivery design

Turn unresolved intent into a bounded contract without turning clear work into
an interview. `cf:brainstorm` owns the workflow; `brainstormer` is an optional
specialist for real architectural trade-offs.

<HARD-GATE>
Brainstorm never writes implementation, invokes Develop, or treats approval as
implementation authority. Feature or documentation delivery may prepare context
for a new explicit `cf:specs` invocation; it never starts Specs implicitly.
</HARD-GATE>

## Control flags

Parse controls only from the leading consecutive token segment. Accept
`--deep`, `--visual`, and `--advice` in any order, each at most once. `--` ends
the control segment. After it or the first content token, every token is user
content. An unknown or duplicate `--*` inside the leading segment returns usage
and performs no scout, question, tool call, write, or workflow action.

Parsing identifies controls but does not apply them. Route Direct first, then
apply controls only to requests that remain in Brainstorm. `--deep` may raise
non-direct analysis depth but never lower a gate; `--visual` changes presentation
only; and no control grants persistence, approval, dispatch, or implementation
authority. Use `-- --dry-run` when literal flag-like content leads the prompt.

## Front-door routing — before scout or questions

Classify intent first. This routing never waives safety or permission rules.

1. **Direct request:** for a factual answer, a specific command, or an explicitly
   different workflow, leave Brainstorm before scout, questions, approval, or
   persistence. Read-only product or architecture exploration is not direct merely
   because it writes no files.
2. **Hydrate the contract, then keep routing:** for every request that remains,
   reuse accepted Outcome, Constraints, Non-goals, and Acceptance field by field
   only when current user text or an approved artifact binds them to the same
   target and revision. Preserve current non-conflicting fields; treat missing,
   stale, or conflicting fields as gaps. Never infer approval. Hydration is not a
   terminal route; continue to exactly one intent route below.
3. **Bug or failure:** before diagnosis, capture the repaired-behavior Outcome,
   Constraints, Non-goals, and Acceptance evidence. Then use `cf:debug` until
   root cause is evidenced. Do not brainstorm fixes from a symptom. If at least
   two cause-aligned remedies remain, compare 2–3 here. Hand off to `cf:fix`
   only when the user explicitly requested a fix; diagnosis-only work returns the
   root-cause report and stops.
4. **Non-bug exploration only:** inspect enough evidence, give a chat
   recommendation, and stop. Do not request design approval, persist a report, or
   invoke another workflow without a new explicit request.
5. **Feature or documentation delivery:** continue through the design workflow.

## Adaptive analysis depth

For every non-direct request, choose the smallest adequate depth from current
evidence and material risk:

- **Standard:** bounded single-surface work with no material risk signal.
- **Deep:** critical safety/security risk; public compatibility or data migration;
  cross-service state or concurrency; costly or irreversible rollback; or
  unresolved feasibility at a material boundary.
- With no Deep signal, use Standard. `--deep` raises Standard to Deep. If three
  or more subsystems are independently deliverable, split them instead of using
  Deep as a monolithic substitute.

Deep is selective, not a checklist. Apply a lens only when its trigger is
present and otherwise record `skipped: <reason>`: feasibility for an unresolved
material boundary; stakeholders for externally affected roles; system boundaries
for cross-component state; failure isolation for partial or cascading failure
across boundaries; reversibility and recovery for costly or irreversible failure;
operability for runtime ownership; migration/rollback for data or public
compatibility; testability for a material proof gap; and second-order effects
for downstream behavior or incentives.

## Contract and evidence

For feature/docs delivery and every bug/failure, resolve four user-owned fields:

- **Outcome:** observable end state.
- **Constraints:** safety, compatibility, time, technology, and ownership limits.
- **Non-goals:** nearby work excluded from this delivery.
- **Acceptance:** observable evidence that proves completion.

After front-door routing, run `cf:scout` or a narrow equivalent before
technical design. Inspect relevant modules, patterns, docs/plans, contracts, and
runtime constraints; summarize only useful findings in 3–6 bullets.

For supplied images, video, PDFs, or mockups, use `cf:ai-multimodal` when the
optional document bundle is installed; otherwise use the runtime's available
multimodal capability or report the evidence gap. Add a diagram only when it
clarifies a material choice or flow.

Derive technical touchpoints from repository evidence. Ask the user about a
touchpoint only when its ownership or scope boundary is a product decision that
cannot be discovered. Keep intent separate from current-state evidence.

On every route, keep feasibility (`confirmed | plausible | unknown |
infeasible`), confidence (`high | medium | low`), and disposition (`chosen |
rejected | deferred`) separate and cite evidence or basis. Missing evidence
forces feasibility `unknown` and confidence `low`. A numeric estimate requires
range, unit, basis, evidence, and assumptions; otherwise report `unknown`.

If the request spans three or more independently deliverable subsystems, split
it. A subsystem is independent only when its outcome, boundary, and verification
or deployment path can move through the lifecycle separately.

## Discovery Question Framework

Load `references/question-framework.md` before the first discovery question.
Generate questions from scout evidence, user intent, contract gaps, applicable
domain guidance, and risk surfaces. Never ask the user for a technical fact that
code, docs, or trusted current research can answer.

Use the runtime's native structured user-input tool when available. Ask one
highest-impact question by default; batch at most three independent questions
only when none depends on an earlier answer. Record confirmed decisions,
assumptions, and open questions separately in the decision register.

Stop asking when remaining details have safe implementation defaults. Do not
force questions merely to consume a budget.

## Options and specialist use

A material design choice exists only when at least two viable paths would satisfy
the contract with meaningfully different consequences.

- For a material choice, compare 2–3 mechanically distinct viable approaches by
  setup cost, runtime complexity, maintenance, UX/DX, compatibility/migration,
  risk, and time-to-value.
- With one viable path, present it and explain briefly why alternatives would be
  artificial or fail the contract. Never create strawman options.
- Recommend the smallest path that satisfies the contract.

Call `brainstormer` only for a material architectural choice that benefits from
deeper pressure-testing. Use researcher only for current external facts the
repository cannot establish. The controller remains responsible for questions,
approval, persistence, and handoff.

`--visual` may present inline Mermaid or ASCII for any non-direct analysis and
falls back to equivalent text when rendering is unavailable. Durable or external
rendering requires explicit user authority before invocation. `--advice` invokes
`brainstormer` only after the material-choice gate; if advice is unavailable or
fails, label it unavailable and continue with controller analysis. Before an
external visual tool or adviser handoff, minimize context and redact secrets,
credentials, private keys, access tokens, and unnecessary PII. Neither overlay
writes, approves, persists, dispatches, or completes work.

## Delivery design and approval

For feature or documentation delivery:

1. Draft one coherent candidate scaled to the work: architecture, data flow,
   interfaces/UX, error behavior, verification, and rollout only when material.
2. Run the internal 4-point review before presentation:
   - remove placeholders and vague instructions;
   - reconcile contradictory behavior;
   - remove scope creep;
   - make observable behavior and proof concrete.
3. Present the reviewed candidate.
4. Before final approval, require a separate explicit section decision when
   the design changes auth/secrets/privacy, destructive or irreversible behavior
   or data-loss risk, money/privilege/safety, or production-state mutation.
5. After critical section decisions and revisions, request one final approval by
   default.

Revise material disagreement before handoff. An already accepted, current
contract is not re-approved unless new evidence changes it.

## Persistence and handoff

Persist only approved decisions and semantics, only with user authority, and
only when they must survive the session or feed Specs. Use the repository's
configured report path and naming convention. Do not create a report merely to
satisfy this skill. Before writing, redact live secrets, credentials, private
keys, access tokens, and unnecessary PII; preserve exact approved meaning with a
safe placeholder and ownership reference instead of copying the sensitive value.

The default handoff stays in chat Markdown. Use these exact headings:
`Target and evidence freshness`, `Outcome`, `Constraints`, `Non-goals`,
`Acceptance`, `Touchpoints`, `Direction and alternatives`, `Relevant impacts
and failure behavior`, `Rollout and recovery`, `Proof mapping`, `Decision
register`, `Assumptions`, and `Open questions`. The first section records target
identity, current source revision and worktree state or `[UNVERIFIED]`, an
evidence-as-of value, and what change invalidates the brief. Durable file output
requires explicit authority and creates no readiness, approval, proof, or
execution state.

- Feature/docs delivery: provide the approved summary and ask the user to invoke
  `cf:specs` explicitly in a new request.
- Diagnosed bug: follow the fix-authority rule in front-door routing.
- Non-bug exploration: recommendation already returned in chat; stop.

## Completion bar

Brainstorm is complete when the selected route is explicit, current evidence is
separated from intent, every material user-owned gap is resolved or named, and
the route-specific output has been returned without unauthorized persistence or
implementation. Never claim live behavior from this written contract alone.
