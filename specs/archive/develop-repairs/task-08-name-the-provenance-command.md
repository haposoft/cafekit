# Task 08 — The develop proof rules name the command that derives Base and Head

Status: done

## Outcome
`develop/references/quality-gate.md` tells an implementer exactly which command yields the Receipt's Base and Head, and the `evals/develop` workspace carries that script the way an installed project does, so an honest run can write a Receipt the gate accepts.

## Scope
- In: one instruction under the quality-gate completion list naming `node .claude/scripts/provenance.cjs` with its arguments and forbidding hand-typed or computed values; one probe clause set plus mutations; both scaffolds copy the script into `.claude/scripts/` before the commit; the task-06 checker asserts the script runs in a scaffolded workspace and returns a 40-hex Base and 64-hex Head.
- In, added 2026-09-23 by the user after a pilot: the same command on the existing Receipt line of `develop/SKILL.md` (line 142, no new line, so the four-file budget is unchanged). A kept trace showed the eval sandbox denies `find` and `Glob` into the plugin's `references/`, so a rule that lives only in `quality-gate.md` never reached the run; `SKILL.md` is always loaded.
- In, after review: the fixture carries the script as `fixture/claude-scripts/provenance.cjs` (`.gitignore` drops every `.claude`) and each scaffold moves it into `.claude/scripts/`; the checker runs scaffolds from an rsync'd copy exactly as `evals/run.sh` lays them out, and `cmp`s the fixture copy against its source.
- Out: `provenance.cjs` itself, the gate, every other skill, the case prompts and graders.

## Coverage
- CP-06

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md` (line 142 only), `packages/spec/src/claude/skills/develop/references/quality-gate.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `evals/develop/mot-task-sach/scaffold.sh`, `evals/develop/mot-task-hong/scaffold.sh`, `evals/develop/check-instrument.sh`
- Create: `evals/develop/fixture/claude-scripts/provenance.cjs`
- Read: `packages/spec/src/claude/scripts/provenance.cjs` (`parseArgs`, `runCli`), `.claude/scripts/provenance.cjs` (the installed copy is byte-identical)

## Steps
1. Under item 6 of the completion list in `quality-gate.md`, add: Base and Head come from the `Base` and `Head` fields printed by `node .claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file <task file> --feature-name <feature> --session <any label> --json`, run after the last change outside the specs root; never type, abbreviate, or compute them by hand.
2. Add `requireClauses("provenance-command", { quality: [...] })` pinning the command and the never-by-hand clause, and two mutations: one that drops the command, one that permits computing the values.
3. In both scaffolds, before `git init`, copy `provenance.cjs` from `packages/spec/src/claude/scripts/` into `.claude/scripts/` of the workspace.
4. Extend `check-instrument.sh`: in each scaffolded workspace run the Step-1 command against the fixture task and assert `ok: true`, a 40-hex `Base` equal to `git rev-parse HEAD`, and a 64-hex `Head`.

## Acceptance
- AC-10 as stated in `plan.md`.
- Each new mutation makes the suite fail with the `provenance-command` issue.
- The command in `quality-gate.md` runs verbatim, with only its placeholders filled, in a scaffolded workspace.

## Dependencies
- task-06-instrument-has-real-git.md

## Verification Plan
- Command: `bash evals/develop/check-instrument.sh && cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Oracle: every checker line prints `ok`; the suite prints `[skill-test] PASS` with more tests than the 1379 before this task
- Counterexample: removing the command from `quality-gate.md` makes the suite fail on `provenance-command`; a scaffold without the copy makes the checker fail
- Reachability: known — `develop/SKILL.md` §3 says "Load `references/quality-gate.md`" before the Receipt is written, and the probe suite already binds `quality-gate.md` to the develop contract through `DEVELOP_PLAN_NATIVE_PATHS`

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/develop/check-instrument.sh && cd packages/spec && node scripts/run-skill-self-tests.mjs
Exit: 0
Base: 46a4ed1d51f2f293dabd51ec74bdbb4dcc294bc6
Head: 89673dae9b87e77a1a3b13365dbc49d9c96f3bee5a52b07b7ff499fb2cb696a6
```text
$ bash evals/develop/check-instrument.sh && cd packages/spec && node scripts/run-skill-self-tests.mjs
ok: fixture provenance.cjs matches its source
ok: mot-task-sach: scaffold runs in the harness layout
ok: mot-task-sach: workspace HEAD is a commit
ok: mot-task-sach: exactly one commit
ok: mot-task-sach: tree clean
ok: mot-task-sach: provenance command returns Base = HEAD and a 64-hex Head
ok: mot-task-hong: scaffold runs in the harness layout
ok: mot-task-hong: workspace HEAD is a commit
ok: mot-task-hong: exactly one commit
ok: mot-task-hong: tree clean
ok: mot-task-hong: provenance command returns Base = HEAD and a 64-hex Head
ok: mot-task-hong: injected fault is committed
ok: receipt-day-du graders identical
ok: grader accepts real 40-hex Base
ok: grader rejects Base: UNAVAILABLE
ok: grader rejects 64-hex Base (a file sha256)
[skill-test] static semantic checks
[skill-test] skill catalog checks
[skill-test] installer migration fixtures
[skill-test] instruction install fixtures
[skill-test] spec artifact validator fixtures
[skill-test] reconstruct docs validator fixtures
[skill-test] package Node tests
[skill-test] hook behavioral tests
[skill-test] chrome-devtools script tests
[skill-test] pdf bounding-box tests
[skill-test] retired completion-policy sentence is gone from the payload
[skill-test] source tree stays free of hook state
[skill-test] PASS: 1382 tests executed
EXIT:0
```
Re-run at the final-Head fixed point on 2026-09-23, after tasks 06, 08 and 05 changed files outside `specs/`: sixteen `ok` lines and 1382 tests.
The fenced block keeps the checker's sixteen `ok` lines and the suite's section and summary lines; the suite rose from 1379 to 1382 tests (three new `provenance-command` mutations). The pre-change run was not made: the suite passes before any edit by construction, and the Oracle's test-count criterion (more than 1379) is what distinguished before from after.

Counterexamples observed: restoring the old `$HERE/../../../` copy in a scratchpad copy gave `FAIL: mot-task-sach: scaffold failed in the harness layout`; deleting the move line gave `FAIL: mot-task-sach: provenance command failed in the workspace`; each exited 1.

Runtime: two one-run pilots through the real `evals/run.sh` with `--keep-temp` (`thu-git-sonnet-2`, `thu-git-sonnet-3`, sonnet, `mot-task-sach`). With the command only in `quality-gate.md`, the run's `find` and `Glob` into the plugin's `references/` were denied and it wrote `Head: uncommitted change…` (receipt grader failed). With the command also on `SKILL.md:142`, the run executed it, wrote a 40-hex Base and 64-hex Head, `Status: done`, and passed all eight graders. One run each; not a rate.

Review: code-auditor FAIL (scaffold path broke under the `run.sh` layout; checker did not mirror it), fixed, then PASS with two Low: the skill's "never typed" clause has no mutation of its own, and `--specs-root specs` is hard-coded.
