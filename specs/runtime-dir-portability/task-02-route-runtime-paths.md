# Task 02 — Reads, writes, and advice go through the helper

Status: done

## Outcome
Every category-A and A′ site and every reachable category-C string in `src/claude/hooks` uses `runtime-dir.cjs`. The five fixtures that copy hooks by hand also copy the helper. The hook suite and the two installer suites pass at their prior counts.

## Scope
- In: the 22 category-A sites, the 2 A′ literals, and the ≈20 reachable category-C strings listed in `plan.md`; the five fixture allow-lists.
- Out: category B (`~/.claude/`), category D (dead modules), and skill paths, which derive from `PLATFORMS[*].skillsRef` rather than the runtime dir because omp keeps skills under `.agents/skills`.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/hooks/rules.cjs`, `agent.cjs`, `inspect-block.cjs`, `usage.cjs`, `spec-state.cjs`, `task-scaffold-guard.cjs`, `session.cjs`, `state.cjs`, `completion-authority.cjs`, `semantic-review-authority.cjs`, `spec-gate.cjs`, `privacy-block.cjs`, `lib/config.cjs`, `lib/hook-state-dir.cjs`
- Modify: `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`, `state.test.js`, `semantic-review-authority.test.js` (allow-lists only)
- Modify: `packages/spec/bin/__tests__/develop-contract.test.js`, `bin/__tests__/specs-v2-execution-closeout.test.js` (allow-lists only)
- Modify: `packages/spec/bin/__tests__/runtime-dir.test.js`
- Read: `packages/spec/bin/lib/context.js`

## Acceptance
- AC-02: with `src/claude/hooks/` and `src/claude/scripts/` copied under `<tmp>/.omp/`, a sentinel in `<tmp>/.omp/runtime.json` is reflected by `rules.cjs` (docs path), `inspect-block.cjs` (`inspect.enabled:false` allows a broad search), `privacy-block.cjs` (`privacyBlock:false` allows a `.env` read), and `spec-gate.cjs` (`spec.completion_gate` present → the "worker-writable flag" block); no `.claude` path exists in `<tmp>`.
- AC-03: `node --test src/claude/hooks/__tests__/*.test.js` reports its baseline count green; `develop-contract.test.js` and `specs-v2-execution-closeout.test.js` likewise.
- AC-04: under `.omp/`, `task-scaffold-guard.cjs` advises `node .omp/scripts/spec-scaffold.cjs`, `inspect-block.cjs`'s disable hint names `.omp/runtime.json`, and `agent.cjs` names `.agents/skills/`; under `.claude/` the same strings name `.claude/…` and `.claude/skills/`.
- `semantic-review-authority.cjs:85` accepts any platform basename the installer produces instead of the literal `claude`; `hook-state-dir.cjs:35` labels the source-run log directory with the derived name.
- After the edits, a grep for `'.claude'` and `.claude/` in `src/claude/hooks/*.cjs` outside `__tests__` matches only the 13 category-B lines and the 20 category-D lines.
- The projectRoot resolution change on omp is stated in the commit: detection now succeeds for a dotted folder, so `__dirname`-derived root wins over `PROJECT_ROOT`/`payload.cwd`; `spec-state.cjs:80` is aligned to the same rule.

## Dependencies
- task-01-derive-runtime-dir.md

## Verification Plan
- Command: `node --test bin/__tests__/runtime-dir.test.js && node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js`
- Named probe: `a hook tree copied under .omp reads .omp/runtime.json` (four hooks), `advice names the directory the hook lives in`, plus every existing case in the three suites as regression guard.
- Reachability: known — hooks run as child processes from the copied tree with `scripts/` present, as `installClaudeGate` already does for Claude.
- Oracle: sentinels reflected; advice strings match; suite counts unchanged and green.
- Counterexample: leaving any one listed read on the literal `.claude` must fail that hook's sentinel case; omitting `lib/runtime-dir.cjs` from any allow-list must fail that fixture's suite.
- Artifacts: ephemeral, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/runtime-dir.test.js && node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js
Exit: 0
Base: ddf85c8fe1914869b85d2a6b49ee093ccb6e6c68
Head: cb88555f16bd5d78c7b5ae7168150cb4068e356c258e3ad03a2e0d848cc0f4aa
```text
$ node --test bin/__tests__/runtime-dir.test.js && node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ tests 219
ℹ suites 0
ℹ pass 219
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ tests 78
ℹ suites 0
ℹ pass 78
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
