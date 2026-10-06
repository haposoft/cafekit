# Brainstorm Question Framework

Use this reference to ask the smallest set of questions that can materially
change the selected route or design. It does not override front-door routing in
`cf:brainstorm`.

## Contract gaps and accepted decisions

The four user-owned contract fields are Outcome, Constraints, Non-goals, and
Acceptance. Evaluate them independently:

- Reuse a field only when current user text or an approved artifact binds it to
  the same target and revision.
- Preserve a current non-conflicting field; do not ask the user to repeat it.
- Treat a missing, stale, or conflicting field as unresolved and ask only when
  it materially changes scope, safety, public behavior, or proof.
- Never convert an assumption or old “approved” label into user acceptance.
- Hydration never selects the route; classify the remaining request afterward.

Technical touchpoints are evidence, not a fifth user-owned field. Derive paths,
modules, schemas, APIs, and conventions from scouting; ask only when ownership or
scope is genuinely a user decision.

## Source hierarchy

Generate candidates in this order:

1. Scout evidence: relevant code, docs, specs, plans, runtime, and constraints.
2. User intent: outcome language, target users, examples, and delivery format.
3. Missing or conflicting contract fields.
4. Applicable Domain Matrix entries.
5. Applicable risk surfaces.

Never ask a question the repository, docs, or trusted technical research can
answer directly.

## Ask / Do Not Ask

Ask when the answer changes:

- outcome, MVP boundary, non-goal, or acceptance evidence;
- target user workflow, UX surface, or output artifact;
- business priority, rollout, cost, privacy, provider/key ownership;
- an irreversible workspace action or a public compatibility contract;
- acceptance of a material trade-off after its consequences are explained.

Do not ask for technical facts such as current code locations, schema shape,
runtime/browser limits, package/API compatibility, dependency state, security
practice, or framework syntax. Verify first, then ask only the remaining product
or trade-off decision.

## Prioritization

Score candidate questions before asking:

| Signal | Score |
|---|---:|
| Changes architecture, data model, platform, scope, privacy, security, or compliance | +3 |
| Defines acceptance, primary flow, or user-visible output | +2 |
| Answerable from code, docs, or research | -4 |
| Safe implementation default only | -2 |

Ask the highest-impact question. Batch at most three tied, independent questions;
otherwise ask one. Stop when the next answer would not change the contract.

## Domain Matrix

Use only matching domains. These are prompts for material gaps, not a checklist.

### Product / UX

- Primary user and shortest successful flow?
- Surface and loading/empty/error/partial/retry states?
- Accessibility, localization, responsive, or native constraints?

### Browser Extension

- Browser/manifest target, UI surface, permission posture, storage, publishing?
- Verify service-worker lifetime, shortcut conflicts, execution worlds, and API
  compatibility rather than asking the user.

### AI / LLM

- Provider/key ownership, output contract, failure/fallback, cache, privacy?
- Verify endpoint/auth shape, tool/schema/streaming support, and provider
  compatibility rather than asking the user.

### Data / Documents / Media

- Source priority, output format/fidelity, unknown/confidence handling, export?

### Backend / API / Database

- Public request/response behavior, identity/permissions, persistence,
  idempotency/retry, migration and rollback?

### Docs / Legacy Reconstruction

- Scope, required artifacts, allowed inference/evidence level, human review,
  and whether a later change request is separate?

### Release / Packaging

- Channel, version intent, required checks, metadata ownership, rollback?

## Risk surfaces

Raise only risks that can change the contract or approval path:

- **Critical section decision:** auth/secrets/privacy; destructive/irreversible
  behavior or data loss; money/privilege/safety; production-state mutation.
- **Other material risks:** external-provider failure, cost limits, migration,
  compatibility, concurrency, compliance, maintainability, or unavailable proof.

Explain the verified risk and viable consequences before asking. Do not create a
ceremonial risk matrix.

## Evidence calibration

Keep these independent in every recommendation:

- **Feasibility:** `confirmed | plausible | unknown | infeasible`.
- **Confidence:** `high | medium | low`.
- **Disposition:** `chosen | rejected | deferred`.

Every value cites its repository/current-research evidence or stated basis.
Missing evidence forces feasibility `unknown` and confidence `low`; it never
becomes a confident guess. A numeric estimate is valid only with range, unit,
basis, evidence, and assumptions. Otherwise write `unknown`, not a factual
number. Record why an inapplicable Deep lens was skipped so selective analysis
is auditable without forcing ceremony.

## Question format

Use the runtime's native structured user-input tool when available.

- Give 2–4 concrete options and put the recommended one first.
- Explain one consequence per option; do not use abstract “Option A” labels.
- Do not add an explicit Other choice when the runtime supplies it.
- If the user cannot know a hidden technical fact, explain it before asking.

## Decision Register

For a durable delivery summary, record only decisions actually made:

| ID | Question | Options | User Decision | Rationale | Impact |
|---|---|---|---|---|---|
| D-001 | <material choice> | <options shown> | <confirmed answer> | <why> | <effect> |

- Do not write "user selected" unless direct user text or the native input tool
  confirms it.
- Label inferred defaults as `Assumption`, not `User Decision`.
- Carry truly blocking unknowns into `Open Questions`; defer safe defaults.

## Question budget

- Small change: usually 1–2.
- Medium feature: usually 3–6.
- Large or architecture-heavy work: usually 6–10 across rounds.

Budgets are ceilings, not targets. Non-bug exploration may need no approval
question; an accepted contract may need only one missing-field question.

## Final self-check

- Did direct routing happen before scout and questions?
- Is each question tied to a user-owned contract field or material risk?
- Were technical facts discovered instead of delegated to the user?
- Are decisions, assumptions, and open questions separated?
- Would another question materially change the outcome?
