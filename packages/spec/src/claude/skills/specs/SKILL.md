---
name: cf:specs
description: "Plan a feature before anyone implements it. Use the moment a user asks to add, build, implement, or change a capability — a payment flow, an external integration, a schema change, anything touching more than one or two files or carrying auth, data, or money risk. A short, vague or hurried request belongs here too: when what to build is still undecided, the scope gate is where those questions get asked, so being in a hurry is not a reason to skip this: a scope question takes one turn and prevents a wrong build. Reach for cf:brainstorm instead only when the outcome is already agreed and two designs genuinely compete. It produces a bounded plan and flat task files with human decisions at scope, findings, and completion; it never writes code. Use when work needs durable coordination or is not eligible for direct work; answer directly when the user only wants to be told or shown something, and skip only when a change is clear, isolated, reversible, routine, and likely limited to one or two files."
user-invocable: true
argument-hint: "<feature-description>"
metadata:
  author: haposoft
  version: "3.0.0"
---
# Specs — process-first planning

Quality comes from a short decision process; honesty comes from evidence. Keep the human at exactly three gates; durable output is editable Markdown.

## Step 0 — classify risk before routing

Classify material risk before choosing a workflow; user wording never lowers an observed floor.
Request size is not a risk signal; a one-line request that touches a shared contract is `elevated`.

- `critical`: auth/secrets/privacy; destructive/irreversible work or possible data loss/corruption; money/privilege/safety; production-state mutation.
- `elevated`: cross-component contracts, compatibility, concurrency, external integration, or installed/runtime behavior.
- `routine`: only when no elevated or critical signal applies.

Work directly only when the cause and change are clear, isolated, reversible,
`routine`, and likely limited to one or two files. Route unresolved user-owned
observable choices to GATE-SCOPE/GATE-REVIEW first; after they settle, route material competing
technical designs through Brainstorm. Split three or more independent
subsystems; otherwise use one Specs packet for any material work that does not qualify for direct work or Brainstorm-only exploration. A subsystem is independent only when its outcome, boundary, and verification/deployment path can move through the lifecycle separately.

Do not create a plan merely because documentation mentions this skill; the user must invoke Specs or ask for durable planning.

## The three human gates

| Gate | Timing | Human decision |
|---|---|---|
| GATE-SCOPE | before writing the plan | EXPAND, KEEP, or CUT the proposed minimum change |
| GATE-REVIEW | after adversarial review | accept, reject, or revise each deduplicated finding |
| GATE-DONE | after execution | accept completion from current command output and receipts |

Ask once at each gate. Do not ask for routine implementation choices between them. New evidence that invalidates scope returns to GATE-SCOPE.

## Primary output layout

Create one direct child of the repository's `specs/` directory:

```text
specs/<feature>/
├── plan.md
├── task-01-<slug>.md
└── task-02-<slug>.md
```

Task files are flat beside `plan.md`. Do not create a nested task directory. Use safe lowercase slugs and read [`references/templates.md`](references/templates.md) first.

## Flow

### 1. Challenge scope, then open GATE-SCOPE

Inspect the repository before drafting. Answer three questions with current `path:line` evidence:

1. What already exists and can be reused?
2. What is the smallest change set that delivers the requested outcome?
3. What signals expansion: more than eight touched files, more than two new services/classes, or three or more independently deliverable subsystems?

Ask GATE-SCOPE in one message: list every `decision-needed` item (the ambiguity action in `references/templates.md`) as `[NEEDS CLARIFICATION: <question>]`, offer EXPAND, KEEP, and CUT together, and never choose a product outcome on the user's behalf; if an answer leaves an item unsettled, re-ask only that item.
Record the chosen scope and explicit exclusions in `plan.md`.

### 2. Write the plan and task packets

Keep `plan.md` as the short index: GATE-SCOPE decision, EARS criteria, exclusions, and task table. Give every criterion a stable ID mapped by task rows.

For a Specs route, persist the canonical `## Coverage profile` from
`references/templates.md`: one `CP-NN` row per observable outcome; tasks reference IDs instead of copying it.

Each task has one usable outcome, normally at most about five owned files, explicit dependencies, measurable acceptance, and a runnable verification command; no preparation-only tasks.

Author exact state: `pending` means semantically ready for the dependency-aware queue.
Use `blocked` while a GATE-SCOPE/GATE-REVIEW decision, accepted finding, or `UNKNOWN` closure remains
open. Dependencies alone do not change `pending`; the resolver queues them. Promote only after current evidence closes every non-dependency blocker; keep pre-execution Receipts empty.

`Required proof` is planned, not executed evidence. Unknown command/caller/environment
reachability blocks `pending`; known unrun proof does not. Missing, failed, or unavailable
required evidence blocks `done`/GATE-DONE; levels never promote. Rederive affected CP rows after accepted scope, outcome, criteria, ownership, dependency, risk, or proof deltas, before status.
Source/static checks prove the written contract, not live-model adherence.

### 3. Review adversarially, then open GATE-REVIEW

Before GATE-REVIEW, re-run a sample of the plan's `path:line` citations sized by the claim budget in `review.md`; relabel any stale citation `[UNVERIFIED]`.

Read [`references/review.md`](references/review.md) and run its fresh-context review. Require reproducible `path:line` plus a failure scenario; deduplicate, rank, and cap at 15.

Ask the user to accept, reject, or revise each finding; apply only accepted decisions. After every edit, sweep all packet files and rederive every status. Dependencies use exact flat task basenames. Stop after two paper rounds; later findings require runtime evidence.

### 4. Execute one task at a time

An implementation workflow owns execution. It selects one unblocked task with `Status: pending`, changes its single `Status:` field to `in_progress`, respects owned paths, runs the task's verification, and appends a real inline `## Receipt` only after the command finishes.

Parallel work is allowed only for tasks with disjoint write ownership and
satisfied dependencies. One file has one writer in a wave. The controller is
the sole writer of task status and receipts.

### 5. Prove completion, then open GATE-DONE

A task may say `Status: done` only when its inline receipt contains the exact
command, `Exit: 0`, `Verification: PASS`, runtime-bound Base and Head values,
and a non-empty fenced command-output block. Placeholder or remembered output
is not evidence.

Show the user the current evidence and unresolved limitations. The user decides
at GATE-DONE whether the feature is done. A passing command proves only what it ran;
it does not invent product approval, review independence, or runtime coverage.

## Ten operating laws

1. **A1 — Scope once.** Raise scope pressure at GATE-SCOPE; reopen only with new proof.
2. **A2 — Small packets.** One task, one outcome, one owner, one proof command.
3. **A3 — One fact, one home.** Reference decisions; never copy mutable lists.
4. **A4 — Files are state.** Markdown is canonical; indexes are disposable.
5. **B1 — Cite the repository.** Use current `path:line` or `[UNVERIFIED]`.
6. **B2 — Review fresh.** The author does not impersonate the reviewer.
7. **B3 — Sweep edits.** Reconcile names, decisions, CP rows, ownership, dependencies, criteria, and proof.
8. **B4 — Stop paper churn.** Two pre-code rounds; later claims need runtime evidence.
9. **C1 — Derive state.** Status follows fresh blocker and proof evidence.
10. **C2 — Rules pay rent.** Require a cited failure; reassess for model changes.

## Machine boundary

The shared workflow resolver recognizes only a regular `plan.md` plus one or more
regular flat `task-*.md` files in one direct feature directory, and projects exact
`Status:` values without inferring blockers from prose. The Stop gate re-reads every
done Receipt, binding Base and Head to the live runtime only while the task file has a
committed copy it no longer matches; work elsewhere in the tree never reopens it. It detects drift
between a receipt and the tree, not invention: a valid pair costs one command and no
verification run, so a receipt for a command that never ran satisfies it in either
mode. GATE-DONE is where a human weighs the evidence. These checks are a final safety net,
not a substitute for human judgment at the three gates. Do not add a new schema, approval field,
readiness bit, or review state to make the Markdown look more authoritative.

## Legacy compatibility

Existing features that contain `spec.json`, nested task files, or separate
receipt files stay on the installed legacy adapters. Do not migrate or rewrite
them while authoring an unrelated v3 feature. New Specs output always uses the
flat layout above and never requires the legacy kernel.

## Maintenance

Keep this entrypoint focused on routing and invariants. Put templates and
examples in `references/templates.md`; put review mechanics in
`references/review.md`. Before adding guidance, identify the observed failure
it prevents and remove duplicated wording elsewhere.
