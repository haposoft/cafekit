# Design

<!-- Delete every optional section that is not relevant. Compact keeps only the four core sections. -->

## Boundary

- **Owns:** {{Behavior/state this design owns}}
- **Reads:** {{Relevant inputs or existing state, or none}}
- **Writes/exposes:** {{Outputs, state, route, artifact, or none}}
- **Outside boundary:** {{Explicit non-goal or delegated responsibility}}

## Typed Anchors

<!-- Files-first. IDs are unique across the whole spec. Design-owned anchors use A-D-NN. Access/Action are machine authority; Role never implies lifecycle. -->

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-D-01 | file | `{{path/to/existing-or-planned-file}}` | {{owner / consumer / entrypoint / proof / constraint}} | {{read / write}} | {{read / create / modify / delete}} |
<!-- For a typed proof boundary, add: | A-D-02 | artifact | `{{path/to/proof-artifact}}` | proof evidence owner | write | create | -->

## Decisions and Invariants

<!-- Keep stable D/I/C IDs: every RN.M semantic-review counterexample cites one exact design reference. -->

### D1 — {{Decision name}}

- **Decision:** {{Canonical behavior or boundary}}
- **Rejects ambiguity:** {{Alternative interpretation implementers must not choose}}
- **Negative path:** {{Failure/error behavior when relevant}}
- **Anchors:** A-D-01

### I1 — {{Invariant name}}

{{Property that must remain true across implementation and verification.}}

### Named Contracts (conditional)

<!-- Define each implementation-significant contract once. Tasks reference IDs and never copy bodies. For any public, replay, or operator API contract, include method, route, auth, required headers, request schema, success response, error semantics, and idempotency/concurrency behavior. -->

#### C1 — {{Contract name}}

- **Owner:** {{boundary or future owner task}}
- **Consumers:** {{boundaries or future consumer tasks}}
- **Shape/behavior:** {{typed request, response, event, schema, state, or error contract}}
- **Compatibility:** {{versioning or migration constraint when relevant}}

## Verification Definitions

<!--
Canonical parser syntax is one single-line definition per V ID. Keep every
label on the same line; do not replace this with a table or a V heading.
-->

- **V1**: Criteria R{{SUBJECT_REQ}}.{{X}}; Owner A-D-01; Decision refs D1, I1, C1; Method command `{{exact command}}`; Expected {{concrete observable result}}; Negative/failure {{concrete rejected or recovery case}}; Reachability/grounding entrypoint `{{exact/repository/entrypoint}}` via A-D-01.

<!-- Only for a typed proof boundary, insert after Owner: Proof criteria Rn.m; Proof owner <distinct owner>; Evidence anchor <proof-owned anchor>; -->

<!-- Full-only conditional sections follow. Keep only those relevant to this feature. -->

## Flow (Full, conditional)

{{Only multi-step, branching, asynchronous, or cross-boundary flow decisions.}}

## Data and Consistency (Full, conditional)

{{Ownership, schema, constraints, concurrency, lifecycle, or idempotency. For any retention/lifecycle policy, state clock anchor, clock source, timezone/precision, cutoff comparator/inclusivity, enforcement boundary, and a wrong-clock/boundary counterexample.}}

## Errors and Recovery (Full, conditional)

{{Trigger, error contract, retry/rollback/reconciliation, and terminal state.}}

## Security and Privacy (Full, conditional)

{{Trust boundary, authorization, sensitive data, deletion, and retention decisions.}}

## Migration and Compatibility (Full, conditional)

{{Ordering, compatibility window, rollback trigger, and migration proof.}}

## Unresolved Questions

- None.
