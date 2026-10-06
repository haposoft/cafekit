# Execution strategy

Load this reference when Test needs packet routing, proof construction, blast
radius selection, UI safety, or report details.

## 1. Classify the target before execution

Inspect current filesystem entries with `lstat`; a broken link is still a
marker. Resolve all accepted paths inside the target feature directory.

### Process-first markers

- Flat markers are direct-child `plan.md` and `task-NN-*.md` entries.
- The plan must be a regular file whose second line is exactly
  `Specs-Contract: process-first-ready-v1`.
- At least one task must be a regular direct child. Each task has one unique
  identity, exactly one `Status:`, one `## Verification Plan`, a nonempty exact
  `Command`, and nonempty exact unique `Named probes`.
- A flat task without a plan, a plan without tasks, wrong/missing process
  marker, malformed or duplicate task fields, symlink, directory, device, or
  other nonregular flat marker returns `BLOCKED`.

### Legacy markers

- Legacy markers are `spec.json`, nested legacy tasks, or separate legacy
  receipts. Detect them even when orphaned or broken.
- Legacy is selected only when a regular schema-valid `spec.json` has one
  consistent identity and registry resolving every contained nested task and
  receipt, and no flat marker exists.
- Orphan nested tasks/receipts, absent or schema-invalid root, conflicting
  identities, symlinks, nonregular markers, or unresolved/out-of-root entries
  return `BLOCKED`.

### Precedence truth table

| Flat state | Legacy state | Result |
|---|---|---|
| valid | absent | process-first |
| absent | valid | legacy adapter |
| absent | absent | ordinary non-Spec scope |
| any marker | any marker | `BLOCKED` mixed state |
| invalid | absent | `BLOCKED` |
| absent | invalid | `BLOCKED` |

Do not infer that an invalid marker is absent. Testing never repairs, migrates,
renames, deletes, or chooses between conflicting packet identities.

## 2. Select the smallest adequate proof

For process-first work, read current plan and active task bytes. The exact task
Verification Plan is authoritative for command, named probes, reachability,
oracle, counterexample, proof level, and artifacts. Run every required named
probe exactly once unless the command's runner legitimately reports multiple
executions; preserve those counts without deduplicating output.

For ordinary scope, derive commands from current project files. Map changed
files to co-located tests, reverse imports, entrypoints, consumers, configuration,
and runtime surfaces. Escalate to a wider suite when configuration or shared
infrastructure changes, mapped scope exceeds roughly 60 percent, or a required
surface cannot be isolated. `--full` widens selection; it does not loosen proof.

Before an Ordinary non-Spec `PASS` or `PASS_WITH_WARNINGS`, read the tests that
cover the target or changed code (every test file when the suite is small). A
nondeterministic source in an assertion or its pass condition is `FAIL`, naming
the source, even when every run passes. A source only in setup means rerunning
just the suspect tests at least twice more; any differing outcome is `FAIL` as
flaky (`failure-triage.md`). A process-first Named probe still runs exactly once.

Run cheap project-provided prechecks before expensive tests. Do not auto-install
missing runners, packages, browsers, or linters. A missing prerequisite is
`BLOCKED`; a precheck that actually runs and fails is `FAIL`.

An exit-zero command with zero executed tests, any required skip/todo/cancel,
or a required named probe that did not execute is not `PASS`.

## 3. Side-effect boundary

Before proof, record:

- runtime Base and Head;
- tracked and untracked state;
- ignored project paths relevant to the command;
- absence or SHA-256 of `.hapo/test-memory.json`;
- absence or bytes of any known Test-owned report, cache, or auth-state path.

Use a Test-owned temporary directory outside the project only when the command
needs an ephemeral output location. Record contained artifacts before cleanup,
then remove only that exact Test-owned temporary directory. Never clean project
drift or overwrite user-owned files.

After proof, compare all observations. Report project-command tracked,
untracked, and ignored drift separately from runtime Head. A command may
legitimately change project bytes, but Test must surface that drift; it cannot
silently delete it, hide it, or call unchanged Head sufficient evidence.

Test-owned memory, reports, caches, lazy installs, and auth state must remain
byte-for-byte absent/unchanged. Any mutation makes required proof `FAIL`.

## 4. `test-proof-v1` schema

Return canonical UTF-8 JSON with exactly these top-level keys and no others:

```text
schema_version, target, verdict, command, exit, counts, provenance,
proof_level, expected, observed, reachability, artifacts, branches,
raw_output, redactions, payload_sha256
```

Validate every nested object against a closed shape:

- `schema_version`: exactly `test-proof-v1`.
- `target`: exact keys `{feature, task_path}`. Both are nonempty strings;
  `task_path` is a contained regular flat task path.
- `verdict`: exactly `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`.
- `command`: exact task command string; nullable only for pre-execution
  `BLOCKED`.
- `exit`: integer; nullable only for pre-execution `BLOCKED`.
- `counts`: exact keys `{executed, passed, failed, skipped}` with nonnegative
  integers and `passed + failed + skipped === executed`.
- `provenance`: exact keys `{base, head}`. Values are lowercase canonical Git
  SHAs matching current runtime anchors; the whole field is nullable only for
  pre-execution `BLOCKED` before repository identity is available.
- `proof_level`: exactly `source | installed | live`; never promote one level
  into another.
- `expected`, `observed`, `raw_output`: nonempty redacted strings after any
  attempted execution. For pre-execution `BLOCKED`, `observed` and `raw_output`
  name the changed prerequisite and `expected` remains nonempty.
- `reachability`: exact keys `{status, evidence}` where status is
  `PASS | FAIL | BLOCKED` and evidence is an array of unique nonempty strings.
- `artifacts`: sorted array of exact `{path, sha256}` rows. Every path is
  contained and every digest is lowercase SHA-256.
- `redactions`: unique sorted labels drawn only from `authorization`, `cookie`,
  `set-cookie`, `credential`, `session-token`, `pii`; never include secret values.
- `payload_sha256`: lowercase SHA-256 of canonical stable JSON after removing
  only `payload_sha256`. The controller recomputes it.

`branches` is a nonempty sorted array. Each row has exact keys:

```text
id, required, verdict, command, exit, counts, proof_level
```

- IDs equal the Verification Plan's exact unique Named probes, one row each.
- `required` is exactly `true`; branch verdict and proof level use the same
  closed enums.
- `command` equals the task's exact command; `exit` is an integer; branch counts
  use the same closed shape. Execution fields may be null only for a required
  pre-execution `BLOCKED` branch, whose counts are all zero.
- Reject unknown nested keys, duplicate/missing/extra branch IDs, contradictory
  aggregate counts, command drift, proof-level promotion, and unsorted rows.

Payload counts cover required Named-probe executions only, not unrelated support
tests reported by the same suite. Attribute each required execution to exactly
one branch with no overlap or omission. Payload `executed`, `passed`, `failed`,
and `skipped` each equal the element-wise sum of that field across every branch;
any unattributed, multiply attributed, or unequal count is contradictory and
returns `BLOCKED`.

A pre-execution `BLOCKED` payload for a task with two Named probes, when the
packet failed classification after the repository had a commit:

```json
{
  "schema_version": "test-proof-v1",
  "target": {
    "feature": "user-auth",
    "task_path": "specs/user-auth/task-01-login.md"
  },
  "verdict": "BLOCKED",
  "command": null,
  "exit": null,
  "counts": {
    "executed": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0
  },
  "provenance": {
    "base": "4f2a9c0e7b1d3a5f6e8c9b0a1d2e3f4a5b6c7d8e",
    "head": "9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d"
  },
  "proof_level": "source",
  "expected": "both Named probes pass under `node --test test/login.test.js`",
  "observed": "BLOCKED before execution: specs/user-auth also holds spec.json, a legacy marker",
  "reachability": {
    "status": "BLOCKED",
    "evidence": [
      "not executed: the packet failed classification"
    ]
  },
  "artifacts": [],
  "branches": [
    {
      "id": "login accepts a valid password",
      "required": true,
      "verdict": "BLOCKED",
      "command": null,
      "exit": null,
      "counts": {
        "executed": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0
      },
      "proof_level": "source"
    },
    {
      "id": "login rejects a wrong password",
      "required": true,
      "verdict": "BLOCKED",
      "command": null,
      "exit": null,
      "counts": {
        "executed": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0
      },
      "proof_level": "source"
    }
  ],
  "raw_output": "not executed: the packet failed classification",
  "redactions": [],
  "payload_sha256": "b62c65f70d9cba41c4ab92c7dfb5a7db371aff609095525cc10a8adf147631f7"
}
```

`FAIL` variants: a branch with a nonzero exit or a failed count is `FAIL` and
makes the payload `FAIL`; a reachability `FAIL` with every branch passing keeps
the branches `PASS` and makes the payload `FAIL`.

## 5. Aggregation and integrity

Aggregate required branches in strict order:

1. Any attempted required `FAIL` branch makes the payload `FAIL`.
2. Any missing, invalid, unknown, or pre-execution blocked required branch makes
   it `BLOCKED` unless a required attempted failure already exists.
3. Any warning branch makes it `PASS_WITH_WARNINGS` unless a stronger result
   exists.
4. Only every required branch at literal `PASS` can reach payload `PASS`.

Attempted `FAIL` has at least one of: nonzero exit, failed count, or
`reachability.status: FAIL`. A payload may be `PASS` only with the exact command,
exit 0, executed > 0, failed 0, skipped 0, matching current provenance, every
branch `PASS`, reachability `PASS`, valid artifacts, safe redaction, and a valid
digest. A contradictory payload returns `BLOCKED`; never repair it by guessing.

## 6. Authenticated UI proof

Use UI proof only for a reachable UI requirement.

1. Confirm the exact target is HTTPS or localhost, expected environment, and
   safe origin before opening auth state.
2. Prefer the project's native test login/helper. Otherwise require an
   explicitly selected user-controlled browser profile.
3. Confirm profile identity, permissions, tenant/environment, and allowed action
   scope without exposing credentials.
4. Bind approval to the confirmed origin. Stop on cross-origin redirects,
   unexpected identity/permission, or auth challenges.
5. Obtain fresh consent before a destructive production action. If consent or
   safe isolation is unavailable, return `BLOCKED`.
6. Never ask the user to paste credentials, cookies, bearer tokens, session
   tokens, or local-storage auth; never export or persist them.

Redact Authorization, Cookie, Set-Cookie, session tokens, credentials, and
scoped PII from commands, request/response headers and bodies, console/network
logs, screenshots, filenames, artifact metadata, raw output, and reports. If a
required assertion cannot be shown without disclosure, return `BLOCKED`.

UI depth is proportional: smoke/navigation first; add console/network,
interaction flow, viewport/visual, accessibility, performance, SEO, or security
only when the Verification Plan, behavior, or risk requires them. Multiple
workers may own disjoint phases, but their outputs aggregate into one proof and
must not write project state.

## 7. Human report versus machine proof

Return the validated `test-proof-v1` handoff to the controller and a separate
concise report containing only verdict, scope, exact redacted command, exit,
counts, reachability, proof level, project-command drift, and next action.
Place the handoff as `SKILL.md` "Verdict and report" says: after the concise
report, under `### Machine handoff (test-proof-v1)`, one fenced `json` block
that follows the report and is not part of it.

Do not paste verbose raw output, full JSON, credentials, PII, or screenshots into
the report. Do not write a report file during proof. Process-first Status and
inline `## Receipt` remain controller-only.

## Legacy workflow compatibility

After a valid legacy route, preserve its v2.1 task/receipt adapter and existing
proof rules. Separate legacy receipts remain legacy-only. Never search for or
create a separate receipt for a process-first task, and never copy a legacy
receipt into a flat task.
