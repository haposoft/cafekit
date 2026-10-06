# Standard Docs Workflow

Use this shared contract for `/cf:docs --init`, `/cf:docs --update`, and `/cf:docs --summarize`.

Then load the mode-specific reference:

- `init-workflow.md`
- `update-workflow.md`
- `summarize-workflow.md`

## Purpose

Create or refresh living project documentation from the current repository.

This workflow is for normal project docs. If the user asks to reconstruct current behavior from a legacy/existing system, use `reconstruct-workflow.md` instead.

## Inputs

- `README.md`
- existing `docs/` files
- package manifests and workspace config
- source directories such as `src/`, `app/`, `apps/`, `packages/`, `lib/`
- tests, build scripts, CI config, deployment config

## Output Files

Use the docs root from `.claude/runtime.json` (`paths.docs`, default `docs`).

Recommended files:

```text
docs/
├── project-overview-pdr.md
├── codebase-summary.md
├── system-architecture.md
├── code-standards.md
├── design-guidelines.md
├── deployment-guide.md
└── project-roadmap.md
```

Create only files that are useful. Minimum viable documentation is preferred over a large stale docs set.

## Shared Workflow Decisions

### 1. Decide Operation

`init`:
- docs missing or clearly incomplete
- create baseline docs

`update`:
- docs exist
- compare recent code changes and update only affected docs

`summarize`:
- update only `codebase-summary.md`

Post-task checkpoint entry (from Develop/Sync docs impact):
- `none` reports only; `minor`/`major` update only affected existing docs per the checkpoint contract in `../SKILL.md`
- a checkpoint never invents a new document and never auto-selects `init`

### 2. Scout And Verify

Normal docs are current-state living docs. Ground them in:

- repo instructions
- existing docs and README
- package/workspace/build/runtime config
- source code that implements the documented behavior
- tests, CI, deploy config, schemas, migrations, routes when relevant

Use `cf:scout` or targeted `rg`/file reads when the project is large. Keep broad scanning scoped by real project areas.

### 3. Author Concisely

Follow these rules:

- prefer short sections over huge narrative
- document real code, not aspirations
- keep generated docs easy to review
- include unresolved questions at the end
- remove or rewrite stale claims when evidence contradicts existing docs
- verify paths, commands, config keys, endpoints, and symbols before naming them

### 4. Keep The Core Docs Legible

The Research docs workflow uses a size check after generation and update. CafeKit keeps that rule:

- read `docs.maxLoc` from session/runtime context when available
- default to 800 lines per markdown document
- split large topics by semantic boundary instead of expanding one omnibus file

### 5. Sync Tracking

If the project uses `docs/.sync_hash`, update it only after docs accurately reflect the current source state.

Use the same docs root as runtime config:

```text
<docs-root>/.sync_hash
```

### 6. Validate

When available, run:

```text
node .claude/scripts/validate-docs.cjs <docs-root>
```

Use validation output to catch broken internal doc links before reporting.

### 7. Final Report

Report:

- files created/updated
- code areas reviewed
- stale docs corrected
- unresolved questions

## Guardrails

- Do not run broad full-repo reads when targeted scout is enough.
- Do not invent architecture from folder names alone.
- Do not modify product code.
- Do not overwrite user-written docs without reading them first.
