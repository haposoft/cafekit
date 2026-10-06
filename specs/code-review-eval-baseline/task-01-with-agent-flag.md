# Task 01 — `evals/run.sh` loads a named agent into the eval plugin, proven for $0 and by one probe

Status: done

## Outcome
`evals/run.sh <skill> --with-agent <name>` copies `packages/spec/src/claude/agents/<name>.md` into the temporary plugin as `agents/<name>.md`, the folder the harness loads by default (plan D-01); a bad or unknown name exits 2 before any `claude` call; with no `--with-agent`, the plugin tree and the arguments given to `claude` equal those of `evals/run.sh` at `e93060b` for the five existing suites, which `evals/check-with-agent.sh` proves for $0 with a stub `claude`; `evals/probe-with-agent.sh` shows the agent in a paid run's init event — from an existing case, or from a staged case that grants `Agent` when the first probe is noise (GATE-REVIEW F-13) — and the Receipt states the observed agent type.

## Scope
- In: the flag in `evals/run.sh` and one usage line in its header comment; `evals/check-with-agent.sh`; `evals/probe-with-agent.sh` and its one or two runs into `evals/results/specs/probe-with-agent` and, only when needed, `evals/results/specs/probe-with-agent-fallback` (gitignored, `.gitignore:122`); deleting the probes' kept directories after the Receipt.
- Out: the `--with-skill`, `--validate` and `--out` behavior and messages; `plugin.json` (unchanged unless D-01's break response applies); every skill, agent and case in the repository; `evals/code-review/` (task 02).

## Coverage
- CP-01

## Ownership
- Modify: `evals/run.sh`
- Create: `evals/check-with-agent.sh`, `evals/probe-with-agent.sh`, `evals/results/specs/probe-with-agent/` and `evals/results/specs/probe-with-agent-fallback/` (gitignored)
- Read: `evals/run.sh:37-62` and `git show e93060bacd4891d75cc5eb6959d8524be8780446:evals/run.sh`, `packages/spec/src/claude/agents/code-auditor.md`, `packages/spec/src/claude/agents/researcher.md`, `evals/specs/khong-kich-hoat/case.yaml`

## The flag
- `--with-agent <name>` is repeatable and may interleave with `--with-skill` in any order; both still come right after `<skill>` and before `--validate` or `--out` (the position rule of `evals/run.sh:38` and `:68`, `:83`).
- A name that is empty, `.`, `..`, or holds a character outside `A-Za-z0-9._-` prints `--with-agent takes one agent name` and exits 2 (the grammar of `--out` at `:85`); a name without a regular file at `packages/spec/src/claude/agents/<name>.md` prints `no agent at packages/spec/src/claude/agents/<name>.md` and exits 2 (the form of `:40-41`); a missing value stops through `${2:?usage: --with-agent <name>}` like `:39`. All three happen before `mktemp`, so nothing is built and `claude` is never called.
- For each name, `$work/agents/<name>.md` receives the file's bytes; `$work/agents` exists only when at least one name was given. The generated `plugin.json` is not touched.

## The checker
`evals/check-with-agent.sh`, $0, exits 0 only when every line below prints `ok:`; a failure prints `FAIL: …` and exits 1. It stages two copies of the harness in a `mktemp -d` root — `base/` with `evals/run.sh` from `e93060b`, `new/` with the working-tree `evals/run.sh`, each beside rsync copies (without `results/`) of `packages/spec/package.json`, `packages/spec/src/claude/skills/`, `packages/spec/src/claude/agents/` and `evals/{specs,develop,scout,debug,fix}/` — and puts first in `PATH` a stub `claude`, written through a quoted heredoc. The checker runs each copy's `evals/run.sh` with `STAGE_ROOT` set to that copy's root and `CAPTURE` set to a fresh directory; the stub writes to `$CAPTURE/args` its arguments with every occurrence of `$STAGE_ROOT` replaced by `ROOT`, to `$CAPTURE/paths` the output of `find . -print` in its working directory (so an empty directory shows), and to `$CAPTURE/files` one `sha256  path` line per file there, both sorted with `LC_ALL=C`, then exits 0 (GATE-REVIEW F-10). A capture is the three files. Assertions:
1. For each of `specs`, `develop`, `scout`, `debug`, `fix` with `--validate`, and for `fix --with-skill debug --with-skill scout --validate`: the `new` capture equals the `base` capture byte for byte (no `./agents` path, same `plugin.json` hash, same arguments).
2. The run branch, `fix --with-skill debug --with-skill scout --out chk --runs 1 --case loi-don-gian`: the two captures are equal, and each root holds its own `evals/results/fix/chk/` (nothing is written under the repository).
3. `specs --with-agent code-auditor --validate` equals the `base` `specs --validate` capture plus exactly `./agents` and `./agents/code-auditor.md` in `paths` and one `files` line: the `sha256` of `packages/spec/src/claude/agents/code-auditor.md` beside `./agents/code-auditor.md`.
4. `fix --with-skill debug --with-agent code-auditor --with-skill scout --validate` and `fix --with-agent code-auditor --with-skill debug --with-skill scout --validate` each equal the `base` `fix --with-skill debug --with-skill scout --validate` capture plus those lines.
5. `specs --with-agent code-auditor --with-agent researcher --validate` adds exactly `./agents` and the two agent paths and lines.
6. `--with-agent nope`, `--with-agent ../agents/code-auditor`, `--with-agent .` each exit 2 with their message on stderr; `--with-agent` with no value exits non-zero; none of the four leaves anything in its `CAPTURE` directory.

## The probe
`evals/probe-with-agent.sh`, paid, exports `DISABLE_AUTOUPDATER=1` and reads each probe with one node heredoc that prints `claude=`, `partial=`, `runs=`, `error=`, `init-tools-agent=yes|no` (whether the trace's `system`/`init` event lists the `Agent` tool), `init-agents: <every agent type>` and `observed-agent: <types ending in code-auditor, or none>`; it returns 0 for exactly one such type, 3 for none while `init-tools-agent=no`, and 1 otherwise (a partial or errored run, a missing trace, no init event, none while `Agent` is listed, or more than one).
1. Primary: unless `evals/results/specs/probe-with-agent` exists, `evals/run.sh specs --with-agent code-auditor --out probe-with-agent --model sonnet --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 1 --case khong-kich-hoat --keep-temp` — among the cheapest existing cases ($0.053–0.066 a run; Cost in `plan.md`), one sonnet run, no Bash grant, and its `allowed_tools` do not list `Agent`. A return of 0 prints `probe: primary` and exits 0; 1 exits 1.
2. Fallback, only on 3 (the probe is noise: plan D-01, GATE-REVIEW F-13): unless `evals/results/specs/probe-with-agent-fallback` exists, it stages in a `mktemp -d` root (removed on exit) a copy of the working-tree `evals/run.sh`, `packages/spec/package.json`, `packages/spec/src/claude/skills/code-review/` and `packages/spec/src/claude/agents/code-auditor.md`, and writes through quoted heredocs one case, `evals/code-review/probe-agent/case.yaml` (`schema_version: "1.1"`, `name: probe-agent`, `runs: 1`, prompt `Không dùng công cụ nào. Trả lời đúng một dòng: ok`, `max_turns: 2`, `timeout_seconds: 120`, `allowed_tools: [Read, Agent]`) with one grader, `graders/dem-agent.md` (`tool_used`, `Agent`, `min: 0`); it runs the staged `evals/run.sh code-review --with-agent code-auditor --out probe-with-agent --model sonnet --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 1 --allow-tools Agent --case probe-agent --keep-temp`, copies the staged `result.json` into `evals/results/specs/probe-with-agent-fallback/`, and reads it. A return of 0 prints `probe: fallback` and exits 0; anything else exits 1.
The binary builds the type as `<plugin name>:<frontmatter name>`, so `cafekit-specs:code-auditor` is expected from the primary and `cafekit-code-review:code-auditor` from the fallback (inference; plan's Scope decision); the Receipt states what was observed, and task 02 relies on the same rule for `cafekit-code-review:code-auditor`.

## Steps
1. Edit `evals/run.sh` as in The flag: replace the `--with-skill` loop with one loop that accepts either flag, add the agent copy after the skill copies (`:51-55`), and add one header line such as `evals/run.sh code-review --with-agent code-auditor --out pilot-x --model sonnet …` with one sentence on why (a case that measures an agent needs it loaded as the product ships it) → `bash -n evals/run.sh` exits 0.
2. Write `evals/check-with-agent.sh` as in The checker and `evals/probe-with-agent.sh` as in The probe, through the Write tool or quoted heredocs (`<<'SH'`), never `echo` (zsh `echo` rewrites backslashes) → `bash evals/check-with-agent.sh` prints only `ok:` lines and exits 0; `bash -n evals/probe-with-agent.sh` exits 0.
3. Run the Command via `bash -c` on this file's own text.
4. After the Receipt is written: delete the kept directory of each probe that ran — `dirname(dirname(tracePath))` from its `result.json`, `chmod -R u+rwX` then `rm -rf` on that one path, nothing matched by a glob; then run the Stop gate (`node .claude/hooks/spec-gate.cjs`) with a payload on stdin — `hook_event_name` `Stop`, the repository `cwd`, a non-empty `session_id` and `"featureName":"code-review-eval-baseline"` (a key `extractExplicitTarget` reads, `.claude/scripts/spec-resolver.cjs:550`; GATE-REVIEW F-05) — and require **empty stdout** (the gate always exits 0 and blocks by printing JSON).

## Acceptance
- AC-01 as stated in `plan.md`.
- The Receipt states the observed agent type, which probe produced it, and carries the `run-sh-sha256:` line that tasks 02 and 03 check.

## Dependencies
- none

## Verification Plan
- Command: `[ "$(node --version)" = v20.20.2 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@20/bin/node ] && git diff --quiet e93060bacd4891d75cc5eb6959d8524be8780446 -- evals/specs packages/spec/src/claude/skills/specs packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md && [ -z "$(git status --porcelain -- evals/specs packages/spec/src/claude/skills/specs packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md)" ] && bash -n evals/run.sh && bash -n evals/check-with-agent.sh && bash -n evals/probe-with-agent.sh && bash evals/check-with-agent.sh && bash evals/probe-with-agent.sh && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d' ' -f1)"`
- Named probe: the checker's six assertion groups; the probe script's `init-tools-agent=`, `init-agents:`, `observed-agent:` and `probe:` lines
- Reachability: known — the stub `claude` runs the same `evals/run.sh` code paths as the real one up to the `claude` call; the primary probe uses the installed `claude` 2.1.281 on an existing case, the fallback the same `evals/run.sh` bytes from a staged root; whether an eval run loads plugin agents is the open fact this Command settles
- Oracle: every guard passes; the checker prints `ok:` for every assertion and exits 0; the probe script prints `partial=false runs=1 error=null` for each probe it read, `observed-agent:` names exactly one type ending in `code-auditor` (expected `cafekit-specs:code-auditor` with `probe: primary`, or `cafekit-code-review:code-auditor` with `probe: fallback`), and exits 0; the last line is `run-sh-sha256:` with 64 hex digits
- Counterexample: an `agents/` folder built without `--with-agent` (even empty), a changed `plugin.json`, a changed argument, a copied agent whose bytes differ, a bad name that is not refused with exit 2 or that reaches the stub each make the checker exit 1; a plugin whose agent does not load leaves no `code-auditor` type and the probe script exits 1 — at once when the init event lists `Agent`, after the fallback when it does not
- Artifacts: `evals/results/specs/probe-with-agent/result.json` and, when the fallback ran, `evals/results/specs/probe-with-agent-fallback/result.json`, gitignored, each on its own `Artifact:` line with a `sha256:` line beneath it; the kept run directories and the fallback's staging root are ephemeral (Step 4, the script's exit trap)

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. When the probe script fails after a paid run, rename each probe directory it wrote to `<name>-lan1` (`--out` refuses an existing directory; a paid result is never deleted) and run the Command once more after the repair. When the reading is `observed-agent: none` with `init-tools-agent=yes` on the primary, or `none` on the fallback, the repair is D-01's break response (`plugin.json` gains an `agents` key only when a name is given); with `init-tools-agent=no` on the primary, `plugin.json` is never changed for that reading. A second failure stops for the user.

## Receipt

Verification: PASS
Command: [ "$(node --version)" = v20.20.2 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@20/bin/node ] && git diff --quiet e93060bacd4891d75cc5eb6959d8524be8780446 -- evals/specs packages/spec/src/claude/skills/specs packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md && [ -z "$(git status --porcelain -- evals/specs packages/spec/src/claude/skills/specs packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md)" ] && bash -n evals/run.sh && bash -n evals/check-with-agent.sh && bash -n evals/probe-with-agent.sh && bash evals/check-with-agent.sh && bash evals/probe-with-agent.sh && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d' ' -f1)"
Exit: 0
Base: cd5e1e47c33d123e50e8c486fd6e1c106c6531f6
Head: 4528e8ae8fe7f323316cd9d34249708b92a2ccca3de9fc3bc15d68110b7e25d0
```text
$ [ "$(node --version)" = v20.20.2 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@20/bin/node ] && git diff --quiet e93060bacd4891d75cc5eb6959d8524be8780446 -- evals/specs packages/spec/src/claude/skills/specs packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md && [ -z "$(git status --porcelain -- evals/specs packages/spec/src/claude/skills/specs packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md)" ] && bash -n evals/run.sh && bash -n evals/check-with-agent.sh && bash -n evals/probe-with-agent.sh && bash evals/check-with-agent.sh && bash evals/probe-with-agent.sh && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d' ' -f1)"
ok: specs --validate: plugin tree, file bytes and claude arguments equal e93060b
ok: develop --validate: plugin tree, file bytes and claude arguments equal e93060b
ok: scout --validate: plugin tree, file bytes and claude arguments equal e93060b
ok: debug --validate: plugin tree, file bytes and claude arguments equal e93060b
ok: fix --validate: plugin tree, file bytes and claude arguments equal e93060b
ok: fix --with-skill debug --with-skill scout --validate: equal to e93060b
ok: run branch (--out chk --runs 1 --case loi-don-gian): equal to e93060b, results only under each copy
ok: specs --with-agent code-auditor --validate: base plus agents/code-auditor.md with its bytes
ok: fix with --with-agent before or between --with-skill: base plus agents/code-auditor.md
ok: specs --with-agent code-auditor --with-agent researcher --validate: base plus both agent files
ok: bad agent names exit 2 with their message, a missing value exits non-zero, none reaches claude
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
⚠ kept /private/tmp/e-NgSCxl: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-NgSCxl/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-NgSCxl /private/tmp/e-NgSCxl/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/probe-with-agent/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/probe-with-agent/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/probe-with-agent (exit 0)
primary run exit=0
claude=2.1.281 partial=false runs=1 error=null
init-tools-agent=yes
init-agents: cafekit-specs:code-auditor claude Explore general-purpose Plan statusline-setup
observed-agent: cafekit-specs:code-auditor
probe: primary
run-sh-sha256: d31f0b53e1a668152aac888a01ed8c504c1c2e4f6806614ea9c0dd775ee0b7d4
```

The fenced block is the Command's whole output (2026-09-26, `claude` 2.1.281, `DISABLE_AUTOUPDATER=1`, `bash -c` on this file's Command text, `/bin/bash` 3.2.57); it exited 0.

Oracle: every guard passed; the checker printed `ok:` for all six assertion groups (11 lines) and exited 0; the probe printed `partial=false runs=1 error=null`, `init-tools-agent=yes`, `observed-agent: cafekit-specs:code-auditor` and `probe: primary`, and exited 0; the last line is `run-sh-sha256:` with 64 hex digits.

Observed agent type: `cafekit-specs:code-auditor`, from the primary probe (the fallback did not run). The init event listed `cafekit-specs:code-auditor claude Explore general-purpose Plan statusline-setup`, which confirms plan D-01's rule `<plugin name>:<frontmatter name>`; task 02 relies on it for `cafekit-code-review:code-auditor`.

Artifact: evals/results/specs/probe-with-agent/result.json
sha256: 8213213d005b8b7cbc7524230321e9ed0339486ad95652a30a0dcd2659089bbc

Probe cost: $0.0527 (one sonnet run, judge included in `costUsd`).

Pre-change run: not taken, because the Command runs a paid probe; before the change, `evals/check-with-agent.sh` and `evals/probe-with-agent.sh` did not exist, so its `bash -n` links could not pass.

Counterexamples, each on a restored copy of `evals/run.sh` (its `sha256` `d31f0b53…` checked after every round), each made the checker exit 1 with a named `FAIL:` line: an `agents/` folder built without `--with-agent` (`specs --validate: paths differ`); `plugin.json` given an `agents` key (`files differ`); copied agent bytes altered (`files are not base plus the agent bytes`); the name-grammar check removed (`../agents/code-auditor … exited 0, not 2`); the unknown-name check removed (`nope … exited 1, not 2`); an extra `claude` argument (`args differ`). The probe script's exit codes were exercised on synthetic result and trace files: 0 with one `…:code-auditor` type, 0 via the fallback when the primary is noise, 1 with none while the init event lists the subagent tool, 1 with two matching types. The independent review re-ran sixteen mutations on a scratch copy; fifteen were caught, and the one that passed changed a `--with-skill` message, which the task does not ask the checker to test.

Implementation note: the init event of 2.1.281 lists the subagent tool only as `Task` (the probe trace's `tools` were `Task, Glob, Grep, Read, Skill, TaskStop, ToolSearch`; the binary maps `Agent` to `Task` when it builds that list), so `init-tools-agent` accepts `Task` or `Agent` by exact element; matching `Agent` alone would always read `no` and send a load failure to the fallback instead of D-01's break response. The review judged this correct and in scope.

Limits, for GATE-DONE:
- `--with-agent ""` exits 1 through `${2:?usage: --with-agent <name>}`, not exit 2 with `--with-agent takes one agent name`: the task asks for both, and `${2:?}` treats an empty value as missing; it still stops before `mktemp` without calling `claude`.
- The probe's comment at `evals/probe-with-agent.sh:30` reads as if the init event lists both names; on 2.1.281 it lists only `Task`. Its match `(^|:)code-auditor$` is narrower than "ending in code-auditor" (it would not accept `x-code-auditor`).
- The case `khong-kich-hoat` grants `[Read, Glob, Grep, Skill]`, yet its init event lists `Task`, `TaskStop` and `ToolSearch`: tools outside `allowed_tools` still appear in the init list, so on 2.1.281 the primary probe is almost never "noise".
- Existing behavior, unchanged from `e93060b`: under bash 3.2, `--out` with a missing or empty value exits 0, because its `${2:?}` runs after `trap … EXIT`; tasks 02 and 03 always pass a value.
