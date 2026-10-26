#!/usr/bin/env bash
# Observe how Codex CLI treats a plugin from a local marketplace, before the real
# cf plugin is built. Everything runs under a throwaway CODEX_HOME whose auth.json
# is a symlink to the user's; the real ~/.codex is never written, and the script
# proves that with a manifest of the paths plugin commands touch.
# Prints exactly fifteen `FACT name=value` lines. Costs a few `codex exec` turns.
set -euo pipefail

REAL_HOME="${CODEX_HOME:-$HOME/.codex}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-codex-spike.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# config.toml, agents, plugins and skills are what marketplace/plugin commands write.
manifest() {
  (cd "$REAL_HOME" && find config.toml agents plugins skills -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"
  done)
}
REAL_BEFORE="$(manifest)"

export CODEX_HOME="$WORK/codex-home"
MARKET="$WORK/market"; PLUGIN="$MARKET/plugins/probe-cf"
A="$WORK/repo-a"; B="$WORK/repo-b"; ENV_OUT="$WORK/hook-env"
mkdir -p "$CODEX_HOME" "$PLUGIN/.codex-plugin" "$PLUGIN/skills/probe-skill" "$PLUGIN/hooks" "$PLUGIN/bin" "$PLUGIN/agents" \
  "$MARKET/.agents/plugins" "$A" "$B" "$ENV_OUT"
ln -s "$REAL_HOME/auth.json" "$CODEX_HOME/auth.json"
cat > "$CODEX_HOME/config.toml" <<TOML
[features]
hooks = true

[projects."$(cd "$A" && pwd -P)"]
trust_level = "trusted"

[projects."$(cd "$B" && pwd -P)"]
trust_level = "trusted"
TOML

MARKER="SPIKE-CODEX-CONTEXT-4K"; SKILL_NONCE="SKILLBODY-9F3Q"; REPO_NONCE="REPOSKILL-2M7X"; BIN_NONCE="PLUGINBIN-6T1R"

cat > "$PLUGIN/.codex-plugin/plugin.json" <<'JSON'
{
  "name": "probe-cf",
  "version": "0.0.1",
  "description": "Throwaway plugin used to observe Codex host behavior",
  "author": { "name": "cafekit" },
  "userConfig": {
    "probe": { "type": "string", "title": "Probe", "description": "Probe option", "default": "x" }
  }
}
JSON
cat > "$PLUGIN/skills/probe-skill/SKILL.md" <<MD
---
name: probe-skill
description: Probe skill that reports a nonce. Use when asked to run probe-skill.
---
The probe-skill nonce is $SKILL_NONCE.
SKILL_BODY_PATH: \${PLUGIN_ROOT}/skills/probe-skill/ref.md
MD
printf '%s\n' 'REF_LINE: ${PLUGIN_ROOT}/marker.txt' > "$PLUGIN/skills/probe-skill/ref.md"
printf '#!/bin/sh\necho %s\n' "$BIN_NONCE" > "$PLUGIN/bin/probe-bin"; chmod +x "$PLUGIN/bin/probe-bin"
cat > "$PLUGIN/agents/probe-agent.toml" <<'TOML'
name = "probe_agent"
description = "Probe agent used only to observe whether plugins ship agents."
developer_instructions = "Reply with PROBE-AGENT-OK."
TOML
cat > "$PLUGIN/hooks/session.sh" <<SH
#!/bin/sh
payload="\$(cat)"
run="\$\$-\$(date +%s)"
env | grep -E '^(PLUGIN_|CLAUDE_PLUGIN_|CLAUDE_PROJECT_DIR=)' | sed 's/=.*//' | sort > "$ENV_OUT/names-\$run.txt" || true
env | grep -E '^(PLUGIN_ROOT|PLUGIN_DATA|CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|PLUGIN_OPTION_PROBE|CLAUDE_PLUGIN_OPTION_PROBE)=' > "$ENV_OUT/env-\$run.txt" || true
printf '%s' "\$payload" > "$ENV_OUT/payload-\$run.json"
printf '%s' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"The session marker is $MARKER."}}'
SH
chmod +x "$PLUGIN/hooks/session.sh"
cat > "$PLUGIN/hooks/hooks.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "sh \"${PLUGIN_ROOT}/hooks/session.sh\"" } ] }
    ]
  }
}
JSON
cat > "$MARKET/.agents/plugins/marketplace.json" <<'JSON'
{
  "name": "probe-market",
  "plugins": [
    { "name": "probe-cf", "source": { "source": "local", "path": "./plugins/probe-cf" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" }, "category": "Developer Tools" }
  ]
}
JSON

# Repo B mirrors cafekit: a Claude marketplace named cafekit with plugin cf, and an
# npx-style repo skill with the same name as the plugin skill.
mkdir -p "$B/.claude-plugin" "$B/plugins/cf/.claude-plugin" "$B/plugins/cf/hooks" "$B/.agents/skills/probe-skill"
cat > "$B/.claude-plugin/marketplace.json" <<'JSON'
{ "name": "cafekit", "owner": { "name": "Haposoft" }, "description": "decoy",
  "plugins": [ { "name": "cf", "source": "./plugins/cf", "description": "Claude tree decoy" } ] }
JSON
printf '%s\n' '{ "name": "cf", "version": "0.0.1", "description": "Claude tree decoy" }' > "$B/plugins/cf/.claude-plugin/plugin.json"
printf '%s\n' '{ "hooks": {} }' > "$B/plugins/cf/hooks/hooks.json"
cat > "$B/.agents/skills/probe-skill/SKILL.md" <<MD
---
name: probe-skill
description: Repository copy of probe-skill. Use when asked to run probe-skill.
---
The probe-skill nonce is $REPO_NONCE.
MD
git -C "$A" init -q; git -C "$B" init -q

codex plugin marketplace add "$MARKET" > "$WORK/market-add.log" 2>&1
codex plugin add probe-cf@probe-market > "$WORK/plugin-add.log" 2>&1 || true

ask() { # ask <repo> <outfile> <prompt> [codex args...]
  local repo="$1" out="$2" prompt="$3"; shift 3
  codex exec --skip-git-repo-check -C "$repo" -s workspace-write -c 'approval_policy="never"' \
    -o "$out" "$@" "$prompt" < /dev/null > "$out.log" 2>&1 || true
  cat "$out" 2>/dev/null || true
}
line() { printf '%s\n' "$1" | { grep -E "^$2:" || true; } | head -1 | sed -E "s/^$2:[[:space:]]*//"; }
count_env() { find "$ENV_OUT" -name 'env-*.txt' | wc -l | tr -d ' '; }
newest() { find "$ENV_OUT" -name "$1" -print0 | xargs -0 ls -t 2>/dev/null | head -1 || true; }

# Turn 1, no hook trust: does the hook run at all?
before="$(count_env)"
ask "$A" "$WORK/t1.txt" "Reply with the single word OK." > /dev/null
untrusted_runs=$(( $(count_env) - before ))

QUESTIONS="Answer with exactly these lines and nothing else.
A1: the session marker you were given (an all-caps token), or NONE.
A2: the exact text a user types to invoke the probe-skill skill, or NONE.
A3: use the probe-skill skill and give the nonce it states, or NONE.
A4: the SKILL_BODY_PATH value exactly as written in that skill, or NONE.
A5: the first line of the file at that path read from disk, verbatim, or NONE.
A6: the output of running the shell command probe-bin, or NONE.
A7: the names of every available agent or subagent type containing probe, comma-separated, or NONE."
before="$(count_env)"
out="$(ask "$A" "$WORK/t2.txt" "$QUESTIONS" --dangerously-bypass-hook-trust)"
trusted_runs=$(( $(count_env) - before ))
a1="$(line "$out" A1)"; a2="$(line "$out" A2)"; a3="$(line "$out" A3)"; a4="$(line "$out" A4)"
a5="$(line "$out" A5)"; a6="$(line "$out" A6)"; a7="$(line "$out" A7)"

envf="$(newest 'env-*.txt')"
namesf="$(newest 'names-*.txt')"
payloadf="$(newest 'payload-*.json')"
env_names="$( [ -n "$namesf" ] && tr '\n' ',' < "$namesf" | sed 's/,$//' )"
option="$( [ -n "$envf" ] && { grep -E 'OPTION_PROBE=' "$envf" || true; } | head -1 )"
has_cwd="$( [ -n "$payloadf" ] && node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(typeof p.cwd==="string"&&p.cwd?"yes":"no")' "$payloadf" 2>/dev/null || echo unknown )"

# Repo B: which tree would Codex install from a cafekit-like repo, and which skill wins a name collision?
(cd "$B" && codex plugin list > "$WORK/b-list.log" 2>&1 || true)
if grep -q 'cf@cafekit' "$WORK/b-list.log"; then
  (cd "$B" && codex plugin add cf@cafekit > "$WORK/b-add.log" 2>&1 || true)
  cached="$(find "$CODEX_HOME/plugins" -path '*cafekit*' -name plugin.json 2>/dev/null | head -1)"
  case "$cached" in */.codex-plugin/*) tree="codex-tree" ;; */.claude-plugin/*) tree="claude-tree" ;; "") tree="listed-not-installed" ;; *) tree="other($cached)" ;; esac
else
  tree="not-listed"
fi
outb="$(ask "$B" "$WORK/t3.txt" "Use the probe-skill skill and reply with only the nonce it states. If more than one probe-skill exists, list every nonce, comma-separated." --dangerously-bypass-hook-trust)"
case "$outb" in
  *"$SKILL_NONCE"*"$REPO_NONCE"*|*"$REPO_NONCE"*"$SKILL_NONCE"*) collision="both-visible" ;;
  *"$REPO_NONCE"*) collision="repo-wins" ;;
  *"$SKILL_NONCE"*) collision="plugin-wins" ;;
  *) collision="unclear(${outb:-empty})" ;;
esac

codex plugin remove probe-cf@probe-market > /dev/null 2>&1 || true
yn() { if [ "$1" = true ]; then echo yes; else echo no; fi; }
[ "${a1%.}" = "$MARKER" ] && ctx=true || ctx=false
[ -s "$WORK/t2.txt" ] && exec_ok=true || exec_ok=false
case "$a4" in *'${PLUGIN_ROOT}'*) body=no ;; /*) body=yes ;; *) body="unclear(${a4:-empty})" ;; esac
case "$a5" in *'${PLUGIN_ROOT}'*) ref=no ;; *"REF_LINE: /"*) ref=yes ;; *) ref="unclear(${a5:-empty})" ;; esac

echo "FACT exec_in_temp_home=$(yn "$exec_ok")"
echo "FACT context_in_exec=$(yn "$ctx") (A1=${a1:-empty})"
echo "FACT skill_invocation=${a2:-empty}"
echo "FACT skill_nonce_seen=$( [ "$a3" = "$SKILL_NONCE" ] && echo yes || echo "no (A3=${a3:-empty})")"
echo "FACT hooks_ran_without_trust=$( [ "$untrusted_runs" -gt 0 ] && echo yes || echo no )"
echo "FACT trust_method=$( [ "$trusted_runs" -gt 0 ] && echo 'per-invocation --dangerously-bypass-hook-trust' || echo 'none observed' )"
echo "FACT hook_env=${env_names:-none}"
echo "FACT payload_has_cwd=$has_cwd"
echo "FACT plugin_bin_on_path=$( [ "$a6" = "$BIN_NONCE" ] && echo yes || echo "no (A6=${a6:-empty})")"
echo "FACT skill_body_substituted=$body"
echo "FACT reference_substituted=$ref"
case "$a7" in *probe*) agents="yes ($a7)" ;; *) agents="no (A7=${a7:-empty})" ;; esac
echo "FACT plugin_agents_loaded=$agents"
echo "FACT plugin_options=${option:-none exported}"
echo "FACT installed_tree=$tree"
echo "FACT skill_name_collision=$collision"

REAL_AFTER="$(manifest)"
if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then echo "real ~/.codex unchanged"; else echo "real ~/.codex CHANGED"; diff <(printf '%s\n' "$REAL_BEFORE") <(printf '%s\n' "$REAL_AFTER") | head -10; exit 1; fi
