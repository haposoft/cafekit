# Review, Audit, and Decision Rules

Use this file when reviewing code, applying audit feedback, or cutting scope.

## Verified Decisions

Once a decision is verified by source, tests, or an empirical check, do not
reverse it because an audit raises an abstract concern. Reverse only when the
audit adds new evidence or the context changed.

When rejecting an audit concern, name the verification source briefly.

## User Decisions

Do not silently undo an explicit user decision. This covers the GATE-SCOPE scope choice,
GATE-REVIEW finding dispositions, and GATE-DONE completion judgement, along with thresholds,
selected libraries, feature scope, schema shape, pricing, timelines, compliance
choices, and UX trade-offs. Those gates are defined in `workflow.md`; this rule
governs only how a later review may treat them.

If an audit suggests reversing a user decision, present:

- the original decision
- the audit concern
- the trade-off
- the concrete options

Then wait for the user.

## Threat Model

Before applying a security or robustness finding, identify what the code
actually stores, protects, or exposes. Fix real failure modes. Document
non-issues briefly. Ask when the risk is plausible but depends on product
intent.

## Scout First

For questions answerable by reading the repository, scout before asking.
`cf:scout` owns discovery and `cf:ask` owns the ask-back conditions; do not
restate that list here.

## Stable Code Artifacts

Do not add plan IDs, phase numbers, CP or AC identifiers, audit labels, or
finding codes to code comments, migration names, test names, or commit
messages. Explain the invariant or behavior directly. Artifacts that already
carry such identifiers stay as they are.
