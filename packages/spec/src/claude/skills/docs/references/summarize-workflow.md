# Summarize Workflow

Use with `/cf:docs --summarize`.

## Goal

Create or refresh the fastest reliable project orientation artifact:

```text
<docs-root>/codebase-summary.md
```

This mode is intentionally smaller than `init` and `update`.

## Inputs

- docs root from `.claude/runtime.json` (`paths.docs`, default `docs`)
- existing `codebase-summary.md`, if present
- user focus topics, if provided
- narrowly selected source evidence

## Argument Semantics

Treat the prompt after `summarize` as focus:

| User request | Behavior |
|---|---|
| no focus | summarize current high-level project map |
| module/path focus | summarize only that area plus its dependencies |
| explicit "scan codebase" | scout the source layout before summarizing |

Do not scan the entire codebase just because summary mode was selected.

## Workflow

### Phase 1: Read Current Summary

1. Read repo instructions.
2. Read existing `codebase-summary.md` if present.
3. Identify stale claims or missing focus areas relevant to the request.

### Phase 2: Focused Scout

Read the smallest evidence set needed:

- top-level manifests and README for project identity
- the focused module/path if user supplied one
- runtime entry points and dependency boundaries needed to orient readers
- tests/config only when they clarify behavior or commands

Use `cf:scout` only if the relevant path is unclear. For a broad explicit scan, apply scout scope gating first.

### Phase 3: Write Summary

Update only `codebase-summary.md`.

Recommended sections:

1. project identity and current purpose
2. tech stack and commands verified from manifests/config
3. source layout and major boundaries
4. runtime entry points and key flows
5. data/integration notes when directly relevant
6. links to deeper docs that already exist
7. unresolved questions

Keep the result usable as an orientation document, not as a requirements spec.

### Phase 4: Validate

1. Validate docs links with `.claude/scripts/validate-docs.cjs <docs-root>` when available.
2. Respect docs size discipline; split only if summary has become a long handbook and the user asked for that work.

## Guardrails

- Do not update every docs file.
- Do not reconstruct legacy requirements in summary mode.
- Do not implement code.
- Do not convert weak source hints into verified behavior.

## Required Final Report

Report:

- summary path
- focus used
- evidence read
- validation result
- unresolved questions
