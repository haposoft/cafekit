# Reconstruct Workflow

Use this reference for `/cf:docs --reconstruct <scope>`.

## Goal

Rebuild current-state, as-is system documentation from source code.

This is useful for:

- existing systems with weak or missing documentation
- legacy system modernization discovery
- sales demos showing source-code-to-docs capability
- preparing a reviewed baseline before `/cf:specs` creates modernization/change specs

## Non-Goal

This workflow does not produce future design, implementation tasks, rewrite plans, or product code.

It answers:

```text
What does the current system appear to do, based on evidence?
```

It does not answer:

```text
What should the future system do?
```

## Output Contract

Write output under:

```text
docs/as-is/<scope-slug>/
```

Files:

```text
overview.html
reconstruction.json
system-overview.md
requirements-as-is.md
roles-and-permissions.md
entities-and-statuses.md
business-rules.md
integrations.md
architecture-c4.md
constraints-risks-and-decisions.md
glossary.md
evidence-map.md
unknowns-and-assumptions.md
```

If the user provides a different docs root through `.claude/runtime.json`, use that root.

Use the bundled templates as output starters:

- `templates/reconstruction.json`
- `templates/requirements-as-is.md`
- `templates/evidence-map.md`
- `templates/unknowns-and-assumptions.md`
- `templates/reconstruct-overview.html`

`overview.html` is a self-contained visual review surface. Markdown and JSON remain the source of truth.

## Required Classification

Every major finding must include:

```text
Type: Observed | Inferred | Unknown
Confidence: High | Medium | Low
Evidence:
- path/to/file.ext
- path/to/file.ext:functionOrClass
- path/to/test.spec.ts
```

Use line numbers when available from reads. If exact line numbers are not available, cite file paths and symbols.

## Reconstruction Reader Model

Reconstruction is written for two readers:

1. a domain reviewer who can confirm or reject recovered behavior
2. a future `cf:specs` run that needs an approved as-is baseline before change design

Write each document so those readers can separate:

- current behavior visible from source
- behavior inferred from multiple code signals
- missing business context only humans or runtime evidence can supply

## Evidence Quality

High confidence:
- directly found in route/controller/component/schema/test/config
- supported by at least one source file and one behavior signal

Medium confidence:
- supported by multiple related source signals, but no explicit test or end-to-end path

Low confidence:
- suggested by naming, partial code, comments, or incomplete references

Unknown:
- not enough evidence
- code path is dead or unreachable
- behavior depends on runtime data, external service, manual operation, or undocumented configuration

## Evidence Ledger

Build an evidence ledger before writing conclusions. An evidence row should capture:

| Field | Meaning |
|---|---|
| ID | Stable evidence ID such as `E-API-003` |
| Surface | UI, API, data, auth, job, integration, test, config |
| Source | File path and symbol/route/schema/test |
| Observation | What the source directly proves |
| Related behavior | Requirement/business rule/entity it may support |
| Confidence | High, Medium, Low |
| Gap | Missing trigger, runtime data, customer rule, or external system |

Write the human-readable ledger into `evidence-map.md`. Reference evidence IDs from reconstructed requirements and supporting docs when a requirement needs multiple sources.

## Workflow

### 1. Scope Gate

If `<scope>` is missing, ask for a module or bounded context.

If `<scope>` is broad (`.`, `/`, `whole repo`, `entire system`):

1. Run a structure scout first.
2. Identify 2-6 candidate modules.
3. Ask the user to choose, unless one module is clearly requested by the prompt.

Never silently reconstruct a large system as one flat document.

### 2. Structure And Source Scout

Use `cf:scout` patterns or targeted reads to identify:

- project type and language/framework
- relevant screens/pages/routes
- API endpoints/controllers
- database schemas, migrations, models, entities
- state machines/status fields/enums
- validation logic
- permission/auth checks
- tests and fixtures
- integrations, workers, jobs, cron, queues, webhooks
- existing docs that may be stale or useful

Use existing docs only as leads until source evidence confirms them.

Save detailed scout findings and evidence IDs in:

```text
docs/as-is/<scope-slug>/evidence-map.md
```

### 3. Trace Behavior Surfaces

Recover behavior by tracing reachable source surfaces:

| Surface | Questions to answer |
|---|---|
| UI/screens | What actor sees, starts, filters, updates, downloads |
| API/routes | What operations exist, inputs accepted, outputs/errors returned |
| Data/schema | What entities, fields, statuses, relations, constraints exist |
| Auth/permissions | Who can access which route/action/record |
| Business rules | What validation, calculations, branching, lifecycle rules exist |
| Background work | What jobs, events, queues, schedulers, hooks run |
| Integrations | What external services, files, webhooks, mailers, payments exist |
| Tests | What intended behavior is asserted and what gaps remain |

Prefer end-to-end traces that connect entry point, rule, state change, and output. When a trace is incomplete, keep the gap in the evidence ledger and unknowns list.

### 4. Reconstruct As-Is Requirements

Write `requirements-as-is.md` using current behavior only.

Recommended shape:

```markdown
## R-ASIS-001: <current behavior>
- Type: Observed
- Confidence: High
- Evidence:
  - E-API-003 — src/...
  - E-TEST-004 — tests/...
- Actors:
  - ...
- Trigger:
  - ...
- Current outcome:
  - ...
- Exceptions or gaps:
  - ...
- Notes:
  - ...
```

Requirements should be singular, testable, and tied to code evidence.

Do not use future-tense language such as "will", "should", or "must be improved" unless quoting existing source docs.

Recommended extraction checklist:

1. Identify actor or caller.
2. Identify trigger and source entry point.
3. Identify input, validation, state read/write, output, and error behavior.
4. Link entity/status/permission/integration evidence.
5. Mark requirement `Observed` only when its current behavior is directly supported.
6. Move uncertain policy intent to `unknowns-and-assumptions.md`.

### 5. Reconstruct Supporting Docs

`system-overview.md`:
- scope summary
- actor summary
- module boundaries
- primary runtime entry points

`roles-and-permissions.md`:
- roles
- allowed/blocked actions
- permission checks and evidence
- unauthenticated/authenticated boundaries when visible

`entities-and-statuses.md`:
- entities/models
- important fields
- statuses/enums
- state transitions

`business-rules.md`:
- validations
- calculations
- branching conditions
- lifecycle rules
- non-obvious defaults and side effects

`integrations.md`:
- external APIs
- email/SMS/payment/file import/export
- batch/cron/queue/webhook behavior

`architecture-c4.md`:
- C4-style textual diagrams or Mermaid diagrams if useful
- system context
- container/component view for the selected scope
- runtime/deployment notes only when source evidence exists

`constraints-risks-and-decisions.md`:
- technical and business constraints observed in source/config
- recovered quality risks or technical debt that affect modernization review
- architecture decisions with rationale only when evidence exists
- explicitly unknown rationale when code shows the decision but not the reason

`glossary.md`:
- domain terms found in screens, schemas, routes, jobs, and tests
- source vocabulary aliases or unclear terms needing reviewer correction
- status/role labels that a reviewer should normalize before specs

`unknowns-and-assumptions.md`:
- uncertain areas
- inferred behavior needing human confirmation
- missing environment/runtime/data dependencies
- interview questions for customer/domain expert

### 6. Cross-Document Consistency Review

Before declaring the bundle ready for review:

1. Check that each as-is requirement has evidence or is explicitly unknown.
2. Check that actors in requirements appear in roles/permissions or unknowns.
3. Check that statuses and transitions match schemas/enums/rules found.
4. Check that integrations listed in requirements appear in `integrations.md`.
5. Check that architecture claims do not exceed evidence scope.
6. Move future ideas and requested changes out of as-is docs.

### 7. Build `overview.html`

Generate `overview.html` from the reconstruct overview template after the markdown bundle has enough evidence to summarize:

- scope, source revision, generated time, review status
- observed/inferred/unknown counts
- actor/module/external-system overview
- recovered requirement cards with evidence IDs
- entity/status summary
- business rule/integration summary
- human review queue and evidence trace

Do not put unique facts only in HTML. Every overview claim must be traceable to markdown/JSON evidence.

### 8. Build `reconstruction.json`

Use this machine-readable summary:

```json
{
  "scope": "<scope>",
  "generated_at": "<ISO timestamp>",
  "status": "draft",
  "docs_root": "docs/as-is/<scope-slug>",
  "source_revision": "<git commit or unavailable reason>",
  "source_branch": "<branch or unavailable reason>",
  "evidence_policy": "observed-inferred-unknown",
  "review_gate": "human_review_required",
  "review_status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "approved_for_specs": false,
  "source_scope": [
    "<scope>"
  ],
  "documents": [
    "overview.html",
    "system-overview.md",
    "requirements-as-is.md",
    "roles-and-permissions.md",
    "entities-and-statuses.md",
    "business-rules.md",
    "integrations.md",
    "architecture-c4.md",
    "constraints-risks-and-decisions.md",
    "glossary.md",
    "evidence-map.md",
    "unknowns-and-assumptions.md"
  ],
  "counts": {
    "requirements": 0,
    "evidence_items": 0,
    "observed": 0,
    "inferred": 0,
    "unknown": 0,
    "open_unknowns": 0
  },
  "next_recommended_step": "human_review"
}
```

If Git revision data is unavailable, record an explicit reason in `source_revision` instead of leaving the source snapshot blank.

### 9. Validate Bundle

Run the deterministic gate before human review:

```text
node .claude/scripts/validate-docs-reconstruct.cjs docs/as-is/<scope-slug>
```

Validator failure blocks the handoff. Fix:

- missing bundle files
- incomplete `reconstruction.json` registry/review metadata
- requirements missing type/confidence/evidence IDs
- evidence IDs missing from `evidence-map.md`
- overview output missing its review-surface marker

### 10. Human Review Gate

End with a clear review prompt:

- confirm observed requirements
- correct inferred behavior
- answer unknowns
- add business rules that are not present in code

Do not recommend `/cf:develop`.

Do not call the output approved until human review has resolved high-impact inferred and unknown behavior.

Recommended handoff after review:

```text
/cf:specs <modernization/change request based on approved docs/as-is/<scope-slug>>
```

## Guardrails

- Do not invent missing behavior.
- Do not collapse `Inferred` into `Observed`.
- Do not omit unknowns to make the report look complete.
- Do not describe future improvements inside as-is docs.
- Do not create tasks or implementation plans.
- Do not read ignored/generated/sensitive paths such as `.git`, `node_modules`, `dist`, `build`, `.next`, `coverage`, `.env`, secrets, or private dumps.
- Do not trust stale docs without source verification.
- Do not use route names, enum names, or comments alone to claim business intent when rule execution is not traced.
- Do not treat HTML as source of truth; it is a visual layer over evidence-backed docs.

## Best-Practice Basis

Apply:

- Docs as Code: commit docs with source.
- C4: capture architecture at the right abstraction level.
- arc42: preserve context, building blocks, runtime behavior, risks, and decisions.
- Diataxis: separate explanation/reference/how-to content.
- ADR discipline: record recovered decisions as evidence-backed notes, not guesses.
