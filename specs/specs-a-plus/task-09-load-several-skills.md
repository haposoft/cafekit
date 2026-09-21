# Task 09 — The harness loads several skills and a case records which one fired

Status: in_progress

## Outcome
`evals/run.sh` accepts `--with-skill <name>`, copies each named skill beside the one under test and declares them all in the temporary plugin, so a case can be answered with more than one door open. A new case `mo-ho-du-cua` asks the same under-specified question as `mo-ho-c1` and carries graders that separate a `cf:specs` invocation from a `cf:brainstorm` one, from neither.

## Scope
- In: one option in `evals/run.sh` and the manifest line it feeds; a new case directory reusing the existing fixture and the repaired rubrics.
- Out: the skill text and its description; `mo-ho-c1` and every other existing case, which stay exactly as measured; running anything paid (task 10 owns that); any conclusion about which door is correct.

## Coverage
- CP-09

## Ownership
- Modify: `evals/run.sh` (argument parsing, the skill copy, the `skills` array in the generated manifest, and the header usage lines)
- Create: `evals/specs/mo-ho-du-cua/case.yaml`, `evals/specs/mo-ho-du-cua/scaffold.sh`, `evals/specs/mo-ho-du-cua/graders/{da-goi-mot-skill,da-goi-specs,da-goi-brainstorm,khong-tu-chot,khong-code}.md`
- Read: `packages/spec/src/claude/skills/brainstorm/` (two files, 20 KB, self-contained), `evals/specs/mo-ho-c1/` for the prompt and graders to reuse

## Steps
1. `run.sh`: accept `--with-skill <name>` before the pass-through options, repeatable, collecting names into a list; refuse a name that is not a directory under `packages/spec/src/claude/skills/`.
2. Copy each named skill into `$work/skills/<name>/` the same way the skill under test is copied, and build the manifest's `skills` array from all of them rather than from one.
3. Add the new invocation to the header comment.
4. Create `mo-ho-du-cua` with the `mo-ho-c1` prompt verbatim, the same fixture scaffold, `tags: [du-cua]` so no existing selection picks it up, `runs: 10`, and `allowed_tools: [Read, Glob, Grep, Skill]`.
5. Graders: `da-goi-mot-skill` (tool_used `Skill`, `input_match: specs|brainstorm`, min 1) answers whether any door was taken; `da-goi-specs` and `da-goi-brainstorm` (min 1 each) say which; `khong-tu-chot` and `khong-code` are copied from `mo-ho-c1` so the answer quality is judged the same way. None of these is a verdict on which door is right; they record.
6. Validate with and without `--with-skill brainstorm` and read the generated manifest in both cases.

## Acceptance
- AC-11 as stated in `plan.md`.
- **The existing measurements are untouched.** `mo-ho-c1` and the other five cases keep their bytes, and `--tag single-turn`, `--tag history` and `--tag recheck` still select exactly what they selected before.
- **The new graders record rather than judge.** A run that takes either door can still pass `da-goi-mot-skill`; only `da-goi-specs` and `da-goi-brainstorm` separate them, and both are reported.
- **Pattern risk is named.** `input_match` matches the encoded tool input, so a brainstorm invocation whose arguments mention specs could match both; task 10 must read the first run's trace and report whether it did.

## Dependencies
- task-08-remeasure-the-three-cases.md

## Verification Plan
- Command: `evals/run.sh specs --with-skill brainstorm --validate --allow-tools Write Edit`
- Named probe: the harness listing seven cases including `mo-ho-du-cua` with no `✗`, and the temporary plugin manifest declaring both `./skills/specs` and `./skills/brainstorm`
- Reachability: known — validate is free and has run this way since task 03; `brainstorm` is two self-contained files
- Oracle: exit 0, no `✗` line, and the manifest printed by the run naming both skills
- Counterexample: pass `--with-skill not-a-skill` → the script refuses and exits non-zero without building a plugin
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If loading a second skill changes how an existing case is selected or graded, stop: the earlier measurements must stay comparable.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
