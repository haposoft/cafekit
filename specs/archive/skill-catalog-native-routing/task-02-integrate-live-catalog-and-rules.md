# Task 02 — Integrate live catalog and rules

Status: done

## Outcome
Shared rules and generated catalogs resolve capability slots from the current installed inventory rather than a copied command list.

## Scope
- In: capability-first rules; proportional workflow rule; runtime-bound catalog root; strict frontmatter/duplicate diagnostics; retired automatic-routing exclusion synchronized with the manifest.
- Out: UserPromptSubmit dispatch, model scoring, persistent routing state, or installation of missing capabilities.

## Coverage
- CP-01
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/rules/skill-domain-routing.md`
- Modify: `packages/spec/src/claude/rules/skill-workflow-routing.md`
- Modify: `packages/spec/src/claude/scripts/generate-skill-catalog.cjs`
- Modify: `packages/spec/src/codex/AGENTS.md`
- Create: `packages/spec/bin/__tests__/skill-routing-source.test.js`

## Acceptance
- AC-02: abstract links resolve against the current catalog and preserve the shortest valid chain.
- AC-03: missing capabilities and agents fall back safely without fabricated invocations.
- AC-04: optional document routes appear only when their metadata is installed.
- AC-03: malformed, missing-name/description, folder-mismatched, and duplicate public names are omitted with diagnostics; duplicate names require explicit user disambiguation.
- AC-03: preserved retired CafeKit skills remain physically untouched but are ineligible for automatic routing; explicit user-owned invocation remains outside the generated router decision.

## Dependencies
- task-01-author-native-router-contract.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/skill-routing-source.test.js`
- Named probe: `skill routing consumes live catalog without fixed optional commands`; `skill catalog exposes discriminating routing metadata`
- Reachability: the focused source test executes the scanner fixtures, reads both routing rules, and proves the Codex `AGENTS.md` entrypoint directs the runtime to them; Task 03 separately observes installed projections.
- Oracle: source, core-only, document-enabled, and divergent combined-runtime catalog fixtures bind to their own runtime roots, choose only valid present capabilities, and preserve explicit-only Loop behavior.
- Counterexample: Codex reads Claude skills in a combined install; a core-only catalog emits Docs; malformed or duplicate frontmatter becomes routable; a modified retired skill auto-routes; copied inventory becomes authority; Loop becomes implicit; direct Ask is forced through Route.
- Artifacts: temporary catalog fixtures only, removed after the command.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/skill-routing-source.test.js
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ skill routing consumes live catalog without fixed optional commands
✔ skill catalog exposes discriminating routing metadata
✔ skill catalog rejects a missing root value before path resolution
ℹ tests 3
ℹ pass 3
ℹ fail 0
ℹ skipped 0
```
