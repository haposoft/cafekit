# Surgical Root Cause Tracing

When dealing with deep-rooted system failures, avoid modifying the surface layer where the error was thrown. The true failure often originated several layers deeper.

## Trace Backward To The Origin

Do not stop at the frame that throws. Trace this chain with evidence:

```text
symptom -> immediate cause -> caller/data boundary -> origin
```

At each boundary, record the input, expected invariant, actual value/state, and evidence source. The origin is the earliest owned invariant whose violation is sufficient to explain the downstream symptom.

## Separate Causal Roles

- **Trigger:** event or input that activated the failure now.
- **Root cause:** violated owned invariant that made the failure possible.
- **Contributing factor:** condition that increased likelihood or impact but is not sufficient by itself.

Do not label temporal proximity or a recent commit as causation until the mechanism is demonstrated.

## The 5-Whys Deep Dive
Ask "Why?" until the chain reaches the responsible invariant:
- **Symptom:** User cannot log in.
- *Why?* The Frontend received an `undefined` profile object.
- *Why?* The Backend API returned null.
- *Why?* The Database query failed silently.
- *Why?* The ORM mapping model was updated yesterday, but the database schema migration was never executed.
- **Root cause direction:** repair the missing migration contract; a frontend fallback would only mask the symptom.

## Call And Data Chain Template

```markdown
- Symptom boundary: [where failure becomes observable]
- Immediate cause: [throw/invalid state/timeout]
- Caller or data producer: [who supplied it]
- Origin: [first violated owned invariant]
- Trigger: [event/input or unknown]
- Contributing factors: [conditions or none evidenced]
- Evidence links: [file:line/log/config/query/trace]
```

For test pollution, isolate the polluter with the existing runner's subset, order, seed, or bisection support. Change one variable at a time. Temporary instrumentation must state its purpose and be removed before handoff.

## History And Bisection

Use `git log -p -- path/to/file` to form hypotheses about when behavior changed; history alone is not proof. Use `git bisect run` only in a clean disposable worktree with a deterministic diagnostic command and explicit authorization for the checkout churn. Otherwise provide the bisection plan for Fix/Test to execute.
