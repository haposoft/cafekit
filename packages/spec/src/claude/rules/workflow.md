# Execution Workflow

Use the CafeKit loop: **Understand -> Plan -> Execute -> Verify -> Sync**.

## 1. Understand

- Read `./README.md` before feature planning or coding.
- Read the active spec/task file when one exists.
- Read and activate any CafeKit skill that likely applies before taking action.
- Inspect only the code needed to understand the affected area.
- Use `inspect` or focused search when structure is unclear.

## 2. Plan

- For non-trivial features, use `/cf:specs` to challenge the minimum scope,
  open GATE-SCOPE, and create `specs/<feature>/plan.md` with flat
  `task-NN-*.md` files beside it.
- After adversarial review, open GATE-REVIEW and apply only the findings the user accepts
  or revises. Specs never starts implementation.
- Start implementation only after a new explicit `/cf:develop` invocation,
  then select one unblocked task at a time.
- Extract from the active task:
  - `Status`
  - `Outcome`
  - `Scope`
  - `Ownership`
  - `Acceptance`
  - `Dependencies`
  - `Verification Plan`
- If these are missing or too vague to verify, route back to spec correction.

## 3. Execute

- Implement only the active scope.
- Modify existing files directly; do not create duplicate "enhanced" variants.
- Keep named contracts from `design.md` intact.
- Do not use placeholder wiring, process-local stand-ins, or fake adapters as completion proof.

## 4. Verify

- Run exact commands from `Verification Plan` first.
- Then run repo-level lint/test/build as needed for confidence.
- Use only fresh verification from the current run when claiming completion.
- Review correctness, security, scope, and reachability without turning the
  review into execution proof.
- `PRECHECK_FAIL` outranks `NO_TESTS`.
- `NO_TESTS` or `0 tests + exit 0` is not a pass when automated tests are required.
- If verification fails, fix root cause and rerun. After 3 failed attempts, escalate with evidence.

## 5. Sync

- Use `/cf:sync` to edit observed state surgically; the controller is the
  sole writer of task Status and proof.
- Keep exactly one `Status:` field. Write or replace the task's final inline
  `## Receipt` before setting `Status: done`.
- A canonical Receipt contains the exact command, `Exit: 0`,
  `Verification: PASS`, runtime-derived Base and Head values, and non-empty
  fenced current output. Never invent, copy, or infer missing proof.
- When the binding to Base and Head applies, and what the gate does and does not
  detect, are stated once in `state-sync.md`.
- Re-read each edited task and reconcile its plan row, dependencies, acceptance
  mapping, status, and receipt without rewriting unrelated bytes.
- Run docs checkpoint when a completed task affects public docs or architecture docs.
- After all requested work has current proof, show evidence and limitations at
  GATE-DONE. The user decides whether the feature is complete.

## Production Or CI Issues

1. Capture the failing signal.
2. Diagnose root cause with logs/tests.
3. Implement the smallest fix.
4. Rerun the failing check plus relevant regression checks.
5. Review before syncing or shipping.

Do not patch symptoms before diagnosis unless the issue is a trivial syntax/type/lint failure with an obvious local cause.

## Legacy compatibility

When an existing feature contains `spec.json`, nested `tasks/task-R*.md`, or
other legacy kernel artifacts, keep using the installed adapter. Preserve its
`task_registry`, `semantic_model`, `planning_depth`, lane,
`execution_tier`, typed boundaries, separate receipts, and final feature
receipt. Do not project that machine authority or storage shape into a new
process-first packet.
