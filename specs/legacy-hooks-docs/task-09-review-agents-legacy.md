# Task 09 — code-review and agents drop the legacy closeout promise

Status: done

## Outcome
The `cf:code-review` skill and its two references, the `project-manager` agent and the `deployer` agent no longer promise a legacy feature receipt, adapter closeout or legacy deployment transition; references to the removed Legacy route stay grammatical.

## Scope
- In: `src/claude/skills/code-review/SKILL.md`: delete `## Legacy workflow compatibility` (`:169-175`, up to `## References`); `:31` "they apply only after the Legacy route below is selected." → "they apply only to a legacy packet." (keep `:30`, pinned by `develop-contract.test.js:1116`).
- In: `src/claude/skills/code-review/references/verification-gate.md`: `:8` "This reference applies only after the Legacy route in `SKILL.md` is selected. A" → "This reference applies only to a legacy packet. A"; `:27-29` "Final integration uses `feature-receipt.md`. Missing final receipt is normal before closeout, but mandatory at closeout. Neither receipt grants approval, readiness, audit status, or product semantics." → "Closing a legacy `spec.json` packet that has no `schema_version` still requires `feature-receipt.md`. A receipt never grants approval, readiness, audit status, or product semantics." (N-01, user decision "Giữ 1 câu": the one kept sentence is true because the Stop gate still checks `feature-receipt.md` at closeout for a non-2.1 packet, `src/claude/hooks/spec-gate.cjs:251-256`; every other closeout promise in the file is deleted).
- In: `src/claude/skills/code-review/references/spec-compliance-review.md:34-36`: "At final integration, consume `feature-receipt.md`. Review never creates either receipt and never treats a receipt as …" → "Review never creates a receipt and never treats a receipt as …".
- In: `src/claude/agents/project-manager.md`: delete `:64-71` (blank + `## Legacy compatibility` to EOF).
- In: `src/claude/agents/deployer.md:105-106`: "…after process-first closeout, or by the valid legacy deployment transition for an existing packet." → "…after process-first closeout."; keep `:109` ("does not write … legacy `spec.json` state", true and needed by `develop-contract.test.js:805`).
- Out: `code-review/SKILL.md:41,134,180,183` (adapter inputs and separate-receipt pointers describe current per-task receipt consumption); `verification-gate.md:23-26,31-34` (per-task receipts, v2.1 semantic receipt).

## Coverage
- CP-06

## Ownership
- Modify: `src/claude/skills/code-review/SKILL.md`
- Modify: `src/claude/skills/code-review/references/verification-gate.md`
- Modify: `src/claude/skills/code-review/references/spec-compliance-review.md`
- Modify: `src/claude/agents/project-manager.md`
- Modify: `src/claude/agents/deployer.md`
- Read: `bin/__tests__/develop-contract.test.js:798-825,1110-1120`, `scripts/run-skill-self-tests.mjs:6170-6175`

## Steps
1. Edit the five files as in Scope.
2. Run the Command.

## Acceptance
- AC-10: no `Legacy compatibility`, `Legacy workflow compatibility`, `Legacy route`, `feature-receipt.md`, `mandatory at closeout`, `Final integration`, `installed adapter`, `feature closeout` or `legacy deployment transition` line in the five files, except the one kept N-01 sentence: `verification-gate.md` names `feature-receipt.md` on exactly one line, and the sentence "Closing a legacy `spec.json` packet that has no `schema_version` still requires `feature-receipt.md`." appears exactly once; the two rewritten pointer sentences are present; `develop-contract` + `codex-native` pass 103 tests.

## Dependencies
- task-08-develop-legacy.md

## Verification Plan
- Command: `F=/tmp/ck-3c-09.txt; R=src/claude/skills/code-review; V=$R/references/verification-gate.md; rm -f $F; grep -nE 'Legacy compatibility|installed adapter|feature closeout|legacy deployment transition|Legacy workflow compatibility|Legacy route|feature-receipt\.md|mandatory at closeout|Final integration|At final integration' src/claude/agents/project-manager.md src/claude/agents/deployer.md $R/SKILL.md $V $R/references/spec-compliance-review.md | grep -v '^[^:]*verification-gate\.md:[0-9]*:requires .feature-receipt\.md.\. A receipt never grants approval, readiness, audit$' > $F; cat $F; [ ! -s $F ] && [ "$(grep -c 'feature-receipt\.md' $V)" = 1 ] && [ "$(tr '\n' ' ' < $V | grep -o 'Closing a legacy .spec\.json. packet that has no .schema_version. still requires .feature-receipt\.md.\.' | wc -l | tr -d ' ')" = 1 ] && grep -q 'they apply only to a legacy packet\.$' $R/SKILL.md && grep -q '^This reference applies only to a legacy packet\. A$' $V && grep -q 'Do not load or follow legacy separate-receipt paragraphs from$' $R/SKILL.md && grep -q 'does not write process-first Status/Receipt or legacy' src/claude/agents/deployer.md && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 103' $F && grep -qx '# fail 0' $F && rm -f $F`
- Named probe: `develop-contract.test.js` "core execution agents default to process-first state and isolate legacy packets" (deployer, `:798-825`) and the installed code-review checks (`:1110-1120`; Codex `codex-native.test.js:2766`); the runner's code-review boundary stage (`:6170-6175`) runs in task-10.
- Reachability: source + installed (the two tests install Claude and Codex into temp projects) — run from `packages/spec/`.
- Oracle: exit 0; no listed line; `feature-receipt.md` on exactly one line of `verification-gate.md`; the kept sentence found once; `# tests 103`, `# fail 0`. On acfdf6e9 the Command exits 1 with 11 hits (rechecked 2026-10-06). The installed-copy assertion `develop-contract.test.js:1113-1116` compares the installed `code-review/SKILL.md` with source and still requires `:30`; no test compares the installed `verification-gate.md`, so the kept sentence is proven at source level only.
- Counterexample: leaving the code-review section or `:31` "Legacy route" lists a hit; keeping "Final integration uses `feature-receipt.md`" or "mandatory at closeout" lists a hit; dropping the kept sentence fails the count of 1; writing it twice fails the count of 1; removing `deployer.md:109` fails the agent test (`/legacy/i`); a damaged installed review skill fails `:1116`.
- Artifacts: `/tmp/ck-3c-09.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-09.txt; R=src/claude/skills/code-review; V=$R/references/verification-gate.md; rm -f $F; grep -nE 'Legacy compatibility|installed adapter|feature closeout|legacy deployment transition|Legacy workflow compatibility|Legacy route|feature-receipt\.md|mandatory at closeout|Final integration|At final integration' src/claude/agents/project-manager.md src/claude/agents/deployer.md $R/SKILL.md $V $R/references/spec-compliance-review.md | grep -v '^[^:]*verification-gate\.md:[0-9]*:requires .feature-receipt\.md.\. A receipt never grants approval, readiness, audit$' > $F; cat $F; [ ! -s $F ] && [ "$(grep -c 'feature-receipt\.md' $V)" = 1 ] && [ "$(tr '\n' ' ' < $V | grep -o 'Closing a legacy .spec\.json. packet that has no .schema_version. still requires .feature-receipt\.md.\.' | wc -l | tr -d ' ')" = 1 ] && grep -q 'they apply only to a legacy packet\.$' $R/SKILL.md && grep -q '^This reference applies only to a legacy packet\. A$' $V && grep -q 'Do not load or follow legacy separate-receipt paragraphs from$' $R/SKILL.md && grep -q 'does not write process-first Status/Receipt or legacy' src/claude/agents/deployer.md && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 103' $F && grep -qx '# fail 0' $F && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: 4a4188c300744998d83360372bf6dc21e4c72ae87c790ef6f3d0e1352c1112f8
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# tests 103
# fail 0
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
