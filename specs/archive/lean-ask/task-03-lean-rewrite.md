# Task 03 — ask reads as goal, constraints and output standards

Status: done

## Outcome
`packages/spec/src/claude/skills/ask/SKILL.md` is at most 110 lines: no `## Workflow`, no `### N.` step heading, no `## Examples`; frontmatter and `ANSWER-ONLY-GATE` byte-identical to `c73030c`; every rule in the rule map below survives as a standard line; the self-test pins the rule map and passes.

## Scope
- In: `ask/SKILL.md`; the ask entry of `packages/spec/scripts/run-skill-self-tests.mjs`.
- Out: frontmatter, `templates/question.md`, any other skill or test file.

## Coverage
- CP-01

## Rule map
Each phrase exists today inside the Workflow; the rewrite keeps it verbatim on a standard line.

| Rule | Kept phrase |
|---|---|
| evidence order | "Repo evidence priority", "git history only when the question asks about changes or provenance" |
| when to use the web | "repo evidence is absent, stale, or not authoritative" |
| focused search, scout for location | "Use focused search", "instead of broad scans", "Use `cf:scout` when the user asks where something lives" |
| external evidence | "Prefer official docs", "State clearly when an answer is inferred" |
| when to answer | "Answer directly when at least one of these is true", "repo evidence answers the question", "answers the non-project part", "a cautious answer can separate known facts from inference" |
| when to ask back | "the target system/module is not named", "multiple targets are plausible", "the needed file/source is blocked or private", "business/domain judgment", "guessing customer intent", "bundles multiple unrelated topics" |
| how to ask back | "Ask only one follow-up question", "Include 2-3 concrete options", "If `unclear`, ask one focused follow-up" |
| saving the answer | "Use `templates/question.md`" |

## Ownership
- Modify: `packages/spec/src/claude/skills/ask/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `specs/lean-ask/plan.md` D-01

## Steps
1. Rewrite: keep frontmatter, title and intro, Core Stance, `ANSWER-ONLY-GATE`, When To Use, Modes, Answer Style; replace `## Workflow` with `## Standards` holding every rule-map phrase (the seven answer types may become one clause; the evidence-priority list may become one sentence naming the same sources in the same order), followed by `## Output Contract` (the old `### 4. Output Contract` heading renamed, its block unchanged); lists of conditions may become one sentence each; remove `## Examples`. Join hard-wrapped prose lines outside the gate (words unchanged).
2. Self-test: add every rule-map phrase to the ask entry (`run-skill-self-tests.mjs:4556-4575`) and a check that the file has no `## Workflow`, `### [0-9]` heading or `## Examples`; keep every existing pin. On a disposable copy, removing one rule-map phrase must fail the entry.
3. Run the Command.

## Acceptance
- AC-03: ≤110 lines; no `## Workflow`, `### N.` or `## Examples`; frontmatter and gate byte-identical to `c73030c`; every rule-map phrase present; `[skill-test] PASS`.

## Dependencies
- task-02-measure-current.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-ask/task-02-measure-current.md && f=packages/spec/src/claude/skills/ask/SKILL.md && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 110 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! grep -nE '^## Workflow|^### [0-9]|^## Examples' $f && diff <(git show c73030c:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show c73030c:$f | awk '/^<ANSWER-ONLY-GATE>$/,/^<\/ANSWER-ONLY-GATE>$/') <(awk '/^<ANSWER-ONLY-GATE>$/,/^<\/ANSWER-ONLY-GATE>$/' $f) && for p in 'Repo evidence priority' 'git history only when the question asks about changes or provenance' 'Use focused search' 'Use `cf:scout` when the user asks where something lives' 'Prefer official docs' 'State clearly when an answer is inferred' 'Answer directly when at least one of these is true' 'the target system/module is not named' 'the needed file/source is blocked or private' 'business/domain judgment' 'guessing customer intent' 'bundles multiple unrelated topics' 'Ask only one follow-up question' 'Include 2-3 concrete options' 'If `unclear`, ask one focused follow-up' 'repo evidence is absent, stale, or not authoritative' 'instead of broad scans' 'repo evidence answers the question' 'answers the non-project part' 'a cautious answer can separate known facts from inference' 'multiple targets are plausible' 'Use `templates/question.md`'; do grep -qF -- "$p" $f || { echo "rule lost: $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
- Named probe: line count, scaffold, frontmatter and gate diffs, rule-map phrases; `run-skill-self-tests.mjs` (`[skill-test] PASS`, which includes the node suite).
- Reachability: the installer copies `skills/ask` (`migration-manifest.json` `skills.required`); `evals/run.sh` copies it for task 04.
- Oracle: `lines=<n>` ≤110, `[skill-test] PASS: <n> tests executed`, exit 0.
- Counterexample: a rewrite that keeps a step heading or Examples, changes frontmatter or the gate, or drops a rule-map phrase makes the Command exit 1.
- Artifacts: the edited source files (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-ask/task-02-measure-current.md && f=packages/spec/src/claude/skills/ask/SKILL.md && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 110 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && ! grep -nE '^## Workflow|^### [0-9]|^## Examples' $f && diff <(git show c73030c:$f | awk '/^---$/{c++} c<2') <(awk '/^---$/{c++} c<2' $f) && diff <(git show c73030c:$f | awk '/^<ANSWER-ONLY-GATE>$/,/^<\/ANSWER-ONLY-GATE>$/') <(awk '/^<ANSWER-ONLY-GATE>$/,/^<\/ANSWER-ONLY-GATE>$/' $f) && for p in 'Repo evidence priority' 'git history only when the question asks about changes or provenance' 'Use focused search' 'Use `cf:scout` when the user asks where something lives' 'Prefer official docs' 'State clearly when an answer is inferred' 'Answer directly when at least one of these is true' 'the target system/module is not named' 'the needed file/source is blocked or private' 'business/domain judgment' 'guessing customer intent' 'bundles multiple unrelated topics' 'Ask only one follow-up question' 'Include 2-3 concrete options' 'If `unclear`, ask one focused follow-up' 'repo evidence is absent, stale, or not authoritative' 'instead of broad scans' 'repo evidence answers the question' 'answers the non-project part' 'a cautious answer can separate known facts from inference' 'multiple targets are plausible' 'Use `templates/question.md`'; do grep -qF -- "$p" $f || { echo "rule lost: $p"; exit 1; }; done && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
Exit: 0
Base: 5f5d745cad94c751727c5cd14247a428d48a125e
Head: 71b5ba48d6ac38dacb7c294cfa9d2fa3769fbe1f20ae724495306747b3bd87a5
```text
lines=102
[skill-test] PASS: 1603 tests executed
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status (the full self-test includes the package node suite).
- Negative proof: before any edit the Command exited 1 (`too long: 171`). On a disposable copy of the new file, removing "multiple targets are plausible", " instead of broad scans" or the `unclear` line, or appending `## Examples` or `### 1. Classify`, each turns the ask self-test assert false; the intact file stays true.
- Lines 171 → 102. Lines 1–29 (frontmatter, title, intro, Core Stance, `ANSWER-ONLY-GATE`) byte-identical to `c73030c`; the Output Contract block byte-identical under `## Output Contract`; When To Use, Modes and Answer Style unchanged in words. Dropped per D-01: the seven-type list, the step headings and `## Examples`.
- Self-test: the 16 previous ask pins kept; 22 rule-map phrases and a no-`## Workflow`/`### N.`/`## Examples` check added.
- Review: code-auditor PASS (no rule lost outside D-01's list; Codex projection clean; two notes outside scope: the bare `unclear` label now leans on its bold lead-in, and the Codex copy's `AGENTS.md` repeat predates this task).
