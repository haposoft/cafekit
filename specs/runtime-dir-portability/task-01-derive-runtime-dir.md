# Task 01 — A hook knows its own runtime directory

Status: done
## Outcome
`src/claude/hooks/lib/runtime-dir.cjs` exports `runtimeDirName()`, `runtimeDir(cwd)`, and `runtimePath(cwd, ...segments)`. The name is derived from the module's own location and is correct for every layout the installer produces and for the source tree.

## Scope
- In: the helper and a unit test covering every layout, including the precedence rule.
- Out: any call site.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/hooks/lib/runtime-dir.cjs`
- Create: `packages/spec/bin/__tests__/runtime-dir.test.js`
- Read: `packages/spec/src/claude/hooks/lib/hook-state-dir.cjs`

## Acceptance
- AC-01: `<X>/hooks/lib/runtime-dir.cjs` yields `basename(<X>)` when it starts with a dot; `packages/spec/src/<platform>/hooks/lib/…` yields `.`+`<platform>`; anything else yields `.claude`. When a path is both dotted and contains the source marker, the dotted basename wins. There is no `derived` flag; the helper returns a string.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/runtime-dir.test.js`
- Named probe: `installed layouts derive their own folder`, `the source tree maps platform to dotted name`, `a dotted folder wins over the source marker`, `an unknown layout falls back to .claude`.
- Reachability: known — the test copies the helper into temp directories shaped like each layout and requires it from there, the technique `secret-output-guardrail.test.js` uses for installed hooks.
- Oracle: each layout yields the expected name.
- Counterexample: hardcoding `.claude` inside the helper must fail the `.omp` and `.codex` installed cases; checking the source marker before the basename must fail the precedence case.
- Artifacts: ephemeral `fs.mkdtempSync` directories removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/runtime-dir.test.js
Exit: 0
Base: 8eb354129dbc43000a9cbd140b58eb5134fdd85c
Head: 41ce58dd6c6231b27a3674ab18cc2bdb18ca3dcc44d23bbefcf9326d5e3e34bb
```text
$ node --test bin/__tests__/runtime-dir.test.js
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
