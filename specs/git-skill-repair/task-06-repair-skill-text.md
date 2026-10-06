# Task 06 — The skill's worktree and commit text is repaired

Status: done

## Outcome
`cf:git` tells the model to open, list, remove and prune worktrees with git alone and without losing uncommitted, ignored or unmerged work, to check the checkout and scan for secrets before staging, to stage by group, to stop on a secret without touching the index, and to scan without the helper — and the source pins, the Codex mirror, a fallback replay and a weakening check all pass.

## Scope
- In: `SKILL.md` (worktree and cleanup lines, secret-scan section, errors table), `references/worktree-blueprint.md`, `references/commit-protocols.md`, `references/finish-branch.md` only where it contradicts the lifecycle, the self-test pins, and two new scripts under `packages/spec/scripts/`.
- Out: `pr`/`push` flows beyond "current branch only, never `--force`", the scanner script, hooks, description and routing text, reinstalling `.claude/`.

## Coverage
- CP-04
- CP-05

## Ownership
- Modify: `packages/spec/src/claude/skills/git/SKILL.md`
- Modify: `packages/spec/src/claude/skills/git/references/worktree-blueprint.md`
- Modify: `packages/spec/src/claude/skills/git/references/commit-protocols.md`
- Modify: `packages/spec/src/claude/skills/git/references/finish-branch.md` (only if it contradicts the lifecycle)
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `packages/spec/scripts/check-git-fallback.sh`, `packages/spec/scripts/weaken-git-pins.sh`
- Read: `packages/spec/bin/__tests__/codex-native.test.js` (`:1555-1569`: exact list of source files containing `AskUserQuestion`; `git/SKILL.md` already holds one), `packages/spec/src/claude/scripts/scan-staged-secrets.cjs`

## Steps
1. Worktree blueprint. Keep Steps 1-5 and the pinned text (`"$TARGET_DIR" "$BASE_BRANCH"`, the hydration loop, `--exclude 'session-state/'`, `--exclude 'worktrees/'`, "from the current branch"). Replace the "never nested" rule by D-02. Replace the `||` at `:36` by explicit branches: the directory exists → stop and ask; the branch name exists → ask whether to reuse it (`git worktree add <dir> <branch>`) or choose a new name; never mask a `git` error. Add one line: Orca, Herdr and Claude Code's host worktree are optional shortcuts, never required. Add one sentence: a worktree holds one specs packet and the new session starts in that directory. Add the **lifecycle**, with exactly these rules:
   - list: `git worktree list --porcelain`;
   - remove `<dir>`: run `git -C <dir> status --porcelain --ignored` (ignore entries under the hydrated `.claude/`, `.codex/`, `.agents/`) and `git -C <dir> log --oneline <base>..HEAD` (`<base>` = the branch the worktree was cut from, else the integration branch); clean → `git worktree remove <dir>` without `--force`; any output → show it and ask for the typed confirmation `remove <dir-name>`;
   - prune: an entry marked `prunable` is removed with `git worktree prune`; never `rm -rf` a worktree directory;
   - branches: delete with `git branch -d <branch>`; `-D` only after the user typed `delete <branch>`; "merged" means the branch is listed by `git branch --merged <base>`;
   - never run `git clean -fdx` from the repository root while a nested worktree exists.
2. `SKILL.md`: point the `worktree` and cleanup lines at the lifecycle; in the secret section add the **fallback** used when `.claude/scripts/scan-staged-secrets.cjs` is absent, as one bash block between the markers `<!-- fallback-scan:start -->` and `<!-- fallback-scan:end -->`, in this contract: runs on bash 3.2 and BSD awk with no bash 4 feature; scans the added lines of `git diff HEAD -U0` and the lines of every untracked file; reports `file:line:class` and nothing else (never the line, value, or context); classes: `assignment` (a name containing `api_key`, `apikey`, `secret`, `password`, `passwd`, `token`, `private_key`, any case, then optional spaces, `=` or `:`, optional spaces, and a value that is either a quoted string — single, double or backtick quotes — with at least 12 characters between the quotes that does not start with `$`, `<` or `process.env`, or an unquoted single token of `[A-Za-z0-9+/_=-]` with at least 16 characters; a value containing a space, `.`, `(` or `)` outside quotes is not a token), `sk-prefix` (`sk-` followed by `[A-Za-z0-9_-]`, 20 characters or more in all), `gh-prefix` (`gh` + one of `p o s u r` + `_` followed by `[A-Za-z0-9]`, 20 or more in all), `bearer` (`Bearer ` followed by 20 or more of `[A-Za-z0-9._-]`), `private-key-block` (a `-----BEGIN … PRIVATE KEY-----` line); prose such as `// tokens: refresh every thirty minutes`, an empty value, `const password = config.get("db")`, `pw = process.env.PASSWORD` and `secret = $SECRET_FROM_ENV` never match. Keep the existing rule for an untracked secret (`.gitignore`) and for a tracked one (stop, rotate, ask); make "stop" mean the order of D-10: no `git reset`, `git restore --staged` or `git rm --cached` before the user answers.
3. `commit-protocols.md`: replace the opening `git add -A` by: confirm `git rev-parse --show-toplevel` and `git branch --show-current` match the target before staging (a prior `cd` or `git -C <target>` is acceptable only after such a check); scan before staging (fallback or helper per D-10); stage by group with explicit paths; nothing staged → exit cleanly. Replace the `git rm --cached` instruction by the stop rule of Step 2. Add: use no `mapfile`, `readarray`, `declare -A`, `${var,,}` or `&>>` (macOS ships bash 3.2); push only the current branch, never `--force`. Put the sentences that forbid `git add -A` and `git rm --cached` in `SKILL.md`, not in `commit-protocols.md`. Do not write the string `AskUserQuestion` in any file under `references/`.
4. `finish-branch.md`: read it against the lifecycle; change only a line that contradicts it (for example the worktree removal rule at `:49`); otherwise leave it byte-identical.
5. Self-test: keep the pins at `run-skill-self-tests.mjs:5009-5030` passing; add pins for D-02, each lifecycle rule, the confirmation phrases, the absence of a line starting with `git add -A` and of `git rm --cached` in `commit-protocols.md`, the checkout check, the scan-before-stage order, the fallback markers, and the bash 3.2 note.
6. `check-git-fallback.sh`: extract the block between the markers, run it with `/bin/bash` in a `mktemp -d` repository holding: positive shapes (a quoted key built from pieces, a `ghp_`-style token, a `Bearer` string, a private-key header, an unquoted assignment) and negatives (the word `tokens` in a comment, `// tokens: refresh every thirty minutes`, `password: ""`, `const password = config.get("db")`, `pw = process.env.PASSWORD`, `secret = $SECRET_FROM_ENV`); exit 0 only when stdout is exactly `file:line:class` lines for the positives, contains no 20-character value, and is silent for the negatives.
7. `weaken-git-pins.sh`: build a light copy in `mktemp -d` — `rsync -a --exclude node_modules packages/spec <tmp>/packages/`, plus `README.md`, `docs/` and `plans/` (the static pins read `../../README.md`, `../../docs/…`, `../../plans/…`), then `git init -q` there (the static section resolves a git root); in the copy run `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`, which must exit 0 unweakened (replayed 2026-10-02: 627 focused static tests, 11 MB copy). For each new pin remove its sentence from the copy's skill text and require the same command to exit non-zero; exit 0 only when the unweakened copy passes and every weakened copy fails. The full self-test is not used here: it needs `node_modules` and a real git root, and a copy of the whole tree still showed 5 failures in 525 tests (replayed).

## Acceptance
- AC-04, AC-05, AC-06, AC-07, AC-08: `pnpm --dir packages/spec test`, `node --test packages/spec/bin/__tests__/codex-native.test.js` and `package-inventory.test.js` exit 0; `commit-protocols.md` has no line starting with `git add -A` and no `git rm --cached`; `check-git-fallback.sh` and `weaken-git-pins.sh` exit 0.

## Dependencies
- task-05-measure-baseline.md

## Verification Plan
- Command: `pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/codex-native.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js && [ "$(grep -c '^git add -A' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && [ "$(grep -c 'git rm --cached' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && ! grep -rn 'AskUserQuestion' packages/spec/src/claude/skills/git/references && grep -q 'git worktree prune' packages/spec/src/claude/skills/git/references/worktree-blueprint.md && bash packages/spec/scripts/check-git-fallback.sh && bash packages/spec/scripts/weaken-git-pins.sh`
- Named probe: the new `cf:git …` entries of `run-skill-self-tests.mjs`; the `git/SKILL.md` snippet and `AskUserQuestion` list checks of `codex-native.test.js`; `package-inventory.test.js` parity; `check-git-fallback.sh`; `weaken-git-pins.sh`.
- Reachability: source level (the written contract) plus the fallback block executed on bash 3.2; live-model behaviour is task 07's measurement. The weakening runs on a light `mktemp -d` copy with `--static-only`, never on tracked bytes.
- Oracle: exit 0 with non-zero test counts (the weakening script prints `unweakened pass, <k>/<k> weakened copies fail`); both `grep -c` print 0; no `AskUserQuestion` under `references/`; the fallback prints only `file:line:class` for the positive shapes and nothing for the negatives; every weakened copy fails the self-test.
- Counterexample: a blueprint that still says "never nested" without D-02, a `commit-protocols.md` that still starts with `git add -A`, a fallback that prints a value or fires on `tokens`, a removed hydration line, a worktree remove that checks only `status --porcelain` (the pin names `--ignored`), or a Codex mirror whose text drifts each fail a probe.
- Artifacts: none; weakening copies are ephemeral and removed.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Reopened — 2026-10-02 (user decision)
Reason: the four after-cells of task 07 showed in the kept traces (runs 1, 3, 14) that Claude Code substitutes `$0` … `$9` (and `$ARGUMENTS`) in a skill body with the invocation arguments, so the model saw `commit` where the fallback scan block's awk had `$0`, and `$3`. The block stayed correct as bytes and in `check-git-fallback.sh`, but it is not what the model reads. Repair: the awk block in `SKILL.md` now uses `$(0)` and `$(3)` (valid awk, same meaning, no dollar followed by a digit); four new pins (`SKILL.md` and the three `references/` files) forbid `$<digit>`, `${<digit>` and `$ARGUMENTS` with a regex, and `weaken-git-pins.sh` plants each forbidden form (21 pins, 66 of 66 weakened copies fail; `check-git-fallback.sh` passes on bash 3.2.57). The Receipt below is rewritten once, at the end of task 07, after the full Command is run on the final tree.

## Receipt

Verification: PASS
Command: pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/codex-native.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js && [ "$(grep -c '^git add -A' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && [ "$(grep -c 'git rm --cached' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && ! grep -rn 'AskUserQuestion' packages/spec/src/claude/skills/git/references && grep -q 'git worktree prune' packages/spec/src/claude/skills/git/references/worktree-blueprint.md && bash packages/spec/scripts/check-git-fallback.sh && bash packages/spec/scripts/weaken-git-pins.sh
Exit: 0
Base: a358887ff1989a3c11813d755c53991736413609
Head: 08b4a59dcf520b41c1d11f3fe2854add5b07908679e7e9d1f28ba5b26744114c
```text
$ pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/codex-native.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js && [ "$(grep -c '^git add -A' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && [ "$(grep -c 'git rm --cached' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && ! grep -rn 'AskUserQuestion' packages/spec/src/claude/skills/git/references && grep -q 'git worktree prune' packages/spec/src/claude/skills/git/references/worktree-blueprint.md && bash packages/spec/scripts/check-git-fallback.sh && bash packages/spec/scripts/weaken-git-pins.sh
# [2 output lines omitted: they quote the name of a test about unfilled template markers, which the receipt validator rejects anywhere in a Receipt; the run printed them and exited 0]

> @haposoft/cafekit@0.16.8 test /Users/nghialuutrung/Desktop/cafekit-fix-git-skill-repair/packages/spec
> node scripts/run-skill-self-tests.mjs

✔ cf:specs process-task status checker rejects 10 semantic weakenings
✔ cf:specs implementation-readiness checker rejects 30 gate-specific source mutations
✔ cf:specs adaptive coverage contract is complete and monotonic; bundle deltas: src/claude/skills/specs/SKILL.md -20, src/claude/skills/specs/references/review.md +5, src/claude/skills/specs/references/templates.md +10; total 745/750
✔ cf:specs adaptive coverage checker rejects 30 semantic weakenings
✔ cf:specs consumers load Steps and Failure Protocol; rejects 5 weakenings
✔ cf:brainstorm proportional routing contract is complete and bounded; src/claude/skills/brainstorm/SKILL.md=209 (+21), src/claude/skills/brainstorm/references/question-framework.md=170 (-62), src/claude/agents/brainstormer.md=69 (-17); total 448/506
✔ cf:brainstorm proportional routing checker rejects semantic weakenings; count=70
✔ cf:brainstorm adaptive-depth contract is complete and bounded; groups=10
✔ cf:brainstorm adaptive-depth checker rejects semantic weakenings; count=43
✔ cf:develop plan-native continuous contract is complete and bounded
✔ cf:develop plan-native checker rejects semantic weakenings
✔ cf:test plan-native proof contract is complete and bounded
✔ cf:test plan-native checker rejects semantic weakenings
✔ cf:debug adaptive incident contract is complete and bounded
✔ cf:debug adaptive incident checker rejects 9 semantic weakenings
✔ cf:debug report is proportional to its stated depth and shared with its agent
✔ cf:debug proportional checker rejects 20 weakenings
✔ cf:debug agent points to the skill's two gates
✔ cf:debug agent-gates checker rejects 7 weakenings
✔ cf:fix adaptive contract is complete and bounded
✔ cf:fix checker rejects 30 semantic weakenings
✔ cf:docs adaptive contract is complete and bounded
✔ cf:docs checker rejects 18 semantic weakenings
✔ cf:research adaptive evidence contract is complete and bounded
✔ cf:research checker rejects semantic weakenings; count=25
✔ cf:route proportional installed-capability contract is complete and bounded
✔ cf:route checker rejects semantic routing weakenings
✔ cf:loop bounded experiment contract is complete and fail-closed
✔ cf:loop checker rejects unsafe semantic weakenings; count=30
✔ Specs v3 flat layout, the three gates, review, and receipt contracts survive mutations
✔ Specs v2.1 vocabulary is isolated under hierarchical Legacy sections
✔ Claude-to-Codex projection rejects Claude-only tool vocabulary
✔ Specs v2.1 task structure and ownership table are canonical
✔ Specs v2.1 V definitions expose the validator grammar and proof roles
✔ Specs v2.1 machine state and semantic receipt vocabulary are canonical
✔ Specs v2.1 canonical authoring source exposes no downgrade receipt
✔ Full runner preserves exact Node failure counts and locations

[skill-test] static semantic checks
✔ cf:specs hard output contract requires the flat packet
✔ spec-maker emits only the flat planning packet
✔ installer syncs spec-state template and drops init template
✔ installer writes CafeKit version metadata
✔ installer offers Codex as a native split-root runtime
✔ Codex split roots keep generated skill files locally ignored
✔ installer maps Claude gitignore template to dotfile
✔ Claude migration manifest includes gitignore template
✔ Claude gitignore template ignores generated session state
✔ installer root gitignore ignores runtime folders
✔ cf:specs and spec-maker never auto-dispatch Develop
✔ cf:specs frontmatter exposes only feature-description input
✔ spec-maker emits a flat packet and stops at handoff
✔ cf:ask skill answers questions with repo-first evidence
✔ cf:ask template captures answer evidence and gaps
✔ cf:ask is packaged from the ask directory and the question directory is retired
✔ cf:fix is packaged from the fix directory and the hotfix directory is retired
✔ cf:specs review requires evidence, fresh context, and bounded findings
✔ cf:specs review gives GATE-REVIEW ownership to the user and sweeps every edit
✔ cf:specs requirements template has no SDD phase marker
✔ cf:specs flow is gated GATE-SCOPE to GATE-DONE and process-first
✔ parallel-waves reference keeps single-writer, fallback, cap, and cherry-pick recipe
✔ develop SKILL wires --parallel to parallel-waves and keeps sequential default
✔ implementer is single-track with process-first and legacy state prohibition
✔ orchestrator sanctions worktree parallelism with single-writer rule and cap
✔ parallel waves isolate worktrees and retain blocked recovery state
✔ runtime template documents develop.parallel escape hatch
✔ cf:specs templates trace acceptance criteria to flat tasks and proof
✔ cf:specs plan template carries the queue-ready contract marker on line two
✔ cf:specs templates carry EARS, Example Mapping, and edge-case saturation
✔ cf:specs keeps human decisions at exactly the three named gates
✔ legacy kernel task template keeps the Specs v2.1 plan contract
✔ spec validator enforces Specs v2.1 task-plan sections
✔ spec validator blocks complex ready state before validation
✔ cf:specs inline receipt is executable and provenance-bound
✔ spec-maker separates planning from implementation and proof
✔ cf:develop scouts reachability and enforces task scope
✔ cf:develop supports explicit flash mode
✔ cf:develop makes implementation notes opt-in
✔ cf:develop implementation notes template is self-contained and block-based
✔ cf:develop quality gate separates proof, review, and closeout owners
✔ cf:develop quality gate has flash bypass semantics
✔ process-first Develop and Sync keep proof ownership explicit with isolated Legacy vocabulary
✔ cf:scout uses a focused local fast path before delegation
✔ cf:scout delegation requires permission runtime support and independent scopes
✔ quality gate uses shared verdicts instead of numeric scores
✔ inspect runtime config has no legacy Gemini model key
✔ hotfix review cycle consumes severity verdicts
✔ code-auditor speaks the shared verdict surface
✔ test-runner performs scope and runtime reachability audits
✔ cf:test supports spec-aware feature testing
✔ cf:fix is deterministic scout-first without mode selection
✔ cf:fix quick path never skips scout or diagnosis
✔ cf:fix enforces no-side-effect gate with user options
✔ cf:fix references are local and not stale debugger paths
✔ cf:git worktree branches from the current branch and hydrates ignored runtime folders
✔ cf:git worktree blueprint never hard-codes main as the base
✔ cf:git commit scans the working tree before staging and stops everything on a hit
✔ cf:git commit never stages everything
✔ cf:git commit leaves the index alone until the user answers
✔ cf:git commit adds no AI attribution unless asked
✔ cf:git commit confirms the target checkout before staging
✔ cf:git commit never prints a secret before or after the scan
✔ cf:git worktree is git-only with optional shortcuts and a lifecycle
✔ cf:git secret rule leaves the untracked and tracked choices to the user
✔ cf:git worktree blueprint keeps siblings the default and nested paths user-named
✔ cf:git worktree blueprint asks on an existing directory or branch
✔ cf:git worktree blueprint lifecycle never loses work
✔ cf:git worktree blueprint names the optional shortcuts and the one-packet rule
✔ cf:git commit protocol checks the checkout, scans, then stages explicit paths
✔ cf:git commit protocol avoids bash 4 features and attribution trailers
✔ cf:git commit output shows the checkout and the scan before the staged line
✔ cf:git helper scan runs after staging as a second look
✔ cf:git worktree blueprint stops on an existing directory or branch instead of running on
✔ cf:git SKILL.md holds no dollar-digit or $ARGUMENTS (Claude Code substitutes them with the invocation arguments)
✔ cf:git references/commit-protocols.md holds no dollar-digit or $ARGUMENTS (Claude Code substitutes them with the invocation arguments)
✔ cf:git references/finish-branch.md holds no dollar-digit or $ARGUMENTS (Claude Code substitutes them with the invocation arguments)
✔ cf:git references/worktree-blueprint.md holds no dollar-digit or $ARGUMENTS (Claude Code substitutes them with the invocation arguments)
✔ cf:fix prevention gate points back to side-effect sweep
✔ cf:fix review cycle uses pause conditions not mode selection
✔ cf:debug is diagnosis-only and read-only for product code
✔ cf:debug enforces scout-first before hypotheses
✔ cf:debug blocks hotfix handoff when root cause is unknown
✔ cf:debug references installed debugger manuals
✔ Claude runtime template exposes process-first Specs truth
✔ Codex runtime template exposes process-first Specs truth
✔ Claude wrapper keeps runtime delta without template Language or Addressing
✔ all runtime instruction templates carry local venv guidance
✔ Codex instruction template avoids global Claude skills path
✔ Codex warning describes local hook bypass risk
✔ state cache carries full project, session, and spec identity
✔ shared resolver keeps explicit target and fail-closed ambiguity
✔ rules hooks stay silent when runtime.json is absent
✔ CafeKit skill routing workflow rule maps core flows
✔ CafeKit skill routing domain rule maps core and optional skills
✔ cf:docs skill is present in the optional document bundle
✔ cf:docs --reconstruct keeps as-is evidence contract
✔ cf:docs --reconstruct reference defines output and human review gate
✔ cf:docs --reconstruct templates keep evidence and overview starters
✔ cf:docs --reconstruct overview template is self-contained
✔ cf:docs normal docs references keep init update summarize phases
✔ cf:docs --init reference keeps scout author validate discipline
✔ cf:docs --update reference reads existing docs before surgical updates
✔ cf:docs --summarize reference avoids broad codebase scans by default
✔ docs validator accepts configured docs root argument
✔ reconstruct validator is packaged and enforces evidence IDs
✔ reconstruct validator requires overview and bundle registry
✔ CafeKit no longer installs automatic skill router hook
✔ strategist keeps the AgentKit autonomy contract and claims no execution proof
✔ model escalation reaches the strategist before the user and grants no authority
✔ completion policy states both receipt modes and the invention limit
✔ Codex carries the same completion policy, since it does not auto-load Claude rules
✔ workflow rule points at one home for the binding policy instead of copying it
✔ Specs machine boundary records what the gate cannot detect
✔ installer architecture documents omp coverage and gaps
✔ installer architecture documents grok compatibility
✔ installer architecture documents completion gate identity
✔ installer architecture documents orca awareness
✔ installer architecture documents hook portability
✔ CafeKit runtime config drives shared hook config
✔ CafeKit migration manifest excludes removed skill router files
✔ CafeKit installer cleans obsolete skill router runtime and settings hooks
✔ CafeKit rules hook injects only project-specific reminders
✔ docs sync respects runtime docs path
✔ cf:specs SKILL stays lean after slim-flow diet
✔ cf:develop SKILL stays within directional context budget
✔ cf:specs complete shipped bundle stays at or below 750 lines
✔ process-first Develop and Sync core stays at or below 400 lines
✔ docs-sync.cjs has no shouting banners
✔ workflow routing keeps proportional and authority boundaries
✔ usage hook reads runtime config from hook cwd
✔ statusline layout contract keeps registry, fallback, cost gate, and weekly anchors
✔ repository guide documents statusline configuration
✔ package guide documents statusline configuration
✔ statusline colors respect runtime config
✔ templates expose all five EARS forms and measurable wording
✔ templates route ambiguity without guessing outcomes
✔ review contract keeps evidence-backed saturation and runtime-only third round
✔ task template Compact core is per-surface parsed (behavioral)
✔ design template Compact core is per-surface parsed (behavioral)
✔ Specs skill keeps scope and proof boundaries explicit
✔ review keeps user decisions and the bounded paper stop
✔ spec-maker keeps planning separate from dispatch and proof
✔ specs-usage-guide documents the flat packet and canonical inline receipt
✔ specs-usage-guide documents adaptive routing without timing claims
✔ specs-usage-guide documents plan-native Develop without timing or live-adherence claims
✔ Codex installed projection uses Codex paths (behavioral, temp fixture)
✔ benchmark tuning targets are per-surface explicit (advisory, not waiver)
✔ specs-usage-guide teaches Develop and Sync without leaking v2.1 vocabulary
✔ ported review rule keeps decision precedence without reversal loopholes
✔ ported process rule keeps ownership, port, and cleanup discipline
✔ ported rules survive the Codex transform as rename-only
✔ Specs primary flow is file-first while legacy kernel remains isolated

[skill-test] skill catalog checks
✔ skill catalog script lists installed CafeKit skills
✔ skill catalog JSON mode is machine-readable

[skill-test] installer migration fixtures
✔ settings template and manifest agree on 15 hooks
✔ installer migrates old skill-router runtime to rule-based routing
✔ installer upgrade preserves configured locale.responseLanguage

[skill-test] instruction install fixtures
✔ Wave 1 real installs cover both runtimes, missing-runtime silence, vi localization, and combined idempotence

[skill-test] spec artifact validator fixtures
✔ spec validator accepts valid fixture
✔ spec validator rejects triage-like invalid fixture
✔ spec validator rejects copied canonical contract blocks in Specs v2 tasks

[skill-test] reconstruct docs validator fixtures
✔ reconstruct validator accepts valid fixture
✔ reconstruct validator rejects incomplete evidence bundle

[skill-test] package Node tests
TAP version 13
# Subtest: R1.14 precondition: the real legacy-bridge artifact exists and matches its exact schema before any other assertion
ok 1 - R1.14 precondition: the real legacy-bridge artifact exists and matches its exact schema before any other assertion
  ---
  duration_ms: 24.275916
  type: 'test'
  ...
# Subtest: R1.14 negative: an absent or malformed legacy-bridge artifact fails the precondition nonzero
ok 2 - R1.14 negative: an absent or malformed legacy-bridge artifact fails the precondition nonzero
  ---
  duration_ms: 191.007792
  type: 'test'
  ...
# Subtest: D1: reserved control-plane paths are excluded from the protected allowlist before the prefix match
ok 3 - D1: reserved control-plane paths are excluded from the protected allowlist before the prefix match
  ---
  duration_ms: 0.265125
  type: 'test'
  ...
# Subtest: boot-window absence: loadBaselineAuthority/loadFailureLedger read the real checkout state as legitimate absent, not malformed
ok 4 - boot-window absence: loadBaselineAuthority/loadFailureLedger read the real checkout state as legitimate absent, not malformed
  ---
  duration_ms: 0.552792
  type: 'test'
  ...
# Subtest: R1.3: assertNoBaseOverrideEnv rejects only the exact six reserved CAFEKIT_ keys, by name only, never a name-shape guess
ok 5 - R1.3: assertNoBaseOverrideEnv rejects only the exact six reserved CAFEKIT_ keys, by name only, never a name-shape guess
  ---
  duration_ms: 0.981458
  type: 'test'
  ...
# Subtest: C1/R1.1/R1.2: benchmark_remediation is refused for a non-framework_regression class without blocking a distinct authorized_evolution
ok 6 - C1/R1.1/R1.2: benchmark_remediation is refused for a non-framework_regression class without blocking a distinct authorized_evolution
  ---
  duration_ms: 235.727916
  type: 'test'
  ...
# Subtest: C1: neither variant may embed a release-candidate lifecycle binding digest
ok 7 - C1: neither variant may embed a release-candidate lifecycle binding digest
  ---
  duration_ms: 175.615458
  type: 'test'
  ...
# Subtest: C10/R1.3: absent authority fails closed for every command except bootstrapBaseline
ok 8 - C10/R1.3: absent authority fails closed for every command except bootstrapBaseline
  ---
  duration_ms: 167.957167
  type: 'test'
  ...
# Subtest: C10/R1.5: computeCandidateDigest binds exactly the C9 field set, non-circular
ok 9 - C10/R1.5: computeCandidateDigest binds exactly the C9 field set, non-circular
  ---
  duration_ms: 1.477917
  type: 'test'
  ...
# Subtest: C14/R1.8: bootstrapBaseline refuses before the seed PASS exists, and refuses base/head mismatches
ok 10 - C14/R1.8: bootstrapBaseline refuses before the seed PASS exists, and refuses base/head mismatches
  ---
  duration_ms: 856.881708
  type: 'test'
  ...
# Subtest: C10/R1.3: bootstrap state with empty derived protected paths always exits 2 (never a valid no-change bootstrap)
ok 11 - C10/R1.3: bootstrap state with empty derived protected paths always exits 2 (never a valid no-change bootstrap)
  ---
  duration_ms: 453.249167
  type: 'test'
  ...
# Subtest: REGRESSION round3 (critical): a committed bootstrap authority record hand-edited out-of-band (baselineCommit swapped) fails closed on the next normal use, before it can create/advance a freeze
ok 12 - REGRESSION round3 (critical): a committed bootstrap authority record hand-edited out-of-band (baselineCommit swapped) fails closed on the next normal use, before it can create/advance a freeze
  ---
  duration_ms: 1022.011084
  type: 'test'
  ...
# Subtest: full lifecycle: bootstrap -> authorized_evolution freeze -> publish -> clean no_protected_change -> benchmark_remediation + ledger -> crash/retry -> resolveFailure self-verification
ok 13 - full lifecycle: bootstrap -> authorized_evolution freeze -> publish -> clean no_protected_change -> benchmark_remediation + ledger -> crash/retry -> resolveFailure self-verification
  ---
  duration_ms: 3832.128
  type: 'test'
  ...
# Subtest: REGRESSION (critical): advanceBaseline event (A) physically corrupted-by-seam on a genuinely new first publish fails closed via read-after-write verification -- event (B) never runs and authority never rotates
ok 14 - REGRESSION (critical): advanceBaseline event (A) physically corrupted-by-seam on a genuinely new first publish fails closed via read-after-write verification -- event (B) never runs and authority never rotates
  ---
  duration_ms: 1114.554833
  type: 'test'
  ...
# Subtest: I13: resolveFailure refuses a mismatched-digest replay for an already-resolved id, never coercing it
ok 15 - I13: resolveFailure refuses a mismatched-digest replay for an already-resolved id, never coercing it
  ---
  duration_ms: 718.795541
  type: 'test'
  ...
# Subtest: C15/R1.9: loadFailureLedger/assertFailureLedgerUsable fail closed on a malformed or out-of-band-edited ledger, with no bypass
ok 16 - C15/R1.9: loadFailureLedger/assertFailureLedgerUsable fail closed on a malformed or out-of-band-edited ledger, with no bypass
  ---
  duration_ms: 476.86575
  type: 'test'
  ...
# Subtest: C9/R1.10: any accepted C15 ledger event since the last freeze makes that freeze stale
ok 17 - C9/R1.10: any accepted C15 ledger event since the last freeze makes that freeze stale
  ---
  duration_ms: 1200.326458
  type: 'test'
  ...
# Subtest: I13: resolveFailure refuses an id absent from the persisted receipt, a digest mismatch, and a not-released authority
ok 18 - I13: resolveFailure refuses an id absent from the persisted receipt, a digest mismatch, and a not-released authority
  ---
  duration_ms: 1401.208542
  type: 'test'
  ...
# Subtest: REGRESSION (critical): verifyFreezeManifest fails closed when a protected path is added or removed after freeze creation
ok 19 - REGRESSION (critical): verifyFreezeManifest fails closed when a protected path is added or removed after freeze creation
  ---
  duration_ms: 1501.008875
  type: 'test'
  ...
# Subtest: REGRESSION (high): advanceBaseline rejects a path-traversal, absolute, or symlinked artifactPath -- never a naive string-prefix check
ok 20 - REGRESSION (high): advanceBaseline rejects a path-traversal, absolute, or symlinked artifactPath -- never a naive string-prefix check
  ---
  duration_ms: 1902.057959
  type: 'test'
  ...
# Subtest: REGRESSION (medium): createFreezeManifest/verifyFreezeManifest fail closed when baselineCommit is not an ancestor of current HEAD
ok 21 - REGRESSION (medium): createFreezeManifest/verifyFreezeManifest fail closed when baselineCommit is not an ancestor of current HEAD
  ---
  duration_ms: 745.805375
  type: 'test'
  ...
# Subtest: REGRESSION (medium): authorized_evolution refuses a spec_ref reached through a symlinked ancestor directory
ok 22 - REGRESSION (medium): authorized_evolution refuses a spec_ref reached through a symlinked ancestor directory
  ---
  duration_ms: 181.646666
  type: 'test'
  ...
# Subtest: REGRESSION round2 (critical): verifyFreezeManifest/advanceBaseline reject a hand-edited freeze that narrows remediatedFailureIds via a self-recomputed candidateDigest; F1 stays blocking and authority never rotates
ok 23 - REGRESSION round2 (critical): verifyFreezeManifest/advanceBaseline reject a hand-edited freeze that narrows remediatedFailureIds via a self-recomputed candidateDigest; F1 stays blocking and authority never rotates
  ---
  duration_ms: 2027.712459
  type: 'test'
  ...
# Subtest: REGRESSION round2 (critical): verifyFreezeManifest rejects a freeze whose changedPaths smuggles an extra protected path not covered by its own remediatedFailureIds opened.paths union
ok 24 - REGRESSION round2 (critical): verifyFreezeManifest rejects a freeze whose changedPaths smuggles an extra protected path not covered by its own remediatedFailureIds opened.paths union
  ---
  duration_ms: 1786.163208
  type: 'test'
  ...
# Subtest: REGRESSION round2 (critical): verifyFreezeManifest rejects a forged baselineCommit even when candidateDigest is recomputed to stay self-consistent
ok 25 - REGRESSION round2 (critical): verifyFreezeManifest rejects a forged baselineCommit even when candidateDigest is recomputed to stay self-consistent
  ---
  duration_ms: 891.353792
  type: 'test'
  ...
# Subtest: REGRESSION round2 (critical): advanceBaseline independently re-verifies the current freeze before trusting it -- a freeze staled only by an intervening real C15 ledger event is rejected, never just candidateDigest-matched through
ok 26 - REGRESSION round2 (critical): advanceBaseline independently re-verifies the current freeze before trusting it -- a freeze staled only by an intervening real C15 ledger event is rejected, never just candidateDigest-matched through
  ---
  duration_ms: 1324.605292
  type: 'test'
  ...
# Subtest: REGRESSION round2 (high): advanceBaseline rejects an artifactPath redirected via a symlinked ancestor to another directory still inside the project root
ok 27 - REGRESSION round2 (high): advanceBaseline rejects an artifactPath redirected via a symlinked ancestor to another directory still inside the project root
  ---
  duration_ms: 1018.228917
  type: 'test'
  ...
# Subtest: REGRESSION round2 (critical): advanceBaseline rejects an artifactPath when packages/spec/.cafekit-release/ itself is a symlink, even to a directory still inside the project root
ok 28 - REGRESSION round2 (critical): advanceBaseline rejects an artifactPath when packages/spec/.cafekit-release/ itself is a symlink, even to a directory still inside the project root
  ---
  duration_ms: 1054.801
  type: 'test'
  ...
# Subtest: REGRESSION round2 (critical): advanceBaseline rejects an artifactPath redirected by a symlink planted inside .cafekit-release/ to another real subdir still inside the release tree
ok 29 - REGRESSION round2 (critical): advanceBaseline rejects an artifactPath redirected by a symlink planted inside .cafekit-release/ to another real subdir still inside the release tree
  ---
  duration_ms: 1005.397584
  type: 'test'
  ...
# Subtest: REGRESSION round4 (critical): a committed released C10 record hand-edited in place (same generation) fails closed even after an unrelated later commit
ok 30 - REGRESSION round4 (critical): a committed released C10 record hand-edited in place (same generation) fails closed even after an unrelated later commit
  ---
  duration_ms: 1695.64725
  type: 'test'
  ...
# Subtest: REGRESSION round4 (critical): a committed C15 ledger record hand-edited in place (same generation) fails closed even after an unrelated later commit
ok 31 - REGRESSION round4 (critical): a committed C15 ledger record hand-edited in place (same generation) fails closed even after an unrelated later commit
  ---
  duration_ms: 677.725208
  type: 'test'
  ...
# Subtest: REGRESSION round5 (critical): a C10 committed generation jump with a schema-valid record and fabricated previousDigest rejects
ok 32 - REGRESSION round5 (critical): a C10 committed generation jump with a schema-valid record and fabricated previousDigest rejects
  ---
  duration_ms: 441.807625
  type: 'test'
  ...
# Subtest: REGRESSION round5 (high): a C15 committed generation jump with a fully shape-valid event count and fabricated previousDigest rejects
ok 33 - REGRESSION round5 (high): a C15 committed generation jump with a fully shape-valid event count and fabricated previousDigest rejects
  ---
  duration_ms: 621.365458
  type: 'test'
  ...
# Subtest: REGRESSION round5 (critical): a second uncommitted C15 named transition relative to the same committed predecessor is rejected before write, leaving file bytes unchanged
ok 34 - REGRESSION round5 (critical): a second uncommitted C15 named transition relative to the same committed predecessor is rejected before write, leaving file bytes unchanged
  ---
  duration_ms: 945.426084
  type: 'test'
  ...
# Subtest: a normal exact-plus-one uncommitted C15 named transition after a committed predecessor remains accepted
ok 35 - a normal exact-plus-one uncommitted C15 named transition after a committed predecessor remains accepted
  ---
  duration_ms: 703.719959
  type: 'test'
  ...
# Subtest: multiple uncommitted C15 named transitions remain accepted when there is no committed predecessor at all
ok 36 - multiple uncommitted C15 named transitions remain accepted when there is no committed predecessor at all
  ---
  duration_ms: 556.506084
  type: 'test'
  ...
# Subtest: REGRESSION round4 (critical): a shallow/ambiguous committed history fails closed instead of trusting the fetched HEAD as genesis
ok 37 - REGRESSION round4 (critical): a shallow/ambiguous committed history fails closed instead of trusting the fetched HEAD as genesis
  ---
  duration_ms: 812.55225
  type: 'test'
  ...
# Subtest: REGRESSION round6 (critical): a committed C10 authority git-rm-committed then recreated uncommitted is rejected, not trusted as a fresh first record
ok 38 - REGRESSION round6 (critical): a committed C10 authority git-rm-committed then recreated uncommitted is rejected, not trusted as a fresh first record
  ---
  duration_ms: 910.953333
  type: 'test'
  ...
# Subtest: REGRESSION round6 (critical): a committed C15 ledger git-rm-committed then recreated uncommitted is rejected, not trusted as a fresh first record
ok 39 - REGRESSION round6 (critical): a committed C15 ledger git-rm-committed then recreated uncommitted is rejected, not trusted as a fresh first record
  ---
  duration_ms: 594.566041
  type: 'test'
  ...
# Subtest: REGRESSION round6 (high): a protected regular file swapped to a symlink (type-change) enters D1 derivation and is gated without reading outside the root
ok 40 - REGRESSION round6 (high): a protected regular file swapped to a symlink (type-change) enters D1 derivation and is gated without reading outside the root
  ---
  duration_ms: 970.206542
  type: 'test'
  ...
# Subtest: REGRESSION round6 (critical): a second uncommitted C10 advanceBaseline call relative to the same committed predecessor is rejected before mutation, leaving bytes unchanged
ok 41 - REGRESSION round6 (critical): a second uncommitted C10 advanceBaseline call relative to the same committed predecessor is rejected before mutation, leaving bytes unchanged
  ---
  duration_ms: 1822.957458
  type: 'test'
  ...
# Subtest: REGRESSION round7 (high): a genuinely unmerged (git status U) protected path still enters D1 derivation and is gated without reading outside the root
ok 42 - REGRESSION round7 (high): a genuinely unmerged (git status U) protected path still enters D1 derivation and is gated without reading outside the root
  ---
  duration_ms: 1186.05725
  type: 'test'
  ...
# Subtest: REGRESSION round7 (critical): a committed C10 authority renamed away then renamed back to the reserved path is never trusted as first-ever provenance
ok 43 - REGRESSION round7 (critical): a committed C10 authority renamed away then renamed back to the reserved path is never trusted as first-ever provenance
  ---
  duration_ms: 885.92025
  type: 'test'
  ...
# Subtest: a fresh install registers every CafeKit hook under its own event
ok 44 - a fresh install registers every CafeKit hook under its own event
  ---
  duration_ms: 655.450292
  type: 'test'
  ...
# Subtest: a reinstall preserves user-added hooks instead of overwriting them
ok 45 - a reinstall preserves user-added hooks instead of overwriting them
  ---
  duration_ms: 1416.629875
  type: 'test'
  ...
# Subtest: --force-overwrite does not destroy hooks CafeKit did not author
ok 46 - --force-overwrite does not destroy hooks CafeKit did not author
  ---
  duration_ms: 1464.651
  type: 'test'
  ...
# Subtest: repeated installs never duplicate a CafeKit hook
ok 47 - repeated installs never duplicate a CafeKit hook
  ---
  duration_ms: 2405.975625
  type: 'test'
  ...
# Subtest: a hook the user moved to another event is not re-added to the one CafeKit chose
ok 48 - a hook the user moved to another event is not re-added to the one CafeKit chose
  ---
  duration_ms: 1256.891084
  type: 'test'
  ...
# Subtest: obsolete CafeKit hooks are pruned while similarly named foreign hooks stay
ok 49 - obsolete CafeKit hooks are pruned while similarly named foreign hooks stay
  ---
  duration_ms: 1326.010458
  type: 'test'
  ...
# Subtest: a malformed hooks.json is reported and left byte-identical, never overwritten
ok 50 - a malformed hooks.json is reported and left byte-identical, never overwritten
  ---
  duration_ms: 706.024625
  type: 'test'
  ...
# Subtest: a dry run reports the merge without writing hooks.json
ok 51 - a dry run reports the merge without writing hooks.json
  ---
  duration_ms: 460.136792
  type: 'test'
  ...
# Subtest: hooks.json stays outside the ownership manifest, like settings.json
ok 52 - hooks.json stays outside the ownership manifest, like settings.json
  ---
  duration_ms: 711.888583
  type: 'test'
  ...
# Subtest: Claude and Codex docs sync ignore committed Specs state but report source changes
ok 53 - Claude and Codex docs sync ignore committed Specs state but report source changes
  ---
  duration_ms: 1284.751208
  type: 'test'
  ...
# Subtest: Codex installed spec-state re-evaluates a standalone task when blocked becomes pending
ok 54 - Codex installed spec-state re-evaluates a standalone task when blocked becomes pending
  ---
  duration_ms: 1274.468208
  type: 'test'
  ...
# Subtest: Codex installed spec-state requires current canonical dependency proof and keys receipt mutations
ok 55 - Codex installed spec-state requires current canonical dependency proof and keys receipt mutations
  ---
  duration_ms: 5290.788583
  type: 'test'
  ...
# Subtest: Codex installed spec-state keeps unversioned pending packets out of Next with migration guidance
ok 56 - Codex installed spec-state keeps unversioned pending packets out of Next with migration guidance
  ---
  duration_ms: 1553.498333
  type: 'test'
  ...
# Subtest: Codex resolver ignores fenced workflow annotations and rejects fenced-only Status
ok 57 - Codex resolver ignores fenced workflow annotations and rejects fenced-only Status
  ---
  duration_ms: 606.3655
  type: 'test'
  ...
# Subtest: Codex resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles
ok 58 - Codex resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles
  ---
  duration_ms: 169.702
  type: 'test'
  ...
# Subtest: Codex privacy approval is exact, session-bound, and reusable within its window
ok 59 - Codex privacy approval is exact, session-bound, and reusable within its window
  ---
  duration_ms: 2490.791417
  type: 'test'
  ...
# Subtest: Codex privacy grant window is one hour and restarts at approval
ok 60 - Codex privacy grant window is one hour and restarts at approval
  ---
  duration_ms: 161.38825
  type: 'test'
  ...
# Subtest: Codex privacy hook parses native patch fields and move destinations
ok 61 - Codex privacy hook parses native patch fields and move destinations
  ---
  duration_ms: 633.580375
  type: 'test'
  ...
# Subtest: Codex inspect hook scans native shell commands and structured paths
ok 62 - Codex inspect hook scans native shell commands and structured paths
  ---
  duration_ms: 942.9785
  type: 'test'
  ...
# Subtest: Codex task scaffold hook blocks apply_patch Add File with stderr guidance
ok 63 - Codex task scaffold hook blocks apply_patch Add File with stderr guidance
  ---
  duration_ms: 306.468083
  type: 'test'
  ...
# Subtest: Codex completion gate cannot be bypassed from a nested cwd
ok 64 - Codex completion gate cannot be bypassed from a nested cwd
  ---
  duration_ms: 3484.009167
  type: 'test'
  ...
# Subtest: Codex completion gate validates explicit process-v3 inline Receipt
ok 65 - Codex completion gate validates explicit process-v3 inline Receipt
  ---
  duration_ms: 5376.612333
  type: 'test'
  ...
# Subtest: Codex process-v3 Receipt command must match the exact Verification Plan command
ok 66 - Codex process-v3 Receipt command must match the exact Verification Plan command
  ---
  duration_ms: 1673.938333
  type: 'test'
  ...
# Subtest: Codex recorded active feature turns the identity block into receipt validation
ok 67 - Codex recorded active feature turns the identity block into receipt validation
  ---
  duration_ms: 2074.883458
  type: 'test'
  ...
# Subtest: Codex process-v3 Stop ignores a completed packet when one packet remains active
ok 68 - Codex process-v3 Stop ignores a completed packet when one packet remains active
  ---
  duration_ms: 859.564416
  type: 'test'
  ...
# Subtest: Codex process-v3 Stop accepts two completed packets with valid Receipts
ok 69 - Codex process-v3 Stop accepts two completed packets with valid Receipts
  ---
  duration_ms: 3339.678
  type: 'test'
  ...
# Subtest: empty or forged Codex hook authority fails closed
ok 70 - empty or forged Codex hook authority fails closed
  ---
  duration_ms: 1412.749583
  type: 'test'
  ...
# Subtest: explicit Strict Codex completion ignores worker-writable proof strings and remains blocked
ok 71 - explicit Strict Codex completion ignores worker-writable proof strings and remains blocked
  ---
  duration_ms: 3030.165542
  type: 'test'
  ...
# Subtest: Codex state hook persists direct native event fields at project root
ok 72 - Codex state hook persists direct native event fields at project root
  ---
  duration_ms: 1303.481125
  type: 'test'
  ...
# Subtest: semantic review authority hook is registered only for SubagentStop on Claude and Codex
ok 73 - semantic review authority hook is registered only for SubagentStop on Claude and Codex
  ---
  duration_ms: 0.748292
  type: 'test'
  ...
# Subtest: Codex canonical receipt provenance requires both Base and Head
ok 74 - Codex canonical receipt provenance requires both Base and Head
  ---
  duration_ms: 5038.247417
  type: 'test'
  ...
# Subtest: Codex cache hardening: every done re-validated — mutation, deletion, malformed cache, unchanged valid
ok 75 - Codex cache hardening: every done re-validated — mutation, deletion, malformed cache, unchanged valid
  ---
  duration_ms: 13446.754792
  type: 'test'
  ...
# Subtest: Codex cache identity separates same-feature receipts from different roots
ok 76 - Codex cache identity separates same-feature receipts from different roots
  ---
  duration_ms: 2984.983833
  type: 'test'
  ...
# Subtest: Codex P0 regression: placeholder, explicit failure, artifact, symlink and invalid_specs
ok 77 - Codex P0 regression: placeholder, explicit failure, artifact, symlink and invalid_specs
  ---
  duration_ms: 36.064041
  type: 'test'
  ...
# Subtest: Codex adapter parity - phantom vectors via shared validator (r3)
ok 78 - Codex adapter parity - phantom vectors via shared validator (r3)
  ---
  duration_ms: 10.97475
  type: 'test'
  ...
# Subtest: installed Codex gate fails closed with a controlled decision when policy is missing or malformed
ok 79 - installed Codex gate fails closed with a controlled decision when policy is missing or malformed
  ---
  duration_ms: 998.190917
  type: 'test'
  ...
# Subtest: Codex adapter enforces declared task artifact SHA-256 with missing, invalid, and valid evidence
ok 80 - Codex adapter enforces declared task artifact SHA-256 with missing, invalid, and valid evidence
  ---
  duration_ms: 7078.193042
  type: 'test'
  ...
# Subtest: Codex privacy denies obfuscated secret reads, allows benign and runtime state
ok 81 - Codex privacy denies obfuscated secret reads, allows benign and runtime state
  ---
  duration_ms: 2531.420375
  type: 'test'
  ...
# Subtest: Codex privacy denies sensitive names it can resolve, allows pure indirection
ok 82 - Codex privacy denies sensitive names it can resolve, allows pure indirection
  ---
  duration_ms: 10846.075666
  type: 'test'
  ...
# Subtest: Codex privacy reads an inert heredoc body as prose, not shell
ok 83 - Codex privacy reads an inert heredoc body as prose, not shell
  ---
  duration_ms: 643.113875
  type: 'test'
  ...
# Subtest: Claude and Codex privacy lexers agree on literals, delimiters, and quote expansion
ok 84 - Claude and Codex privacy lexers agree on literals, delimiters, and quote expansion
  ---
  duration_ms: 7819.585875
  type: 'test'
  ...
# Subtest: Codex privacy handles dangling symlink to protected target (and allows benign/example)
ok 85 - Codex privacy handles dangling symlink to protected target (and allows benign/example)
  ---
  duration_ms: 846.605459
  type: 'test'
  ...
# Subtest: Codex privacy apply_patch with temp fixtures respects sensitive vs safe
ok 86 - Codex privacy apply_patch with temp fixtures respects sensitive vs safe
  ---
  duration_ms: 424.413959
  type: 'test'
  ...
# Subtest: Codex hook-context canonicalizes symlink project root (regression)
ok 87 - Codex hook-context canonicalizes symlink project root (regression)
  ---
  duration_ms: 130.926291
  type: 'test'
  ...
# Subtest: Codex resolver and state reject symlink escape
ok 88 - Codex resolver and state reject symlink escape
  ---
  duration_ms: 156.967834
  type: 'test'
  ...
# Subtest: Codex privacy state rejects a symlinked state directory without external writes
ok 89 - Codex privacy state rejects a symlinked state directory without external writes
  ---
  duration_ms: 241.764375
  type: 'test'
  ...
# Subtest: Claude and Codex fail closed consistently for malformed cwd payloads
ok 90 - Claude and Codex fail closed consistently for malformed cwd payloads
  ---
  duration_ms: 359.667917
  type: 'test'
  ...
# Subtest: Codex emits the required decision for every receipt state
ok 91 - Codex emits the required decision for every receipt state
  ---
  duration_ms: 9486.872917
  type: 'test'
  ...
# Subtest: Codex wrappers stay pass-through and carry no receipt-mode logic
ok 92 - Codex wrappers stay pass-through and carry no receipt-mode logic
  ---
  duration_ms: 0.432334
  type: 'test'
  ...
# Subtest: Codex payload transform emits native skill and subagent syntax
ok 93 - Codex payload transform emits native skill and subagent syntax
  ---
  duration_ms: 5.831333
  type: 'test'
  ...
# Subtest: Codex payload transform keeps structured user-input grammar across determiners
ok 94 - Codex payload transform keeps structured user-input grammar across determiners
  ---
  duration_ms: 8.878042
  type: 'test'
  ...
# Subtest: Codex structured-input corpus oracle stays differential and production-aware
ok 95 - Codex structured-input corpus oracle stays differential and production-aware
  ---
  duration_ms: 41.912542
  type: 'test'
  ...
# Subtest: Codex payload transform preserves executable keyword arguments
ok 96 - Codex payload transform preserves executable keyword arguments
  ---
  duration_ms: 0.733333
  type: 'test'
  ...
# Subtest: Codex managed AGENTS block preserves malformed marker topologies
ok 97 - Codex managed AGENTS block preserves malformed marker topologies
  ---
  duration_ms: 0.649375
  type: 'test'
  ...
# Subtest: platform resolver keeps saved runtimes and newly detected Codex
ok 98 - platform resolver keeps saved runtimes and newly detected Codex
  ---
  duration_ms: 3.456208
  type: 'test'
  ...
# Subtest: explicit Codex install restores the Codex locale first
ok 99 - explicit Codex install restores the Codex locale first
  ---
  duration_ms: 2.859875
  type: 'test'
  ...
# Subtest: same-version install can add Codex beside an existing runtime
ok 100 - same-version install can add Codex beside an existing runtime
  ---
  duration_ms: 1.808542
  type: 'test'
  ...
# Subtest: resolvePlatforms interactive prompts to add more platforms when prior install exists
ok 101 - resolvePlatforms interactive prompts to add more platforms when prior install exists
  ---
  duration_ms: 4.018042
  type: 'test'
  ...
# Subtest: resolvePlatforms interactive keeps existing platforms when user declines to add more
ok 102 - resolvePlatforms interactive keeps existing platforms when user declines to add more
  ---
  duration_ms: 4.384667
  type: 'test'
  ...
# Subtest: addPlatformsPrompt placeholder consistency across all locales
ok 103 - addPlatformsPrompt placeholder consistency across all locales
  ---
  duration_ms: 0.348875
  type: 'test'
  ...
# Subtest: same-version non-interactive install performs a selective refresh
ok 104 - same-version non-interactive install performs a selective refresh
  ---
  duration_ms: 5.689458
  type: 'test'
  ...
# Subtest: same-version interactive refresh does not enable force overwrite
ok 105 - same-version interactive refresh does not enable force overwrite
  ---
  duration_ms: 1.475958
  type: 'test'
  ...
# Subtest: mixed runtime versions update the stale Codex install
ok 106 - mixed runtime versions update the stale Codex install
  ---
  duration_ms: 5.876458
  type: 'test'
  ...
# Subtest: Codex ownership rejects files outside its split managed roots
ok 107 - Codex ownership rejects files outside its split managed roots
  ---
  duration_ms: 1.426083
  type: 'test'
  ...
# Subtest: Codex dry-run leaves both managed roots untouched
ok 108 - Codex dry-run leaves both managed roots untouched
  ---
  duration_ms: 449.047125
  type: 'test'
  ...
# Subtest: Codex install preserves the adaptive diagnostic-only Debug contract
ok 109 - Codex install preserves the adaptive diagnostic-only Debug contract
  ---
  duration_ms: 651.46125
  type: 'test'
  ...
# Subtest: Codex Windows hook launchers stay project-bound without Git from nested cwd
ok 110 - Codex Windows hook launchers stay project-bound without Git from nested cwd
  ---
  duration_ms: 1014.916875
  type: 'test'
  ...
# Subtest: Codex POSIX hook launchers run without Git and outside the repository root
ok 111 - Codex POSIX hook launchers run without Git and outside the repository root
  ---
  duration_ms: 2096.408792
  type: 'test'
  ...
# Subtest: a reinstall rebinds Codex launchers that resolved their path through Git
ok 112 - a reinstall rebinds Codex launchers that resolved their path through Git
  ---
  duration_ms: 2377.506417
  type: 'test'
  ...
# Subtest: a reinstall rebinds Codex launchers that looked for node on PATH
ok 113 - a reinstall rebinds Codex launchers that looked for node on PATH
  ---
  duration_ms: 2255.135792
  type: 'test'
  ...
# Subtest: Codex installed Specs and spec-maker reject adaptive coverage mutations
ok 114 - Codex installed Specs and spec-maker reject adaptive coverage mutations
  ---
  duration_ms: 4845.75025
  type: 'test'
  ...
# Subtest: Codex installed Brainstorm skill reference and agent preserve proportional routing parity
ok 115 - Codex installed Brainstorm skill reference and agent preserve proportional routing parity
  ---
  duration_ms: 838.705084
  type: 'test'
  ...
# Subtest: Codex installed Develop preserves plan-native execution and references
ok 116 - Codex installed Develop preserves plan-native execution and references
  ---
  duration_ms: 700.758708
  type: 'test'
  ...
# Subtest: Codex installed Research preserves adaptive evidence semantics
ok 117 - Codex installed Research preserves adaptive evidence semantics
  ---
  duration_ms: 756.16075
  type: 'test'
  ...
# Subtest: Codex installed Test preserves plan-native proof and references
ok 118 - Codex installed Test preserves plan-native proof and references
  ---
  duration_ms: 652.974667
  type: 'test'
  ...
# Subtest: Codex installed Fix preserves the adaptive repair contract
ok 119 - Codex installed Fix preserves the adaptive repair contract
  ---
  duration_ms: 806.363417
  type: 'test'
  ...
# Subtest: Codex installed Docs preserves the adaptive contract
ok 120 - Codex installed Docs preserves the adaptive contract
  ---
  duration_ms: 1410.912958
  type: 'test'
  ...
# Subtest: Codex install on top of existing Claude installation preserves content and adds Codex
ok 121 - Codex install on top of existing Claude installation preserves content and adds Codex
  ---
  duration_ms: 733.364208
  type: 'test'
  ...
# Subtest: Codex installed code_auditor contains Strict conditional marker
ok 122 - Codex installed code_auditor contains Strict conditional marker
  ---
  duration_ms: 783.699916
  type: 'test'
  ...
# Subtest: Codex scaffold resolver rejects symlink template
ok 123 - Codex scaffold resolver rejects symlink template
  ---
  duration_ms: 994.403083
  type: 'test'
  ...
# Subtest: Claude and Codex installed Route preserve proportional live-catalog semantics
ok 124 - Claude and Codex installed Route preserve proportional live-catalog semantics
  ---
  duration_ms: 1510.115042
  type: 'test'
  ...
# Subtest: combined installs bind each catalog to its native runtime inventory
ok 125 - combined installs bind each catalog to its native runtime inventory
  ---
  duration_ms: 1404.067334
  type: 'test'
  ...
# Subtest: Claude and Codex installed rules preserve the ported review and process guidance
ok 126 - Claude and Codex installed rules preserve the ported review and process guidance
  ---
  duration_ms: 957.427333
  type: 'test'
  ...
# Subtest: installed Route degrades safely when an agent is absent
ok 127 - installed Route degrades safely when an agent is absent
  ---
  duration_ms: 1055.07225
  type: 'test'
  ...
# Subtest: CLI rejects flash and parallel before any mutation
ok 128 - CLI rejects flash and parallel before any mutation
  ---
  duration_ms: 174.532041
  type: 'test'
  ...
# Subtest: develop flags retain their process-v3 contracts
ok 129 - develop flags retain their process-v3 contracts
  ---
  duration_ms: 2.265208
  type: 'test'
  ...
# Subtest: delegation plan consumes legacy tiers as obligations without an agent chain
ok 130 - delegation plan consumes legacy tiers as obligations without an agent chain
  ---
  duration_ms: 4.19475
  type: 'test'
  ...
# Subtest: lane classifier selects Direct for explicit reversible low-risk work
ok 131 - lane classifier selects Direct for explicit reversible low-risk work
  ---
  duration_ms: 1.939625
  type: 'test'
  ...
# Subtest: lane classifier raises named risks to Elevated without inventing independent-audit authority
ok 132 - lane classifier raises named risks to Elevated without inventing independent-audit authority
  ---
  duration_ms: 1.753083
  type: 'test'
  ...
# Subtest: P1 persists the minimal v2.1 policy and derives compatibility views
ok 133 - P1 persists the minimal v2.1 policy and derives compatibility views
  ---
  duration_ms: 2.312709
  type: 'test'
  ...
# Subtest: P1 workflow-policy validation is semantic and explicit workflow_policy values never reclassify
ok 134 - P1 workflow-policy validation is semantic and explicit workflow_policy values never reclassify
  ---
  duration_ms: 660.477625
  type: 'test'
  ...
# Subtest: P1 workflow policy escalation is monotonic across all newly classified risks
ok 135 - P1 workflow policy escalation is monotonic across all newly classified risks
  ---
  duration_ms: 1.994167
  type: 'test'
  ...
# Subtest: P1 legacy execution tier is read-compatible without becoming emitted policy authority
ok 136 - P1 legacy execution tier is read-compatible without becoming emitted policy authority
  ---
  duration_ms: 0.605125
  type: 'test'
  ...
# Subtest: legacy v1 policy is read-compatible, immutable on read, and explicitly migrates to v2.1
ok 137 - legacy v1 policy is read-compatible, immutable on read, and explicitly migrates to v2.1
  ---
  duration_ms: 2.600041
  type: 'test'
  ...
# Subtest: post-classification downgrade is unsupported
ok 138 - post-classification downgrade is unsupported
  ---
  duration_ms: 0.864417
  type: 'test'
  ...
# Subtest: caller-requested downgrade is blocked before persistence
ok 139 - caller-requested downgrade is blocked before persistence
  ---
  duration_ms: 207.956625
  type: 'test'
  ...
# Subtest: forged approval via legacy approved field is rejected
ok 140 - forged approval via legacy approved field is rejected
  ---
  duration_ms: 199.310917
  type: 'test'
  ...
# Subtest: technical approval readiness ignores legacy user_approved
ok 141 - technical approval readiness ignores legacy user_approved
  ---
  duration_ms: 176.118042
  type: 'test'
  ...
# Subtest: approval schema fails closed for explicit null, array, empty, and malformed states
ok 142 - approval schema fails closed for explicit null, array, empty, and malformed states
  ---
  duration_ms: 0.582208
  type: 'test'
  ...
# Subtest: CLI exposes a derived lane without making it primary Develop authority
ok 143 - CLI exposes a derived lane without making it primary Develop authority
  ---
  duration_ms: 275.870708
  type: 'test'
  ...
# Subtest: Specs primary output is a flat process-first packet with isolated legacy compatibility
ok 144 - Specs primary output is a flat process-first packet with isolated legacy compatibility
  ---
  duration_ms: 5.8525
  type: 'test'
  ...
# Subtest: core execution agents default to process-first state and isolate legacy packets
ok 145 - core execution agents default to process-first state and isolate legacy packets
  ---
  duration_ms: 4.050458
  type: 'test'
  ...
# Subtest: R7 Develop and Sync surfaces teach process-v3 and isolate hierarchical Legacy sections
ok 146 - R7 Develop and Sync surfaces teach process-v3 and isolate hierarchical Legacy sections
  ---
  duration_ms: 5.308125
  type: 'test'
  ...
# Subtest: Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries
ok 147 - Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries
  ---
  duration_ms: 4882.475542
  type: 'test'
  ...
# Subtest: Claude installed Develop preserves plan-native execution and references
ok 148 - Claude installed Develop preserves plan-native execution and references
  ---
  duration_ms: 541.190792
  type: 'test'
  ...
# Subtest: Test process-first handoff preserves proof ownership and side-effect boundaries
ok 149 - Test process-first handoff preserves proof ownership and side-effect boundaries
  ---
  duration_ms: 467.028125
  type: 'test'
  ...
# Subtest: Claude installed Test preserves plan-native proof and references
ok 150 - Claude installed Test preserves plan-native proof and references
  ---
  duration_ms: 533.886666
  type: 'test'
  ...
# Subtest: specs-usage-guide documents Test proof handoff without timing claims
ok 151 - specs-usage-guide documents Test proof handoff without timing claims
  ---
  duration_ms: 1.052791
  type: 'test'
  ...
# Subtest: canonical verdict adapter handles completion and unfinished decisions
ok 152 - canonical verdict adapter handles completion and unfinished decisions
  ---
  duration_ms: 226.008709
  type: 'test'
  ...
# Subtest: completion decision requires canonical execution receipt and every workflow obligation
ok 153 - completion decision requires canonical execution receipt and every workflow obligation
  ---
  duration_ms: 4104.330708
  type: 'test'
  ...
# Subtest: auto authoring reaches readiness only after promotion, validation, grounding, and current review
ok 154 - auto authoring reaches readiness only after promotion, validation, grounding, and current review
  ---
  duration_ms: 886.612416
  type: 'test'
  ...
# Subtest: atomic readiness supports one-criterion Routine specs and binds semantic text
ok 155 - atomic readiness supports one-criterion Routine specs and binds semantic text
  ---
  duration_ms: 909.542541
  type: 'test'
  ...
# Subtest: atomic readiness preserves exact bytes on review, grounding, decision, and Strict authority failures
ok 156 - atomic readiness preserves exact bytes on review, grounding, decision, and Strict authority failures
  ---
  duration_ms: 914.33475
  type: 'test'
  ...
# Subtest: Strict atomic readiness succeeds only after current allowlisted host observation
ok 157 - Strict atomic readiness succeeds only after current allowlisted host observation
  ---
  duration_ms: 1720.704417
  type: 'test'
  ...
# Subtest: done is a final-state request bound to current semantic model and digest
ok 158 - done is a final-state request bound to current semantic model and digest
  ---
  duration_ms: 1277.169
  type: 'test'
  ...
# Subtest: flash PASS promotes proof; only trusted sync-finalize completes
ok 159 - flash PASS promotes proof; only trusted sync-finalize completes
  ---
  duration_ms: 2135.035208
  type: 'test'
  ...
# Subtest: spec-gate rejects stale FLASH_UNVERIFIED done state
ok 160 - spec-gate rejects stale FLASH_UNVERIFIED done state
  ---
  duration_ms: 877.638208
  type: 'test'
  ...
# Subtest: first-run cache bypass is blocked - canonical receipt required even without cache
ok 161 - first-run cache bypass is blocked - canonical receipt required even without cache
  ---
  duration_ms: 2186.636083
  type: 'test'
  ...
# Subtest: canonical receipt requires command, exit, provenance and unambiguous PASS
ok 162 - canonical receipt requires command, exit, provenance and unambiguous PASS
  ---
  duration_ms: 205.883334
  type: 'test'
  ...
# Subtest: canonical receipt provenance requires both Base and Head (or both base_sha and head_sha)
ok 163 - canonical receipt provenance requires both Base and Head (or both base_sha and head_sha)
  ---
  duration_ms: 497.692042
  type: 'test'
  ...
# Subtest: canonical receipt binds expected provenance when the runtime supplies it
ok 164 - canonical receipt binds expected provenance when the runtime supplies it
  ---
  duration_ms: 171.258167
  type: 'test'
  ...
# Subtest: runtime provenance derives exact Git evidence, CLI context, and stale/forged blockers
ok 165 - runtime provenance derives exact Git evidence, CLI context, and stale/forged blockers
  ---
  duration_ms: 5423.579125
  type: 'test'
  ...
# Subtest: runtime provenance chooses a deterministic root when all history is Specs-only and multi-root
ok 166 - runtime provenance chooses a deterministic root when all history is Specs-only and multi-root
  ---
  duration_ms: 666.465
  type: 'test'
  ...
# Subtest: lane traces - Direct, Standard, explicit Strict classification, override, state mutation and completion
ok 167 - lane traces - Direct, Standard, explicit Strict classification, override, state mutation and completion
  ---
  duration_ms: 1579.981125
  type: 'test'
  ...
# Subtest: flash selective promotion - only specific task is promoted, not blanket
ok 168 - flash selective promotion - only specific task is promoted, not blanket
  ---
  duration_ms: 579.144959
  type: 'test'
  ...
# Subtest: parallel waves require immutable provenance receipts and safe recovery
ok 169 - parallel waves require immutable provenance receipts and safe recovery
  ---
  duration_ms: 3.663917
  type: 'test'
  ...
# Subtest: provenance ledger defines reuse contract and source anchors
ok 170 - provenance ledger defines reuse contract and source anchors
  ---
  duration_ms: 66.817291
  type: 'test'
  ...
# Subtest: B1 benchmark artifacts expose bounded CLI contract
ok 171 - B1 benchmark artifacts expose bounded CLI contract
  ---
  duration_ms: 4.433084
  type: 'test'
  ...
# Subtest: B1 validator rejects missing freeze fields and accepts fixture-only corpus
ok 172 - B1 validator rejects missing freeze fields and accepts fixture-only corpus
  ---
  duration_ms: 421.8335
  type: 'test'
  ...
# Subtest: B1 validator fails closed for templates, prompts, parity, and artifacts
ok 173 - B1 validator fails closed for templates, prompts, parity, and artifacts
  ---
  duration_ms: 1489.478875
  type: 'test'
  ...
# Subtest: B1 summary groups fixture-only receipts by arm/lane with deterministic quantiles
ok 174 - B1 summary groups fixture-only receipts by arm/lane with deterministic quantiles
  ---
  duration_ms: 874.545333
  type: 'test'
  ...
# Subtest: B1 rollout rejects incomplete fixture-only lane/repeat matrices
ok 175 - B1 rollout rejects incomplete fixture-only lane/repeat matrices
  ---
  duration_ms: 1280.714292
  type: 'test'
  ...
# Subtest: B1 summary marks no receipts exploratory instead of claiming a run
ok 176 - B1 summary marks no receipts exploratory instead of claiming a run
  ---
  duration_ms: 174.142
  type: 'test'
  ...
# Subtest: B1 run requires explicit runner contract and rejects placeholders/shell strings
ok 177 - B1 run requires explicit runner contract and rejects placeholders/shell strings
  ---
  duration_ms: 699.562875
  type: 'test'
  ...
# Subtest: B1 run executes via explicit argv, captures wall_ms/artifact, and remains honest no-live-runs without execution
ok 178 - B1 run executes via explicit argv, captures wall_ms/artifact, and remains honest no-live-runs without execution
  ---
  duration_ms: 1473.004708
  type: 'test'
  ...
# Subtest: B1 run rejects mismatched corpus hash, artifact escape, and partial matrices fail-closed
ok 179 - B1 run rejects mismatched corpus hash, artifact escape, and partial matrices fail-closed
  ---
  duration_ms: 681.851416
  type: 'test'
  ...
# Subtest: B1 runner secret safety: command argv with secret-like assignment/flag is fail-closed and stderr is redacted
ok 180 - B1 runner secret safety: command argv with secret-like assignment/flag is fail-closed and stderr is redacted
  ---
  duration_ms: 6873.642583
  type: 'test'
  ...
# Subtest: P0 receipt fail-closed: Exit 1/-1/abc/conflict/empty command rejected
ok 181 - P0 receipt fail-closed: Exit 1/-1/abc/conflict/empty command rejected
  ---
  duration_ms: 165.985791
  type: 'test'
  ...
# Subtest: P0 flash marker-only must not promote or finalize
ok 182 - P0 flash marker-only must not promote or finalize
  ---
  duration_ms: 1375.35175
  type: 'test'
  ...
# Subtest: P0 canonical artifacts declaration requires SHA-256 and keeps no-artifact receipts compatible
ok 183 - P0 canonical artifacts declaration requires SHA-256 and keeps no-artifact receipts compatible
  ---
  duration_ms: 2.122166
  type: 'test'
  ...
# Subtest: P0 sync-finalize derives promotion from current FLASH_UNVERIFIED plus explicit PASS proof
ok 184 - P0 sync-finalize derives promotion from current FLASH_UNVERIFIED plus explicit PASS proof
  ---
  duration_ms: 2920.253334
  type: 'test'
  ...
# Subtest: P0 Claude and Codex reject configured specs roots outside the project
ok 185 - P0 Claude and Codex reject configured specs roots outside the project
  ---
  duration_ms: 16.418416
  type: 'test'
  ...
# Subtest: P0 caller-owned downgrade flags have no canonical capability
ok 186 - P0 caller-owned downgrade flags have no canonical capability
  ---
  duration_ms: 0.722333
  type: 'test'
  ...
# Subtest: P0 canonical policy exposes no caller-owned downgrade authority
ok 187 - P0 canonical policy exposes no caller-owned downgrade authority
  ---
  duration_ms: 0.184041
  type: 'test'
  ...
# Subtest: P0 active spec deterministic: multiple active ambiguity and explicit target/path containment
ok 188 - P0 active spec deterministic: multiple active ambiguity and explicit target/path containment
  ---
  duration_ms: 16.0725
  type: 'test'
  ...
# Subtest: P0 parity Claude/Codex: canonical receipt and multi-active
ok 189 - P0 parity Claude/Codex: canonical receipt and multi-active
  ---
  duration_ms: 48.185667
  type: 'test'
  ...
# Subtest: P0 regression: placeholder, explicit failure, artifact and lanePolicy forged are blocked
ok 190 - P0 regression: placeholder, explicit failure, artifact and lanePolicy forged are blocked
  ---
  duration_ms: 366.254083
  type: 'test'
  ...
# Subtest: P0 regression: symlink spec/task containment and malformed spec handling
ok 191 - P0 regression: symlink spec/task containment and malformed spec handling
  ---
  duration_ms: 16.908125
  type: 'test'
  ...
# Subtest: P0 regression: artifact hash scoped to structured Artifact declaration and explicit failure structured only
ok 192 - P0 regression: artifact hash scoped to structured Artifact declaration and explicit failure structured only
  ---
  duration_ms: 6.191958
  type: 'test'
  ...
# Subtest: P0 regression: safeTaskFile fail-closed on realpath error and single authority
ok 193 - P0 regression: safeTaskFile fail-closed on realpath error and single authority
  ---
  duration_ms: 2.164209
  type: 'test'
  ...
# Subtest: P0 regression: resolver fail-closed on canonicalization and lstat errors
ok 194 - P0 regression: resolver fail-closed on canonicalization and lstat errors
  ---
  duration_ms: 9.183958
  type: 'test'
  ...
# Subtest: P0 canonical phantom vectors - zero, cancellation, suite, FAIL, error, collected (r3)
ok 195 - P0 canonical phantom vectors - zero, cancellation, suite, FAIL, error, collected (r3)
  ---
  duration_ms: 8.333041
  type: 'test'
  ...
# Subtest: generated runtime state under every platform folder stays out of the worktree digest
ok 196 - generated runtime state under every platform folder stays out of the worktree digest
  ---
  duration_ms: 856.317083
  type: 'test'
  ...
# Subtest: explicit PASS builds a completed C2 receipt, preserves C16, and is ready
ok 197 - explicit PASS builds a completed C2 receipt, preserves C16, and is ready
  ---
  duration_ms: 26.179333
  type: 'test'
  ...
# Subtest: explicit FAIL is authoritative even when there are no blockers
ok 198 - explicit FAIL is authoritative even when there are no blockers
  ---
  duration_ms: 7.117875
  type: 'test'
  ...
# Subtest: PASS with blocking findings or decisions is refused
ok 199 - PASS with blocking findings or decisions is refused
  ---
  duration_ms: 3.42225
  type: 'test'
  ...
# Subtest: blocking_count counts blocking findings and unresolved decisions
ok 200 - blocking_count counts blocking findings and unresolved decisions
  ---
  duration_ms: 8.252667
  type: 'test'
  ...
# Subtest: caller digest and derived/control fields are rejected from public input
ok 201 - caller digest and derived/control fields are rejected from public input
  ---
  duration_ms: 25.512916
  type: 'test'
  ...
# Subtest: lineage is deterministic and divergent or missing identity is rejected
ok 202 - lineage is deterministic and divergent or missing identity is rejected
  ---
  duration_ms: 18.25925
  type: 'test'
  ...
# Subtest: replaying a receipt is idempotent across the whole lineage
ok 203 - replaying a receipt is idempotent across the whole lineage
  ---
  duration_ms: 8.447541
  type: 'test'
  ...
# Subtest: replaying an earlier receipt dedupes across the whole lineage
ok 204 - replaying an earlier receipt dedupes across the whole lineage
  ---
  duration_ms: 10.937666
  type: 'test'
  ...
# Subtest: a PASS starts the next epoch with a reset FAIL attempt index
ok 205 - a PASS starts the next epoch with a reset FAIL attempt index
  ---
  duration_ms: 22.587041
  type: 'test'
  ...
# Subtest: the third FAIL is terminal BLOCKED and there is no index 3
ok 206 - the third FAIL is terminal BLOCKED and there is no index 3
  ---
  duration_ms: 22.615125
  type: 'test'
  ...
# Subtest: stale C16 authoring validation refuses the append
ok 207 - stale C16 authoring validation refuses the append
  ---
  duration_ms: 1.536958
  type: 'test'
  ...
# Subtest: the privacy gate asks on a grok run_terminal_command
ok 208 - the privacy gate asks on a grok run_terminal_command
  ---
  duration_ms: 164.309542
  type: 'test'
  ...
# Subtest: the privacy gate asks on a grok read_file path
ok 209 - the privacy gate asks on a grok read_file path
  ---
  duration_ms: 194.474583
  type: 'test'
  ...
# Subtest: an ordinary grok read is not disturbed
ok 210 - an ordinary grok read is not disturbed
  ---
  duration_ms: 174.415667
  type: 'test'
  ...
# Subtest: a broad glob is denied with its full reason in JSON
ok 211 - a broad glob is denied with its full reason in JSON
  ---
  duration_ms: 186.594625
  type: 'test'
  ...
# Subtest: a nested task write is denied under the grok write tool
ok 212 - a nested task write is denied under the grok write tool
  ---
  duration_ms: 350.327625
  type: 'test'
  ...
# Subtest: the Stop gate honours stopHookActive
ok 213 - the Stop gate honours stopHookActive
  ---
  duration_ms: 313.289083
  type: 'test'
  ...
# Subtest: the Stop gate still blocks an unproven done task
ok 214 - the Stop gate still blocks an unproven done task
  ---
  duration_ms: 742.41925
  type: 'test'
  ...
# Subtest: the approval hook takes its approve path on a grok prompt
ok 215 - the approval hook takes its approve path on a grok prompt
  ---
  duration_ms: 595.361
  type: 'test'
  ...
# Subtest: the secret guardrail sees a grok prompt
ok 216 - the secret guardrail sees a grok prompt
  ---
  duration_ms: 470.85825
  type: 'test'
  ...
# Subtest: a Claude envelope still works unchanged
ok 217 - a Claude envelope still works unchanged
  ---
  duration_ms: 197.294
  type: 'test'
  ...
# Subtest: grok is an alias, not a platform of its own
ok 218 - grok is an alias, not a platform of its own
  ---
  duration_ms: 16.970542
  type: 'test'
  ...
# Subtest: --platform grok installs the Claude runtime and no .grok directory
ok 219 - --platform grok installs the Claude runtime and no .grok directory
  ---
  duration_ms: 564.024542
  type: 'test'
  ...
# Subtest: the trust reminder is printed once in the selected language
ok 220 - the trust reminder is printed once in the selected language
  ---
  duration_ms: 1169.443042
  type: 'test'
  ...
# Subtest: grok and claude together install once
ok 221 - grok and claude together install once
  ---
  duration_ms: 622.39225
  type: 'test'
  ...
# Subtest: a plain claude install prints no grok notice
ok 222 - a plain claude install prints no grok notice
  ---
  duration_ms: 553.807333
  type: 'test'
  ...
# Subtest: .grok is not a detection marker
ok 223 - .grok is not a detection marker
  ---
  duration_ms: 4.6545
  type: 'test'
  ...
# Subtest: an unknown platform is still rejected
ok 224 - an unknown platform is still rejected
  ---
  duration_ms: 299.351916
  type: 'test'
  ...
# Subtest: the notice exists in every shipped locale
ok 225 - the notice exists in every shipped locale
  ---
  duration_ms: 0.309666
  type: 'test'
  ...
# Subtest: a grok PreToolUse envelope becomes the Claude payload
ok 226 - a grok PreToolUse envelope becomes the Claude payload
  ---
  duration_ms: 3.629041
  type: 'test'
  ...
# Subtest: read_file path becomes file_path
ok 227 - read_file path becomes file_path
  ---
  duration_ms: 0.627209
  type: 'test'
  ...
# Subtest: an existing file_path is never overwritten by path
ok 228 - an existing file_path is never overwritten by path
  ---
  duration_ms: 0.506583
  type: 'test'
  ...
# Subtest: Stop and subagent fields map
ok 229 - Stop and subagent fields map
  ---
  duration_ms: 0.671834
  type: 'test'
  ...
# Subtest: every name reaching a Bash matcher becomes Bash
ok 230 - every name reaching a Bash matcher becomes Bash
  ---
  duration_ms: 0.207916
  type: 'test'
  ...
# Subtest: write and search_replace map to different Claude tools
ok 231 - write and search_replace map to different Claude tools
  ---
  duration_ms: 0.118875
  type: 'test'
  ...
# Subtest: omp lowercase names are aliased even under a snake_case key
ok 232 - omp lowercase names are aliased even under a snake_case key
  ---
  duration_ms: 0.254917
  type: 'test'
  ...
# Subtest: a Claude payload keeps its keys
ok 233 - a Claude payload keeps its keys
  ---
  duration_ms: 0.161708
  type: 'test'
  ...
# Subtest: an unknown tool name is left alone
ok 234 - an unknown tool name is left alone
  ---
  duration_ms: 0.502041
  type: 'test'
  ...
# Subtest: hostile input never throws
ok 235 - hostile input never throws
  ---
  duration_ms: 0.76375
  type: 'test'
  ...
# Subtest: the event map covers every event grok emits
ok 236 - the event map covers every event grok emits
  ---
  duration_ms: 0.319292
  type: 'test'
  ...
# Subtest: skill dependency package commands use cmd.exe for Windows npm launchers
ok 237 - skill dependency package commands use cmd.exe for Windows npm launchers
  ---
  duration_ms: 4.909792
  type: 'test'
  ...
# Subtest: skill dependency failures surface the useful npm or spawn error code
ok 238 - skill dependency failures surface the useful npm or spawn error code
  ---
  duration_ms: 1.068042
  type: 'test'
  ...
# Subtest: legacy managed root gitignore migrates A13 plan patterns and preserves user content
ok 239 - legacy managed root gitignore migrates A13 plan patterns and preserves user content
  ---
  duration_ms: 72.084042
  type: 'test'
  ...
# Subtest: malformed managed marker topology fails transactionally and preserves exact bytes
ok 240 - malformed managed marker topology fails transactionally and preserves exact bytes
  ---
  duration_ms: 6140.196875
  type: 'test'
  ...
# Subtest: combined install keeps CORE neutral and records native shared-root trade-off
ok 241 - combined install keeps CORE neutral and records native shared-root trade-off
  ---
  duration_ms: 1994.037209
  type: 'test'
  ...
# Subtest: combined locale stays in CORE and addressing stays in each native managed block
ok 242 - combined locale stays in CORE and addressing stays in each native managed block
  ---
  duration_ms: 928.829959
  type: 'test'
  ...
# Subtest: combined malformed runtime marker rolls back exact root bytes
ok 243 - combined malformed runtime marker rolls back exact root bytes
  ---
  duration_ms: 972.507666
  type: 'test'
  ...
# Subtest: malformed CLAUDE.md marker topology preserves exact bytes and reports an error
ok 244 - malformed CLAUDE.md marker topology preserves exact bytes and reports an error
  ---
  duration_ms: 2.485292
  type: 'test'
  ...
# Subtest: fresh no-lang install leaves locale unset and rules hook silent
ok 245 - fresh no-lang install leaves locale unset and rules hook silent
  ---
  duration_ms: 698.206958
  type: 'test'
  ...
# Subtest: obsolete agent pruning is ownership-aware across Claude and Codex
ok 246 - obsolete agent pruning is ownership-aware across Claude and Codex
  ---
  duration_ms: 18.737417
  type: 'test'
  ...
# Subtest: managed CLAUDE block replacement preserves user bytes under force overwrite
ok 247 - managed CLAUDE block replacement preserves user bytes under force overwrite
  ---
  duration_ms: 3.11275
  type: 'test'
  ...
# Subtest: legacy pristine CLAUDE template migrates to one managed block
ok 248 - legacy pristine CLAUDE template migrates to one managed block
  ---
  duration_ms: 1.371792
  type: 'test'
  ...
# Subtest: legacy shared AGENTS block migrates to one core marker
ok 249 - legacy shared AGENTS block migrates to one core marker
  ---
  duration_ms: 1.679709
  type: 'test'
  ...
# Subtest: addressing changes remain inside the managed CLAUDE block
ok 250 - addressing changes remain inside the managed CLAUDE block
  ---
  duration_ms: 1.727833
  type: 'test'
  ...
# Subtest: addressing appends when template has no section without entering shared CORE
ok 251 - addressing appends when template has no section without entering shared CORE
  ---
  duration_ms: 3.450125
  type: 'test'
  ...
# Subtest: locale patch does not claim ownership of a preserved user runtime
ok 252 - locale patch does not claim ownership of a preserved user runtime
  ---
  duration_ms: 1.592125
  type: 'test'
  ...
# Subtest: backup restores existing targets and removes targets absent before the run
ok 253 - backup restores existing targets and removes targets absent before the run
  ---
  duration_ms: 9.50575
  type: 'test'
  ...
# Subtest: backup preserves nested dependency symlinks without following them
ok 254 - backup preserves nested dependency symlinks without following them
  ---
  duration_ms: 24.610292
  type: 'test'
  ...
# Subtest: backup rejects traversal targets before snapshot or restore deletion
ok 255 - backup rejects traversal targets before snapshot or restore deletion
  ---
  duration_ms: 1.09825
  type: 'test'
  ...
# Subtest: managed targets and snapshots reject project symlink traversal
ok 256 - managed targets and snapshots reject project symlink traversal
  ---
  duration_ms: 2.359208
  type: 'test'
  ...
# Subtest: managed tree copy rejects source and destination symlink traversal before writes
ok 257 - managed tree copy rejects source and destination symlink traversal before writes
  ---
  duration_ms: 3.5735
  type: 'test'
  ...
# Subtest: managed Claude Addressing survives force refresh when template drops it
ok 258 - managed Claude Addressing survives force refresh when template drops it
  ---
  duration_ms: 1.216583
  type: 'test'
  ...
# Subtest: managed Codex block Addressing survives upsert with the current template
ok 259 - managed Codex block Addressing survives upsert with the current template
  ---
  duration_ms: 0.593042
  type: 'test'
  ...
# Subtest: copyRecursive skips generated artifacts while copying normal files
ok 260 - copyRecursive skips generated artifacts while copying normal files
  ---
  duration_ms: 4.391667
  type: 'test'
  ...
# Subtest: the dispatch table mirrors settings.json for every event omp can deliver
ok 261 - the dispatch table mirrors settings.json for every event omp can deliver
  ---
  duration_ms: 3.694041
  type: 'test'
  ...
# Subtest: every dispatch carries a stable session id and the project cwd
ok 262 - every dispatch carries a stable session id and the project cwd
  ---
  duration_ms: 0.386084
  type: 'test'
  ...
# Subtest: each denial mechanism becomes an omp block carrying the hook reason
ok 263 - each denial mechanism becomes an omp block carrying the hook reason
  ---
  duration_ms: 1.124833
  type: 'test'
  ...
# Subtest: a lowercase bash command on a secret file is blocked end to end through the real fork
ok 264 - a lowercase bash command on a secret file is blocked end to end through the real fork
  ---
  duration_ms: 696.692792
  type: 'test'
  ...
# Subtest: a slow hook blocks with its own name before omp cuts it off
ok 265 - a slow hook blocks with its own name before omp cuts it off
  ---
  duration_ms: 304.422
  type: 'test'
  ...
# Subtest: a crashing or missing gate blocks on gating events instead of silently allowing
ok 266 - a crashing or missing gate blocks on gating events instead of silently allowing
  ---
  duration_ms: 399.129042
  type: 'test'
  ...
# Subtest: stop_hook_active short-circuits the gate so a blocked turn cannot loop forever
ok 267 - stop_hook_active short-circuits the gate so a blocked turn cannot loop forever
  ---
  duration_ms: 0.412667
  type: 'test'
  ...
# Subtest: the approval phrase reaches completion-authority through the input event
ok 268 - the approval phrase reaches completion-authority through the input event
  ---
  duration_ms: 0.914875
  type: 'test'
  ...
# Subtest: input injections flow back as a transform that keeps the user text intact
ok 269 - input injections flow back as a transform that keeps the user text intact
  ---
  duration_ms: 1697.175
  type: 'test'
  ...
# Subtest: omp tool names map to the Claude names the rules were written against
ok 270 - omp tool names map to the Claude names the rules were written against
  ---
  duration_ms: 2.081084
  type: 'test'
  ...
# Subtest: a lowercase bash command reading a secret file is denied, where Claude asks
ok 271 - a lowercase bash command reading a secret file is denied, where Claude asks
  ---
  duration_ms: 359.24675
  type: 'test'
  ...
# Subtest: a capitalised tool name keeps working, so the fork adds a case rather than swapping one
ok 272 - a capitalised tool name keeps working, so the fork adds a case rather than swapping one
  ---
  duration_ms: 172.230125
  type: 'test'
  ...
# Subtest: the privacy hook denies where Claude asks, since omp tool_call has no ask state
ok 273 - the privacy hook denies where Claude asks, since omp tool_call has no ask state
  ---
  duration_ms: 145.073834
  type: 'test'
  ...
# Subtest: an unevaluable access denies rather than allows
ok 274 - an unevaluable access denies rather than allows
  ---
  duration_ms: 443.383125
  type: 'test'
  ...
# Subtest: a write to a scaffolded task path is guarded under omp lowercase names too
ok 275 - a write to a scaffolded task path is guarded under omp lowercase names too
  ---
  duration_ms: 175.390875
  type: 'test'
  ...
# Subtest: the fork differs from Claude only by its overlay
ok 276 - the fork differs from Claude only by its overlay
  ---
  duration_ms: 2.68175
  type: 'test'
  ...
# Subtest: omp is a registered platform that ships no skill payload of its own
ok 277 - omp is a registered platform that ships no skill payload of its own
  ---
  duration_ms: 1.164333
  type: 'test'
  ...
# Subtest: an omp install creates hooks, an extensions directory, and platform metadata
ok 278 - an omp install creates hooks, an extensions directory, and platform metadata
  ---
  duration_ms: 411.534
  type: 'test'
  ...
# Subtest: a non-omp install creates no .omp directory
ok 279 - a non-omp install creates no .omp directory
  ---
  duration_ms: 546.500334
  type: 'test'
  ...
# Subtest: an omp install ignores its own auto-executed extension directory
ok 280 - an omp install ignores its own auto-executed extension directory
  ---
  duration_ms: 323.711042
  type: 'test'
  ...
# Subtest: reinstalling omp is idempotent and preserves a user-added extension
ok 281 - reinstalling omp is idempotent and preserves a user-added extension
  ---
  duration_ms: 660.180959
  type: 'test'
  ...
# Subtest: an omp install ships the scripts the Stop gate needs
ok 282 - an omp install ships the scripts the Stop gate needs
  ---
  duration_ms: 555.580875
  type: 'test'
  ...
# Subtest: an omp-only install injects rules
ok 283 - an omp-only install injects rules
  ---
  duration_ms: 563.037333
  type: 'test'
  ...
# Subtest: manifest separates core, optional documents, and retired skills
ok 284 - manifest separates core, optional documents, and retired skills
  ---
  duration_ms: 7.672375
  type: 'test'
  ...
# Subtest: document skill flags are mutually exclusive
ok 285 - document skill flags are mutually exclusive
  ---
  duration_ms: 0.905333
  type: 'test'
  ...
# Subtest: selection defaults fresh non-interactive OFF and preserves legacy upgrade ON
ok 286 - selection defaults fresh non-interactive OFF and preserves legacy upgrade ON
  ---
  duration_ms: 4.002459
  type: 'test'
  ...
# Subtest: interactive cancellation stops before selecting a fresh bundle
ok 287 - interactive cancellation stops before selecting a fresh bundle
  ---
  duration_ms: 2.065166
  type: 'test'
  ...
# Subtest: claude prunes pristine optional skills and preserves modified skills
ok 288 - claude prunes pristine optional skills and preserves modified skills
  ---
  duration_ms: 12.681917
  type: 'test'
  ...
# Subtest: codex prunes pristine optional skills and preserves modified skills
ok 289 - codex prunes pristine optional skills and preserves modified skills
  ---
  duration_ms: 6.100042
  type: 'test'
  ...
# Subtest: fresh combined install defaults optional bundle OFF
ok 290 - fresh combined install defaults optional bundle OFF
  ---
  duration_ms: 921.807708
  type: 'test'
  ...
# Subtest: explicit opt-in installs all six optional skills on both runtimes
ok 291 - explicit opt-in installs all six optional skills on both runtimes
  ---
  duration_ms: 1645.09
  type: 'test'
  ...
# Subtest: corrupt metadata preserves an installed document bundle
ok 292 - corrupt metadata preserves an installed document bundle
  ---
  duration_ms: 1580.415167
  type: 'test'
  ...
# Subtest: modified retired skill is preserved but excluded from automatic routing
ok 293 - modified retired skill is preserved but excluded from automatic routing
  ---
  duration_ms: 731.935959
  type: 'test'
  ...
# Subtest: claude upgrade retires the inspect, hotfix and question directories
ok 294 - claude upgrade retires the inspect, hotfix and question directories
  ---
  duration_ms: 830.812625
  type: 'test'
  ...
# Subtest: codex upgrade retires the inspect, hotfix and question directories
ok 295 - codex upgrade retires the inspect, hotfix and question directories
  ---
  duration_ms: 937.847791
  type: 'test'
  ...
# Subtest: the catalog retires exactly the directories the manifest retires
ok 296 - the catalog retires exactly the directories the manifest retires
  ---
  duration_ms: 3.491542
  type: 'test'
  ...
# Subtest: the Claude session line ends with Orca: pane
ok 297 - the Claude session line ends with Orca: pane
  ---
  duration_ms: 777.942667
  type: 'test'
  ...
# Subtest: no Orca part outside a pane, byte for byte
ok 298 - no Orca part outside a pane, byte for byte
  ---
  duration_ms: 834.673959
  type: 'test'
  ...
# Subtest: keying on ORCA_TERMINAL_HANDLE instead of ORCA_PANE_KEY must not add the marker
ok 299 - keying on ORCA_TERMINAL_HANDLE instead of ORCA_PANE_KEY must not add the marker
  ---
  duration_ms: 438.054917
  type: 'test'
  ...
# Subtest: an empty project inside a pane still prints the marker
ok 300 - an empty project inside a pane still prints the marker
  ---
  duration_ms: 318.432333
  type: 'test'
  ...
# Subtest: no token ever reaches stdout, stderr, or the Claude env file
ok 301 - no token ever reaches stdout, stderr, or the Claude env file
  ---
  duration_ms: 453.2455
  type: 'test'
  ...
# Subtest: the Codex session line ends with Orca: pane
ok 302 - the Codex session line ends with Orca: pane
  ---
  duration_ms: 530.568709
  type: 'test'
  ...
# Subtest: no Orca part outside a pane on Codex, byte for byte
ok 303 - no Orca part outside a pane on Codex, byte for byte
  ---
  duration_ms: 441.761959
  type: 'test'
  ...
# Subtest: an empty Codex project inside a pane still prints the marker
ok 304 - an empty Codex project inside a pane still prints the marker
  ---
  duration_ms: 196.824333
  type: 'test'
  ...
# Subtest: no token ever reaches stdout or stderr on Codex
ok 305 - no token ever reaches stdout or stderr on Codex
  ---
  duration_ms: 181.488542
  type: 'test'
  ...
# Subtest: cf:orca installs for claude and codex
ok 306 - cf:orca installs for claude and codex
  ---
  duration_ms: 1118.497708
  type: 'test'
  ...
# Subtest: an omp-only install ships no skill
ok 307 - an omp-only install ships no skill
  ---
  duration_ms: 330.760584
  type: 'test'
  ...
# Subtest: the catalog resolves cf:orca on both hosts with no diagnostic
ok 308 - the catalog resolves cf:orca on both hosts with no diagnostic
  ---
  duration_ms: 1510.952708
  type: 'test'
  ...
# Subtest: the description triggers only on Orca context
ok 309 - the description triggers only on Orca context
  ---
  duration_ms: 0.489792
  type: 'test'
  ...
# Subtest: the body points at orca skills get and stops when the CLI is missing
ok 310 - the body points at orca skills get and stops when the CLI is missing
  ---
  duration_ms: 0.259958
  type: 'test'
  ...
# Subtest: the body bounds terminal send to the current worktree and distrusts terminal output
ok 311 - the body bounds terminal send to the current worktree and distrusts terminal output
  ---
  duration_ms: 0.600084
  type: 'test'
  ...
# Subtest: the body draws the Herdr boundary and forbids printing the tokens
ok 312 - the body draws the Herdr boundary and forbids printing the tokens
  ---
  duration_ms: 0.118834
  type: 'test'
  ...
# Subtest: the body carries nothing the Codex projection rewrites or forbids
ok 313 - the body carries nothing the Codex projection rewrites or forbids
  ---
  duration_ms: 0.147042
  type: 'test'
  ...
# Subtest: the manifest lists orca as a core skill
ok 314 - the manifest lists orca as a core skill
  ---
  duration_ms: 0.542208
  type: 'test'
  ...
# Subtest: the routing row is a neutral slot on every host
ok 315 - the routing row is a neutral slot on every host
  ---
  duration_ms: 1550.059416
  type: 'test'
  ...
# Subtest: the source ships exactly the six coding levels
ok 316 - the source ships exactly the six coding levels
  ---
  duration_ms: 2.801459
  type: 'test'
  ...
# Subtest: every style carries the frontmatter Claude Code reads
ok 317 - every style carries the frontmatter Claude Code reads
  ---
  duration_ms: 1.512375
  type: 'test'
  ...
# Subtest: each level declares a distinct name and description
ok 318 - each level declares a distinct name and description
  ---
  duration_ms: 0.651125
  type: 'test'
  ...
# Subtest: a Claude install places every style where Claude Code discovers them
ok 319 - a Claude install places every style where Claude Code discovers them
  ---
  duration_ms: 665.032125
  type: 'test'
  ...
# Subtest: a Codex install ships the same styles, since its rules hook injects them
ok 320 - a Codex install ships the same styles, since its rules hook injects them
  ---
  duration_ms: 901.565958
  type: 'test'
  ...
# Subtest: the Codex rules hook injects the style the coding level names
ok 321 - the Codex rules hook injects the style the coding level names
  ---
  duration_ms: 1419.094
  type: 'test'
  ...
# Subtest: the Codex style is injected once per session, not once per turn
ok 322 - the Codex style is injected once per session, not once per turn
  ---
  duration_ms: 1145.7425
  type: 'test'
  ...
# Subtest: an absent or out-of-range coding level injects no style but keeps the rules
ok 323 - an absent or out-of-range coding level injects no style but keeps the rules
  ---
  duration_ms: 1451.874833
  type: 'test'
  ...
# Subtest: a Claude install seeds the default style but never overwrites the user choice
ok 324 - a Claude install seeds the default style but never overwrites the user choice
  ---
  duration_ms: 1890.334417
  type: 'test'
  ...
# Subtest: a style edited by the user survives a reinstall
ok 325 - a style edited by the user survives a reinstall
  ---
  duration_ms: 1101.443667
  type: 'test'
  ...
# Subtest: installed mutation guard rejects post-context symlink and hardlink before source bytes change
ok 326 - installed mutation guard rejects post-context symlink and hardlink before source bytes change
  ---
  duration_ms: 219.666292
  type: 'test'
  ...
# Subtest: npm dry-run inventory is deterministic and preserves runtime payload
ok 327 - npm dry-run inventory is deterministic and preserves runtime payload
  ---
  duration_ms: 7246.34125
  type: 'test'
  ...
# Subtest: packed core-only installs reject optional capability routing
ok 328 - packed core-only installs reject optional capability routing
  ---
  duration_ms: 11449.481917
  type: 'test'
  ...
# Subtest: packed Route rejects semantic routing weakenings
ok 329 - packed Route rejects semantic routing weakenings
  ---
  duration_ms: 15007.207125
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm
ok 330 - packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm
  ---
  duration_ms: 54294.674583
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs preserve bounded Loop safety and routing
ok 331 - packed Claude and Codex installs preserve bounded Loop safety and routing
  ---
  duration_ms: 7505.6995
  type: 'test'
  ...
# Subtest: packed Research and Loop reject semantic weakenings
ok 332 - packed Research and Loop reject semantic weakenings
  ---
  duration_ms: 9996.351
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Research and bounded Loop
ok 333 - repository and package guides document adaptive Research and bounded Loop
  ---
  duration_ms: 3.381208
  type: 'test'
  ...
# Subtest: packed Claude and Codex reject adaptive Brainstorm semantic weakenings
ok 334 - packed Claude and Codex reject adaptive Brainstorm semantic weakenings
  ---
  duration_ms: 7731.308792
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Brainstorm usage
ok 335 - repository and package guides document adaptive Brainstorm usage
  ---
  duration_ms: 5.644125
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs reject adaptive Fix semantic weakenings
ok 336 - packed Claude and Codex installs reject adaptive Fix semantic weakenings
  ---
  duration_ms: 6445.943208
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Fix usage
ok 337 - repository and package guides document adaptive Fix usage
  ---
  duration_ms: 5.082042
  type: 'test'
  ...
# Subtest: localized reference guides keep OpenCode mappings historical
ok 338 - localized reference guides keep OpenCode mappings historical
  ---
  duration_ms: 6.815959
  type: 'test'
  ...
# Subtest: website keeps process-first docs, canonical public names, and historical legacy claims
ok 339 - website keeps process-first docs, canonical public names, and historical legacy claims
  ---
  duration_ms: 74.536041
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs reject adaptive Docs semantic weakenings
ok 340 - packed Claude and Codex installs reject adaptive Docs semantic weakenings
  ---
  duration_ms: 7440.72025
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Docs usage
ok 341 - repository and package guides document adaptive Docs usage
  ---
  duration_ms: 1.135375
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs execute semantic kernel behavior without package source
ok 342 - packed Claude and Codex installs execute semantic kernel behavior without package source
  ---
  duration_ms: 27160.425084
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs self-contain runtime provenance and fail closed without it
ok 343 - packed Claude and Codex installs self-contain runtime provenance and fail closed without it
  ---
  duration_ms: 8623.686708
  type: 'test'
  ...
# Subtest: packed Codex live host E2E via codex binary (opt-in)
ok 344 - packed Codex live host E2E via codex binary (opt-in) # SKIP opt-in only: set CAFEKIT_CODEX_HOST_E2E=1 to run live Codex host
  ---
  duration_ms: 0.657667
  type: 'test'
  ...
# Subtest: release-preflight: exits 2 when no freeze exists at all (fresh boot-window checkout)
ok 345 - release-preflight: exits 2 when no freeze exists at all (fresh boot-window checkout)
  ---
  duration_ms: 503.326083
  type: 'test'
  ...
# Subtest: release-preflight: refuses a no_protected_change freeze while authority is still in bootstrap state
ok 346 - release-preflight: refuses a no_protected_change freeze while authority is still in bootstrap state
  ---
  duration_ms: 582.675209
  type: 'test'
  ...
# Subtest: release-preflight: released state with a clean no_protected_change freeze succeeds (exit 0)
ok 347 - release-preflight: released state with a clean no_protected_change freeze succeeds (exit 0)
  ---
  duration_ms: 2280.552459
  type: 'test'
  ...
# Subtest: R1.3: release-preflight.mjs rejects any extra CLI argument with exit 2 and mutates nothing
ok 348 - R1.3: release-preflight.mjs rejects any extra CLI argument with exit 2 and mutates nothing
  ---
  duration_ms: 1889.928417
  type: 'test'
  ...
# Subtest: R1.3: presence of any of the six reserved CAFEKIT_ baseline-override env keys is rejected with exit 2 and mutates nothing
ok 349 - R1.3: presence of any of the six reserved CAFEKIT_ baseline-override env keys is rejected with exit 2 and mutates nothing
  ---
  duration_ms: 2878.308042
  type: 'test'
  ...
# Subtest: R1.3 control: no other environment variable name, however base/baseline-shaped or ambient, ever triggers the base-override deny-boundary
ok 350 - R1.3 control: no other environment variable name, however base/baseline-shaped or ambient, ever triggers the base-override deny-boundary
  ---
  duration_ms: 2556.548083
  type: 'test'
  ...
# Subtest: release-preflight: exits 2 for a freeze left stale by a baseline advance since it was created
ok 351 - release-preflight: exits 2 for a freeze left stale by a baseline advance since it was created
  ---
  duration_ms: 1627.8145
  type: 'test'
  ...
# Subtest: release-preflight: exits 2 for a freeze left stale by a C15 ledger event since it was created
ok 352 - release-preflight: exits 2 for a freeze left stale by a C15 ledger event since it was created
  ---
  duration_ms: 2139.083292
  type: 'test'
  ...
# Subtest: benchmark-workflow freeze CLI: refuses a protected change with no --proposal supplied at all
ok 353 - benchmark-workflow freeze CLI: refuses a protected change with no --proposal supplied at all
  ---
  duration_ms: 1427.910375
  type: 'test'
  ...
# Subtest: benchmark-workflow freeze CLI: refuses a benchmark_remediation proposal for a non-framework_regression class
ok 354 - benchmark-workflow freeze CLI: refuses a benchmark_remediation proposal for a non-framework_regression class
  ---
  duration_ms: 1572.110875
  type: 'test'
  ...
# Subtest: benchmark-workflow freeze CLI: refuses an authorized_evolution proposal missing required fields
ok 355 - benchmark-workflow freeze CLI: refuses an authorized_evolution proposal missing required fields
  ---
  duration_ms: 1454.888542
  type: 'test'
  ...
# Subtest: sentinel: a corrupted freeze file surfaces as release-preflight exit 2, never a false success
ok 356 - sentinel: a corrupted freeze file surfaces as release-preflight exit 2, never a false success
  ---
  duration_ms: 1172.437208
  type: 'test'
  ...
# Subtest: package.json: version stays valid SemVer and the npm lifecycle stays unwired while the boot-window is open
ok 357 - package.json: version stays valid SemVer and the npm lifecycle stays unwired while the boot-window is open
  ---
  duration_ms: 0.37425
  type: 'test'
  ...
# Subtest: D1: reserved control-plane paths never appear inside derived protected changes
ok 358 - D1: reserved control-plane paths never appear inside derived protected changes
  ---
  duration_ms: 0.078792
  type: 'test'
  ...
# Subtest: C2 receipt freezes the exact key set with separate verdict and lifecycle_disposition
ok 359 - C2 receipt freezes the exact key set with separate verdict and lifecycle_disposition
  ---
  duration_ms: 1993.372
  type: 'test'
  ...
# Subtest: sync migrates an exact legacy review into a fresh C2/C13/C16 lifecycle even when the semantic model is unchanged
ok 360 - sync migrates an exact legacy review into a fresh C2/C13/C16 lifecycle even when the semantic model is unchanged
  ---
  duration_ms: 1403.897458
  type: 'test'
  ...
# Subtest: C2 findings/unresolved_decisions/graph_coverage/reviewer_evidence enforce exact shape
ok 361 - C2 findings/unresolved_decisions/graph_coverage/reviewer_evidence enforce exact shape
  ---
  duration_ms: 2144.617334
  type: 'test'
  ...
# Subtest: C13 semantic_review_history freezes exact keys and dedupes across the whole lineage
ok 362 - C13 semantic_review_history freezes exact keys and dedupes across the whole lineage
  ---
  duration_ms: 2230.825958
  type: 'test'
  ...
# Subtest: C16 coordinator is the sole atomic writer: clean pass writes, a failing pass leaves spec.json untouched
ok 363 - C16 coordinator is the sole atomic writer: clean pass writes, a failing pass leaves spec.json untouched
  ---
  duration_ms: 1726.434667
  type: 'test'
  ...
# Subtest: C16/I20 fail-closed freshness: an edit after validation reverts the stage to draft-equivalent structurally
ok 364 - C16/I20 fail-closed freshness: an edit after validation reverts the stage to draft-equivalent structurally
  ---
  duration_ms: 1815.7035
  type: 'test'
  ...
# Subtest: installed layouts derive their own folder
ok 365 - installed layouts derive their own folder
  ---
  duration_ms: 16.100833
  type: 'test'
  ...
# Subtest: the source tree maps platform to dotted name
ok 366 - the source tree maps platform to dotted name
  ---
  duration_ms: 8.95
  type: 'test'
  ...
# Subtest: a dotted folder wins over the source marker
ok 367 - a dotted folder wins over the source marker
  ---
  duration_ms: 5.807375
  type: 'test'
  ...
# Subtest: an unknown layout falls back to .claude
ok 368 - an unknown layout falls back to .claude
  ---
  duration_ms: 4.7555
  type: 'test'
  ...
# Subtest: the helper in the real source tree derives .claude
ok 369 - the helper in the real source tree derives .claude
  ---
  duration_ms: 1.412833
  type: 'test'
  ...
# Subtest: a hook tree copied under .omp reads .omp/runtime.json
ok 370 - a hook tree copied under .omp reads .omp/runtime.json
  ---
  duration_ms: 1016.572333
  type: 'test'
  ...
# Subtest: advice names the directory the hook lives in
ok 371 - advice names the directory the hook lives in
  ---
  duration_ms: 366.094166
  type: 'test'
  ...
# Subtest: the schema is a valid, self-describing JSON Schema document
ok 372 - the schema is a valid, self-describing JSON Schema document
  ---
  duration_ms: 1.635208
  type: 'test'
  ...
# Subtest: every key in each shipped runtime.json is described by the schema
ok 373 - every key in each shipped runtime.json is described by the schema
  ---
  duration_ms: 2.815792
  type: 'test'
  ...
# Subtest: every runtime points at the schema that installs beside it
ok 374 - every runtime points at the schema that installs beside it
  ---
  duration_ms: 1.053584
  type: 'test'
  ...
# Subtest: every documented property carries a description a reader can act on
ok 375 - every documented property carries a description a reader can act on
  ---
  duration_ms: 1.000625
  type: 'test'
  ...
# Subtest: keys the runtime does not honour are marked deprecated, not documented as working
ok 376 - keys the runtime does not honour are marked deprecated, not documented as working
  ---
  duration_ms: 0.507375
  type: 'test'
  ...
# Subtest: the completion gate flag is documented as a block, never as a switch
ok 377 - the completion gate flag is documented as a block, never as a switch
  ---
  duration_ms: 0.166125
  type: 'test'
  ...
# Subtest: statusline values in the schema match the modes the renderer implements
ok 378 - statusline values in the schema match the modes the renderer implements
  ---
  duration_ms: 0.662917
  type: 'test'
  ...
# Subtest: the matcher fires on credential topics and stays quiet otherwise
ok 379 - the matcher fires on credential topics and stays quiet otherwise
  ---
  duration_ms: 8.2715
  type: 'test'
  ...
# Subtest: the reminder separates permission to read from permission to print
ok 380 - the reminder separates permission to read from permission to print
  ---
  duration_ms: 0.632083
  type: 'test'
  ...
# Subtest: claude: a credential prompt gets the reminder, an ordinary one gets nothing
ok 381 - claude: a credential prompt gets the reminder, an ordinary one gets nothing
  ---
  duration_ms: 1138.878084
  type: 'test'
  ...
# Subtest: claude: the guardrail never echoes the prompt or a matched value
ok 382 - claude: the guardrail never echoes the prompt or a matched value
  ---
  duration_ms: 814.800375
  type: 'test'
  ...
# Subtest: claude: the hook fails open on malformed input
ok 383 - claude: the hook fails open on malformed input
  ---
  duration_ms: 1004.41675
  type: 'test'
  ...
# Subtest: claude: the hook is registered for UserPromptSubmit
ok 384 - claude: the hook is registered for UserPromptSubmit
  ---
  duration_ms: 558.61325
  type: 'test'
  ...
# Subtest: codex: a credential prompt gets the reminder, an ordinary one gets nothing
ok 385 - codex: a credential prompt gets the reminder, an ordinary one gets nothing
  ---
  duration_ms: 1194.466542
  type: 'test'
  ...
# Subtest: codex: the guardrail never echoes the prompt or a matched value
ok 386 - codex: the guardrail never echoes the prompt or a matched value
  ---
  duration_ms: 939.810667
  type: 'test'
  ...
# Subtest: codex: the hook fails open on malformed input
ok 387 - codex: the hook fails open on malformed input
  ---
  duration_ms: 1152.695833
  type: 'test'
  ...
# Subtest: codex: the hook is registered for UserPromptSubmit
ok 388 - codex: the hook is registered for UserPromptSubmit
  ---
  duration_ms: 789.563542
  type: 'test'
  ...
# Subtest: staged secret scanner maps added source lines and redacts values
ok 389 - staged secret scanner maps added source lines and redacts values
  ---
  duration_ms: 415.331875
  type: 'test'
  ...
# Subtest: staged secret scanner handles JSON/YAML names and safe-name exclusions
ok 390 - staged secret scanner handles JSON/YAML names and safe-name exclusions
  ---
  duration_ms: 402.067459
  type: 'test'
  ...
# Subtest: staged secret scanner maps multiline YAML/JSON values to key lines
ok 391 - staged secret scanner maps multiline YAML/JSON values to key lines
  ---
  duration_ms: 338.299291
  type: 'test'
  ...
# Subtest: staged secret scanner detects short passwords, PEM, credential URLs, and basic auth
ok 392 - staged secret scanner detects short passwords, PEM, credential URLs, and basic auth
  ---
  duration_ms: 376.023167
  type: 'test'
  ...
# Subtest: staged secret scanner ignores deleted and context lines
ok 393 - staged secret scanner ignores deleted and context lines
  ---
  duration_ms: 483.158791
  type: 'test'
  ...
# Subtest: skill routing consumes live catalog without fixed optional commands
ok 394 - skill routing consumes live catalog without fixed optional commands
  ---
  duration_ms: 344.794833
  type: 'test'
  ...
# Subtest: skill catalog exposes discriminating routing metadata
ok 395 - skill catalog exposes discriminating routing metadata
  ---
  duration_ms: 359.791042
  type: 'test'
  ...
# Subtest: skill catalog rejects a missing root value before path resolution
ok 396 - skill catalog rejects a missing root value before path resolution
  ---
  duration_ms: 140.796875
  type: 'test'
  ...
# Subtest: a legacy repository resolves its one unfinished packet
ok 397 - a legacy repository resolves its one unfinished packet
  ---
  duration_ms: 32.896333
  type: 'test'
  ...
# Subtest: a legacy registry written with the older vocabulary counts as finished
ok 398 - a legacy registry written with the older vocabulary counts as finished
  ---
  duration_ms: 34.901083
  type: 'test'
  ...
# Subtest: a process-first packet keeps the strict task vocabulary
ok 399 - a process-first packet keeps the strict task vocabulary
  ---
  duration_ms: 7.3125
  type: 'test'
  ...
# Subtest: a legacy candidate never reaches the bulk branch
ok 400 - a legacy candidate never reaches the bulk branch
  ---
  duration_ms: 5.116416
  type: 'test'
  ...
# Subtest: a process-first set still reaches the bulk branch
ok 401 - a process-first set still reaches the bulk branch
  ---
  duration_ms: 4.122583
  type: 'test'
  ...
# Subtest: one unfinished process-first packet still narrows
ok 402 - one unfinished process-first packet still narrows
  ---
  duration_ms: 5.542542
  type: 'test'
  ...
# Subtest: one packet claiming closeout among finished ones resolves
ok 403 - one packet claiming closeout among finished ones resolves
  ---
  duration_ms: 14.132375
  type: 'test'
  ...
# Subtest: a lone finished packet still resolves
ok 404 - a lone finished packet still resolves
  ---
  duration_ms: 6.745292
  type: 'test'
  ...
# Subtest: a lone packet mid-execution still resolves
ok 405 - a lone packet mid-execution still resolves
  ---
  duration_ms: 5.487375
  type: 'test'
  ...
# Subtest: no packet claiming closeout resolves to null
ok 406 - no packet claiming closeout resolves to null
  ---
  duration_ms: 8.126834
  type: 'test'
  ...
# Subtest: several packets claiming closeout stay ambiguous and name only those
ok 407 - several packets claiming closeout stay ambiguous and name only those
  ---
  duration_ms: 8.564709
  type: 'test'
  ...
# Subtest: codex resolveCandidate agrees with the shared resolver
ok 408 - codex resolveCandidate agrees with the shared resolver
  ---
  duration_ms: 12.86525
  type: 'test'
  ...
# Subtest: a recorded active feature resolves two packets claiming closeout
ok 409 - a recorded active feature resolves two packets claiming closeout
  ---
  duration_ms: 5.406
  type: 'test'
  ...
# Subtest: a payload target beats the recorded file
ok 410 - a payload target beats the recorded file
  ---
  duration_ms: 4.777458
  type: 'test'
  ...
# Subtest: a blank recorded feature is ignored rather than malformed
ok 411 - a blank recorded feature is ignored rather than malformed
  ---
  duration_ms: 22.790959
  type: 'test'
  ...
# Subtest: a recorded feature cannot escape the specs root
ok 412 - a recorded feature cannot escape the specs root
  ---
  duration_ms: 8.322625
  type: 'test'
  ...
# Subtest: a symlinked recorded feature is refused
ok 413 - a symlinked recorded feature is refused
  ---
  duration_ms: 3.769958
  type: 'test'
  ...
# Subtest: an absent file leaves every project exactly as it was
ok 414 - an absent file leaves every project exactly as it was
  ---
  duration_ms: 2.8275
  type: 'test'
  ...
# Subtest: the approval prompt names its feature
ok 415 - the approval prompt names its feature
  ---
  duration_ms: 0.403333
  type: 'test'
  ...
# Subtest: the shared workflow resolver ignores the recorded file
ok 416 - the shared workflow resolver ignores the recorded file
  ---
  duration_ms: 6.807291
  type: 'test'
  ...
# Subtest: the codex gate consults the file only after its payload
ok 417 - the codex gate consults the file only after its payload
  ---
  duration_ms: 4.2055
  type: 'test'
  ...
# Subtest: claude: the recorded feature turns the identity block into receipt validation
ok 418 - claude: the recorded feature turns the identity block into receipt validation
  ---
  duration_ms: 724.959416
  type: 'test'
  ...
# Subtest: temp resource scope cleans exact owned paths and restores HOME after failure
ok 419 - temp resource scope cleans exact owned paths and restores HOME after failure
  ---
  duration_ms: 7.621667
  type: 'test'
  ...
# Subtest: separate receipt passes; missing, traversal, symlink, and conflicting legacy proof fail closed
ok 420 - separate receipt passes; missing, traversal, symlink, and conflicting legacy proof fail closed
  ---
  duration_ms: 1058.226875
  type: 'test'
  ...
# Subtest: Claude and Codex gates require task proof at every Stop and feature proof only at durable closeout
ok 421 - Claude and Codex gates require task proof at every Stop and feature proof only at durable closeout
  ---
  duration_ms: 29571.275666
  type: 'test'
  ...
# Subtest: an unproven done dependency cannot advance a dependent task
ok 422 - an unproven done dependency cannot advance a dependent task
  ---
  duration_ms: 1803.054375
  type: 'test'
  ...
# Subtest: completion authority supports taskless v2 and binds task plan plus receipt bytes
ok 423 - completion authority supports taskless v2 and binds task plan plus receipt bytes
  ---
  duration_ms: 4505.833125
  type: 'test'
  ...
# Subtest: shared taskless terminal predicate requires canonical 2.1 policy and physical tasklessness
ok 424 - shared taskless terminal predicate requires canonical 2.1 policy and physical tasklessness
  ---
  duration_ms: 1356.955792
  type: 'test'
  ...
# Subtest: completion authority activates only at durable closeout and honors the Stop loop guard
ok 425 - completion authority activates only at durable closeout and honors the Stop loop guard
  ---
  duration_ms: 2512.559584
  type: 'test'
  ...
# Subtest: v2 floor merge keeps axes independent, planning controls artifact profile, and risks raise assurance floor
ok 426 - v2 floor merge keeps axes independent, planning controls artifact profile, and risks raise assurance floor
  ---
  duration_ms: 0.726625
  type: 'test'
  ...
# Subtest: scaffold creates planning artifacts but no task or feature receipts
ok 427 - scaffold creates planning artifacts but no task or feature receipts
  ---
  duration_ms: 296.818417
  type: 'test'
  ...
# Subtest: legacy receipt still requires provenance under a clean committed tree
ok 428 - legacy receipt still requires provenance under a clean committed tree
  ---
  duration_ms: 1473.521625
  type: 'test'
  ...
# Subtest: policy 2.1 persists exactly selected axes, classified minimum, and risks
ok 429 - policy 2.1 persists exactly selected axes, classified minimum, and risks
  ---
  duration_ms: 5.144375
  type: 'test'
  ...
# Subtest: legacy policy is losslessly readable while authoring persistence migrates to 2.1
ok 430 - legacy policy is losslessly readable while authoring persistence migrates to 2.1
  ---
  duration_ms: 0.894333
  type: 'test'
  ...
# Subtest: canonical state template is schema 2.1 and approval-free
ok 431 - canonical state template is schema 2.1 and approval-free
  ---
  duration_ms: 1.061833
  type: 'test'
  ...
# Subtest: new scaffold emits taskless Compact 2.1 without Routine ceremony
ok 432 - new scaffold emits taskless Compact 2.1 without Routine ceremony
  ---
  duration_ms: 239.155916
  type: 'test'
  ...
# Subtest: research materializes only from a concrete uncertainty and stays minimal
ok 433 - research materializes only from a concrete uncertainty and stays minimal
  ---
  duration_ms: 703.162083
  type: 'test'
  ...
# Subtest: scaffold generates typed topology and canonical task projection
ok 434 - scaffold generates typed topology and canonical task projection
  ---
  duration_ms: 265.9065
  type: 'test'
  ...
# Subtest: scaffold rejects marker-only evidence, single-task parallel, and parent-child contention
ok 435 - scaffold rejects marker-only evidence, single-task parallel, and parent-child contention
  ---
  duration_ms: 479.856458
  type: 'test'
  ...
# Subtest: scaffold rejects incomplete dependency, transition, and proof boundaries
ok 436 - scaffold rejects incomplete dependency, transition, and proof boundaries
  ---
  duration_ms: 517.126084
  type: 'test'
  ...
# Subtest: scaffold transaction rolls back injected writes exactly
ok 437 - scaffold transaction rolls back injected writes exactly
  ---
  duration_ms: 232.050875
  type: 'test'
  ...
# Subtest: durable transaction recovery covers every fresh and replacement rename boundary
ok 438 - durable transaction recovery covers every fresh and replacement rename boundary
  ---
  duration_ms: 2768.03375
  type: 'test'
  ...
# Subtest: startup recovery preserves a target whose transaction ownership cannot be proven
ok 439 - startup recovery preserves a target whose transaction ownership cannot be proven
  ---
  duration_ms: 380.8265
  type: 'test'
  ...
# Subtest: typed boundary mutation preserves legacy graph counterexamples atomically
ok 440 - typed boundary mutation preserves legacy graph counterexamples atomically
  ---
  duration_ms: 1150.122333
  type: 'test'
  ...
# Subtest: tasks-only normalization is table-driven, conservative, and idempotent
ok 441 - tasks-only normalization is table-driven, conservative, and idempotent
  ---
  duration_ms: 1972.510208
  type: 'test'
  ...
# Subtest: canonical 2.1 input rejects unknown semantics at every authored object boundary
ok 442 - canonical 2.1 input rejects unknown semantics at every authored object boundary
  ---
  duration_ms: 4155.273792
  type: 'test'
  ...
# Subtest: tasks-only migration rejects invalid evidence without any write
ok 443 - tasks-only migration rejects invalid evidence without any write
  ---
  duration_ms: 4987.437459
  type: 'test'
  ...
# Subtest: schema 2.0 migration rejects unknown authority fields instead of projection-dropping them
ok 444 - schema 2.0 migration rejects unknown authority fields instead of projection-dropping them
  ---
  duration_ms: 2058.747166
  type: 'test'
  ...
# Subtest: --help and --version answer on stdout before any precondition runs
ok 445 - --help and --version answer on stdout before any precondition runs
  ---
  duration_ms: 951.131
  type: 'test'
  ...
# Subtest: generated schema 2.1 artifact validates after concrete authoring projection
ok 446 - generated schema 2.1 artifact validates after concrete authoring projection
  ---
  duration_ms: 919.440584
  type: 'test'
  ...
# Subtest: validator module API is side-effect free and matches CLI validation and digest results
ok 447 - validator module API is side-effect free and matches CLI validation and digest results
  ---
  duration_ms: 1159.28925
  type: 'test'
  ...
# Subtest: ready schema 2.1 requires exact receipt coverage and traceable V definition
ok 448 - ready schema 2.1 requires exact receipt coverage and traceable V definition
  ---
  duration_ms: 1164.128375
  type: 'test'
  ...
# Subtest: digest is stable on lifecycle fields and stale on authoring, policy, or topology changes
ok 449 - digest is stable on lifecycle fields and stale on authoring, policy, or topology changes
  ---
  duration_ms: 1307.40825
  type: 'test'
  ...
# Subtest: receipt rejects proof self-owner and duplicate generic counterexamples
ok 450 - receipt rejects proof self-owner and duplicate generic counterexamples
  ---
  duration_ms: 2690.377291
  type: 'test'
  ...
# Subtest: validator rejects missing deliverable, recovery, and verifier-owned artifact anchor
ok 451 - validator rejects missing deliverable, recovery, and verifier-owned artifact anchor
  ---
  duration_ms: 2290.546167
  type: 'test'
  ...
# Subtest: dependency boundary binds exact producer and consumer anchors to the registry DAG edge
ok 452 - dependency boundary binds exact producer and consumer anchors to the registry DAG edge
  ---
  duration_ms: 1191.550416
  type: 'test'
  ...
# Subtest: schema 2.1 reuses core machine lifecycle invariants without mutating artifacts
ok 453 - schema 2.1 reuses core machine lifecycle invariants without mutating artifacts
  ---
  duration_ms: 9336.772917
  type: 'test'
  ...
# Subtest: canonical task graph enforces substantive sections and exact criterion authority
ok 454 - canonical task graph enforces substantive sections and exact criterion authority
  ---
  duration_ms: 4568.196333
  type: 'test'
  ...
# Subtest: research authoring is an exact pointer-file state machine and participates in digest drift
ok 455 - research authoring is an exact pointer-file state machine and participates in digest drift
  ---
  duration_ms: 17980.064292
  type: 'test'
  ...
# Subtest: canonical T/V definitions, proof anchors, phases, and access normalization share one model
ok 456 - canonical T/V definitions, proof anchors, phases, and access normalization share one model
  ---
  duration_ms: 11282.101458
  type: 'test'
  ...
# Subtest: explicit Access and Action remain authoritative when Role prose claims create
ok 457 - explicit Access and Action remain authoritative when Role prose claims create
  ---
  duration_ms: 2001.746042
  type: 'test'
  ...
# Subtest: typed boundaries require exact non-empty resource maps and participation by every task
ok 458 - typed boundaries require exact non-empty resource maps and participation by every task
  ---
  duration_ms: 2313.584667
  type: 'test'
  ...
# Subtest: same-target writers cannot hide outside declared coordination pairs
ok 459 - same-target writers cannot hide outside declared coordination pairs
  ---
  duration_ms: 616.379208
  type: 'test'
  ...
# Subtest: schema 2.1 grounding follows actual readiness and task execution phase
ok 460 - schema 2.1 grounding follows actual readiness and task execution phase
  ---
  duration_ms: 864.593
  type: 'test'
  ...
# Subtest: schema 2.1 grounding permits a missing planned read only through its direct create dependency
ok 461 - schema 2.1 grounding permits a missing planned read only through its direct create dependency
  ---
  duration_ms: 1036.220125
  type: 'test'
  ...
# Subtest: schema 2.1 rejects unknown and dead machine fields outside the explicit adapter
ok 462 - schema 2.1 rejects unknown and dead machine fields outside the explicit adapter
  ---
  duration_ms: 1813.608209
  type: 'test'
  ...
# Subtest: digest mode refuses malformed physical topology and tracks substantive mutation classes
ok 463 - digest mode refuses malformed physical topology and tracks substantive mutation classes
  ---
  duration_ms: 4330.206125
  type: 'test'
  ...
# Subtest: taskless ready spec rejects a phantom design anchor through shared grounding
ok 464 - taskless ready spec rejects a phantom design anchor through shared grounding
  ---
  duration_ms: 1632.585125
  type: 'test'
  ...
# Subtest: ready task rejects a dangling canonical A-D reference
ok 465 - ready task rejects a dangling canonical A-D reference
  ---
  duration_ms: 853.923166
  type: 'test'
  ...
# Subtest: dependency topology cannot legalize duplicate criterion implementation owners
ok 466 - dependency topology cannot legalize duplicate criterion implementation owners
  ---
  duration_ms: 444.850125
  type: 'test'
  ...
# Subtest: separate proof verifier passes without duplicating subject acceptance ownership
ok 467 - separate proof verifier passes without duplicating subject acceptance ownership
  ---
  duration_ms: 951.508125
  type: 'test'
  ...
# Subtest: readiness action matrix permits absent create but rejects absent read modify and delete
ok 468 - readiness action matrix permits absent create but rejects absent read modify and delete
  ---
  duration_ms: 5514.52475
  type: 'test'
  ...
# Subtest: ready semantic digest is stale after anchor topology or policy edits
ok 469 - ready semantic digest is stale after anchor topology or policy edits
  ---
  duration_ms: 2655.113792
  type: 'test'
  ...
# Subtest: validator and CLI grounder reject the same missing modify counterexample
ok 470 - validator and CLI grounder reject the same missing modify counterexample
  ---
  duration_ms: 2671.939959
  type: 'test'
  ...
# Subtest: schema 2.1 policy is exactly five fields and rejects inert override receipt locations
ok 471 - schema 2.1 policy is exactly five fields and rejects inert override receipt locations
  ---
  duration_ms: 1473.652208
  type: 'test'
  ...
# Subtest: semantic authority mutation families reject empty inventory, ambiguous owners, vague proof, and projection drift
ok 472 - semantic authority mutation families reject empty inventory, ambiguous owners, vague proof, and projection drift
  ---
  duration_ms: 4021.616916
  type: 'test'
  ...
# Subtest: route and schema grounding never accepts design self-reference as repository evidence
ok 473 - route and schema grounding never accepts design self-reference as repository evidence
  ---
  duration_ms: 3030.538167
  type: 'test'
  ...
# Subtest: canonical legacy v2.0 taskless migration fixture is valid without execution evidence
ok 474 - canonical legacy v2.0 taskless migration fixture is valid without execution evidence
  ---
  duration_ms: 183.018
  type: 'test'
  ...
# Subtest: Codex installer transform preserves all owned spec assets with idempotent runtime parity
ok 475 - Codex installer transform preserves all owned spec assets with idempotent runtime parity
  ---
  duration_ms: 1368.288625
  type: 'test'
  ...
# Subtest: resolver binds feature identity and rejects cross-feature spec aliases
ok 476 - resolver binds feature identity and rejects cross-feature spec aliases
  ---
  duration_ms: 28.937541
  type: 'test'
  ...
# Subtest: validator rejects hidden task symlinks instead of filtering them
ok 477 - validator rejects hidden task symlinks instead of filtering them
  ---
  duration_ms: 189.3075
  type: 'test'
  ...
# Subtest: validator rejects non-Markdown task artifacts instead of ignoring them
ok 478 - validator rejects non-Markdown task artifacts instead of ignoring them
  ---
  duration_ms: 171.844458
  type: 'test'
  ...
# Subtest: validator keeps authoring receipt-free and validates taskless execution closeout proof
ok 479 - validator keeps authoring receipt-free and validates taskless execution closeout proof
  ---
  duration_ms: 534.672875
  type: 'test'
  ...
# Subtest: validator rejects required and optional spec artifacts that symlink outside the spec
ok 480 - validator rejects required and optional spec artifacts that symlink outside the spec
  ---
  duration_ms: 567.54025
  type: 'test'
  ...
# Subtest: Standard bounded readiness requires canonical testable requirements and a concrete design boundary
ok 481 - Standard bounded readiness requires canonical testable requirements and a concrete design boundary
  ---
  duration_ms: 700.017417
  type: 'test'
  ...
# Subtest: tasks-only validates the persisted policy before any filesystem mutation
ok 482 - tasks-only validates the persisted policy before any filesystem mutation
  ---
  duration_ms: 1089.029917
  type: 'test'
  ...
# Subtest: scaffold accepts only one safe alphanumeric-starting feature segment
ok 483 - scaffold accepts only one safe alphanumeric-starting feature segment
  ---
  duration_ms: 1254.891667
  type: 'test'
  ...
# Subtest: validator requires a strict persisted workflow-policy snapshot and never falls back to prose or legacy tier
ok 484 - validator requires a strict persisted workflow-policy snapshot and never falls back to prose or legacy tier
  ---
  duration_ms: 1551.046125
  type: 'test'
  ...
# Subtest: tasks-only preflights malformed topology, duplicates, and symlinks without mutation
ok 485 - tasks-only preflights malformed topology, duplicates, and symlinks without mutation
  ---
  duration_ms: 1489.288792
  type: 'test'
  ...
# Subtest: tasks-only commits transactionally and preserves exact bytes after an injected partial failure
ok 486 - tasks-only commits transactionally and preserves exact bytes after an injected partial failure
  ---
  duration_ms: 257.537667
  type: 'test'
  ...
# Subtest: tasks-only migration derives only absent feature identity and rejects present conflicts atomically
ok 487 - tasks-only migration derives only absent feature identity and rejects present conflicts atomically
  ---
  duration_ms: 770.374625
  type: 'test'
  ...
# Subtest: fresh scaffold rolls back authority rejection and injected partial writes without deleting pre-existing content
ok 488 - fresh scaffold rolls back authority rejection and injected partial writes without deleting pre-existing content
  ---
  duration_ms: 1236.815584
  type: 'test'
  ...
# Subtest: installed Codex scaffold rejects a symlinked template parent before creating a spec
ok 489 - installed Codex scaffold rejects a symlinked template parent before creating a spec
  ---
  duration_ms: 216.723458
  type: 'test'
  ...
# Subtest: tasks-only is idempotent for an identical task request and preserves the snapshot bytes
ok 490 - tasks-only is idempotent for an identical task request and preserves the snapshot bytes
  ---
  duration_ms: 2028.505
  type: 'test'
  ...
# Subtest: tasks-only consumes the policy snapshot and escalates auth to Elevated monotonically
ok 491 - tasks-only consumes the policy snapshot and escalates auth to Elevated monotonically
  ---
  duration_ms: 652.259375
  type: 'test'
  ...
# Subtest: scaffold emits minimal 2.1 artifacts without default research or reports ceremony
ok 492 - scaffold emits minimal 2.1 artifacts without default research or reports ceremony
  ---
  duration_ms: 552.691708
  type: 'test'
  ...
# Subtest: strict validator requires numeric IDs, rejects phantom mappings, and grounds research content
ok 493 - strict validator requires numeric IDs, rejects phantom mappings, and grounds research content
  ---
  duration_ms: 1242.11225
  type: 'test'
  ...
# Subtest: validator rejects unsupported or duplicate structured requirement IDs without mining incidental prose
ok 494 - validator rejects unsupported or duplicate structured requirement IDs without mining incidental prose
  ---
  duration_ms: 1589.256083
  type: 'test'
  ...
# Subtest: validator requires substantive Specs v2 task semantics and planned executable proof
ok 495 - validator requires substantive Specs v2 task semantics and planned executable proof
  ---
  duration_ms: 820.241167
  type: 'test'
  ...
# Subtest: all ready non-Direct specs require semantic design and coherent authoring timestamps
ok 496 - all ready non-Direct specs require semantic design and coherent authoring timestamps
  ---
  duration_ms: 5150.59725
  type: 'test'
  ...
# Subtest: spec-ready excludes execution receipts while preserving Strict review state
ok 497 - spec-ready excludes execution receipts while preserving Strict review state
  ---
  duration_ms: 1202.792584
  type: 'test'
  ...
# Subtest: Specs v2 Compact validates without task registry or premature receipt and fails closed on policy shape errors
ok 498 - Specs v2 Compact validates without task registry or premature receipt and fails closed on policy shape errors
  ---
  duration_ms: 671.23925
  type: 'test'
  ...
# Subtest: Specs v2 scaffold keeps planning artifacts independent from assurance and task topology
ok 499 - Specs v2 scaffold keeps planning artifacts independent from assurance and task topology
  ---
  duration_ms: 1679.110875
  type: 'test'
  ...
# Subtest: Full phase scaffold fills canonical 2.1 artifacts and passes E2E validation
ok 500 - Full phase scaffold fills canonical 2.1 artifacts and passes E2E validation
  ---
  duration_ms: 1210.107875
  type: 'test'
  ...
# Subtest: producer scaffold projects typed dependency deliverable into registry edges
ok 501 - producer scaffold projects typed dependency deliverable into registry edges
  ---
  duration_ms: 292.555667
  type: 'test'
  ...
# Subtest: validator rejects missing explicit requirement and sub-criterion mappings
ok 502 - validator rejects missing explicit requirement and sub-criterion mappings
  ---
  duration_ms: 842.012
  type: 'test'
  ...
# Subtest: v1 adapter rejects unknown, missing, and divergent contract copies
ok 503 - v1 adapter rejects unknown, missing, and divergent contract copies
  ---
  duration_ms: 1722.698709
  type: 'test'
  ...
# Subtest: validator rejects invalid ready approval and validation transitions
ok 504 - validator rejects invalid ready approval and validation transitions
  ---
  duration_ms: 570.984
  type: 'test'
  ...
# Subtest: validator rejects precise square-bracket placeholders without flagging links or checkboxes
ok 505 - validator rejects precise square-bracket placeholders without flagging links or checkboxes
  ---
  duration_ms: 760.9885
  type: 'test'
  ...
# Subtest: validator rejects malformed Related Files and dependency topology
ok 506 - validator rejects malformed Related Files and dependency topology
  ---
  duration_ms: 1157.122375
  type: 'test'
  ...
# Subtest: scaffold validates one dependency map before writes and persists canonical registry edges
ok 507 - scaffold validates one dependency map before writes and persists canonical registry edges
  ---
  duration_ms: 431.990417
  type: 'test'
  ...
# Subtest: task-level (P) requires dependency-free and non-overlapping task ownership
ok 508 - task-level (P) requires dependency-free and non-overlapping task ownership
  ---
  duration_ms: 809.511458
  type: 'test'
  ...
# Subtest: validator rejects dependency drift and non-canonical readiness statuses
ok 509 - validator rejects dependency drift and non-canonical readiness statuses
  ---
  duration_ms: 5104.302333
  type: 'test'
  ...
# Subtest: v1 Critical implementation obligations validate ownership, references, closure, and proof
ok 510 - v1 Critical implementation obligations validate ownership, references, closure, and proof
  ---
  duration_ms: 4093.429458
  type: 'test'
  ...
# Subtest: grounding rejects empty sections, unsafe paths, unsupported actions, and zero-match globs
ok 511 - grounding rejects empty sections, unsafe paths, unsupported actions, and zero-match globs
  ---
  duration_ms: 975.730875
  type: 'test'
  ...
# Subtest: validator enforces Read before Modify for existing implementation
ok 512 - validator enforces Read before Modify for existing implementation
  ---
  duration_ms: 691.963333
  type: 'test'
  ...
# Subtest: validator rejects reachability without concrete anchor and accepts with path
ok 513 - validator rejects reachability without concrete anchor and accepts with path
  ---
  duration_ms: 166.732541
  type: 'test'
  ...
# Subtest: validator keeps contract blocks opt-in regardless of task count
ok 514 - validator keeps contract blocks opt-in regardless of task count
  ---
  duration_ms: 186.627959
  type: 'test'
  ...
# Subtest: grounding treats Create on existing file as error
ok 515 - grounding treats Create on existing file as error
  ---
  duration_ms: 160.919417
  type: 'test'
  ...
# Subtest: validator scopes requirement mapping to structured section, incidental mention does not cover
ok 516 - validator scopes requirement mapping to structured section, incidental mention does not cover
  ---
  duration_ms: 174.751625
  type: 'test'
  ...
# Subtest: validator enforces Create before Read/Modify/Delete within same task and cross-task dependencies
ok 517 - validator enforces Create before Read/Modify/Delete within same task and cross-task dependencies
  ---
  duration_ms: 1532.1535
  type: 'test'
  ...
# Subtest: grounding enforces Create ordering and cross-task dependency
ok 518 - grounding enforces Create ordering and cross-task dependency
  ---
  duration_ms: 869.400083
  type: 'test'
  ...
# Subtest: grounding fails closed when cross-task producer exists but registry missing
ok 519 - grounding fails closed when cross-task producer exists but registry missing
  ---
  duration_ms: 664.777417
  type: 'test'
  ...
# Subtest: benchmark gate fails Critical when both arms correctness is zero
ok 520 - benchmark gate fails Critical when both arms correctness is zero
  ---
  duration_ms: 166.824708
  type: 'test'
  ...
# Subtest: benchmark validate handles empty and invalid evidence as not-ready/invalid
ok 521 - benchmark validate handles empty and invalid evidence as not-ready/invalid
  ---
  duration_ms: 315.926334
  type: 'test'
  ...
# Subtest: D12: semantic-firewall test discovery finds R0-01's required basenames in the real checkout
ok 522 - D12: semantic-firewall test discovery finds R0-01's required basenames in the real checkout
  ---
  duration_ms: 2.470375
  type: 'test'
  ...
# Subtest: D12: run-skill-self-tests.mjs sentinel exits nonzero immediately when a required semantic-firewall basename is missing
ok 523 - D12: run-skill-self-tests.mjs sentinel exits nonzero immediately when a required semantic-firewall basename is missing
  ---
  duration_ms: 174.726167
  type: 'test'
  ...
# Subtest: R0-01 owned change-firewall contract surface (D1/C15) is reachable: every named export and owned anchor target exists
ok 524 - R0-01 owned change-firewall contract surface (D1/C15) is reachable: every named export and owned anchor target exists
  ---
  duration_ms: 3.390375
  type: 'test'
  ...
# Subtest: D11/R1.14: the legacy-bridge precondition artifact is reachable and change-firewall.cjs asserts its exact schema
ok 525 - D11/R1.14: the legacy-bridge precondition artifact is reachable and change-firewall.cjs asserts its exact schema
  ---
  duration_ms: 15.539584
  type: 'test'
  ...
1..525
# tests 525
# suites 0
# pass 524
# fail 0
# cancelled 0
# skipped 1
# todo 0
# duration_ms 180975.157834

[skill-test] hook behavioral tests
TAP version 13
# Subtest: claude: authoring, partial execution, done-before-closeout, and stop loops are silent
ok 1 - claude: authoring, partial execution, done-before-closeout, and stop loops are silent
  ---
  duration_ms: 1980.197209
  type: 'test'
  ...
# Subtest: claude: exact user approval is one-time and runtime-bound
ok 2 - claude: exact user approval is one-time and runtime-bound
  ---
  duration_ms: 7318.540458
  type: 'test'
  ...
# Subtest: claude: valid Critical closeout succeeds only after exact approval
ok 3 - claude: valid Critical closeout succeeds only after exact approval
  ---
  duration_ms: 5501.428916
  type: 'test'
  ...
# Subtest: claude: wrong nonce/session/target and forged approval fields never grant
ok 4 - claude: wrong nonce/session/target and forged approval fields never grant
  ---
  duration_ms: 1974.059333
  type: 'test'
  ...
# Subtest: claude: status, policy, registry, and artifact/proof mutation invalidate approval
ok 5 - claude: status, policy, registry, and artifact/proof mutation invalidate approval
  ---
  duration_ms: 2676.9275
  type: 'test'
  ...
# Subtest: claude: completed, invalid/malformed candidates, Critical fake proofs, and Direct no-spec are fail-closed
ok 6 - claude: completed, invalid/malformed candidates, Critical fake proofs, and Direct no-spec are fail-closed
  ---
  duration_ms: 3277.626
  type: 'test'
  ...
# Subtest: claude: copied, unsigned, MAC-invalid, wrong-key, and project-local grants never authorize
ok 7 - claude: copied, unsigned, MAC-invalid, wrong-key, and project-local grants never authorize
  ---
  duration_ms: 6911.178042
  type: 'test'
  ...
# Subtest: claude: replay and signed-record mutation remain one-use and bound
ok 8 - claude: replay and signed-record mutation remain one-use and bound
  ---
  duration_ms: 4085.807209
  type: 'test'
  ...
# Subtest: claude: policy baseline is recorded before proof completion, survives SessionStart, and blocks Critical to Direct
ok 9 - claude: policy baseline is recorded before proof completion, survives SessionStart, and blocks Critical to Direct
  ---
  duration_ms: 5725.196375
  type: 'test'
  ...
# Subtest: claude: Critical feature A cannot raise ceremony for Compact Routine feature B
ok 10 - claude: Critical feature A cannot raise ceremony for Compact Routine feature B
  ---
  duration_ms: 2169.294417
  type: 'test'
  ...
# Subtest: claude: Critical policy floor survives same-path recreation and a new session
ok 11 - claude: Critical policy floor survives same-path recreation and a new session
  ---
  duration_ms: 3009.689167
  type: 'test'
  ...
# Subtest: claude: project policy floor prevents risk removal without coupling assurance to durable state
ok 12 - claude: project policy floor prevents risk removal without coupling assurance to durable state
  ---
  duration_ms: 1214.825084
  type: 'test'
  ...
# Subtest: claude: missing legacy floor migrates from config while corrupt floor fails closed
ok 13 - claude: missing legacy floor migrates from config while corrupt floor fails closed
  ---
  duration_ms: 3143.671625
  type: 'test'
  ...
# Subtest: claude: configured minimum is stable across feature escalation, while missing policy is blocked
ok 14 - claude: configured minimum is stable across feature escalation, while missing policy is blocked
  ---
  duration_ms: 2730.353791
  type: 'test'
  ...
# Subtest: claude: canonical config minimum applies without inheriting feature policy
ok 15 - claude: canonical config minimum applies without inheriting feature policy
  ---
  duration_ms: 1539.044291
  type: 'test'
  ...
# Subtest: claude: legacy v2 baseline migrates to canonical 2.1 without losing feature history
ok 16 - claude: legacy v2 baseline migrates to canonical 2.1 without losing feature history
  ---
  duration_ms: 2000.719167
  type: 'test'
  ...
# Subtest: claude: explicit target resolves before sibling ambiguity while no target remains ambiguous
ok 17 - claude: explicit target resolves before sibling ambiguity while no target remains ambiguous
  ---
  duration_ms: 2545.220125
  type: 'test'
  ...
# Subtest: codex: authoring, partial execution, done-before-closeout, and stop loops are silent
ok 18 - codex: authoring, partial execution, done-before-closeout, and stop loops are silent
  ---
  duration_ms: 975.690791
  type: 'test'
  ...
# Subtest: codex: exact user approval is one-time and runtime-bound
ok 19 - codex: exact user approval is one-time and runtime-bound
  ---
  duration_ms: 3357.4865
  type: 'test'
  ...
# Subtest: codex: valid Critical closeout succeeds only after exact approval
ok 20 - codex: valid Critical closeout succeeds only after exact approval
  ---
  duration_ms: 3587.019
  type: 'test'
  ...
# Subtest: codex: wrong nonce/session/target and forged approval fields never grant
ok 21 - codex: wrong nonce/session/target and forged approval fields never grant
  ---
  duration_ms: 1746.75625
  type: 'test'
  ...
# Subtest: codex: status, policy, registry, and artifact/proof mutation invalidate approval
ok 22 - codex: status, policy, registry, and artifact/proof mutation invalidate approval
  ---
  duration_ms: 2750.733458
  type: 'test'
  ...
# Subtest: codex: completed, invalid/malformed candidates, Critical fake proofs, and Direct no-spec are fail-closed
ok 23 - codex: completed, invalid/malformed candidates, Critical fake proofs, and Direct no-spec are fail-closed
  ---
  duration_ms: 3519.976792
  type: 'test'
  ...
# Subtest: codex: copied, unsigned, MAC-invalid, wrong-key, and project-local grants never authorize
ok 24 - codex: copied, unsigned, MAC-invalid, wrong-key, and project-local grants never authorize
  ---
  duration_ms: 7884.606583
  type: 'test'
  ...
# Subtest: codex: replay and signed-record mutation remain one-use and bound
ok 25 - codex: replay and signed-record mutation remain one-use and bound
  ---
  duration_ms: 4511.065042
  type: 'test'
  ...
# Subtest: codex: policy baseline is recorded before proof completion, survives SessionStart, and blocks Critical to Direct
ok 26 - codex: policy baseline is recorded before proof completion, survives SessionStart, and blocks Critical to Direct
  ---
  duration_ms: 6098.041709
  type: 'test'
  ...
# Subtest: codex: Critical feature A cannot raise ceremony for Compact Routine feature B
ok 27 - codex: Critical feature A cannot raise ceremony for Compact Routine feature B
  ---
  duration_ms: 2370.415333
  type: 'test'
  ...
# Subtest: codex: Critical policy floor survives same-path recreation and a new session
ok 28 - codex: Critical policy floor survives same-path recreation and a new session
  ---
  duration_ms: 3329.872333
  type: 'test'
  ...
# Subtest: codex: project policy floor prevents risk removal without coupling assurance to durable state
ok 29 - codex: project policy floor prevents risk removal without coupling assurance to durable state
  ---
  duration_ms: 1515.187792
  type: 'test'
  ...
# Subtest: codex: missing legacy floor migrates from config while corrupt floor fails closed
ok 30 - codex: missing legacy floor migrates from config while corrupt floor fails closed
  ---
  duration_ms: 3385.804917
  type: 'test'
  ...
# Subtest: codex: configured minimum is stable across feature escalation, while missing policy is blocked
ok 31 - codex: configured minimum is stable across feature escalation, while missing policy is blocked
  ---
  duration_ms: 2680.806
  type: 'test'
  ...
# Subtest: codex: canonical config minimum applies without inheriting feature policy
ok 32 - codex: canonical config minimum applies without inheriting feature policy
  ---
  duration_ms: 1530.129458
  type: 'test'
  ...
# Subtest: codex: legacy v2 baseline migrates to canonical 2.1 without losing feature history
ok 33 - codex: legacy v2 baseline migrates to canonical 2.1 without losing feature history
  ---
  duration_ms: 2108.554125
  type: 'test'
  ...
# Subtest: codex: explicit target resolves before sibling ambiguity while no target remains ambiguous
ok 34 - codex: explicit target resolves before sibling ambiguity while no target remains ambiguous
  ---
  duration_ms: 2778.556792
  type: 'test'
  ...
# Subtest: Claude hook: CLAUDE_PROJECT_DIR wins over malicious payload.cwd and stale process cwd
ok 35 - Claude hook: CLAUDE_PROJECT_DIR wins over malicious payload.cwd and stale process cwd
  ---
  duration_ms: 1119.186041
  type: 'test'
  ...
# Subtest: installed scaffold observes Critical policy before Stop and source scaffold does not touch authority state
ok 36 - installed scaffold observes Critical policy before Stop and source scaffold does not touch authority state
  ---
  duration_ms: 493.883083
  type: 'test'
  ...
# Subtest: canonical final-state decision rejects every stale mutation class before execution proof
ok 37 - canonical final-state decision rejects every stale mutation class before execution proof
  ---
  duration_ms: 72.868584
  type: 'test'
  ...
# Subtest: schema 2.1 lifecycle vocabulary is exact and legacy aliases stay in the legacy adapter
ok 38 - schema 2.1 lifecycle vocabulary is exact and legacy aliases stay in the legacy adapter
  ---
  duration_ms: 2.850333
  type: 'test'
  ...
# Subtest: final-state authority loads the validator CommonJS API directly and propagates canonical failures
ok 39 - final-state authority loads the validator CommonJS API directly and propagates canonical failures
  ---
  duration_ms: 77.359667
  type: 'test'
  ...
# Subtest: persisted resolver isolates exact explicit target from malformed siblings and scans globally only without target
ok 40 - persisted resolver isolates exact explicit target from malformed siblings and scans globally only without target
  ---
  duration_ms: 212.27375
  type: 'test'
  ...
# Subtest: PreCompact records branch, HEAD, dirty count and the in-flight task
ok 41 - PreCompact records branch, HEAD, dirty count and the in-flight task
  ---
  duration_ms: 403.660916
  type: 'test'
  ...
# Subtest: a compact restart prints the captured anchors alongside the authorization warning
ok 42 - a compact restart prints the captured anchors alongside the authorization warning
  ---
  duration_ms: 809.537
  type: 'test'
  ...
# Subtest: a compact restart without a capture still prints the warning and nothing invented
ok 43 - a compact restart without a capture still prints the warning and nothing invented
  ---
  duration_ms: 569.549792
  type: 'test'
  ...
# Subtest: a normal session start prints no compaction anchors
ok 44 - a normal session start prints no compaction anchors
  ---
  duration_ms: 950.808584
  type: 'test'
  ...
# Subtest: PreCompact fails open outside a repository and on malformed input
ok 45 - PreCompact fails open outside a repository and on malformed input
  ---
  duration_ms: 610.215208
  type: 'test'
  ...
# Subtest: asks natively for a direct Read of .env
ok 46 - asks natively for a direct Read of .env
  ---
  duration_ms: 184.369958
  type: 'test'
  ...
# Subtest: asks for a symlink whose target is .env (regression: symlink bypass)
ok 47 - asks for a symlink whose target is .env (regression: symlink bypass)
  ---
  duration_ms: 171.782666
  type: 'test'
  ...
# Subtest: allows a normal non-sensitive file (exit 0)
ok 48 - allows a normal non-sensitive file (exit 0)
  ---
  duration_ms: 153.244166
  type: 'test'
  ...
# Subtest: allows a symlink to an exempt .env.example (exemption still wins)
ok 49 - allows a symlink to an exempt .env.example (exemption still wins)
  ---
  duration_ms: 174.062791
  type: 'test'
  ...
# Subtest: an exempt-looking symlink to .env still asks based on its target
ok 50 - an exempt-looking symlink to .env still asks based on its target
  ---
  duration_ms: 167.94775
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: cat ".env"
ok 51 - asks natively for Bash sensitive reference: cat ".env"
  ---
  duration_ms: 191.119541
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: cat .env
ok 52 - asks natively for Bash sensitive reference: cat .env
  ---
  duration_ms: 229.9645
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: cat .env*
ok 53 - asks natively for Bash sensitive reference: cat .env*
  ---
  duration_ms: 206.318542
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: sed -n 1p .env
ok 54 - asks natively for Bash sensitive reference: sed -n 1p .env
  ---
  duration_ms: 185.8145
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: bash -c 'sed -n 1p .env'
ok 55 - asks natively for Bash sensitive reference: bash -c 'sed -n 1p .env'
  ---
  duration_ms: 180.083417
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: python3 -c "open('.env').read()"
ok 56 - asks natively for Bash sensitive reference: python3 -c "open('.env').read()"
  ---
  duration_ms: 185.402833
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: node -e "fs.readFileSync('.env')"
ok 57 - asks natively for Bash sensitive reference: node -e "fs.readFileSync('.env')"
  ---
  duration_ms: 232.712458
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: bash -c 'cat .e''nv'
ok 58 - asks natively for Bash sensitive reference: bash -c 'cat .e''nv'
  ---
  duration_ms: 212.657125
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: cat .e\\\\nnv
ok 59 - asks natively for Bash sensitive reference: cat .e\\\\nnv
  ---
  duration_ms: 259.315167
  type: 'test'
  ...
# Subtest: asks natively for Bash sensitive reference: cat $'\\x2e\\x65\\x6e\\x76'
ok 60 - asks natively for Bash sensitive reference: cat $'\\x2e\\x65\\x6e\\x76'
  ---
  duration_ms: 303.860125
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: cat ~/.ssh/id_rsa
ok 61 - asks for sensitive name via expansion or file-shaped option: cat ~/.ssh/id_rsa
  ---
  duration_ms: 209.625083
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: cat ~/.aws/credentials
ok 62 - asks for sensitive name via expansion or file-shaped option: cat ~/.aws/credentials
  ---
  duration_ms: 199.999708
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: cat certs/*.pem
ok 63 - asks for sensitive name via expansion or file-shaped option: cat certs/*.pem
  ---
  duration_ms: 312.812166
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: ssh -i ~/.ssh/id_ed25519 host
ok 64 - asks for sensitive name via expansion or file-shaped option: ssh -i ~/.ssh/id_ed25519 host
  ---
  duration_ms: 200.058416
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: docker compose --env-file .env up
ok 65 - asks for sensitive name via expansion or file-shaped option: docker compose --env-file .env up
  ---
  duration_ms: 224.674167
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: curl --config ~/.netrc https://example.com
ok 66 - asks for sensitive name via expansion or file-shaped option: curl --config ~/.netrc https://example.com
  ---
  duration_ms: 230.13025
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: kubectl --kubeconfig ~/.kube/kubeconfig get pods
ok 67 - asks for sensitive name via expansion or file-shaped option: kubectl --kubeconfig ~/.kube/kubeconfig get pods
  ---
  duration_ms: 185.61225
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: openssl rsa -in server.key
ok 68 - asks for sensitive name via expansion or file-shaped option: openssl rsa -in server.key
  ---
  duration_ms: 211.188334
  type: 'test'
  ...
# Subtest: asks for sensitive name via expansion or file-shaped option: cat secrets.yaml
ok 69 - asks for sensitive name via expansion or file-shaped option: cat secrets.yaml
  ---
  duration_ms: 217.901875
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: echo .env
ok 70 - allows naming a secret without reading it: echo .env
  ---
  duration_ms: 183.445292
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: echo "update .env"
ok 71 - allows naming a secret without reading it: echo "update .env"
  ---
  duration_ms: 172.651708
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: echo .envoy
ok 72 - allows naming a secret without reading it: echo .envoy
  ---
  duration_ms: 145.248584
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: echo not.env
ok 73 - allows naming a secret without reading it: echo not.env
  ---
  duration_ms: 148.8995
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: printf '%s\\n' .env
ok 74 - allows naming a secret without reading it: printf '%s\\n' .env
  ---
  duration_ms: 161.208958
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: git log -- .env
ok 75 - allows naming a secret without reading it: git log -- .env
  ---
  duration_ms: 175.406416
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: git status sessions.md
ok 76 - allows naming a secret without reading it: git status sessions.md
  ---
  duration_ms: 178.155291
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: grep .env README.md
ok 77 - allows naming a secret without reading it: grep .env README.md
  ---
  duration_ms: 173.7455
  type: 'test'
  ...
# Subtest: allows naming a secret without reading it: sed -n '/.env/p' README.md
ok 78 - allows naming a secret without reading it: sed -n '/.env/p' README.md
  ---
  duration_ms: 157.276333
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat $FILE
ok 79 - allows pure indirection with no sensitive literal: cat $FILE
  ---
  duration_ms: 156.993208
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat "$FILE"
ok 80 - allows pure indirection with no sensitive literal: cat "$FILE"
  ---
  duration_ms: 146.676875
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat ${FILE}
ok 81 - allows pure indirection with no sensitive literal: cat ${FILE}
  ---
  duration_ms: 155.951166
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat $1
ok 82 - allows pure indirection with no sensitive literal: cat $1
  ---
  duration_ms: 150.125375
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat $(echo .env)
ok 83 - allows pure indirection with no sensitive literal: cat $(echo .env)
  ---
  duration_ms: 149.104166
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat `echo .env`
ok 84 - allows pure indirection with no sensitive literal: cat `echo .env`
  ---
  duration_ms: 147.184209
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: head $SECRET
ok 85 - allows pure indirection with no sensitive literal: head $SECRET
  ---
  duration_ms: 138.146584
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: tail ${MY_FILE}
ok 86 - allows pure indirection with no sensitive literal: tail ${MY_FILE}
  ---
  duration_ms: 156.831625
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: less "$HOME/.env"
ok 87 - allows pure indirection with no sensitive literal: less "$HOME/.env"
  ---
  duration_ms: 144.183
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat README.md $EXTRA
ok 88 - allows pure indirection with no sensitive literal: cat README.md $EXTRA
  ---
  duration_ms: 155.461041
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: echo ok; cat README.md $FILE
ok 89 - allows pure indirection with no sensitive literal: echo ok; cat README.md $FILE
  ---
  duration_ms: 148.019084
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat README.md | head $FILE
ok 90 - allows pure indirection with no sensitive literal: cat README.md | head $FILE
  ---
  duration_ms: 142.340208
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: bash -c 'cat $FILE'
ok 91 - allows pure indirection with no sensitive literal: bash -c 'cat $FILE'
  ---
  duration_ms: 135.602458
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: echo $(cat $FILE)
ok 92 - allows pure indirection with no sensitive literal: echo $(cat $FILE)
  ---
  duration_ms: 141.03625
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: env -u UNUSED cat "$FILE"
ok 93 - allows pure indirection with no sensitive literal: env -u UNUSED cat "$FILE"
  ---
  duration_ms: 145.850708
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: timeout 1 cat "$FILE"
ok 94 - allows pure indirection with no sensitive literal: timeout 1 cat "$FILE"
  ---
  duration_ms: 144.17925
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: nice -n 10 cat "$FILE"
ok 95 - allows pure indirection with no sensitive literal: nice -n 10 cat "$FILE"
  ---
  duration_ms: 149.509708
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: eval 'cat "$FILE"'
ok 96 - allows pure indirection with no sensitive literal: eval 'cat "$FILE"'
  ---
  duration_ms: 141.841833
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: find . -exec sh -c 'cat "$FILE"' \\;
ok 97 - allows pure indirection with no sensitive literal: find . -exec sh -c 'cat "$FILE"' \\;
  ---
  duration_ms: 163.904625
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: source "$FILE"
ok 98 - allows pure indirection with no sensitive literal: source "$FILE"
  ---
  duration_ms: 160.568917
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: xargs -a "$LIST" cat
ok 99 - allows pure indirection with no sensitive literal: xargs -a "$LIST" cat
  ---
  duration_ms: 148.875333
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: python3 -c 'open(os.environ["FILE"]).read()'
ok 100 - allows pure indirection with no sensitive literal: python3 -c 'open(os.environ["FILE"]).read()'
  ---
  duration_ms: 142.601958
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: node -e 'fs.readFileSync(process.env.FILE)'
ok 101 - allows pure indirection with no sensitive literal: node -e 'fs.readFileSync(process.env.FILE)'
  ---
  duration_ms: 130.118542
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat < "$FILE"
ok 102 - allows pure indirection with no sensitive literal: cat < "$FILE"
  ---
  duration_ms: 141.331125
  type: 'test'
  ...
# Subtest: allows pure indirection with no sensitive literal: cat -n "$FILE"
ok 103 - allows pure indirection with no sensitive literal: cat -n "$FILE"
  ---
  duration_ms: 128.682333
  type: 'test'
  ...
# Subtest: allows a quoted-delimiter heredoc whose body quotes a read command
ok 104 - allows a quoted-delimiter heredoc whose body quotes a read command
  ---
  duration_ms: 144.690792
  type: 'test'
  ...
# Subtest: still asks for an unquoted-delimiter heredoc that does expand a read
ok 105 - still asks for an unquoted-delimiter heredoc that does expand a read
  ---
  duration_ms: 161.352083
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: echo $VAR
ok 106 - allows harmless dynamic / safe static with extra var: echo $VAR
  ---
  duration_ms: 130.31825
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: echo "$HOME"
ok 107 - allows harmless dynamic / safe static with extra var: echo "$HOME"
  ---
  duration_ms: 126.786583
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: git status
ok 108 - allows harmless dynamic / safe static with extra var: git status
  ---
  duration_ms: 125.970542
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: git status $VAR
ok 109 - allows harmless dynamic / safe static with extra var: git status $VAR
  ---
  duration_ms: 116.387458
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat README.md
ok 110 - allows harmless dynamic / safe static with extra var: cat README.md
  ---
  duration_ms: 122.801708
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat .env.example
ok 111 - allows harmless dynamic / safe static with extra var: cat .env.example
  ---
  duration_ms: 128.58625
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat .env.sample
ok 112 - allows harmless dynamic / safe static with extra var: cat .env.sample
  ---
  duration_ms: 115.84725
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat .env.template
ok 113 - allows harmless dynamic / safe static with extra var: cat .env.template
  ---
  duration_ms: 116.03775
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat .env.test
ok 114 - allows harmless dynamic / safe static with extra var: cat .env.test
  ---
  duration_ms: 120.722625
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat '$FILE'
ok 115 - allows harmless dynamic / safe static with extra var: cat '$FILE'
  ---
  duration_ms: 130.310875
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat '$HOME/README.md'
ok 116 - allows harmless dynamic / safe static with extra var: cat '$HOME/README.md'
  ---
  duration_ms: 135.044625
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat README.md '$EXTRA'
ok 117 - allows harmless dynamic / safe static with extra var: cat README.md '$EXTRA'
  ---
  duration_ms: 130.633125
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat README.md '*'
ok 118 - allows harmless dynamic / safe static with extra var: cat README.md '*'
  ---
  duration_ms: 345.747875
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat README.md '~'
ok 119 - allows harmless dynamic / safe static with extra var: cat README.md '~'
  ---
  duration_ms: 165.51225
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat README.md '{README.md,LICENSE}'
ok 120 - allows harmless dynamic / safe static with extra var: cat README.md '{README.md,LICENSE}'
  ---
  duration_ms: 135.99625
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: echo '$(cat $FILE)'
ok 121 - allows harmless dynamic / safe static with extra var: echo '$(cat $FILE)'
  ---
  duration_ms: 154.326875
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat ~/.zshrc
ok 122 - allows harmless dynamic / safe static with extra var: cat ~/.zshrc
  ---
  duration_ms: 164.432459
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: wc -l README.md
ok 123 - allows harmless dynamic / safe static with extra var: wc -l README.md
  ---
  duration_ms: 161.15
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: cat *.md
ok 124 - allows harmless dynamic / safe static with extra var: cat *.md
  ---
  duration_ms: 129.936167
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: du -sh */
ok 125 - allows harmless dynamic / safe static with extra var: du -sh */
  ---
  duration_ms: 120.364625
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: python3 -c "print(os.environ['HOME'])"
ok 126 - allows harmless dynamic / safe static with extra var: python3 -c "print(os.environ['HOME'])"
  ---
  duration_ms: 123.312458
  type: 'test'
  ...
# Subtest: allows harmless dynamic / safe static with extra var: head -n "$COUNT" README.md
ok 127 - allows harmless dynamic / safe static with extra var: head -n "$COUNT" README.md
  ---
  duration_ms: 120.044208
  type: 'test'
  ...
# Subtest: an assignment naming a secret does not ask, with or without a later read
ok 128 - an assignment naming a secret does not ask, with or without a later read
  ---
  duration_ms: 380.388875
  type: 'test'
  ...
# Subtest: asks for dangling symlink aimed at protected target (regression: broken-link fail-open)
ok 129 - asks for dangling symlink aimed at protected target (regression: broken-link fail-open)
  ---
  duration_ms: 133.306625
  type: 'test'
  ...
# Subtest: allows dangling symlink to benign file and to allowed example
ok 130 - allows dangling symlink to benign file and to allowed example
  ---
  duration_ms: 229.578292
  type: 'test'
  ...
# Subtest: still allows real link to allowed example (regression: real link to .env.example)
ok 131 - still allows real link to allowed example (regression: real link to .env.example)
  ---
  duration_ms: 115.753709
  type: 'test'
  ...
# Subtest: fails closed on malformed/looping symlink (hop limit)
ok 132 - fails closed on malformed/looping symlink (hop limit)
  ---
  duration_ms: 132.162458
  type: 'test'
  ...
# Subtest: Claude and Codex observe equivalent allowlisted SubagentStop claims with HMAC integrity
ok 133 - Claude and Codex observe equivalent allowlisted SubagentStop claims with HMAC integrity
  ---
  duration_ms: 4893.793709
  type: 'test'
  ...
# Subtest: observation rejects wrong identity, digest, verdict, tampered MAC, copied record, and self-authored strings
ok 134 - observation rejects wrong identity, digest, verdict, tampered MAC, copied record, and self-authored strings
  ---
  duration_ms: 2857.964875
  type: 'test'
  ...
# Subtest: SubagentStop markers and claimed capabilities cannot turn a non-reviewer into authority
ok 135 - SubagentStop markers and claimed capabilities cannot turn a non-reviewer into authority
  ---
  duration_ms: 3454.322958
  type: 'test'
  ...
# Subtest: canonicalizes and contains the validator before semantic digest spawn
ok 136 - canonicalizes and contains the validator before semantic digest spawn
  ---
  duration_ms: 3438.659583
  type: 'test'
  ...
# Subtest: rejects scratch/spec.json and traversal feature identities
ok 137 - rejects scratch/spec.json and traversal feature identities
  ---
  duration_ms: 1520.368208
  type: 'test'
  ...
# Subtest: code-auditor agent ships Strict conditional marker contract
ok 138 - code-auditor agent ships Strict conditional marker contract
  ---
  duration_ms: 1.425083
  type: 'test'
  ...
# Subtest: session.cjs escapes shell metacharacters in GIT_BRANCH (no injection when sourced)
ok 139 - session.cjs escapes shell metacharacters in GIT_BRANCH (no injection when sourced)
  ---
  duration_ms: 576.010334
  type: 'test'
  ...
# Subtest: CLAUDE_PROJECT_DIR wins over malicious payload.cwd and stale process cwd
ok 140 - CLAUDE_PROJECT_DIR wins over malicious payload.cwd and stale process cwd
  ---
  duration_ms: 783.9175
  type: 'test'
  ...
# Subtest: 1. newly-done task WITHOUT receipt → block, reason names task path
ok 141 - 1. newly-done task WITHOUT receipt → block, reason names task path
  ---
  duration_ms: 1184.3705
  type: 'test'
  ...
# Subtest: installed Claude gate fails closed with a controlled decision when policy is missing or malformed
ok 142 - installed Claude gate fails closed with a controlled decision when policy is missing or malformed
  ---
  duration_ms: 1027.796083
  type: 'test'
  ...
# Subtest: Claude adapter requires canonical SHA-256 only for a declared task artifact
ok 143 - Claude adapter requires canonical SHA-256 only for a declared task artifact
  ---
  duration_ms: 6801.532
  type: 'test'
  ...
# Subtest: Claude artifact verification rejects traversal and symlink paths
ok 144 - Claude artifact verification rejects traversal and symlink paths
  ---
  duration_ms: 2575.4155
  type: 'test'
  ...
# Subtest: 2. newly-done task WITH valid receipt → no block, cache updated
ok 145 - 2. newly-done task WITH valid receipt → no block, cache updated
  ---
  duration_ms: 1232.197
  type: 'test'
  ...
# Subtest: 3. no active spec → exit 0 silent
ok 146 - 3. no active spec → exit 0 silent
  ---
  duration_ms: 247.187833
  type: 'test'
  ...
# Subtest: 4. stop_hook_active: true → exit 0 silent even with violating task
ok 147 - 4. stop_hook_active: true → exit 0 silent even with violating task
  ---
  duration_ms: 389.663292
  type: 'test'
  ...
# Subtest: 4b. done task before explicit closeout without receipt blocks
ok 148 - 4b. done task before explicit closeout without receipt blocks
  ---
  duration_ms: 408.388
  type: 'test'
  ...
# Subtest: 4c. done task before explicit closeout with valid task receipt is silent
ok 149 - 4c. done task before explicit closeout with valid task receipt is silent
  ---
  duration_ms: 702.636375
  type: 'test'
  ...
# Subtest: 5. first run (no cache) with done-without-receipt → block (cache is not truth)
ok 150 - 5. first run (no cache) with done-without-receipt → block (cache is not truth)
  ---
  duration_ms: 633.150292
  type: 'test'
  ...
# Subtest: 6. forged payload, session, and context cannot bypass completion_gate=false
ok 151 - 6. forged payload, session, and context cannot bypass completion_gate=false
  ---
  duration_ms: 437.887
  type: 'test'
  ...
# Subtest: empty or malformed Claude hook payload fails closed
ok 152 - empty or malformed Claude hook payload fails closed
  ---
  duration_ms: 327.3405
  type: 'test'
  ...
# Subtest: explicit Strict completion ignores worker-writable proof strings and remains blocked
ok 153 - explicit Strict completion ignores worker-writable proof strings and remains blocked
  ---
  duration_ms: 1350.146792
  type: 'test'
  ...
  ---
  duration_ms: 647.406
  type: 'test'
  ...
# Subtest: 8. explicit failure cannot pass even when PASS text is present
ok 155 - 8. explicit failure cannot pass even when PASS text is present
  ---
  duration_ms: 632.856833
  type: 'test'
  ...
# Subtest: 9. a code fence alone is not verification proof
ok 156 - 9. a code fence alone is not verification proof
  ---
  duration_ms: 632.530667
  type: 'test'
  ...
# Subtest: 10. completed_at must be a valid ISO timestamp
ok 157 - 10. completed_at must be a valid ISO timestamp
  ---
  duration_ms: 725.837416
  type: 'test'
  ...
# Subtest: 11. done → pending cache transition is persisted and explicit closeout gates re-completion
ok 158 - 11. done → pending cache transition is persisted and explicit closeout gates re-completion
  ---
  duration_ms: 984.689042
  type: 'test'
  ...
# Subtest: 12. legacy successful receipt remains read-compatible
ok 159 - 12. legacy successful receipt remains read-compatible
  ---
  duration_ms: 739.1115
  type: 'test'
  ...
# Subtest: 13. provenance requires both Base and Head - only Base fails
ok 160 - 13. provenance requires both Base and Head - only Base fails
  ---
  duration_ms: 738.365375
  type: 'test'
  ...
# Subtest: 14. provenance requires both Base and Head - only Head fails
ok 161 - 14. provenance requires both Base and Head - only Head fails
  ---
  duration_ms: 629.873917
  type: 'test'
  ...
# Subtest: 15. provenance with both Base and Head passes
ok 162 - 15. provenance with both Base and Head passes
  ---
  duration_ms: 785.921375
  type: 'test'
  ...
# Subtest: 16. registry task path with ../ escape or sibling-prefix is rejected (check a)
ok 163 - 16. registry task path with ../ escape or sibling-prefix is rejected (check a)
  ---
  duration_ms: 548.073833
  type: 'test'
  ...
# Subtest: 17. empty or bare provenance fails — Base:/Head: require non-empty same-line values
ok 164 - 17. empty or bare provenance fails — Base:/Head: require non-empty same-line values
  ---
  duration_ms: 4685.675083
  type: 'test'
  ...
# Subtest: 18. valid non-empty Base: value and base_sha: value pass
ok 165 - 18. valid non-empty Base: value and base_sha: value pass
  ---
  duration_ms: 2072.902541
  type: 'test'
  ...
# Subtest: 19. cache-hit: unchanged valid receipt stays PASS on second Stop (revalidation)
ok 166 - 19. cache-hit: unchanged valid receipt stays PASS on second Stop (revalidation)
  ---
  duration_ms: 1305.458292
  type: 'test'
  ...
# Subtest: 20. cache-hit: receipt mutation (removed Verification/Command) blocks even though status stays done
ok 167 - 20. cache-hit: receipt mutation (removed Verification/Command) blocks even though status stays done
  ---
  duration_ms: 1890.064458
  type: 'test'
  ...
# Subtest: 21. cache-hit: provenance mutation (removed Head / changed to stale) blocks
ok 168 - 21. cache-hit: provenance mutation (removed Head / changed to stale) blocks
  ---
  duration_ms: 1914.7765
  type: 'test'
  ...
# Subtest: 22. cache-hit: deleted task file blocks even though spec still says done
ok 169 - 22. cache-hit: deleted task file blocks even though spec still says done
  ---
  duration_ms: 1145.904833
  type: 'test'
  ...
# Subtest: 23. malformed cache JSON does not bypass validation
ok 170 - 23. malformed cache JSON does not bypass validation
  ---
  duration_ms: 1239.499958
  type: 'test'
  ...
# Subtest: 24. first-run (no cache file) with valid receipt passes and seeds cache
ok 171 - 24. first-run (no cache file) with valid receipt passes and seeds cache
  ---
  duration_ms: 733.362125
  type: 'test'
  ...
# Subtest: 25. placeholder tokens Command: TODO / Base: TBD / artifact sha256 empty must block
ok 172 - 25. placeholder tokens Command: TODO / Base: TBD / artifact sha256 empty must block
  ---
  duration_ms: 4420.822709
  type: 'test'
  ...
# Subtest: 26. explicit failure outcomes Tests failed / Result FAIL and multiple Results must block
ok 173 - 26. explicit failure outcomes Tests failed / Result FAIL and multiple Results must block
  ---
  duration_ms: 1869.586375
  type: 'test'
  ...
# Subtest: 27. task markdown symlink outside feature must be rejected (check a)
ok 174 - 27. task markdown symlink outside feature must be rejected (check a)
  ---
  duration_ms: 496.083084
  type: 'test'
  ...
# Subtest: 28. malformed spec.json must block with invalid_specs
ok 175 - 28. malformed spec.json must block with invalid_specs
  ---
  duration_ms: 175.401875
  type: 'test'
  ...
# Subtest: 29. specs/linked symlink outside must be explicit_malformed and non-explicit scan must not count it
ok 176 - 29. specs/linked symlink outside must be explicit_malformed and non-explicit scan must not count it
  ---
  duration_ms: 251.380833
  type: 'test'
  ...
# Subtest: 30. phantom vectors via gate evidence must block with verification_state (r3)
ok 177 - 30. phantom vectors via gate evidence must block with verification_state (r3)
  ---
  duration_ms: 37459.290375
  type: 'test'
  ...
# Subtest: 31. process-v3 done task without inline Receipt blocks
ok 178 - 31. process-v3 done task without inline Receipt blocks
  ---
  duration_ms: 398.260708
  type: 'test'
  ...
# Subtest: 32. process-v3 requires Receipt heading and runtime-bound provenance
ok 179 - 32. process-v3 requires Receipt heading and runtime-bound provenance
  ---
  duration_ms: 1172.706125
  type: 'test'
  ...
# Subtest: 32b. process-v3 ignores a Receipt heading and proof contained only in a fence
ok 180 - 32b. process-v3 ignores a Receipt heading and proof contained only in a fence
  ---
  duration_ms: 401.86325
  type: 'test'
  ...
# Subtest: 32c. process-v3 ignores canonical Receipt fields contained only in its output fence
ok 181 - 32c. process-v3 ignores canonical Receipt fields contained only in its output fence
  ---
  duration_ms: 767.338042
  type: 'test'
  ...
# Subtest: 32d. process-v3 preserves explicit failures from the Receipt output fence
ok 182 - 32d. process-v3 preserves explicit failures from the Receipt output fence
  ---
  duration_ms: 720.941083
  type: 'test'
  ...
# Subtest: 32e. process-v3 rejects output whose closing fence is shorter than its opener
ok 183 - 32e. process-v3 rejects output whose closing fence is shorter than its opener
  ---
  duration_ms: 711.014459
  type: 'test'
  ...
# Subtest: 33. process-v3 done task with canonical inline Receipt passes
ok 184 - 33. process-v3 done task with canonical inline Receipt passes
  ---
  duration_ms: 705.665
  type: 'test'
  ...
# Subtest: 34. process-v3 Receipt command must match the exact Verification Plan command
ok 185 - 34. process-v3 Receipt command must match the exact Verification Plan command
  ---
  duration_ms: 722.511875
  type: 'test'
  ...
# Subtest: 35. process-v3 Stop ignores a completed packet when one packet remains active
ok 186 - 35. process-v3 Stop ignores a completed packet when one packet remains active
  ---
  duration_ms: 424.456667
  type: 'test'
  ...
# Subtest: 36. process-v3 Stop accepts two completed packets with valid Receipts
ok 187 - 36. process-v3 Stop accepts two completed packets with valid Receipts
  ---
  duration_ms: 1262.891625
  type: 'test'
  ...
# Subtest: 37. committed receipt on a clean tree survives later commits
ok 188 - 37. committed receipt on a clean tree survives later commits
  ---
  duration_ms: 735.750083
  type: 'test'
  ...
# Subtest: 38. an uncommitted task file is not bound to live Base and Head
ok 189 - 38. an uncommitted task file is not bound to live Base and Head
  ---
  duration_ms: 769.561208
  type: 'test'
  ...
# Subtest: 38b. the same stale receipt is accepted once committed on a clean tree
ok 190 - 38b. the same stale receipt is accepted once committed on a clean tree
  ---
  duration_ms: 744.3195
  type: 'test'
  ...
# Subtest: 39. a staged task file reads the same as an uncommitted one
ok 191 - 39. a staged task file reads the same as an uncommitted one
  ---
  duration_ms: 716.97725
  type: 'test'
  ...
# Subtest: 40. modified receipt requires binding
ok 192 - 40. modified receipt requires binding
  ---
  duration_ms: 945.411625
  type: 'test'
  ...
# Subtest: 41. unborn HEAD fails closed before any receipt check
ok 193 - 41. unborn HEAD fails closed before any receipt check
  ---
  duration_ms: 154.816
  type: 'test'
  ...
# Subtest: 42. a dirty tree outside specs does not reopen a committed receipt
ok 194 - 42. a dirty tree outside specs does not reopen a committed receipt
  ---
  duration_ms: 2720.587042
  type: 'test'
  ...
# Subtest: 42b. skip-worktree and assume-unchanged cannot hide an edited task file
ok 195 - 42b. skip-worktree and assume-unchanged cannot hide an edited task file
  ---
  duration_ms: 1720.188708
  type: 'test'
  ...
# Subtest: 43. structure checks still block in committed mode
ok 196 - 43. structure checks still block in committed mode
  ---
  duration_ms: 763.516792
  type: 'test'
  ...
# Subtest: 43b. committed mode still requires concrete Base and Head fields
ok 197 - 43b. committed mode still requires concrete Base and Head fields
  ---
  duration_ms: 755.963375
  type: 'test'
  ...
# Subtest: 44. edited artifact bytes still block in committed mode
ok 198 - 44. edited artifact bytes still block in committed mode
  ---
  duration_ms: 1195.041375
  type: 'test'
  ...
# Subtest: 45. the cache grants no authority across a state change
ok 199 - 45. the cache grants no authority across a state change
  ---
  duration_ms: 1250.538334
  type: 'test'
  ...
# Subtest: 46. a dirty file inside the specs root does not force binding
ok 200 - 46. a dirty file inside the specs root does not force binding
  ---
  duration_ms: 780.782166
  type: 'test'
  ...
# Subtest: 47. completed-set branch accepts committed receipts and blocks an edited one
ok 201 - 47. completed-set branch accepts committed receipts and blocks an edited one
  ---
  duration_ms: 3301.2385
  type: 'test'
  ...
# Subtest: 51. Receipt fields written as list items are accepted
ok 202 - 51. Receipt fields written as list items are accepted
  ---
  duration_ms: 713.596625
  type: 'test'
  ...
# Subtest: 52. the block names what to change, not just which check failed
ok 203 - 52. the block names what to change, not just which check failed
  ---
  duration_ms: 734.34875
  type: 'test'
  ...
# Subtest: 53. a hand-typed provenance pair is told to re-derive, not to add lines
ok 204 - 53. a hand-typed provenance pair is told to re-derive, not to add lines
  ---
  duration_ms: 821.784125
  type: 'test'
  ...
# Subtest: 49. an unversioned specs root does not keep every receipt bound
ok 205 - 49. an unversioned specs root does not keep every receipt bound
  ---
  duration_ms: 684.694667
  type: 'test'
  ...
# Subtest: 50. an uncommitted task file is still checked, only not against Base and Head
ok 206 - 50. an uncommitted task file is still checked, only not against Base and Head
  ---
  duration_ms: 2242.693958
  type: 'test'
  ...
# Subtest: 48. the gate's own runtime state does not defeat structure mode
ok 207 - 48. the gate's own runtime state does not defeat structure mode
  ---
  duration_ms: 682.585167
  type: 'test'
  ...
# Subtest: 52. a plan with several commands binds the Receipt to the last one
ok 208 - 52. a plan with several commands binds the Receipt to the last one
  ---
  duration_ms: 1803.641417
  type: 'test'
  ...
# Subtest: 53. an indented or sub-heading Command never becomes the canonical one
ok 209 - 53. an indented or sub-heading Command never becomes the canonical one
  ---
  duration_ms: 2791.4595
  type: 'test'
  ...
# Subtest: Claude installed spec-state re-evaluates a standalone task when blocked becomes pending
ok 210 - Claude installed spec-state re-evaluates a standalone task when blocked becomes pending
  ---
  duration_ms: 1126.106583
  type: 'test'
  ...
# Subtest: Claude installed spec-state requires current canonical dependency proof and keys receipt mutations
ok 211 - Claude installed spec-state requires current canonical dependency proof and keys receipt mutations
  ---
  duration_ms: 6178.10825
  type: 'test'
  ...
# Subtest: Claude installed spec-state keeps unversioned pending packets out of Next with migration guidance
ok 212 - Claude installed spec-state keeps unversioned pending packets out of Next with migration guidance
  ---
  duration_ms: 1352.165917
  type: 'test'
  ...
# Subtest: Claude resolver ignores fenced workflow annotations and rejects fenced-only Status
ok 213 - Claude resolver ignores fenced workflow annotations and rejects fenced-only Status
  ---
  duration_ms: 577.461917
  type: 'test'
  ...
# Subtest: Claude resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles
ok 214 - Claude resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles
  ---
  duration_ms: 175.0935
  type: 'test'
  ...
# Subtest: Stop snapshot includes tracked modifications and untracked files
ok 215 - Stop snapshot includes tracked modifications and untracked files
  ---
  duration_ms: 369.514
  type: 'test'
  ...
# Subtest: Stop snapshot includes untracked files before the first commit
ok 216 - Stop snapshot includes untracked files before the first commit
  ---
  duration_ms: 244.44525
  type: 'test'
  ...
# Subtest: statusline default output is byte-identical to the golden fixture when no layout is configured
ok 217 - statusline default output is byte-identical to the golden fixture when no layout is configured
  ---
  duration_ms: 232.7885
  type: 'test'
  ...
# Subtest: statusline custom layout renders named sections in order per line
ok 218 - statusline custom layout renders named sections in order per line
  ---
  duration_ms: 224.370916
  type: 'test'
  ...
# Subtest: statusline ignores unknown section ids without crashing or rendering placeholders
ok 219 - statusline ignores unknown section ids without crashing or rendering placeholders
  ---
  duration_ms: 273.076625
  type: 'test'
  ...
# Subtest: statusline modes slice the layout line count (minimal renders only the first line)
ok 220 - statusline modes slice the layout line count (minimal renders only the first line)
  ---
  duration_ms: 221.645959
  type: 'test'
  ...
# Subtest: statusline empty or invalid layout falls back to the default renderers
ok 221 - statusline empty or invalid layout falls back to the default renderers
  ---
  duration_ms: 1118.800208
  type: 'test'
  ...
# Subtest: statusline shows five-hour and weekly windows with countdowns when the cache is fresh
ok 222 - statusline shows five-hour and weekly windows with countdowns when the cache is fresh
  ---
  duration_ms: 370.641083
  type: 'test'
  ...
# Subtest: statusline hides the quota area when the cache is stale
ok 223 - statusline hides the quota area when the cache is stale
  ---
  duration_ms: 254.651084
  type: 'test'
  ...
# Subtest: statusline cost renders only when the layout enables it, billing is api, and data exists
ok 224 - statusline cost renders only when the layout enables it, billing is api, and data exists
  ---
  duration_ms: 1161.7415
  type: 'test'
  ...
# Subtest: statusline writes the ck-context session file regardless of layout
ok 225 - statusline writes the ck-context session file regardless of layout
  ---
  duration_ms: 292.136
  type: 'test'
  ...
# Subtest: statusline honors NO_COLOR with no ANSI escapes in output
ok 226 - statusline honors NO_COLOR with no ANSI escapes in output
  ---
  duration_ms: 252.398333
  type: 'test'
  ...
1..226
# tests 226
# suites 0
# pass 226
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 119387.146125

[skill-test] chrome-devtools script tests
TAP version 13
# Subtest: chrome-devtools error handling
    # Subtest: console.js
        # Subtest: should exit with code 1 when --url is missing or on error
        ok 1 - should exit with code 1 when --url is missing or on error
          ---
          duration_ms: 189.137666
          type: 'test'
          ...
        # Subtest: should output error information
        ok 2 - should output error information
          ---
          duration_ms: 172.355375
          type: 'test'
          ...
        1..2
    ok 1 - console.js
      ---
      duration_ms: 362.687583
      type: 'suite'
      ...
    # Subtest: evaluate.js
        # Subtest: should exit with code 1 when --url is missing or on error
        ok 1 - should exit with code 1 when --url is missing or on error
          ---
          duration_ms: 147.250375
          type: 'test'
          ...
        1..1
    ok 2 - evaluate.js
      ---
      duration_ms: 147.655167
      type: 'suite'
      ...
    # Subtest: navigate.js
        # Subtest: should exit with code 1 when --url is missing or on error
        ok 1 - should exit with code 1 when --url is missing or on error
          ---
          duration_ms: 154.449625
          type: 'test'
          ...
        1..1
    ok 3 - navigate.js
      ---
      duration_ms: 155.08775
      type: 'suite'
      ...
    # Subtest: network.js
        # Subtest: should exit with code 1 when --url is missing or on error
        ok 1 - should exit with code 1 when --url is missing or on error
          ---
          duration_ms: 132.830792
          type: 'test'
          ...
        1..1
    ok 4 - network.js
      ---
      duration_ms: 133.482959
      type: 'suite'
      ...
    # Subtest: performance.js
        # Subtest: should exit with code 1 when --url is missing or on error
        ok 1 - should exit with code 1 when --url is missing or on error
          ---
          duration_ms: 112.711375
          type: 'test'
          ...
        1..1
    ok 5 - performance.js
      ---
      duration_ms: 112.968292
      type: 'suite'
      ...
    # Subtest: all scripts exit code consistency
        # Subtest: console.js should exit 1 on invalid input or error
        ok 1 - console.js should exit 1 on invalid input or error
          ---
          duration_ms: 104.2085
          type: 'test'
          ...
        # Subtest: evaluate.js should exit 1 on invalid input or error
        ok 2 - evaluate.js should exit 1 on invalid input or error
          ---
          duration_ms: 122.879333
          type: 'test'
          ...
        # Subtest: navigate.js should exit 1 on invalid input or error
        ok 3 - navigate.js should exit 1 on invalid input or error
          ---
          duration_ms: 104.672375
          type: 'test'
          ...
        # Subtest: network.js should exit 1 on invalid input or error
        ok 4 - network.js should exit 1 on invalid input or error
          ---
          duration_ms: 109.102541
          type: 'test'
          ...
        # Subtest: performance.js should exit 1 on invalid input or error
        ok 5 - performance.js should exit 1 on invalid input or error
          ---
          duration_ms: 105.032292
          type: 'test'
          ...
        1..5
    ok 6 - all scripts exit code consistency
      ---
      duration_ms: 546.275791
      type: 'suite'
      ...
    1..6
ok 1 - chrome-devtools error handling
  ---
  duration_ms: 1459.695708
  type: 'suite'
  ...
# Subtest: parseSelector
    # Subtest: CSS Selectors
        # Subtest: should detect simple CSS selectors
        ok 1 - should detect simple CSS selectors
          ---
          duration_ms: 1.740667
          type: 'test'
          ...
        # Subtest: should detect class selectors
        ok 2 - should detect class selectors
          ---
          duration_ms: 0.186
          type: 'test'
          ...
        # Subtest: should detect ID selectors
        ok 3 - should detect ID selectors
          ---
          duration_ms: 0.403416
          type: 'test'
          ...
        # Subtest: should detect attribute selectors
        ok 4 - should detect attribute selectors
          ---
          duration_ms: 0.1025
          type: 'test'
          ...
        # Subtest: should detect complex CSS selectors
        ok 5 - should detect complex CSS selectors
          ---
          duration_ms: 0.083209
          type: 'test'
          ...
        1..5
    ok 1 - CSS Selectors
      ---
      duration_ms: 4.691083
      type: 'suite'
      ...
    # Subtest: XPath Selectors
        # Subtest: should detect absolute XPath
        ok 1 - should detect absolute XPath
          ---
          duration_ms: 0.805459
          type: 'test'
          ...
        # Subtest: should detect relative XPath
        ok 2 - should detect relative XPath
          ---
          duration_ms: 0.144041
          type: 'test'
          ...
        # Subtest: should detect XPath with text matching
        ok 3 - should detect XPath with text matching
          ---
          duration_ms: 1.328458
          type: 'test'
          ...
        # Subtest: should detect XPath with contains
        ok 4 - should detect XPath with contains
          ---
          duration_ms: 0.437875
          type: 'test'
          ...
        # Subtest: should detect XPath with attributes
        ok 5 - should detect XPath with attributes
          ---
          duration_ms: 0.538875
          type: 'test'
          ...
        # Subtest: should detect grouped XPath
        ok 6 - should detect grouped XPath
          ---
          duration_ms: 0.174542
          type: 'test'
          ...
        1..6
    ok 2 - XPath Selectors
      ---
      duration_ms: 4.068916
      type: 'suite'
      ...
    # Subtest: Security Validation
        # Subtest: should block javascript: injection
        ok 1 - should block javascript: injection
          ---
          duration_ms: 0.48875
          type: 'test'
          ...
        # Subtest: should block <script tag injection
        ok 2 - should block <script tag injection
          ---
          duration_ms: 0.124667
          type: 'test'
          ...
        # Subtest: should block onerror= injection
        ok 3 - should block onerror= injection
          ---
          duration_ms: 0.12325
          type: 'test'
          ...
        # Subtest: should block onload= injection
        ok 4 - should block onload= injection
          ---
          duration_ms: 0.248
          type: 'test'
          ...
        # Subtest: should block onclick= injection
        ok 5 - should block onclick= injection
          ---
          duration_ms: 0.295292
          type: 'test'
          ...
        # Subtest: should block eval( injection
        ok 6 - should block eval( injection
          ---
          duration_ms: 0.197042
          type: 'test'
          ...
        # Subtest: should block Function( injection
        ok 7 - should block Function( injection
          ---
          duration_ms: 0.258625
          type: 'test'
          ...
        # Subtest: should block constructor( injection
        ok 8 - should block constructor( injection
          ---
          duration_ms: 0.228709
          type: 'test'
          ...
        # Subtest: should be case-insensitive for security checks
        ok 9 - should be case-insensitive for security checks
          ---
          duration_ms: 0.338167
          type: 'test'
          ...
        # Subtest: should block extremely long selectors (DoS prevention)
        ok 10 - should block extremely long selectors (DoS prevention)
          ---
          duration_ms: 0.22375
          type: 'test'
          ...
        1..10
    ok 3 - Security Validation
      ---
      duration_ms: 3.010917
      type: 'suite'
      ...
    # Subtest: Edge Cases
        # Subtest: should throw on empty string
        ok 1 - should throw on empty string
          ---
          duration_ms: 0.509875
          type: 'test'
          ...
        # Subtest: should throw on null
        ok 2 - should throw on null
          ---
          duration_ms: 0.282875
          type: 'test'
          ...
        # Subtest: should throw on undefined
        ok 3 - should throw on undefined
          ---
          duration_ms: 0.078959
          type: 'test'
          ...
        # Subtest: should throw on non-string input
        ok 4 - should throw on non-string input
          ---
          duration_ms: 0.171959
          type: 'test'
          ...
        # Subtest: should handle selectors with special characters
        ok 5 - should handle selectors with special characters
          ---
          duration_ms: 0.210125
          type: 'test'
          ...
        # Subtest: should allow safe XPath with parentheses
        ok 6 - should allow safe XPath with parentheses
          ---
          duration_ms: 0.1175
          type: 'test'
          ...
        1..6
    ok 4 - Edge Cases
      ---
      duration_ms: 1.824
      type: 'suite'
      ...
    # Subtest: Real-World Examples
        # Subtest: should handle common button selector
        ok 1 - should handle common button selector
          ---
          duration_ms: 0.194666
          type: 'test'
          ...
        # Subtest: should handle complex form selector
        ok 2 - should handle complex form selector
          ---
          duration_ms: 1.972708
          type: 'test'
          ...
        # Subtest: should handle descendant selector
        ok 3 - should handle descendant selector
          ---
          duration_ms: 0.216125
          type: 'test'
          ...
        # Subtest: should handle nth-child equivalent
        ok 4 - should handle nth-child equivalent
          ---
          duration_ms: 0.101584
          type: 'test'
          ...
        1..4
    ok 5 - Real-World Examples
      ---
      duration_ms: 2.717875
      type: 'suite'
      ...
    1..5
ok 2 - parseSelector
  ---
  duration_ms: 17.799291
  type: 'suite'
  ...
1..2
# tests 42
# suites 13
# pass 42
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11643.955792

[skill-test] pdf bounding-box tests

[skill-test] retired completion-policy sentence is gone from the payload
Ran 1 test in completion policy wording

[skill-test] source tree stays free of hook state
Ran 1 test in source tree cleanliness

[skill-test] code-review and code-auditor keep the review boundary
code-review review boundary rejects 61 weakenings of 61 rules
Ran 122 tests in code-review review boundary

[skill-test] PASS: 1586 tests executed
TAP version 13
# Subtest: Codex payload transform emits native skill and subagent syntax
ok 1 - Codex payload transform emits native skill and subagent syntax
  ---
  duration_ms: 2.934625
  type: 'test'
  ...
# Subtest: Codex payload transform keeps structured user-input grammar across determiners
ok 2 - Codex payload transform keeps structured user-input grammar across determiners
  ---
  duration_ms: 5.006083
  type: 'test'
  ...
# Subtest: Codex structured-input corpus oracle stays differential and production-aware
ok 3 - Codex structured-input corpus oracle stays differential and production-aware
  ---
  duration_ms: 28.90775
  type: 'test'
  ...
# Subtest: Codex payload transform preserves executable keyword arguments
ok 4 - Codex payload transform preserves executable keyword arguments
  ---
  duration_ms: 0.114875
  type: 'test'
  ...
# Subtest: Codex managed AGENTS block preserves malformed marker topologies
ok 5 - Codex managed AGENTS block preserves malformed marker topologies
  ---
  duration_ms: 0.218334
  type: 'test'
  ...
# Subtest: platform resolver keeps saved runtimes and newly detected Codex
ok 6 - platform resolver keeps saved runtimes and newly detected Codex
  ---
  duration_ms: 2.428125
  type: 'test'
  ...
# Subtest: explicit Codex install restores the Codex locale first
ok 7 - explicit Codex install restores the Codex locale first
  ---
  duration_ms: 1.75025
  type: 'test'
  ...
# Subtest: same-version install can add Codex beside an existing runtime
ok 8 - same-version install can add Codex beside an existing runtime
  ---
  duration_ms: 0.965375
  type: 'test'
  ...
# Subtest: resolvePlatforms interactive prompts to add more platforms when prior install exists
ok 9 - resolvePlatforms interactive prompts to add more platforms when prior install exists
  ---
  duration_ms: 1.107958
  type: 'test'
  ...
# Subtest: resolvePlatforms interactive keeps existing platforms when user declines to add more
ok 10 - resolvePlatforms interactive keeps existing platforms when user declines to add more
  ---
  duration_ms: 1.5215
  type: 'test'
  ...
# Subtest: addPlatformsPrompt placeholder consistency across all locales
ok 11 - addPlatformsPrompt placeholder consistency across all locales
  ---
  duration_ms: 0.165709
  type: 'test'
  ...
# Subtest: same-version non-interactive install performs a selective refresh
ok 12 - same-version non-interactive install performs a selective refresh
  ---
  duration_ms: 1.107458
  type: 'test'
  ...
# Subtest: same-version interactive refresh does not enable force overwrite
ok 13 - same-version interactive refresh does not enable force overwrite
  ---
  duration_ms: 1.118292
  type: 'test'
  ...
# Subtest: mixed runtime versions update the stale Codex install
ok 14 - mixed runtime versions update the stale Codex install
  ---
  duration_ms: 1.194958
  type: 'test'
  ...
# Subtest: Codex ownership rejects files outside its split managed roots
ok 15 - Codex ownership rejects files outside its split managed roots
  ---
  duration_ms: 0.711666
  type: 'test'
  ...
# Subtest: Codex dry-run leaves both managed roots untouched
ok 16 - Codex dry-run leaves both managed roots untouched
  ---
  duration_ms: 236.4475
  type: 'test'
  ...
# Subtest: Codex install preserves the adaptive diagnostic-only Debug contract
ok 17 - Codex install preserves the adaptive diagnostic-only Debug contract
  ---
  duration_ms: 303.705709
  type: 'test'
  ...
# Subtest: Codex Windows hook launchers stay project-bound without Git from nested cwd
ok 18 - Codex Windows hook launchers stay project-bound without Git from nested cwd
  ---
  duration_ms: 411.729375
  type: 'test'
  ...
# Subtest: Codex POSIX hook launchers run without Git and outside the repository root
ok 19 - Codex POSIX hook launchers run without Git and outside the repository root
  ---
  duration_ms: 859.876792
  type: 'test'
  ...
# Subtest: a reinstall rebinds Codex launchers that resolved their path through Git
ok 20 - a reinstall rebinds Codex launchers that resolved their path through Git
  ---
  duration_ms: 1039.68275
  type: 'test'
  ...
# Subtest: a reinstall rebinds Codex launchers that looked for node on PATH
ok 21 - a reinstall rebinds Codex launchers that looked for node on PATH
  ---
  duration_ms: 982.286166
  type: 'test'
  ...
# Subtest: Codex installed Specs and spec-maker reject adaptive coverage mutations
ok 22 - Codex installed Specs and spec-maker reject adaptive coverage mutations
  ---
  duration_ms: 2091.062167
  type: 'test'
  ...
# Subtest: Codex installed Brainstorm skill reference and agent preserve proportional routing parity
ok 23 - Codex installed Brainstorm skill reference and agent preserve proportional routing parity
  ---
  duration_ms: 544.59825
  type: 'test'
  ...
# Subtest: Codex installed Develop preserves plan-native execution and references
ok 24 - Codex installed Develop preserves plan-native execution and references
  ---
  duration_ms: 326.704667
  type: 'test'
  ...
# Subtest: Codex installed Research preserves adaptive evidence semantics
ok 25 - Codex installed Research preserves adaptive evidence semantics
  ---
  duration_ms: 285.99825
  type: 'test'
  ...
# Subtest: Codex installed Test preserves plan-native proof and references
ok 26 - Codex installed Test preserves plan-native proof and references
  ---
  duration_ms: 300.516791
  type: 'test'
  ...
# Subtest: Codex installed Fix preserves the adaptive repair contract
ok 27 - Codex installed Fix preserves the adaptive repair contract
  ---
  duration_ms: 295.225584
  type: 'test'
  ...
# Subtest: Codex installed Docs preserves the adaptive contract
ok 28 - Codex installed Docs preserves the adaptive contract
  ---
  duration_ms: 372.136375
  type: 'test'
  ...
# Subtest: Codex install on top of existing Claude installation preserves content and adds Codex
ok 29 - Codex install on top of existing Claude installation preserves content and adds Codex
  ---
  duration_ms: 269.350417
  type: 'test'
  ...
# Subtest: Codex installed code_auditor contains Strict conditional marker
ok 30 - Codex installed code_auditor contains Strict conditional marker
  ---
  duration_ms: 275.287958
  type: 'test'
  ...
# Subtest: Codex scaffold resolver rejects symlink template
ok 31 - Codex scaffold resolver rejects symlink template
  ---
  duration_ms: 353.042083
  type: 'test'
  ...
# Subtest: Claude and Codex installed Route preserve proportional live-catalog semantics
ok 32 - Claude and Codex installed Route preserve proportional live-catalog semantics
  ---
  duration_ms: 615.039167
  type: 'test'
  ...
# Subtest: combined installs bind each catalog to its native runtime inventory
ok 33 - combined installs bind each catalog to its native runtime inventory
  ---
  duration_ms: 577.786458
  type: 'test'
  ...
# Subtest: Claude and Codex installed rules preserve the ported review and process guidance
ok 34 - Claude and Codex installed rules preserve the ported review and process guidance
  ---
  duration_ms: 385.181667
  type: 'test'
  ...
# Subtest: installed Route degrades safely when an agent is absent
ok 35 - installed Route degrades safely when an agent is absent
  ---
  duration_ms: 423.858375
  type: 'test'
  ...
1..35
# tests 35
# suites 0
# pass 35
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11140.952584
TAP version 13
# Subtest: installed mutation guard rejects post-context symlink and hardlink before source bytes change
ok 1 - installed mutation guard rejects post-context symlink and hardlink before source bytes change
  ---
  duration_ms: 79.65975
  type: 'test'
  ...
# Subtest: npm dry-run inventory is deterministic and preserves runtime payload
ok 2 - npm dry-run inventory is deterministic and preserves runtime payload
  ---
  duration_ms: 2309.594875
  type: 'test'
  ...
# Subtest: packed core-only installs reject optional capability routing
ok 3 - packed core-only installs reject optional capability routing
  ---
  duration_ms: 4069.345542
  type: 'test'
  ...
# Subtest: packed Route rejects semantic routing weakenings
ok 4 - packed Route rejects semantic routing weakenings
  ---
  duration_ms: 5514.4605
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm
ok 5 - packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm
  ---
  duration_ms: 20386.431625
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs preserve bounded Loop safety and routing
ok 6 - packed Claude and Codex installs preserve bounded Loop safety and routing
  ---
  duration_ms: 5297.542125
  type: 'test'
  ...
# Subtest: packed Research and Loop reject semantic weakenings
ok 7 - packed Research and Loop reject semantic weakenings
  ---
  duration_ms: 5111.240583
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Research and bounded Loop
ok 8 - repository and package guides document adaptive Research and bounded Loop
  ---
  duration_ms: 6.268875
  type: 'test'
  ...
# Subtest: packed Claude and Codex reject adaptive Brainstorm semantic weakenings
ok 9 - packed Claude and Codex reject adaptive Brainstorm semantic weakenings
  ---
  duration_ms: 5069.95825
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Brainstorm usage
ok 10 - repository and package guides document adaptive Brainstorm usage
  ---
  duration_ms: 2.431084
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs reject adaptive Fix semantic weakenings
ok 11 - packed Claude and Codex installs reject adaptive Fix semantic weakenings
  ---
  duration_ms: 4967.2285
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Fix usage
ok 12 - repository and package guides document adaptive Fix usage
  ---
  duration_ms: 1.44325
  type: 'test'
  ...
# Subtest: localized reference guides keep OpenCode mappings historical
ok 13 - localized reference guides keep OpenCode mappings historical
  ---
  duration_ms: 1.1345
  type: 'test'
  ...
# Subtest: website keeps process-first docs, canonical public names, and historical legacy claims
ok 14 - website keeps process-first docs, canonical public names, and historical legacy claims
  ---
  duration_ms: 56.512667
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs reject adaptive Docs semantic weakenings
ok 15 - packed Claude and Codex installs reject adaptive Docs semantic weakenings
  ---
  duration_ms: 5104.074458
  type: 'test'
  ...
# Subtest: repository and package guides document adaptive Docs usage
ok 16 - repository and package guides document adaptive Docs usage
  ---
  duration_ms: 0.528375
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs execute semantic kernel behavior without package source
ok 17 - packed Claude and Codex installs execute semantic kernel behavior without package source
  ---
  duration_ms: 14236.477334
  type: 'test'
  ...
# Subtest: packed Claude and Codex installs self-contain runtime provenance and fail closed without it
ok 18 - packed Claude and Codex installs self-contain runtime provenance and fail closed without it
  ---
  duration_ms: 6490.405083
  type: 'test'
  ...
# Subtest: packed Codex live host E2E via codex binary (opt-in)
ok 19 - packed Codex live host E2E via codex binary (opt-in) # SKIP opt-in only: set CAFEKIT_CODEX_HOST_E2E=1 to run live Codex host
  ---
  duration_ms: 1.295667
  type: 'test'
  ...
1..19
# tests 19
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 1
# todo 0
# duration_ms 78853.791292
ok: shapes, prose and env references
ok: run from a subdirectory (the block moves to the top-level)
ok: non-ASCII and spaced file names, tracked and untracked
ok: diff.noprefix=true
ok: diff.mnemonicPrefix=true
ok: CRLF line endings
ok: a repository with no commit yet (staged and untracked)
ok: an untracked file with no final newline does not swallow the next header
ok: a clean tree prints nothing
check-git-fallback: ok (shapes, prose, subdirectory, non-ASCII and spaced names, diff prefix configs, CRLF, no commit yet, no final newline, clean tree) on bash 3.2.57(1)-release
weaken-git-pins: unweakened pass, 66/66 weakened copies fail
..........
----------------------------------------------------------------------
Ran 10 tests in 0.000s

OK
```
