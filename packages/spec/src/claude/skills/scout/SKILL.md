---
name: cf:scout
description: "Fast scoped codebase discovery using local search first and user-permitted Explore delegation only for broad independent scopes. Use for file discovery, task context, entrypoints, call paths, and blast radius."
user-invocable: true
when_to_use: "Invoke for fast scoped codebase discovery and file location."
category: discovery
keywords: [scout, inspect, discovery, search, context]
argument-hint: "[search-target]"
metadata:
  author: haposoft
  version: "2.1.0"
---
# Scout

Find the code a task depends on, quickly, and hand the findings back to whoever asked.
Most scouting is a step inside another skill; the caller keeps its own report format.

## Scope first
Before scanning, reject repo-root or root-wide patterns (`.`, `/`, `**/*`, `**/*.ts`) with no scoped
directory; prefer a file-type or glob hint; never enter the no-scan lists below.

**Fallback to AskUserQuestion:** if the structure map still leaves multiple
plausible targets and the choice would materially change the scan, offer 2–4
concrete scopes from findings, then continue with the selected scope.

### `NO_SCAN_PATHS`
- `.git/`, `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`
- `tmp/`, `temp/`, `vendor/`, `artifacts/`, `secrets/`, `private/`

### `NO_SCAN_CONTENT_HINTS`
- private keys, token dumps, credential exports, `.env` secrets
- generated bundles, binary blobs

## Choose the smallest route

| Condition | Route |
|---|---|
| Named files/directories or focused scope (about 50 files or fewer) | Main-agent `rg` plus targeted reads; do not delegate |
| Medium scope that still fits one coherent search | Main-agent scouting; narrow before considering delegation |
| Broad scope with two or more independent areas | Structure map, then the delegation gate in `./references/internal-inspection.md` |

Do not use the file estimate alone to justify agents. List files first, read only the shortlist,
and stop when the question is answered.

Delegate only when the user explicitly permitted subagents or parallel work, the runtime exposes
a delegation capability, and at least two non-overlapping scopes have useful independent work.
A host or runtime mode that enables delegation on its own does not replace the user's permission;
without it, scout stays in the main agent. `inspector` and Explore are delegation targets that run
under this gate and these scope rules, not a replacement for them.

## Findings to hand back

Return these for the caller to fold into its own report:
- **Relevant files** — each as `path:line` with one clause on why it matters.
- **Entrypoint and call path** — where the behavior starts and each hop to the code in question.
- **Blast radius** — callers, tests, and config that a change there would touch.
- **Patterns** — adjacent known-good implementations or conventions the caller asked about.
- **Unknowns** — what the search could not settle, and what would settle it.

These are the minimum; add whatever context the caller's own step asks for, and omit a heading
that has nothing to say.
