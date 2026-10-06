# Task 02 — Wire timing into the installed Specs workflow

<!-- Archived unexecuted; successor: ../../specs-session-timing-benchmark/plan.md. -->

Status: pending

## Outcome
Claude and Codex users can deliberately start a timing run, follow the same three human gates, and verify that the installed package exposes the recorder and concise usage guidance.

## Scope
- In: opt-in command guidance, exact C1/C2/C3 event semantics, installed Claude/Codex inventory coverage, and public usage documentation.
- Out: implicit activation, new `$hapo-specs` flags, automatic hook writes, release publishing, and baseline/treatment claims.

## Ownership
- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Modify: `docs/specs-usage-guide.md`
- Read: `packages/spec/bin/phases/copy-payload.js`
- Read: `packages/spec/bin/lib/codex-install.js`

## Acceptance
- AC-06: Specs guidance states timing is explicit, gives the exact start/mark/report syntax, records gate-open and human-decision events, and keeps C3 separate from authoring time.
- AC-06: a packed install for each runtime exposes `.claude/scripts/specs-timing.cjs` and `.codex/scripts/specs-timing.cjs`, then invokes each installed script through start/mark/report rather than only checking source inventory.
- AC-06: docs state the exact metric endpoints, local ignored artifact path, content-minimized schema, clock source, and that timing is neither active-compute time nor a quality benchmark.
- AC-06: the Specs bundle remains within its existing 750-line budget.

## Dependencies
- Task 01

## Verification Plan
- Command: `pnpm -C packages/spec test`
- Expected: full CafeKit package suite exits 0 with no ignored failure and the package/install assertions cover both runtimes.
- Reachability: real package copying through `copy-payload.js`, not a source-only direct import.
- Artifacts: normal test output; live Claude/Codex host timing remains a separate dogfood observation.

## Receipt
<!-- Filled only by the execution owner after fresh verification. -->
