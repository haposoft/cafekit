# Task 03 — The omp overlay shrinks to the privacy hook

Status: done

## Outcome
`src/omp/hooks/` contains only `privacy-block.cjs`, which is the routed Claude file plus its two ask→deny edits. The lowercase tool-name handling omp needed now comes from the shared reader every hook calls, so `task-scaffold-guard.cjs` and `lib/omp-tool-names.cjs` leave the overlay. An omp install keeps every contract the omp packet pinned: a lowercase `bash` read of `.env` is denied, a lowercase `write` into a nested task path is guarded, an unevaluable access is denied. Every sentence that counted the overlay at three files now says one.

## Scope
- In: delete `src/omp/hooks/task-scaffold-guard.cjs` and `src/omp/hooks/lib/omp-tool-names.cjs`; rebase `src/omp/hooks/privacy-block.cjs` on the routed Claude file with only the two `ask`→`deny` edits and the omp comment; update `omp-hooks.test.js` (the overlay listing and `expectedOverlay`'s edit set, whose anchors and contrast case task 02 already refreshed; the `normalizeToolName` import moves to `src/claude/hooks/lib/hook-payload.cjs`), `omp-runtime.test.js` (drop `lib/omp-tool-names.cjs` from the required-files list; keep the deny assertion), `omp-bridge.test.js` (runs as the guard); the whole `.omp/hooks/` bullet at `docs/installer-architecture.md:78`, which names all three overlay files and ends "fails … on a fourth file", the probe-pinned sentence at `:92`, the matching probe string in `run-skill-self-tests.mjs`, and the three `[Unreleased]` changelog sentences that say three files (`packages/spec/CHANGELOG.md:12,16`, `docs/project-changelog.md:8,12`).
- Out: the omp bridge's own logic, `src/omp/runtime.json`, any new omp behaviour; the grok section of the docs and the grok changelog entry (task 05).

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/omp/hooks/` (delete two files, rebase one)
- Modify: `packages/spec/bin/__tests__/omp-hooks.test.js`, `bin/__tests__/omp-runtime.test.js`, `bin/__tests__/omp-bridge.test.js`
- Modify: `docs/installer-architecture.md` (the `.omp/hooks/` bullet and the probe-pinned overlay sentence), `packages/spec/scripts/run-skill-self-tests.mjs` (that probe string only), `packages/spec/CHANGELOG.md` and `docs/project-changelog.md` (the `[Unreleased]` overlay sentences only)
- Read: `packages/spec/bin/phases/omp-runtime.js` (`overlayFiles` walks the directory and needs no change)

## Acceptance
- AC-04 as stated in `plan.md`.
- `omp-hooks.test.js` keeps the contrast task 02 installed: the Claude hook answers `ask` and the omp hook answers `deny` on the same lowercase `bash` payload.
- The scaffold-guard case becomes a behaviour case on the composed install tree: `task-scaffold-guard.cjs` run from `<tmp>/.omp/hooks/` with `tool_name: "write"` into a nested task path exits 2. It was a source-text match only because the overlay owned the file.
- `node scripts/run-skill-self-tests.mjs --static-only` passes after the sentence and probe edits, so the static suite is never left red between this task and task 05.

## Dependencies
- task-02-route-hooks-through-reader.md

## Verification Plan
- Command: `node --test bin/__tests__/omp-hooks.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/omp-bridge.test.js && node scripts/run-skill-self-tests.mjs --static-only`
- Named probe: `the fork differs from Claude only by its overlay` (listing now `['privacy-block.cjs']`), `a lowercase bash command reading a secret file is denied, where Claude asks`, `a write to a scaffolded task path is guarded under omp lowercase names too`, `an omp-only install injects rules`, `a lowercase bash command on a secret file is blocked end to end through the real fork`, `installer architecture documents hook portability`.
- Reachability: known — the omp tests compose the manifest hook set plus overlay under `<tmp>/.omp/` as the installer does; the guard case runs the hook from that tree.
- Oracle: exact overlay listing; `deny` on the omp tree and `ask` on the Claude tree for the same payload; exit 2 from the guard; static suite PASS.
- Counterexample: leaving `lib/omp-tool-names.cjs` in the overlay must fail the listing case; dropping the lowercase aliases from the shared table must fail the bash-deny and write-guard cases; leaving any sentence at three files must fail the static probe.
- Artifacts: ephemeral, removed in `finally` and `test.after`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/omp-hooks.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/omp-bridge.test.js && node scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 4adb5f2af2c549b992376be18a57692e079e7366
Head: a2f68c80e885c60848fd46b6425ff3528f5d81526bf29190ef91353b4b51a1dc
```text
$ node --test bin/__tests__/omp-hooks.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/omp-bridge.test.js && node scripts/run-skill-self-tests.mjs --static-only
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
[skill-test] PASS: 539 focused static tests executed
```

Counterexamples ran on a disposable copy under a temp root, and the docs one restored the tracked file byte-identical. Adding a second file to the overlay turned 7 pass into 6 pass 1 fail. Removing the lowercase `bash` and `write` aliases from the shared table turned it into 4 pass 3 fail, which is the case for folding them there rather than keeping a second table. Leaving the documentation at three files failed the static probe.
