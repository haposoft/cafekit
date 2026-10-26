# merge-pr

Merge one GitHub pull request through the readiness gate, then watch the target-branch CI. Plain `gh` and bash 3.2 (no `timeout`, no `mapfile`, no `declare -A`); keep every single command under 10 minutes (see Waiting rule).

Run only when the request names `merge-pr`. It is never a step of `pr`, `finish` or the default menu. When the PR is not clear, ask. Never pass `--admin`, never force-push, never push the target branch.

## Step 1: readiness gate

```bash
gh pr view "$PR" --json number,state,isDraft,mergeable,reviewDecision,baseRefName,headRefName,headRefOid
gh pr checks "$PR" --required; echo "exit $?"
```

Every line must hold, otherwise stop and report the blocker; never merge past a red gate.

| Field | Requirement |
|---|---|
| `isDraft` | false |
| `state` | `OPEN` |
| `mergeable` | `MERGEABLE`; on `UNKNOWN` re-read once after a short sleep, then stop if still `UNKNOWN`; `CONFLICTING` stops |
| `reviewDecision` | `APPROVED` or empty; `REVIEW_REQUIRED` and `CHANGES_REQUESTED` stop |
| required checks | read the exit code of `gh pr checks --required`: 0 green, 8 pending (documented in `gh pr checks --help`), any other exit red, `cancelled` counts as red |

When the output says no required checks are reported, treat the checks as green; this message and its exit code are not documented in `gh pr checks --help`, so read the text instead of trusting the code alone. A failing check that is not required is reported and does not block. Keep `headRefOid` as `HEAD_SHA` and `baseRefName` as `BASE`. If `gh` is not authenticated, report it (see Errors).

## Step 2: merge method

1. The method written in `AGENTS.md` or `CONTRIBUTING.md`.
2. Otherwise `gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`: when exactly one method is allowed, use it.
3. Several methods allowed and no convention: ask the user. Do not guess from recent PRs, and never retry another method after a failure.

Set `METHOD` to one of `--merge`, `--squash`, `--rebase`. Do not pass `--delete-branch` unless the repository convention deletes head branches.

## Step 3: merge

Print the PR, `BASE`, `HEAD_SHA` and the method, then merge exactly that head:

```bash
gh pr merge "$PR" "$METHOD" --match-head-commit "$HEAD_SHA"          # method per Step 2
gh pr merge "$PR" "$METHOD" --match-head-commit "$HEAD_SHA" --auto   # required checks still pending
```

When auto-merge was enabled and you stop before the PR merges (hang, interrupt, error, red checks), run `gh pr merge "$PR" --disable-auto`, or state clearly that auto-merge is still on.

## Waiting rule

The host cuts a command at 10 minutes, so every wait is a short poll, one Bash command each, at most 480 seconds. Shell variables do not survive between Bash calls: set `PR`, `BASE`, `HEAD_SHA`, `METHOD`, `RUNS` and `T0` at the top of every command (the values below are examples to replace). Each separate wait (the `MERGED` wait, the run-appearance wait, the run watch) takes its own `T0` on its first command with `T0=${T0:-$(date +%s)}`, prints it, and uses that single mark for its own limit; the caller repeats the same command, passing the printed `T0` back at the top, until the wait's limit. Never put a whole wait in one command.

Wait for `MERGED` (limit 1800 seconds from this wait's `T0`):

```bash
PR=123; T0=${T0:-$(date +%s)}
SECONDS=0
while [ "$SECONDS" -lt 480 ]; do
  STATE="$(gh pr view "$PR" --json state --jq .state)"
  case "$STATE" in MERGED|CLOSED) break ;; esac
  OUT="$(gh pr checks "$PR" --required --json bucket --jq '.[].bucket' 2>&1)"
  if printf '%s\n' "$OUT" | grep -qxE 'fail|cancel'; then echo "required check failing"; break; fi
  sleep 30
done
echo "state=$STATE T0=$T0 elapsed=$(( $(date +%s) - T0 ))"
```

Repeat while the state is neither `MERGED` nor `CLOSED` and `elapsed` is under 1800. Only a reported failing required check stops early; "no required checks" or a transient error is not red. A failing required check, `CLOSED`, or 1800 seconds without `MERGED`: stop, disable auto-merge as above, report with the PR URL.

## Step 4: watch target-branch CI

Run-appearance wait (limit 300 seconds from this wait's `T0`; one short command per poll, sleep 15 between lists, at most 480 seconds per command):

```bash
PR=123; BASE=main; T0=${T0:-$(date +%s)}
MERGE_SHA="$(gh pr view "$PR" --json mergeCommit --jq '.mergeCommit.oid // empty')"
[ -n "$MERGE_SHA" ] || { echo "no merge commit SHA"; exit 1; }
SECONDS=0; RUNS=""
while [ "$SECONDS" -lt 480 ] && [ $(( $(date +%s) - T0 )) -lt 300 ]; do
  RUNS="$(gh run list --branch "$BASE" --commit "$MERGE_SHA" --json databaseId --jq '.[].databaseId')"
  [ -n "$RUNS" ] && break
  sleep 15
done
echo "runs=$RUNS T0=$T0 elapsed=$(( $(date +%s) - T0 ))"
```

An empty list is polled for up to 5 minutes, repeating the command with the printed `T0`. Still empty after 5 minutes: report `no CI run observed` for the merge commit and never report green.

Run watch (new `T0`, limit 1800 seconds). `RUNS` is the `databaseId` list from the last run list:

```bash
PR=123; BASE=main; T0=${T0:-$(date +%s)}
MERGE_SHA="$(gh pr view "$PR" --json mergeCommit --jq '.mergeCommit.oid // empty')"
[ -n "$MERGE_SHA" ] || { echo "no merge commit SHA"; exit 1; }
RUNS="$(gh run list --branch "$BASE" --commit "$MERGE_SHA" --json databaseId --jq '.[].databaseId')"
SECONDS=0
for RUN_ID in $RUNS; do
  RESULT="not polled"
  while [ "$SECONDS" -lt 480 ]; do
    RESULT="$(gh run view "$RUN_ID" --json status,conclusion --jq '.status + " " + (.conclusion // "")')"
    case "$RESULT" in completed*) break ;; esac
    sleep 30
  done
  echo "run $RUN_ID: $RESULT"
done
echo "T0=$T0 elapsed=$(( $(date +%s) - T0 ))"
```

An empty `MERGE_SHA` stops the command: `gh run list --commit ""` ignores the filter and lists old runs, which would read as green. A run whose result is not `completed ...` (including `not polled`) is checked again on the next repeat. List the runs again after every run finishes, since a later workflow may start; the watch ends when every listed run is `completed` or 1800 seconds pass. Do not rerun anything.

## Step 5: red CI

A run whose conclusion is anything but `success` or `skipped` (`cancelled` and `timed_out` are red): run `gh run view "$RUN_ID" --log-failed`, report the failing run and the key lines, and point to `cf-fix`. Do not fix, rerun or push from here.

## Report

PR URL, merge commit SHA, method, runs watched with their conclusions, or that no CI run was seen.

## Errors

| Error | Action |
|---|---|
| `gh` not authenticated | Report; suggest `gh auth login` |
| `Auto merge is not allowed` for this repository | Report; do not retry without `--auto` unless the checks are already green |
| A branch protection rule blocks the merge | Report required reviews or checks; never bypass |
| `CONFLICTING` | Report; suggest updating the head branch; do not resolve on the target branch |
| `--match-head-commit` mismatch (head moved) | Stop; re-run the gate on the new head |
| Method not allowed | Report and ask; do not try a different method |
| Checks or auto-merge stall past 30 minutes | Report with the run or PR URL; disable auto-merge |
