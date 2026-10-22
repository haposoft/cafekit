# Condition-Based Waiting

Use this for flaky tests, async UI behavior, background jobs, eventual consistency, and race conditions.

## Core Rule

Wait for the condition that proves readiness. Do not wait for an arbitrary amount of time.

## Bad Pattern

```js
await new Promise((resolve) => setTimeout(resolve, 1000));
```

This passes only when the machine, network, and scheduler happen to be fast enough.

## Good Pattern

```js
await waitFor(async () => {
  const result = await readState();
  return result.status === "ready";
}, { timeoutMs: 5000 });
```

The test waits for a real observable condition and fails with a useful timeout when the condition never happens.

## Diagnosis Checklist

- Does the test pass alone but fail in the suite?
- Does it fail more often under CI load?
- Is there shared state, global clock, cache, database row, local storage, or browser session leakage?
- Is the assertion made before the UI/job/API has reached a stable state?
- Is the wait tied to a timeout instead of a state transition?
- Can the test observe the same signal a user or downstream system relies on?

## Fix Direction

- Replace fixed delays with condition waits.
- Prefer user-visible state for UI tests.
- Prefer durable state for jobs and integration tests.
- Reset shared state between tests.
- Keep timeout long enough for slow CI but fail with diagnostic output.
- Log or print last observed state on timeout.

## Report Snippet

```markdown
### Flake Evidence
- Fails alone:
- Fails in suite:
- CI/local difference:
- Shared state:
- Readiness condition:
- Replacement wait:
```
