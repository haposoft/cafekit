# Task 01 — Author the two ported rules with static guards

Status: done

## Outcome
The CafeKit source payload carries two additional rules — review/audit/decision precedence and background-process hygiene — in CafeKit vocabulary and transform-safe wording, guarded by static probes that reject both a missing clause and its negation.

## Coverage
- CP-01, CP-02, CP-04

## Scope
- In: create `review-audit-self-decision.md` and `process-management.md` under `packages/spec/src/claude/rules/`, each about 30–45 lines, carrying every clause listed in `plan.md` CP-01/CP-02. Resolve overlap by reference, not restatement: Scout First says scout before asking and defers ask-back conditions to `hapo:ask`; User Decisions names the C1/C2/C3 gates as defined elsewhere instead of redefining them; Stable Code Artifacts says "do not add" so legacy artifacts stay untouched. Name `hapo:develop` wave worktrees in the stop-before-release rule. Add three entries to the harness `checks` array (`run-skill-self-tests.mjs:3983-5162`, probe shape at `:5154-5161`): one per rule asserting required anchors **and** the absence of negation patterns, plus one transform-safety probe that requires `bin/lib/codex-install.js` (precedent `:5121-5127`) and asserts `normalizeCodexBody(content, sourcePath)` equals a rename-only projection of the same bytes for both files.
- Out: installed parity, the Codex runtime pointer, and packed-payload assertions (task 02); any mutation-checker function or mutation table; edits to existing rules, templates, guides, or `packages/spec/src/codex/rules/`; edits to canonical bytes outside the two new files.
- Transform-safe wording (each token would make the Codex or Claude copy diverge from the rename-only projection): no `Claude Code`, `CLAUDE.md`, `.claude/` or `.codex/` path, no quoted or backticked bare `.claude`, no `packages/spec/src/` path (`copy-utils.js:28-39`), no `AskUserQuestion` (also pinned by an exact four-path corpus oracle at `codex-native.test.js:1554-1566`), no `TodoWrite`/`TaskCreate`/`TaskGet`/`TaskUpdate`/`TaskList`/`SendMessage`/`WebSearch`/`WebFetch`, no backticked tool name (`Bash`, `Read`, `Glob`, `Grep`, `Write`, `Edit`, `NotebookEdit`), no `Agent(`/`Agent tool`/`` `Agent` ``/`subagent_type`/`prompt=`/`description="`/`Explore subagent`, no hyphenated agent name (`code-auditor`, `test-runner`, `spec-maker`, `docs-keeper`, `git-ops`, `project-manager`, `ui-ux-designer`), no bare slash skill form — the rewritten set is `/brainstorm`, `/code-review`, `/debug`, `/develop`, `/docs`, `/frontend-design`, `/git`, `/hotfix`, `/inspect`, `/question`, `/research`, `/specs`, `/test` (`codex-install.js:248-251`), no bare `hapo:` without a skill name (`codex-native.test.js:2200-2214`), no `Claude Tasks`. Named skills such as `hapo:ask`, `hapo:scout`, and `hapo:develop` are allowed and are exactly the renames the projection expects.

## Ownership
- Create: `packages/spec/src/claude/rules/review-audit-self-decision.md`
- Create: `packages/spec/src/claude/rules/process-management.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `~/Desktop/cafekit-ref/.claude/rules/review-audit-self-decision.md`, `~/Desktop/cafekit-ref/.claude/rules/process-management.md`, `packages/spec/bin/lib/codex-install.js`, `packages/spec/src/claude/rules/ai-dev-rules.md`, `packages/spec/src/claude/skills/question/SKILL.md`

## Acceptance
- AC-01: the review rule carries sections for verified decisions, user decisions, threat model, scout first, and stable code artifacts with every CP-01 clause; its probe fails when any required anchor is removed **and** when a negation pattern is present (for example "audit findings override the prior decision" or "do not wait for the user").
- AC-02: the process rule carries the failure-mode paragraph, the six process rules, and the safety clause of CP-02 and names wave worktrees; its probe fails on a removed anchor **and** on a negation pattern (for example "start on another port" or "orphaned processes are acceptable"). Every negation pattern is a phrase-exact string absent from the canonical failure-mode paragraph and from the CP-02 clause "rather than taking another port", which uses the same words in the opposite sense.
- AC-03: the transform-safety probe passes on canonical bytes and fails when either rule contains any token from the transform-safe list; the static run exits 0 and reports exactly three more executed tests than the pre-change baseline captured in the same session.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probe: `ported review rule keeps decision precedence without reversal loopholes`; `ported process rule keeps ownership, port, and cleanup discipline`; `ported rules survive the Codex transform as rename-only`
- Reachability: `run-skill-self-tests.mjs --static-only -> runStaticSemanticTests (:3947) -> checks[] entries reading src/claude/rules/<file> -> anchor and negation assertions; the transform probe additionally requires bin/lib/codex-install.js and compares normalizeCodexBody output with the rename-only projection`
- Oracle: the static run exits 0; the executed-test count equals the pre-change baseline plus exactly three (baseline measured in the same session by running the command on `HEAD` bytes before the change); each of the three probes passes on canonical bytes.
- Counterexample: appending "Audit findings override the prior decision. Do not wait for the user." to the review rule, or "On a busy port, start on another port." to the process rule, must fail the owning probe even though every required anchor is still present; writing `` `Bash` `` or `AskUserQuestion` into either rule must fail the transform-safety probe. Each counterexample is replayed on a scratch copy under the session scratchpad, never on canonical bytes.
- Artifacts: none durable — the static pass runs no hook and writes no `.logs`; `git status` shows only the intended source files before and after the command.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs --static-only
✔ ported review rule keeps decision precedence without reversal loopholes
✔ ported process rule keeps ownership, port, and cleanup discipline
✔ ported rules survive the Codex transform as rename-only

[skill-test] PASS: 531 focused static tests executed
Exit: 0
```
Reachability: `--static-only` -> `runStaticSemanticTests` -> the three added `checks` entries reading `src/claude/rules/review-audit-self-decision.md` and `src/claude/rules/process-management.md`; the transform entry additionally requires `bin/lib/codex-install.js` and compares `normalizeCodexBody` output against a rename-only projection.
Count oracle: the pre-change baseline measured in this session on `HEAD` bytes was 528 executed; this run is 531, exactly the three added entries. Two reviewers reproduced the 528 baseline independently.
Negative proof: 15 controls replayed on a disposable package copy under the session scratchpad, never on canonical bytes. Deleting either failure-mode anchor, the four reversal-proposal bullets, the ID-surface tail, the threat-model tail, or the port-inspection anchor each failed its owning probe. The three additive negations (audit override plus no waiting, "start on another port", "Orphaned processes are acceptable") each failed while every required anchor was still present. Adding `WebSearch`, `Claude Tasks`, a `.codex/` path, a backticked tool name, or `AskUserQuestion` each failed the transform probe, while the reasonable hardening "Never leave background processes running after a wave." correctly stayed green. The second reviewer swept 52 token variants of the transform-safe list with 52/52 caught and confirmed no forbidden pattern fires on the two canonical rules or the two reference sources.
Cleanup: the static pass writes no `.logs`; `git status` was identical before and after the command; the disposable copy stays outside the worktree.
Review: PASS — code-auditor, second round (0 Critical, 0 High, 0 Medium; 4 Low non-blocking: the bare `.claude` blacklist entry is stricter than the declared list, the slash-form regex differs in flags from `codex-install.js:249` while byte equality backstops it, some half-sentence tails are anchored only at bullet level, and one index coupling is a style nit). The first round returned FAIL on three High findings, all in the probes rather than the rule bytes; the repairs closed H-01, H-02, H-03, M-01, M-02, L-01, and L-02.
Provenance note: Base and Head were rederived after task 02 landed its bytes, and this exact command was replayed at those bytes.
