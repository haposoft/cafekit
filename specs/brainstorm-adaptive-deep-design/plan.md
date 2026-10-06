# Brainstorm adaptive deep design
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-28)
- Existing: proportional routing, four-field contract hydration, material-choice gating, critical-section approval, and an advisory brainstormer already exist.
- Minimum change: add evidence/risk-selected depth, relevant-only deep lenses, feasibility/confidence, optional visual/advice behavior, and a Specs-ready decision brief without weakening fast routing or authority boundaries.
- Expansion signals: 8 owned files / 2 work groups / 0 new services or classes; below the Specs expansion thresholds.
- User decision: **KEEP** — approved the proportional-deep direction.

## Out of scope
- Implementation outside Brainstorm source/tests/docs; new supervisors, services, schemas, approval state, automatic Specs/Develop dispatch, release/versioning, timing benchmarks, or claims of live-model adherence.
- Mandatory HTML/files, mandatory reports, forced assumption challenges, forced option counts, or a question-until-certain loop.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Direct stays fast; non-direct selects Standard/Deep deterministically | modify | routing, flags | known; encode ordered rules | elevated; current source contract | source |
| CP-02 | Deep applies only lenses triggered by material facts | modify | analysis, specialist prompt | known; encode trigger/skip matrix | elevated; architecture choices | source |
| CP-03 | Visual/advice overlays preserve consent, redaction, gates, and non-authority | modify | controller, adviser, installed projections | known; encode overlay matrix | critical; sensitive input and mutation authority | source, installed |
| CP-04 | Default chat brief is fresh, provenance-aware, and Specs-ready | add, modify | handoff contract | known; bind revision/evidence invalidation | elevated; stale design risk | source |
| CP-05 | Published and installed behavior rejects semantic weakening | add, modify | packed Claude, packed Codex, installed Claude, installed Codex, guides | known; named mutation matrix | elevated; distribution parity | installed |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a request enters Brainstorm, Direct routing shall run before overlays; otherwise current evidence and risk shall deterministically select Standard or Deep, while exact depth flags may increase depth but never weaken safety or authority. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | Where Deep is warranted, Brainstorm shall apply only relevant feasibility, stakeholder, reversibility, failure-isolation, operability, migration/rollback, testability, and second-order lenses without forced criticism or artificial alternatives. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | When Brainstorm states feasibility, confidence, disposition, estimates, or trade-offs, it shall separate those concepts and require range, unit, basis, evidence, and assumptions for numeric estimates; otherwise the value remains unknown. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-04 | Where visual presentation is requested for non-direct analysis or independent advice is requested after a material choice, the controller shall redact before external tool/adviser handoff, require authority before durable output, and retain question/approval/persistence/handoff ownership. | `npm --prefix packages/spec test` |
| AC-05 | When an approved design is handed to Specs, the default chat brief shall bind target identity, current revision/worktree, evidence freshness, invalidation conditions, contract fields, choices, impacts, recovery, proof mapping, decisions, assumptions, and open questions without creating machine authority. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-06 | If any new or existing Brainstorm invariant is weakened in disposable source or installed projections, named mutation/parity harnesses shall report the exact owning issue for every nonempty group; the outer suite shall fail when expected detection is absent and pass for canonical bytes. | `npm --prefix packages/spec test` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author adaptive-depth Brainstorm contract | AC-01/02/03/05 + source AC-04/06 | Brainstorm source and static checker | none | done |
| 02 | Prove installed parity and document usage | installed AC-04/06 | installed/packed tests and two usage guides | `task-01-author-adaptive-depth-contract.md` | done |

## Review log
- Round 1: two independent reviewers reported F01–F11; user accepted all.
- Round 1 closure: F01 dependencies → task `Dependencies`; F02 coverage → CP table/task references; F03/F10 probes → both Verification Plans; F04/F05 depth/flags → Task 01 routing grammar; F06/F07 visual/advice → Task 01 overlay matrix; F08 evidence semantics → Task 01 evidence rules; F09 handoff freshness → Task 01 headings; F11 guide ownership → Task 02 ownership.
- Round 2 closure: lifecycle → both tasks blocked during review then dependency-gated pending; CP shape → canonical table; adviser redaction/overlay fallback → Task 01 overlay contract; harness oracle → exact issue-set semantics; flag/evidence/lens rules → Task 01 deterministic matrices; durable closure → this log.
- Round 3 closure: visual/advice gates → AC-04; stale Task 02 oracle and public flag grammar → Task 02 Acceptance; full Claude/Codex parity surfaces → CP-05/Task 02 Coverage. Final controller consistency sweep: PASS; C2 closed and tasks promoted to dependency-aware `pending`.
- **C3: ACCEPTED by the user on 2026-08-28.** Completion covers the verified scope above; live-model adherence, wall-clock timing, release/version bump, and generated visual artifacts remain explicitly unclaimed.
