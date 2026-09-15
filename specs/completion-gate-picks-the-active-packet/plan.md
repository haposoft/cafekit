# The completion gate picks the active packet instead of refusing to choose
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-09-15)
- Existing: three independent places answer "which feature is this turn about?", and all three block on raw candidate count. `resolvePersistedSpec` (`src/claude/scripts/spec-resolver.cjs:711-719`) returns `multiple_persisted` whenever more than one packet exists; `refineWorkflowGateResolution` (`:891-917`) can already narrow to a single unfinished packet but abandons the attempt when any candidate is not `process-v3` (`:896`); and Codex keeps its own copy at `src/codex/hooks/completion-authority-check.cjs:40-41`, reachable because `src/codex/hooks/lib/spec-utils.cjs` does not export `resolvePersistedSpec`. `isDurableCloseout` (`src/claude/scripts/spec-final-state.cjs:96-102`) already says whether a packet is claiming closeout. `specs/_shared/` is already in the generated ignore rules.
- Minimum change: the Stop gate narrows to the packet that still has unfinished work, whatever layout it uses; closeout approval narrows to the packet that is actually claiming closeout; and a file the tooling writes names the feature when more than one is genuinely in play.
- Expansion signals: none. Six source files, under the eight-file threshold; no new service or class.
- User decision: C1 KEEP, after two earlier scopes were withdrawn (see Review log). The withdrawn ambition — having the gate revalidate receipts in every packet — was disproved by measurement, not by argument: auditing historical packets makes every one of their receipts fail `provenance` the moment any unrelated file is uncommitted, turning one block into a flood on nearly every turn.

## Why this is wanted
Issue #79: after upgrading with nineteen legacy packets, both Stop hooks block every turn and no user action clears it. Reproduced here: with three legacy packets, both hooks block; the documented escape is an explicit feature target that nothing writes.

The reporter also observed that the gate's receipt revalidation never runs, because identity is decided first. That was reproduced too — with one packet a missing receipt is reported, with three the same violation is answered with `multiple active specs detected`. After this packet the active feature resolves and **its** receipts are validated by the existing single-candidate path, which runs every closeout layer. Receipts in finished packets stay unaudited, deliberately; see Measured limits.

## Measured behaviour (prototype, 2026-09-15)
A working prototype was built and run before this plan was written, because two earlier plans were written first and both were wrong.

- Repository shaped like the report — eighteen finished legacy packets plus one active: the Stop gate goes from `multiple active specs detected (…19 names…)` to silent, and closeout approval stops naming the finished packets.
- Two packets genuinely claiming closeout: still ambiguous without a target; writing `specs/_shared/active-feature.json` resolves it.
- Precedence measured directly: a host payload naming `beta` beats a file naming `alpha`; with no payload the file is used; a blank or malformed value is ignored rather than treated as a malformed target.
- Constrained suites (`spec-gate`, `completion-authority`, `codex-hooks`, `specs-v2-execution-closeout`, `develop-contract`): **219 pass, 2 fail**, and adding the target file adds no further failure. The two failures are the same case on both platforms and are addressed by AC-04.

## Measured limits
- **Receipts in packets the gate did not resolve are not revalidated.** Measured: four finished packets with valid committed receipts produce four `provenance` failures the moment one unrelated file is uncommitted, because `receiptBindingMode` (`src/claude/scripts/spec-receipt.cjs:217-218`) rebinds every receipt in the repository when the tree is dirty. Auditing them is therefore not viable without changing what receipt binding means, which is out of scope here.
- **Whoever can write files in the repository can influence which packet the gate inspects.** That is already true today by editing a `Status:` line, renaming a directory, or adding a packet; the target file makes it explicit and leaves a trace in the working tree instead of being invisible. An environment variable was rejected for exactly that reason, consistent with `src/claude/hooks/spec-gate.cjs:207` treating a worker-writable flag as not an authorization.
- **Two packets genuinely claiming closeout still block** until the target file names one.

## Out of scope
- Changing receipt binding so historical packets can be audited. It is the real remaining gap and deserves its own packet, its own review, and its own decision about what a receipt attests to.
- An environment variable as a target source.
- Archival support for `specs/_archive/**`, and migration guidance for the `feature_name` requirement.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | The Stop gate resolves the one packet with unfinished work, whatever layout, and never reaches the bulk branch with a legacy candidate | modify | `src/claude/scripts/spec-resolver.cjs` | settled — decide by task state, keep the bulk branch process-first only | critical — the bulk branch exits before four closeout layers | source + installed |
| CP-02 | Closeout approval counts only packets claiming closeout, on both platforms | modify | `src/claude/scripts/spec-resolver.cjs`, `src/codex/hooks/completion-authority-check.cjs`, `src/codex/hooks/lib/spec-utils.cjs` | settled — one packet still resolves whatever its status | critical — narrowing that dropped a packet awaiting approval would delete a one-time approval requirement | source |
| CP-03 | A recorded active feature resolves a genuine ambiguity, a host target still wins, and the approval prompt names what is being approved | add | `src/claude/scripts/spec-resolver.cjs`, `src/claude/hooks/spec-gate.cjs`, `src/claude/hooks/completion-authority-check.cjs`, `src/claude/hooks/completion-authority.cjs` | settled — read only at the outer call sites, never inside the recursive extractor | elevated — a target that overrode a host-supplied one, or an unnamed approval prompt, would let a worker redirect or disguise a closeout | source |
| CP-04 | Documentation records the two narrowing rules, the target file, and the limits | modify | `docs/installer-architecture.md`, both changelogs | settled | routine | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the Stop gate resolves more than one candidate and exactly one has unfinished work, the resolver shall return that candidate whatever its `layoutKind`; when it cannot reduce to one, it shall return the bulk-audit set only if every candidate is `process-v3`, and otherwise leave the existing ambiguity untouched. Cases `35`, `36`, and `47` in `spec-gate.test.js` shall keep their current outcomes. | `node --test src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/spec-narrowing.test.js` |
| AC-02 | When a no-target scan finds more than one packet, `resolvePersistedSpec` shall consider only packets for which `isDurableCloseout` is true: one shall resolve to it, none shall resolve to `null`, several shall keep the ambiguity error naming only those. When it finds exactly one packet it shall return that packet regardless of status. Codex shall reach the same result through the shared function rather than its own count. | `node --test src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/spec-narrowing.test.js` |
| AC-03 | When `specs/_shared/active-feature.json` names a feature and the caller supplied no target, both Stop hooks shall treat it as the explicit target; when the caller supplied one, the caller's shall win; when the value is absent, blank, or malformed it shall be ignored and shall not become an `explicit_malformed` error. The approval prompt shall name the feature it is asking approval for. | `node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/completion-authority.test.js` |
| AC-04 | `claude: explicit target resolves before sibling ambiguity while no target remains ambiguous` and its `codex:` twin shall assert the new contract: with one packet at `closeout` and one at `implementation` and no target, the closeout packet shall resolve and an approval shall be demanded, rather than an ambiguity block. The change shall be recorded as a deliberate contract change, not a relaxed assertion. | `node --test src/claude/hooks/__tests__/completion-authority.test.js` |
| AC-05 | Documentation shall state both narrowing rules, the target file and its precedence, and the three measured limits; both changelogs shall carry a `Fixed` entry naming issue #79. | `node scripts/run-skill-self-tests.mjs` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Each Stop hook narrows by the question it actually asks | AC-01, AC-02, AC-04 | `src/claude/scripts/spec-resolver.cjs`, `src/codex/hooks/completion-authority-check.cjs`, `src/codex/hooks/lib/spec-utils.cjs`, `bin/__tests__/spec-narrowing.test.js`, `src/claude/hooks/__tests__/completion-authority.test.js` | - | done |
| 02 | A recorded active feature answers a genuine ambiguity | AC-03 | `src/claude/scripts/spec-resolver.cjs`, `src/claude/hooks/spec-gate.cjs`, `src/claude/hooks/completion-authority-check.cjs`, `src/claude/hooks/completion-authority.cjs` | task-01-narrow-by-the-right-question.md | pending |
| 03 | Documentation records the rules and the limits | AC-05 | `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | task-02-record-the-active-feature.md | pending |

All commands run from `packages/spec`; paths beginning `docs/` are repository-root relative and are reached from a static probe as `../../docs/...`.

## Review log
- Round 1 (2026-09-15): three fresh-context reviewers, all CONCERNS, 37 raw findings deduplicated to 15. The first plan was withdrawn, not patched. Three of its stated facts were wrong — a legacy task-status vocabulary that does not exist (`validate-spec-output.cjs:39` allows only `pending`, `in_progress`, `blocked`, `done`), a Codex `spec-receipt.cjs` "fork" that is a 120-line delegating shim, and a count of two resolution paths where there are three. Its design routed legacy packets into the bulk branch, which exits before four closeout layers.
- Round 2 (2026-09-15): two reviewers on the rewrite, both CONCERNS. The rewrite still failed: its narrowing predicate excluded `isDurableCloseout` packets to protect pending approvals, but a normally-closed legacy packet always satisfies `isDurableCloseout`, so nothing narrowed and the reported bug remained. Verified by direct probe of all four legacy closing shapes.
- Prototype round (2026-09-15): paper review was exhausted, so the third design was built and measured before this plan was written. It disproved the "audit every packet" ambition by measurement and produced every number in Measured behaviour. One earlier prototype error is recorded because it nearly shipped: removing the dirty-tree rebinding rule for *all* packets also removes it for the packet being worked on, which is the rule that catches marking a task done and then editing the code. That is why the binding change is out of scope rather than included.
- Accepted from review and carried into this plan: the bulk branch keeps its own layout guard rather than relying on a guard removed elsewhere; a lone packet resolves whatever its status, because four existing cases require it; the target file is read only at the outer call sites, because the extractor recurses and is shared with consumers that are not these hooks; and the approval prompt names its feature, because a worker that can influence resolution must not be able to obtain an approval the user cannot identify.
