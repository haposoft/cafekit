# Task 10 — The ambiguous request is measured with both doors open

Status: pending

## Outcome
`evals/results/specs/du-cua-sonnet` and `du-cua-opus` each hold ten runs of `mo-ho-du-cua` with `cf:specs` and `cf:brainstorm` both available, and the summarizer reports per model how many runs invoked each skill and how many invoked neither. What that says about the description is read at GATE-DONE.

## Scope
- In: one `evals/run.sh` invocation per model, one summarizer call, reading the first run's trace to confirm the two `input_match` patterns separated the skills correctly, and recording the counts.
- Out: any edit to skills, cases, graders or the harness; changing the description, which is the lever this measurement exists to aim.

## Coverage
- CP-10

## Ownership
- Create: `evals/results/specs/du-cua-sonnet/`, `evals/results/specs/du-cua-opus/` (gitignored)
- Read: `evals/summarize.mjs`, `evals/run.sh`, and the `mo-ho-c1` counts from the four earlier directories for the side-by-side

## Steps
1. Confirm neither directory exists.
2. Run the Command. `--ablation none` is mandatory, not stylistic: without it the harness plans two arms, which doubles the cost to twenty runs per model and quietly turns the three `da-goi-*` graders into with-only indicators that no longer score, changing what is being measured. Expect ten runs per model, single arm, no control arm, because the question is which door is taken rather than whether a door helps. Cost estimate $5-7 [range; basis: $0.207 per single-turn run measured in task 04, twenty runs].
3. Read the first run's trace and confirm `da-goi-specs` and `da-goi-brainstorm` did not both fire on one invocation; report it either way.
4. Copy the Command's stdout into the Receipt unchanged, and put the counts beside `mo-ho-c1`'s 3 of 6 from the one-door world.

## Acceptance
- AC-12 as stated in `plan.md`.
- **Counts come from the summarizer**, both directories non-partial.
- **No conclusion is drawn here.** Which door is correct, and whether the description should change, is a GATE-DONE reading of these counts.

## Dependencies
- task-09-load-several-skills.md

## Verification Plan
- Command: `evals/run.sh specs --out du-cua-sonnet --with-skill brainstorm --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --out du-cua-opus --with-skill brainstorm --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && node evals/summarize.mjs evals/results/specs/du-cua-sonnet evals/results/specs/du-cua-opus`
- Named probe: graders `da-goi-mot-skill`, `da-goi-specs`, `da-goi-brainstorm`, `khong-tu-chot` and `khong-code`, counted by `evals/summarize.mjs`
- Reachability: known — the same harness ran ten paid measurements in tasks 04, 05 and 08; `--with-skill` and the `du-cua` tag are proven by task 09's validate
- Oracle: all three commands exit 0; both directories `partial: false`, each case carrying exactly one arm named `with` and ten runs in it, which is also how a missing `--ablation none` would be caught; the table reports `da-goi-specs` and `da-goi-brainstorm` counts that sum to at most the `da-goi-mot-skill` count
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason, leaving the table incomplete
- Artifacts: `evals/results/specs/du-cua-sonnet/result.json`, `evals/results/specs/du-cua-opus/result.json` (gitignored), named in the Receipt

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason`; before a rerun remove the affected `--out` directory explicitly. A count that favours neither door is a finding, not a failure.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
