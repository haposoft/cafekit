# Task 09 — The harness loads several skills and a case records which one fired

Status: done

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

Verification: PASS
Command: evals/run.sh specs --with-skill brainstorm --validate --allow-tools Write Edit
Exit: 0
Base: 3eb39f1d2985441dbe4d137b9dd890e994f570c7
Head: 3c0544ad6a7b70292f8484a65e47b12630df20a95d2b610b4a58293aa2c06323
```text
$ evals/run.sh specs --with-skill brainstorm --validate --allow-tools Write Edit
1 case runs single-arm (no Δ) — no plugin to strip, or a replay case whose history carries the plugin into both arms: sau-keep
Ablation: 2 arms × 7 cases (53 runs)
$ echo $?
0
```
Seven cases load with no `✗` line. The manifest the run generates cannot be read from that output because the temporary directory is removed on exit, so it was captured by running a copy of the script with the cleanup trap replaced — a copy that must live inside `evals/`, because `run.sh` derives its root from its own location and a copy elsewhere silently resolves to the wrong tree. Captured with no extra skill: `"skills": ["./skills/specs"]`, byte-identical to what the script produced before this task. With one: `"skills": ["./skills/specs", "./skills/brainstorm"]`. The reviewer captured a third variant with two extra skills and all three were valid JSON.

- Argument handling, each branch exercised: an unknown skill name prints `no skill at packages/spec/src/claude/skills/<name>` and exits 2 before `mktemp`, so no plugin is built; a missing value exits 1 through `${2:?usage: --with-skill <name>}`; the option placed after a pass-through flag is rejected by the CLI rather than silently ignored. `extra=()` is safe under `set -u` on bash 3.2 only because of the `${extra[@]+"${extra[@]}"}` guard, which the reviewer confirmed by removing it and getting `unbound variable`.
- Nothing already measured moved: `--tag single-turn` still selects 5 cases, `--tag history` 1, `--tag recheck` 3, no tag 7, and the new case is isolated behind `--tag du-cua`. The prompt of `mo-ho-du-cua` is byte-identical to `mo-ho-c1`'s and its scaffold is the same file, so the only difference between the two measurements is how many doors exist.
- Review: fresh-context reviewer, two rounds. Round 1 FAIL on a Critical of mine: I copied `khong-tu-chot` from `mo-ho-c1` without reading it, and it demands the three uppercase scope words, of which `cf:brainstorm` contains zero — a correct brainstorm answer would have failed for using the wrong skill's vocabulary, in a case whose whole purpose is to let either door win. The rubric is now process-neutral: it names no gate, keyword or answer shape, drops the one-turn requirement that was also a GATE-SCOPE artefact, and scores the three things any correct approach must do.
- Round 1 also raised a High I could not settle by measurement: the temporary plugin is named `cafekit-specs`, so if the Skill tool encodes the plugin name or the skill path into its input, `input_match: specs` would match every call including a brainstorm one, and the headline number would be manufactured by the plugin's name. The encoding is `[UNVERIFIED]` — no artifact stores the raw tool input and the minified CLI did not yield it. Rather than guess one encoding, the patterns now carry a guard, `(^|[^-])specs` and `(^|[^-])brainstorm`, which excludes `cafekit-specs` by its hyphen while still matching `cf:specs`, `"specs"`, `/specs` and a string beginning with `specs`. The reviewer attacked them with thirteen candidate encodings and twelve classify correctly.
- The thirteenth is the residual risk and it is one-directional: a brainstorm call whose free-text arguments mention specs would match both graders, inflating `da-goi-specs` and never deflating it. Task-10's Oracle carries the detector — `da-goi-specs + da-goi-brainstorm` must not exceed `da-goi-mot-skill`, an invariant that can only break when a run matches both — and its Step 3 reads the first run's trace either way.
- Kept against the reviewer's advice, with their agreement after the argument: the two door graders stay at `min: 1` rather than `min: 0`. At `min: 0` both would always pass and the summarizer table would read 10/10 and 10/10, pushing the only numbers this case exists to produce into raw JSON that `summarize.mjs` cannot split by door. The cost is that the two graders are mutually exclusive and scored, so every run caps at 4 of 5 and the case's `overallPassRate` will read 0 — by design, not by failure, and task-10's Receipt must say so.
- Open limitations for GATE-DONE: the residual encoding collision above; the case score being unreadable as quality; and the fact that `--ablation none` is load-bearing for task-10, without which the harness plans two arms, doubles the cost and turns the three door graders into unscored with-only indicators.
