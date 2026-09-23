# Quality gate — one closeout, separate proof and review

Load this reference when closing a task or direct change. It defines ownership
and evidence, not a fixed agent sequence.

## Ownership

- **Test owner:** executes the named commands and is the sole producer of
  execution proof.
- **Review owner:** evaluates correctness, security, scope, and reachability;
  consumes proof but never creates it.
- **Closeout owner:** normalizes both results, writes the task Receipt and
  Status, and reports docs impact.

Use `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`. Only literal PASS plus all
required proof can close. Review depth follows risk, blast radius, and repository
policy, not file count.

## Required proof

Before completion, verify:

1. applicable compile/typecheck and every exact task command;
2. at least one real test when automated tests are required;
3. runtime reachability through the declared entrypoint or consumer;
4. negative/failure behavior named by Acceptance;
5. artifact bytes and SHA-256 when the task declares an artifact;
6. an inline `## Receipt` with `Verification: PASS`, exact `Command`, `Exit: 0`,
   runtime-bound Base/Head, and non-empty fenced command output;
7. correctness/security/scope review at the required depth.

`PRECHECK_FAIL` outranks no-tests. Missing, pending, placeholder, contradictory,
zero-test, stale, copied, or marker-only proof is unfinished. A review PASS
cannot replace execution evidence.

## Shared captured runs

A shared command may prove several tasks only from one fresh captured run. For
each task, map the exact command, current Head, required proof level, oracle, one
uniquely named probe, and that probe's executed/pass count. Every mapped probe
must execute at least once and all executions must pass. Duplicate probe names,
ambiguous ownership/counts, skip, skipped, todo, cancel, canceled, cancelled, or
remembered output cannot close any mapped task. Source, installed, and live proof
levels remain distinct; never promote evidence from a lower level.

## Review focus

Check task Outcome, Scope, Acceptance, Dependencies, Verification Plan, changed
diff, and actual consumers. Treat an unmounted UI, unregistered route, uncalled
service, disconnected worker, missing export, or unconsumed artifact as a
reachability failure even when compilation passes.

Apply security checks relevant to the touched boundary: auth and tenant scope,
input validation, secret redaction, path containment and symlinks, atomic writes,
concurrency, cleanup, and safe error behavior. Do not add unrelated ceremony.

Specific-task mode reviews only that task and stops. Full-feature mode uses
cumulative scope only for the final integration check.

## Repair cycle

```text
test owner runs required proof once
if BLOCKED: record prerequisite and stop
if FAIL: repair the observed cause and rerun affected proof
review owner evaluates the proven diff once
if review FAIL: repair affected scope and rerun affected proof/review
after three failed repair rounds: stop and request user direction
```

`PASS_WITH_WARNINGS` may report non-blocking observations but remains
unfinished for state synchronization. Never retry an unchanged environment to
manufacture a green result.

## Final-Head fixed point

Before GATE-DONE, repeat within the same three-round repair cap:

1. Capture runtime Head and list every `done` task whose Receipt is stale or
   bound to a different Head.
2. Run each stale task's exact proof freshly and let only the controller replace
   its inline Receipt. A Receipt that declares artifacts with `sha256` may instead be
   rebound to the current Head once every declared hash is recomputed and matches, and only
   when no file the proof reads changed between its recorded Head and the current one and
   every claim in the Receipt is derived from those artifacts; matching bytes prove the
   artifacts did not move, not that the proof would still produce them. Otherwise, and for a
   Receipt with no artifact, re-run; only the controller rebinds.
   If proof changes any non-Specs byte, stop as BLOCKED;
   remediation must settle those bytes before proof can bind them.
3. Capture runtime Head again and rescan all `done` Receipts.

Stop only when consecutive Head captures are identical and every `done` Receipt
names that current Head. A single pass, remembered result, copied Receipt, or
proof promoted from another level is not a fixed point. If Head keeps moving or
the repair cap is reached, report the blocker instead of opening GATE-DONE.

## Flash gate

With explicit `--flash`, run only a cheap available preflight and a basic
scope/reachability check. Record:

```text
Mode: --flash
Tests: skipped by user request
Evidence: FLASH_UNVERIFIED
Status: in_progress
Blocker: awaiting /cf:test <feature>
```

Flash does not write a PASS receipt, mark done, unblock dependents, chain, or
report production readiness. Only a later explicit non-Flash invocation may
recover it: discard Flash output as canonical evidence, inspect current bytes
and the owned diff, and run fresh proof under the same sync-finalize contract.

## Docs impact and GATE-DONE

After proof and review, classify docs impact as `none`, `minor`, or `major`.
Update only affected existing docs when impact is not none. Show the user the
current command evidence and limitations at GATE-DONE; do not infer approval from a
receipt.

## Legacy workflow compatibility

Existing kernel packets keep their separate `receipts/<task-basename>.md`, task
identity/path metadata, final `feature-receipt.md`, persisted independent-audit
obligations, and completion-authority checks. The same proof/review ownership
applies. Do not copy that storage shape into a flat process-first task.
