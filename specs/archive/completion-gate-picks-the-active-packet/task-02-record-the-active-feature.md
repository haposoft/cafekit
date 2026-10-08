# Task 02 — A recorded active feature answers a genuine ambiguity

Status: done

## Outcome
`Provide explicit feature target` becomes an instruction a user can follow. When more than one packet is genuinely in play, `specs/_shared/active-feature.json` names the one being worked on and both Stop hooks resolve it. A target supplied by the host always wins, so the file can never redirect a hook that already knows its feature, and an absent, blank, or malformed file is ignored rather than turned into an error that blocks.

The approval prompt names the feature it is asking approval for, so a closeout cannot be approved without the user seeing what it is.

## Scope
- In: `readActiveFeatureTarget({ projectRoot, runtime })` on the resolver reads `<specs root>/_shared/active-feature.json`, accepts only a non-empty single-line `featureName` string, and returns `null` for anything else; the Stop gate and the completion-authority check consult it **only** after their existing `extractExplicitTarget(payload)` returns nothing; the approval message includes the resolved `featureName`.
- Placement corrected by measurement before implementation. `resolvePersistedSpec` has exactly two consumers, `src/claude/hooks/completion-authority-check.cjs:30` and `src/codex/hooks/completion-authority-check.cjs:42`, so consulting the file inside it after its own caller-target block covers closeout approval on both runtimes in one place and no other consumer sees it. `resolveWorkflowCandidate` has five, including `src/claude/hooks/spec-state.cjs:87` and `src/claude/hooks/precompact.cjs:52`, so the gate keeps its call-site wiring — in **both** gates. The original ownership list named only Claude files, which would have left a Codex user with the reported bug unfixed while the packet claimed to fix it; `src/codex/hooks/spec-gate.cjs:53` and `src/codex/hooks/completion-authority.cjs:82` are therefore owned here.
- Out: writing the file, which belongs to whatever starts a task rather than to a hook; any environment-variable source; the recursive interior of `extractExplicitTarget`, which is shared with `spec-state.cjs`, `precompact.cjs`, and `findActiveSpec` and must not gain a new implicit source; the narrowing rules (task 01).

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/scripts/spec-resolver.cjs` (add `readActiveFeatureTarget` and export it)
- Modify: `packages/spec/src/claude/hooks/spec-gate.cjs` (the target line at `:122-124`)
- Modify: `packages/spec/src/codex/hooks/spec-gate.cjs` (the target line at `:53`, which passes the raw payload)
- Modify: `packages/spec/src/codex/hooks/lib/spec-utils.cjs` (export a `readActiveFeatureTarget` wrapper for the Codex gate)
- Modify: `packages/spec/src/claude/hooks/completion-authority.cjs` (the approval message at `:134`)
- Modify: `packages/spec/src/codex/hooks/completion-authority.cjs` (the same approval message at `:82`)
- Modify: `packages/spec/bin/__tests__/spec-narrowing.test.js`
- Modify: `packages/spec/bin/__tests__/codex-hooks.test.js` (one end-to-end case, because the Codex gate needs that file's installer fixture)
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
- Command: `node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js src/claude/hooks/__tests__/state.test.js src/claude/hooks/__tests__/precompact.test.js`
- Named probe: new cases `a recorded active feature resolves two packets claiming closeout`, `a payload target beats the recorded file`, `a blank recorded feature is ignored rather than malformed`, `a recorded feature cannot escape the specs root`, `a symlinked recorded feature is refused`, `an absent file leaves every project exactly as it was`, `the shared workflow resolver ignores the recorded file`, `the codex gate consults the file only after its payload`, `the approval prompt names its feature`, and the end-to-end pair `claude: the recorded feature turns the identity block into receipt validation` and `Codex recorded active feature turns the identity block into receipt validation`; plus every existing case in both hook suites as regression guards, since each builds a temporary project that must keep resolving without the file present.
- Reachability: known — `readActiveFeatureTarget` is exported and called directly; the Claude gate runs as a child process against a temporary git project pinned by `PROJECT_ROOT`, and the Codex gate resolves `PROJECT_ROOT` from its own installed location, so its end-to-end case uses the installer fixture `inHookFixture` that `bin/__tests__/codex-hooks.test.js` already owns. Both are run with and without the file written.
- Oracle: the object the reader returns; the target the hook ends up using; and the approval message text, which must contain the resolved feature name.
- Counterexample: consulting the file before the payload must fail `a payload target beats the recorded file`; returning a target carrying a blank value must fail `a blank recorded feature is ignored rather than malformed` and would block every project without the file; moving the reader into the shared `resolveWorkflowCandidate` must fail `the shared workflow resolver ignores the recorded file`; omitting the feature name from the prompt must fail `the approval prompt names its feature`. Measured correction: the original third counterexample claimed `state.test.js` and `precompact.test.js` would detect the shared-resolver placement. They do not — both passed 12/12 under that mutation, because no fixture in either suite writes `active-feature.json`, so the reader returned `null` and nothing changed. The containment is real but was unpinned, so `the shared workflow resolver ignores the recorded file` was added and the counterexample now names it.
- Artifacts: ephemeral temporary projects, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js src/claude/hooks/__tests__/state.test.js src/claude/hooks/__tests__/precompact.test.js
Exit: 0
Base: d9d150bbd670dde2f39bbc584ca10334a7be5bbf
Head: 8e1d785689d488c33b17c015a6f28d749727ea5109eac024f133c038382cd9f1
```text
$ node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js src/claude/hooks/__tests__/state.test.js src/claude/hooks/__tests__/precompact.test.js
✔ a recorded active feature resolves two packets claiming closeout
✔ a payload target beats the recorded file
✔ a blank recorded feature is ignored rather than malformed
✔ a recorded feature cannot escape the specs root
✔ a symlinked recorded feature is refused
✔ an absent file leaves every project exactly as it was
✔ the shared workflow resolver ignores the recorded file
✔ the codex gate consults the file only after its payload
✔ the approval prompt names its feature
✔ claude: the recorded feature turns the identity block into receipt validation
✔ Codex recorded active feature turns the identity block into receipt validation
ℹ tests 175
ℹ pass 175
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

The two end-to-end cases run the real Stop gate as a child process and are the strongest evidence in this packet, because they show both of the reporter's complaints in one measurement. With two legacy packets both claiming closeout and no recorded file, the gate answers `Completion gate: multiple active specs detected (alpha, beta). Provide explicit feature target` — advice nothing in the product wrote. With `specs/_shared/active-feature.json` naming `beta`, the same gate resolves it and reports `2 done task(s) lack a verification receipt` against `specs/beta/`, so receipt validation — which the report observed never runs — runs, and against the named feature rather than a sibling.

Every counterexample was executed against this working tree, each mutation applied to the real source and reverted, with `git diff --stat` confirming the file returned to the change set under review. Consulting the file before the caller's target gave 17 pass / 1 fail on `a payload target beats the recorded file`. Returning a target carrying a blank value gave 17 pass / 1 fail on `a blank recorded feature is ignored rather than malformed`. Moving the reader into the shared `resolveWorkflowCandidate` gave 19 pass / 1 fail on `the shared workflow resolver ignores the recorded file`. Removing the feature name from the approval message gave 17 pass / 1 fail on `the approval prompt names its feature`.

Two statements in this task were wrong as written and are corrected above rather than quietly dropped. The third counterexample claimed that placing the reader in the shared resolver would be detected by `state.test.js` and `precompact.test.js`; measured, both passed 12 of 12 under exactly that mutation, because no fixture in either suite writes the file, so the reader returned `null` and nothing changed. The containment is real but nothing pinned it, so `the shared workflow resolver ignores the recorded file` was added and the counterexample now names it; both suites are kept in the command as regression guards. Separately, the original ownership list named only Claude files. `resolvePersistedSpec` has exactly two consumers and both are completion-authority checks, so the reader sits inside it and covers closeout approval on both runtimes at once; `resolveWorkflowCandidate` has five, so each gate applies the file at its own call site — and the Codex gate is one of them. Wiring only Claude would have left a Codex user with the reported bug while this packet claimed to fix it.

One implementation error is recorded because the tests caught it rather than review: `lstatOptional` returns a wrapper `{ exists, stat, isSymlink }`, not a `Stats`, so the first draft's `lstatOptional(file)?.isFile()` threw inside the reader's own try block and made it return `null` for every project. Two cases failed immediately. The corrected check also refuses a symlinked file, since this path is read from inside the project and a symlink could name a target outside it; `a symlinked recorded feature is refused` pins that.

The Codex end-to-end case lives in `bin/__tests__/codex-hooks.test.js` rather than beside its Claude twin because the Codex gate resolves `PROJECT_ROOT` from its own installed location and needs that file's `inHookFixture` installer fixture. Running it from a bare temporary directory produced empty stdout, measured before the case was moved.
