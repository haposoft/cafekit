#!/usr/bin/env bash
# Proves, for $0, what `evals/run.sh --with-agent` changes and what it leaves alone. Two copies of the
# harness are staged side by side — base/ with evals/run.sh from e93060b, new/ with the working-tree
# evals/run.sh — and a stub `claude` records how each calls it: the arguments (stage root masked), the
# plugin tree (`find . -print`, so an empty folder shows) and one sha256 line per file. Without
# `--with-agent` the two captures must be byte-identical for every existing suite; with it, the only
# difference must be the copied agent files; a bad name must stop with exit 2 before `claude` is called.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
base_rev=e93060bacd4891d75cc5eb6959d8524be8780446
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
stage() { # stage <dir> <run.sh source>
  local dir="$1"
  mkdir -p "$dir/evals" "$dir/packages/spec/src/claude"
  cp "$2" "$dir/evals/run.sh"; chmod +x "$dir/evals/run.sh"
  cp "$repo/packages/spec/package.json" "$dir/packages/spec/package.json"
  rsync -a --exclude 'results/' "$repo/packages/spec/src/claude/skills/" "$dir/packages/spec/src/claude/skills/"
  rsync -a --exclude 'results/' "$repo/packages/spec/src/claude/agents/" "$dir/packages/spec/src/claude/agents/"
  for suite in specs develop scout debug fix; do
    rsync -a --exclude 'results/' "$repo/evals/$suite/" "$dir/evals/$suite/"
  done
}
git -C "$repo" show "$base_rev:evals/run.sh" > "$tmp/run.base.sh"
stage "$tmp/base" "$tmp/run.base.sh"
stage "$tmp/new" "$repo/evals/run.sh"
base_root="$(cd "$tmp/base" && pwd)"; new_root="$(cd "$tmp/new" && pwd)"

mkdir -p "$tmp/bin"
cat > "$tmp/bin/claude" <<'SH'
#!/usr/bin/env bash
# Stub: record the call instead of making it.
set -eu
: "${CAPTURE:?}" "${STAGE_ROOT:?}"
mkdir -p "$CAPTURE"
for a in "$@"; do printf '%s\n' "${a//"$STAGE_ROOT"/ROOT}"; done > "$CAPTURE/args"
find . -print | LC_ALL=C sort > "$CAPTURE/paths"
find . -type f -print | LC_ALL=C sort | while IFS= read -r f; do
  printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"
done > "$CAPTURE/files"
exit 0
SH
chmod +x "$tmp/bin/claude"

capture() { # capture <root> <args...>; prints the capture directory; returns run.sh's status
  local root="$1"; shift
  local cap; cap="$(mktemp -d "$tmp/cap-XXXXXX")"
  local st=0
  (cd "$root" && PATH="$tmp/bin:$PATH" STAGE_ROOT="$root" CAPTURE="$cap" bash evals/run.sh "$@") > "$cap.out" 2> "$cap.err" || st=$?
  echo "$cap"; return $st
}
same() { # same <capA> <capB> <label>
  for part in args paths files; do
    [ -f "$1/$part" ] && [ -f "$2/$part" ] || fail "$3: capture has no $part"
    cmp -s "$1/$part" "$2/$part" || { diff "$1/$part" "$2/$part" | head -5 >&2 || true; fail "$3: $part differ"; }
  done
}
plus_agents() { # plus_agents <baseCap> <newCap> <label> <agent...>: new = base + exactly those agent files
  local b="$1" c="$2" label="$3"; shift 3
  cmp -s "$b/args" "$c/args" || fail "$label: args differ"
  { cat "$b/paths"; echo "./agents"; for a in "$@"; do echo "./agents/$a.md"; done; } | LC_ALL=C sort > "$tmp/exp.paths"
  cmp -s "$tmp/exp.paths" "$c/paths" || { diff "$tmp/exp.paths" "$c/paths" | head -5 >&2 || true; fail "$label: paths are not base plus the agent files"; }
  { cat "$b/files"; for a in "$@"; do
      printf '%s  %s\n' "$(shasum -a 256 "$repo/packages/spec/src/claude/agents/$a.md" | cut -d' ' -f1)" "./agents/$a.md"
    done; } | LC_ALL=C sort > "$tmp/exp.files"
  LC_ALL=C sort "$c/files" | cmp -s "$tmp/exp.files" - || fail "$label: files are not base plus the agent bytes"
}

# 1. Without --with-agent, every existing suite builds the same plugin and calls claude the same way.
for suite in specs develop scout debug fix; do
  b="$(capture "$base_root" "$suite" --validate)" || fail "base $suite --validate exited non-zero"
  c="$(capture "$new_root" "$suite" --validate)" || fail "new $suite --validate exited non-zero"
  same "$b" "$c" "$suite --validate"
  grep -qx './agents' "$c/paths" && fail "$suite --validate built an agents/ folder"
  ok "$suite --validate: plugin tree, file bytes and claude arguments equal e93060b"
done
b_fix="$(capture "$base_root" fix --with-skill debug --with-skill scout --validate)" || fail "base fix --with-skill --validate exited non-zero"
c="$(capture "$new_root" fix --with-skill debug --with-skill scout --validate)" || fail "new fix --with-skill --validate exited non-zero"
same "$b_fix" "$c" "fix --with-skill debug --with-skill scout --validate"
ok "fix --with-skill debug --with-skill scout --validate: equal to e93060b"

# 2. The run branch: same call, and each copy writes only under its own root.
b="$(capture "$base_root" fix --with-skill debug --with-skill scout --out chk --runs 1 --case loi-don-gian)" || fail "base run branch exited non-zero"
c="$(capture "$new_root" fix --with-skill debug --with-skill scout --out chk --runs 1 --case loi-don-gian)" || fail "new run branch exited non-zero"
same "$b" "$c" "run branch"
[ -d "$base_root/evals/results/fix/chk" ] && [ -d "$new_root/evals/results/fix/chk" ] || fail "run branch: a copy did not create its own evals/results/fix/chk"
[ ! -e "$repo/evals/results/fix/chk" ] || fail "run branch wrote under the repository"
ok "run branch (--out chk --runs 1 --case loi-don-gian): equal to e93060b, results only under each copy"

# 3-5. With --with-agent, the plugin gains exactly agents/<name>.md with the agent's bytes, in any flag order.
b_specs="$(capture "$base_root" specs --validate)" || fail "base specs --validate exited non-zero"
c="$(capture "$new_root" specs --with-agent code-auditor --validate)" || fail "specs --with-agent code-auditor --validate exited non-zero"
plus_agents "$b_specs" "$c" "specs --with-agent code-auditor" code-auditor
ok "specs --with-agent code-auditor --validate: base plus agents/code-auditor.md with its bytes"
c="$(capture "$new_root" fix --with-skill debug --with-agent code-auditor --with-skill scout --validate)" || fail "interleaved flags exited non-zero"
plus_agents "$b_fix" "$c" "fix --with-skill debug --with-agent code-auditor --with-skill scout" code-auditor
c="$(capture "$new_root" fix --with-agent code-auditor --with-skill debug --with-skill scout --validate)" || fail "agent-first flags exited non-zero"
plus_agents "$b_fix" "$c" "fix --with-agent code-auditor --with-skill debug --with-skill scout" code-auditor
ok "fix with --with-agent before or between --with-skill: base plus agents/code-auditor.md"
c="$(capture "$new_root" specs --with-agent code-auditor --with-agent researcher --validate)" || fail "two agents exited non-zero"
plus_agents "$b_specs" "$c" "specs --with-agent code-auditor --with-agent researcher" code-auditor researcher
ok "specs --with-agent code-auditor --with-agent researcher --validate: base plus both agent files"

# 6. A bad name stops with exit 2 and its message before claude is called; a missing value stops too.
refuse() { # refuse <expected status or "nonzero"> <message or ""> <args...>
  local want="$1" msg="$2"; shift 2
  local st=0 c; c="$(capture "$new_root" specs "$@")" || st=$?
  if [ "$want" = nonzero ]; then [ "$st" -ne 0 ] || fail "specs $*: exited 0"; else [ "$st" -eq "$want" ] || fail "specs $*: exited $st, not $want"; fi
  [ -z "$msg" ] || grep -qF -- "$msg" "$c.err" || fail "specs $*: stderr lacks '$msg'"
  [ -z "$(ls -A "$c")" ] || fail "specs $*: reached claude"
}
refuse 2 "no agent at packages/spec/src/claude/agents/nope.md" --with-agent nope --validate
refuse 2 "--with-agent takes one agent name" --with-agent ../agents/code-auditor --validate
refuse 2 "--with-agent takes one agent name" --with-agent . --validate
refuse nonzero "" --with-agent
ok "bad agent names exit 2 with their message, a missing value exits non-zero, none reaches claude"
