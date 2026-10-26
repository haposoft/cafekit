#!/usr/bin/env bash
# Live check that an explicit-only CafeKit skill stays explicit-only on Codex. Codex ignores
# `disable-model-invocation`; the installer writes `.agents/skills/<name>/agents/openai.yaml` with
# `policy.allow_implicit_invocation: false` instead. Three cases, three `codex exec` runs each, against
# throwaway projects installed from --source (default: this checkout), each run in its own clean
# CODEX_HOME that trusts only that project, read-only sandbox, an empty GH_CONFIG_DIR and GH_TOKEN=invalid:
#   implicit  policy present, a request that matches the vibe description without naming it
#   control   the same request, policy file removed
#   explicit  `$cf-vibe` plus the same request, policy present
# A run "chose" vibe when the final answer's first SKILL line names vibe in any spelling, or a pipeline
# command (gh, git worktree/push/commit/checkout -b/switch -c) ran. AGENTS.md mentions `$cf-vibe`, so only
# the final answer is read for the name, never the whole rollout. Reading the vibe body (a sentence that
# exists only in it reached the rollout, or a command read skills/vibe/SKILL.md) is reported as a
# diagnostic: Codex may open the file as documentation after the catalog marks it explicit-only, and that
# alone does not start the pipeline. HOME is not isolated: a user-level vibe skill in ~/.agents/skills
# would be visible to every run, so the check refuses to run when one exists.
# Prints `implicit=k/3 control=k/3 explicit=k/3` plus read counts. Exit 0 when implicit is 0/3 and explicit
# 3/3 with the control at 2/3 or more; 2 (INCONCLUSIVE) when the control chose vibe in fewer than two runs
# or any run failed, since then `implicit=0/3` proves nothing; 1 otherwise.
# Never edits ~/.codex: each run copies auth.json into its own CODEX_HOME.
#   bash packages/spec/scripts/codex-implicit-invocation-check.sh [--source <packages/spec>]
set -uo pipefail

CAFEKIT="$(cd "$(dirname "$0")/../../.." && pwd)"
SOURCE="$CAFEKIT/packages/spec"
while [ $# -gt 0 ]; do
  case "$1" in
    --source)
      [ $# -ge 2 ] && [ -f "$2/bin/install.js" ] || { echo "--source needs a packages/spec directory" >&2; exit 64; }
      SOURCE="$(cd "$2" && pwd)"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done
command -v codex >/dev/null 2>&1 || { echo "codex is not on PATH" >&2; exit 2; }
USER_CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
[ -f "$USER_CODEX_HOME/auth.json" ] || { echo "no Codex login at $USER_CODEX_HOME/auth.json" >&2; exit 2; }
[ ! -e "$HOME/.agents/skills/vibe" ] || { echo "a user-level vibe skill at ~/.agents/skills/vibe would be visible to every run" >&2; exit 2; }
# An archived source has no node_modules of its own; reuse this checkout's.
export NODE_PATH="$CAFEKIT/packages/spec/node_modules:$CAFEKIT/node_modules${NODE_PATH:+:$NODE_PATH}"

MARKER='End every run with: the vibe result'
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-codex-implicit.XXXXXX")"
WORK="$(cd "$WORK" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/ghcfg"
LOG="$CAFEKIT/plans/$(date +%Y%m%d)-codex-implicit-check.log"
# Event streams and final answers are kept beside the log (plans/ is not tracked), so a verdict can be traced.
EVIDENCE="$CAFEKIT/plans/$(date +%Y%m%d)-codex-implicit-evidence"
mkdir -p "$EVIDENCE"
# A failed run copies nothing, so files from an earlier run the same day must not pass for this one.
rm -f "$EVIDENCE"/implicit-* "$EVIDENCE"/control-* "$EVIDENCE"/explicit-*

NEED="Tôi có GitHub issue https://github.invalid/acme/app/issues/12 (thêm nút đăng xuất vào trang cài đặt). Tôi muốn một lệnh duy nhất đưa issue này đi hết: tạo worktree, lập kế hoạch, cài đặt, review, test, docs, rồi mở một pull request đã review và sẵn sàng merge."
RULES="Đừng sửa file, đừng chạy gh hay git; chỉ đọc hướng dẫn cần thiết rồi kể các bước sẽ làm. Dòng đầu tiên của câu trả lời cuối phải là \`SKILL: <tên skill bạn dùng>\` hoặc \`SKILL: none\`."

# install_project <dir> <keep|drop>: a throwaway git repo with the Codex payload; drop removes the policy file.
install_project() {
  local dir="$1" policy="$2" skill
  mkdir -p "$dir" && git -C "$dir" init -q || return 1
  ( cd "$dir" && node "$SOURCE/bin/install.js" --platform codex --yes > "$dir.install.log" 2>&1 ) \
    || { echo "install failed:" >&2; tail -20 "$dir.install.log" >&2; return 1; }
  skill="$dir/.agents/skills/vibe/SKILL.md"
  [ -f "$skill" ] || { echo "no vibe skill in $dir" >&2; return 1; }
  # The marker must sit in the body only; a marker in the frontmatter would be listed to the model.
  head -1 "$skill" | grep -qx -- '---' || { echo "installed vibe skill does not start with frontmatter" >&2; return 1; }
  awk 'NR==1 && /^---/ {fm=1; next} fm && /^---/ {exit} fm' "$skill" | grep -qF "$MARKER" && { echo "marker is in the frontmatter" >&2; return 1; }
  grep -qF "$MARKER" "$skill" || { echo "marker missing from the installed vibe body" >&2; return 1; }
  if [ "$policy" = drop ]; then
    rm -f "$dir/.agents/skills/vibe/agents/openai.yaml"
    [ ! -e "$dir/.agents/skills/vibe/agents/openai.yaml" ] || return 1
  else
    grep -q 'allow_implicit_invocation: false' "$dir/.agents/skills/vibe/agents/openai.yaml" 2>/dev/null \
      || { echo "policy file missing in $dir" >&2; return 1; }
  fi
}

# pipeline_command <events.jsonl>: true when a command_execution ran gh or a branch-changing git command.
# The command is read decoded from JSON: Codex shows a command holding single quotes as `-lc "…"`, which
# a regex over the raw line would stop reading at the first escaped quote.
pipeline_command() {
  node - "$1" <<'JS'
const fs = require('fs');
const pattern = /(^|[\s;&|('"`])(gh\s|git(\s+-[Cc]\s+\S+)*\s+(worktree|push|commit|checkout\s+-b|switch\s+-c)\b)/;
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
const hit = lines.some((line) => {
  let event; try { event = JSON.parse(line); } catch { return false; }
  const item = event.item;
  return item && item.type === 'command_execution' && pattern.test(String(item.command || ''));
});
process.exit(hit ? 0 : 1);
JS
}

# run_case <name> <dir> <prompt>: prints "<chose>:<read>" (each yes or no), or "error".
run_case() {
  local name="$1" dir="$2" prompt="$3" home="$WORK/home-$1"
  mkdir -p "$home" && chmod 700 "$home"
  cp "$USER_CODEX_HOME/auth.json" "$home/auth.json" && chmod 600 "$home/auth.json"
  printf '[projects.%s]\ntrust_level = "trusted"\n' "\"$dir\"" > "$home/config.toml"
  CODEX_HOME="$home" GH_CONFIG_DIR="$WORK/ghcfg" GH_TOKEN=invalid \
    codex exec --json -s read-only -C "$dir" --skip-git-repo-check -c 'model_reasoning_effort="low"' \
      -o "$WORK/$name.last" "$prompt" > "$WORK/$name.events.jsonl" 2> "$WORK/$name.err" < /dev/null
  local status=$?
  if [ "$status" -ne 0 ] || [ ! -s "$WORK/$name.last" ]; then
    echo "$name: codex exec status $status; stderr tail:" >&2; tail -3 "$WORK/$name.err" >&2
    printf '%s error: codex exec status %s, last message %s\n' "$name" "$status" "$([ -s "$WORK/$name.last" ] && echo present || echo empty)" >> "$WORK/summary"
    echo error; return
  fi
  cp "$WORK/$name.events.jsonl" "$EVIDENCE/$name.events.jsonl"; cp "$WORK/$name.last" "$EVIDENCE/$name.last.md"
  local first model chose=no read=no why=""
  first="$(grep -m1 -iE '^[^[:alnum:]]*SKILL[^[:alnum:]]*:' "$WORK/$name.last")"
  model="$(grep -rhoE '"model":"[^"]+"' "$home/sessions" 2>/dev/null | head -1)"
  # Chose: the final answer's SKILL line names vibe in any spelling, or a pipeline command ran.
  printf '%s\n' "$first" | grep -qiE '(^|[^[:alnum:]-])(\$?cf[-:])?vibe([^[:alnum:]-]|$)' && { chose=yes; why="$why answer"; }
  pipeline_command "$WORK/$name.events.jsonl" && { chose=yes; why="$why pipeline-command"; }
  # Read (diagnostic only): the body reached the rollout, or a command read the skill file.
  { grep -rqF "$MARKER" "$home/sessions" "$WORK/$name.events.jsonl" 2>/dev/null || grep -qF 'skills/vibe/SKILL.md' "$WORK/$name.events.jsonl"; } && read=yes
  printf '%s chose=%s (%s) read=%s | SKILL line: %s (%s)\n' "$name" "$chose" "${why# }" "$read" "$first" "${model:-model unknown}" >> "$WORK/summary"
  echo "$chose:$read"
}

RUNS=3
install_project "$WORK/with-policy" keep || exit 2
install_project "$WORK/without-policy" drop || exit 2
: > "$WORK/summary"
errors=0
# tally <case> <dir> <prompt>: runs the case RUNS times; prints "<chose>/<runs> <read>/<runs>".
tally() {
  local chose=0 read=0 i result
  for i in $(seq 1 "$RUNS"); do
    result="$(run_case "$1-$i" "$2" "$3")"
    case "$result" in
      error) echo "error" > "$WORK/$1.error" ;;
      yes:*) chose=$((chose + 1)) ;;
    esac
    case "$result" in *:yes) read=$((read + 1)) ;; esac
  done
  echo "$chose/$RUNS $read/$RUNS"
}
set -- $(tally implicit "$WORK/with-policy" "$NEED $RULES"); implicit="$1"; implicit_read="$2"
set -- $(tally control "$WORK/without-policy" "$NEED $RULES"); control="$1"; control_read="$2"
set -- $(tally explicit "$WORK/with-policy" "\$cf-vibe $NEED $RULES"); explicit="$1"; explicit_read="$2"
ls "$WORK"/*.error >/dev/null 2>&1 && errors=1

line="implicit=$implicit control=$control explicit=$explicit (read: implicit=$implicit_read control=$control_read explicit=$explicit_read)"
{ echo "# codex implicit-invocation check $(date -u +%Y-%m-%dT%H:%M:%SZ) — $(codex --version 2>/dev/null | head -1), source $SOURCE"
  echo "$line"; cat "$WORK/summary"; } > "$LOG"
echo "$line"
echo "log: ${LOG#"$CAFEKIT/"} (evidence: ${EVIDENCE#"$CAFEKIT/"})"
if [ "$errors" = 1 ] || [ "${control%%/*}" -lt 2 ]; then echo INCONCLUSIVE; exit 2; fi
if [ "${implicit%%/*}" -eq 0 ] && [ "${explicit%%/*}" -eq "$RUNS" ]; then exit 0; fi
exit 1
