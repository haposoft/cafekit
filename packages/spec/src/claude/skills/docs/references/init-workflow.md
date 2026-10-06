# Init Workflow

Use with `/cf:docs --init`.

## Goal

Create a first evidence-backed documentation baseline for a repository that already has source code but lacks useful project docs.

The first run should make future agents faster without presenting guesses as project truth.

## Inputs

Resolve the docs root from `.claude/runtime.json` first. Default to `docs/`.

Read or scout:

- `README.md`, `CLAUDE.md`, `AGENTS.md`, and root instructions that exist
- package/workspace manifests, lock files, build config, runtime config
- source directories that actually exist
- tests, migrations, schemas, routes, CI, deployment config
- current docs root if it exists but is incomplete

Do not hardcode `src/` when a project uses `apps/`, `packages/`, `cmd/`, `internal/`, `modules/`, or another structure.

## Required Baseline

Create or update the useful core docs below:

| File | Purpose | Creation rule |
|---|---|---|
| `README.md` | Entry point and quick commands | Update if needed; keep concise |
| `<docs-root>/project-overview-pdr.md` | Product purpose, actors, capabilities, constraints | Core |
| `<docs-root>/codebase-summary.md` | Project structure, tech stack, major runtime paths | Core |
| `<docs-root>/code-standards.md` | Observed conventions, commands, code quality rules | Core |
| `<docs-root>/system-architecture.md` | Boundaries, components, runtime/data flow | Core |
| `<docs-root>/project-roadmap.md` | Current state, milestones, known follow-up areas | Core when evidence exists |
| `<docs-root>/deployment-guide.md` | Build/deploy/runtime config | Optional when deployment evidence exists |
| `<docs-root>/design-guidelines.md` | UI/design conventions | Optional when UI evidence exists |

Do not create a large document solely to fill the table. If a core file cannot be grounded yet, create the smallest useful shell and put unresolved questions at the end.

## Workflow

### Phase 0: Preflight

1. Read repo instructions and runtime docs root.
2. Detect whether docs already exist.
3. If user specifically asked `--init` and docs exist, preserve existing content:
   - read it first
   - merge or add missing baseline sections
   - do not overwrite human-written docs blind
4. Build a no-scan list for ignored, generated, vendor, cache, secret, and credential paths.

### Phase 1: Structure Scout

Run a lightweight source scout before deep reading:

1. List top-level directories and key manifests.
2. Count file/LOC shape by existing source areas where practical.
3. Identify project type:
   - language/framework
   - package manager/build system
   - app/service boundaries
   - UI/API/worker/job/deployment surfaces
4. Split large repositories into scoped source areas.

Use `cf:scout` when source discovery spans multiple directories. Prefer targeted reads when the repo is small.

### Phase 2: Evidence Scout

Collect evidence for docs authorship:

| Topic | Evidence examples |
|---|---|
| Tech stack | package manifests, `go.mod`, `pyproject.toml`, build files |
| Commands | scripts, Makefiles, CI jobs |
| Runtime entry points | app bootstrap, routes, controllers, server main files |
| Data model | schemas, migrations, models, DTOs |
| Architecture | imports between modules, service boundaries, deploy config |
| Testing | test commands, test directories, fixtures |
| UI/design | shared components, tokens, styles, screenshots when present |

Merge scout results into a concise context summary. Keep file references with each important claim.

### Phase 3: Docs Authoring

Delegate the merged context to `docs-keeper` only through the Delegation Gate in `../SKILL.md`. Otherwise follow its verification discipline in the main context.

Authoring rules:

1. Read code before documenting code.
2. Verify referenced paths, commands, config keys, endpoints, and symbols before naming them.
3. Record observed conventions as observed; do not turn folder guesses into standards.
4. Use relative links among docs only after confirming targets exist.
5. Add unresolved questions to any doc whose important claim is not yet verifiable.

### Phase 4: Size Discipline

After generation:

1. Check markdown LOC in the docs root.
2. Use `docs.maxLoc` from session/runtime context when provided; default to 800 lines.
3. If a file crosses the limit:
   - split on semantic boundaries
   - make an `index.md` for the topic when a document becomes a folder
   - keep links from the original entry point
4. Report any intentionally accepted oversized file.

### Phase 5: Validation And Tracking

1. Run `.claude/scripts/validate-docs.cjs <docs-root>` when available.
2. Fix broken internal doc links that can be resolved from evidence.
3. If docs-sync uses `<docs-root>/.sync_hash`, update it only after the docs reflect current source state.

## Required Final Report

Report:

- docs root used
- source areas scouted
- files created or updated
- validation result
- evidence gaps
- unresolved questions

Recommended next command:

```text
/cf:docs --update
```

after meaningful source changes.
