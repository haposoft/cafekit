#!/usr/bin/env bash
# Paid probe (plan D-05 of specs/code-review-repair): in a temporary git project that holds CafeKit's skill at
# .claude/skills/code-review/, what do the slash command `/code-review` and a Skill call named `code-review` load?
# Each run's own session transcript tells: `cafekit` (a saved line holds the skill body's first `# ` line),
# `other:<path>` (a `Base directory for this skill:` line without it), `none`, or `not-emitted` (no transcript).
# The two runs happen once: when the result directory already holds both streams and transcripts.txt, it is read.
#   exit 1 — a stream without a result event, `error_during_execution`, or `is_error` under any subtype but
#            `error_max_turns` (the one-turn slash run may end there by design); 0 otherwise.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/evals/results/code-review/probe-skill-name"
src="$root/packages/spec/src/claude/skills/code-review"

if [ ! -f "$out/slash.jsonl" ] || [ ! -f "$out/skill.jsonl" ] || [ ! -f "$out/transcripts.txt" ]; then
  node "$root/evals/code-review/budget.mjs" check 1 || { echo "budget check refused the probe"; exit 1; }
  mkdir -p "$out"
  tmp="${TMPDIR:-/tmp}"
  proj="$(mktemp -d "${tmp%/}/cr-skill-name-XXXXXX")" || exit 1
  proj="$(cd "$proj" && pwd -P)"
  if ! { git -C "$proj" init -q && printf 'probe\n' > "$proj/README.md" && git -C "$proj" add README.md \
      && git -C "$proj" -c user.name=probe -c user.email=probe@example.invalid commit -qm init; }; then
    echo "temporary project setup failed"; rm -rf "$proj"; exit 1
  fi
  mkdir -p "$proj/.claude/skills" && cp -R "$src" "$proj/.claude/skills/code-review"
  sha=$(shasum -a 256 "$proj/.claude/skills/code-review/SKILL.md" | cut -d' ' -f1)
  marker=$(awk '/^---$/ { fences++; next } fences >= 2 && /^# / { print; exit }' "$proj/.claude/skills/code-review/SKILL.md")
  version=$(claude --version | cut -d' ' -f1)
  # Only the basic user variables reach the runs: no ORCA_*, CLAUDE* or other inherited session state.
  run_env=(env -i HOME="$HOME" PATH="$PATH" TMPDIR="$tmp" USER="${USER:-}" LOGNAME="${LOGNAME:-}" LANG="${LANG:-en_US.UTF-8}" SHELL="${SHELL:-/bin/bash}" DISABLE_AUTOUPDATER=1)
  (cd "$proj" && "${run_env[@]}" claude -p "/code-review" --output-format stream-json --verbose --model sonnet \
    --max-turns 1 --max-budget-usd 0.5 --permission-mode dontAsk) > "$out/slash.jsonl" 2> "$out/slash.err"
  (cd "$proj" && "${run_env[@]}" claude -p 'Call the Skill tool once with skill set to "code-review", then answer with the single word done.' \
    --output-format stream-json --verbose --model sonnet --max-turns 3 --max-budget-usd 0.5 --permission-mode dontAsk \
    --allowedTools Skill) > "$out/skill.jsonl" 2> "$out/skill.err"
  rm -rf "$proj"

  # Save each run's transcript lines that show a loaded skill (text only), then delete exactly those transcripts.
  node - "$out" "$HOME/.claude/projects" "$version" "$sha" "$marker" <<'JS' || exit 1
const fs = require("fs");
const path = require("path");
const [out, projects, version, sha, marker] = process.argv.slice(2);
const lines = [`# claude=${version}`, `# skill-sha256=${sha}`, `# marker=${marker}`];
const strings = (v) => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
for (const run of ["slash", "skill"]) {
  let sid = null;
  for (const l of fs.readFileSync(path.join(out, `${run}.jsonl`), "utf8").split("\n")) {
    try { const o = JSON.parse(l); if (o.type === "system" && o.subtype === "init") { sid = o.session_id; break; } } catch {}
  }
  const found = sid && fs.existsSync(projects) ? fs.readdirSync(projects).map((d) => path.join(projects, d, `${sid}.jsonl`)).filter((f) => fs.existsSync(f)) : [];
  lines.push(`${run}: session=${sid || "none"} transcripts=${found.length}`);
  for (const f of found) {
    for (const l of fs.readFileSync(f, "utf8").split("\n")) {
      let o; try { o = JSON.parse(l); } catch { continue; }
      for (const s of strings(o)) for (const t of s.split("\n")) {
        if (t.includes("Base directory for this skill:") || (marker && t.includes(marker))) lines.push(`${run}: ${t}`);
      }
    }
  }
  for (const f of found) {
    fs.unlinkSync(f);
    try { fs.rmdirSync(path.dirname(f)); } catch {} // only when left empty
  }
}
fs.writeFileSync(path.join(out, "transcripts.txt"), lines.join("\n") + "\n");
JS
fi

node - "$out" <<'JS'
const fs = require("fs");
const path = require("path");
const out = process.argv[2];
const saved = fs.readFileSync(path.join(out, "transcripts.txt"), "utf8").split("\n");
const header = (k) => (saved.find((l) => l.startsWith(`# ${k}=`)) || "").slice(k.length + 3);
const marker = header("marker");
console.log(`claude=${header("claude")}`);
console.log(`skill-sha256=${header("skill-sha256")}`);
let bad = 0, cost = 0;
const results = [];
for (const run of ["slash", "skill"]) {
  const events = fs.readFileSync(path.join(out, `${run}.jsonl`), "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const init = events.find((e) => e.type === "system" && e.subtype === "init") || {};
  const entries = [...(init.skills || []), ...(init.slash_commands || [])].filter((s) => s === "code-review" || s.endsWith("code-review"));
  console.log(`${run}: init-code-review-entries=${entries.length ? entries.join(",") : "none"}`);
  const status = saved.find((l) => l.startsWith(`${run}: session=`)) || "";
  const own = saved.filter((l) => l.startsWith(`${run}: `) && l !== status).map((l) => l.slice(run.length + 2));
  let loads;
  if (!/transcripts=[1-9]/.test(status)) loads = "not-emitted";
  else if (marker && own.some((l) => l.includes(marker))) loads = "cafekit";
  else {
    const other = own.filter((l) => l.includes("Base directory for this skill:")).map((l) => l.split("Base directory for this skill:")[1].trim());
    loads = other.length ? other.map((p) => `other:${p}`).join(",") : "none";
  }
  if (run === "skill") {
    const calls = events.filter((e) => e.type === "assistant" && Array.isArray(e.message?.content)).flatMap((e) => e.message.content.filter((c) => c.type === "tool_use" && c.name === "Skill").map((c) => c.input?.skill));
    console.log(`skill-call=${calls.length ? calls.join(",") : "none"}`);
  }
  console.log(`${run === "slash" ? "slash-loads" : "skill-tool-loads"}=${loads}`);
  const result = events.find((e) => e.type === "result");
  if (!result) { results.push(`${run}: result=missing`); bad++; continue; }
  results.push(`${run}: result=${result.subtype} is_error=${result.is_error === true}`);
  cost += result.total_cost_usd || 0;
  if (result.subtype === "error_during_execution" || (result.is_error === true && result.subtype !== "error_max_turns")) bad++;
}
for (const r of results) console.log(r);
console.log(`cost-usd=${cost}`);
process.exit(bad ? 1 : 0);
JS
