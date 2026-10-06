# Adaptive Specs coverage routing
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-25)

- Existing: Specs already routes trivial work away from planning, blocks unresolved semantics, requires EARS criteria, material-boundary contracts, fresh review, exact proof levels, and inline Receipts (`packages/spec/src/claude/skills/specs/SKILL.md:16-24,69-123`; `packages/spec/src/claude/skills/specs/references/templates.md:126-185`).
- Minimum change: add a compact adaptive coverage profile that routes by change kind, material system surface, ambiguity, risk, and required proof level; use it to select only relevant authoring and reviewer lenses while preserving the flat packet and current machine boundary.
- Expansion signals: parser/hook enforcement, a new schema/readiness field, timing instrumentation, legacy migration, more than eight touched files, or three or more independently deliverable subsystems (split into separate Specs before authoring).
- User decision: **KEEP** guidance-only. Preserve the 750-line shipped Specs budget and do not merge timing measurement or runtime state changes into this feature.

## Out of scope

- Changes to resolver, hooks, queue/cache semantics, Receipt validation, Develop/Sync, installer projection code, or legacy `spec.json` packets.
- A closed registry for every technology, automatic business decisions, mandatory research for routine work, or one monolithic spec spanning three or more independent subsystems.
- Live-model adherence, generation-time instrumentation, or SLA claims; `specs-session-timing-benchmark` remains a separate blocked packet.

## Adaptive contract

- Classify material risk before routing. Direct work remains allowed only when it is clear, isolated, reversible, `routine`, and likely limited to one or two files. Auth/secrets/privacy, destructive or irreversible work, possible data loss/corruption, money/privilege/safety, and production-state mutation have a `critical` floor; cross-component contracts, compatibility, concurrency, external integrations, and installed/runtime behavior have at least an `elevated` floor. User wording cannot lower an observed floor.
- Route unresolved user-owned observable choices to C1/C2 first; route material competing technical designs through Brainstorm after those choices settle; split at three or more independent subsystems. A subsystem is independent only when its outcome, boundary, and verification/deployment path can move through the lifecycle separately.
- Persist one canonical `## Coverage profile` table in `plan.md` only for a Specs route, with one `CP-NN` row per externally observable outcome and columns for all change kinds, material surfaces, ambiguity/action, risk/evidence, and required proof levels. Tasks reference CP IDs instead of copying the profile.
- Change kinds are multi-valued (`add`, `modify`, `fix`, `refactor`, `remove`, `migrate`, `integrate`) and both kinds and surfaces accept `other:<verbatim>`. Matching obligations union only inside affected CP rows/tasks; they never spread critical ceremony to unrelated outcomes.
- Ambiguity actions are normative: `examples-needed` illustrates an already decided rule and promotes to `decision-needed` if examples change observable behavior; `decision-needed` blocks for C1/C2; `design-needed` routes through Brainstorm; `none` proceeds. Recompute affected CP rows after any accepted scope, outcome, criteria, ownership, dependency, risk, or proof delta before deriving task status.
- `Required proof` is a planned set of claim-level `source`, `installed`, or `live` obligations, not evidence that they ran. Unknown command/caller/environment reachability blocks `pending`; a known but not-yet-run proof does not. Missing, failed, or unavailable required proof blocks `done`/C3, and one proof level never promotes another.
- Canonical semantics live in the Specs skill and `references/templates.md`; `spec-maker` and review guidance reference that authority rather than maintaining another taxonomy.

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the canonical Specs contract evaluates a request, it shall classify risk before applying the exact direct, C1/C2, Brainstorm, one-packet, or three-plus-subsystem split route without inventing a user decision. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | Where a Specs route contains one or more observable outcomes, the contract shall require canonical CP rows containing every applicable kind and material surface, including `other:<verbatim>`, and shall apply only the obligations relevant to each referenced row/task. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | If a required decision or proof reachability remains unresolved, the affected task shall remain `blocked`; otherwise planned-but-unrun proof may be `pending`, while missing required execution evidence shall still block `done`/C3 without promotion across levels. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-04 | When the adaptive contract is weakened in source or disposable installed copies, mutation checks shall fail for risk-first routing, multi-kind/unknown coverage, ambiguity actions, scoped lenses, lifecycle rederivation, proof-state separation, and Specs/`spec-maker` parity in both Claude and Codex projections. | `npm --prefix packages/spec test` |
| AC-05 | Where operators use Specs, the usage guide shall explain adaptive routing, status consequences, and the separation between structural speed controls and the unmeasured timing packet. | `npm --prefix packages/spec test` |
| AC-06 | While adding adaptive coverage, the shipped Specs bundle shall remain at or below 750 lines and runtime/legacy behavior shall remain unchanged. | `npm --prefix packages/spec test` |

## Tasks

| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author the adaptive coverage contract | AC-01–AC-03, AC-06 | Specs authoring/review source + static checker | none | done |
| 02 | Prove installed parity and document usage | AC-04–AC-06 | static/native/packed probes + usage guide | `task-01-author-adaptive-coverage-contract.md` | done |

Tasks are sequential because Task 02 proves the exact contract authored by Task 01. No runtime file or legacy packet is owned by either task.

## Review log

- Round 1: two fresh reviewers produced F-01–F-08; user accepted all on 2026-08-25. Round 2: two new fresh reviewers replayed every original counterexample; 8/8 PASS.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| F-01 | accepted → repaired | Destructive one-file request self-declares `routine` and routes direct. | `plan.md:19-20,31`; `task-01-author-adaptive-coverage-contract.md:24` | `task-01-author-adaptive-coverage-contract.md:38-39` | destructive routine mutation rejected | PASS |
| F-02 | accepted → repaired | One retention choice maps inconsistently to examples, C1/C2, or Brainstorm. | `plan.md:20,23,31`; `task-01-author-adaptive-coverage-contract.md:24` | `task-01-author-adaptive-coverage-contract.md:38-39` | behavior-changing example forced to C1/C2 | PASS |
| F-03 | accepted → repaired | Mixed/unknown surfaces are dropped, globalized, or split at conflicting thresholds. | `plan.md:20-23,32`; `task-01-author-adaptive-coverage-contract.md:25` | `task-01-author-adaptive-coverage-contract.md:38-39` | unknown/scoped/split mutations rejected | PASS |
| F-04 | accepted → repaired | Required live proof is `UNKNOWN`, so execution can never begin. | `plan.md:24,33`; `task-01-author-adaptive-coverage-contract.md:26`; `task-02-prove-installed-coverage-parity.md:37-39` | `task-01-author-adaptive-coverage-contract.md:35-40` | known unrun proof permits pending only | PASS |
| F-05 | accepted → repaired | Installed `spec-maker` or a post-C2 profile silently drifts. | `plan.md:23,25,34`; `task-01-author-adaptive-coverage-contract.md:25`; `task-02-prove-installed-coverage-parity.md:25,37` | `task-01-author-adaptive-coverage-contract.md:37-39`; `task-02-prove-installed-coverage-parity.md:36,38-40` | stale lifecycle/agent projection rejected | PASS |
| F-06 | accepted → repaired | Tests pass although an unowned runtime file changed. | `task-02-prove-installed-coverage-parity.md:27` | `plan.md:13,45`; `task-01-author-adaptive-coverage-contract.md:16-20`; `task-02-prove-installed-coverage-parity.md:16-21` | eighth-path scope audit remains independent | PASS |
| F-07 | accepted → repaired | Guide omits routing/timing semantics while generic checks pass. | `task-02-prove-installed-coverage-parity.md:26,36-39` | `plan.md:15,35`; `task-02-prove-installed-coverage-parity.md:11-12` | omission or invented SLA rejected | PASS |
| F-08 | accepted → repaired | One added bundle line breaks the exact 750-line ceiling. | `task-01-author-adaptive-coverage-contract.md:27,38-39` | `plan.md:9,36`; `task-01-author-adaptive-coverage-contract.md:35-36` | uncompensated added line rejected | PASS |

- Final consistency sweep: 3/3 packet files reread; terminology, acceptance IDs, eight unique owned paths, dependency basename, commands, closure citations, and statuses agree; zero stale references or unresolved contradictions.

## Handoff state

- **Execution: COMPLETE.** Both tasks are `done`; Task 02's re-approved packed-install probe name is covered by fresh proof.
- **Proof: PASS.** Task 02 passed the exact Verification Plan command with the current runtime-bound receipt (full suite 1022).
- **Review: PASS.** Initial hardlink/timing counterexamples were reproduced and repaired; the final independent review found no blocking issue.
- **Scope: PASS.** Eight unique implementation paths only; `docs/.sync_hash` is generated sync metadata and this packet is controller state. No installer, hook, resolver, Receipt runtime, legacy, or timing-packet source changed.
- **C3: ACCEPTED by the user on 2026-08-25.** Completion covers the verified scope above; live-model adherence and wall-clock generation timing remain explicitly unclaimed.
- Post-closeout (2026-08-30): the packed-install probe named in task-02 had expanded to `packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm`; the user re-approved the updated Verification Plan and the task was re-closed with a fresh receipt (full suite 1022). The historical receipt is retained as non-authoritative.
