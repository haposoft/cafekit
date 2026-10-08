# Task 01 — The shared eval kit exists

Status: done

## Outcome
`evals/git/` holds a kit that every case uses: a workspace "box" builder, `orca`/`herdr` shims, `verify-run.mjs` (end-state reader with a fixed output format) and `check-fixtures.sh` (offline, $0), proven on a synthetic case.

## Scope
- In: `lib/box.sh` (functions that build `./box/<repo>` repositories inside the workspace with a fixed identity and no remote, create linked worktrees as siblings in `./box`, and build the fake key from pieces); `shim/orca` and `shim/herdr`; `verify-run.mjs`; `check-fixtures.sh` with sections `kit`, `worktree`, `commit`, `all` and a `--counterexamples` flag.
- Out: the four cases (tasks 02-03); any model call; any change under `packages/`.

## Coverage
- CP-01

## Ownership
- Create: `evals/git/lib/box.sh`, `evals/git/shim/orca`, `evals/git/shim/herdr`, `evals/git/verify-run.mjs`, `evals/git/check-fixtures.sh`
- Read: `evals/run.sh`, `evals/fix/check-fixtures.sh` and `evals/fix/verify-run-log.mjs` (from `../cafekit-fix-fix-repair` if absent here)

## Steps
1. `lib/box.sh`: `box_init` makes `./box` in the cwd; `box_repo <name>` runs `git init -q -b main` with an inline author and one commit; every helper refuses to run when the cwd is not under a `mktemp -d` or harness workspace marker passed by the caller, and no helper sets a remote or touches `$HOME`. `box_fake_key` joins pieces at run time so no full key string exists in repository text.
2. `shim/orca`, `shim/herdr`: append `$0 $*` to `./shim.log` in the calling process's cwd (the run's own workspace, so one log per run) and exit 127; no environment variable names the log.
3. `verify-run.mjs <result dir>...`: the framework only — for each run, locate the kept workspace the way `evals/fix/verify-run-log.mjs` does and call a registry of V graders (one function per grader name, keyed by case); print `<dir> run=<i> grader=<name> verdict=<yes|no|error>` per grader, a `disagreements=<k>` summary, and exit 1 only when a run's trace or workspace cannot be read; unreadable → `error`, never `yes`. The registry starts with one synthetic grader used by `--self-test`; tasks 02-03 add the V graders of the inventory in `plan.md`. `--self-test` builds temp workspaces for a right and a wrong run of the synthetic grader plus an unreadable run, and exits 0 only when each is classified correctly. If the kept workspace cannot be located from `result.json`, stop and mark this task `blocked` with that cause.
4. `check-fixtures.sh <kit|worktree|commit|all> [--counterexamples]`: `kit` builds a box twice side by side under one parent and finds distinct sibling directories; proves an `orca` call is shimmed ahead of a real binary (log has one line, exit 127); runs `verify-run.mjs --self-test` (framework and synthetic grader); confirms no scaffold wrote outside its temp root. `worktree` and `commit` exit 1 until their case directories exist. `--counterexamples` replays planted wrong behaviours and exits 0 only when every one is caught. `mktemp -d` is used without relying on `TMPDIR`.

## Acceptance
- AC-01 (kit part): `check-fixtures.sh kit` and `kit --counterexamples` exit 0; `verify-run.mjs --self-test` exits 0; the shim logs a call and exits 127; two side-by-side boxes do not collide.

## Dependencies
- none

## Verification Plan
- Command: `bash evals/git/check-fixtures.sh kit && bash evals/git/check-fixtures.sh kit --counterexamples && node evals/git/verify-run.mjs --self-test && bash -n evals/git/lib/box.sh && [ -x evals/git/shim/orca ] && [ -x evals/git/shim/herdr ] && ! grep -rEn 'sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}' evals/git`
- Named probe: `check-fixtures.sh` section `kit` (side-by-side boxes, shim shadows the real binary, no write outside the temp root) and `verify-run.mjs --self-test`.
- Reachability: source level; tasks 02-03 add case sections to the same checker; task 05 runs `verify-run.mjs` on kept runs.
- Oracle: exit 0; one `ok:` line per probe; the final `grep` finds no key-shaped string.
- Counterexample: a scaffold that writes outside its temp root, two boxes that share a path, a shim that exits 0, a verifier that reports `yes` for an unreadable run, or a full-length key committed under `evals/git` each make a probe or the `grep` fail.
- Artifacts: none kept; the checker removes its temp directories.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/git/check-fixtures.sh kit && bash evals/git/check-fixtures.sh kit --counterexamples && node evals/git/verify-run.mjs --self-test && bash -n evals/git/lib/box.sh && [ -x evals/git/shim/orca ] && [ -x evals/git/shim/herdr ] && ! grep -rEn 'sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}' evals/git
Exit: 0
Base: 20ba7e7efdbd3ac09f34867ba078a60f88929336
Head: f5ab24a1f885e5ebe2300d3cc28457cedc2ebd99a9beb30da74f92988899d899
```text
$ bash evals/git/check-fixtures.sh kit && bash evals/git/check-fixtures.sh kit --counterexamples && node evals/git/verify-run.mjs --self-test && bash -n evals/git/lib/box.sh && [ -x evals/git/shim/orca ] && [ -x evals/git/shim/herdr ] && ! grep -rEn 'sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}' evals/git
ok: kit box.sh parses
ok: kit shims are executable
ok: kit shim orca shadows a real binary, exits 127, logs one line
ok: kit shim herdr exits 127
ok: kit box ws1 builds repo and sibling worktree
ok: kit box ws2 builds repo and sibling worktree
ok: kit nothing written beside the two workspaces
ok: kit two distinct sibling worktrees
ok: kit worktree list of ws1 names only its own path
ok: kit repo has no remote
ok: kit box_init refuses inside a git repository
ok: kit fake key is assembled at run time
ok: kit verify-run self-test
ok: kit no key-shaped string under evals/git
ok: kit no box or shim.log under evals/git
check-fixtures: kit checks ok
ok: counter caught: repo name escaping the box
ok: counter caught: two repos sharing a path
ok: counter caught: box_commit path escaping the repo
ok: counter caught: box as a symlink
ok: counter caught: box_init outside a temp directory
ok: counter caught: verify-run silent through a symlink
ok: counter caught: helper without box_init
ok: counter caught: shim exiting 0
ok: counter caught: unreadable run is error, exit 1
ok: counter caught: key-shaped string in a copy of evals/git
ok: counter caught: BOX_ALLOW_DIR set to HOME
counterexamples planted=11 caught=11
check-fixtures: kit --counterexamples ok
self-test ok: right=yes wrong=no unreadable=error throwing=error
```
