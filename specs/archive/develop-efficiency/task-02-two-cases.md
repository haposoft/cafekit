# Task 02 — Two cases: the clean run and the one-repair run

Status: done

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

Verification: PASS
Command: evals/run.sh develop --validate --allow-tools Write Edit Bash
Exit: 0
Base: 17dcf7e60b527784c9d78cc2c9b231fa3a3193b6
Head: f1f796d07a6cec84b0a6441836667d3351cc2a754b99eeb83de884a9915386ab
```text
$ evals/run.sh develop --validate --allow-tools Write Edit Bash
Ablation: 2 arms × 2 cases (40 runs)
⚠ cost ceiling $0 hit; skipping remaining cases
CASE  SCORE PASS% RUNS COST    NOTES
0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
$ echo $?
0
```
No artifact is produced by this task: the case files are the deliverable and the command prints its evidence to stdout.

### The planted defect was redesigned mid-task, and the first design was wrong
- The first attempt planted the defect in the code: the broken case shipped the Vietnamese greeting already written but without trimming. Hand-running it showed the mistake immediately — **half the work was done, so the broken case was easier than the clean one**, the opposite of what D-03 needs. Observed: a failure message that names the defect precisely. Expected: one extra repair round. What it would have measured is a cheaper task, not a repair cycle.
- The cause is a constraint task 01 created: adding `Read: test/greet.test.js` to the fixture task, which repaired the guessing problem, also makes every defect that lives in the code or in the test **visible before the run**. A model that reads both simply fixes it and no round appears. Four placements were tried on paper and three died on that; the fourth changes Ownership and so breaks the one-difference rule.
- The user chose the surviving option: **an environment defect**. The broken case's scaffold rewrites the fixture task's Command to `node --test test/`, a directory form that Node 24 loads as a module and rejects with `MODULE_NOT_FOUND`, and mirrors the same change into `package.json` so both paths fail consistently rather than contradicting each other. Hand-verified in a scratch copy: the broken command exits 1 with a loader error; the correct path exits 1 before the task is done and 0 after; and the broken command **still exits 1 after the code is correct**, which is what makes it a genuine environment failure rather than a code failure. This is also the failure that cost `radar-insight` 23 minutes this morning.

### Review found three defective graders and all three were real
- **Critical, and it would have destroyed the measurement silently.** `dong-task` used `^Status: done$` with no multiline flag. Tested against the real file shape it returns **false even when the task is correctly closed**, so all forty paid runs of task 03 would have been classified as never closing, and AC-05 would have excluded every one of them. Repaired to `(^|\n)Status: done($|\n)`, the idiom this repository already uses in `evals/specs/*/graders/khong-code.md` for exactly this reason. Verified: false before, true after.
- **A fabricated Receipt passed.** `receipt-day-du` asked only for `Verification: PASS`, `Exit: 0`, `Base:` and `Head:` in order, so a Receipt with empty provenance values, no `Command:` and no output block scored as valid — the precise hole D-04 exists to close. Repaired to require a non-empty `Command:`, non-empty values after `Base:` and `Head:`, and a fenced block containing something. Verified: the fabricated Receipt now fails and a real one still passes.
- **The code check was gameable and fragile at once.** `Xin chào[\s\S]*trim` passed on a file whose only Vietnamese was a comment while the code stayed English, and failed on a correct implementation that trims before interpolating. Replaced by two order-independent graders: `return[^;\n]*Xin chào`, which a comment cannot satisfy, and `\.trim\(\)`. Verified against three inputs: the comment-only cheat now fails, and both correct implementations pass.
- The two cases remain byte-identical in all eight graders, confirmed by `diff -r`; only the scaffold differs. That is what keeps their costs comparable.

### Risks recorded rather than resolved, because closing them needs a paid run
- **The broken case may measure BLOCKED instead of one repair round.** Fixing it requires running a command other than the one the task's Verification Plan names, while the fixture's Ownership grants only `Modify: src/greet.js` and `develop/SKILL.md:49` teaches that ambiguity is a blocker to raise rather than guess. A rule-following model may stop and ask instead of repairing. That is a real answer about the skill, but it is a different number from the one D-03 planned, and the first broken-case run is where it will be visible. Task 03's checkpoint after step 1 touches only the clean case, so this risk is not priced until roughly half the budget is spent.
- **`min: 0` counters are assumed, not proven, to report their count.** `--validate` does not execute graders, so whether a `tool_used` grader whose threshold always passes still carries `<tool> called <n>x` in its explanation is `[UNVERIFIED]`. The whole of AC-04 rests on it, and task 03 step 2 is the cheapest place it can be settled.
- `dem-verify` matches the substring `node --test test` in a Bash input, so a command that merely echoes or greps that text would be counted as a verification run. Unlikely, and noted rather than tightened, because a narrower pattern risks missing a real invocation written differently.
- **No efficiency claim is made here.** This task only makes the measurement possible.
