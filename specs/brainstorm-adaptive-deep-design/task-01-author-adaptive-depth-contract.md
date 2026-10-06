# Task 01 — Author adaptive-depth Brainstorm contract

Status: done

## Outcome
Brainstorm keeps its Direct fast route and produces deeper, evidence-calibrated, Specs-ready decisions only when material risk warrants them.

## Coverage
- CP-01: Direct precedence, deterministic Standard/Deep selection, exact flags.
- CP-02: relevant-only Deep lenses and bounded decomposition.
- CP-03: source visual/advice authority and redaction behavior.
- CP-04: fresh provenance-aware default chat decision brief.

## Scope
- In: adaptive depth, relevant Deep lenses, feasibility/confidence/disposition, exact visual/advice overlays, decision brief, and semantic weakening guards.
- Out: HTML generator, new supervisor, persistence engine, workflow dispatch, implementation, live-model claims, or timing proof.

## Ownership
- Modify: `packages/spec/src/claude/skills/brainstorm/SKILL.md`
- Modify: `packages/spec/src/claude/skills/brainstorm/references/question-framework.md`
- Modify: `packages/spec/src/claude/agents/brainstormer.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/src/claude/skills/specs/SKILL.md`

## Acceptance
- Route Direct before depth or overlays. For non-direct work, use this ordered rule: bounded single-surface work without material risk is Standard; critical safety/security risk, public compatibility or data migration, cross-service state/concurrency, costly or irreversible rollback, or unresolved feasibility at a material boundary is Deep; absent a Deep signal, select Standard. Three independent subsystems are split into bounded work, not collapsed into Deep.
- Parse a leading control segment only: any order, each of exact `--deep`, `--visual`, and `--advice` at most once; `--` ends controls. After `--` or the first content token, every token is user content. An unknown or duplicate `--*` inside the leading segment stops with usage and no action. Parse controls, then route Direct before applying them. `--deep` raises only non-direct depth and `--visual` changes presentation only.
- Apply a Deep lens only on its named trigger and record `skipped: <reason>` otherwise: feasibility for an unresolved material boundary; stakeholders for externally affected roles; system boundaries for cross-component state; reversibility and recovery for costly/irreversible failure; operability for runtime ownership; migration/rollback for data/public compatibility; testability for a material proof gap; second-order effects for downstream behavior or incentives. One viable path remains one path; `none with evidence` remains valid.
- Keep feasibility (`confirmed | plausible | unknown | infeasible`), confidence (`high | medium | low`), and disposition (`chosen | rejected | deferred`) separate, each citing its evidence or basis. Missing evidence forces feasibility `unknown` and confidence `low`. Numeric estimates require range, unit, basis, evidence, and assumptions; otherwise report `unknown`, never a factual number.
- Overlay contract: `--visual` may render inline Mermaid/ASCII for any non-direct analysis and falls back to equivalent text if rendering is unavailable; durable/external rendering requires explicit authority before invocation. `--advice` invokes the existing brainstormer only after the material-choice gate; unavailable/failing advice is labelled unavailable and controller analysis continues. Before either external visual tooling or adviser handoff, minimize and redact sensitive input. Neither overlay writes, approves, persists, dispatches, or completes work.
- The controller retains native questions, critical/final approval, persistence consent, and handoff. Specialist output is advisory only. Write/delegate/tool limits are prompt-level `[UNVERIFIED]`; shell writes are prohibited and any mutation-capable tool remains guarded by controller authority.
- Default handoff is chat Markdown with exact headings: `Target and evidence freshness`, `Outcome`, `Constraints`, `Non-goals`, `Acceptance`, `Touchpoints`, `Direction and alternatives`, `Relevant impacts and failure behavior`, `Rollout and recovery`, `Proof mapping`, `Decision register`, `Assumptions`, `Open questions`. The first section records target identity, current source revision/worktree or `[UNVERIFIED]`, evidence-as-of, and invalidation rule. Durable file output requires explicit authority and creates no machine state.
- The static checker rejects replacement and additive/mixed-polarity weakenings for every new invariant while preserving current proportional-routing guards.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes:
  - `hapo:brainstorm proportional routing contract is complete and bounded`
  - `hapo:brainstorm proportional routing checker rejects semantic weakenings`
  - `hapo:brainstorm adaptive-depth contract is complete and bounded`
  - `hapo:brainstorm adaptive-depth checker rejects semantic weakenings`
- Mutation groups: Direct precedence; ordered depth; leading flag segment/terminator/combination/duplicate behavior; lens trigger/skip; feasibility/confidence/disposition; numeric estimate evidence; pre-tool adviser/visual redaction and authority; adviser gate/fallback; chat brief freshness/headings; no persistence/dispatch authority. Every group is nonempty.
- Oracle: the green outer harness asserts an exact nonempty issue-set for each disposable mutation. Canonical bytes produce no issues and exit 0; missing, extra, or wrong issue detection makes the outer harness fail nonzero.
- Counterexample: moving `--deep` before Direct, treating `Design --dry-run semantics` as a control error, accepting `--deep=true`, or forwarding a credential to the adviser must produce its exact owning issue.
- Cleanup: mutations use disposable in-memory/temp copies; canonical bytes and worktree remain unchanged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs --static-only
✔ hapo:brainstorm proportional routing contract is complete and bounded; src/claude/skills/brainstorm/SKILL.md=209 (+21), src/claude/skills/brainstorm/references/question-framework.md=170 (-62), src/claude/agents/brainstormer.md=69 (-17); total 448/506
✔ hapo:brainstorm proportional routing checker rejects semantic weakenings; count=70
✔ hapo:brainstorm adaptive-depth contract is complete and bounded; groups=10
✔ hapo:brainstorm adaptive-depth checker rejects semantic weakenings; count=43
[skill-test] PASS: 528 focused static tests executed
Exit: 0
Reachability: --static-only -> runStaticSemanticTests() -> runBrainstormContractTests().
Negative proof: exact issue-set assertions covered 10 nonempty adaptive groups and 43 adaptive mutations.
Cleanup: canonical SHA-256 values and git status were identical before and after the command.
Review: PASS — correctness, security, scope, authority, and representative semantic guards.
```
