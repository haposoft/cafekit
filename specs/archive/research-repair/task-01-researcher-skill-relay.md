# Task 01 — The researcher and the skill keep depth, claim labels and anchors through the relay

Status: done

## Outcome
The researcher's report opens with its depth, labels every material claim in English, anchors every repository claim and asks its caller to keep all three; its description says so to the caller before dispatch; it runs on the caller's model. The research skill's answer labels every material claim and keeps a researcher report's depth, labels and anchors. The self-test requires these clauses and rejects their removal.

## Scope
- In: the exact text below in `researcher.md` (frontmatter `description` and `model`, `## Proportional depth`, `## Output`) and in `SKILL.md` (step 3's delegation paragraph, step 5); a `relay-labels` group and its mutations in the research adaptive self-test.
- Out: every other clause of both files (each pinned clause stays byte-identical), the skill's `description`, `when_to_use` and `metadata`, the template `packages/spec/src/claude/skills/specs/templates/research.md`, the installed copies under `.claude/`, and every other agent.

## Coverage
- CP-01, CP-02

## Ownership
- Modify: `packages/spec/src/claude/agents/researcher.md`
- Modify: `packages/spec/src/claude/skills/research/SKILL.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js`, `packages/spec/bin/lib/codex-install.js`

## Steps
1. In `researcher.md` frontmatter, set `model: inherit` (was `haiku`) and replace the `description` value with `"Evidence researcher for bounded technical decisions, source reconciliation, and project-fit recommendations. Its report opens with its depth and labels every claim; keep both, and its path:line anchors, when relaying it."`
2. In `researcher.md` `## Proportional depth`, after `Honor the controller's \`Quick | Standard | Deep\` assignment.` insert the sentence `When none is assigned, choose Quick for one low-risk, reversible fact or known option, Standard for several viable options or a material integration choice, and Deep for high blast radius, hard-to-reverse architecture, security/compliance, substantial cost, or conflicting evidence.` (the skill's routing rule, `SKILL.md:29-33`, which the agent path does not load).
3. At the end of `researcher.md` `## Output`, after its existing paragraph, add a new paragraph and a line of its own:
   - `Open the report with one line, \`Depth: Quick\`, \`Depth: Standard\` or \`Depth: Deep\`, followed by \`(assigned)\` or, when no depth was assigned, by \`(chosen: <reason>)\`. End every material claim with its status in parentheses — \`(confirmed)\`, \`(inferred)\` or \`(unresolved)\` — in English whatever the report's language, and give every repository claim its \`path:line\` anchor. Close the report with this line:`
   - `Relay: keep the Depth line, every status label and every path:line anchor when you summarize this report.`
4. In `SKILL.md` step 3, append to the paragraph that ends `research sequentially with the same evidence bar.` the sentence `When a researcher's report feeds the answer, keep its \`Depth:\` line, its status labels and its \`path:line\` anchors, reconciled with your own evidence.`
5. In `SKILL.md` step 5, after `Always state depth used, decisive evidence, recommendation, limitations, and unresolved gaps.` add `Give every material claim in the answer its status in parentheses — \`(confirmed)\`, \`(inferred)\` or \`(unresolved)\` — in English whatever the answer's language.`
6. In `run-skill-self-tests.mjs` `researchAdaptiveContractIssues`, add `requireClauses("relay-labels", …)` requiring, for `agent`: `model: inherit`, `Its report opens with its depth and labels every claim; keep both, and its path:line anchors, when relaying it.`, `When none is assigned, choose Quick for one low-risk, reversible fact or known option, Standard for several viable options or a material integration choice, and Deep for high blast radius, hard-to-reverse architecture, security/compliance, substantial cost, or conflicting evidence.`, `Open the report with one line`, `End every material claim with its status in parentheses`, `Relay: keep the Depth line, every status label and every path:line anchor when you summarize this report.`; for `skill`: `When a researcher's report feeds the answer, keep its`, `Give every material claim in the answer its status in parentheses`. Add seven mutations to `runResearchAdaptiveContractTests` expecting `relay-labels`: `model: inherit` → `model: haiku` (agent); `choose Quick for one low-risk, reversible fact or known option,` → `choose Deep for everything,` (agent); the `Relay:` line → an empty string (agent); `Open the report with one line` → `Open the report freely` (agent); `End every material claim with its status in parentheses` → `End claims as convenient` (agent); `When a researcher's report feeds the answer, keep its` → `When a researcher's report feeds the answer, rewrite its` (skill); `Give every material claim in the answer its status in parentheses` → `Give claims as you see fit` (skill). The count line then prints `count=25`.
7. Every sentence added in Steps 1–5 sits on one physical line (no hard wrap inside it), so the Command's line-based `grep -F` finds it.
8. Run the Verification Plan Command in the background (the runner takes about ten minutes and the two test files about three) → it exits 0 and prints the `sources-digest:` line that tasks 03 and 04 guard.

## Acceptance
- AC-01: the `researcher.md` greps in the Command pass and `model: inherit` is its only `model:` line.
- AC-02: the `SKILL.md` greps in the Command pass.
- AC-03: the runner prints `cf:research checker rejects semantic weakenings; count=25` and its final `PASS` line with no failure; both `node --test` files report 0 failures.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'cd packages/spec && A=src/claude/agents/researcher.md && S=src/claude/skills/research/SKILL.md && [ "$(grep -c "^model:" $A)" = 1 ] && grep -qx "model: inherit" $A && grep -qF "Its report opens with its depth and labels every claim; keep both, and its path:line anchors, when relaying it." $A && grep -qF "When none is assigned, choose Quick for one low-risk, reversible fact or known option, Standard for several viable options or a material integration choice, and Deep for high blast radius, hard-to-reverse architecture, security/compliance, substantial cost, or conflicting evidence." $A && grep -qF "Open the report with one line" $A && grep -qF "End every material claim with its status in parentheses" $A && grep -qxF "Relay: keep the Depth line, every status label and every path:line anchor when you summarize this report." $A && grep -qF "When a researcher" $S && grep -qF "report feeds the answer, keep its" $S && grep -qF "Give every material claim in the answer its status in parentheses" $S && out=$(node scripts/run-skill-self-tests.mjs 2>&1); e=$?; printf "%s\n" "$out" | grep -E "cf:research|PASS|FAIL" ; [ $e = 0 ] && printf "%s\n" "$out" | grep -qF "cf:research checker rejects semantic weakenings; count=25" && t=$(node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js 2>&1); te=$?; printf "%s\n" "$t" | grep -E "^# (tests|pass|fail|skipped)"; [ $e = 0 ] && [ $te = 0 ] && cd ../.. && s=$( (cd packages/spec/src/claude && find skills/research skills/specs agents/researcher.md -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s"'`
- Named probe: the greps for each new clause; `runResearchAdaptiveContractTests` (its `relay-labels` group and seven new mutations, `count=25`); `codex-native.test.js` (the installed Codex research skill and `researcher.toml` built from these sources) and `package-inventory.test.js`
- Reachability: known — `evals/run.sh` copies these source files into the eval plugin (the baseline's `sources-digest` covers them), and the installer builds the Claude and Codex copies from them
- Oracle: the Command exits 0, prints the research self-test lines with `count=25` and the runner's `PASS` line, `# fail 0` for the two test files, and one `sources-digest:` line of 64 hex digits
- Counterexample: a file without one of the new clauses fails its grep before the runner; a checker that misses a new mutation throws `[FAIL] Research adaptive mutation …` and the runner exits 1; a changed pinned clause fails its existing group; `model: haiku` fails the `model: inherit` grep
- Artifacts: none; the `sources-digest:` line is recorded in the Receipt for task 03

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'cd packages/spec && A=src/claude/agents/researcher.md && S=src/claude/skills/research/SKILL.md && [ "$(grep -c "^model:" $A)" = 1 ] && grep -qx "model: inherit" $A && grep -qF "Its report opens with its depth and labels every claim; keep both, and its path:line anchors, when relaying it." $A && grep -qF "When none is assigned, choose Quick for one low-risk, reversible fact or known option, Standard for several viable options or a material integration choice, and Deep for high blast radius, hard-to-reverse architecture, security/compliance, substantial cost, or conflicting evidence." $A && grep -qF "Open the report with one line" $A && grep -qF "End every material claim with its status in parentheses" $A && grep -qxF "Relay: keep the Depth line, every status label and every path:line anchor when you summarize this report." $A && grep -qF "When a researcher" $S && grep -qF "report feeds the answer, keep its" $S && grep -qF "Give every material claim in the answer its status in parentheses" $S && out=$(node scripts/run-skill-self-tests.mjs 2>&1); e=$?; printf "%s\n" "$out" | grep -E "cf:research|PASS|FAIL" ; [ $e = 0 ] && printf "%s\n" "$out" | grep -qF "cf:research checker rejects semantic weakenings; count=25" && t=$(node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js 2>&1); te=$?; printf "%s\n" "$t" | grep -E "^# (tests|pass|fail|skipped)"; [ $e = 0 ] && [ $te = 0 ] && cd ../.. && s=$( (cd packages/spec/src/claude && find skills/research skills/specs agents/researcher.md -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "sources-digest: $s"'
Exit: 0
Base: 3fa9f43cdd2e1136ba9462f11ac8ad3939ab91e7
Head: 854e7541a8368ddffdad8d6ece10b3370238438421bf70813f8c2777369f6814
```text
✔ cf:research adaptive evidence contract is complete and bounded
✔ cf:research checker rejects semantic weakenings; count=25
# Subtest: C14/R1.8: bootstrapBaseline refuses before the seed PASS exists, and refuses base/head mismatches
ok 10 - C14/R1.8: bootstrapBaseline refuses before the seed PASS exists, and refuses base/head mismatches
# Subtest: flash PASS promotes proof; only trusted sync-finalize completes
ok 159 - flash PASS promotes proof; only trusted sync-finalize completes
# Subtest: canonical receipt requires command, exit, provenance and unambiguous PASS
ok 162 - canonical receipt requires command, exit, provenance and unambiguous PASS
# Subtest: P0 sync-finalize derives promotion from current FLASH_UNVERIFIED plus explicit PASS proof
ok 184 - P0 sync-finalize derives promotion from current FLASH_UNVERIFIED plus explicit PASS proof
# Subtest: P0 canonical phantom vectors - zero, cancellation, suite, FAIL, error, collected (r3)
ok 195 - P0 canonical phantom vectors - zero, cancellation, suite, FAIL, error, collected (r3)
# Subtest: explicit PASS builds a completed C2 receipt, preserves C16, and is ready
ok 197 - explicit PASS builds a completed C2 receipt, preserves C16, and is ready
# Subtest: explicit FAIL is authoritative even when there are no blockers
ok 198 - explicit FAIL is authoritative even when there are no blockers
# Subtest: PASS with blocking findings or decisions is refused
ok 199 - PASS with blocking findings or decisions is refused
# Subtest: a PASS starts the next epoch with a reset FAIL attempt index
ok 205 - a PASS starts the next epoch with a reset FAIL attempt index
# Subtest: the third FAIL is terminal BLOCKED and there is no index 3
ok 206 - the third FAIL is terminal BLOCKED and there is no index 3
# Subtest: 8. explicit failure cannot pass even when PASS text is present
ok 155 - 8. explicit failure cannot pass even when PASS text is present
# Subtest: 19. cache-hit: unchanged valid receipt stays PASS on second Stop (revalidation)
ok 166 - 19. cache-hit: unchanged valid receipt stays PASS on second Stop (revalidation)
# Subtest: 26. explicit failure outcomes Tests failed / Result FAIL and multiple Results must block
ok 173 - 26. explicit failure outcomes Tests failed / Result FAIL and multiple Results must block
[skill-test] PASS: 1563 tests executed
# tests 54
# pass 53
# fail 0
# skipped 1
sources-digest: 8d27156c7b2d5f0ce3b845dff8cc0f8b068213354c04f527935dc3bb5e004a8f
```

The fenced block is the Command's whole output from its re-run on 2026-10-01 (`bash -c` on this file's Command text, `node` v22.23.3 first on `PATH`), made to bind this Receipt to the packet's final Head after tasks 02–04 added files outside the specs root; it exited 0 and left the tree unchanged (`git status --short` identical before and after). The first run (2026-09-30, Head `147e2ed7…`) printed the same `count=25`, `PASS: 1563` and `sources-digest:` line. Before the change the same Command exited 1 with no output, stopping at its first check (the researcher's single `model:` line was not `inherit`).

sources-digest: 8d27156c7b2d5f0ce3b845dff8cc0f8b068213354c04f527935dc3bb5e004a8f

The runner went from 1556 to 1563 tests (the seven new mutations); the two `node --test` files report 54 tests, 53 passed, 0 failed, 1 skipped (the live Codex end-to-end test, run only with `CAFEKIT_CODEX_HOST_E2E=1`). The installed `.claude/` copies are unchanged (plan Known limits).

A fresh `code-auditor` review returned PASS: every Step 1–5 sentence matches the task byte for byte on one physical line, the rest of both files equals `HEAD` apart from one line break after `assignment.`, the seven mutations are each caught by `relay-labels` on a copy, the frontmatter parses as YAML, the generated Codex `researcher.toml` parses as TOML without `model`, and the sources digest was recomputed. Three Lows, left as they are: the Output and SKILL.md pins are prefixes, so removing the label set, "in English whatever the report's language" or the `path:line` clause is not caught by the self-test (the task's Step 6 chose prefixes); `researcher.md:28` is now a short line (`Quick resolves one`); several researcher tracks could bring several `Depth:` lines into one answer (inferred, unmeasured).
