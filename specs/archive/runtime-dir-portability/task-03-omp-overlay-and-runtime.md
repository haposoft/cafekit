# Task 03 — The omp fork is an overlay and an omp-only install injects rules

Status: done

## Outcome
`src/omp/hooks/` contains only the files that genuinely differ from Claude: `privacy-block.cjs`, `task-scaffold-guard.cjs`, `lib/omp-tool-names.cjs`. `omp-runtime.js` copies the portable Claude tree and overlays them, so a Claude hook change cannot silently miss omp. The install ships `.omp/runtime.json` and its schema, `provenance.cjs` ignores omp state roots, and `.omp/hooks/rules.cjs` prints `## Rules` on an omp-only project.

## Scope
- In: shrink the fork, change the copy strategy, ship the omp runtime file with a defined key set, extend `RUNTIME_STATE_ROOTS`, extend the schema test.
- Out: the content of the three overlay files beyond re-basing them on the portable Claude versions.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/omp/hooks/` (delete every file not in the overlay; re-base the three that remain)
- Create: `packages/spec/src/omp/runtime.json`
- Modify: `packages/spec/bin/phases/omp-runtime.js`
- Modify: `packages/spec/src/claude/scripts/provenance.cjs`
- Modify: `packages/spec/bin/__tests__/omp-hooks.test.js`, `bin/__tests__/omp-runtime.test.js`, `bin/__tests__/runtime-schema.test.js`

## Acceptance
- AC-05: `diff -rq src/claude/hooks src/omp/hooks` lists exactly the three overlay files; `omp-runtime.js` copies `src/claude/hooks` then `src/omp/hooks` over it; the three contract edits are still pinned by `omp-hooks.test.js`.
- AC-06: `--platform omp` into a project with no `.claude/` yields `.omp/runtime.json` with `codingLevel: 1`, `usage.enabled: false`, and no statusline keys; `.omp/runtime.schema.json` beside it; `runtime-schema.test.js` lists `src/omp/runtime.json` among the runtimes it validates; running `.omp/hooks/rules.cjs` with a session id prints `## Rules`.
- AC-07: `RUNTIME_STATE_ROOTS` in `provenance.cjs` includes `.omp/hooks/.logs` and `.omp/runtime.json`, and `develop-contract.test.js`'s state-root case covers them.

## Dependencies
- task-02-route-runtime-paths.md

## Verification Plan
- Command: `node --test bin/__tests__/omp-hooks.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/runtime-schema.test.js bin/__tests__/develop-contract.test.js`
- Named probe: `the fork differs from Claude only by its overlay`, `an omp-only install injects rules`, `every shipped runtime.json is described by the schema` (now three), and the state-root case in `develop-contract.test.js`.
- Reachability: known — real installer into a temp project; installed hook run as a child process.
- Oracle: diff allow-list exact; `## Rules` present; schema test enumerates three runtimes; state-root case green.
- Counterexample: leaving a fourth file in the fork must fail the diff case; shipping no `runtime.json` must fail the rules case; omitting `.omp/*` from the state roots must fail the state-root case.
- Artifacts: ephemeral, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/omp-hooks.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/runtime-schema.test.js bin/__tests__/develop-contract.test.js
Exit: 0
Base: 8885085c9037462aba2fe56e5d2bff60f25420a7
Head: e12e2cd9db388715c9c8325af3bfd26cf74c29f6a7e0915cd504edef908693e1
```text
$ node --test bin/__tests__/omp-hooks.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/runtime-schema.test.js bin/__tests__/develop-contract.test.js
ℹ tests 90
ℹ suites 0
ℹ pass 90
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
