#!/usr/bin/env node
// Phép kiểm tin cậy cho việc chấm offline: chấm lại từ TRACE đã giữ mọi grader của harness (tool_used, regex last_message) của bốn ô gốc, rồi so với
// verdict harness đã lưu trong result.json. Nếu đọc lệnh từ trace (evals/git/verify-run.mjs `commandsOf`) và dạng JSON của đầu vào công cụ đúng như harness
// thấy thì mọi grader KHÔNG đổi phải khớp 100%. Ba grader đã chuyển sang V (quet-truoc, dung-prune, khong-dung-vi-tokens) được chấm bằng đúng file grader cũ
// lấy từ git (`git show HEAD:…`): chúng cũng phải khớp bản lưu (đó là cùng một regex), và độ lệch với V mới là các lượt đã đính chính.
//   node evals/reproduce-harness-git.mjs [--root <dir>]       thoát 1 nếu một grader không đổi lệch dù chỉ một lượt
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { readTrace } from "./git/verify-run.mjs";
import { CASES, V_AUTHORITY } from "./compare-git.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const ri = args.indexOf("--root");
const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(here, "results", "git");

function front(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^'((?:[^']|'')*)'$/, (_, x) => x.replace(/''/g, "'"));
  }
  return { meta, body: m[2].trim() };
}
// File grader: bản hiện có, hoặc (với ba grader đã chuyển sang V) bản đã commit.
function graderText(kase, name) {
  const rel = `evals/git/${kase}/graders/${name}.md`;
  const file = path.join(path.dirname(here), rel);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const repo = path.dirname(here);
  const r = spawnSync("git", ["-C", repo, "show", `HEAD:${rel}`], { encoding: "utf8" });
  if (r.status === 0) return r.stdout;
  // đã bị xoá ở một commit sau: lấy bản ngay trước commit xoá
  const del = spawnSync("git", ["-C", repo, "log", "--diff-filter=D", "-1", "--format=%H", "--", rel], { encoding: "utf8" }).stdout.trim();
  if (!del) return null;
  const old = spawnSync("git", ["-C", repo, "show", `${del}^:${rel}`], { encoding: "utf8" });
  return old.status === 0 ? old.stdout : null;
}
const toolInputs = (events, tool) => events.flatMap((e) => (e.type === "assistant" && Array.isArray(e.message && e.message.content) ? e.message.content : [])
  .filter((c) => c.type === "tool_use" && c.name === tool).map((c) => JSON.stringify(c.input)));
const lastMessage = (events) => {
  const texts = events.flatMap((e) => (e.type === "assistant" && Array.isArray(e.message && e.message.content) ? e.message.content : []).filter((c) => c.type === "text").map((c) => c.text || ""));
  return texts.length ? texts[texts.length - 1] : "";
};
function evaluate(g, events) {
  if (g.meta.type === "tool_used") {
    const re = new RegExp(g.meta.input_match);
    const n = toolInputs(events, g.meta.tool).filter((x) => re.test(x)).length;
    const min = g.meta.min === undefined ? 1 : Number(g.meta.min), max = g.meta.max === undefined ? Infinity : Number(g.meta.max);
    return n >= min && n <= max;
  }
  if (g.meta.type === "regex" && g.meta.target === "last_message") return new RegExp(g.body).test(lastMessage(events));
  return null;
}

let unchangedTotal = 0, unchangedAgree = 0, movedTotal = 0, movedAgree = 0;
const bad = [];
for (const kase of CASES) {
  const cell = `base-${kase}-opus`;
  const dir = path.join(root, cell);
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const runs = result.cases[0].arms.with;
  const vrows = new Map();
  for (const line of fs.readFileSync(path.join(dir, "verify-run.txt"), "utf8").split("\n")) {
    const m = line.match(/ run=(\d+) grader=(\S+) verdict=(yes|no|error)$/);
    if (m) vrows.set(`${m[1]}:${m[2]}`, m[3]);
  }
  const names = [...new Set(runs.flatMap((r) => r.graders.map((g) => g.name)))].sort();
  for (const name of names) {
    const text = graderText(kase, name);
    if (text === null) { bad.push(`${cell} ${name}: no grader file`); continue; }
    const g = { ...front(text) };
    let agree = 0, total = 0;
    const off = [], flipped = [];
    runs.forEach((run, i) => {
      const copyDir = path.join(root, "kept", cell, `run-${String(i + 1).padStart(2, "0")}`);
      const tracePath = fs.existsSync(run.tracePath) ? run.tracePath : path.join(copyDir, "out", "trace.jsonl");
      const mine = evaluate(g, readTrace(tracePath));
      const stored = run.graders.find((x) => x.name === name).passed;
      if (mine === null) return;
      total++;
      if (mine === stored) agree++; else off.push(i + 1);
      if (V_AUTHORITY.includes(name)) { const v = vrows.get(`${i + 1}:${name}`); if (v && (v === "yes") !== stored) flipped.push(i + 1); }
    });
    const moved = V_AUTHORITY.includes(name);
    console.log(`cell=${cell} grader=${name} ${moved ? "moved-to-V " : ""}replay-vs-stored=${agree}/${total}${off.length ? ` differs-at-runs=${off.join(",")}` : ""}${moved ? ` new-V-differs-from-stored-at-runs=${flipped.join(",") || "none"}` : ""}`);
    if (moved) { movedTotal += total; movedAgree += agree; } else { unchangedTotal += total; unchangedAgree += agree; }
    if (agree !== total) bad.push(`${cell} ${name}: replay differs at runs ${off.join(",")}`);
  }
}
console.log(`summary: harness graders replayed from the kept traces = ${unchangedAgree + movedAgree}/${unchangedTotal + movedTotal} verdicts equal to the stored ones (${unchangedAgree}/${unchangedTotal} unchanged graders, ${movedAgree}/${movedTotal} graders that moved to V, replayed with their old file)`);
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
