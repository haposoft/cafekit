# Task 07 — `spec.scaffold_guard` deprecated

Status: done

## Outcome
`spec.scaffold_guard` stays valid in every shipped and existing `runtime.json` but the schema says plainly that nothing reads it, the same way `usage` was retired.

## Scope
- In: `runtime.schema.json` `spec.properties.scaffold_guard` (`:58-62`) — add `"deprecated": true`; description starts with "Not honoured." and says the task-scaffold guard that read it was removed and the key is kept so existing files stay valid (pattern: `usage` at `:75-79`).
- In: `runtime-schema.test.js` `keys the runtime does not honour are marked deprecated, not documented as working` (`:86-95`) — iterate dotted paths `['hooks', 'develop', 'usage', 'spec.scaffold_guard']` resolved through `properties`, with the same three assertions.
- Out: the three `runtime.json` files (unchanged, `scaffold_guard: true` stays — `src/claude/runtime.json:18`, `src/codex/runtime.json:16`, `src/omp/runtime.json:16`); `spec.completion_gate` (still read by `spec-gate`).

## Coverage
- CP-05

## Ownership
- Modify: `src/claude/runtime.schema.json`, `bin/__tests__/runtime-schema.test.js`

## Steps
1. Edit the schema node, then the test list.
2. Run the Command.

## Acceptance
- AC-07: the schema test passes with `spec.scaffold_guard` in the deprecated list, and the shipped `runtime.json` files keep the key and stay described by the schema.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3b-07.txt; rm -f $F; node --test bin/__tests__/runtime-schema.test.js > $F 2>&1; tail -6 $F; grep -q '^# fail 0$' $F && grep -qE '^ok [0-9]+ - keys the runtime does not honour are marked deprecated, not documented as working$' $F && grep -q 'spec\.scaffold_guard' bin/__tests__/runtime-schema.test.js && node -e 'const n=require("./src/claude/runtime.schema.json").properties.spec.properties.scaffold_guard; if (n.deprecated !== true || !/^Not honoured/.test(n.description)) process.exit(1); for (const r of ["claude","codex","omp"]) if (require("./src/" + r + "/runtime.json").spec.scaffold_guard !== true) process.exit(1)' && rm -f $F`
- Named probe: `keys the runtime does not honour are marked deprecated, not documented as working`; `every key in each shipped runtime.json is described by the schema`.
- Reachability: source — the schema the installer copies to every runtime (`codex-runtime.js:69-76`, `omp-runtime.js:99-108`).
- Oracle: exit 0; `# fail 0`; the named `ok` line; the `node -e` check exits 0 (today it exits 1: no `deprecated`).
- Counterexample: removing the key from a `runtime.json` or from the schema (`additionalProperties: false`) fails the `node -e` check or `every key in each shipped runtime.json is described by the schema`; a description that only says "deprecated" fails `/^Not honoured/`.
- Artifacts: `/tmp/ck-3b-07.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-07.txt; rm -f $F; node --test bin/__tests__/runtime-schema.test.js > $F 2>&1; tail -6 $F; grep -q '^# fail 0$' $F && grep -qE '^ok [0-9]+ - keys the runtime does not honour are marked deprecated, not documented as working$' $F && grep -q 'spec\.scaffold_guard' bin/__tests__/runtime-schema.test.js && node -e 'const n=require("./src/claude/runtime.schema.json").properties.spec.properties.scaffold_guard; if (n.deprecated !== true || !/^Not honoured/.test(n.description)) process.exit(1); for (const r of ["claude","codex","omp"]) if (require("./src/" + r + "/runtime.json").spec.scaffold_guard !== true) process.exit(1)' && rm -f $F`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: 9999f63888803721d8d03fb20c1c22b0ee586b59faab8c1aa0d58a5f4b4b8a94
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# pass 7
# fail 0
```
Implemented by the controller. Pre-change run exited 1 (the schema node had no `deprecated`). The deprecated-key test now walks dotted paths so `spec.scaffold_guard` resolves to spec.properties.scaffold_guard; the three runtime.json files keep `scaffold_guard: true`.
