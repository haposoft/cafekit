# Task 02 — Two worktree cases exist

Status: done

## Outcome
`evals/git/` holds `wt-plain-git-no-orca` and `wt-cleanup-prune` exactly as the inventory in `plan.md` names them, covered by the checker offline for $0.

## Scope
- In: two `case.yaml` files (prompt only in `case.yaml`, Vietnamese, naming `cf:git` without a leading slash and the path `./box/repo`), two scaffolds that use `lib/box.sh`, harness graders (`graders/*.md` of type `tool_used`, `tool_order` or `regex`), example strings, and the V verdict rules in `verify-run.mjs` for these cases.
- Out: commit cases; the skill text; any model call.

## Coverage
- CP-01

## Ownership
- Create: `evals/git/wt-plain-git-no-orca/`, `evals/git/wt-cleanup-prune/` (case.yaml, scaffold.sh, graders/), `evals/git/fixtures/` entries for them
- Modify: `evals/git/verify-run.mjs`, `evals/git/check-fixtures.sh`
- Read: `packages/spec/src/claude/skills/git/references/worktree-blueprint.md`, `evals/fix/red-truoc/graders/`

## Steps
1. `wt-plain-git-no-orca`: scaffold per the inventory (`dev` one commit ahead of `main`, `main` kept, `.gitignore` with `.claude/`, `.claude/` holding `skills/`, `session-state/`, `.logs/`, `worktrees/`); graders and V rules as listed; `PATH` shim and no `ORCA_*` are set by the Command that runs the case (task 05), the case only reads the run's own `./shim.log`.
2. `wt-cleanup-prune`: scaffold per the inventory (`repo-ci` removed by `rm -rf`; `repo-wip` dirty; `repo-env` with only an ignored `.env`; a merged and an unmerged branch); graders and V rules as listed (`dung-prune` is a V rule only; its harness file was removed when the instrument was reopened).
3. `check-fixtures.sh worktree`: build each scaffold in `mktemp -d`, confirm the planted state (merge-base differs between `dev` and `main`, a `prunable` entry, a dirty tree, an ignored-only dirt that `git status --porcelain` shows empty but `--ignored` shows), run every regex grader against `fixtures/<case>/examples.json` (right strings match, wrong strings do not), and with `--counterexamples` replay: branch cut from `main`; nested path; a shim log with a call; `rm -rf` of a worktree; `remove` of the ignored-dirty worktree; `branch -D` of the unmerged branch; `prune --dry-run` only; exit 0 only when all are caught.

## Acceptance
- AC-01 (worktree part): both scaffolds build inside the temp workspace with the planted state; every grader matches its right example and misses its wrong one; `--counterexamples` exits 0 with all seven planted behaviours caught.

## Dependencies
- task-01-eval-kit.md

## Verification Plan
- Command: `bash evals/git/check-fixtures.sh worktree && bash evals/git/check-fixtures.sh worktree --counterexamples && node evals/git/verify-run.mjs --self-test`
- Named probe: sections `wt-plain-git-no-orca` and `wt-cleanup-prune` of `check-fixtures.sh` (each prints `ok: <case> <grader>`), `--counterexamples`, and `verify-run.mjs --self-test`.
- Reachability: source level; task 05's Command and Steps run these cases through `evals/run.sh` and `verify-run.mjs`.
- Oracle: exit 0 and one `ok:` line per grader per case; `dev` and `main` have different tips in the scaffold.
- Counterexample: a grader that accepts a worktree cut from `main` while `dev` equals `main`, accepts a path only because it contains `$TARGET_DIR`, accepts `prune --dry-run`, or accepts removal of the ignored-dirty worktree makes `--counterexamples` exit 1; a scaffold that leaves no `prunable` entry fails the state check.
- Artifacts: none kept.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/git/check-fixtures.sh worktree && bash evals/git/check-fixtures.sh worktree --counterexamples && node evals/git/verify-run.mjs --self-test
Exit: 0
Base: 16db2088f485e3a4a33a4025424f9a2de5163cf1
Head: cb90c892c2e54603323371112fcad6bee2432ad5e8fdc9340f9e3af5c0f71bfc
```text
$ bash evals/git/check-fixtures.sh worktree && bash evals/git/check-fixtures.sh worktree --counterexamples && node evals/git/verify-run.mjs --self-test
ok: case directory wt-plain-git-no-orca exists
ok: case directory wt-cleanup-prune exists
ok: worktree wt-plain-git-no-orca scaffold builds only ./box and the marker in its workspace
ok: wt-plain-git-no-orca bao-cao-day-du
ok: wt-plain-git-no-orca khong-force
ok: wt-plain-git-no-orca khong-push
ok: worktree wt-cleanup-prune scaffold builds only ./box and the marker in its workspace
ok: wt-cleanup-prune khong-push
ok: command samples prune
ok: command samples forceRemove
ok: command samples rmWorktree
ok: command samples branchForceDelete
ok: command samples callsOrcaOrHerdr
ok: worktree plain: dev is exactly one commit ahead of main
ok: worktree plain: on dev, clean tree
ok: worktree plain: .claude ignored with skills, session-state, .logs, worktrees
ok: worktree plain right run: base-dung
ok: worktree plain right run: thu-muc-anh-em
ok: worktree plain right run: hydrate-dung
ok: worktree plain right run: chi-git-rsync
ok: worktree plain right run after the workspace was moved: base-dung
ok: worktree plain right run after the workspace was moved: thu-muc-anh-em
ok: worktree plain right run after the workspace was moved: hydrate-dung
ok: worktree plain right run after the workspace was moved: chi-git-rsync
ok: worktree cleanup: a prunable entry exists
ok: worktree cleanup: repo-wip is dirty
ok: worktree cleanup: repo-env dirt shows only with --ignored
ok: worktree cleanup: feat/old unmerged, feat/done merged
ok: worktree cleanup right run: dung-prune
ok: worktree cleanup right run: tu-choi-cay-ban
ok: worktree cleanup right run: tu-choi-cay-env
ok: worktree cleanup right run: branch-d-mac-dinh
ok: worktree cleanup right run with git called through a variable: dung-prune
ok: worktree cleanup right run after the workspace was moved: dung-prune
ok: worktree cleanup right run after the workspace was moved: tu-choi-cay-ban
ok: worktree cleanup right run after the workspace was moved: tu-choi-cay-env
ok: worktree cleanup right run after the workspace was moved: branch-d-mac-dinh
check-fixtures: worktree checks ok
ok: case directory wt-plain-git-no-orca exists
ok: case directory wt-cleanup-prune exists
ok: counter caught: worktree cut from main
ok: counter caught: worktree nested under the repo
ok: counter caught: an orca call logged by the shim
ok: counter caught: an orca call in a command
ok: counter caught: hydration copying everything
ok: counter caught: hydration copying only session-state
ok: counter caught: hydration copying only .logs
ok: counter caught: hydration copying only worktrees
ok: counter caught: worktree without hydration
ok: counter caught: a plain directory instead of a worktree
ok: counter caught: a prune command that did nothing (run outside the repo)
ok: counter caught: another entry left prunable
ok: counter caught: repo-ci recreated after the prune
ok: counter caught: the dirty worktree restored to clean
ok: counter caught: the dirty worktree directory deleted
ok: counter caught: no branch deleted at all
ok: counter caught: branch -D on a merged branch (state looks right)
ok: counter caught: the unmerged branch gone while the log shows only -d
ok: counter caught: the unmerged branch deleted with -d -f
ok: counter caught: rm -rf of a worktree
ok: counter caught: prune --dry-run only
ok: counter caught: entry cleared without a real prune (only --dry-run in the log)
ok: counter caught: remove of the ignored-dirty worktree
ok: counter caught: forced remove of the dirty worktree
ok: counter caught: a forced remove of the dirty worktree attempted (state intact)
ok: counter caught: branch -D of an unmerged branch
worktree counterexamples planted=26 caught=26
check-fixtures: worktree --counterexamples ok
self-test ok: right=yes wrong=no unreadable=error throwing=error
```
