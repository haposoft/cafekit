#!/usr/bin/env bash
# Paid probe: does an eval run load an agent that `evals/run.sh --with-agent` copied into the plugin,
# and under what agent type? It reads the run's init event and prints what it lists.
#   exit 0 — exactly one agent type ending in code-auditor was listed
#   exit 3 — none, while the init event does not list the Agent tool (the probe was noise)
#   exit 1 — anything else: a partial or errored run, no trace, no init event, none while Agent is listed
# The primary probe reuses an existing cheap case; only when it is noise does a fallback stage a case
# that grants Agent. Each probe runs at most once: an existing result directory is read, not re-run.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
export DISABLE_AUTOUPDATER=1

read_probe() { # read_probe <result.json>
  node - "$1" <<'JS'
const fs = require("fs");
let r;
try { r = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); } catch (e) { console.log("result unreadable: " + process.argv[2]); process.exit(1); }
const w = (r.cases && r.cases[0] && r.cases[0].arms && r.cases[0].arms.with) || [];
const x = w[0] || {};
console.log(["claude=" + r.claudeVersion, "partial=" + r.partial, "runs=" + w.length, "error=" + JSON.stringify(x.error === undefined ? null : x.error)].join(" "));
if (r.partial || w.length !== 1 || x.error) process.exit(1);
if (!x.tracePath || !fs.existsSync(x.tracePath)) { console.log("trace missing: " + x.tracePath); process.exit(1); }
let init = null;
for (const line of fs.readFileSync(x.tracePath, "utf8").split("\n")) {
  if (!line) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  if (o.type === "system" && o.subtype === "init") { init = o; break; }
}
if (!init) { console.log("no init event"); process.exit(1); }
// The init event lists the subagent tool under its older name `Task` as well as `Agent`.
const tools = init.tools || [];
const hasAgent = tools.includes("Agent") || tools.includes("Task");
const agents = init.agents || [];
const observed = agents.filter((a) => /(^|:)code-auditor$/.test(a));
console.log("init-tools-agent=" + (hasAgent ? "yes" : "no"));
console.log("init-agents: " + agents.join(" "));
console.log("observed-agent: " + (observed.length ? observed.join(" ") : "none"));
process.exit(observed.length === 1 ? 0 : observed.length === 0 && !hasAgent ? 3 : 1);
JS
}

primary="$root/evals/results/specs/probe-with-agent"
if [ ! -e "$primary" ]; then
  "$root/evals/run.sh" specs --with-agent code-auditor --out probe-with-agent --model sonnet --judge-model sonnet \
    --runs 1 --threshold 0 --ablation none --max-cost-usd 1 --case khong-kich-hoat --keep-temp
  echo "primary run exit=$?"
fi
read_probe "$primary/result.json"; rc=$?
case "$rc" in
  0) echo "probe: primary"; exit 0 ;;
  3) echo "primary probe is noise (Agent not listed); running the fallback" ;;
  *) exit 1 ;;
esac

fallback="$root/evals/results/specs/probe-with-agent-fallback"
if [ ! -e "$fallback" ]; then
  stage="$(mktemp -d)"; trap 'rm -rf "$stage"' EXIT
  mkdir -p "$stage/evals" "$stage/packages/spec/src/claude/skills" "$stage/packages/spec/src/claude/agents" \
    "$stage/evals/code-review/probe-agent/graders"
  cp "$root/evals/run.sh" "$stage/evals/run.sh"; chmod +x "$stage/evals/run.sh"
  cp "$root/packages/spec/package.json" "$stage/packages/spec/package.json"
  rsync -a "$root/packages/spec/src/claude/skills/code-review/" "$stage/packages/spec/src/claude/skills/code-review/"
  cp "$root/packages/spec/src/claude/agents/code-auditor.md" "$stage/packages/spec/src/claude/agents/code-auditor.md"
  cat > "$stage/evals/code-review/probe-agent/case.yaml" <<'YAML'
schema_version: "1.1"
name: probe-agent
runs: 1
execution:
  prompt: "Không dùng công cụ nào. Trả lời đúng một dòng: ok"
  max_turns: 2
  timeout_seconds: 120
  allowed_tools: [Read, Agent]
YAML
  cat > "$stage/evals/code-review/probe-agent/graders/dem-agent.md" <<'MD'
---
type: tool_used
tool: Agent
min: 0
---
MD
  "$stage/evals/run.sh" code-review --with-agent code-auditor --out probe-with-agent --model sonnet --judge-model sonnet \
    --runs 1 --threshold 0 --ablation none --max-cost-usd 1 --allow-tools Agent --case probe-agent --keep-temp
  echo "fallback run exit=$?"
  mkdir -p "$fallback"
  cp "$stage/evals/results/code-review/probe-with-agent/result.json" "$fallback/result.json" || { echo "fallback wrote no result.json"; exit 1; }
fi
read_probe "$fallback/result.json"; rc=$?
[ "$rc" = 0 ] && { echo "probe: fallback"; exit 0; }
exit 1
