# Failure triage

Classify observed failures, preserve real output, and return the cause to the
implementation owner. Testing never edits implementation or tests.

## Categories

| Category | Evidence | Default result |
|---|---|---|
| Compilation or packaging | command, exit, relevant file/line | `FAIL` |
| Logic/contract | named probe, expected, observed | `FAIL` |
| Environment/prerequisite | missing tool, service, variable, permission | `BLOCKED` before execution; otherwise `FAIL` after an attempted command |
| Flaky/nondeterministic | repeated current runs with differing outcomes, or an assertion or pass condition that depends on a nondeterministic source | `FAIL` |
| Coverage/reachability gap | exact uncovered branch or unreachable surface | `FAIL`, or `PASS_WITH_WARNINGS` only when explicitly non-required |
| UI console/network/flow | URL path, safe status, redacted error | `FAIL` when required |
| Accessibility/visual/performance/SEO | metric or element plus declared threshold | requirement decides `FAIL` or `PASS_WITH_WARNINGS` |
| Security/auth safety | unsafe origin, redirect, action, or disclosure risk | `BLOCKED` before execution; otherwise `FAIL` |
| Proof integrity | malformed, duplicate, stale, skipped, contradictory, zero-test, or unknown proof | `BLOCKED` |

## Canonical verdicts

Use only `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`.

- `PASS`: every required branch executed and passed under the exact current
  command/provenance with no skips or warnings.
- `PASS_WITH_WARNINGS`: required proof passed, but a real non-required warning
  remains. It does not close a process-first task.
- `FAIL`: execution was attempted and a required assertion, command,
  reachability check, artifact, redaction check, or safety expectation failed.
- `BLOCKED`: safe execution could not begin or proof structure/identity cannot
  be trusted. State the changed prerequisite; do not blind-retry.

Do not emit `PARTIAL`, `COLLAPSE`, `NO_TESTS`, or an unknown result. Normalize
those legacy diagnostics to one of the four verdicts and keep work unfinished.
Failure count never changes the lattice: aggregation remains
`FAIL` > `BLOCKED` > `PASS_WITH_WARNINGS` > `PASS`.

## Triage sequence

1. Record the exact redacted command, exit, counts, named probe, expected, and
   observed result.
2. Separate product failure from environment blocker and proof-integrity error.
3. Preserve the shortest useful output excerpt and relevant path/line.
4. Do not change assertions, install tools, clean project drift, retry without a
   stated hypothesis, or reuse remembered output.
5. Return the canonical verdict and the next concrete prerequisite or fix
   location to the controller.

## Failure report

```markdown
### Failure N — [category]

- Probe: [exact named probe]
- Command: [exact redacted command]
- Exit/counts: [actual values]
- Expected: [task oracle]
- Observed: [current evidence]
- Location: [path:line when available]
- Verdict: FAIL | BLOCKED | PASS_WITH_WARNINGS
- Next: [implementation fix or changed prerequisite]
```
