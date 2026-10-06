# Task 02 — agent and skill text drop the removed mechanisms

Status: done

## Outcome
No agent or skill text tells the model to emit `CAFEKIT_SEMANTIC_REVIEW_ATTESTATION`, run the Strict attestation validator, or use the completion-authority path, on Claude or in the installed Codex `code_auditor.toml`, and the code-review boundary check pins their absence.

## Scope
- In: `code-auditor.md` — in `## Test-Run Boundary` (`:14-27`) end the allowed-command sentence after the read-only reproduction (drop "and, for a Strict legacy review, the attestation validator `…` or `…`", `:20-22`); delete the whole `## Strict Semantic Review Attestation (Honest-Agent Guardrail)` section (`:196-218`).
- In: develop `SKILL.md:178` — replace "and use the existing completion-authority path for final closeout." with "Legacy `spec.json` closeout is no longer supported; move the packet to `plan.md` with flat task files before closing it." (one line; keep the heading and the skill between 140 and 200 lines, `run-skill-self-tests.mjs:2599-2610`).
- In: `references/quality-gate.md:128-129` — drop ", and completion-authority checks" so the sentence ends at "persisted independent-audit obligations."
- In: `run-skill-self-tests.mjs` `runCodeReviewBoundaryCheck` — replace `present("auditor allows the Strict validator", …)` (`:6241`) with `absent("auditor drops the Strict attestation validator", "auditor", "the attestation validator")` and add `absent("auditor drops the attestation marker", "auditor", "CAFEKIT_SEMANTIC_REVIEW_ATTESTATION")`.
- In: `codex-native.test.js` — rename `Codex installed code_auditor contains Strict conditional marker` (`:3166-3176`) to `Codex installed code_auditor carries no Strict attestation marker` and assert the installed toml does not match `/CAFEKIT_SEMANTIC_REVIEW_ATTESTATION/`, `/Strict Semantic Review Attestation/` or `/MAC-protected host-hook observation/`; in `Codex Windows hook launchers stay project-bound without Git from nested cwd` drop `semanticReviewEvents` (`:1988,:2002-2006`) — task 05 removes that registration.
- In: `src/claude/hooks/__tests__/semantic-review-authority.test.js` — delete the case `code-auditor agent ships Strict conditional marker contract` (`:250-259`; task 05 deletes the rest of the file).
- In: `bin/__tests__/develop-contract.test.js:821` — replace `assert.match(auditor, /attestation belongs only to the valid legacy/i)` with `assert.doesNotMatch(auditor, /CAFEKIT_SEMANTIC_REVIEW_ATTESTATION/)` (second writer of this file, after task 01).
- Out: docs, `CLAUDE.md`/`AGENTS.md`, `installer-architecture.md` (3c); `run-skill-self-tests.mjs:6050-6055` helper allowlist (task 08).

## Coverage
- CP-02

## Ownership
- Modify: `src/claude/agents/code-auditor.md`, `src/claude/skills/develop/SKILL.md`, `src/claude/skills/develop/references/quality-gate.md`, `scripts/run-skill-self-tests.mjs` (`:6241` only; task 08 owns `:6050-6054`), `bin/__tests__/codex-native.test.js`, `bin/__tests__/develop-contract.test.js` (`:821` only, after task 01), `src/claude/hooks/__tests__/semantic-review-authority.test.js` (one case)

Seven files, above the usual five: the two extra test edits are one assertion each, forced by the `code-auditor.md` change (A-01).
- Read: `scripts/run-skill-self-tests.mjs:6172-6200` (present/absent helpers and their weakening mutations), `:2580-2610` (develop legacy pins)

## Steps
1. Edit the three Markdown files as scoped.
2. Edit the two pins in `run-skill-self-tests.mjs`, the two cases in `codex-native.test.js`, the `semantic-review-authority.test.js` case and `develop-contract.test.js:821`.
3. Run the Command (full runner: the code-review boundary check runs only after the Node suites, `run-skill-self-tests.mjs:7136-7138`).

## Acceptance
- AC-02: the full runner passes with the two `absent` pins; the renamed Codex test passes on a real Codex install; the greps find nothing.

## Dependencies
- task-01-strict-unsupported.md

## Verification Plan
- Command: `F=/tmp/ck-3b-02.txt; rm -f $F; node scripts/run-skill-self-tests.mjs > $F 2>&1; tail -5 $F; grep -qE '^\[skill-test\] PASS: [0-9]+ tests executed$' $F && grep -qE '^ok [0-9]+ - Codex installed code_auditor carries no Strict attestation marker$' $F && ! grep -nE 'CAFEKIT_SEMANTIC_REVIEW_ATTESTATION|attestation validator|Strict Semantic Review Attestation' src/claude/agents/code-auditor.md && ! grep -n 'completion-authority' src/claude/skills/develop/SKILL.md src/claude/skills/develop/references/quality-gate.md && grep -q 'auditor drops the attestation marker' scripts/run-skill-self-tests.mjs && ! grep -n 'code-auditor agent ships Strict conditional marker contract' src/claude/hooks/__tests__/semantic-review-authority.test.js && ! grep -n 'attestation belongs only to the valid legacy' bin/__tests__/develop-contract.test.js && rm -f $F`
- Named probe: `runCodeReviewBoundaryCheck` rules `auditor drops the Strict attestation validator` and `auditor drops the attestation marker` (each also weakened by the check itself); `codex-native.test.js` `Codex installed code_auditor carries no Strict attestation marker`; the develop plan-native checker (`legacy-isolation`, `context-budget`).
- Reachability: source — the runner reads `src/claude/agents/code-auditor.md`; installed — `bin/install.js` Codex install transforms it to `.codex/agents/code_auditor.toml`.
- Oracle: exit 0; `[skill-test] PASS`; the named `ok` line; the greps find nothing (each currently finds a match: `code-auditor.md:20,196,207`, `SKILL.md:178`, `quality-gate.md:129`).
- Counterexample: without the A-01 edits the full runner fails in `semantic-review-authority.test.js` and `develop-contract.test.js` (both assert the removed section); leaving the section makes both the boundary rule and the Codex test fail; deleting the anchor instead of flipping it fails the last grep; a two-line develop rewrite that crosses 200 lines fails `context-budget`.
- Artifacts: `/tmp/ck-3b-02.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-02.txt; rm -f $F; node scripts/run-skill-self-tests.mjs > $F 2>&1; tail -5 $F; grep -qE '^\[skill-test\] PASS: [0-9]+ tests executed$' $F && grep -qE '^ok [0-9]+ - Codex installed code_auditor carries no Strict attestation marker$' $F && ! grep -nE 'CAFEKIT_SEMANTIC_REVIEW_ATTESTATION|attestation validator|Strict Semantic Review Attestation' src/claude/agents/code-auditor.md && ! grep -n 'completion-authority' src/claude/skills/develop/SKILL.md src/claude/skills/develop/references/quality-gate.md && grep -q 'auditor drops the attestation marker' scripts/run-skill-self-tests.mjs && ! grep -n 'code-auditor agent ships Strict conditional marker contract' src/claude/hooks/__tests__/semantic-review-authority.test.js && ! grep -n 'attestation belongs only to the valid legacy' bin/__tests__/develop-contract.test.js && rm -f $F`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: 398db126db0cf0b41932c4a64772f06e009bf1ab5968f6c1f415b15c18b7306c
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
[skill-test] PASS: 1630 tests executed
```
Pre-change run (implementer): the runner passed (1629) but the Command failed at the named `ok … carries no Strict attestation marker` clause. The Command checks that line and its greps against its own temp file and removes it on success, so only the runner tail is quoted. Leftover: an unused `event` binding in `codex-native.test.js:1988` (harmless).
