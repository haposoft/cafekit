# Update Workflow

Use with `/cf:docs --update`.

## Goal

Refresh existing living docs after code or project-state changes without rewriting docs that are already accurate.

## Inputs

- docs root from `.claude/runtime.json` (`paths.docs`, default `docs`)
- existing docs under that root
- recent source changes when git context is available
- relevant source code, tests, schemas, config, CI, deploy files
- any additional user focus in the prompt

## Workflow

### Phase 0: Preflight

1. Read repo instructions and docs root.
2. Verify the docs root exists.
3. If the docs root does not exist, switch to `init` or explain that no docs baseline exists. A post-task checkpoint entry never switches to `init`; it reports the gap and recommends an explicit `/cf:docs --init` invocation instead.
4. Identify update focus:
   - user-named module or doc
   - recent source diff
   - docs-sync stale hash signal (run `echo '{}' | node .claude/hooks/docs-sync.cjs` from the project root)
   - a full docs refresh only when user asks for it

### Phase 1: Source Change Scout

Scout source areas that can affect docs:

1. Compare git change context when available.
2. Map changed files to affected topics:
   - product capability/PDR
   - architecture or module boundaries
   - commands/config/deployment
   - design/code standards
   - roadmap/changelog state
3. Run targeted source reads for evidence.
4. Use `cf:scout` only when the affected scope is unclear or broad.

Do not treat commit messages as sufficient evidence. Verify changed behavior in code, tests, config, or schemas.

### Phase 1.5: Existing Docs Read

Read existing docs before edits.

Use document count and file size to decide reading strategy:

| Docs set | Reading strategy |
|---|---|
| 1-3 markdown files | Read directly |
| 4-6 markdown files | Split across 2-3 readers only when the Delegation Gate in `../SKILL.md` is open |
| 7+ markdown files | Split across up to 5 readers by LOC and topic through the same open gate |

When the gate is closed, read the set sequentially in the main agent.

Each reading pass extracts:

- document purpose
- claims that may be affected
- related cross-links
- stale or contradictory sections
- unresolved questions already present

Merge source scout and docs readings before writing.

### Phase 2: Surgical Docs Update

Delegate to `docs-keeper` only through the Delegation Gate in `../SKILL.md`; when the gate is closed, apply the same discipline in the main agent. The update must stay surgical:

1. Edit only affected docs and sections.
2. Remove or rewrite stale claims when source evidence contradicts docs.
3. Preserve useful human-written context not contradicted by evidence.
4. Add new links only after verifying targets.
5. Record remaining unknowns instead of inventing migration guidance or architecture.

Common update targets:

| File | Update when |
|---|---|
| `README.md` | setup, usage, command entry points changed |
| `project-overview-pdr.md` | actors, capabilities, constraints, status changed |
| `codebase-summary.md` | structure, stack, runtime map changed |
| `code-standards.md` | real conventions or required commands changed |
| `system-architecture.md` | components, data flow, integrations, deployment changed |
| `deployment-guide.md` | build/deploy/env/config changed |
| `design-guidelines.md` | design system or UI conventions changed |
| `project-roadmap.md` | milestone/project state changed |

### Phase 3: Size Check

1. Check docs LOC after updates.
2. Use `docs.maxLoc` when provided; default to 800.
3. Split large documents on semantic boundaries if this update pushes them over the limit.
4. Report oversized docs left unchanged when splitting is outside the user scope.

### Phase 4: Validation And Sync

1. Run `.claude/scripts/validate-docs.cjs <docs-root>` when available.
2. Treat warnings as review signals; fix resolvable broken links and clearly state remaining warnings.
3. Update `<docs-root>/.sync_hash` only after docs are accurately synchronized with the code version being documented.

## Additional Requests

Apply extra user instructions only within docs scope. Do not start product implementation from a docs update prompt.

## Required Final Report

Report:

- docs root used
- source changes/scopes reviewed
- docs changed and docs intentionally untouched
- stale claims corrected
- validation result
- unresolved questions

If a requested change belongs to future behavior rather than current project docs, recommend:

```text
/cf:specs <change request>
```
