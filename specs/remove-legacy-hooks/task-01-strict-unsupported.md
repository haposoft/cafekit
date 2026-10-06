# Task 01 — Strict validation reports "no longer supported"; kernel tests stop loading the authority modules

Status: done

## Outcome
A legacy `spec.json` packet that asks for `Strict` assurance fails validation and readiness with a plain "no longer supported" error, from source and from a packed install, and nothing in the validator or in the three kernel test files loads `semantic-review-authority.cjs` or the `completion-authority*` modules, so task 05 can delete them.

## Scope
- In: `validate-spec-output.cjs` — replace the two `try { require('../hooks/semantic-review-authority.cjs') … }` blocks (`:2474-2490` in `validateSemanticReview`, `:2904-2913` in `validateSemanticReview21`) with one `errors.push` of the exact D-03 message (`plan.md` Decisions), fired whenever the snapshot's `assurance_level` is `Strict` (drop the `SHA256_RE` guard on those two branches only).
- In: `develop-contract.test.js` — drop the module-level `SEMANTIC_AUTHORITY` require (`:20`); drop `completion-authority-check.cjs`, `completion-authority-state.cjs`, `semantic-review-authority.cjs` from `installClaudeRuntimeClosure` (`:77-90`, list at `:83-85`); in the 1339 test expect `/Strict assurance is no longer supported/` (`:1372`); replace the 1377 test with `Strict readiness is refused as no longer supported` (finalize throws that message, `spec.json` bytes unchanged, no hook spawned); in the final-state test `done is a final-state request bound to current semantic model and digest` (`:1423-1427`) pass `semanticAuthority: {}` (the fixture is not Strict, so `spec-final-state.cjs:148-151` never calls it; a `verifyAttestation` stub would trip the Command's grep).
- In: `validator-grounding.test.js` — `completeSemanticReview` (`:153-188`) loses its `independent` branch and hook spawn; in `all ready non-Direct specs …` (`:1482`) the `critical-one-task-authoring` case expects a non-zero exit matching the D-03 message; rename `spec-ready excludes execution receipts while preserving Strict review state` (`:1565`) to `spec-ready excludes execution receipts and refuses Strict as no longer supported` and expect the Strict fixture to fail with the D-03 message.
- In: `package-inventory.test.js` — `assertInstalledProvenance`: drop the four authority paths, their existence loop and the four `authority --stop` probes (`:1531-1586`); `installedSemanticPaths`: drop `completion` and `semanticAuthority` (`:1761-1762`); delete `assertInstalledCompletion` (`:2051-2078`), `CLOSING_FIXTURE` and `assertInstalledResolution` (`:2080-2131`) and their calls (`:2936,:2940`); replace `assertStrictSimulatedHandlerGuardrail` (`:2133-2170`) with an assertion that the installed `spec-readiness.cjs` CLI on the Strict fixture exits non-zero, prints the D-03 message, and leaves `spec.json` bytes unchanged; delete the opt-in `packed Codex live host E2E via codex binary (opt-in)` test (`:2979-3127`, it exists only to observe a Strict attestation).
- Out: `spec-final-state.cjs` Strict branch and `spec-scaffold.cjs` baseline (dead legacy code, plan Out of scope); `validator-grounding.test.js:1085-1175` (stubs for `spec-scaffold`, unchanged); deleting any hook file (task 05).

## Coverage
- CP-01, CP-04

## Ownership
- Modify: `src/claude/scripts/validate-spec-output.cjs`, `bin/__tests__/develop-contract.test.js`, `bin/__tests__/validator-grounding.test.js`, `bin/__tests__/package-inventory.test.js`
- Read: `src/claude/scripts/spec-readiness.cjs:262-263` (validator errors surface in the thrown message), `src/claude/scripts/spec-final-state.cjs:110-151`

## Steps
1. Run the Command once before editing → expect exit 1 (the three named titles do not exist yet).
2. Edit the two validator sites.
3. Edit `develop-contract.test.js`, then `validator-grounding.test.js`, then `package-inventory.test.js` as scoped.
4. Run the Command → exit 0.

## Acceptance
- AC-01: the renamed develop and validator tests and the packed semantic-kernel test pass and observe the D-03 message from source (`validate-spec-output.cjs` CLI, `finalizeReadiness`) and from packed Claude and Codex installs.
- AC-03 (part): none of the four owned files names `semantic-review-authority`, and three of them name no `completion-authority` (the `validator-grounding.test.js` scaffold stubs stay).

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3b-01.txt; rm -f $F; node --test bin/__tests__/develop-contract.test.js bin/__tests__/validator-grounding.test.js bin/__tests__/package-inventory.test.js > $F 2>&1; tail -12 $F; grep -q '^# fail 0$' $F && grep -qE '^ok [0-9]+ - Strict readiness is refused as no longer supported$' $F && grep -qE '^ok [0-9]+ - spec-ready excludes execution receipts and refuses Strict as no longer supported$' $F && grep -qE '^ok [0-9]+ - packed Claude and Codex installs execute semantic kernel behavior without package source$' $F && ! grep -nE 'semantic-review-authority|completion-authority|verifyAttestation' src/claude/scripts/validate-spec-output.cjs bin/__tests__/develop-contract.test.js bin/__tests__/package-inventory.test.js && ! grep -nE 'semantic-review-authority|SEMANTIC_REVIEW_ATTESTATION' bin/__tests__/validator-grounding.test.js && rm -f $F`
- Named probe: `Strict readiness is refused as no longer supported` (develop-contract), `spec-ready excludes execution receipts and refuses Strict as no longer supported` and `all ready non-Direct specs require semantic design and coherent authoring timestamps` (validator-grounding, through the validator CLI), `packed Claude and Codex installs execute semantic kernel behavior without package source` (installed readiness CLI).
- Reachability: source — the validator CLI and `finalizeReadiness` in-process; installed — `npm pack` + packed installer into temp projects with the package `src/` deleted (`package-inventory.test.js:2915-2950`), no network.
- Oracle: exit 0; `# fail 0`; the three named `ok` lines; the greps find nothing.
- Counterexample: keeping the `SHA256_RE` guard lets a Strict review with a malformed digest pass without the message (the validator-grounding fixtures use real digests, so the readiness probe pins the message); leaving the `require` makes the grep fail; a Strict packet that validates fails the renamed tests; the current tree fails all three `ok` greps (the titles do not exist yet).
- Artifacts: `/tmp/ck-3b-01.txt`, removed on success; temp projects removed by the tests.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-01.txt; rm -f $F; node --test bin/__tests__/develop-contract.test.js bin/__tests__/validator-grounding.test.js bin/__tests__/package-inventory.test.js > $F 2>&1; tail -12 $F; grep -q '^# fail 0$' $F && grep -qE '^ok [0-9]+ - Strict readiness is refused as no longer supported$' $F && grep -qE '^ok [0-9]+ - spec-ready excludes execution receipts and refuses Strict as no longer supported$' $F && grep -qE '^ok [0-9]+ - packed Claude and Codex installs execute semantic kernel behavior without package source$' $F && ! grep -nE 'semantic-review-authority|completion-authority|verifyAttestation' src/claude/scripts/validate-spec-output.cjs bin/__tests__/develop-contract.test.js bin/__tests__/package-inventory.test.js && ! grep -nE 'semantic-review-authority|SEMANTIC_REVIEW_ATTESTATION' bin/__tests__/validator-grounding.test.js && rm -f $F`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: abdc588bb6175c927b863939709b066588419ea225654e6ce0972948421e665c
```text
$ (packages/spec) <Command above>   # summary lines, run by the controller; EXIT=0
# tests 139
# pass 139
# fail 0
```
Pre-change run (implementer): `node --test` exited 0 with 139 pass, but the Command failed because the three named `ok` titles did not exist yet. The opt-in `packed Codex live host E2E via codex binary` test was deleted as scoped (it only observed a Strict attestation).
