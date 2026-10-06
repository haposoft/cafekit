# Task 02 — Every gate hook reads through the reader and denies with a visible reason

Status: done

## Outcome
Thirteen of the fourteen hooks that parse their own stdin normalize the parsed object through `normalizeHookPayload` before reading any field, so a grok envelope reaches the same code path a Claude payload does. `spec-gate.cjs` is the exception: it accepts both spellings at its loop guard and needs nothing else, because the rest of it is already host-neutral. The two hooks that deny with exit 2 emit a JSON deny carrying the full reason, which grok honours regardless of exit code and Claude Code reads natively. The new library ships in the migration manifest and in every hand-copied test fixture. Under Claude the decisions are unchanged; under grok the privacy gate asks, the Stop gate honours its loop guard, the approval hook stops running its stop path on every prompt, and a denial carries its reason.

## Scope
- In: `agent.cjs:44`, `completion-authority.cjs:17` (`readPayload`), `inspect-block.cjs:76`, `privacy-block.cjs:204`, `docs-sync.cjs:22`, `secret-output-guardrail.cjs:27`, `rules.cjs:52`, `precompact.cjs:72`, `session.cjs:199`, `semantic-review-authority.cjs:147`, `task-scaffold-guard.cjs:37`, `spec-state.cjs:53`, `state.cjs:228`; the loop guard at `spec-gate.cjs:83`, which gains the second spelling instead of the reader; the deny-output change at `inspect-block.cjs:92-97,105-110` and `task-scaffold-guard.cjs:75-82`; `src/claude/migration-manifest.json` `runtime.files` gains `hooks/lib/hook-payload.cjs`; the five allow-lists (`src/claude/hooks/__tests__/spec-gate.test.js` `installClaudeGate`, `state.test.js`, `semantic-review-authority.test.js`, `bin/__tests__/develop-contract.test.js`, `bin/__tests__/specs-v2-execution-closeout.test.js`) gain the same file; in `bin/__tests__/omp-hooks.test.js`, the `expectedOverlay` anchor and the Claude half of the lowercase-name contrast, both of which this task's edit to `privacy-block.cjs` breaks; and the rebase of `src/omp/hooks/privacy-block.cjs` and `task-scaffold-guard.cjs` onto the moved Claude bytes, without which the installed omp tree runs older hooks and the byte comparison fails.
- Out: `usage.cjs`, excluded by the C2 decision recorded in `plan.md`; changing what any hook does with a field once it has the Claude shape; `status.cjs`, which grok never invokes; the omp overlay's contract edits and file count, which task 03 owns. This task only replays the existing omp edits onto the moved Claude bytes.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/hooks/agent.cjs`, `completion-authority.cjs`, `inspect-block.cjs`, `privacy-block.cjs`, `docs-sync.cjs`, `secret-output-guardrail.cjs`, `rules.cjs`, `precompact.cjs`, `session.cjs`, `spec-gate.cjs`, `semantic-review-authority.cjs`, `task-scaffold-guard.cjs`, `spec-state.cjs`, `state.cjs`
- Modify: `packages/spec/src/claude/migration-manifest.json`
- Modify: `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`, `state.test.js`, `semantic-review-authority.test.js`, `packages/spec/bin/__tests__/develop-contract.test.js`, `bin/__tests__/specs-v2-execution-closeout.test.js` (allow-lists only)
- Modify: `packages/spec/bin/__tests__/omp-hooks.test.js` (the `expectedOverlay` anchor and the lowercase-name contrast; the overlay listing belongs to task 03)
- Modify: `packages/spec/src/omp/hooks/privacy-block.cjs`, `packages/spec/src/omp/hooks/task-scaffold-guard.cjs` (rebase onto the moved Claude bytes; their contract edits are unchanged)
- Create: `packages/spec/bin/__tests__/grok-envelope.test.js`
- Read: `packages/spec/src/claude/settings/settings.json`

## Acceptance
- AC-02 and AC-03 as stated in `plan.md`.
- **The loop guard runs before any normalization.** Both fail-closed hooks end in a catch that emits a block, so a reader failure above the guard would block every Stop on Claude, not just a foreign one. In `completion-authority.cjs` the guard reads the raw payload and the normalized object is used from there on. `spec-gate.cjs` takes no reader at all: `sessionIdentity()` already accepts `sessionId` and `sessionID`, the resolver reads camelCase targets, and `projectRoot()` reads `cwd`, so the only foreign spelling it ever needed was `stopHookActive` at that guard. Adding the reader there would have been a line no test could justify.
- **One documented exception to the insertion rule.** `semantic-review-authority.cjs:147` parses at its call site; it is routed as `recordFromSubagentStop(normalizeHookPayload(JSON.parse(raw)))` rather than by adding a second parsing path.
- **The deny output is JSON on stdout, and exit 2 stays.** Both hooks emit `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":<full text>}}` and then exit 2. Grok honours a stdout deny "regardless of exit code" and would otherwise take only the first stderr line, losing the scaffold command that is the whole point of the guard's message. Claude Code reads the same JSON, and the omp bridge already prefers stdout over stderr (`cafekit-bridge.mjs:131-133`). The same text also goes to stderr: on an exit-2 denial that is the channel Claude Code feeds back, so stdout alone would have traded a grok repair for a Claude regression. The bridge comment at `cafekit-bridge.mjs:101` still holds, because the reason on stdout is what every reader takes first.
- After the edits, thirteen hooks contain `normalizeHookPayload` at least once, `spec-gate.cjs` accepts both spellings at its guard, and no hook outside that list contains either change.
- **What the proof does and does not cover.** Six hooks have an observable oracle under grok and each has a counterexample: `privacy-block.cjs`, `inspect-block.cjs`, `task-scaffold-guard.cjs`, `secret-output-guardrail.cjs`, `completion-authority.cjs`, and `spec-gate.cjs`'s guard. The other eight are the context-injecting hooks whose output grok discards, so no test can observe their translation; they are routed for one code path, as `plan.md` records, and that is stated rather than proven.
- **The omp contrast case changes premise.** `a lowercase bash command reading a secret file is denied, where Claude lets it pass` assumed the Claude hook ignores a lowercase name; that assumption was the defect. It becomes `…, where Claude asks`: both hooks now see the name and differ only in the answer, because omp's `tool_call` result has no ask state.
- The packed-install cases pass, proving the manifest entry: a missing entry reproduces the `Cannot find module` class of failure the previous packet hit.

## Dependencies
- task-01-hook-payload-reader.md

## Verification Plan
- Command: `node --test bin/__tests__/grok-envelope.test.js && node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/omp-hooks.test.js && node --test --test-name-pattern "packed Claude and Codex installs" bin/__tests__/package-inventory.test.js`
- Named probe: `the privacy gate asks on a grok run_terminal_command`, `the privacy gate asks on a grok read_file path`, `the Stop gate honours stopHookActive`, `the Stop gate still blocks an unproven done task`, `the approval hook takes its approve path on a grok prompt`, `a broad glob is denied with its full reason in JSON`, `a nested task write is denied under the grok write tool`, `the secret guardrail sees a grok prompt`; every existing case in the four suites as regression guard; `packed Claude and Codex installs execute semantic kernel behavior without package source` as the manifest guard.
- Reachability: known — `grok-envelope.test.js` copies the manifest hook set plus `scripts/` under `<tmp>/.claude/` in a throwaway git repository with one empty commit (the `runtime-dir.test.js` fixture), and runs each hook as a child process with `CLAUDE_PROJECT_DIR` set to the fixture root as grok does.
- Oracle: exact `permissionDecision` values; exit codes; empty stdout for the honoured loop guard; the full multi-line reason present in `permissionDecisionReason`; no `decision: "block"` on the approval path.
- Counterexample: removing the routing call from `privacy-block.cjs`, `completion-authority.cjs`, `task-scaffold-guard.cjs`, `inspect-block.cjs`, or `secret-output-guardrail.cjs` must fail that hook's case; narrowing the `spec-gate.cjs` guard to the snake_case spelling must fail the loop-guard case, whose fixture is a packet the gate would otherwise block; keeping `console.log` instead of the JSON deny must fail the full-reason cases; omitting the manifest entry must fail every case, since the fixture installs from that list.
- Artifacts: ephemeral, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/grok-envelope.test.js && node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/omp-hooks.test.js && node --test --test-name-pattern "packed Claude and Codex installs" bin/__tests__/package-inventory.test.js
Exit: 0
Base: 8f41937e57410be431e294d86cb25ce5a75c0c8f
Head: fead0e4ac83230e3ac6dbaca574f41f926ea9fee2099402561b29597c61e17f0
```text
$ node --test bin/__tests__/grok-envelope.test.js && node --test src/claude/hooks/__tests__/*.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/omp-hooks.test.js && node --test --test-name-pattern "packed Claude and Codex installs" bin/__tests__/package-inventory.test.js
# grok-envelope
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
# hook suite
ℹ tests 219
ℹ suites 0
ℹ pass 219
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
# installer + omp overlay
ℹ tests 86
ℹ suites 0
ℹ pass 86
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
# packed installs
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Counterexamples ran on disposable copies under a temp root, never the tracked bytes. Each of six mutations turned the grok suite red: dropping the reader from `privacy-block.cjs` (2 cases), `completion-authority.cjs`, `task-scaffold-guard.cjs`, `inspect-block.cjs`, or `secret-output-guardrail.cjs`, and narrowing the `spec-gate.cjs` guard to the snake_case spelling. Removing `hooks/lib/hook-payload.cjs` from the migration manifest turned 6 of 10 red, because the fixture installs from that list.

Three earlier mutations stayed green and changed the work rather than the claim. The gate case passed with an empty specs directory for the wrong reason, so its fixture is now a packet the gate would otherwise block. The guardrail case sent the Claude `prompt` key, proving no translation, so it now sends the camelCase twin. And `spec-gate.cjs` needed no reader at all: `sessionIdentity()` already accepts `sessionId`, the resolver reads camelCase targets, and `projectRoot()` reads `cwd`, so only the loop guard gained a second spelling.
