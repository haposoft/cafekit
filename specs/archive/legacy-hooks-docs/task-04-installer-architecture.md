# Task 04 — installer architecture doc matches the current hooks

Status: done

## Outcome
`docs/installer-architecture.md` describes the hooks that exist today: one Stop gate (2.1 closeout blocked, mid-execution receipt checks, Strict refused), no closeout approval, the omp and grok hook sets without removed hooks; its runner anchors quote the new text.

## Scope
- In: `:78`: "…so the scaffold guard and the tool-name table left the overlay." → "…so the tool-name table left the overlay."
- In: `:82`: "Carried: every hook registered for SessionStart, PreCompact, UserPromptSubmit, PreToolUse, PostToolUse, and Stop, with two named divergences: omp still runs `docs-sync.cjs` at SessionStart, which Claude now runs only on demand from the `docs` skill, and does not run `spec-state.cjs` at PostToolUse. Not carried: `agent.cjs` (SubagentStart) and `state.cjs` (SubagentStop), because omp has no subagent lifecycle events." (rest of the paragraph unchanged; divergences per `omp-bridge.test.js:54-55`).
- In: `:105`: drop `` `docs-sync.cjs`, `` from the grok reminder list (Claude settings no longer register it, so grok never runs it). `:107`: "…so a multi-line reason would otherwise arrive truncated to its headline."
- In: `## Completion gate identity` (`:240-256`): replace the two-hook intro and both bullets with an intro that reads: The Stop gate asks about the project's Specs packets, and it first has to answer "which feature is this turn about?" It asks which packet still has unfinished work. — followed by the existing narrowing sentences (any layout qualifies … completion-policy layers) with `semantic-digest, ` dropped from the layer list (A-02), then a new paragraph: a legacy `schema_version` `2.1` packet that claims closeout (`status` done/completed/complete or a closeout phase) is blocked with "Legacy spec.json closeout is no longer supported; move the packet to plan.md with flat task files"; mid-execution it still gets the ordinary receipt checks; the closeout-approval hook that once asked which packet was claiming closeout, and the Strict reviewer attestation, were removed; the validator fails a `Strict` packet with "Strict assurance is no longer supported".
- In: `:257` "Before this, both hooks decided identity" → "Before this, the gate decided identity"; `:271` "Both Stop hooks read it on both runtimes." → "The Stop gate reads it on both runtimes."; delete the approval-prompt sentence `:278-279`; `:306` → "- **Two packets that both still have unfinished work still block** until the file names one."
- In: `scripts/run-skill-self-tests.mjs:5358`: expect "Not carried: `agent.cjs` (SubagentStart) and `state.cjs` (SubagentStop)" and add `!content.includes("semantic-review-authority") &&`. `:5380`: replace `content.includes("which packet is claiming closeout") &&` with `!content.includes("Two Stop hooks") &&`, `!content.includes("semantic-digest") &&` and `content.includes("Strict assurance is no longer supported") &&`; keep the other clauses (the reworded text still contains "which packet still has unfinished work" and "still block").
- Out: `:153` (`docs-sync` hook stays a core asset — still true); the receipt-binding bullets `:286-305`; every other section.

## Coverage
- CP-02

## Ownership
- Modify: `../../docs/installer-architecture.md`
- Modify: `scripts/run-skill-self-tests.mjs` (lines 5358, 5380 region only)
- Read: `src/claude/hooks/spec-gate.cjs:127-132,186-191`, `src/codex/hooks/spec-gate.cjs:55,111`, `src/claude/settings/settings.json`, `src/omp/extensions/cafekit-bridge.mjs:41-47`, `bin/__tests__/omp-bridge.test.js:54-55`

## Steps
1. Edit the omp and grok lines.
2. Rewrite the identity section as in Scope.
3. Edit both runner anchors → the runner names a removed hook exactly once (the new `!content.includes("semantic-review-authority")`).
4. Run the Command.

## Acceptance
- AC-04: zero matches for the removed-hook, scaffold-guard, two-hook, approval and old divergence patterns; the new omp, closeout, Strict and Stop-gate sentences are present; both anchors match.

## Dependencies
- task-03-specs-sync-skills.md

## Verification Plan
- Command: `D=../../docs/installer-architecture.md; F=/tmp/ck-3c-04.txt; rm -f $F; grep -nE 'semantic-review-authority|completion-authority|task-scaffold-guard|scaffold guard|Two Stop hooks|Both Stop hooks|Closeout approval|approval prompt|claiming closeout still block|semantic-digest|.docs-sync\.cjs., .state\.cjs.' $D > $F; cat $F; [ ! -s $F ] && grep -q 'Not carried: .agent.cjs. (SubagentStart) and .state.cjs. (SubagentStop)' $D && grep -q 'omp still runs .docs-sync.cjs. at SessionStart' $D && grep -q 'Legacy spec.json closeout' $D && grep -q 'Strict assurance is no longer supported' $D && grep -q 'The Stop gate reads it on both runtimes' $D && grep -q 'content.includes("Not carried: .agent.cjs. (SubagentStart) and .state.cjs. (SubagentStop)") &&' scripts/run-skill-self-tests.mjs && grep -q '!content.includes("Two Stop hooks") &&' scripts/run-skill-self-tests.mjs && grep -q '!content.includes("semantic-digest") &&' scripts/run-skill-self-tests.mjs && ! grep -q 'which packet is claiming closeout' scripts/run-skill-self-tests.mjs && [ "$(grep -cE 'completion-authority|semantic-review-authority|task-scaffold-guard' scripts/run-skill-self-tests.mjs)" = 1 ] && rm -f $F`
- Named probe: the doc greps and the anchor greps in the Command; the runner checks "installer architecture documents omp coverage and gaps" and "installer architecture documents completion gate identity" execute in task-10.
- Reachability: source — run from `packages/spec/`; the doc is read at `../../docs/`.
- Oracle: exit 0 and no listed line. On acfdf6e9 the Command exits 1 with 10 hits (`:78,82,105,107,240,248,250,271,278,306`).
- Counterexample: keeping "Both Stop hooks", the approval sentence, `semantic-digest` or `semantic-review-authority` lists a hit; leaving the old anchor text fails the `! grep -q` and the count-of-1 pin.
- Artifacts: `/tmp/ck-3c-04.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `D=../../docs/installer-architecture.md; F=/tmp/ck-3c-04.txt; rm -f $F; grep -nE 'semantic-review-authority|completion-authority|task-scaffold-guard|scaffold guard|Two Stop hooks|Both Stop hooks|Closeout approval|approval prompt|claiming closeout still block|semantic-digest|.docs-sync\.cjs., .state\.cjs.' $D > $F; cat $F; [ ! -s $F ] && grep -q 'Not carried: .agent.cjs. (SubagentStart) and .state.cjs. (SubagentStop)' $D && grep -q 'omp still runs .docs-sync.cjs. at SessionStart' $D && grep -q 'Legacy spec.json closeout' $D && grep -q 'Strict assurance is no longer supported' $D && grep -q 'The Stop gate reads it on both runtimes' $D && grep -q 'content.includes("Not carried: .agent.cjs. (SubagentStart) and .state.cjs. (SubagentStop)") &&' scripts/run-skill-self-tests.mjs && grep -q '!content.includes("Two Stop hooks") &&' scripts/run-skill-self-tests.mjs && grep -q '!content.includes("semantic-digest") &&' scripts/run-skill-self-tests.mjs && ! grep -q 'which packet is claiming closeout' scripts/run-skill-self-tests.mjs && [ "$(grep -cE 'completion-authority|semantic-review-authority|task-scaffold-guard' scripts/run-skill-self-tests.mjs)" = 1 ] && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: 967214a97654da8da701013dc129d227757b6c1150d9a1099a9c34642b5655ec
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
