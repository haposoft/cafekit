# Task 01 — Author the adaptive docs contract

Status: done

## Outcome
`hapo:docs` gates every delegation behind the scout Delegation Gate, consumes the Develop/Sync docs-impact handoff through an explicit post-task checkpoint, states the smallest-adequate principle, and has every invariant guarded by a static mutation checker.

## Coverage
- CP-01, CP-02, CP-03, CP-04

## Scope
- In: edit `SKILL.md` (add the Delegation Gate section, the post-task docs checkpoint section with its no-affected-doc escape path, the smallest-adequate principle; bump to 2.0.0; keep mode routing, output roots, evidence rules, and the `Reconstruction Is Not Specs` gate intact); align the ungated delegation wording in `init-workflow.md` and `update-workflow.md` (both the `docs-keeper` handoff and the reader-split table); place the checkpoint entry in `standard-docs-workflow.md` as the shared-contract home; add the adaptive docs contract, mutation groups, and forbidden-pattern assertions to the static harness; keep the twelve existing docs probes enforced, updating them coherently where anchors move.
- Out: reference renames or template overhaul; `summarize-workflow.md` and `reconstruct-workflow.md` beyond mechanical cross-reference fixes; docs-keeper agent; validator script logic; docs-sync hook; projection tests and guides (task 02).

## Ownership
- Modify: `packages/spec/src/claude/skills/docs/SKILL.md`
- Modify: `packages/spec/src/claude/skills/docs/references/init-workflow.md`
- Modify: `packages/spec/src/claude/skills/docs/references/update-workflow.md`
- Modify: `packages/spec/src/claude/skills/docs/references/standard-docs-workflow.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/src/claude/skills/inspect/references/internal-inspection.md`, `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/src/claude/rules/manage-docs.md`

## Acceptance
- AC-01: a Delegation Gate section reproduces the three canonical clauses from `packages/spec/src/claude/skills/inspect/references/internal-inspection.md:10-13` (explicit user request/permission for delegation or parallel agents; runtime Explore/delegation capability; at least two distinct, non-overlapping scopes with useful independent work); the four currently ungated delegation sites (`SKILL.md:224`, `update-workflow.md:70`, the reader-split table at `update-workflow.md:55-56`, `init-workflow.md:87`) route through it, each with its own mutation coverage; without the gate the workflow continues in the main agent with the same verification discipline.
- AC-02: a post-task docs checkpoint section consumes the Develop/Sync handoff: `none` means report only with no docs edit; `minor`/`major` update only affected existing docs; a checkpoint never invents a new document and never turns into `--init` without an explicit user request. When `minor`/`major` finds no affected existing doc (including a missing docs root), the checkpoint reports the gap and recommends an explicit `/hapo:docs --init` or `--update` invocation, creating nothing — this entry path overrides the default mode selection at `SKILL.md:45-49` and `update-workflow.md:23`, and carries its own mutation anchor.
- AC-03: evidence taxonomy (`Type: Observed | Inferred | Unknown`), the `Reconstruction Is Not Specs` prohibitions, and validator-before-handoff (`validate-docs.cjs`, `validate-docs-reconstruct.cjs`) each keep their anchors present, guarded by a mutation group and at least one forbidden-pattern assertion (e.g. an added "the prohibitions above are advisory" escape must produce its owning issue).
- AC-04: the harness gains `hapo:docs adaptive contract is complete and bounded` and `hapo:docs checker rejects semantic weakenings` with one nonempty mutation group per invariant above, while the twelve existing docs probes (`run-skill-self-tests.mjs:4578-4679`) stay enforced — a probe whose anchor string moves is updated coherently with equivalent-or-stronger assertions plus a replacement mutation group; probe deletion is caught by the code-review diff check, not by the proof command. Version metadata bumps to 2.0.0.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probe: `hapo:docs adaptive contract is complete and bounded`; `hapo:docs checker rejects semantic weakenings`; plus the twelve existing docs probes at `run-skill-self-tests.mjs:4578-4679` (coherently updated where anchors move)
- Reachability: `--static-only -> runStaticSemanticTests() -> docs contract tests` (same wiring as the debug/fix adaptive checkers)
- Oracle: canonical bytes produce zero issues and exit 0; each disposable mutation produces its exact owning nonempty issue set; missing, extra, or wrong issue detection fails the outer harness nonzero.
- Counterexample: removing a Delegation Gate clause, letting a `minor` checkpoint create a new document, a missing docs root silently auto-selecting `init` from a checkpoint entry, dropping `Inferred` from the evidence taxonomy, or allowing reconstruction to create `specs/<feature>/` must each produce its owning issue.
- Artifacts: none durable — mutations run on disposable in-memory copies; canonical file SHA-256 values and `git status` must be identical before and after the command.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs --static-only
✔ hapo:docs adaptive contract is complete and bounded
✔ hapo:docs checker rejects 18 semantic weakenings
✔ hapo:docs skill is present in the optional document bundle
✔ hapo:docs --reconstruct keeps as-is evidence contract
✔ hapo:docs --reconstruct reference defines output and human review gate
✔ hapo:docs --reconstruct templates keep evidence and overview starters
✔ hapo:docs --reconstruct overview template is self-contained
✔ hapo:docs normal docs references keep init update summarize phases
✔ hapo:docs --init reference keeps scout author validate discipline
✔ hapo:docs --update reference reads existing docs before surgical updates
✔ hapo:docs --summarize reference avoids broad codebase scans by default
✔ docs validator accepts configured docs root argument
✔ reconstruct validator is packaged and enforces evidence IDs
✔ reconstruct validator requires overview and bundle registry
[skill-test] PASS: 528 focused static tests executed
Exit: 0
Reachability: --static-only -> runStaticSemanticTests() -> runDocsAdaptiveContractTests().
Negative proof: exact issue-set assertions covered 5 nonempty invariant groups and 18 docs mutations; all four delegation sites carry their own mutation and every invariant has at least one forbidden-pattern assertion.
Cleanup: mutations ran on in-memory copies; git status was identical before and after the command.
Review: PASS — code-auditor initial FAIL (1 High: fourth delegation site lacked its own mutation) was remediated with the prescribed mutation plus the optional standard-file mutation, verified by the same reviewer; 1 Low hardening note remains non-blocking.
```
