# Task 05 — The Stop gate runs on omp because the shared scripts are shipped

Status: done
## Outcome
`--platform omp` ships `.omp/scripts/` alongside `.omp/hooks/`. The installed `spec-gate.cjs`, `completion-authority.cjs`, `spec-state.cjs`, and `task-scaffold-guard.cjs` load their `../scripts/*.cjs` dependencies and answer with a real verdict instead of `Completion gate unavailable`.

## Scope
- In: gating the scripts copy on the `scripts` capability rather than the `agents` capability, and a test that runs the installed omp gate.
- Out: any change to the scripts themselves, the hooks, or the bridge.

## Coverage
- CP-01 (extends the "complete omp runtime" outcome that task 01 claimed and did not deliver)

## Ownership
- Modify: `packages/spec/bin/phases/copy-payload.js`
- Modify: `packages/spec/bin/__tests__/omp-runtime.test.js`
- Read: `packages/spec/bin/lib/context.js`
- Read: `packages/spec/src/claude/hooks/spec-gate.cjs`

## Acceptance
- AC-13: after `--platform omp` into a temp git project with a `specs/` root, `.omp/scripts/workflow-policy.cjs` and `.omp/scripts/spec-receipt.cjs` exist, and running `.omp/hooks/spec-gate.cjs` with a Stop payload does not print `Completion gate unavailable`.
- Claude and Codex installs are unchanged: both had `agents: true` and `scripts: true`, so the new gate is a superset for them; `bin/__tests__/codex-native.test.js` and `package-inventory.test.js` stay green.

## Dependencies
- task-01-register-omp-platform.md

## Verification Plan
- Command: `node --test bin/__tests__/omp-runtime.test.js`
- Named probe: the `an omp install ships the scripts the Stop gate needs` case in `bin/__tests__/omp-runtime.test.js`.
- Reachability: known — the test drives the real installer and runs the installed hook as a child process, the technique already used by `secret-output-guardrail.test.js`.
- Oracle: both script files exist; the gate's stdout contains no `Completion gate unavailable`.
- Counterexample: restoring the `agents` gate at `copy-payload.js:159` must fail the case.
- Artifacts: ephemeral `fs.mkdtempSync` directories removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/omp-runtime.test.js
Exit: 0
Base: 0fe9c8692811062935801d25280fe54a02200c8f
Head: 88c706ae07202b4c57450c0a1be1c85f259adfbddf3ca4c41625a3299072807a
```text
$ node --test bin/__tests__/omp-runtime.test.js
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
