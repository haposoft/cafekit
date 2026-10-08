# Task 03 — Two eval cases, tags, two run.sh repairs, and a summarizer load; the resumed case runs once

Status: done

## Outcome
`evals/specs/mo-ho-c1` (an ambiguous single-turn request) and `evals/specs/sau-keep` (a resumed transcript in which GATE-SCOPE was asked and the user answers KEEP) load under `--validate` together with the four tagged existing cases; `evals/run.sh --validate` exits 0 exactly when every case loads; `run.sh --out <name>` writes to a named result directory and refuses to overwrite one; `sau-keep` resumes inside the harness once and writes `specs/google-login/plan.md`; `evals/summarize.mjs` turns named `result.json` files into the per-case counts AC-07 needs and skips partial files.

## Scope
- In: the two case directories; one `tags:` line in each of the four existing `case.yaml` files; `evals/run.sh` validate exit semantics (`:40-43`), a `--out <name>` option for the result directory, and two usage lines in its header comment (`:1-18`); `evals/summarize.mjs`.
- Out: the four existing cases' prompts, graders, scaffolds, and `runs`; any change to the skill text; the measurement itself (tasks 04–05).

## Coverage
- CP-03

## Ownership
- Create: `evals/specs/mo-ho-c1/case.yaml`, `evals/specs/mo-ho-c1/scaffold.sh`, `evals/specs/mo-ho-c1/graders/{mot-cau-hoi-c1,co-marker,khong-tu-chot,khong-code,co-goi-skill}.md`
- Create: `evals/specs/sau-keep/case.yaml`, `evals/specs/sau-keep/history.jsonl`, `evals/specs/sau-keep/scaffold.sh`, `evals/specs/sau-keep/graders/{co-plan,co-task,plan-co-decisions,plan-co-priority,task-co-steps,task-co-failure-protocol,task-co-oracle,moi-ac-co-task,khong-viet-code,khong-sua-code,co-goi-skill}.md`
- Create: `evals/summarize.mjs`
- Modify: `evals/run.sh` (header, validate branch and result-directory naming; at HEAD `279a115` those were `:1-18`, `:40-43` and `:45-53`, and after this task they are `:1-22`, `:47-57` and `:60-73`)
- Modify: `evals/specs/dung-o-c1/case.yaml`, `evals/specs/export-csv/case.yaml`, `evals/specs/sua-typo/case.yaml`, `evals/specs/khong-kich-hoat/case.yaml` (one `tags: [single-turn]` line each, nothing else)
- Read: `evals/specs/dung-o-c1/` (case shape, fixture `src/app.js`, `src/auth.js`, `src/customers.js`, `src/users-store.js`, `test/auth.test.js`, README); the harness facts in `plan.md` § Measured constraints

## Steps
1. `run.sh` validate branch (`:40-43`): run the harness under `set +e`, capture its stdout and the command substitution's `$?` (there is no pipe, so `PIPESTATUS` is not involved); exit 0 when the exit code is 2 (cost ceiling) and the output has no `✗` line, otherwise print the output and exit 1. Then `evals/run.sh specs --validate; echo $?` → 0 today with the four cases.
2. `run.sh` result directory: accept `--out <name>` as the first option after the skill; use `evals/results/<skill>/<name>/` instead of the timestamp; refuse with exit 2 when it exists; keep the timestamp when `--out` is absent. Header comment gains the two measurement invocations from tasks 04–05.
3. Add `tags: [single-turn]` to the four existing `case.yaml` files (top level, beside `name`); validate → still four cases.
4. `mo-ho-c1/case.yaml`: `schema_version: "1.1"`, `tags: [single-turn]`, `runs: 3` (top level), scaffold reusing the sibling fixture (`cp -R "$HERE/../dung-o-c1/fixture/." .`), prompt "Thêm thông báo cho đội bán hàng khi có khách hàng mới được tạo. Làm cho tôi nhé." (channel, recipients, and timing are undecided on purpose), `execution.max_turns: 14`, `execution.allowed_tools: [Read, Glob, Grep, Skill]`.
5. `mo-ho-c1` graders: `mot-cau-hoi-c1` (regex, `target: last_message`, all three of `EXPAND`, `KEEP`, `CUT` via lookaheads); `co-marker` (regex `NEEDS CLARIFICATION|CẦN LÀM RÕ`, `flags: i`); `khong-tu-chot` (llm, `focus: last_message`: PASS only if the reply asks about channel/recipients/timing instead of deciding them, asks once, and cites existing code such as `src/customers.js`); `khong-code` and `co-goi-skill` with the same frontmatter as `dung-o-c1`.
6. `sau-keep/history.jsonl`: two records shaped like a Claude Code transcript (keys `parentUuid`, `isSidechain`, `type`, `message`, `uuid`, `timestamp`, `sessionId`, `cwd`, `userType`, `entrypoint`, `version`); user turn = the `dung-o-c1` prompt; assistant turn = a GATE-SCOPE message in Vietnamese citing `src/auth.js` (`POST /login`, signed cookie session), proposing `specs/google-login/`, listing exclusions, `[NEEDS CLARIFICATION]: none`, and offering EXPAND / KEEP / CUT. Fresh record UUIDs and `cwd: /workspace`; the `sessionId` is reused from the transcript the records were derived from. The message must not contain `## Decisions`, `## Steps`, `## Failure Protocol`, `Priority`, or `- Oracle:`, or the content graders would pass on the history alone.
   Trap: proving the transcript resumes with `claude --resume <path> -p …` writes the resumed session's own transcript into that directory. Delete it — it is a real session log, not part of the case, and nothing under `evals/specs/` is gitignored.
7. `sau-keep/case.yaml`: `tags: [history]`, `runs: 3` (top level), `context.history_file: history.jsonl`, `context.scaffold_script: scaffold.sh` (same fixture), prompt "KEEP. Dùng skill specs để viết specs/google-login/plan.md và file task đầu tiên đặt tên task-01-google-oauth.md." (the filename is pinned because a file-content grader resolves one exact path), `execution.max_turns: 30`, `execution.timeout_seconds: 600`, `execution.allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]`. A run may use only the intersection of the case's list and the operator grant, so Write and Edit appear in both the case and every invocation; without the grant the harness warns that `co-plan` cannot pass.
8. `sau-keep` graders: `co-plan` (file_exists `specs/google-login/plan.md`), `co-task` (file_exists `specs/google-login/task-01-*.md`, whose glob proves the task stayed flat beside the plan), `plan-co-decisions` / `plan-co-priority` (regex, `target: { source: file, path: specs/google-login/plan.md }`, patterns `## Decisions` and `\| Priority \|`), `task-co-steps` / `task-co-failure-protocol` / `task-co-oracle` (regex, `target: { source: file, path: specs/google-login/task-01-google-oauth.md }`, patterns `## Steps`, `## Failure Protocol`, `- Oracle:`), `moi-ac-co-task` (llm, `focus: { source: file, path: specs/google-login/plan.md }`: every `AC-NN` in the Acceptance table appears in at least one Tasks row, the Tasks table has a `Priority` column, and `## Decisions` is filled in), `khong-viet-code` (tool_used `Write`, `input_match: '"file_path":"[^"]*/src/'`, `min: 0`, `max: 0`), `khong-sua-code` (the same guard for `Edit`, which is also granted and would otherwise be an unwatched way to change code), `co-goi-skill`.
   Two corrections the first smoke run forced, both measured rather than argued: a `target: trace` regex matched the template text the Skill tool had just loaded, so all five content graders passed while `co-plan` and `co-task` showed no file had been written — content graders must read the file itself, and the harness resolves one exact path there (verified in the CLI: the file target reads a single path, it does not glob), which is why the prompt pins the task filename. And `input_match: "src/"` matched the `content` field of a Write whose plan text cited `src/auth.js`, so the pattern is anchored to the `file_path` field instead.
9. `evals/summarize.mjs`: `node evals/summarize.mjs <result directory>...` reads each directory's `result.json`, skips any with `partial: true` (printing why), and prints per case and arm: runs, `Skill` invocations, each grader's pass count; with several directories it also prints one aggregate table — the exact numbers AC-07 names.
10. Run the Command → validate exits 0 listing six cases; the single `sau-keep` run resumes (its `result.json` shows one case, one arm, `partial: false`) and `co-plan` passes.

## Acceptance
- AC-06 as stated in `plan.md`.
- **The resumed case measures the skill, not the model's memory.** The history contains no skill body; the prompt names the skill; `co-goi-skill` passes in the smoke run.
- **Graders name observable things.** Every regex targets a heading or table cell the template mandates; no grader rewards prose quality.
- **The summarizer is the only counter.** No count in any later Receipt is typed by hand; partial files are never counted.
- **Existing cases keep their behaviour.** The diff of the four existing `case.yaml` files is one added line each.

## Dependencies
- none

## Verification Plan
- Command: `evals/run.sh specs --validate --allow-tools Write Edit && evals/run.sh specs --out smoke-sau-keep --runs 1 --model sonnet --judge-model sonnet --threshold 0 --ablation none --allow-tools Write Edit --tag history`
- Named probe: the harness plan lines for all six cases; graders `co-plan` and `co-goi-skill` of the single run; the `partial` field of its `result.json`
- Reachability: known — `evals/run.sh` validated four cases on 2026-09-17; resuming a two-record transcript by path was proven on 2026-09-18 outside the harness ($0.019); inside the harness it is proven by this Command's second half; `--threshold 0` keeps a missed grader from turning into exit 1
- Oracle: both commands exit 0; the validate half lists six cases with no `✗` and no "cannot pass with the granted tools" warning; `evals/results/specs/smoke-sau-keep/result.json` has `cases[0].name == "sau-keep"`, `partial: false`, and `co-plan` passed; `results: evals/results/specs/smoke-sau-keep (exit 0)` printed
- Counterexample: remove `execution.prompt` from `sau-keep/case.yaml` → validate prints `✗ … context.history_file requires execution.prompt` and exits 1 under the repaired branch; restore → exit 0
- Artifacts: `evals/results/specs/smoke-sau-keep/result.json` and `report.html` (gitignored, `.gitignore:122`); the directory name is fixed by `--out`, so the Receipt cites it without a timestamp

## Failure Protocol
On a failed Step or Verify: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If the transcript does not resume inside the harness, record the harness error verbatim and stop — do not fall back to a single-turn imitation. Before a rerun, remove `evals/results/specs/smoke-sau-keep` explicitly; `--out` refuses to overwrite.

## Receipt

Verification: PASS
Command: evals/run.sh specs --validate --allow-tools Write Edit && evals/run.sh specs --out smoke-sau-keep --runs 1 --model sonnet --judge-model sonnet --threshold 0 --ablation none --allow-tools Write Edit --tag history
Exit: 0
Base: 279a115290b1caad3c46fa93e0ce13882284aa59
Head: 79f856f28cee15bd1a499db3d9ec1f0dfcd4f8d72d876d86eaa25e1c884ffc60
```text
$ evals/run.sh specs --validate --allow-tools Write Edit && evals/run.sh specs --out smoke-sau-keep --runs 1 --model sonnet --judge-model sonnet --threshold 0 --ablation none --allow-tools Write Edit --tag history
1 case runs single-arm (no Δ) — no plugin to strip, or a replay case whose history carries the plugin into both arms: sau-keep
Plugin under test: "cafekit-specs" version "0.16.7"
Ablation: 2 arms × 6 cases (33 runs)
Wrote evals/results/specs/smoke-sau-keep/result.json
results: evals/results/specs/smoke-sau-keep (exit 0)

$ node evals/summarize.mjs evals/results/specs/smoke-sau-keep
evals/results/specs/smoke-sau-keep  model=sonnet  judge=sonnet  ablation=none  started=2026-09-18T07:01:37.863Z  cost=$0.32
  sau-keep [with]  runs 1  Skill invoked 1/1  co-goi-skill 1/1  co-plan 1/1  co-task 1/1  khong-sua-code 1/1  khong-viet-code 1/1  moi-ac-co-task 1/1  plan-co-decisions 1/1  plan-co-priority 1/1  task-co-failure-protocol 1/1  task-co-oracle 1/1  task-co-steps 1/1
```
The validate half printed no `✗` line and no "cannot pass with the granted tools" warning; its six cases include `mo-ho-c1` with both ablation arms and `sau-keep` single-arm. Absolute paths in the harness output are shortened to repository-relative here. The summarizer call is shown because its table, not a hand count, is the number GATE-DONE reads. Base and Head derived with `node packages/spec/src/claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file specs/specs-a-plus/task-03-eval-cases-and-summarizer.md --feature-name specs-a-plus --session develop-task-03 --json`, captured twice with identical values.

- Artifact: `evals/results/specs/smoke-sau-keep/result.json` (gitignored, `.gitignore:122`) — `partial: false`, `overallScore: 1`, `casesPassed: 1`, one case `sau-keep`, one arm `with`, one run of 13 turns, $0.323, and 11 of 11 graders passed including `co-plan`, `co-task`, `khong-viet-code`, `khong-sua-code`, and the judge's `moi-ac-co-task` (PASS PASS PASS).
- This is the first live evidence for the packet's own goal: sonnet, resuming after a KEEP, wrote `## Decisions` and a `Priority` column into the plan and `## Steps`, `## Failure Protocol`, and `- Oracle:` into the task, with every acceptance ID mapped to a task.
- Two grader designs were corrected by measurement, not argument. A `target: trace` regex matched the template text the Skill tool had just loaded, so all five content graders passed in an interrupted run where no file had been written; they now read the file itself, and because the harness resolves one exact path there (verified in the CLI: the file target reads a single path and does not glob) the prompt pins the task filename while `co-task` keeps measuring flat placement through its glob. And `input_match: "src/"` matched the `content` field of a Write whose plan cited `src/auth.js`, so both no-code guards now anchor on the `file_path` field.
- Review: fresh-context reviewer, two rounds. Round 1 FAIL for one Critical and one blocking Medium: proving the transcript resumes with `claude --resume <path>` had written the resumed session's own 333 KB log into the case directory, which nothing under `evals/specs/` gitignores and `git add -A` would have committed (scanned for credential patterns with zero hits, removed without further reading, and the trap is recorded in Step 6); and three Steps quoted text that was not on disk. Round 2 PASS after those, plus an `Edit` guard, a summarizer deduplication, one standard for the three scope words, a `|| true` on a filtered pipe, and split gap messages.
- Open limitations, none blocking, all for GATE-DONE: (1) both no-code guards require a `/` before `src/`, so a relative `"file_path":"src/x.js"` would slip past — unverified, since only a paid run that writes there could settle it; (2) pinning the task filename makes the three task-content graders an AND with obeying that name, so a renamed file would read as a missing section — read `report.html` before blaming the skill; (3) the `evals/run.sh` citations in Ownership shifted with this task's own edits and will be refreshed once before GATE-DONE together with the `run-skill-self-tests.mjs` ones; (4) `co-task`'s glob may or may not cross a directory separator, so a nested `tasks/` packet might pass it — only a paid run could settle that.
