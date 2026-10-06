---
name: cf:git
description: "Hapo Native Git Operations & Worktree Management. Handles safe commits, conventional split, branch finish choices, secret scanning, and sibling-branch worktrees locally."
user-invocable: true
when_to_use: "Invoke for commits, PRs, branch hygiene, or worktree management."
category: dev-tools
keywords: [git, commits, pr, worktree]
argument-hint: "commit | push | pr | finish | worktree <feature-desc>"
metadata:
  author: haposoft
  version: "1.1.0"
---
# Git Operations & Worktree

Git operations and worktree management using plain `git` commands.

## Default (no arguments)
Present options via AskUserQuestion — header "Git Operation": commit / push / pr / finish / worktree.

## Commands
- `commit`: confirm the target checkout before staging → scan the working tree for secrets before anything is staged → analyze the diff → stage and commit by group (`references/commit-protocols.md`).
- `push`: push current branch.
- `pr`: push + open PR. Target = repo's integration branch — detect via
  `gh repo view --json defaultBranchRef` or `origin/HEAD`; never assume `main`/`develop`.
- `finish`: fresh `git status` + verification, then present exactly 4 options:
  merge locally / push + PR / keep branch-worktree / discard (typed confirmation, as in the worktree lifecycle: `remove <dir-name>` / `delete <branch>`).
- `worktree <desc>`: sibling dir `../<project>-<branch>` for isolated setup, branched from the current branch unless the user names a base, hydrating the installer-ignored `.claude/`, `.codex/`, `.agents/` it lacks. Git alone is enough (plus `rsync`); Orca, Herdr and Claude Code's own worktree are optional shortcuts, never required.
- `worktree list | remove <dir> | prune`: lifecycle in `references/worktree-blueprint.md` — never lose uncommitted, ignored or unmerged work: before `git worktree remove`, check `git -C <dir> status --porcelain --ignored` and `git -C <dir> log --oneline <base>..HEAD`, never `--force`, and anything they show needs the typed `remove <dir-name>`; use `git worktree prune` for a missing directory, never `rm -rf`.

## Hard rules for `commit`
- Stage by explicit paths, group by group; never `git add -A`, `git add .`, `git add -u` or `git commit -a` (`-am` included).
- Confirm the target checkout before staging: print `git rev-parse --show-toplevel` and `git branch --show-current` of the directory you will commit in, check they match what the user asked for, then run every stage and commit with `git -C <target>` (or after a `cd <target>`).
- Commit messages carry no `Co-Authored-By` and no other AI attribution trailer, unless the user asked for one in this request — even where a host's default guidance suggests it.
- Push only the current branch, never with `--force`. Bash on macOS is 3.2: no `mapfile`, `readarray`, `declare -A`, `${var,,}`, `${var^^}`, `&>>`.

## Secret scan (before anything is staged)
Scan the working tree first, so a secret never reaches the index. Run this working-tree scan before staging whether or not the helper is installed, inside the target checkout (`cd <target>` first; the block moves to the repository's top-level itself). Do not print file contents or diffs of changed files before the scan has run: look at `git status --short` and `git diff --stat` only, and never `cat`, `git diff`, `git show` or Read a file the scan flagged.

The block is bash 3.2 and BSD awk safe. It reads the added lines of tracked changes (or the staged diff when the repository has no commit yet) plus every untracked file, and prints `file:line:class` and nothing else: never the line, a value, or context. Prose such as the word `tokens` and empty or env-referencing values do not match.

<!-- fallback-scan:start -->
```bash
cd "$(git rev-parse --show-toplevel)" || exit 1
D='-c core.quotePath=false diff -U0 --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/'
{ git $D HEAD 2>/dev/null || git $D --cached
  git -c core.quotePath=false ls-files -z --others --exclude-standard | while IFS= read -r -d '' f; do
    printf '+++ b/%s\n@@ -0,0 +1 @@\n' "$f"; sed 's/^/+/' "$f"; echo; done
} | tr -d '\r' | awk '
function val(l,   n, lo, r, q, v, i, w) {
  n = l; gsub(sprintf("%c", 39), "\"", n); gsub(sprintf("%c", 96), "\"", n); lo = tolower(n)
  if (!match(lo, /(api[_-]?key|secret|password|passwd|token|private[_-]?key)[a-z0-9_-]*["]?[ ]*[:=][ ]*/)) return 0
  r = substr(n, RSTART + RLENGTH); q = substr(r, 1, 1)
  if (q == "\"") { r = substr(r, 2); i = index(r, "\""); if (i == 0) return 0; v = substr(r, 1, i - 1)
    return (length(v) >= 12 && v !~ /^[$<]/ && v !~ /^process[.]env/) }
  split(r, w, " "); v = w[1]
  return (v ~ /^[A-Za-z0-9+\/_=-]+$/ && length(v) >= 16)
}
/^[+][+][+] /  { f = ($(0) ~ /^[+][+][+] b\//) ? substr($(0), 7) : ""; sub(/\t.*$/, "", f); next }
/^@@/          { split($(3), a, ","); n = substr(a[1], 2) - 1; next }
/^[+]/         { n++; if (f == "") next; l = substr($(0), 2); c = ""
  if (val(l)) c = "assignment"
  if (match(l, /sk-[A-Za-z0-9_-]+/) && RLENGTH >= 20) c = "sk-prefix"
  if (match(l, /gh[pousr]_[A-Za-z0-9]+/) && RLENGTH >= 20) c = "gh-prefix"
  if (match(l, /Bearer [A-Za-z0-9._-]+/) && RLENGTH >= 27) c = "bearer"
  if (l ~ /-----BEGIN [A-Z ]*PRIVATE KEY-----/) c = "private-key-block"
  if (c != "") print f ":" n ":" c }'
```
<!-- fallback-scan:end -->

With the helper installed (`.claude/scripts/scan-staged-secrets.cjs`), also run `node .claude/scripts/scan-staged-secrets.cjs` after staging, as a second look at the staged diff (it parses `git diff --cached --unified=0 --no-color --diff-filter=ACMR`, checks added lines only, and prints only file, line, and identifier).

Match → STOP everything: commit nothing, not even the clean groups. Report file, line and class only. Do not run `git reset`, `git restore --staged` or `git rm --cached`, and do not edit `.gitignore` or history, before the user answers; with the helper, say which files are already staged. Then let the user choose: for an untracked secret a `.gitignore` rule, for a tracked one rotating it first.

## Split rules
Split when: mixed types (feat+fix), mixed scopes, config/deps mixed with code, >10 unrelated files.
Single commit when: same type+scope, ≤3 files, ≤50 lines.

## Output
```
✓ checkout: <top-level> @ <branch>
✓ secrets: none
✓ staged: N files (+X/-Y)
✓ commit: <hash> type(scope): description
✓ pushed: yes|no
```

## Errors
| Error | Action |
|---|---|
| Secrets matched | Stop all commits; report only file/source line/class. Never show secret value, diff line, or surrounding context. |
| Wrong checkout or branch | Stop before staging; say what differs and ask |
| Nothing staged | Exit cleanly |
| Push rejected | Suggest `git pull --rebase` |
| Conflicts | List files; never auto-resolve |

Never force-push or delete a worktree without explicit confirmation.

## References
- `references/commit-protocols.md` · `references/finish-branch.md` · `references/worktree-blueprint.md`
