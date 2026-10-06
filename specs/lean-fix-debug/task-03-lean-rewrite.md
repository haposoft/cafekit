# Task 03 — fix and debug read as goal, constraints and output standards

Status: done

## Outcome
`packages/spec/src/claude/skills/fix/SKILL.md` and `packages/spec/src/claude/skills/debug/SKILL.md` are each at most 170 lines, written as goal, constraints and output standards (plan D-01); every gate block survives; fix's root-cause contract is one line naming the contract's fields (Expected and Actual may be one field) with a pointer to its own `references/diagnosis-protocol.md:87-100` copy; every rule in the rule map below survives as a standard line; fix's references point to sections by name instead of step numbers; the self-tests and node tests pin the new text and pass.

## Scope
- In: the two `SKILL.md` files; step-number pointer lines in `fix/references/diagnosis-protocol.md:23`, `:89`, `prevention-gate.md:3`, `review-cycle.md:17`, `parallel-patterns.md:41`, `:101`; the test files that pin removed wording.
- Out: frontmatter wording (byte-identical), reference bodies (except the causal-field pins moving to `diagnosis-protocol.md`, which already holds them), `.claude/references/debugger/*`, `agents/debugger.md`, `cf:scout`, any eval file.

## Coverage
- CP-01

## Rule map
Every rule below lives today only inside a `## Step` section or the mermaid flow; the rewrite keeps each as a standard line containing the pinned phrase (Step 5 adds one self-test pin per row that has none).

| Rule | Source (`659b705`) | Kept phrase |
|---|---|---|
| scout depth per path (quick vs standard vs parallel) | fix `:145-149` | "scout depth follows the depth" (new phrase) |
| capture the pre-fix state as the before/after baseline | fix `:163` | "pre-fix state" |
| 2–3 competing hypotheses with confirm/refute evidence | fix `:165`, debug `:108-118` | fix "confirm/refute", debug "Confirm if" |
| escalate after 2 refuted hypotheses (`references/escalation-tactics.md`; inversion in debug) | fix `:168`, debug `:121` | fix "2+ hypotheses fail", debug "inversion" |
| a report missing contract fields routes back to diagnosis, not implementation | fix `:189-193` | "routes back to diagnosis" |
| fix the root cause, minimal change, existing patterns, one logical change per commit boundary | fix `:216-218` | "Fix the root cause, not the symptom" |
| workflow per depth: Quick, Standard (red then fix then same test green), Incident/deep (research only unresolved facts, `cf:brainstorm` for 2–3 remedies, staged plan), Parallel | fix `:220-231` | each existing pinned sentence verbatim |
| iron-law verification: rerun the exact pre-fix commands, fresh output only | fix `:239` | "Iron-law verification" |
| full check typecheck + lint + build + test | fix `:241` | "typecheck + lint + build + test" |
| prevention guard at Standard+ (`references/prevention-gate.md`) | fix `:242` | "Prevention guard" |
| side-effect sweep of the blast radius | fix `:243` | "sweep the full blast radius" (the pins on "Step 5 side-effect sweep" repoint per Step 5(b)) |
| review through `cf:code-review` (`references/review-cycle.md`) | fix `:244` | "trigger `cf:code-review`" |
| report fields and docs update | fix `:263-264` | Output Format fields |
| say so when `cf:scout` is unavailable; "Invoke the `scout` skill" | debug `:72-75` | "Invoke the `scout` skill" |
| evidence to capture incl. environment and intermittency; timeline normalisation | debug `:81-89` | "Capture" list as one standard line |
| doc routing for `--frontend`, `--ci`, `--perf` | debug `:91-93` | the three reference paths |
| compare with known-good patterns | debug `:99-104` | "known-good" |
| one variable at a time, never batch changes, prefer read-only evidence, flaky async → `condition-based-waiting.md`, elimination path | debug `:119-123` | "flaky async tests" plus each phrase |
| correlation is not causation; earliest owned invariant; `root-cause-tracing.md` | debug `:147` | "Do not collapse correlation into causation" |
| verification plan six items; recurrence candidates | debug `:153-161` | "Verification plan must include" |

## Ownership
- Modify: `packages/spec/src/claude/skills/fix/SKILL.md`, `packages/spec/src/claude/skills/debug/SKILL.md`, `packages/spec/src/claude/skills/fix/references/{diagnosis-protocol,prevention-gate,review-cycle,parallel-patterns}.md` (pointer lines only), `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js`
- Read: `specs/lean-fix-debug/plan.md` D-01, `packages/spec/src/claude/agents/debugger.md`, `packages/spec/bin/lib/codex-install.js`

## Steps
1. Before editing, save the gate blocks of `git show 659b705:<file>` (every `<…GATE…>`…`</…>` block of both files, plus fix's `## Delegation Gate` section) under `$CLAUDE_JOB_DIR/tmp/lean-gates-before/`, one file per block.
2. Rewrite debug: keep frontmatter, Arguments, Proportional depth, the three gate blocks (only the edits D-01 allows), the root-cause contract, the confidence rule, the report shape opening `## Debug Report` with its sections and the depth rule for which sections appear, Relationship To Fix, References, and every rule-map row. Remove the six `## Step` headings, "never the six steps", and numbered how-to lists; what each step demanded as output becomes one standard line (e.g. "test competing hypotheses one variable at a time; cite the observation that decided each").
3. Rewrite fix: keep frontmatter, Arguments, its Proportional depth lines, the bounded repair frame, Delegation Gate, the four gate blocks (only the edits D-01 allows), the `--from-debug` validation list, the verdict vocabulary and remediation rule, the 3-attempt rule, never weaken a test, ask before committing, Output Format rewritten as report fields (plan D-01), Specialized Paths (its "replace the six-step flow" sentence `:288` reworded without step counts), References, and every rule-map row. Replace the root-cause contract with one line naming the contract's fields (Expected and Actual may be one field) plus a pointer to `references/diagnosis-protocol.md`; fix the dangling "contract in Step 2" (`HARD-GATE`, `:63`) and "contract above" (`--from-debug`, `:184`) to name that pointer, and every other step reference (`:76` "before Step 2", `:90` "until Step 5 proves", `:231` "Steps 1-5", `:253` "loop back to Step 2", `:286` "after Step 1 scout") to the section it names. Remove the mermaid flow, the `## Step N` headings, the `✓ Step` lines, and "via `cf:debug`/`cf:scout`" as a required step (one line: either may help; neither is required).
4. Repoint the six reference lines to section names.
5. Run the full self-test (it also runs the node suite, `packages/spec/scripts/run-skill-self-tests.mjs:7018-7031`); classify each failure: (a) a pin on removed scaffolding (`✓ Step`, `## Step N`, mermaid, "never the six steps" `:3308`, the six scout bullets) → repoint to the surviving standard; (b) a pin whose sentence names a step number ("Step 4" `:3541`, `:3612`; "Step 5 side-effect sweep" `:3493`, `:3596`, `:4995`; "Research begins only after Step 2 diagnosis" `:3527`, `:3602`, `codex-native.test.js:2846`, `:2957`, `package-inventory.test.js:2604`, `:2654`) → replace the step number with the section name in both the pin and the text, rule unchanged; (c) the causal-field pins (`:3445-3449`, mutation `:3575`) → point them at `fix/references/diagnosis-protocol.md`, which already holds the fields; (d) any other pin on a gate, contract or rule-map row → the rewrite lost it, restore the text. Add a pin for each rule-map row that has none. Never delete a pin without a replacement that checks the same rule.
6. `diff` each saved gate block from Step 1 against the same block in the new file; every changed line must be one of D-01's allowed edits (step number → section name, scout checklist → one sentence naming the same items); report the diffs in the Receipt.
7. Run the Command.

## Acceptance
- AC-03: both files ≤170 lines; no `Step N` reference left; every rule-map row's kept phrase present; no "```mermaid", `## Step`, or `✓ Step` in either; the gate tags `DIAGNOSTIC-ONLY-GATE`, `HARD-GATE-SCOUT-FIRST`, `ROOT-CAUSE-GATE` (debug) and `HARD-GATE`, `HARD-GATE-SCOUT-FIRST`, `HARD-GATE-RED-BEFORE-FIX`, `HARD-GATE-NO-SIDE-EFFECTS` (fix) each present once; the gate diffs of Step 6 contain only D-01's allowed edits; frontmatter byte-identical to `659b705`; self-test and node suites pass with zero failures.

## Dependencies
- task-02-measure-current.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-fix-debug/task-02-measure-current.md && S=packages/spec/src/claude/skills && for f in $S/fix/SKILL.md $S/debug/SKILL.md; do l=$(wc -l < $f); [ "$l" -le 170 ] || { echo "too long: $f $l"; exit 1; }; ! grep -nE '```mermaid|^#+ Step|✓ Step|\bSteps? [0-9]' $f || { echo "scaffold left: $f"; exit 1; }; diff <(git show 659b705:$f | awk '/^---$/{c++} c<2' ) <(awk '/^---$/{c++} c<2' $f) || { echo "frontmatter changed: $f"; exit 1; }; echo "$f lines=$l"; done && for t in DIAGNOSTIC-ONLY-GATE HARD-GATE-SCOUT-FIRST ROOT-CAUSE-GATE; do [ "$(grep -c "^<$t>" $S/debug/SKILL.md)" = 1 ] || { echo "gate: $t"; exit 1; }; done && for t in HARD-GATE HARD-GATE-SCOUT-FIRST HARD-GATE-RED-BEFORE-FIX HARD-GATE-NO-SIDE-EFFECTS; do [ "$(grep -c "^<$t>" $S/fix/SKILL.md)" = 1 ] || { echo "gate: $t"; exit 1; }; done && for p in 'scout depth follows the depth' 'pre-fix state' 'confirm/refute' '2+ hypotheses fail' 'routes back to diagnosis' 'Fix the root cause, not the symptom' 'Iron-law verification' 'typecheck + lint + build + test' 'Prevention guard' 'sweep the full blast radius' 'trigger `cf:code-review`'; do grep -qF -- "$p" $S/fix/SKILL.md || { echo "rule lost (fix): $p"; exit 1; }; done && for p in 'Invoke the `scout` skill' 'known-good' 'inversion' 'flaky async tests' 'Do not collapse correlation into causation' 'Verification plan must include' 'Confirm if'; do grep -qF -- "$p" $S/debug/SKILL.md || { echo "rule lost (debug): $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
- Named probe: the line-count, scaffold and frontmatter checks; the four gate-tag counts; `run-skill-self-tests.mjs` (`[skill-test] PASS`, which includes the node suite); `codex-native.test.js` covers the installed Codex projection of both skills.
- Reachability: the installer copies `packages/spec/src/claude/skills/{fix,debug}` (`migration-manifest.json` `skills.required`), and `evals/run.sh` copies the same directories for task 04.
- Oracle: two `lines=` lines ≤170, `[skill-test] PASS: <n> tests executed`, exit 0.
- Counterexample: a rewrite that drops a gate tag, keeps a `✓ Step`, changes frontmatter, loses a rule-map phrase, or breaks a pinned contract makes the Command exit 1.
- Artifacts: the edited source files (tracked); the saved gate blocks are ephemeral under `$CLAUDE_JOB_DIR/tmp`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Blocker (2026-10-05)
- Environment, not this task's change: macOS refuses hard links (`ln`, `EPERM: operation not permitted`) to 554 of the tracked files under `packages/spec/src`, also with the shell sandbox disabled. `codex-native.test.js` "Codex installed Specs and spec-maker reject adaptive coverage mutations" hard-links installed files, so it fails with `EPERM … link …/agents/spec-maker.md`; the same test fails identically on the base bytes (task changes stashed, test run, changes restored byte-identical). The full self-test earlier the same day passed, so the refusal began during the day.
- Current run on the lean files: every skill-test content check passes (fix 46 and debug 9 + 20 + 7 mutation checks among them); `package Node tests: tests=526 pass=524 fail=1` — the one failure is that test.
- One environment probe touched a file outside ownership: `packages/spec/src/claude/skills/specs/references/templates.md` was recreated with identical bytes (sha256 prefix `b8a5e986f897ccdf` before and after, `git status` clean), which let that one file link; the remaining 554 were left as they are.
- User decision: record as a limitation, do not repair the environment. The task stays `in_progress`; no Receipt until the full suite passes; task 04 waits.
- Resolved (2026-10-05, user decision "đồng ý cách 2"): the 554 refusing files were recreated in place with `cp -p` + `mv` — sha256 and mode equal for every file (0 mismatches), `git status --short` byte-identical before and after, 0 files still refusing a hard link. The Verification Command then exited 0 with `[skill-test] PASS: 1595 tests executed`.

## Review decisions
- M-2 (contract shape): user decision "chọn phương án 1" (2026-10-05) — keep the field line plus the Trigger and Contributing factors definitions on `fix/SKILL.md`; accepted deviation from D-01's one-line wording.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-fix-debug/task-02-measure-current.md && S=packages/spec/src/claude/skills && for f in $S/fix/SKILL.md $S/debug/SKILL.md; do l=$(wc -l < $f); [ "$l" -le 170 ] || { echo "too long: $f $l"; exit 1; }; ! grep -nE '```mermaid|^#+ Step|✓ Step|\bSteps? [0-9]' $f || { echo "scaffold left: $f"; exit 1; }; diff <(git show 659b705:$f | awk '/^---$/{c++} c<2' ) <(awk '/^---$/{c++} c<2' $f) || { echo "frontmatter changed: $f"; exit 1; }; echo "$f lines=$l"; done && for t in DIAGNOSTIC-ONLY-GATE HARD-GATE-SCOUT-FIRST ROOT-CAUSE-GATE; do [ "$(grep -c "^<$t>" $S/debug/SKILL.md)" = 1 ] || { echo "gate: $t"; exit 1; }; done && for t in HARD-GATE HARD-GATE-SCOUT-FIRST HARD-GATE-RED-BEFORE-FIX HARD-GATE-NO-SIDE-EFFECTS; do [ "$(grep -c "^<$t>" $S/fix/SKILL.md)" = 1 ] || { echo "gate: $t"; exit 1; }; done && for p in 'scout depth follows the depth' 'pre-fix state' 'confirm/refute' '2+ hypotheses fail' 'routes back to diagnosis' 'Fix the root cause, not the symptom' 'Iron-law verification' 'typecheck + lint + build + test' 'Prevention guard' 'sweep the full blast radius' 'trigger `cf:code-review`'; do grep -qF -- "$p" $S/fix/SKILL.md || { echo "rule lost (fix): $p"; exit 1; }; done && for p in 'Invoke the `scout` skill' 'known-good' 'inversion' 'flaky async tests' 'Do not collapse correlation into causation' 'Verification plan must include' 'Confirm if'; do grep -qF -- "$p" $S/debug/SKILL.md || { echo "rule lost (debug): $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: ee3ee40378c228a637f39323adaf8b70adbff08ab3df03a068bf6a669276e072
```text
packages/spec/src/claude/skills/fix/SKILL.md lines=     153
packages/spec/src/claude/skills/debug/SKILL.md lines=     165
[skill-test] PASS: 1595 tests executed
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status (the full self-test includes the package node suite: tests=526, fail=0).
- Negative proof: before any edit the Command exited 1 (`too long: packages/spec/src/claude/skills/fix/SKILL.md 299`). On disposable copies, removing a pinned rule (Track progress, Ask before committing, Normalize timezones, earliest owned invariant) turns the rule-map checks false; the intact files stay true.
- Lines: fix 299 → 153, debug 240 → 165. Frontmatter byte-identical to `659b705`. Gate diffs against `659b705` (Step 6), every changed line one of D-01's allowed edits; `DIAGNOSTIC-ONLY-GATE`, `ROOT-CAUSE-GATE` and fix's `## Delegation Gate` are byte-identical:
```text
  == fix HARD-GATE
  < Do not propose or implement a fix before Steps 1-2 (scout + diagnosis) complete.
  > Do not propose or implement a fix before scout and diagnosis complete.
  < The exact root-cause contract in Step 2 is mandatory; answer each field in one concrete sentence.
  > The exact root-cause contract under Diagnosis is mandatory; answer each field in one concrete sentence.
  == fix HARD-GATE-SCOUT-FIRST
  < Collect these scout outputs first:
  < 1. Project type, language(s), framework(s), and package/test runner from repo files.
  < 2. Exact file(s) where the symptom surfaces and their direct callers/dependents.
  < 3. Related tests covering the affected area.
  < 4. Recent commits touching affected files: `git log --oneline -10 -- <affected-files>`.
  < 5. Existing patterns/conventions for this kind of fix.
  < Then state a concise 3-6 bullet codebase-context summary before Step 2.
  > Collect these scout outputs first: the project type, language(s), framework(s), and package/test runner from repo files; the exact file(s) where the symptom surfaces and their direct callers/dependents; related tests covering the affected area; recent commits touching affected files (`git log --oneline -10 -- <affected-files>`); and existing patterns/conventions for this kind of fix.
  > Then state a concise 3-6 bullet codebase-context summary before diagnosis.
  == fix HARD-GATE-RED-BEFORE-FIX
  < Before the first change to any non-test file (an edit, a file write, or a shell command that rewrites it), run a test that fails on the unchanged code for the diagnosed reason, and keep its exact command and failing output for Step 5.
  > Before the first change to any non-test file (an edit, a file write, or a shell command that rewrites it), run a test that fails on the unchanged code for the diagnosed reason, and keep its exact command and failing output for verification.
  == fix HARD-GATE-NO-SIDE-EFFECTS
  < The fix is not done until Step 5 proves:
  > The fix is not done until verification proves:
  == debug DIAGNOSTIC-ONLY-GATE
  == debug HARD-GATE-SCOUT-FIRST
  < You must identify:
  < - project type, language, framework, runtime, and test runner
  < - affected files/modules and exact symptom location
  < - direct callers, dependents, and data/config boundaries
  < - related tests and reproduction commands
  < - recent commits touching affected paths
  < - adjacent known-good implementation patterns
  < 
  > You must identify the project type, language, framework, runtime, and test runner; the affected files/modules and exact symptom location; direct callers, dependents, and data/config boundaries; related tests and reproduction commands; recent commits touching affected paths; and adjacent known-good implementation patterns.
  == debug ROOT-CAUSE-GATE
  == fix Delegation Gate
```
- Test changes: step-number pins repointed to section names (rule unchanged), "never the six steps" pin repointed, debug line ceiling 245 → 170, two new rule-map checks pinning every rule-map row plus the review's 15 additional phrases.
- Environment: the hard-link refusal recorded under Blocker was resolved by the user's decision (554 files recreated with identical bytes, `git status` unchanged).
- Review: code-auditor FAIL (H-1 missing rule pins, M-1 a dropped "Track progress" rule, M-2 contract shape) → repair round 1 (H-1 first reported but not on disk; caught by the reviewer and then applied) → PASS_WITH_WARNINGS (M-2) → user accepted M-2 ("chọn phương án 1") → PASS. L-1/L-2 accepted as Low.
