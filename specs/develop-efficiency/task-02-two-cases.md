# Task 02 — Two cases: the clean run and the one-repair run

Status: pending

## Outcome
`evals/develop/mot-task-sach/` and `evals/develop/mot-task-hong/` each hold a `case.yaml`, a `scaffold.sh` copying the fixture, and graders that separate a correct run from a fast one, so that `evals/run.sh develop --validate` loads both with exit 0.

## Scope
- In: the two case directories, their scaffolds and their graders; the planted defect in the broken case; one hand-run of each fixture state to confirm the verification behaves as the case claims.
- Out: any paid run, which is task 03; the fixture itself, which task 01 owns; any change to the harness or the skill.

## Coverage
- CP-02

## Ownership
- Create: `evals/develop/mot-task-sach/case.yaml`, `scaffold.sh`, `graders/`
- Create: `evals/develop/mot-task-hong/case.yaml`, `scaffold.sh`, `graders/`
- **Own the planted defect**: it lives in `mot-task-hong/scaffold.sh`, which copies `../fixture/.` and then applies one modification in place, exactly as `evals/specs/sau-keep/scaffold.sh:5` copies another case's fixture. No second fixture directory is created and `../fixture/` is never edited, so the two cases cannot drift apart
- Read: `evals/specs/sau-keep/` and `evals/specs/mo-ho-du-cua/` for the case and grader shape, `evals/run.sh:45-62` for how the temporary plugin is assembled

## Steps
1. Write the clean case first. Its prompt invokes `cf:develop` on the fixture packet and nothing else; `allowed_tools` grants `Read, Glob, Grep, Skill, Write, Edit, Bash` because the user chose a full grant at GATE-SCOPE. Set `name: mot-task-sach` to match the directory, because `--case` filters on the `name` field and a mismatch reports no such case **after** `run.sh` has already created the `--out` directory that it then refuses to reuse.
2. **Set `max_turns` and `timeout_seconds` explicitly in both cases.** The harness defaults to 10 turns and 300 seconds, every existing case overrides it by hand, and one real develop execution took 85 tool calls over 24 minutes. Start from `sau-keep`'s 30/1200, confirm with the pilot run in task 03, and treat a run that ends at the ceiling as censored rather than as a measurement.
3. Write the correctness graders before the efficiency question is touched at all: the task ends at `Status: done`, its `## Receipt` carries `Verification: PASS`, `Exit: 0`, a non-empty fenced block **and both a `Base:` and a `Head:` line**, and the fixture's test actually passes at the end of the run. Whether the eval workspace can even produce a runtime Base and Head is `[UNVERIFIED]`: the fixture pattern being copied has no `.git`, and the first paid run of task 03 is the cheap probe that settles it. If it cannot, a run either burns turns on an impossible close or fabricates the pair, and the grader must catch the second. D-04 exists because a fast run that skipped the work must be counted as a failure, not as a cheap success.
4. Copy the clean case into the broken one and plant exactly one defect in its fixture copy — a defect the failure message names directly, so the extra rounds measure the repair cycle rather than a puzzle.
5. Add to BOTH cases one `tool_used` grader with `min: 0` counting `Bash` calls matching the fixture's verification command, plus one `min: 0` counter per tool for Read, Edit and Write. The clean case needs the counter too: without it the broken case's round count has no baseline to be measured against. The verification count minus one is the number of repair rounds, which is the number the 30-minute budget turns on, and the per-tool split is what tells a later packet whether the budget goes to reading, editing or running.
6. Run `evals/run.sh develop --validate` and compare the observed output with the Oracle.

## Acceptance
- AC-02 and AC-03 as stated in `plan.md`.
- The two cases differ **only** in the planted defect; the counters and correctness graders are identical in both, because that is what makes their costs comparable.
- The clean fixture passes its verification by hand before any run, and the broken one fails it by hand exactly once, both recorded in the Receipt.
- **No efficiency claim is made here.** Task 03 measures; this task only makes the measurement possible.

## Dependencies
- task-01-fixture-packet.md

## Verification Plan
- Command: `evals/run.sh develop --validate --allow-tools Write Edit Bash`
- Named probe: the harness's own case loader, which rejects a malformed `case.yaml` or a grader it cannot parse
- Reachability: known — the same `--validate` path ran against the seven `cf:specs` cases today with exit 0
- Oracle: exit 0, both case names listed, no `✗` line; and by hand, the clean fixture's verification exits 0 while the broken fixture's exits non-zero with a message naming the planted defect
- Counterexample: a grader whose regex never matches, or a case whose `allowed_tools` omits `Bash`, loads without error but cannot measure anything; the hand-run of both fixtures is what catches that
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If the planted defect turns out to be repairable in more than one way, replace it with a narrower one rather than accepting a case whose rounds vary by luck.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
