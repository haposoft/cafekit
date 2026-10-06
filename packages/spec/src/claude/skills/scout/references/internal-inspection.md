# Conditional Discovery with Explore Subagents

Use native Explore agents only after the delegation gate in `SKILL.md` ("Delegate only when …") passes.
Focused discovery stays in the main agent even when Explore is available.

## Delegation Preconditions

All are required:

1. The user explicitly requested or permitted delegation or parallel agents.
2. The active runtime exposes an Explore/delegation capability.
3. The structure map identifies at least two distinct, non-overlapping scopes
   with useful independent work.

If any precondition fails, use scoped `rg`, file listing, and targeted reads in
the main agent. Do not request extra authority for an ordinary focused scout.

## Two-Phase Broad Scout

Use when the scope is broad; delegate only when the gate is open.

1. **Structure map** (main agent, or one Explore agent once the gate is open): list the scope
   root's immediate children and monorepo markers, estimate files per directory, and return a
   division plan of 1–10 sub-scopes (path or glob, estimated files, focus).
2. **Parallel scout**: merge sub-scopes under 10 files and split those over 100; spawn Explore agents
   on distinct sub-scopes, or scout them sequentially in the main agent when the gate is closed; then
   aggregate into the findings `SKILL.md` asks for.

## Agent Tool Configuration

```
subagent_type: "Explore"
```

## Prompt Template

```
Quickly search {DIRECTORY} for files related to: {USER_PROMPT}

Instructions:
- Search for relevant files matching the task (Glob/Grep)
- Read-only: do not edit, write, or run anything that changes state
- Report each relevant file as `path:line` with one clause on why

Report format:
## Relevant Files
- `path/file.ext:line` - why it matters
## Entrypoint and Call Path
- where the behavior starts, then each hop
## Blast Radius
- callers, tests, config a change would touch
## Unknowns
- what this scope could not settle
```

## Spawning Strategy

Split by logical dirs (`src/`, `lib/`, `tests/`, `config/`, `api/`, `types/`).
Spawn agents concurrently only when the runtime supports it; keep scopes
distinct and non-overlapping.

**Example** (auth): A1 `src/auth/, middleware/`; A2 `api/, routes/`; A3 `tests/`; A4 `lib/, utils/`; A5 `config/`; A6 `types/`.

## Task Registration (Optional)

| Agents | Create Tasks? |
|--------|--------------|
| ≤ 2    | No (overhead) |
| ≥ 3    | Yes |

Use the live task or plan surface when available. Record scope and ownership
before spawn, then completion or non-response after collection. Do not create task
state solely for one or two short probes.

## Aggregation and Reading

- Skip agents that do not respond; do not restart them; dedupe paths; note gaps under Unknowns
- Stay under ~150K tokens; ~500 lines/chunk; max 3–5 small files or 1 large file chunked (`chunks = ceil(total_lines / 500)`); Read with offset/limit

## Scope Discipline

Start from concrete directories (not repo root); prefer scoped globs; skip `NO_SCAN_PATHS` / `NO_SCAN_CONTENT_HINTS` from SKILL.md; if still broad, narrow first.

## Output Contract

Return the findings `SKILL.md` names — relevant files as `path:line`, entrypoint and call path, blast radius, patterns, unknowns — for the controller to merge and fold into the caller's report.
