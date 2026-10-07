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
`task-NN-*.md`, and the controller-validated `test-proof-v1` handoff. Orphaned,
malformed, symlinked, nonregular, or identity-conflicting packet state is
`BLOCKED`; review never migrates it.

For proof consumption, this skill's `## Execution-proof boundary` is
authoritative.

Select review depth from risk and blast radius: for a process-first task, its
coverage-profile Risk/evidence. Lane is a derived view:

- Direct: targeted correctness/security/spec check;
- Standard: bounded feature review at closeout;
- Critical: independent, adversarial review covering every required obligation.

Do not use file count as the depth selector. The review contract has no fixed
Light/Standard/Deep sequence.

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

## Test-run boundary

Review reads code; it does not run tests. Never run the project's test suite or a
test file, not even as a sanity check. A read-only run of the reviewed code (for
example `node -e` on the changed function) may reproduce a defect; cite it as a
reproduction, never as test evidence. Never report a test result, pass count, or
exit code as the review's evidence. Without a `test-proof-v1` handoff, write the
proof line exactly as `**Execution proof:** unavailable (owned by cf:test)` and do
not otherwise say whether tests pass; the review still returns its correctness
verdict.

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
invalid, write the proof line from the test-run boundary and leave closeout
unfinished; do not claim feature PASS from review alone. A review may still return a correctness
verdict when its review inputs are complete, but that verdict is not execution
proof or GATE-DONE approval.

## Severity

Rate each finding by its production impact. Write the labels `Critical`, `High`,
`Medium`, and `Low` verbatim in English, whatever language the report uses.

- Critical: a concrete failure a user or operator hits that loses or corrupts
  data, breaks security, or stops the product (a login bypass).
- High: a concrete wrong result a user or operator hits (an order exactly at a
  tier boundary priced with the wrong discount).
- Medium: a real risk with a failure scenario that has not reached users (a
  changed boundary with no test; a leftover debug log).
- Low: cleanup, clarity, or a question (a naming nit; a behavior the change's
  README or docs state as intended).

A leftover debug log is at most Medium; if it prints a secret or credential,
report that exposure as a separate security finding at its own severity. A
behavior the change's README or docs state as intended is not a Medium or
heavier defect; raise it as Low or a question. Task and spec compliance findings
are Critical only when a task or spec is supplied, and there `UNVERIFIED` means
supplied proof that failed, never proof that is unavailable. A blocking Medium is
one with a concrete failure before merge. A review whose heaviest remaining
finding is a non-blocking Medium returns `PASS_WITH_WARNINGS`; one with only Low
findings returns `PASS`.

## Verdict

Use the shared adapter surface exactly:

`PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`

No second verdict enum is allowed. `PASS` means no
Critical, High, or Medium finding remains; Low findings may remain.
`PASS_WITH_WARNINGS` means the heaviest remaining finding is a non-blocking
Medium. `FAIL` means a Critical, High, or blocking Medium finding requires
remediation. Finding count never selects depth or overrides missing execution
proof. A review `PASS_WITH_WARNINGS` remains an unfinished
closeout result; only literal `PASS` can finish a task. `BLOCKED` means the review input or a user-owned
decision is unavailable.

Copy the header line `# Code Review Results [cf:code-review]`, the field labels,
and the severity labels verbatim in English; write the content in the user's
language.

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

## References

- `references/spec-compliance-review.md` — load for its detailed scope checks.
- `references/pre-landing-checklists.md` — load for the selected risk surface.
- `references/adversarial-review.md` — load for Critical/adversarial depth.
