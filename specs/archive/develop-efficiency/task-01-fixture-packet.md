# Task 01 — A fixture packet small enough to measure and real enough to execute

Status: done

## Outcome
`evals/develop/fixture/` holds a tiny repository state containing one `specs/<feature>/plan.md`, one `task-01-*.md`, one source file and one test, such that `cf:develop` has a real task to execute and the whole verification runs in under five seconds.

## Scope
- In: the fixture directory and its contents; one timing measurement of the fixture's verification command.
- Out: the case files and graders, which are task 02; any paid run; any change to `cf:develop`, `evals/run.sh` or the `cf:specs` cases.

## Coverage
- CP-01

## Ownership
- Create: `evals/develop/fixture/` with `package.json`, one source file, one test file, and `specs/doi-loi-chao/plan.md` plus `specs/doi-loi-chao/task-01-doi-loi-chao.md`. **Both names are pinned here**, because a grader that reads file contents resolves one exact path and cannot take a glob
- Read: `evals/specs/dung-o-c1/fixture/` for the established fixture shape, `packages/spec/src/claude/skills/specs/references/templates.md` for the task sections the resolver expects

## Steps
1. Copy the shape, not the content, of `evals/specs/dung-o-c1/fixture/`: the smallest package that a test runner accepts.
2. Write the fixture's own task so that its owned change is **one source file** and its Acceptance is one observable behaviour. Resist making it realistic; D-02 chose small deliberately, and a large fixture quadruples the price of every later run.
3. Give the fixture task a verification command that runs the single test file only, the way `evals/specs` tasks and `radar-insight` tasks do, never a whole suite.
4. Time that command by hand. Over five seconds means the fixture is too big; shrink it rather than accept the cost, because every run in task 03 pays it at least once and the broken case pays it twice.
5. Leave the fixture task's `## Receipt` as a bare placeholder that points at nothing. The `templates.md` it would normally cite lives under the `cf:specs` skill and is **not** copied into the temporary plugin, so a pointer to it sends every run chasing a file that is not there — paid turns spent on the very metric being measured.
6. Confirm the workflow resolver accepts the packet and reports exactly one `pending` task.

## Acceptance
- AC-01 as stated in `plan.md`.
- The fixture's task file carries the sections the resolver and the completion gate read: a single `Status:`, `Outcome`, `Scope`, `Ownership`, `Acceptance`, `Dependencies`, `Verification Plan` with an exact `Command`, and an empty `## Receipt` whose placeholder references no file outside the fixture.
- **No case file and no grader is written here.** They are task 02, and writing them early would hide which of the two is at fault when a run behaves oddly.

## Dependencies
- none

## Verification Plan
- Command: `node -e "const R=require('./packages/spec/src/claude/scripts/spec-resolver.cjs');const w=R.resolveWorkflowCandidate({projectRoot:'evals/develop/fixture',runtime:{}});const t=Object.entries(w.taskRegistry);if(t.length!==1||t[0][1].status!=='pending')throw new Error('expected one pending task, got '+JSON.stringify(t));console.log('resolver OK:',t[0][0],t[0][1].status)"`
- Named probe: the resolver's own packet recognition, which is what `cf:develop` uses to select a task
- Reachability: known — the same resolver call ran against three packets in this repository today
- Oracle: exit 0 printing `resolver OK:` with one task named and `pending`; and the fixture's own verification command, timed separately, completes in under five seconds
- Counterexample: a task file with two `Status:` fields, a missing `Verification Plan`, or a nested `tasks/` directory makes the resolver reject or misread the packet, and the command exits non-zero
- Artifacts: none; both commands print their evidence to stdout

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If the fixture cannot be made to verify in under five seconds, that is a finding about the floor cost of a develop run, not a licence to accept a slower fixture.

## Receipt

Verification: PASS
Command: node -e "const R=require('./packages/spec/src/claude/scripts/spec-resolver.cjs');const w=R.resolveWorkflowCandidate({projectRoot:'evals/develop/fixture',runtime:{}});const t=Object.entries(w.taskRegistry);if(t.length!==1||t[0][1].status!=='pending')throw new Error('expected one pending task, got '+JSON.stringify(t));console.log('resolver OK:',t[0][0],t[0][1].status)"
Exit: 0
Base: 17dcf7e60b527784c9d78cc2c9b231fa3a3193b6
Head: f1f796d07a6cec84b0a6441836667d3351cc2a754b99eeb83de884a9915386ab
```text
$ node -e "const R=require('./packages/spec/src/claude/scripts/spec-resolver.cjs');const w=R.resolveWorkflowCandidate({projectRoot:'evals/develop/fixture',runtime:{}});const t=Object.entries(w.taskRegistry);if(t.length!==1||t[0][1].status!=='pending')throw new Error('expected one pending task, got '+JSON.stringify(t));console.log('resolver OK:',t[0][0],t[0][1].status)"
resolver OK: task-01-doi-loi-chao.md pending
$ echo $?
0
```
No artifact is produced by this task: the fixture files are the deliverable and the command prints its evidence to stdout. The machine declaration form is deliberately not used, because `.claude/scripts/workflow-policy.cjs:327` would then require a `sha256` per declared path and none is produced here.

- The fixture is five files and 67 lines: `package.json`, `src/greet.js`, `test/greet.test.js`, `specs/doi-loi-chao/plan.md` and `specs/doi-loi-chao/task-01-doi-loi-chao.md`. Its task changes one source file and its verification runs one test file.
- Timing, the figure D-02 exists to protect: **233 to 712 ms**, far under the five-second ceiling. Every eval run in task 03 pays this at least once and the broken case pays it twice, so the margin is what keeps forty runs affordable.
- The fixture is solvable and fails before it is solved. Unmodified, the verification exits 1; with `src/greet.js` changed in a scratch copy, it exits 0. Both were run and the scratch copy was deleted.
- Review: fresh-context reviewer, one round, FAIL. Both High findings were real and were reproduced here before repair.
  - **The `package.json` test script was broken.** `"test": "node --test test/"`, copied from the shape of `evals/specs/dung-o-c1/fixture`, throws `MODULE_NOT_FOUND` on Node v24 because the argument is loaded as a module rather than walked as a directory. That fixture is only ever read, never executed, so the defect never surfaced there. Reproduced here: `npm test` exited 1 with a loader stack trace unrelated to the task. `.claude/rules/workflow.md` tells an implementer to run repo-level tests after the task command, so a run would have met a fake failure, possibly charged it to the repair-round count, and might have gone outside its Scope to fix `package.json`. Repaired by making the script the **same command** as the Verification Plan, which also closes the reviewer's Medium about two divergent test paths inside one tiny fixture.
  - **The target string was guessable rather than readable.** The fixture task said only "lời chào tiếng Việt" without pinning what the test asserts, so an answer that is right in spirit — `Xin chào Lan!` without the comma — would fail on string comparison. That would have cost the clean case a repair round for guessing rather than for process, and the clean case exists to be the zero-round baseline D-03 measures the broken case against. Repaired by adding `Read: test/greet.test.js` to the fixture task's Ownership and saying the exact string is the test's to define. That keeps the read-then-implement cycle the measurement wants, instead of deleting it by spelling the literal into the task.
- Two findings are recorded and deliberately not acted on, both by the reviewer's own framing: whether the fixture is *too easy* to expose the develop cycle cannot be settled without a paid run, which is D-02's break signal and task 03 step 2's job; and there is no expected tool-call floor to compare against yet, for the same reason.
- One controller error, disclosed because it touched this file: a first attempt at writing this Receipt joined a string character by character and corrupted the task file from `## Receipt` onward. The file was restored from `cc5c4a2` and the Receipt rewritten; the fixture itself was never touched by that mistake, and the resolver command above was re-run against the restored file.
- Base and Head were rebound **three times** while this packet ran — once when task 02 created the case directories, once when its graders were repaired, and once more at close. Each rebind followed a real re-run of the resolver command, because this task's proof is free. The pattern itself is the finding: in a packet whose tasks own files outside the specs root, **every later task invalidates every earlier receipt**, and the cost of obeying `references/quality-gate.md:80-82` is whatever the earlier proof costs to repeat. Here that was 0.3 seconds; in the previous packet the same rule pointed at an $11.77 measurement.
- The first rebind happened after task 02 created the two case directories, which live outside the specs root and therefore moved the runtime Head. Unlike a paid measurement, this task's proof is a free resolver call, so it was **re-run** rather than merely rebound — which is what `references/quality-gate.md:80-82` asks for and what a $11.77 measurement in the previous packet could not afford.
- **No efficiency claim is made here.** This task only builds the surface the measurement runs on.
