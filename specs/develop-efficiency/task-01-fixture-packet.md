# Task 01 — A fixture packet small enough to measure and real enough to execute

Status: pending

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
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
