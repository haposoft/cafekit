# Specialized Workflows

Targeted procedures for common bug categories. Load only the matching section
after the main workflow has scouted the affected area. Each overlay adds a
category-specific baseline and completion proof; it never replaces diagnosis,
the bounded repair frame, or the side-effect gate.

---

## CI/CD Pipeline Failures

When GitHub Actions or CI/CD is failing:

1. **Baseline:** identify the exact failing workflow, job, step, commit, runner,
   and attempt. Preserve the failing command and log excerpt.
2. **Inspect safely:** use the project-native CI surface; for GitHub Actions,
   `gh run list --status failure -L 5` and `gh run view <ID> --log-failed` are
   examples, not permission to rerun, cancel, or mutate remote state.
3. **Common traps:**
   - Environment setup step failed silently (DB container didn't start, npm ci cache corrupted)
   - Secrets/env vars missing in the CI environment
   - Version mismatch between local Node/Python and CI runner
   - Flaky tests (passes locally, fails on CI) — check for timezone, file ordering, or race conditions
4. **Proof:** reproduce locally when parity is available, run the affected job
   command, and verify workflow/config syntax. A local pass is not CI proof; if
   a remote rerun is not authorized, report it as unverified. Never push blind
   fixes to CI.

---

## Test Suite Failures

When unit/integration/e2e tests are failing:

1. **Baseline:** record runner, exact failing command, test name, seed/shard,
   environment, and assertion output. Use the repository's runner rather than
   assuming Jest.
2. **Isolate:** run the smallest native selector that preserves the failure.
3. **Check for pollution:** Does it pass alone but fail in suite? → Test order dependency or shared state leaking.
4. **Check for staleness:** Did implementation behavior intentionally change, or is the assertion exposing a regression? Never weaken the assertion merely to turn the suite green.
5. **Snapshot drift:** Review the semantic diff; regenerate only when the changed output is accepted behavior.
6. **Flaky async:** Replace arbitrary sleeps with condition-based waits for observable state, DOM condition, network completion, queue drain, or an explicit event.
7. **Proof:** show fail-before/pass-after for the regression selector, then run the owning suite and any shared-state/order-sensitive suite.

---

## TypeScript Type Errors

When `tsc` is throwing type errors:

1. **Baseline:** record the exact compiler command, diagnostic code, source
   location, and affected type relationship.
2. **Never** suppress with `any`, `@ts-ignore`, or `as unknown as X` unless the
   public contract itself explicitly requires an unsafe boundary and the risk is called out.
3. **Trace the type chain:** Where was the type originally defined? Follow the generic flow.
4. **Common roots:**
   - Library update changed return types → check CHANGELOG/migration guide
   - Missing null check → add proper narrowing
   - Generic type inference failure → provide explicit type argument
5. **Fix pattern:** Fix the owned contract at its source. Do not "fix all" unrelated pre-existing diagnostics outside the blast radius.
6. **Proof:** rerun the exact failing compiler command plus tests covering runtime narrowing or serialization behavior affected by the type change.

---

## UI / Visual Issues

When the interface is broken, misaligned, or not rendering:

1. **Baseline:** capture the failing route, viewport, theme, browser/runtime,
   interaction sequence, screenshot, console, and relevant network state with
   the available project/browser tooling.
2. **Inspect structure:** compare DOM/ARIA and computed layout at the failing
   element; visual similarity alone does not prove interaction behavior.
3. **Trace runtime state:** preserve console errors, hydration warnings, failed
   requests, and state transitions that explain the symptom.
4. **Proof:** repeat the exact interaction and compare before/after at the
   failing viewport, then test affected responsive states, keyboard/accessibility
   behavior, console, and network. If the host cannot perform visual interaction,
   report it as unverified instead of inferring a pass from static code.
5. **Common traps:**
   - CSS specificity wars (use browser DevTools or ARIA snapshot to verify computed styles)
   - Hydration mismatch in SSR frameworks (server HTML differs from client render)
   - Missing responsive breakpoints (test at multiple viewport widths)
   - Z-index stacking context trapping click events

---

## Application Log Errors

When investigating production or server-side log errors:

1. **Baseline:** preserve the source, environment, time range, timezone,
   request/trace/job ID, exact error, and surrounding events. Do not expose
   secrets or personal data in reports.
2. **Correlate:** normalize timestamps and cross-reference relevant app, DB,
   proxy, queue, or provider logs. Ordering is evidence, not automatic causation.
3. **Measure:** establish frequency, first/last occurrence, affected cohort, and
   whether the error is isolated or load-dependent using the available native tools.
4. **Proof:** replay a safe deterministic trigger when possible, confirm the
   expected state transition and absence of the same correlated error, then
   verify metrics/alerts or report live recurrence as unverified when observation
   time is insufficient.
5. **Common traps:**
   - Silent exception swallowing upstream (the real error was caught and logged as a warning 50 lines earlier)
   - Database connection pool exhaustion (errors appear random but correlate with connection count)
   - Memory leaks (errors start appearing after extended uptime, not immediately)
