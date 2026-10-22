# Diagnostic Verification Protocol

Debug owns the failing baseline and the proof plan. It does not apply or certify the repair.

## Ownership Boundary

1. **Debug — reproduce and diagnose:**
   Capture the exact failing command, flow, log trigger, environment, and current output. If reproduction is unsafe or unavailable, state the limitation and use the strongest observable evidence.

2. **Debug — design proof:**
   Name the same reproduction, regression guard, transitive checks, side-effect sweep, and acceptance signal that would prove the proposed direction.

3. **Fix/Test — mutate and verify:**
   The implementation workflow applies the change. The canonical test owner reruns the baseline and the planned regression and side-effect checks with fresh output.

## What constitutes "Invalid Proof"?
- **"I have reviewed the code and it looks correct."** -> This is hallucinated confidence. Rejected.
- **"The unit test should pass now."** -> Assuming outcomes without execution. Rejected.
- A different command that does not exercise the original failure path.
- Stale logs, screenshots, or output captured before the final implementation.
- A green health check when the reported business state remains unobserved.

## How to execute tests when no test suite exists?
If the project lacks a formal test suite, Debug should define a deterministic native check such as a CLI invocation, read-only query, HTTP request, or browser flow. Temporary diagnostic instrumentation is allowed only to expose hidden state, must not alter product behavior, and must be removed before handoff. Fix/Test executes post-change proof.
