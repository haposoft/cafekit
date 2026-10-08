# Task 01 — Author plan-native Test contract

Status: done

## Outcome
Canonical Test instructions understand process-first packets, return trustworthy
proof to the controller, keep legacy testing isolated, and avoid proof-time state
mutation or unsafe authentication handling.

## Scope
- In: process-first target routing, proof payload, controller-only Status/Receipt,
  legacy isolation, canonical verdicts, read-only history, safe UI auth, concise
  reporting, blast-radius and reachability preservation.
- Out: new runtime code, hooks, browser tools, release/version work, automatic
  implementation fixes, or wall-clock claims.

## Coverage
- CP-01
- CP-02
- CP-03 (source contract only)
- CP-04 (source contract only)

## Ownership
- Modify: `packages/spec/src/claude/skills/test/SKILL.md`
- Modify: `packages/spec/src/claude/skills/test/references/execution-strategy.md`
- Modify: `packages/spec/src/claude/skills/test/references/failure-triage.md`
- Modify: `packages/spec/src/claude/skills/test/references/test-memory.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-01: flat targets use current `plan.md`/`task-NN-*.md` bytes and exact planned
  commands. Test returns one `test-proof-v1` handoff and never writes process-first
  Status or Receipt; source/installed/live proof levels cannot be promoted.
- AC-01: the handoff is canonical UTF-8 JSON with exact top-level keys
  `schema_version`, `target`, `verdict`, `command`, `exit`, `counts`,
  `provenance`, `proof_level`, `expected`, `observed`, `reachability`,
  `artifacts`, `branches`, `raw_output`, `redactions`, `payload_sha256`.
  `schema_version` is exactly `test-proof-v1`; unknown/extra keys block.
- AC-01: `target` is `{feature:string,task_path:string}` with a contained regular
  flat task; `verdict` uses the canonical four values; `counts` has nonnegative
  integer `executed/passed/failed/skipped` whose parts sum to executed;
  `provenance` is `{base:string,head:string}` with lowercase canonical SHAs;
  `proof_level` is `source|installed|live`; `expected`, `observed`, and
  `raw_output` are nonempty redacted strings after any attempted execution;
  reachability is `{status:PASS|FAIL|BLOCKED,evidence:string[]}` with unique
  nonempty evidence; artifacts are sorted contained `{path:string,sha256:string}`
  rows; redactions are unique sorted labels from `authorization|cookie|set-cookie|
  credential|session-token|pii`, never secret values.
- AC-01: `branches` is a nonempty sorted array with exact keys
  `{id:string,required:true,verdict,command,exit,counts,proof_level}`. Required IDs
  equal the task Verification Plan's exact unique Named probes, one row each;
  command is the task's exact command, exit is an integer, counts use the same
  closed shape, and no nested extra keys are accepted. Duplicate/missing IDs,
  contradictory aggregate counts, proof-level promotion, or command drift block.
- AC-01: `payload_sha256` is lowercase SHA-256 of canonical stable JSON excluding
  only itself; the controller recomputes it. `command`, `exit`, `provenance`, and
  branch execution fields may be null only for pre-execution `BLOCKED`; then all
  counts are zero and `observed`/`raw_output` name the changed prerequisite.
  Attempted FAIL has a nonzero exit, failed count, or reachability FAIL. Otherwise
  any FAIL branch aggregates FAIL; missing/invalid/unknown/pre-execution required
  branch aggregates BLOCKED; any warning branch aggregates PASS_WITH_WARNINGS;
  only all-required PASS with exit 0, executed > 0, failed/skipped 0,
  reachability PASS, matching provenance, and safe redaction aggregates PASS.
- AC-02 routing truth table: a flat marker is a direct-child `plan.md` or
  `task-NN-*.md`; a legacy marker is `spec.json`, a nested legacy task, or a
  separate legacy receipt, detected with lstat so broken links count. A regular
  plan with exact process marker plus one or more regular, valid flat tasks and
  no legacy marker selects process-first. A flat task without a plan, a plan
  without tasks, wrong/missing process marker, malformed/duplicate task fields,
  or any symlink/nonregular flat marker returns `BLOCKED`.
- AC-02: a valid regular `spec.json` whose identity/registry resolves every
  contained nested task/receipt and has no flat marker selects legacy. Orphan
  nested/separate markers, absent/schema-invalid `spec.json`, nonregular legacy
  markers, conflicting identities, or any simultaneous flat + legacy marker
  return `BLOCKED`. Only when no flat or legacy marker exists may ordinary
  non-Spec test scope proceed without inventing packet state.
- CP-03 source: memory is optional read-only context. Test never creates or merges
  `.hapo/test-memory.json`, and hashes its absent/present bytes before and after.
  Test-owned temp files live outside the project and are cleaned. Test-owned
  reports, auth state, caches, and lazy installs are forbidden during proof.
  Project-command tracked, untracked, and ignored drift is reported separately;
  it is never silently deleted or hidden, and current proof outranks history.
- AC-05: auth prefers project-native helpers, then an explicitly selected
  user-controlled profile bound to confirmed HTTPS/localhost origin, identity,
  permission, and action scope. Cross-origin redirects, destructive production
  actions without fresh consent, cookie/token export, or unsafe proof block.
- AC-05: commands, network bodies/headers, logs, screenshots, and reports redact
  Authorization, Cookie/Set-Cookie, session tokens, credentials, and scoped PII;
  the human report remains concise and separate from the typed proof handoff.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes: `hapo:test plan-native proof contract is complete and bounded`;
  `hapo:test plan-native checker rejects semantic weakenings`.
- Reachability: canonical Claude Test source and its three references; installed
  parity belongs to Task 02.
- Oracle: static runner exits 0 only when the source contract jointly encodes
  flat/legacy routing, `test-proof-v1`, fail-closed aggregation, controller-only
  state, read-only history, cleaned artifacts, and safe auth/redaction.
- Counterexample: a mutation restores separate receipts for flat tasks, omits a
  payload key/type/digest, duplicates a branch, routes orphan/mixed legacy state,
  writes memory, installs project-local UI dependencies, asks for a token,
  permits cross-origin profile reuse, or claims live adherence; its named probe fails.
- Artifacts: none.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ hapo:test plan-native proof contract is complete and bounded
✔ hapo:test plan-native checker rejects semantic weakenings
[skill-test] PASS: 528 focused static tests executed
```
