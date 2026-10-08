# Task 02 — Wire the Codex pointer and prove installed parity

Status: done

## Outcome
Both ported rules provably reach Claude and Codex installs with rename-only transformation, are named by a consult pointer in the Codex runtime template so Codex can actually read them, are not shadowed by a native override, and are carried by the packed npm tarball.

## Coverage
- CP-03

## Scope
- In: add one consult bullet to the runtime block of `packages/spec/src/codex/AGENTS.md` naming `.codex/rules/review-audit-self-decision.md` and `.codex/rules/process-management.md` with their trigger conditions, written in Codex-native vocabulary (`$hapo-<name>`, `.codex/...`) because `installManagedAgentsMd` copies this template without `normalizeCodexBody` (`codex-runtime.js:140-144`) and the installed root `AGENTS.md` is asserted free of `hapo:`, `Claude Code`, `` `Agent` ``, `SendMessage`, and `Claude Tasks` (`codex-native.test.js:2200-2214`) — Codex CLI has no directory auto-load, and the template currently points only at the two routing rules (`src/codex/AGENTS.md:9-15`). The bullet must avoid Claude-only tool names and legacy vocabulary, both linted over this template by `authoringInstructionIssues` (`run-skill-self-tests.mjs:2604-2613`). Add one test to `codex-native.test.js` (pattern `:3087-3125`; helpers `inTempProject:210`, `installPlatforms:231`; `normalizeCodexBody` imported at `:13`) that installs both platforms into a temporary project and asserts, for each new rule: `.claude/rules/<file>` equals source bytes; `.codex/rules/<file>` equals `normalizeCodexBody(source, sourcePath)` and equals the rename-only projection; `packages/spec/src/codex/rules/<file>` does not exist; and the installed root `AGENTS.md` names both rules. Extend the `.codex/rules/*` presence list at `codex-native.test.js:2048-2059` with both files. Add both source paths to `REQUIRED_PAYLOAD` (`package-inventory.test.js:110-145`), asserted by `assertCleanInventory` (`:272-275`).
- Out: installer or transform code changes; guide text; rule bytes (task 01 owns them); Codex override files; a Claude-side pointer in `src/claude/CLAUDE.md`; live adherence claims.

## Ownership
- Modify: `packages/spec/src/codex/AGENTS.md`
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Read: `packages/spec/src/claude/rules/review-audit-self-decision.md`, `packages/spec/src/claude/rules/process-management.md`, `packages/spec/bin/lib/codex-install.js`, `packages/spec/bin/phases/claude-runtime.js`, `packages/spec/bin/phases/codex-runtime.js`

## Acceptance
- AC-04: `Claude and Codex installed rules preserve the ported review and process guidance` passes on canonical bytes and fails when a Claude copy diverges from source, when the Codex copy differs from the rename-only projection, when a `packages/spec/src/codex/rules/<file>` override exists, or when the installed `AGENTS.md` stops naming both rules or adopts Claude-side vocabulary forbidden at `codex-native.test.js:2200-2214`. The pre-existing template probes (`run-skill-self-tests.mjs:4593-4604`, `:4624-4635`) and `Codex structured-input corpus oracle stays differential and production-aware` (`codex-native.test.js:1554`) stay green.
- AC-05: `npm dry-run inventory is deterministic and preserves runtime payload` fails with `missing payload: src/claude/rules/<file>` when either file is absent from the tarball and passes on canonical bytes.

## Dependencies
- task-01-author-ported-rules.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probe: `Claude and Codex installed rules preserve the ported review and process guidance` (new, `codex-native.test.js`); `npm dry-run inventory is deterministic and preserves runtime payload` (`package-inventory.test.js:2266`, extended `REQUIRED_PAYLOAD`); `Codex installed Specs and spec-maker reject adaptive coverage mutations` (`codex-native.test.js:2038`, extended presence list); `Codex runtime template exposes process-first Specs truth` (`run-skill-self-tests.mjs:4593`, unchanged in intent); task 01's three probes through the suite's static pass (`:6213`)
- Reachability: `npm test -> static pass -> node --test bin/__tests__/*.test.js -> bin/install.js into mkdtemp roots (claude, codex) -> copyRulesDirectory (claude-runtime.js:260-277) + installNativeRuleOverrides (codex-runtime.js:111-123) + upsertManagedCodexBlock -> read installed rule bytes and AGENTS.md`; `npm pack --dry-run --json -> file list -> REQUIRED_PAYLOAD`
- Oracle: the full suite exits 0 with executed tests > 0 and no failing case; each named test passes; the installed Codex copy equals both the transform output and the rename-only projection.
- Counterexample: a `packages/spec/src/codex/rules/process-management.md` override, a source rule containing `Claude Code` (the Codex copy would read `Codex CLI` and diverge from the rename-only projection), a template bullet dropped from `AGENTS.md`, or a tarball missing either file must each fail its owning test.
- Artifacts: none durable — temporary install roots are removed. The suite writes `packages/spec/src/claude/hooks/.logs/` into the source tree (known bug, not provenance-excluded), so remove that directory **before** deriving Head for the receipt. Expect a wall-clock over ten minutes: run the command in the background rather than under the default foreground timeout.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ npm --prefix packages/spec test
✔ ported review rule keeps decision precedence without reversal loopholes
✔ ported process rule keeps ownership, port, and cleanup discipline
✔ ported rules survive the Codex transform as rename-only
✔ Codex runtime template exposes process-first Specs truth
✔ Codex structured-input corpus oracle stays differential and production-aware (69.931875ms)
✔ Codex installed Specs and spec-maker reject adaptive coverage mutations (2855.5825ms)
✔ Claude and Codex installed rules preserve the ported review and process guidance (940.157125ms)
✔ npm dry-run inventory is deterministic and preserves runtime payload (3403.36075ms)
[skill-test] PASS: 1171 tests executed
Exit: 0
```
Reachability: `npm test` -> static pass -> `node --test bin/__tests__/*.test.js` -> `bin/install.js` into `mkdtemp` roots for both platforms -> `copyRulesDirectory` plus `installNativeRuleOverrides` and `upsertManagedCodexBlock` -> reads of the installed rule bytes and root `AGENTS.md`; separately `npm pack --dry-run --json` -> file list -> `REQUIRED_PAYLOAD`.
Count oracle: 1171 executed against the 1167 baseline recorded by the previous packet — three static probes from task 01 plus this task's one installed-parity test.
Negative proof: seven controls replayed on a disposable copy under a verified temporary root, never on canonical bytes. A Codex override at `src/codex/rules/process-management.md`, a rule line containing `Claude Code`, a deleted `AGENTS.md` bullet, a bullet rewritten with `hapo:` vocabulary, and each rule missing from the payload all failed their owning tests with the expected messages; the reviewer added a `packages/spec/src/claude/rules/...` path control proving the Claude byte-equality branch executes. Baseline in the copy passed before each control and every file was restored byte-exact.
Cleanup: temporary install roots are removed by the suites; the suite's transient source-tree artifact `packages/spec/src/claude/hooks/.logs/` (known bug, tracked separately) was removed before Base and Head were derived, so the recorded provenance matches the tracked worktree.
Review: PASS — code-auditor (0 Critical, 0 High, 0 Medium; 4 Low non-blocking: the pointer-line count assertion is layout-coupled, the pointer forbidden list is narrower than the one at `codex-native.test.js:2200-2214` which already covers the file, the test binds to the installed `AGENTS.md` rather than the Codex template source, and the bullet's trigger conditions do not name the stable-code-artifact clause). The reviewer re-ran both affected test files independently (32/32 and 1/1) and did not reproduce the full-suite count, which stays controller-owned evidence.
