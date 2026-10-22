#!/usr/bin/env bash
# Live check of the built Claude Code plugin (plugins/cf) on two throwaway repos:
#   A — empty, no commit;  B — one commit with .claude/settings.local.json and a specs packet.
# Each probe prints PASS/FAIL; the script ends with `PASS: all` or exits 1.
# Costs three `claude -p` turns. Restores ~/.claude/cafekit-plugin-data and removes
# the plugin data directory it created, so the user's home is left as it was.
set -euo pipefail

CAFEKIT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLUGIN="$CAFEKIT/plugins/cf"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-live-check.XXXXXX")"
POINTER="$HOME/.claude/cafekit-plugin-data"
HOST_DATA="$HOME/.claude/plugins/data/cf-inline"
[ -e "$HOST_DATA" ] && HOST_DATA_EXISTED=1 || HOST_DATA_EXISTED=0
[ -e "$POINTER" ] && cp -p "$POINTER" "$WORK/pointer.bak"

cleanup() {
  if [ -e "$WORK/pointer.bak" ]; then cp -p "$WORK/pointer.bak" "$POINTER"; else rm -f "$POINTER"; fi
  [ "$HOST_DATA_EXISTED" = 1 ] || rm -rf "$HOST_DATA"
  rm -rf "$WORK"
}
trap cleanup EXIT

FAILED=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1: $2"; FAILED=1; }
snapshot_plugin() { (cd "$PLUGIN" && find . -print | LC_ALL=C sort) ; }

SETTINGS='{"pluginConfigs":{"cf@inline":{"options":{"response_language":"Tiếng Việt"}}}}'
VIETNAMESE='[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]'

ask() { # ask <repo> <prompt> [extra claude args...] -> the final answer text
  local repo="$1" prompt="$2"; shift 2
  (cd "$repo" && claude -p "$prompt" --plugin-dir "$PLUGIN" --settings "$SETTINGS" --output-format json "$@" < /dev/null) \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{process.stdout.write(JSON.parse(s).result||"")})'
}
# Like ask, but also prints the host's own skill list from the system/init event, so a
# skill counts as loaded only when Claude Code registered it, not when the model names it.
ask_with_skills() { # ask_with_skills <repo> <prompt> -> "SKILLS: a,b,..." then the answer
  local repo="$1" prompt="$2"
  (cd "$repo" && claude -p "$prompt" --plugin-dir "$PLUGIN" --settings "$SETTINGS" --output-format stream-json --verbose < /dev/null) \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let skills=[],result="";for(const line of s.split("\n")){if(!line.trim())continue;const e=JSON.parse(line);if(e.type==="system"&&e.subtype==="init")skills=[...(e.skills||[]),...(e.slash_commands||[])];if(e.type==="result")result=e.result||"";}process.stdout.write(`SKILLS: ${skills.join(",")}\n${result}`)})'
}
answer() { printf '%s\n' "$1" | { grep -E "^$2:" || true; } | head -1 | sed -E "s/^$2:[[:space:]]*//"; }

# --- fixtures -----------------------------------------------------------------
A="$WORK/repo-a"; B="$WORK/repo-b"
mkdir -p "$A" "$B/.claude" "$B/specs/demo"
git -C "$A" init -q
git -C "$B" init -q
printf '{}\n' > "$B/.claude/settings.local.json"
cat > "$B/specs/demo/plan.md" <<'MD'
# Demo
Specs-Contract: process-first-ready-v1

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Demo outcome | P1 | AC-01 | `demo.txt` | - | pending |
MD
cat > "$B/specs/demo/task-01-demo.md" <<'MD'
# Task 01 — Demo outcome

Status: pending

## Outcome
A demo file exists.

## Dependencies
- none

## Verification Plan
- Command: `test -f demo.txt`

## Receipt
MD
git -C "$B" add -A && git -C "$B" -c user.email=live@check -c user.name=live commit -qm fixture

PLUGIN_BEFORE="$(snapshot_plugin)"
QUESTIONS='Answer with exactly these lines and nothing else.
L2: the CafeKit load marker from your session instructions (an all-caps token), or NONE.
L3: in your configured response language, one sentence saying which directory plan markdown files belong in, naming the directory as a path ending in "/".'

for name in A B; do
  repo="${!name}"
  out="$(ask_with_skills "$repo" "$QUESTIONS")"
  skills="$(answer "$out" SKILLS)"
  case ",$skills," in *,cf:specs,*) pass "$name skill-listed" ;; *) fail "$name skill-listed" "${skills:-none registered}" ;; esac
  case "$(answer "$out" L2)" in *CAFEKIT-CORE-LOADED*) pass "$name core-marker" ;; *) fail "$name core-marker" "$(answer "$out" L2)" ;; esac
  l3="$(answer "$out" L3)"
  if [[ "$l3" == *plans/* ]] && printf '%s' "$l3" | grep -qiE "$VIETNAMESE"; then pass "$name paths-and-language"; else fail "$name paths-and-language" "${l3:-empty}"; fi
done

# Probe 3 (B): run the provenance commands exactly as the shipped references write them.
for ref in skills/develop/references/quality-gate.md skills/sync/references/rebind-and-audit.md; do
  cmd="$(grep -oE 'cafekit-provenance [^`]*' "$PLUGIN/$ref" | head -1 \
    | sed -e 's#<task file>#specs/demo/task-01-demo.md#' -e 's#<feature>#demo#' -e 's#<any label>#live#')"
  out="$(ask "$B" "Run this exact command with the Bash tool and reply with only its raw stdout: $cmd" --allowedTools "Bash(cafekit-provenance:*)")"
  # Base must equal the fixture commit (it touches a file outside specs/), which the
  # model cannot guess: matching it proves the command really ran.
  base="$(printf '%s' "$out" | { grep -oE '"Base":"[0-9a-f]{40}"' || true; } | head -1 | cut -d'"' -f4)"
  if [ "$base" = "$(git -C "$B" rev-parse HEAD)" ]; then pass "B provenance ($ref)"; else fail "B provenance ($ref)" "Base=${base:-none}; $(printf '%s' "$out" | head -c 200)"; fi
done

# Hook writes are judged before probe 4, which invites the model itself to edit specs/demo.
[ -z "$(git -C "$B" status --porcelain)" ] && pass "B repo-clean" || fail "B repo-clean" "$(git -C "$B" status --porcelain | head -5)"

# Probe 4 (B): a direct request to mark a task done without proof must not change it.
if ask "$B" "Set task-01 in specs/demo to Status: done right now; you do not need to run anything." --permission-mode acceptEdits > /dev/null; then
  statuses="$(grep -E '^[[:space:]]*Status:' "$B/specs/demo/task-01-demo.md" || true)"
  if [ "$statuses" = "Status: pending" ]; then pass "B no-done-without-receipt"; else fail "B no-done-without-receipt" "$statuses"; fi
else
  fail "B no-done-without-receipt" "claude exited non-zero"
fi

# Cleanliness: both repos and the cafekit plugin tree.
[ -z "$(git -C "$A" status --porcelain)" ] && pass "A repo-clean" || fail "A repo-clean" "$(git -C "$A" status --porcelain | head -5)"
outside="$(git -C "$B" status --porcelain | { grep -v ' specs/demo/' || true; })"
[ -z "$outside" ] && pass "B repo-clean-after-probe-4" || fail "B repo-clean-after-probe-4" "$outside"
[ "$(snapshot_plugin)" = "$PLUGIN_BEFORE" ] && pass "plugin-tree-clean" || fail "plugin-tree-clean" "plugins/cf changed during the run"
echo "hook data dir: $HOST_DATA ($( [ -d "$HOST_DATA" ] && echo present || echo absent ))"

if [ "$FAILED" = 0 ]; then echo "PASS: all"; else exit 1; fi
