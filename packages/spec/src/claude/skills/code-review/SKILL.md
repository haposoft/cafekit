---
name: cf:code-review
description: "Review a change for correctness, security, and specification compliance without owning execution proof."
user-invocable: true
when_to_use: "Use for a pending diff, commit, PR, or explicitly scoped review."
category: dev-tools
keywords: [review, diff, correctness, security]
argument-hint: "[#PR | COMMIT | --pending | scope]"
metadata:
  author: haposoft
  version: "2.0.0"
---
# Code Review — correctness and compliance owner

Review evaluates correctness, security, scope, architecture, and specification
compliance. It does not execute the test suite, create a canonical execution
receipt, or turn a missing test result into a review-owned proof. `cf:test`
owns execution proof; the single closeout owner combines both results.

## Input and depth

With no argument, review the pending diff. Supported targets are a PR, commit,
pending changes, or an explicit path. Load only current target bytes and needed
references. For a valid process-first target, read `plan.md`, the active flat
`task-NN-*.md`, and the controller-validated `test-proof-v1` handoff. Mixed,
orphaned, malformed, symlinked, nonregular, or identity-conflicting packet state
is `BLOCKED`; review never migrates it.

For process-first proof consumption, this skill's `## Execution-proof boundary`
is authoritative. Do not load or follow legacy separate-receipt paragraphs from
references; they apply only after the Legacy route below is selected.

Select review depth from `assurance_level`, risk, and blast radius. Lane is a
derived view:

- Direct: targeted correctness/security/spec check;
- Standard: bounded feature review at closeout;
- Critical: independent, adversarial review covering every required obligation.

Do not use file count as the depth selector. `execution_tier` is a read-only
legacy adapter and cannot choose a review sequence. The review contract has no
fixed Light/Standard/Deep sequence.

## Review stages

### 1. Specification compliance

For process-first work, compare the diff with current plan scope and the active
task's Outcome, Scope, Coverage, Ownership, Acceptance, Dependencies,
Verification Plan, and declared runtime reachability. Identify missing behavior,
unjustified extras, contract substitution, orphaned outputs, and incorrect
completion claims. If a design image or document carries requirements, load its
multimodal reference only when needed; do not guess from a filename.

### 2. Correctness and security

Trace changed entrypoints and callers. Check boundary validation, error paths,
resource handling, race assumptions, secrets, authorization, persistence, and
failure recovery in proportion to risk. Apply YAGNI/KISS/DRY as maintainability
signals, not as a numeric score.

### 3. Adversarial checks

Try empty, malformed, unauthorized, duplicate, stale, boundary, and concurrent
inputs where the changed contract makes them relevant. For Critical obligations,
review the required independent evidence and provenance. A marker such as
`Audit: PASS` is not independent evidence.

The independent-audit proof must be a durable object with exactly
`schema_version: "1"`, distinct concrete `reviewer_session_id` and
`implementation_session_id`, `expected_provenance: { base, head }` matching the
runtime binding, concrete `evidence`, and literal `verdict: "PASS"`.
`independent: true`, `PASS_WITH_WARNINGS`, missing binding, or reused session
provenance is insufficient.

## Execution-proof boundary

For process-first work, consume only the controller-validated `test-proof-v1`
handoff. Require its exact closed schema, stable digest, current Base/Head,
target task, exact command, exit/counts, raw output, reachability, proof level,
artifacts, branches, and redactions. Unknown keys/verdicts, duplicate or missing
branches, stale provenance, zero execution, required skips, unsafe redaction, or
`PASS_WITH_WARNINGS` remain unfinished. Never create or search for a separate
process-first receipt; Develop alone writes Status and inline `## Receipt` after
proof and review are both literal `PASS`.

Never rerun commands to manufacture proof. If execution proof is missing or
invalid, say `execution proof unavailable` and leave closeout unfinished; do not
claim feature PASS from review alone. A review may still return a correctness
verdict when its review inputs are complete, but that verdict is not execution
proof or GATE-DONE approval.

## Verdict

Use the shared adapter surface exactly:

`PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`

Legacy adapter inputs may include `PASS | FAIL | BLOCKED`, but they are
normalized to the shared surface and no second enum is allowed. `PASS` means no
Critical/High correctness, security, or compliance finding. `PASS_WITH_WARNINGS`
means only documented non-blocking findings remain. `FAIL` requires remediation;
`PASS` also requires no blocking Medium finding. `PASS_WITH_WARNINGS` may carry
documented non-blocking findings. Finding count never selects depth or overrides
missing execution proof. A review `PASS_WITH_WARNINGS` remains an unfinished
closeout result; only literal `PASS` can finish a task. `BLOCKED` means the review input or a user-owned
decision is unavailable.

```markdown
# Code Review Results [cf:code-review]

**Verdict:** PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED
**Target:** [PR | Commit | Path]
**Assurance / risk:** [canonical policy input and relevant signals]
**Execution proof:** test-proof-v1 consumed | unavailable (owned by cf:test)

## Findings
- [Critical|High|Medium|Low] path:line — issue, failure scenario, evidence,
  and fix boundary.

## Decision
- Scope/spec compliance: PASS | WARN | FAIL
- Correctness/security: PASS | WARN | FAIL
- Reachability/provenance review: PASS | WARN | FAIL
```

Do not add a test command, a fabricated receipt, or an `Audit: PASS` marker to
make the review look complete. Return unresolved questions at the end.

## Legacy workflow compatibility

For a valid legacy packet only, retain its current spec/task resolution,
separate `receipts/<task-basename>.md` fallback, feature receipt, persisted audit
obligations, and legacy verdict normalization. If separate and embedded legacy
proof identities conflict, fail closed. Never copy that adapter into a flat
process-first packet.

## References

- `references/spec-compliance-review.md` — load only its detailed scope checks;
  its separate-receipt paragraph is Legacy-only.
- `references/pre-landing-checklists.md` — load for the selected risk surface.
- `references/adversarial-review.md` — load for Critical/adversarial depth.
- `references/verification-gate.md` — Legacy separate-receipt consumption only;
  process-first proof uses this skill's execution-proof boundary. Execution
  always stays with `cf:test`.
