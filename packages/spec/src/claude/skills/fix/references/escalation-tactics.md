# Escalation Tactics

When structured diagnosis fails (2+ hypotheses refuted), use these lateral thinking techniques to break deadlocks.

## Tactic 1: Inversion Exercise

Stop trying to fix the bug. Instead ask: **"What would CAUSE this bug intentionally?"**

Example:
- Forward: "How do I make background sync stable so it doesn't drop messages?"
- Inverted: "What is the fastest way to guarantee every message gets dropped?"
- Result: By mapping out the destruction path, you illuminate the exact failure points.

## Tactic 2: Scale Game

Test the boundaries of the bug by changing its scale:
- Does it fail with 1 item? 10? 100? 10000?
- Does it fail on the first request? Or only after N requests?
- Does it fail immediately? Or only after running for X minutes?

Scale changes reveal whether the bug is a logic error (fails at any scale) or a resource/timing issue (only fails at certain thresholds).

## Tactic 3: Environment Isolation

Strip the environment to its simplest possible state:
- Run the failing code in isolation (outside the full app)
- Hardcode all dynamic variables to known values
- Remove all middleware, plugins, interceptors
- If it passes in isolation → the bug is in the integration layer, not the logic

## Tactic 4: Time Travel (Git Bisect)

If the bug appeared suddenly in a previously working system:
```bash
git bisect start
git bisect bad HEAD
git bisect good <last-known-good-commit>
# Run the reproducer at each step
```

This mechanically identifies the exact commit that introduced the regression.

## Tactic 5: Second-Order Thinking

Before applying any patch, ask: "What are the downstream consequences?"
- Suppressing a TypeScript error with `any` or `@ts-ignore`? Will it cause silent runtime crashes?
- Adding a null check at the symptom location? Will the null propagate to other consumers?
- Catching an exception silently? Will it mask a more serious underlying failure?

## When to Stop

After 3 failed fix attempts using these tactics:
1. **STOP immediately** — more attempts without new information is waste
2. **Document what you know** — list confirmed facts, refuted hypotheses, remaining unknowns
3. **Discuss with user** — present your findings and ask for architectural guidance
4. **Consider the possibility** that the design itself is flawed — the fix might require restructuring, not patching
