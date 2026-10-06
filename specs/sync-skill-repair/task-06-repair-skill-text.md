# Task 06 — The skill text is repaired

Status: done

## Outcome
`cf:sync` has an official rebind, a no-evasion rule, a report-only bare call, and a changed-files report checked against git, each pinned by a self-test that fails when the clause is removed or weakened.

## Scope
- In:
  - `SKILL.md`: grammar adds `rebind <feature> [<task-NN-slug.md>]` and the bare form (argument-hint and Commands block); one pointer to `references/rebind-and-audit.md`; `SKILL.md:62-64`, `sync-protocols.md:43-44` and `sync-protocols.md:47-49` reworded so a repair or downgrade happens only after the user's confirmation (D-11); net change of `SKILL.md` + `sync-protocols.md` ≤ +1 line; every `develop-contract.test.js:861-877` phrase kept.
  - `references/rebind-and-audit.md` (new): first take a `git status --porcelain -uall` snapshot. Rebind (D-13) — only `done` tasks; choose the Command as the validator does; run every selected Command verbatim, each once as one shell so output and exit cover the whole command (all `&&` links; stdout+stderr; no `| tail`, no `> log` of one link); a non-zero exit, a failure marker, or zero required tests → D-10 (`Status: blocked` with one line naming Command and exit, old Receipt kept with the non-authoritative line under `## Receipt` — exact wording fixed here), never PASS; then run the provenance command exactly as `develop/SKILL.md:142` once, write the passing Receipts from those runs, never typing, computing, or `sed`-editing Base/Head; run provenance again and, if Head moved, say so and do not claim the receipts current; re-read for one Status and one Receipt. No-evasion: never archive, move, rename or delete a packet, change the specs root, or edit `.claude/` (including `runtime.json`) or hooks to quiet the gate; a gate block is answered with evidence or a reported blocker. Bare call: audit every process-first packet under the specs root, report legacy (`spec.json`) and archive packets without touching them, write nothing, then ask with `AskUserQuestion` when the host has it, otherwise ask in text and stop (D-12); only a reply after the report that names the changes counts as confirmation. Report: after the last edit take the snapshot again (status lines plus sha256 of each listed path) and report every path whose line or hash changed, listing pre-existing changes apart (N-2).
  - `run-skill-self-tests.mjs`: pins with mutations for each clause above, plus a pin that fails when any file under `skills/sync/` contains a dollar sign followed by a digit or the word `ARGUMENTS` (handoff `$0` lesson).
- Out: hooks and scripts; Codex text; the legacy section beyond keeping it.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/skills/sync/SKILL.md`, `packages/spec/src/claude/skills/sync/references/sync-protocols.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `packages/spec/src/claude/skills/sync/references/rebind-and-audit.md`
- Read: `packages/spec/src/claude/skills/develop/SKILL.md:142`, `packages/spec/bin/__tests__/develop-contract.test.js:836-877`, `packages/spec/bin/lib/codex-install.js:195-207`, `packages/spec/src/claude/scripts/spec-receipt.cjs:151-163`, `specs/sync-skill-repair/plan.md` (D-10..D-13)

## Steps
1. Add the pins and mutations first → `pnpm --dir packages/spec test` fails on the unchanged skill naming the missing clauses.
2. Write `rebind-and-audit.md` and the `SKILL.md` grammar/pointer → pins pass; `context-budget` and the 400-line check still pass.
3. Run the `$0` pin against a mutated copy (under `mktemp -d`) holding `$1` in a shell block → it fails.

## Acceptance
- AC-04, AC-05, AC-06, AC-07, AC-08: each clause present and pinned; each mutation (clause removed, `blocked` replaced by `done`, non-authoritative line removed, provenance moved before the commands, `.claude/` exception added, "write nothing" removed, snapshot removed, hash comparison removed, `sync-protocols.md:47-49` restored to write without confirmation) makes the self-test fail.

## Dependencies
- task-05-measure-baseline.md

## Verification Plan
- Command: `pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/develop-contract.test.js && node --test packages/spec/bin/__tests__/codex-native.test.js && test -s packages/spec/src/claude/skills/sync/references/rebind-and-audit.md && ! grep -rEn '\$[0-9]|\$ARGUMENTS' packages/spec/src/claude/skills/sync`
- Named probe: new self-test labels `cf:sync rebind runs the planned command verbatim`, `cf:sync rebind never writes PASS on failure`, `cf:sync never silences the gate`, `cf:sync bare call writes nothing`, `cf:sync file report comes from a git snapshot difference`, `cf:sync rebind takes provenance once after all commands`, `cf:sync failed rebind marks the old receipt non-authoritative`, `cf:sync body has no argument placeholders`, each with its mutations; existing R7 test in `develop-contract.test.js`; `context-budget` issue in `run-skill-self-tests.mjs:2576-2578`.
- Reachability: source level; installed and live levels come from task 07.
- Oracle: exit 0; every mutation reported as rejected.
- Counterexample: deleting the "never PASS" sentence from `rebind-and-audit.md` must make the self-test exit 1.
- Artifacts: ephemeral mutation copies under `mktemp -d`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/develop-contract.test.js && node --test packages/spec/bin/__tests__/codex-native.test.js && test -s packages/spec/src/claude/skills/sync/references/rebind-and-audit.md && ! grep -rEn '\$[0-9]|\$ARGUMENTS' packages/spec/src/claude/skills/sync
Exit: 0
Base: 91038ef1aa125e0510bc003f3dff0409f2cd2507
Head: d15303cd379881ed7bbda33acbe6bede00a9761b5638a87b3addcee386e9afd6
```text
$ pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/develop-contract.test.js && node --test packages/spec/bin/__tests__/codex-native.test.js && test -s packages/spec/src/claude/skills/sync/references/rebind-and-audit.md && ! grep -rEn '\$[0-9]|\$ARGUMENTS' packages/spec/src/claude/skills/sync
# lines of the full output matching: grep -E '^✔|^\[|^# (tests|pass|fail)|cf:sync repair|ELIFECYCLE'
✔ cf:specs process-task status checker rejects 10 semantic weakenings
✔ cf:specs implementation-readiness checker rejects 30 gate-specific source mutations
✔ cf:specs adaptive coverage contract is complete and monotonic; bundle deltas: src/claude/skills/specs/SKILL.md -20, src/claude/skills/specs/references/review.md +5, src/claude/skills/specs/references/templates.md +10; total 745/750
✔ cf:specs adaptive coverage checker rejects 30 semantic weakenings
✔ cf:specs consumers load Steps and Failure Protocol; rejects 5 weakenings
✔ cf:brainstorm proportional routing contract is complete and bounded; src/claude/skills/brainstorm/SKILL.md=221 (+33), src/claude/skills/brainstorm/references/question-framework.md=170 (-62), src/claude/agents/brainstormer.md=73 (-13); total 464/506
✔ cf:brainstorm proportional routing checker rejects semantic weakenings; count=79
✔ cf:brainstorm adaptive-depth contract is complete and bounded; groups=10
✔ cf:brainstorm adaptive-depth checker rejects semantic weakenings; count=43
✔ cf:develop plan-native continuous contract is complete and bounded
✔ cf:develop plan-native checker rejects semantic weakenings
✔ cf:sync repair contract: 30 mutations rejected
✔ cf:test plan-native proof contract is complete and bounded
✔ cf:test plan-native checker rejects semantic weakenings
✔ cf:debug adaptive incident contract is complete and bounded
✔ cf:debug adaptive incident checker rejects 9 semantic weakenings
✔ cf:debug report is proportional to its stated depth and shared with its agent
✔ cf:debug proportional checker rejects 20 weakenings
✔ cf:debug agent points to the skill's two gates
✔ cf:debug agent-gates checker rejects 7 weakenings
✔ cf:fix adaptive contract is complete and bounded
✔ cf:fix checker rejects 30 semantic weakenings
✔ cf:docs adaptive contract is complete and bounded
✔ cf:docs checker rejects 18 semantic weakenings
✔ cf:research adaptive evidence contract is complete and bounded
✔ cf:research checker rejects semantic weakenings; count=25
✔ cf:route proportional installed-capability contract is complete and bounded
✔ cf:route checker rejects semantic routing weakenings
✔ cf:loop bounded experiment contract is complete and fail-closed
✔ cf:loop checker rejects unsafe semantic weakenings; count=30
✔ Specs v3 flat layout, the three gates, review, and receipt contracts survive mutations
✔ Specs v2.1 vocabulary is isolated under hierarchical Legacy sections
✔ Claude-to-Codex projection rejects Claude-only tool vocabulary
✔ Specs v2.1 task structure and ownership table are canonical
✔ Specs v2.1 V definitions expose the validator grammar and proof roles
✔ Specs v2.1 machine state and semantic receipt vocabulary are canonical
✔ Specs v2.1 canonical authoring source exposes no downgrade receipt
✔ Full runner preserves exact Node failure counts and locations
[skill-test] static semantic checks
✔ cf:specs hard output contract requires the flat packet
✔ spec-maker emits only the flat planning packet
✔ installer syncs spec-state template and drops init template
✔ installer writes CafeKit version metadata
✔ installer offers Codex as a native split-root runtime
✔ Codex split roots keep generated skill files locally ignored
✔ installer maps Claude gitignore template to dotfile
✔ Claude migration manifest includes gitignore template
✔ Claude gitignore template ignores generated session state
✔ installer root gitignore ignores runtime folders
✔ cf:specs and spec-maker never auto-dispatch Develop
✔ cf:specs frontmatter exposes only feature-description input
✔ spec-maker emits a flat packet and stops at handoff
✔ cf:ask skill answers questions with repo-first evidence
✔ cf:ask template captures answer evidence and gaps
✔ cf:ask is packaged from the ask directory and the question directory is retired
✔ cf:fix is packaged from the fix directory and the hotfix directory is retired
✔ cf:specs review requires evidence, fresh context, and bounded findings
✔ cf:specs review gives GATE-REVIEW ownership to the user and sweeps every edit
✔ cf:specs requirements template has no SDD phase marker
✔ cf:specs flow is gated GATE-SCOPE to GATE-DONE and process-first
✔ parallel-waves reference keeps single-writer, fallback, cap, and cherry-pick recipe
✔ develop SKILL wires --parallel to parallel-waves and keeps sequential default
✔ implementer is single-track with process-first and legacy state prohibition
✔ orchestrator sanctions worktree parallelism with single-writer rule and cap
✔ parallel waves isolate worktrees and retain blocked recovery state
✔ runtime template documents develop.parallel escape hatch
✔ cf:specs templates trace acceptance criteria to flat tasks and proof
✔ cf:specs plan template carries the queue-ready contract marker on line two
✔ cf:specs templates carry EARS, Example Mapping, and edge-case saturation
✔ cf:specs keeps human decisions at exactly the three named gates
✔ legacy kernel task template keeps the Specs v2.1 plan contract
✔ spec validator enforces Specs v2.1 task-plan sections
✔ spec validator blocks complex ready state before validation
✔ cf:specs inline receipt is executable and provenance-bound
✔ spec-maker separates planning from implementation and proof
✔ cf:develop scouts reachability and enforces task scope
✔ cf:develop supports explicit flash mode
✔ cf:develop makes implementation notes opt-in
✔ cf:develop implementation notes template is self-contained and block-based
✔ cf:develop quality gate separates proof, review, and closeout owners
✔ cf:develop quality gate has flash bypass semantics
✔ process-first Develop and Sync keep proof ownership explicit with isolated Legacy vocabulary
✔ cf:scout uses a focused local fast path before delegation
✔ cf:scout delegation requires permission runtime support and independent scopes
✔ quality gate uses shared verdicts instead of numeric scores
✔ inspect runtime config has no legacy Gemini model key
✔ hotfix review cycle consumes severity verdicts
✔ code-auditor speaks the shared verdict surface
✔ test-runner performs scope and runtime reachability audits
✔ cf:test supports spec-aware feature testing
✔ cf:fix is deterministic scout-first without mode selection
✔ cf:fix quick path never skips scout or diagnosis
✔ cf:fix enforces no-side-effect gate with user options
✔ cf:fix references are local and not stale debugger paths
✔ cf:git worktree branches from the current branch and hydrates ignored runtime folders
✔ cf:git worktree blueprint never hard-codes main as the base
✔ cf:fix prevention gate points back to side-effect sweep
✔ cf:fix review cycle uses pause conditions not mode selection
✔ cf:debug is diagnosis-only and read-only for product code
✔ cf:debug enforces scout-first before hypotheses
✔ cf:debug blocks hotfix handoff when root cause is unknown
✔ cf:debug references installed debugger manuals
✔ Claude runtime template exposes process-first Specs truth
✔ Codex runtime template exposes process-first Specs truth
✔ Claude wrapper keeps runtime delta without template Language or Addressing
✔ all runtime instruction templates carry local venv guidance
✔ Codex instruction template avoids global Claude skills path
✔ Codex warning describes local hook bypass risk
✔ state cache carries full project, session, and spec identity
✔ shared resolver keeps explicit target and fail-closed ambiguity
✔ rules hooks stay silent when runtime.json is absent
✔ CafeKit skill routing workflow rule maps core flows
✔ CafeKit skill routing domain rule maps core and optional skills
✔ cf:docs skill is present in the optional document bundle
✔ cf:docs --reconstruct keeps as-is evidence contract
✔ cf:docs --reconstruct reference defines output and human review gate
✔ cf:docs --reconstruct templates keep evidence and overview starters
✔ cf:docs --reconstruct overview template is self-contained
✔ cf:docs normal docs references keep init update summarize phases
✔ cf:docs --init reference keeps scout author validate discipline
✔ cf:docs --update reference reads existing docs before surgical updates
✔ cf:docs --summarize reference avoids broad codebase scans by default
✔ docs validator accepts configured docs root argument
✔ reconstruct validator is packaged and enforces evidence IDs
✔ reconstruct validator requires overview and bundle registry
✔ CafeKit no longer installs automatic skill router hook
✔ strategist keeps the AgentKit autonomy contract and claims no execution proof
✔ model escalation reaches the strategist before the user and grants no authority
✔ completion policy states both receipt modes and the invention limit
✔ Codex carries the same completion policy, since it does not auto-load Claude rules
✔ workflow rule points at one home for the binding policy instead of copying it
✔ Specs machine boundary records what the gate cannot detect
✔ installer architecture documents omp coverage and gaps
✔ installer architecture documents grok compatibility
✔ installer architecture documents completion gate identity
✔ installer architecture documents orca awareness
✔ installer architecture documents hook portability
✔ CafeKit runtime config drives shared hook config
✔ CafeKit migration manifest excludes removed skill router files
✔ CafeKit installer cleans obsolete skill router runtime and settings hooks
✔ CafeKit rules hook injects only project-specific reminders
✔ docs sync respects runtime docs path
✔ cf:specs SKILL stays lean after slim-flow diet
✔ cf:develop SKILL stays within directional context budget
✔ cf:specs complete shipped bundle stays at or below 750 lines
✔ process-first Develop and Sync core stays at or below 400 lines
✔ docs-sync.cjs has no shouting banners
✔ workflow routing keeps proportional and authority boundaries
✔ usage hook reads runtime config from hook cwd
✔ statusline layout contract keeps registry, fallback, cost gate, and weekly anchors
✔ repository guide documents statusline configuration
✔ package guide documents statusline configuration
✔ statusline colors respect runtime config
✔ templates expose all five EARS forms and measurable wording
✔ templates route ambiguity without guessing outcomes
✔ review contract keeps evidence-backed saturation and runtime-only third round
✔ task template Compact core is per-surface parsed (behavioral)
✔ design template Compact core is per-surface parsed (behavioral)
✔ Specs skill keeps scope and proof boundaries explicit
✔ review keeps user decisions and the bounded paper stop
✔ spec-maker keeps planning separate from dispatch and proof
✔ specs-usage-guide documents the flat packet and canonical inline receipt
✔ specs-usage-guide documents adaptive routing without timing claims
✔ specs-usage-guide documents plan-native Develop without timing or live-adherence claims
✔ Codex installed projection uses Codex paths (behavioral, temp fixture)
✔ benchmark tuning targets are per-surface explicit (advisory, not waiver)
✔ specs-usage-guide teaches Develop and Sync without leaking v2.1 vocabulary
✔ ported review rule keeps decision precedence without reversal loopholes
✔ ported process rule keeps ownership, port, and cleanup discipline
✔ ported rules survive the Codex transform as rename-only
✔ Specs primary flow is file-first while legacy kernel remains isolated
[skill-test] skill catalog checks
✔ skill catalog script lists installed CafeKit skills
✔ skill catalog JSON mode is machine-readable
[skill-test] installer migration fixtures
✔ settings template and manifest agree on 15 hooks
✔ installer migrates old skill-router runtime to rule-based routing
✔ installer upgrade preserves configured locale.responseLanguage
[skill-test] instruction install fixtures
✔ Wave 1 real installs cover both runtimes, missing-runtime silence, vi localization, and combined idempotence
[skill-test] spec artifact validator fixtures
✔ spec validator accepts valid fixture
✔ spec validator rejects triage-like invalid fixture
✔ spec validator rejects copied canonical contract blocks in Specs v2 tasks
[skill-test] reconstruct docs validator fixtures
✔ reconstruct validator accepts valid fixture
✔ reconstruct validator rejects incomplete evidence bundle
[skill-test] package Node tests
# tests 525
# pass 524
# fail 0
[skill-test] hook behavioral tests
# tests 226
# pass 226
# fail 0
[skill-test] chrome-devtools script tests
# tests 42
# pass 42
# fail 0
[skill-test] pdf bounding-box tests
[skill-test] retired completion-policy sentence is gone from the payload
[skill-test] source tree stays free of hook state
[skill-test] code-review and code-auditor keep the review boundary
[skill-test] PASS: 1611 tests executed
# tests 69
# pass 69
# fail 0
# tests 35
# pass 35
# fail 0
```
Full output: `evals/results/sync/kept/task-06-verification.out` (5745 lines, sha256 `365d248cb7d91157cef611cc054c50fd4f0a22419560615a66c8f71367c4c684`; gitignored working-tree evidence).
Notes: the reference `rebind-and-audit.md` was written before its pins (the pre-change run failed on sync-rebind-grammar, sync-pointer, sync-audit-confirm only); `packages/spec/bin/__tests__/codex-native.test.js` (outside this task's ownership) gained the new reference in its structured-input corpus oracle, a consumer the plan missed; open Low notes from review: the "Re-read each edited task" step and the "directly under its `## Receipt` heading" position have no pin, and the line budget is at 400/400.
