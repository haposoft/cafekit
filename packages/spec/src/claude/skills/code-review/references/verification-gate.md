---
name: verification-gate
description: Legacy proof consumption. Defines what supplied execution proof contains when a review of a legacy packet consumes it; the reviewer never produces that proof.
---

# Verification Gate: legacy proof consumption

This reference applies only to a legacy packet. A
review never runs tests, builds, or linters to produce proof; `cf:test` owns
execution, and the test-run boundary in `SKILL.md` applies here as well.

## 1. What supplied proof contains

Proof reaches the review from the test owner, never from the review itself. It
may be:

- **Test suite logs:** output showing which tests ran and their result.
- **Compilation or build status:** compiler or bundler output with its exit code.
- **Linter completion:** output showing the lint run and its result.
- **Multimodal visual evidence:** `cf:ai-multimodal` when installed, or another
  available runtime visual capability; otherwise visual parity is `UNPROVEN`.

For Specs v2, accepted proof must be persisted by the test owner at
`receipts/<task-basename>.md`; legacy `## Evidence` remains fallback-only. The
receipt includes identity/path, exact command, exit/result, expected versus
observed behavior, applicable negative/reachability/artifact proof, and bound
Base/Head. Closing a legacy `spec.json` packet that has no `schema_version` still
requires `feature-receipt.md`. A receipt never grants approval, readiness, audit
status, or product semantics.

For v2.1, the semantic receipt is reviewed input, not execution proof. It binds
exact criteria and counterexamples shaped as `criterion`, `case_kind`,
`scenario`, `expected`, `decision_refs`, and `verification_ref`. Deterministic
validator success is never a semantic-review verdict.

## 2. When supplied proof is missing or failed

A missing legacy receipt leaves the closeout unfinished: the review still
returns its correctness verdict and states execution proof as unavailable (owned
by `cf:test`). Supplied proof that failed is a finding the review reports. Never
rerun or retry anything to fill the gap.
