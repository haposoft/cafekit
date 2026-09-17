# CafeKit

> Native spec-driven workflows for Claude Code and Codex CLI.

## Quick Install

```bash
npx @haposoft/cafekit
```

Install Codex explicitly:

```bash
npx @haposoft/cafekit --platform codex
```

The installer records the package version in the selected runtime:
`.claude/cafekit.json` or `.codex/cafekit.json`.

Document and multimodal skills are optional. Choose them in the interactive
installer, or opt in explicitly:

```bash
npx @haposoft/cafekit --with-document-skills
```

Use `--without-document-skills` to skip them or remove pristine CafeKit-owned
copies from an existing install. User-modified skill files are preserved.

## What It Is

CafeKit installs a native runtime bundle for each supported coding agent:
- `cf:ask` for evidence-backed questions about source code, docs, specs, config, dependencies, or external technical knowledge
- `cf:scout` for fast scoped discovery of files, entrypoints, call paths, and blast radius
- `cf:brainstorm` for unresolved product or architecture choices, with proportional routing before delivery
- `cf:research` for proportional, traceable evidence when a technical decision remains uncertain
- `cf:route` for ambiguous, multi-step, multi-domain, or elevated-risk work that needs the shortest valid installed chain
- `cf:loop` for explicit-only, bounded numeric optimization in an isolated worktree
- `cf:specs` for structured specification work
- `cf:develop` for implementation after technical spec readiness and an explicit invocation
- `cf:debug` and `cf:fix` for evidence-first diagnosis and root-cause repairs — every repair consumes the debug handoff before mutation; Quick/local stays direct; Standard and Incident/deep bound outcome, constraints, non-goals, and acceptance; complex repairs use post-diagnosis research, brainstorm, and staged planning only when the evidence leaves a real decision; all depths retain shared `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED` verdicts
- optional `cf:docs`, DOCX, PDF, PPTX, XLSX, and multimodal skills when selected during install — `cf:docs` consumes a post-task docs checkpoint (`none | minor | major`, updating only affected existing docs), gates delegation behind the Delegation Gate, and keeps the `Observed | Inferred | Unknown` evidence taxonomy
- `cf:test` and `cf:code-review` for verification
- supporting hooks, agents, rules, and platform-native runtime integration
- a configurable Claude statusline driven by `.claude/runtime.json` — `"statusline"` picks the mode (`full`/`compact`/`minimal`/`none`), `statuslineColors` toggles ANSI colors, and an optional `statuslineLayout` (`{ "lines": [["model", "context"], ["directory", "git"]] }`) composes lines from the section ids `model`, `context`, `quota`, `directory`, `git`, `plan`, `cost`, `changes`; leaving the key out keeps the default output unchanged

CafeKit uses rule-based skill routing guidance and an installed skill catalog.
Agents choose the right `cf:*` skill from workflow/domain rules instead of
using an automatic prompt-scoring hook.

Skill loading uses progressive disclosure: catalog metadata identifies a
candidate, its selected `SKILL.md` defines the contract, and only its needed
references are read. Invoke a valid installed skill directly; escalate to
`cf:route` only when classification or chaining is material. If a skill or
agent is absent, continue inline when safe or name the gap—never invent it.
Hooks are not a skill router and do not auto-select skills. Source and installed
projection parity is tested; live-model adherence remains `UNPROVEN` and is not
deterministic.

Core routes (shown with Claude Code syntax):

```text
Feature: Idea -> /cf:brainstorm (if choices remain) -> explicit /cf:specs -> /cf:develop -> /cf:test -> /cf:code-review
Bug/failure: /cf:debug -> /cf:fix only when the user requested a fix
Product/architecture exploration: /cf:brainstorm -> chat recommendation -> stop
Uncertain technical decision: /cf:research -> traceable evidence -> decision handoff
Explicit numeric optimization: /cf:loop -> bounded isolated experiments -> patch handoff
```

## Quick Start

Claude Code:

```bash
/cf:ask "Which config file controls CafeKit runtime behavior in this project?"
/cf:scout "Find the runtime entrypoints for skill installation"
/cf:brainstorm Explore approaches for a meeting transcript extension
/cf:research Compare current local-first search libraries for this repository
/cf:loop Goal="reduce parser latency" Scope="packages/parser" Metric="median ms, lower" Baseline="pinned base" Guard="npm test" Noise="MAD; minimum delta 2%" Budget="10 iterations" Stop="budget, drift, or failed guard"
/cf:specs Build a meeting transcript extension with AI summaries
/cf:develop meet-transcript-mvp
/cf:test --full
/cf:code-review --pending
```

Codex CLI uses native skills from `.agents/skills/`:

```text
$cf-ask "Which config controls CafeKit runtime behavior?" --repo
$cf-scout "Find the runtime entrypoints for skill installation"
$cf-brainstorm Explore approaches for a meeting transcript extension
$cf-research Compare current local-first search libraries for this repository
$cf-loop Goal="reduce parser latency" Scope="packages/parser" Metric="median ms, lower" Baseline="pinned base" Guard="npm test" Noise="MAD; minimum delta 2%" Budget="10 iterations" Stop="budget, drift, or failed guard"
$cf-specs Build a meeting transcript extension with AI summaries
$cf-develop meet-transcript-mvp
$cf-test --full
$cf-code-review --pending
```

Use `/skills` to browse installed skills. Trust the repository, then review
project hooks with `/hooks` before enabling them.

### Research versus Loop

Research answers an uncertain decision. It selects Quick, Standard, or Deep
depth, uses repository evidence for local fit, and attaches source, authority,
date/version, applicability, and confidence state to material claims. It does
not implement the recommendation or guarantee that it is correct.

Loop is never selected automatically. Use it only when Goal, isolated Scope,
finite numeric Metric and Direction, reproducible Baseline, distinct Guard,
noise policy and minimum delta, budget, and stop conditions are explicit. It
experiments in a detached worktree and returns a base-bound patch handoff; it
does not apply, commit, push, or guarantee an improvement.

With the optional document skills installed, existing or legacy systems can use:

```bash
/cf:docs --reconstruct apps/legacy-admin
/cf:specs Modernize the approved as-is docs with CSV export and split admin/operator permissions
```

The reconstruct run writes an evidence-backed as-is docs bundle plus a self-contained HTML overview for human review before specs begin.

Specs are stored under:

```text
specs/<feature>/
├── plan.md
├── task-01-<slug>.md
└── task-NN-<slug>.md
```

## Spec Output

Process-first Specs packets are flat and hand-editable. `plan.md` is the
index; each `task-NN-<slug>.md` lives beside it and owns one outcome.

- GATE-SCOPE — scope, before the plan is written.
- GATE-REVIEW — findings, after adversarial review.
- GATE-DONE — done, after execution proof and receipts.

`plan.md` keeps the GATE-SCOPE scope decision, EARS acceptance criteria, explicit
exclusions, and a task table. Every acceptance criterion must map to at least
one task and one proof command.

Each task file keeps exactly one `Status:` field. A task is complete only when
its inline canonical `## Receipt` is current and contains the exact command,
`Exit: 0`, `Verification: PASS`, runtime-derived `Base` and `Head`, and a
fenced block with current command output.

### Legacy compatibility

Existing features that already have `spec.json`, nested `tasks/task-R*.md`, or
separate receipt files stay on the installed legacy adapter. Keep `spec.json`,
`task_registry`, `planning_depth`, `assurance_level`, `lane`, `execution_tier`,
and `semantic_model` there only; new Specs output does not author them.

Claude Code and Codex CLI are the primary Specs v2 acceptance targets.

## Platform Status

- Claude Code: native supported runtime
- Codex CLI: native project-local runtime with `.agents/skills`, `.codex/agents`, project hooks, rules, and a managed `AGENTS.md` block
- OpenCode: support removed in 0.17 (last supported release: 0.16.x)
- Cursor: coming soon

## Documentation

- Installation: https://cafekit.haposoft.com/docs/getting-started/installation
- Quickstart: https://cafekit.haposoft.com/docs/getting-started/quickstart
- Spec workflow: https://cafekit.haposoft.com/docs/workflows/specs

## License

MIT © Haposoft
