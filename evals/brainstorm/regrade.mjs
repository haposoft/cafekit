#!/usr/bin/env node
// Chấm lại các ô đã chạy bằng thước hiện tại của evals/brainstorm, $0, không gọi model (gói brainstorm-repair task 01).
// Mỗi thước regex last_message được chấm lại trên câu trả lời đã lưu (_answers/<ô>.txt: câu trả lời đã lưu bằng đúng
// last_message đã chấm, baseline agree=yes 80/80); thước tool_used và files giữ điểm đã lưu vì chúng không đổi. Đường
// agent còn chấm các thước regex trên báo cáo brainstormer đã lưu (_reports/<ô>.txt). Từ bản nén của ô (_kept/<ô>.tar.gz)
// đếm lượt có lời gọi brainstormer mang route và cách skill được nạp. In mỗi ô và mỗi thước:
//   <ô> <thước> stored=<x>/<n> regraded=<y>/<n> changed=<±run…|none>     (n = số lượt sạch)
//   <ô> reports=<k>/<n>   và   <ô> r.<thước> <x>/<k>                  (đường agent; chỉ lượt có báo cáo)
//   <ô> agent-route=<x>/<n>   (đường agent)   hoặc   <ô> skill-loaded=history:a,call:b,none:c   (đường skill)
// rồi ghi evals/results/brainstorm/_regraded/<ô>.json tất định (khoá xếp thứ tự, không giờ, không đường dẫn tạm) kèm
// sha256 của mọi file thước đã dùng. Thoát 1 khi số header câu trả lời khác số lượt, thiếu file thước hay thiếu bản nén.
//   node evals/brainstorm/regrade.mjs <result dir>...
//   node evals/brainstorm/regrade.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { withoutRelay } from "./read-traces.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const BRAINSTORMER = /(^|:)brainstormer$/;
const ROUTE = /delivery|exploration|authorized fix|tính năng|khám phá|sửa lỗi/i;
const SKILL_CALL = /"skill":"cafekit-brainstorm:brainstorm"/;
const HEADER = /^### run ([0-9]+)( errored)?$/;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const body = (t) => t.replace(/^---[\s\S]*?---\s*/, "").trim();
const front = (t) => Object.fromEntries((t.match(/^---\n([\s\S]*?)\n---/) || ["", ""])[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;

function sections(file) {
  const out = [];
  let cur = null;
  for (const l of fs.readFileSync(file, "utf8").replace(/\n$/, "").split("\n")) {
    const m = l.match(HEADER);
    if (m) { cur = { n: Number(m[1]), lines: [] }; out.push(cur); continue; }
    if (cur) cur.lines.push(l);
  }
  return out.map((x) => ({ n: x.n, text: x.lines.join("\n") }));
}
// A reports section holds `--- report <k> src=<src>` blocks; keep the texts of sync and notification reports.
function reportTexts(text) {
  const out = [];
  const parts = text.split(/^--- report \d+ src=(\S+)$/m);
  for (let i = 1; i < parts.length; i += 2) if (parts[i] === "sync" || parts[i] === "notification") out.push(withoutRelay(parts[i + 1].replace(/^\n/, "").replace(/\n$/, "")));
  return out;
}
const passesOn = (g, text) => { const hit = new RegExp(g.pattern).test(text); return g.match === "not_contains" ? !hit : hit; };

function graderSet(caseName, root) {
  const dir = path.join(root, caseName, "graders");
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const t = fs.readFileSync(path.join(dir, f), "utf8"), fm = front(t);
    return { name: f.slice(0, -3), type: fm.type, target: fm.target, match: fm.match || "contains", pattern: body(t), sha256: sha(t) };
  });
}

function traceEvents(archive, tmp, tracePath) {
  const rel = path.join(path.basename(path.dirname(path.dirname(tracePath))), "out", "trace.jsonl");
  const p = path.join(tmp, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

export function regrade(dir, opts = {}) {
  const root = opts.root || here;
  const lines = [];
  const r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const kase = r.cases[0], cell = path.basename(dir), results = path.dirname(dir);
  const graders = graderSet(kase.name, root);
  if (!graders) return { error: `${cell}: no graders for ${kase.name}` };
  // The stored grader set must equal the current files: a missing or renamed file would otherwise make every run look
  // unclean and print 0/0.
  const storedNames = kase.graders.map((g) => g.name).sort().join(), currentNames = graders.map((g) => g.name).join();
  if (storedNames !== currentNames) return { error: `${cell}: stored graders differ from evals/brainstorm/${kase.name}/graders` };
  const runs = kase.arms.with;
  const isClean = (x) => !x.error && !x.skippedPaidGraders && (x.graders || []).length === graders.length;
  const ansFile = path.join(results, "_answers", `${cell}.txt`);
  if (!fs.existsSync(ansFile)) return { error: `${cell}: missing ${ansFile}` };
  const answers = sections(ansFile);
  if (answers.length !== runs.length) return { error: `${cell}: ${answers.length} answer headers for ${runs.length} runs` };
  const agentPath = kase.name.endsWith("-agent");
  let reports = null;
  if (agentPath) {
    const repFile = path.join(results, "_reports", `${cell}.txt`);
    if (!fs.existsSync(repFile)) return { error: `${cell}: missing ${repFile}` };
    reports = sections(repFile);
    if (reports.length !== runs.length) return { error: `${cell}: ${reports.length} report headers for ${runs.length} runs` };
  }
  const clean = runs.map((x, i) => (isClean(x) ? i : -1)).filter((i) => i >= 0);
  if (!clean.length) return { error: `${cell}: no clean run` };
  const out = { cell, case: kase.name, model: (r.suite && r.suite.modelOverride) || null, runs: runs.length, clean: clean.map((i) => i + 1), graders: {} };
  for (const g of graders) {
    const stored = clean.map((i) => (runs[i].graders.find((y) => y.name === g.name) || {}).passed === true);
    const regraded = g.type === "regex" && g.target === "last_message" ? clean.map((i) => passesOn(g, answers[i].text)) : stored;
    out.graders[g.name] = { sha256: g.sha256, type: g.type, stored, regraded };
    if (g.name.startsWith("dem-")) continue;
    const changed = clean.map((i, k) => (stored[k] === regraded[k] ? null : `${regraded[k] ? "+" : "-"}run${i + 1}`)).filter(Boolean);
    lines.push(`${cell} ${g.name} stored=${stored.filter(Boolean).length}/${clean.length} regraded=${regraded.filter(Boolean).length}/${clean.length} changed=${changed.length ? changed.join(",") : "none"}`);
  }
  if (agentPath) {
    const withRep = clean.filter((i) => reportTexts(reports[i].text).length > 0);
    out.reports = { runs: withRep.map((i) => i + 1), graders: {} };
    lines.push(`${cell} reports=${withRep.length}/${clean.length}`);
    // Length is a property of the final answer, not of the report it relays, so do-dai-gon is not graded on reports.
    for (const g of graders.filter((x) => x.type === "regex" && x.target === "last_message" && x.name !== "do-dai-gon")) {
      const v = withRep.map((i) => reportTexts(reports[i].text).some((t) => passesOn(g, t)));
      out.reports.graders[g.name] = v;
      lines.push(`${cell} r.${g.name} ${v.filter(Boolean).length}/${withRep.length}`);
    }
  }
  const archive = path.join(results, "_kept", `${cell}.tar.gz`);
  if (!fs.existsSync(archive)) return { error: `${cell}: missing ${archive}` };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brainstorm-regrade-"));
  try {
    const x = spawnSync("tar", ["-xzf", archive, "-C", tmp], { encoding: "utf8" });
    if (x.status !== 0) return { error: `${cell}: tar failed: ${x.stderr.slice(0, 200)}` };
    spawnSync("chmod", ["-R", "u+rwX", tmp]);
    const per = clean.map((i) => traceEvents(archive, tmp, runs[i].tracePath));
    if (per.some((e) => e === null)) return { error: `${cell}: a clean run's trace is missing from ${archive}` };
    const uses = per.map((ev) => ev.flatMap((e) => (e.type === "assistant" && Array.isArray(e.message?.content) ? e.message.content.filter((b) => b.type === "tool_use") : [])));
    if (agentPath) {
      out.agentRoute = uses.map((u) => u.some((b) => b.name === "Agent" && BRAINSTORMER.test(b.input?.subagent_type || "") && ROUTE.test(String(b.input?.prompt || ""))));
      lines.push(`${cell} agent-route=${out.agentRoute.filter(Boolean).length}/${clean.length}`);
    } else {
      const yaml = fs.readFileSync(path.join(root, kase.name, "case.yaml"), "utf8");
      const history = /history_file:/.test(yaml);
      out.skillLoaded = uses.map((u) => (history ? "history" : u.some((b) => b.name === "Skill" && SKILL_CALL.test(JSON.stringify(b.input))) ? "call" : "none"));
      const c = { history: 0, call: 0, none: 0 }; for (const s of out.skillLoaded) c[s]++;
      lines.push(`${cell} skill-loaded=history:${c.history},call:${c.call},none:${c.none}`);
    }
  } finally {
    spawnSync("chmod", ["-R", "u+rwX", tmp]);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const dest = path.join(results, "_regraded");
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, `${cell}.json`), JSON.stringify(sorted(out), null, 1) + "\n");
  return { lines };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brainstorm-regrade-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: regrade self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  try {
    const cases = path.join(root, "cases", "syn-agent", "graders");
    fs.mkdirSync(cases, { recursive: true });
    fs.writeFileSync(path.join(cases, "mot-duong.md"), "---\ntype: regex\ntarget: last_message\n---\n\nmột đường\n");
    fs.writeFileSync(path.join(cases, "khong-bu-nhin.md"), "---\ntype: regex\ntarget: last_message\nmatch: not_contains\n---\n\nphương án B\n");
    fs.writeFileSync(path.join(cases, "co-goi-agent.md"), "---\ntype: tool_used\ntool: Agent\nmin: 1\n---\n");
    const res = path.join(root, "results"), cell = "base-syn-agent-opus", k = path.join(res, "e-1"), k2 = path.join(res, "e-2");
    for (const kk of [k, k2]) fs.mkdirSync(path.join(kk, "out"), { recursive: true });
    const ev = (route) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "Agent", input: { subagent_type: "cafekit-brainstorm:brainstormer", prompt: route ? "feature delivery" : "x" } }] } }) + "\n";
    fs.writeFileSync(path.join(k, "out", "trace.jsonl"), ev(true)); fs.writeFileSync(path.join(k2, "out", "trace.jsonl"), ev(false));
    fs.mkdirSync(path.join(res, "_kept"), { recursive: true });
    spawnSync("tar", ["-czf", path.join(res, "_kept", `${cell}.tar.gz`), "-C", res, "e-1", "e-2"]);
    fs.mkdirSync(path.join(res, cell), { recursive: true });
    const gv = (a, b, c) => [{ name: "mot-duong", passed: a }, { name: "khong-bu-nhin", passed: b }, { name: "co-goi-agent", passed: c, explanation: "Agent called 1x" }];
    fs.writeFileSync(path.join(res, cell, "result.json"), JSON.stringify({ suite: { modelOverride: "opus" }, cases: [{ name: "syn-agent", graders: [{ name: "co-goi-agent" }, { name: "khong-bu-nhin" }, { name: "mot-duong" }], arms: { with: [{ tracePath: path.join(k, "out", "trace.jsonl"), graders: gv(false, true, true) }, { tracePath: path.join(k2, "out", "trace.jsonl"), graders: gv(false, true, true) }] } }] }));
    fs.mkdirSync(path.join(res, "_answers"), { recursive: true }); fs.mkdirSync(path.join(res, "_reports"), { recursive: true });
    fs.writeFileSync(path.join(res, "_answers", `${cell}.txt`), "### run 1\nchỉ một đường\n### run 2\nphương án B cũng được\n");
    fs.writeFileSync(path.join(res, "_reports", `${cell}.txt`), "### run 1\n--- report 1 src=sync\nmột đường\n### run 2\n(no report)\n");
    const a = regrade(path.join(res, cell), { root: path.join(root, "cases") });
    const L = (a.lines || []).join("\n");
    check("a regex grader flips on the saved answer and the flip is named", L.includes(`${cell} mot-duong stored=0/2 regraded=1/2 changed=+run1`), L);
    check("a not_contains grader flips the other way", L.includes(`${cell} khong-bu-nhin stored=2/2 regraded=1/2 changed=-run2`), L);
    check("a tool_used grader keeps its stored verdicts and prints no change", L.includes(`${cell} co-goi-agent stored=2/2 regraded=2/2 changed=none`), L);
    check("report-side counts run over runs with a report", L.includes(`${cell} reports=1/2`) && L.includes(`${cell} r.mot-duong 1/1`), L);
    check("a report's Relay: line is dropped before grading", withoutRelay("một đường\nRelay: keep the single-path line and every English label when you summarize this report.") === "một đường\n" && withoutRelay("**Relay:** keep it") === "");
    check("agent-route counts routed brainstormer calls from the archive", L.includes(`${cell} agent-route=1/2`), L);
    const j1 = fs.readFileSync(path.join(res, "_regraded", `${cell}.json`));
    regrade(path.join(res, cell), { root: path.join(root, "cases") });
    check("a second run writes the same bytes", j1.equals(fs.readFileSync(path.join(res, "_regraded", `${cell}.json`))));
    fs.renameSync(path.join(cases, "khong-bu-nhin.md"), path.join(cases, "khong-bu-nhin-x.md"));
    check("a grader file missing or renamed is an error, not 0/0", !!regrade(path.join(res, cell), { root: path.join(root, "cases") }).error);
    fs.renameSync(path.join(cases, "khong-bu-nhin-x.md"), path.join(cases, "khong-bu-nhin.md"));
    fs.writeFileSync(path.join(res, "_answers", `${cell}.txt`), "### run 1\nx\n");
    check("an answers file with fewer headers than runs is an error", !!regrade(path.join(res, cell), { root: path.join(root, "cases") }).error);
  } finally { spawnSync("chmod", ["-R", "u+rwX", root]); fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  if (!args.length) { console.error("usage: node evals/brainstorm/regrade.mjs <result dir>... | --self-test"); process.exit(2); }
  let bad = 0;
  for (const d of args) { const x = regrade(d); if (x.error) { console.log(`error ${x.error}`); bad++; } else for (const l of x.lines) console.log(l); }
  process.exit(bad ? 1 : 0);
}
