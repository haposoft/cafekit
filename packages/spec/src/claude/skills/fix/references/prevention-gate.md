# Prevention Gate

After a fix is verified, apply defense-in-depth to prevent the same bug class from recurring. Prevention is not the same as side-effect safety; run the Step 5 side-effect sweep in `../SKILL.md` before claiming completion.

When the debug report carries a `Recurrence-Prevention Handoff`, consume its
evidence-backed candidates (missing invariant or validation layer,
observability/alerting gap, regression scenario) as guard inputs below instead
of inventing new ones.

## Mandatory Prevention Checklist

For every fix (Standard+ complexity), evaluate and apply at least ONE:

### 1. Regression Test Guard
- Write a test that specifically covers the fixed issue
- The test MUST fail without the fix and pass with it
- Place it near related existing tests for discoverability

### 2. Input Validation Guard
If the bug was caused by unexpected input:
- Add validation at the entry point (not deep inside the call chain)
- Throw descriptive errors instead of silently corrupting state
- Consider adding TypeScript type narrowing or runtime assertions

### 3. Boundary Defense Guard
If the bug was an edge case:
- Add explicit handling for null, undefined, empty arrays, zero values
- Document the boundary condition with a code comment explaining WHY
- Add the edge case to the test suite

### 4. Monitoring Guard
If the bug could recur silently:
- Add logging at the critical junction point
- Include structured context (IDs, timestamps, relevant state)
- Ensure the log level is appropriate (warn for recoverable, error for critical)

### 5. Layered Defense Guard
If the same invalid state could enter through multiple paths:
- Validate at the entry point where data first crosses a trust boundary
- Validate in business logic where invariants must hold
- Add environment/config guards when deployment conditions matter
- Add diagnostic logging only at decision points that help future debugging

## Quick Mode Prevention

For trivial fixes (lint, type errors), prevention is optional but encouraged:
- If a type error: Consider adding stricter types upstream
- If a lint error: Consider adding the rule to autofix config

## Skip Prevention When

- The fix is a one-time data migration
- The affected code is being replaced in an upcoming refactor (confirmed, not speculative)
- The fix is a dependency version bump with no custom logic involved

## Prevention Report

After applying guards, report:
```
Prevention: [N] guards added
  - [type]: [description]
  - [type]: [description]
```
