#!/usr/bin/env bash
# Observe how Claude Code treats a plugin loaded with --plugin-dir, before the
# real cf plugin is built: context injection in print mode, ${CLAUDE_PLUGIN_ROOT}
# in Bash / skill body / reference files, agent naming, and hook env options.
# Prints exactly seven `FACT name=value` lines. Costs two `claude -p` turns.
set -euo pipefail

WORK="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-plugin-spike.XXXXXX")"
# --plugin-dir loads the plugin as probe-cf@inline; the host creates its data
# directory under ~/.claude, so remove it on exit when this run created it.
HOST_DATA="$HOME/.claude/plugins/data/probe-cf-inline"
[ -e "$HOST_DATA" ] && HOST_DATA_EXISTED=1 || HOST_DATA_EXISTED=0
cleanup() { rm -rf "$WORK"; [ "$HOST_DATA_EXISTED" = 1 ] || rm -rf "$HOST_DATA"; }
trap cleanup EXIT

PLUGIN="$WORK/plugin"
REPO="$WORK/repo"
ENV_OUT="$WORK/hook-env"
MARKER="SPIKE-CONTEXT-7Q2"
mkdir -p "$PLUGIN/.claude-plugin" "$PLUGIN/hooks" "$PLUGIN/agents" "$PLUGIN/skills/probe-skill" "$REPO" "$ENV_OUT"

cat > "$PLUGIN/.claude-plugin/plugin.json" <<'JSON'
{
  "name": "probe-cf",
  "version": "0.0.1",
  "description": "Throwaway plugin used to observe host behavior",
  "author": { "name": "cafekit" },
  "userConfig": {
    "probe": { "type": "string", "title": "Probe", "description": "Probe option", "default": "x" }
  }
}
JSON

# The hook records only plugin-related variables, then injects the marker.
cat > "$PLUGIN/hooks/session.sh" <<SH
#!/usr/bin/env bash
run="\$\$-\$RANDOM"
env | grep -E '^(CLAUDE_PLUGIN_|CLAUDE_PROJECT_DIR=)' > "$ENV_OUT/env-\$run.txt" || true
printf '%s' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"The session marker is $MARKER."}}'
SH
chmod +x "$PLUGIN/hooks/session.sh"

cat > "$PLUGIN/hooks/hooks.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/session.sh" } ] }
    ]
  }
}
JSON

cat > "$PLUGIN/agents/probe-agent.md" <<'MD'
---
name: probe-agent
description: Probe agent used only to observe agent naming. Never call it.
---
Root is ${CLAUDE_PLUGIN_ROOT}.
MD

cat > "$PLUGIN/skills/probe-skill/SKILL.md" <<'MD'
---
name: probe-skill
description: Probe skill that reports its own paths. Use when asked to run probe-skill.
---
SKILL_BODY_PATH: ${CLAUDE_PLUGIN_ROOT}/skills/probe-skill/ref.md

Read the file at SKILL_BODY_PATH and report its first line verbatim.
MD
printf '%s\n' 'REF_LINE: ${CLAUDE_PLUGIN_ROOT}/marker.txt' > "$PLUGIN/skills/probe-skill/ref.md"

git -C "$REPO" init -q

PROMPT='Answer with exactly these five lines and nothing else.
A1: the session marker you were given, or NONE.
A2: the output of running the Bash command echo "[$CLAUDE_PLUGIN_ROOT]".
A3: invoke the probe-skill skill, then give the SKILL_BODY_PATH value exactly as it appears in the skill text.
A4: the first line of the file at that path, read with the Read tool, verbatim.
A5: the full name of every available agent or subagent type whose name contains "probe", comma-separated, or NONE.'

ask() {
  (cd "$REPO" && claude -p "$PROMPT" --plugin-dir "$PLUGIN" --output-format json \
    --allowedTools "Bash(echo:*)" "Read" "Skill" "$@") \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{process.stdout.write(JSON.parse(s).result||"")})'
}
line() { printf '%s\n' "$1" | { grep -E "^$2:" || true; } | head -1 | sed -E "s/^$2:[[:space:]]*//"; }
env_value() { { grep -h "^$1=" "$ENV_OUT"/env-*.txt 2>/dev/null || true; } | head -1 | cut -d= -f2-; }

first="$(ask)"
printf '%s\n' "--- model answers (turn 1) ---" "$first" "---" >&2
a1="$(line "$first" A1)"; a2="$(line "$first" A2)"; a3="$(line "$first" A3)"; a4="$(line "$first" A4)"; a5="$(line "$first" A5)"

yes_no() { if [ "$1" = true ]; then echo yes; else echo no; fi; }
[ "$a1" = "$MARKER" ] || [ "${a1%.}" = "$MARKER" ] && ctx=true || ctx=false
case "$a2" in "[$PLUGIN]"*|"["/*"]") bash_root=true ;; *) bash_root=false ;; esac
case "$a3" in *'${CLAUDE_PLUGIN_ROOT}'*) body=no ;; /*) body=yes ;; *) body="unclear(${a3:-empty})" ;; esac
case "$a4" in *'${CLAUDE_PLUGIN_ROOT}'*) ref=no ;; *"REF_LINE: /"*) ref=yes ;; *) ref="unclear(${a4:-empty})" ;; esac

data="$(env_value CLAUDE_PLUGIN_DATA)"
opt="$(env_value CLAUDE_PLUGIN_OPTION_PROBE)"

# Second turn: try to set the option through flag-scope settings.
rm -f "$ENV_OUT"/env-*.txt
SETTINGS='{"pluginConfigs":{"probe-cf@inline":{"options":{"probe":"y"}}}}'
ask --settings "$SETTINGS" > /dev/null
second_opt="$(env_value CLAUDE_PLUGIN_OPTION_PROBE)"

echo "FACT context_in_print_mode=$(yes_no "$ctx")"
echo "FACT bash_has_plugin_root=$(yes_no "$bash_root") (A2=${a2:-empty})"
echo "FACT reference_substituted=skill_body:$body reference_file:$ref"
echo "FACT agent_name=${a5:-empty}"
echo "FACT hook_env_plugin_data=${data:-absent}"
echo "FACT hook_env_option=${opt:-absent}"
if [ "$second_opt" = "y" ]; then echo "FACT option_settable=yes"; else echo "FACT option_settable=no (saw ${second_opt:-absent})"; fi
