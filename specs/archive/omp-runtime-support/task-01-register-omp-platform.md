# Task 01 — `--platform omp` installs a complete omp runtime

Status: done
## Outcome
`node bin/install.js --platform omp` creates `.omp/hooks/`, `.omp/extensions/`, and `.omp/cafekit.json`, and adds `.omp/` to the project ignore rules. Installing any other platform leaves `.omp/` absent.

## Scope
- In: the `PLATFORMS` entry, a dedicated install phase that copies the forked tree and the bridge, and the ignore rule.
- Out: the content of the forked hooks (task 02) and the bridge logic (task 03). This task installs whatever those directories hold; it is verified against directory and metadata presence, never against gate behaviour.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/bin/lib/context.js`
- Modify: `packages/spec/bin/install.js`
- Modify: `packages/spec/bin/phases/root-config.js`
- Create: `packages/spec/bin/phases/omp-runtime.js`
- Create: `packages/spec/bin/__tests__/omp-runtime.test.js`
- Read: `packages/spec/bin/phases/codex-runtime.js`

## Acceptance
- AC-01: after `--platform omp`, `.omp/hooks/` contains the gate scripts, `.omp/extensions/` exists, and `.omp/cafekit.json` records `platform: "omp"`. The bridge file itself is authored by task 03, so this task owns the directory, not its contents — the first draft required a file this task cannot write, which the round 1 review flagged.
- AC-02: after `--platform claude` alone, `.omp/` does not exist.
- AC-03: after `--platform omp`, the project ignore rules cover `.omp/`, matching how `bin/phases/root-config.js:111-113` already covers `.claude/`, `.codex/`, and `.agents/`.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/omp-runtime.test.js`
- Named probe: the `an omp install creates hooks, extensions and metadata`, `a non-omp install creates no .omp directory`, and `an omp install ignores its own auto-executed extension directory` cases in `bin/__tests__/omp-runtime.test.js`.
- Reachability: known — `bin/install.js:66,76` already dispatches per `platformKey`, and the test drives the real installer against a temporary git project exactly as `bin/__tests__/codex-hooks-ownership.test.js` does.
- Oracle: the three cases pass and the installer exits 0.
- Counterexample: wiring the phase outside a `platformKey === 'omp'` guard must fail the second case; omitting the ignore rule must fail the third.
- Artifacts: ephemeral temporary project directories from `fs.mkdtempSync`, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/omp-runtime.test.js
Exit: 0
Base: 1067eafd187baeb3c2c00e24bdf0c7381b51cccd
Head: 3066fcf9f339e21876393bd232a82aed4ae62f1581a5b1ffd068c5ee03b5ca95
```text
$ node --test bin/__tests__/omp-runtime.test.js
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
