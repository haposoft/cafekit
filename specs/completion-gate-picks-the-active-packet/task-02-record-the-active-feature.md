# Task 02 — A recorded active feature answers a genuine ambiguity

Status: pending

## Outcome
`Provide explicit feature target` becomes an instruction a user can follow. When more than one packet is genuinely in play, `specs/_shared/active-feature.json` names the one being worked on and both Stop hooks resolve it. A target supplied by the host always wins, so the file can never redirect a hook that already knows its feature, and an absent, blank, or malformed file is ignored rather than turned into an error that blocks.

The approval prompt names the feature it is asking approval for, so a closeout cannot be approved without the user seeing what it is.

## Scope
- In: `readActiveFeatureTarget({ projectRoot, runtime })` on the resolver reads `<specs root>/_shared/active-feature.json`, accepts only a non-empty single-line `featureName` string, and returns `null` for anything else; the Stop gate and the completion-authority check consult it **only** after their existing `extractExplicitTarget(payload)` returns nothing; the approval message includes the resolved `featureName`.
- Out: writing the file, which belongs to whatever starts a task rather than to a hook; any environment-variable source; the recursive interior of `extractExplicitTarget`, which is shared with `spec-state.cjs`, `precompact.cjs`, and `findActiveSpec` and must not gain a new implicit source; the narrowing rules (task 01).

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/scripts/spec-resolver.cjs` (add `readActiveFeatureTarget` and export it)
- Modify: `packages/spec/src/claude/hooks/spec-gate.cjs` (the target line at `:122-124`)
- Modify: `packages/spec/src/claude/hooks/completion-authority-check.cjs` (the target line at `:29`)
- Modify: `packages/spec/src/claude/hooks/completion-authority.cjs` (the approval message at `:134`)
- Read: `packages/spec/src/claude/scripts/spec-resolver.cjs:494-527` (why the reader must not live inside the recursive extractor), `packages/spec/README.md` (the ignore rules that already cover `specs/_shared/`)

## Acceptance
- AC-03 as stated in `plan.md`.
- **The caller always wins.** The file is consulted only when `extractExplicitTarget(payload)` returns nothing, and only at the two outer call sites. Measured in the prototype: a payload naming `beta` beats a file naming `alpha`; with no payload the file is used.
- **A blank or malformed file is invisible.** `explicitTargetValue` turns a blank into `null`, and `resolvePersistedSpec:706-708` turns `null` into an `explicit_malformed` error that blocks — so the reader must return `null` rather than a target carrying an empty value. Measured: a file containing whitespace yields `null`.
- **The reader adds no new trust.** The value is treated exactly like a host-supplied feature name and still passes the resolver's containment, existence, and JSON checks; a name that escapes the specs root or does not exist produces the existing errors.
- **It is not inside the recursive extractor.** That function calls itself for a nested `target` and is also used by `spec-state.cjs`, `precompact.cjs`, and `findActiveSpec`; adding a source inside it would retarget consumers that are not these hooks and could short-circuit the nested-target branch.
- **The approval prompt is identifiable.** Without the feature name a user types a bare nonce and cannot tell which closeout they are approving, while the file can influence which packet resolves.

## Dependencies
- task-01-narrow-by-the-right-question.md

## Verification Plan
- Command: `node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js`
- Named probe: new cases `a recorded active feature resolves two packets claiming closeout`, `a payload target beats the recorded file`, `a blank recorded feature is ignored rather than malformed`, `a recorded feature cannot escape the specs root`, `the approval prompt names its feature`; plus every existing case in both hook suites as regression guards, since each builds a temporary project that must keep resolving without the file present.
- Reachability: known — `readActiveFeatureTarget` is exported and called directly; both hooks run as child processes against installed temporary projects, with and without the file written.
- Oracle: the object the reader returns; the target the hook ends up using; and the approval message text, which must contain the resolved feature name.
- Counterexample: consulting the file before the payload must fail `a payload target beats the recorded file`; returning a target carrying a blank value must fail `a blank recorded feature is ignored rather than malformed` and would block every project without the file; placing the reader inside the recursive extractor must change what `spec-state.cjs` resolves, which its own suite detects; omitting the feature name from the prompt must fail `the approval prompt names its feature`.
- Artifacts: ephemeral temporary projects, removed in `finally`.

## Receipt
