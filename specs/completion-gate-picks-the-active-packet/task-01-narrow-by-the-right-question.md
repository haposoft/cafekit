# Task 01 — Each Stop hook narrows by the question it actually asks

Status: done

## Outcome
The two Stop hooks stop counting finished packets as ambiguity, each using the rule its own job needs. The gate asks which packet still has unfinished work, so a repository of legacy packets narrows exactly the way a process-first one does and the resolved packet's receipts are validated by the existing single-candidate path. Closeout approval asks which packet is claiming closeout, so history no longer competes with the one being closed. Codex reaches the second answer through the shared function instead of its own candidate count.

A repository with exactly one packet resolves it whatever its status, on both paths.

## Scope
- In: in `refineWorkflowGateResolution`, the layout condition moves from the top of the function to the bulk-audit return, so narrowing runs for any layout while the bulk branch stays process-first only; in `resolvePersistedSpec`, the no-target branch filters to candidates where `isDurableCloseout(candidate.spec)` is true, after the single-candidate return; `spec-utils.cjs` exports a feature-detecting `resolvePersistedSpec` wrapper and the Codex `resolveCandidate` delegates to it, keeping its current fallback when the installed resolver is older.
- Out: the target file and the approval prompt (task 02); receipt binding, which stays as it is; the bulk-audit branch's own behaviour; the explicit-target branch, which already resolves directly; any task-status vocabulary change, since valid task statuses are `pending`, `in_progress`, `blocked`, `done`.

## Coverage
- CP-01, CP-02

## Ownership
- Modify: `packages/spec/src/claude/scripts/spec-resolver.cjs` (`refineWorkflowGateResolution` at `:891-917`, the no-target branch of `resolvePersistedSpec` at `:711-719`)
- Modify: `packages/spec/src/codex/hooks/lib/spec-utils.cjs` (add the wrapper and add it to the multi-line export list — the export spans several lines, so a single-line edit will silently miss)
- Modify: `packages/spec/src/codex/hooks/completion-authority-check.cjs` (`resolveCandidate` at `:37-43`)
- Modify: `packages/spec/src/claude/hooks/__tests__/completion-authority.test.js` (the one case whose contract changes, per AC-04)
- Create: `packages/spec/bin/__tests__/spec-narrowing.test.js`
- Read: `packages/spec/src/claude/scripts/spec-final-state.cjs:96-102`, `packages/spec/src/claude/hooks/completion-authority.cjs:118-134`

## Acceptance
- AC-01, AC-02, AC-04 as stated in `plan.md`.
- **The bulk branch keeps its own guard.** Removing the layout condition from the top of `refineWorkflowGateResolution` leaves no other check before the bulk return, so an all-legacy set whose packets are all finished would reach a branch that exits before the semantic-digest, `FLASH_UNVERIFIED`, feature-receipt, and completion-policy layers. The guard must be re-stated at the bulk return itself.
- **A lone packet resolves whatever its status.** The closeout filter runs only after the single-candidate return. Four existing cases require a single legacy packet with `status` `done` or `completed` to keep resolving; issue #79's own first suggestion breaks exactly this. Measured correction: those four cases are satisfied by the filter itself, because a finished packet is claiming closeout. What the single-candidate return actually protects is the opposite shape — a repository holding exactly one packet still mid-execution, for which `isDurableCloseout` is false and the filter would return `null`, silencing the hook. No existing case pinned that, so `a lone packet mid-execution still resolves` was added.
- **Zero claiming resolves to `null`, not to an error.** `completion-authority.cjs:118` treats `null` as nothing in flight; an error would keep blocking.
- **Codex is proven, not assumed.** `completion-authority.test.js` generates its cases in a `for (const kind of ['claude', 'codex'])` loop, so a Claude-only change fails the `codex:` half. A measured prototype failure is recorded as a warning: the wrapper must be added to the export list, which spans multiple lines; missing it produced `RESOLVER.resolvePersistedSpec is not a function` and failed every Codex case.
- **AC-04's contract change is stated, not smuggled.** The updated case asserts the new behaviour and carries a comment saying why the old expectation was wrong: it pinned the over-strict ambiguity that issue #79 reports.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/specs-v2-execution-closeout.test.js`
- Named probe: new cases `a legacy repository resolves its one unfinished packet`, `a legacy candidate never reaches the bulk branch`, `one packet claiming closeout among finished ones resolves`, `a lone finished packet still resolves`, `a lone packet mid-execution still resolves`, `no packet claiming closeout resolves to null`, `codex resolveCandidate agrees with the shared resolver`; plus existing `35. process-v3 Stop ignores a completed packet when one packet remains active`, `36. process-v3 Stop accepts two completed packets with valid Receipts`, `47. completed-set branch accepts committed receipts and blocks a tampered one`, `Codex process-v3 Stop ignores a completed packet when one packet remains active`, and the updated `claude:`/`codex: explicit target resolves before sibling ambiguity while no target remains ambiguous`.
- Reachability: known — the resolver functions are exported and called directly against temporary fixtures; the gate runs as a child process against an installed temporary project, the technique `spec-gate.test.js` already uses; the Codex `resolveCandidate` is required directly from its module.
- Oracle: the resolver's return value (a candidate with the expected `featureName`, `null`, an error naming exactly the claiming packets, or a `layoutKind`), and the gate's stdout, which must never match `/multiple active specs/` for a repository whose one unfinished packet is identifiable.
- Counterexample: restoring the layout condition at the top of the function must fail `a legacy repository resolves its one unfinished packet`; omitting the re-stated guard at the bulk return must fail `a legacy candidate never reaches the bulk branch`; applying the closeout filter before the single-candidate return must fail `a lone packet mid-execution still resolves`; returning an error instead of `null` when nothing claims closeout must fail `no packet claiming closeout resolves to null`; leaving the Codex count in place must fail `codex resolveCandidate agrees with the shared resolver`.
- Artifacts: ephemeral temporary projects, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/specs-v2-execution-closeout.test.js
Exit: 0
Base: 2c6b6f316974d4be707ddea9add579d6589b041c
Head: fafdebead9e99a0e16d264470d0c7f7d463237765409ce6ee47119e3a4dc533b
```text
$ node --test bin/__tests__/spec-narrowing.test.js src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/specs-v2-execution-closeout.test.js
✔ a legacy repository resolves its one unfinished packet
✔ a legacy candidate never reaches the bulk branch
✔ a process-first set still reaches the bulk branch
✔ one unfinished process-first packet still narrows
✔ one packet claiming closeout among finished ones resolves
✔ a lone finished packet still resolves
✔ a lone packet mid-execution still resolves
✔ no packet claiming closeout resolves to null
✔ several packets claiming closeout stay ambiguous and name only those
✔ codex resolveCandidate agrees with the shared resolver
✔ claude: explicit target resolves before sibling ambiguity while no target remains ambiguous
✔ codex: explicit target resolves before sibling ambiguity while no target remains ambiguous
✔ 35. process-v3 Stop ignores a completed packet when one packet remains active
✔ 36. process-v3 Stop accepts two completed packets with valid Receipts
✔ 47. completed-set branch accepts committed receipts and blocks a tampered one
✔ Codex process-v3 Stop ignores a completed packet when one packet remains active
✔ Codex process-v3 Stop accepts two completed packets with valid Receipts
ℹ tests 162
ℹ pass 162
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Every counterexample in the Verification Plan was executed against this working tree, each mutation applied to the real source, measured with `node --test bin/__tests__/spec-narrowing.test.js`, then reverted; `git diff --stat` after each pair confirmed the file returned to the change set under review. Restoring the layout condition at the top of `refineWorkflowGateResolution` gave 8 pass / 1 fail, the failure being `a legacy repository resolves its one unfinished packet`. Deleting the re-stated guard at the bulk return gave 8 pass / 1 fail on `a legacy candidate never reaches the bulk branch`. Removing the single-candidate return so the closeout filter runs first gave 9 pass / 1 fail on `a lone packet mid-execution still resolves`. Returning an ambiguity error instead of `null` when nothing claims closeout gave 9 pass / 1 fail on `no packet claiming closeout resolves to null`. Deleting the Codex delegation so its own candidate count stands gave 9 pass / 1 fail on `codex resolveCandidate agrees with the shared resolver`.

The counterexample for the single-candidate return was wrong as written and is corrected above in Acceptance and in the Verification Plan. Measured first: removing that return failed nothing across `spec-narrowing` plus `completion-authority` (49 pass, 0 fail), because every packet those cases hold with `status` `done` or `completed` is claiming closeout and survives the filter on its own. A direct probe then isolated what the return does protect — a repository holding exactly one legacy packet at `status: in_progress`, `current_phase: implementation`, for which `isDurableCloseout` returns `false`, so the filter alone would yield `null` and silence the hook rather than check the packet. `a lone packet mid-execution still resolves` was added to pin that shape, and the counterexample now discriminates.

The two failures the plan recorded from the prototype round are gone: the AC-04 case passes on both platforms with its contract change stated in a comment beside the assertion, and no case was weakened, skipped, or deleted to reach this result.
