# Task 01 — the gates run without the legacy hook files; Codex session guards its load

Status: done

## Outcome
Claude and Codex `spec-gate.cjs` load nothing from `completion-authority-*`, and Codex `session.cjs` loads the authority state only inside a `try`, so packet 3b can delete the five legacy hook files without blocking or crashing any Stop or SessionStart.

## Scope
- In: both gates — remove the `completion-authority-check` require (Claude `spec-gate.cjs:100`, Codex `:22`), its `evaluateCloseout` presence check (Claude `:105`), and the `resolveCandidate` fallback (Claude `:132-134`, Codex `:59`); replace the 2.1 branch (Claude `:191-204`, Codex `:110-123`) with: when `!processWorkflow && activeSpec.schema_version === '2.1' && explicitCloseout`, block with a reason containing `Legacy spec.json closeout is no longer supported; move the packet to plan.md with flat task files`; otherwise fall through to the ordinary receipt checks. Codex `session.cjs`: move the `completion-authority-state.cjs` require from `:13` into a `try` around its use at `:92` (keep clearing). Update the assertion at `specs-v2-execution-closeout.test.js:342-346` to the migration message.
- Out: deleting files; Claude `session.cjs` (already guarded); registrations; Strict validation; docs.
- The five legacy hook files: `completion-authority.cjs`, `completion-authority-check.cjs`, `completion-authority-state.cjs`, `semantic-review-authority.cjs`, `task-scaffold-guard.cjs`.

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/hooks/spec-gate.cjs`, `src/codex/hooks/spec-gate.cjs`, `src/codex/hooks/session.cjs`, `bin/__tests__/specs-v2-execution-closeout.test.js`
- Create: `bin/__tests__/legacy-authority-decoupled.test.js`
- Read: `src/claude/scripts/spec-final-state.cjs:98-106,239-285`, `src/claude/scripts/provenance.cjs`, `bin/__tests__/usage-hook-retired.test.js` (install helper)

## Steps
1. Write `legacy-authority-decoupled.test.js` (install with `--platform claude,codex --yes` into temp git projects with one empty commit). Process-first fixture: `specs/demo/plan.md` and `specs/demo/task-01-demo.md` with exactly one `Status: done`, a `## Verification Plan` with `- Command: node --test`, and a final canonical `## Receipt` (Verification PASS, the Command, Exit 0, Base/Head from the installed `.claude/scripts/provenance.cjs`, non-empty fence); the "missing receipt" variant drops the Receipt. Legacy fixture in its own project: `specs/legacy/spec.json` = `{"schema_version":"2.1","feature_name":"legacy","status":"done"}` (and `"completed"`), plus an `in_progress` variant with one done nested task lacking a receipt. Exactly eight tests:
   - `claude gate passes and blocks process-first with and without the legacy files`
   - `codex gate passes and blocks process-first with and without the legacy files`
   - `claude gate blocks legacy 2.1 closeout with the migration message`
   - `codex gate blocks legacy 2.1 closeout with the migration message`
   - `claude gate still receipt-checks a legacy 2.1 packet mid-execution`
   - `codex gate still receipt-checks a legacy 2.1 packet mid-execution`
   - `claude session starts without the legacy files`
   - `codex session starts without the legacy files`
2. Run the Command and expect failure.
3. Edit the two gates and Codex `session.cjs`; update the assertion in `specs-v2-execution-closeout.test.js`.
4. Run the Command.

## Acceptance
- AC-01..03: the eight tests pass; the existing gate, Codex hook, closeout and completion-authority suites stay green.

## Dependencies
- none

## Verification Plan
- Command: `test -f bin/__tests__/legacy-authority-decoupled.test.js && node --test bin/__tests__/legacy-authority-decoupled.test.js > /tmp/ck-3a.txt 2>&1; cat /tmp/ck-3a.txt; grep -q '^# tests 8$' /tmp/ck-3a.txt && grep -q '^# pass 8$' /tmp/ck-3a.txt && grep -q '^# fail 0$' /tmp/ck-3a.txt && node --test src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/spec-narrowing.test.js bin/__tests__/orca-session.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$' && ! grep -n "require(.*completion-authority" src/claude/hooks/spec-gate.cjs src/codex/hooks/spec-gate.cjs && rm -f /tmp/ck-3a.txt`
- Named probe: the eight tests above; `Claude and Codex gates require task proof at every Stop and feature proof only at durable closeout` (`specs-v2-execution-closeout.test.js:328`); the four session-clear cases in `completion-authority.test.js`.
- Reachability: installed — `bin/install.js` into temp git projects; no network.
- Oracle: exit 0; `# tests 8`, `# pass 8`, `# fail 0`; regression `# fail 0`; no `require` of `completion-authority` left in either gate.
- Counterexample: a remaining load-time require fails the "without the legacy files" cases; blocking every 2.1 packet fails the mid-execution cases; testing `status === 'done'` only lets the `completed` case through; dropping the Codex session clear fails the existing session-clear cases.
- Artifacts: `/tmp/ck-3a.txt`, removed on success; ephemeral temp projects.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `test -f bin/__tests__/legacy-authority-decoupled.test.js && node --test bin/__tests__/legacy-authority-decoupled.test.js > /tmp/ck-3a.txt 2>&1; cat /tmp/ck-3a.txt; grep -q '^# tests 8$' /tmp/ck-3a.txt && grep -q '^# pass 8$' /tmp/ck-3a.txt && grep -q '^# fail 0$' /tmp/ck-3a.txt && node --test src/claude/hooks/__tests__/spec-gate.test.js src/claude/hooks/__tests__/completion-authority.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/spec-narrowing.test.js bin/__tests__/orca-session.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$' && ! grep -n "require(.*completion-authority" src/claude/hooks/spec-gate.cjs src/codex/hooks/spec-gate.cjs && rm -f /tmp/ck-3a.txt`
Exit: 0
Base: dc284c1c3d4ca2637b24bd5b2aa14bbc96c97ea4
Head: 487fb84dcd73fdf6842dbcce05c0c317bd3c9ea2cc9517a1ec046eb352c75f83
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
# tests 8
# pass 8
# fail 0
# tests 191
# pass 191
# fail 0
```
Run by the controller after the implementer's report; the full package run also passed (`[skill-test] PASS: 1630 tests executed`). Pre-change run (implementer): 7/8 failed — both gates `Cannot find module './completion-authority-check.cjs'` without the legacy files, Codex session failed on its load-time require; the Claude session case already passed (its require was guarded). Besides `specs-v2-execution-closeout.test.js:342`, two more 2.1 closeout assertions in the same owned file now expect the migration message (taskless `complete`, and the changed-after-review packet), so stale-semantics detection for 2.1 closeout is no longer exercised. A 2.1 packet mid-execution with an invalid `status` is no longer rejected as "spec status is invalid" (that check lived in `evaluateCloseout`).
