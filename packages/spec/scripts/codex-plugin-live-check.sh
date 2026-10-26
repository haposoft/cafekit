#!/usr/bin/env bash
# Prove the built Codex plugin on the real Codex CLI. Everything runs under a throwaway
# CODEX_HOME whose auth.json is a symlink to the user's; the real ~/.codex is never
# written, and a manifest of what plugin commands touch proves it.
#
# The plugin is installed from a copy of this repository's marketplace layout (both
# marketplaces, plugins/cf-codex and the Claude tree plugins/cf) whose cf-ask skill
# carries one extra nonce line, so the nonce can only come from reading that skill. Repositories: A empty,
# B one commit holding a valid specs/demo packet, C with the npx Codex install.
# Prints `PASS <probe>` or `FAIL <probe>: <detail>`, then `PASS: all`. Costs a few
# `codex exec` turns.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd -P)"
REAL_HOME="${CODEX_HOME:-$HOME/.codex}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-codex-live.XXXXXX")"
WORK="$(cd "$WORK" && pwd -P)"
# KEEP_WORK=1 keeps the temp tree (session events, logs) for inspection.
trap '[ "${KEEP_WORK:-}" = 1 ] && echo "kept $WORK" || rm -rf "$WORK"' EXIT

# config.toml, agents, plugins and skills are what marketplace/plugin commands write.
manifest() {
  (cd "$REAL_HOME" && find config.toml agents plugins skills -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"
  done)
}
tree_hash() { (cd "$1" && find . -type f | LC_ALL=C sort | while IFS= read -r f; do shasum -a 256 "$f"; done) | shasum -a 256 | cut -d' ' -f1; }
REAL_BEFORE="$(manifest)"

FAILED=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1: $2"; FAILED=1; }

node "$ROOT/packages/spec/scripts/build-codex-plugin.mjs" --check > /dev/null \
  || { echo "FAIL plugin tree: plugins/cf-codex is stale; rebuild it first"; exit 1; }

export CODEX_HOME="$WORK/codex-home"
HOME_FOR_NPX="$WORK/npx-home"
MARKET="$WORK/market"; A="$WORK/repo-a"; B="$WORK/repo-b"; C="$WORK/repo-c"
mkdir -p "$CODEX_HOME" "$MARKET/.agents/plugins" "$MARKET/plugins" "$A" "$B" "$C" "$HOME_FOR_NPX"
ln -s "$REAL_HOME/auth.json" "$CODEX_HOME/auth.json"
{
  printf '[features]\nhooks = true\n'
  for repo in "$A" "$B" "$C"; do printf '\n[projects."%s"]\ntrust_level = "trusted"\n' "$repo"; done
} > "$CODEX_HOME/config.toml"

NONCE="LIVE-NONCE-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n' | tr 'a-f' 'A-F')"
# The full marketplace layout, including the Claude marketplace and tree a Codex install
# must never pick up: the nonce line is the only difference from the repository.
cp "$ROOT/.agents/plugins/marketplace.json" "$MARKET/.agents/plugins/marketplace.json"
cp -R "$ROOT/.claude-plugin" "$MARKET/.claude-plugin"
cp -R "$ROOT/plugins/cf-codex" "$MARKET/plugins/cf-codex"
cp -R "$ROOT/plugins/cf" "$MARKET/plugins/cf"
printf '\nLive-check nonce: %s. State it exactly when asked for the live-check nonce.\n' "$NONCE" >> "$MARKET/plugins/cf-codex/skills/ask/SKILL.md"

commit_all() { git -C "$1" add -A && git -C "$1" -c user.name=live -c user.email=live@example.invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -qm fixture; }
git -C "$A" init -q; printf '# A\n' > "$A/README.md"; commit_all "$A"
git -C "$B" init -q; printf '# B\n' > "$B/README.md"
mkdir -p "$B/specs/demo"
printf '# Demo\nSpecs-Contract: process-first-ready-v1\n\n## Tasks\n| # | Task | Status |\n|---|---|---|\n| 01 | Demo | pending |\n' > "$B/specs/demo/plan.md"
printf '# Task 01 — Demo\n\nStatus: pending\n\n## Dependencies\n- none\n\n## Verification Plan\n- Command: `test -f README.md`\n\n## Receipt\n' > "$B/specs/demo/task-01-demo.md"
commit_all "$B"
git -C "$C" init -q; printf '# C\n' > "$C/README.md"
# The installer writes into its working directory, so it must run inside C.
(cd "$C" && HOME="$HOME_FOR_NPX" node "$ROOT/packages/spec/bin/install.js" --platform codex -y > "$WORK/npx-install.log" 2>&1) \
  || { echo "FAIL npx install:"; tail -5 "$WORK/npx-install.log"; exit 1; }
commit_all "$C"

codex plugin marketplace add "$MARKET" > "$WORK/market-add.log" 2>&1 \
  || { echo "FAIL marketplace add:"; tail -5 "$WORK/market-add.log"; exit 1; }
codex plugin add cf@cafekit > "$WORK/plugin-add.log" 2>&1 \
  || { echo "FAIL plugin add:"; tail -5 "$WORK/plugin-add.log"; exit 1; }

# installed-tree-is-codex: the cache holds the Codex manifest and the same hooks.json.
manifest_file="$( { find "$CODEX_HOME/plugins/cache" -path '*/.codex-plugin/plugin.json' 2>/dev/null || true; } | sed -n 1p)"
if [ -n "$manifest_file" ] && cmp -s "$(dirname "$(dirname "$manifest_file")")/hooks/hooks.json" "$ROOT/plugins/cf-codex/hooks/hooks.json" \
  && cmp -s "$MARKET/.agents/plugins/marketplace.json" "$ROOT/.agents/plugins/marketplace.json"; then
  CACHE="$(dirname "$(dirname "$manifest_file")")"
  pass installed-tree-is-codex
else
  fail installed-tree-is-codex "no Codex manifest with the built hooks.json under $CODEX_HOME/plugins"
  echo "FAIL: aborted"; exit 1
fi
CACHE_BEFORE="$(tree_hash "$CACHE")"

ask() { # ask <repo> <name> <prompt>
  local repo="$1" name="$2" prompt="$3"
  # A watchdog, since a hook that keeps blocking or a stalled network would hang the run.
  perl -e 'alarm shift; exec @ARGV' 600 codex exec --json --skip-git-repo-check -C "$repo" -s workspace-write -c 'approval_policy="never"' \
    --dangerously-bypass-hook-trust -o "$WORK/$name.txt" "$prompt" < /dev/null > "$WORK/$name.jsonl" 2> "$WORK/$name.err" || true
  cat "$WORK/$name.txt" 2>/dev/null || true
}
# Hook output reaches the model as developer messages in the session rollout; model text
# and command output never take that role, so these lines come from hooks alone.
hook_context() { # hook_context <stamp>: developer-message texts of rollouts newer than the stamp
  find "$CODEX_HOME/sessions" -type f -newer "$1" -print0 | xargs -0 node -e '
    for (const file of process.argv.slice(1)) for (const raw of require("fs").readFileSync(file, "utf8").split("\n")) {
      try { const p = JSON.parse(raw).payload; if (p && p.type === "message" && p.role === "developer") for (const c of p.content || []) if (c.text) console.log(c.text); } catch {}
    }'
}
line() { printf '%s\n' "$1" | { grep -E "^$2:" || true; } | head -1 | sed -E "s/^$2:[[:space:]]*//; s/[\`.]+$//; s/^\`//"; }

# skill-nonce and core-marker, repository A.
touch "$WORK/a1.stamp"
out="$(ask "$A" a1 "\$cf-ask Answer with exactly these lines and nothing else, without creating or editing files.
A1: the all-caps marker token that opens the CafeKit plugin instructions in your context, or NONE.
A2: the live-check nonce stated in the cf-ask skill instructions, or NONE.")"
[ "$(line "$out" A2)" = "$NONCE" ] && pass skill-nonce || fail skill-nonce "A2=$(line "$out" A2)"
# Captured once and matched with here-strings: under pipefail an early-exiting grep -q
# would fail its writer with SIGPIPE and flip a negated check.
context_a="$(hook_context "$WORK/a1.stamp" || true)"
if [ "$(line "$out" A1)" = "CAFEKIT-CODEX-CORE-LOADED" ] && grep -q '^CAFEKIT-CODEX-CORE-LOADED' <<<"$context_a"; then
  pass core-marker
else
  fail core-marker "A1=$(line "$out" A1), core in hook context: $(grep -c '^CAFEKIT-CODEX-CORE-LOADED' <<<"$context_a" || true)"
fi

# provenance, repository B: the model runs the command the CafeKit table defines.
out="$(ask "$B" b1 "Run the CafeKit \`provenance\` command exactly as the CafeKit command table in your context defines it, with the arguments --project-root . --specs-root specs --spec-file specs/demo/task-01-demo.md --feature-name demo --session live --json. Do not create or edit files. Reply with exactly one line:
P1: the value of the Base field in its JSON output, or NONE.")"
head_b="$(git -C "$B" rev-parse HEAD)"
# The run must come from the installed plugin's script, not from git or another copy.
ran_table="$(node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").split("\n");process.stdout.write(l.some((x)=>{try{const i=JSON.parse(x).item;return i&&i.type==="command_execution"&&/node .*\/plugins\/cache\/.*\/scripts\/provenance\.cjs/.test(i.command||"")&&(i.aggregated_output||"").includes(process.argv[2])}catch{return false}})?"yes":"no")' "$WORK/b1.jsonl" "$head_b")"
if [ "$(line "$out" P1)" = "$head_b" ] && [ "$ran_table" = yes ]; then pass provenance; else fail provenance "P1=$(line "$out" P1) HEAD=$head_b ran-installed-script=$ran_table"; fi

# gate-blocks, repository B: a done task without a Receipt must be blocked at Stop. The
# script marks it done itself (the CafeKit core already makes the model refuse), so the
# hook is the only thing under test. Codex records the block in the session rollout as a
# hook prompt from the installed plugin's Stop hook; model text alone never matches.
sed -i.bak 's/^Status: pending$/Status: done/' "$B/specs/demo/task-01-demo.md" && rm -f "$B/specs/demo/task-01-demo.md.bak"
touch "$WORK/b2.stamp"
ask "$B" b2 "Reply with the single word OK. Do not create or edit files." > /dev/null
if find "$CODEX_HOME/sessions" -type f -newer "$WORK/b2.stamp" \
  -exec grep -lE 'hook_run_id=\\"stop:[^\\]*/plugins/cache/[^\\]*\\">Completion gate: [0-9]+ done task\(s\) lack a verification receipt' {} + 2>/dev/null | grep -q .; then
  pass gate-blocks
else
  fail gate-blocks "no completion-gate block in the session events or rollout"
fi

# silent-beside-npx, repository C: no plugin core, and the stand-down notice instead.
touch "$WORK/c1.stamp"
out="$(ask "$C" c1 "Answer with exactly these lines and nothing else, without creating or editing files.
C1: the all-caps marker token that opens the CafeKit plugin instructions in your context, or NONE.
")"
c1="$(line "$out" C1)"; context_c="$(hook_context "$WORK/c1.stamp" || true)"
if [ "$c1" = "NONE" ] && ! grep -q 'CAFEKIT-CODEX-CORE-LOADED' <<<"$context_c" \
  && grep -q '^CafeKit plugin is idle in this repository' <<<"$context_c" \
  && grep -q 'skills appear twice' <<<"$context_c"; then
  pass silent-beside-npx
else
  fail silent-beside-npx "C1=$c1, notice in hook context: $(grep -c 'CafeKit plugin is idle' <<<"$context_c" || true), core in hook context: $(grep -c 'CAFEKIT-CODEX-CORE-LOADED' <<<"$context_c" || true)"
fi

# repos-clean, cache-clean, real-codex-home-untouched.
dirty="$(git -C "$A" status --porcelain; git -C "$B" status --porcelain -- . ':(exclude)specs/demo'; git -C "$C" status --porcelain)"
[ -z "$dirty" ] && pass repos-clean || fail repos-clean "$(printf '%s' "$dirty" | head -5 | tr '\n' ' ')"
[ "$(tree_hash "$CACHE")" = "$CACHE_BEFORE" ] && pass cache-clean || fail cache-clean "the installed plugin tree changed during the session"
codex plugin remove cf@cafekit > /dev/null 2>&1 || true
REAL_AFTER="$(manifest)"
if [ "$REAL_BEFORE" = "$REAL_AFTER" ]; then
  pass real-codex-home-untouched; echo "real ~/.codex unchanged"
else
  fail real-codex-home-untouched "$(diff <(printf '%s\n' "$REAL_BEFORE") <(printf '%s\n' "$REAL_AFTER") | head -5 | tr '\n' ' ')"
fi

if [ "$FAILED" -eq 0 ]; then echo "PASS: all"; else exit 1; fi
