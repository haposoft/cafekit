# Task 05 — Documentation records grok compatibility and its limits

Status: done

## Outcome
The installer architecture document has a Grok CLI section stating how grok reaches the CafeKit gates, what it cannot carry, and where the evidence stops; the Hook portability section names the payload reader as the second portability seam; both changelogs carry a `Fixed` entry; a static probe keeps the section honest.

## Scope
- In: a `## Grok CLI` section in `docs/installer-architecture.md` covering: grok reads the Claude install through `[compat.claude]` (skills, rules, agents, MCP, hooks) with every cell default on; grok sends a camelCase envelope with its native tool names and `lib/hook-payload.cjs` normalizes it inside every hook, so `.claude/settings.json` needs no grok edits; `CLAUDE_PROJECT_DIR` is set by grok for every hook; project hooks run only after trust; **only four control-flow channels exist** (`PreToolUse` deny, `UserPromptSubmit` block, `Stop` block, exit 2), so the six context-injecting hooks are normalized but never reach the model; denials emit a JSON deny on stdout because grok reads only the first stderr line; `usage.cjs` is deliberately unrouted because it reads Claude Code credentials and calls the network; grok fails open where omp fails closed; the three `[UNVERIFIED]` items with the command that would settle each; `[compat.claude] hooks = false` is unsupported; the `--platform grok` alias installs the Claude runtime and adds no detection hint. The Hook portability section gains one sentence naming the reader as the second seam (directory, then envelope). Both changelogs gain a `Fixed` entry under `[Unreleased]`, since the shipped state was a silent fail-open under grok. One static probe in `runStaticSemanticTests()`.
- Out: README platform lists; entries under a released version heading; the overlay sentences and their probe (task 03).

## Coverage
- CP-05

## Ownership
- Modify: `docs/installer-architecture.md`
- Modify: `packages/spec/CHANGELOG.md`
- Modify: `docs/project-changelog.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-06 as stated in `plan.md`.
- The probe asserts the section heading, the phrase "normalizes grok's camelCase envelope", the `[compat.claude]` mention, the trust requirement, `CLAUDE_PROJECT_DIR`, the four-channel limit, the `usage.cjs` exclusion, and the unsupported `hooks = false` note.
- The changelog entries are filed under `Fixed`, dated 2026-09-08, name the fail-open defect plainly, and state the limit in the same breath so no reader concludes grok gets the full CafeKit experience.

## Dependencies
- task-03-fold-omp-aliases.md
- task-04-grok-platform-alias.md

## Verification Plan
- Command: `node scripts/run-skill-self-tests.mjs`
- Named probe: `installer architecture documents grok compatibility` in `runStaticSemanticTests()`.
- Reachability: known — same shape as `installer architecture documents hook portability`; `--static-only` runs it in seconds for the counterexample.
- Oracle: suite PASS with the probe executed.
- Counterexample: deleting the Grok CLI section must fail the probe under `--static-only`; deleting only the four-channel sentence must also fail it.
- Artifacts: none.

## Receipt

Verification: PASS
Command: node scripts/run-skill-self-tests.mjs
Exit: 0
Base: f57d6d72ed6e2d5972e4f1193890de3d6c06650e
Head: 497099f8cb0a2c900fc91b6b8d7703eba2295a378c1268783d67eb3cda91c6e4
```text
$ node scripts/run-skill-self-tests.mjs
✔ installer architecture documents grok compatibility
…
Ran 1 test in completion policy wording
[skill-test] source tree stays free of hook state
Ran 1 test in source tree cleanliness
[skill-test] PASS: 1301 tests executed
```

Counterexamples ran against the tracked document and restored it byte-identical each time. Deleting the Grok CLI section failed the probe; so did changing only the sentence that states the four control-flow channels, which is the limit a reader is most likely to lose.
