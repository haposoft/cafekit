# Task 02 — The forked hooks speak omp's vocabulary

Status: done
## Outcome
`src/omp/hooks/` holds a hook tree derived from `src/claude/hooks/` with three omp-specific contract changes: lowercase tool names are recognised, the privacy hook denies where it would ask, and an unevaluable access denies rather than allows.

## Scope
- In: the forked tree and its omp-specific contract changes.
- Out: `src/claude/hooks/`, which does not change. Shared libraries with no omp-specific behaviour are materialized from the Claude source at install time rather than copied into the fork, following `bin/phases/codex-runtime.js:81,88,95`.

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/src/omp/hooks/` (forked scripts and omp-specific libraries)
- Create: `packages/spec/bin/__tests__/omp-hooks.test.js`
- Read: `packages/spec/src/claude/hooks/privacy-block.cjs`
- Read: `packages/spec/src/codex/hooks/privacy-block.cjs`
- Read: `packages/spec/src/claude/settings/settings.json`

## Acceptance
- AC-04: a payload naming tool `bash` reaches the same command-scanning branch that `Bash` reaches today, and the same holds for `read`, `edit`, `write`, and `grep`. Verified against `src/claude/hooks/privacy-block.cjs:182`, which compares the Claude name exactly.
- AC-05: where `src/claude/hooks/privacy-block.cjs:191-198` emits `permissionDecision: "ask"`, the omp fork emits a denial, because omp's `tool_call` result has only `block` and `reason`. `src/codex/hooks/privacy-block.cjs` is the precedent for this substitution.
- AC-06: where `src/claude/hooks/privacy-block.cjs:239-245` catches an unexpected error and asks, the omp fork denies. The identifier surfaces this protects are the ones listed in that hook's own pattern table, including `.env*`, `credentials*`, `*.pem`, `*.key`, `id_rsa`-class keys, `.netrc`, `.pgpass`, and `kubeconfig`.

## Dependencies
- task-01-register-omp-platform.md

## Verification Plan
- Command: `node --test bin/__tests__/omp-hooks.test.js`
- Named probe: the `lowercase omp tool names hit the same rules`, `the privacy hook denies where Claude asks`, and `an unevaluable access denies` cases in `bin/__tests__/omp-hooks.test.js`.
- Reachability: known — the tests run each forked hook as a real child process over stdin, the same way `bin/__tests__/secret-output-guardrail.test.js` already drives installed hooks.
- Oracle: a `bash` payload carrying a secret-bearing path is denied; the same payload with an ordinary path is allowed; a malformed payload is denied.
- Counterexample: leaving the exact `=== 'Bash'` comparison in the fork must fail the first case; keeping `permissionDecision: "ask"` must fail the second; making the catch-all allow must fail the third.
- Artifacts: ephemeral temporary directories from `fs.mkdtempSync`, removed in `finally`. Mutation checks run only on copies inside those directories, never on tracked source.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/omp-hooks.test.js
Exit: 0
Base: 9854d9e348cc5910700e0e09eb469c97e2cc86ab
Head: 8e05daceec59f5c96ff5db372b83b524f40b692d821fa3f2d983836eefe4d3c2
```text
$ node --test bin/__tests__/omp-hooks.test.js
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
