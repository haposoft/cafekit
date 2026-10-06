# Task 03 — A project install's resolution of `code-review` is probed

Status: done

## Outcome
`evals/probe-skill-name.sh` records, in a temporary git project that holds the CafeKit skill at `.claude/skills/code-review/`, what the slash command `/code-review` and a `Skill` call named `code-review` load — CafeKit's skill body, another skill's body, nothing, or no transcript to tell — read from each run's own session transcript, together with the init event's `code-review` entries, each run's result `subtype` and `is_error`, the copied skill's `sha256` and the cost (plan D-05). Nothing is renamed.

## Scope
- In: one probe script; two short paid `claude -p` runs (sonnet, at most $0.50 each) started under `env -i` with only the basic user variables; their raw streams under `evals/results/code-review/probe-skill-name/` (gitignored); reading and then deleting the two runs' session transcripts.
- Out: renaming the skill, its command or any caller; the plugin-eval harness (which namespaces the skill as `cafekit-code-review:code-review` and cannot show a project install); any other change to the user's `~/.claude`.

## Coverage
- CP-04

## Ownership
- Create: `evals/probe-skill-name.sh`, `evals/results/code-review/probe-skill-name/` (gitignored)
- Read: `packages/spec/src/claude/skills/code-review/` (copied, never modified), `evals/probe-with-agent.sh` (the once-only probe pattern), `evals/code-review/budget.mjs`

## Steps
1. Write `evals/probe-skill-name.sh` (`set -uo pipefail`, `/bin/bash` 3.2 idioms): when `evals/results/code-review/probe-skill-name/` already holds both streams and `transcripts.txt`, read them and do not run again; otherwise run `node evals/code-review/budget.mjs check 1` (stop on exit 1; its $150 limit is stricter than the $200 cap, and this task does not depend on task 02's `evals/budget-cap.mjs`), make a temporary directory under `$TMPDIR`, `git init` it with one committed file, copy `packages/spec/src/claude/skills/code-review/` to `.claude/skills/code-review/`, record the copied `SKILL.md`'s `sha256`, and take as marker the skill body's first line that starts with `# `.
2. From that directory, through `env -i HOME="$HOME" PATH="$PATH" TMPDIR="$TMPDIR" USER="$USER" LOGNAME="$LOGNAME" LANG="${LANG:-en_US.UTF-8}" SHELL="$SHELL" DISABLE_AUTOUPDATER=1` (no `ORCA_*`, `CLAUDE*` or other inherited variable), run `claude -p "/code-review" --output-format stream-json --verbose --model sonnet --max-turns 1 --max-budget-usd 0.5 --permission-mode dontAsk` into `slash.jsonl` and `claude -p 'Call the Skill tool once with skill set to "code-review", then answer with the single word done.' --output-format stream-json --verbose --model sonnet --max-turns 3 --max-budget-usd 0.5 --permission-mode dontAsk --allowedTools Skill` into `skill.jsonl`, both in the result directory; delete the temporary directory.
3. For each run take `session_id` from its init event and find its transcript as `~/.claude/projects/*/<session_id>.jsonl`; save to `transcripts.txt`, per run, every transcript line that holds `Base directory for this skill:` or the marker (text only, no other content), then delete exactly those two transcript files and each one's project directory when it is left empty.
4. Print: `claude=<version>`; `skill-sha256=<hash>`; per run `init-code-review-entries=<every init skills/slash_commands entry equal to or ending in code-review>`; `slash-loads=` and `skill-tool-loads=` each `cafekit` (a saved line holds the marker), `other:<the Base directory path>` (a `Base directory for this skill:` line without the marker), `none` (a transcript without either) or `not-emitted` (no transcript for the run's `session_id`); `skill-call=<the skill value of each Skill call>`; per run `result=<subtype> is_error=<true|false>`; `cost-usd=<sum of the result events' total_cost_usd>`. Exit 1 when a stream has no `result` event, a result's subtype is `error_during_execution`, or a result has `is_error: true` with a subtype other than `error_max_turns` (the one-turn slash run may end there by design), 0 otherwise.

## Acceptance
- AC-06 as stated in `plan.md`.
- The Receipt quotes the printed lines and adds `cost-usd=` to the shared budget by hand; the finding is recorded, not acted on.

## Dependencies
- none

## Verification Plan
- Command: `bash evals/probe-skill-name.sh`
- Named probe: `evals/probe-skill-name.sh`'s `slash-loads=` and `skill-tool-loads=` lines, read from the saved transcript lines
- Reachability: known — `claude` 2.1.281 on this machine, a project-level `.claude/skills/` directory, the user's own `~/.claude` skills and settings loading as in real use; the transcript path `~/.claude/projects/<project>/<session_id>.jsonl` is [UNVERIFIED] for `-p` runs until the first run shows it, and `not-emitted` records its absence
- Oracle: exit 0 with the lines `claude=`, `skill-sha256=`, two `init-code-review-entries=`, `slash-loads=`, `skill-call=`, `skill-tool-loads=`, two `result=` and `cost-usd=`
- Counterexample: a run that ends without a `result` event, with `error_during_execution`, or with `is_error: true` under any subtype but `error_max_turns`, makes the script exit 1; a CafeKit body that does not load prints `other:…`, `none` or `not-emitted` rather than `cafekit`, and the Receipt reads `not-emitted` as "cannot tell", never as "CafeKit does not load"
- Artifacts: `evals/results/code-review/probe-skill-name/slash.jsonl`, `skill.jsonl` and `transcripts.txt`, gitignored, each on an `Artifact:` line with a `sha256:` line beneath it; the temporary project and the two transcripts are deleted by the script

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. The probe runs its two paid calls once; a failed run is repaired and re-run only with the user's agreement.

## Receipt

Verification: PASS
Command: bash evals/probe-skill-name.sh
Exit: 0
Base: 983c58d9137176a84d146efc17a11648ede3dc7e
Head: d57d4dfe8bef19d889e11e507cdfd0e50b8079f12d173df9e953d1002d182596
```text
$ bash evals/probe-skill-name.sh
budget: spent=103.37974249999999 next=1 total=104.37974249999999 cap=150
claude=2.1.283
skill-sha256=99fd6f1fc6f3eed6ae36d7c354c9a49c343b8c41fa264709db31ab375b141f6e
slash: init-code-review-entries=code-review,code-review
slash-loads=cafekit
skill: init-code-review-entries=code-review,code-review
skill-call=code-review
skill-tool-loads=cafekit
slash: result=error_max_turns is_error=true
skill: result=success is_error=false
cost-usd=0.12999
```

The fenced block is the Command's whole output (2026-09-28 21:17–21:18, `claude` 2.1.283; the Reachability line's 2.1.281 predates claude's update on 2026-09-28, so the finding holds for 2.1.283). It exited 0 after the two paid runs, which ran once.

Finding, as printed and read from each run's own transcript: `/code-review` and a `Skill` call named `code-review` both load CafeKit's copied skill (`slash-loads=cafekit`, `skill-tool-loads=cafekit`); the init event lists `code-review` once under `skills` and once under `slash_commands`, never `cf:code-review`, although the frontmatter says `name: cf:code-review`; no user-level or plugin skill named `code-review` was installed, so the probe does not show how the host chooses between two skills of that name. The one-turn slash run ended `error_max_turns` by design after one read-only `Bash` call (`git status`, `git log`) that the user's allow rules permitted under `dontAsk`. The transcript path `~/.claude/projects/<project>/<session_id>.jsonl` exists for `-p` runs (one per run). Nothing was renamed.

Cost: `cost-usd=0.12999`, added by hand to the shared budget: 103.37974249999999 + 0.12999 = 103.50973249999999 of $200 (the probe writes no `result.json`).

Cleanup, observed against expected: the script deleted both transcripts, but the temporary project's `~/.claude/projects/<escaped path>/` directory stayed, because the host had created an empty `memory/` inside it and the script's `rmdirSync` failed silently (`evals/probe-skill-name.sh:61`); Step 3 expects that directory removed once empty. The controller confirmed it held no file and removed that exact directory by hand; `~/.claude/projects` is back to its 28 entries and the temporary project under `$TMPDIR` is gone. The script was not changed after its paid run. Left in place: the two empty `~/.claude/session-env/<session_id>` directories the host creates for every session (92ac19ac-1d87-4153-bee7-e7e5ad14f27c, 6519daba-f163-4eba-a15c-a199a47cb406), outside this task's scope. The script has no `set -e` guard on `cp -R` and no `trap` for an interrupted run; neither occurred here (the copied `SKILL.md`'s `sha256` matches the source).

Artifact: evals/results/code-review/probe-skill-name/slash.jsonl
sha256: e4b35377e7f241c2901f847c13945afd6c654e72a870669791b342070a7bbb16
Artifact: evals/results/code-review/probe-skill-name/skill.jsonl
sha256: eaadeabb53f3fb9b7f4583518480409427f7517f64af20a4ed40354c114703c8
Artifact: evals/results/code-review/probe-skill-name/transcripts.txt
sha256: 11c5bad8ec579eb5d15b33b3a50f3027db640c136464c49e6c29e84d2a6aa3ae
