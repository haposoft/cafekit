#!/usr/bin/env node
// Đọc lại mỗi lượt chạy đã giữ (--keep-temp) của evals/brainstorm, $0, không chạy lệnh nào trong thư mục giữ lại (chỉ
// chmod -R u+rwX như bộ đọc research). Mỗi lượt in init= (skill cafekit-brainstorm:brainstorm ở đường skill, agent
// brainstormer ở đường agent, và mọi công cụ trong allowed_tools của ca trừ AskUserQuestion mà eval không cấp; thiếu là
// init không đủ; công cụ Agent hiện trong init với tên Task), askuser-offered=,
// tools=, askuser= (kèm dòng askuser-call: số câu hỏi và kết quả 80 ký tự), chat-questions=, skill-calls=,
// skill-loaded= (history|call|none ở đường skill, n/a ở đường agent), agent-calls=, report-src= và report= (đường
// agent), mutations=, chars= và agree= (thước regex last_message, files và tool_used chấm lại so với điểm đã lưu), rồi
// một dòng decisive cho mỗi thước không phải bộ đếm bị trượt. Lượt có error hay không sạch thì in phần hành vi, không
// kiểm agree. Mỗi thư mục in một dòng tổng: runs=, errored=, askuser-errored= (lượt lỗi có gọi AskUserQuestion, tính cả
// -lan1 của thư mục), counts= (số lượt sạch đạt của mỗi thước không phải bộ đếm, * là nhóm chính), chi phí có và không
// có judge, và tổng report-src hay skill-loaded. Thoát 1 khi một lượt sạch có init không đủ, điểm lưu trái với trace,
// thiếu trace hay thiếu phòng thử; với --require-brainstormer, thêm khi đã đưa thư mục đường agent mà không lượt nào
// có báo cáo brainstormer sync hay notification.
//   node evals/brainstorm/read-traces.mjs [--require-brainstormer] <result dir>...
//   node evals/brainstorm/read-traces.mjs --probe <dir>        init= và history-skill=seen|not-seen; thoát 1 khi
//                                                              init không đủ hay not-seen (seen: trich-hard-gate đạt
//                                                              và trace không gọi công cụ nào)
//   node evals/brainstorm/read-traces.mjs --kept <dir>         tên thư mục giữ lại của mỗi lượt, mỗi dòng một tên;
//                                                              thoát 1 khi không có, thiếu, hay không nằm ngay dưới
//                                                              /private/tmp (KEPT_ROOT đổi gốc, chỉ cho self-test)
//   node evals/brainstorm/read-traces.mjs --integrity [--runs <n>] <dir>...
//   node evals/brainstorm/read-traces.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
export const PRIMARY = {
  // noi-route and noi-do-sau became primary on the skill path at brainstorm-repair GATE-SCOPE (route and depth line).
  "duyet-khong-trien-khai": ["khong-bash-ghi", "khong-goi-quy-trinh", "khong-agent-thuc-thi", "bao-goi-specs", "co-hop-dong", "noi-route", "noi-do-sau"],
  "can-plan-sang-specs": ["co-goi-skill", "bao-goi-specs", "khong-goi-specs-ngam", "khong-phuong-an", "ngan-gon", "noi-route", "noi-do-sau"],
  "ne-cau-hoi": ["khong-hoi-ky-thuat", "co-khuyen-nghi", "dua-muc-tieu", "ghi-gia-dinh", "noi-route", "noi-do-sau"],
  "mot-duong-agent": ["co-goi-agent", "mot-duong", "khong-bu-nhin", "nhan-kha-thi", "khong-tu-duyet"],
  "tham-do-nap-skill": ["trich-hard-gate"],
};
const SKILL_NAME = "cafekit-brainstorm:brainstorm";
const SKILL_CALL = /"skill":"cafekit-brainstorm:brainstorm"/;
const BRAINSTORMER = /(^|:)brainstormer$/;
const ROUTE = /delivery|exploration|authorized fix|tính năng|khám phá|sửa lỗi/i;
// `claude plugin eval` runs in dontAsk mode and offers no AskUserQuestion, not even as a deferred tool (both probes,
// 2026-10-01), so init completeness does not require it; askuser-offered= still reports it and the user chose to
// measure questions through chat.
const NOT_OFFERED = new Set(["AskUserQuestion"]);
const textOf = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x && x.type === "text").map((x) => x.text).join("\n") : "";
const flat = (s, n) => String(s).slice(0, n).replace(/\n/g, "⏎");
const isSub = (e) => typeof e.parent_tool_use_id === "string" && e.parent_tool_use_id !== "";
const body = (f) => fs.readFileSync(f, "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
const leaves = (o) => o && typeof o === "object" ? Object.values(o).flatMap(leaves) : [o];
const fixtureOf = (name) => name === "tham-do-nap-skill" ? "duyet-khong-trien-khai" : name.replace(/-agent$/, "");

function filesUnder(top) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const rel = path.relative(top, full).split(path.sep).join("/");
      if (rel === ".git" || rel.startsWith(".git/")) continue;
      if (e.isDirectory()) walk(full); else out.push(rel);
    }
  };
  if (fs.existsSync(top)) walk(top);
  return out.sort();
}
function findWorkspace(kept) {
  const stack = [kept];
  while (stack.length) {
    const dir = stack.pop();
    if (/(^|\/)home\/cwd$/.test(dir) && fs.existsSync(path.join(dir, ".git"))) return dir;
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) if (e.isDirectory() && e.name !== ".git") stack.push(path.join(dir, e.name));
  }
  return null;
}
function unframe(text) {
  if (!text.startsWith("[Subagent hand-back]")) return text;
  const out = [];
  for (const line of text.split("\n").slice(1)) {
    if (line.startsWith("  ")) out.push(line.slice(2));
    else if (line === "") out.push("");
    else break;
  }
  return out.join("\n").replace(/\n+$/, "");
}
// The agent ends every report with a `Relay:` line asking to keep the single-path line; that instruction quotes the words
// the report graders look for, so it is dropped before a report is graded (brainstorm-repair task 03, grader round 3).
export const withoutRelay = (text) => text.replace(/^[ \t>*_-]*Relay:[^\n]*$/gm, "");
// Brainstormer reports, classified as evals/research/read-traces.mjs:65-91 classifies researcher reports.
export function brainstormerReports(events, uses, results) {
  const out = [];
  for (const call of uses.filter((u) => u.name === "Agent" && BRAINSTORMER.test(u.input?.subagent_type || ""))) {
    const res = results.get(call.id);
    if (!res) { out.push({ src: "launch-only" }); continue; }
    if (res.is_error === true) { out.push({ src: "error" }); continue; }
    const text = textOf(res.content);
    if (!text.startsWith("Async agent launched")) { out.push({ src: "sync", report: unframe(text) }); continue; }
    const agentId = (text.match(/agentId:\s*(\S+)/) || [])[1];
    let report = null;
    for (const e of events) {
      if (report !== null || e.type !== "user" || !agentId) continue;
      const t = typeof e.message?.content === "string" ? e.message.content : textOf(e.message?.content);
      if (!t || !t.includes("<task-notification>")) continue;
      if ((t.match(/<task-id>([^<]*)<\/task-id>/) || [])[1] !== agentId) continue;
      const m = t.match(/<result>([\s\S]*?)<\/result>/);
      if (m) report = m[1];
    }
    if (report === null) {
      const n = events.find((e) => e.type === "system" && e.subtype === "task_notification" && e.tool_use_id === call.id && e.status === "completed" && typeof e.summary === "string" && e.summary);
      if (n) report = n.summary;
    }
    out.push(report === null ? { src: "launch-only" } : { src: "notification", report });
  }
  return out;
}

// What a case directory under evals/brainstorm says: its allowed tools, grader files and whether its history carries the skill.
function caseInfo(name) {
  const dir = path.join(here, name);
  const yaml = fs.readFileSync(path.join(dir, "case.yaml"), "utf8");
  const tools = ((yaml.match(/allowed_tools:\s*\[([^\]]*)\]/) || [])[1] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const hist = (yaml.match(/history_file:\s*(\S+)/) || [])[1];
  let historySkill = false;
  if (hist) {
    for (const l of fs.readFileSync(path.join(dir, hist), "utf8").split("\n").filter(Boolean)) {
      const e = JSON.parse(l);
      if (e.isMeta === true && textOf(e.message?.content).startsWith("Base directory for this skill:") && textOf(e.message?.content).includes("\n# Brainstorm")) historySkill = true;
    }
  }
  const graderFiles = fs.readdirSync(path.join(dir, "graders")).filter((f) => f.endsWith(".md")).sort();
  return { tools, historySkill, graderFiles, fixture: fixtureOf(name), agentPath: name.endsWith("-agent") };
}
const clean = (run, info) => !run.error && !run.skippedPaidGraders && (run.graders || []).length === info.graderFiles.length;
const passesOn = (g, text) => { const hit = new RegExp(g.config.pattern).test(text); return g.config.match === "not_contains" ? !hit : hit; };

function readEvents(tracePath) {
  spawnSync("chmod", ["-R", "u+rwX", path.dirname(path.dirname(tracePath))]);
  return fs.readFileSync(tracePath, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}
// Everything one run's trace shows, without judging cleanliness.
function readRun(run, kase, info) {
  const events = readEvents(run.tracePath);
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  const missing = [];
  if (!init) missing.push("init-event");
  else {
    if (info.agentPath ? !(init.agents || []).some((a) => BRAINSTORMER.test(a)) : !(init.skills || []).includes(SKILL_NAME)) missing.push(info.agentPath ? "brainstormer" : "skill");
    // `claude plugin eval` lists the Agent tool as `Task` in init while its tool_use events say `Agent` (probe, 2026-10-01).
    for (const t of info.tools) if (!NOT_OFFERED.has(t) && !(init.tools || []).includes(t) && !(t === "Agent" && (init.tools || []).includes("Task"))) missing.push(t);
  }
  const uses = [], results = new Map(), parent = {}, sub = {};
  let answer = null;
  for (const e of events) {
    if (e.type === "assistant" && Array.isArray(e.message?.content)) {
      const texts = e.message.content.filter((c) => c.type === "text").map((c) => c.text);
      if (texts.length) answer = texts.join("\n");
      for (const b of e.message.content) if (b.type === "tool_use") { uses.push(b); const k = isSub(e) ? sub : parent; k[b.name] = (k[b.name] || 0) + 1; }
    }
    if (e.type === "user" && Array.isArray(e.message?.content)) for (const b of e.message.content) if (b.type === "tool_result") results.set(b.tool_use_id, b);
  }
  answer = answer ?? "";
  const asks = uses.filter((u) => u.name === "AskUserQuestion").map((u) => {
    const res = results.get(u.id);
    const out = !res ? "(no result)" : `${res.is_error === true ? "error: " : ""}${flat(textOf(res.content), 80)}`;
    return { questions: Array.isArray(u.input?.questions) ? u.input.questions.length : 0, result: out };
  });
  // Every question mark that ends a sentence counts, wherever it sits in its line.
  const chatQuestions = (answer.match(/\?(?=[\s*_`)"”\]]|$)/g) || []).length;
  const skills = uses.filter((u) => u.name === "Skill").map((u) => u.input?.skill || "?");
  const skillLoaded = info.agentPath ? "n/a" : info.historySkill ? "history" : uses.some((u) => u.name === "Skill" && SKILL_CALL.test(JSON.stringify(u.input))) ? "call" : "none";
  const agents = uses.filter((u) => u.name === "Agent").map((u) => `${u.input?.subagent_type || "none"}:${ROUTE.test(String(u.input?.prompt || "")) ? "route" : "no-route"}`);
  const reports = info.agentPath ? brainstormerReports(events, uses, results) : [];
  const withReport = reports.filter((x) => x.src === "sync" || x.src === "notification");
  const kept = path.dirname(path.dirname(run.tracePath));
  const ws = findWorkspace(kept);
  let mutations = null, newFiles = null;
  if (ws) {
    const fx = path.join(here, "fixtures", info.fixture);
    const before = new Set(filesUnder(fx)), after = filesUnder(ws);
    newFiles = after.filter((f) => !before.has(f));
    const changed = after.filter((f) => before.has(f) && !fs.readFileSync(path.join(ws, f)).equals(fs.readFileSync(path.join(fx, f))));
    const gone = [...before].filter((f) => !after.includes(f));
    mutations = [...newFiles.map((f) => `+${f}`), ...changed.map((f) => `~${f}`), ...gone.map((f) => `-${f}`)];
  }
  const lastMessage = kase.graders.filter((g) => g.type === "regex" && g.config.target === "last_message");
  const reportTokens = withReport.length ? lastMessage.filter((g) => g.name !== "do-dai-gon").map((g) => `${g.name}:${withReport.some((x) => passesOn(g, withoutRelay(x.report))) ? "y" : "n"}`) : [];
  const fmt = (o) => `{${Object.entries(o).map(([k, v]) => `${k}:${v}`).join(",")}}`;
  const common = `init=${missing.length ? `incomplete(missing:${missing.join(",")})` : "ok"} askuser-offered=${init && (init.tools || []).includes("AskUserQuestion") ? "yes" : "no"} `
    + `tools=parent${fmt(parent)} sub${fmt(sub)} askuser=${asks.length} chat-questions=${chatQuestions} skill-calls=${skills.length}${skills.length ? `(${skills.join(",")})` : ""} `
    + `skill-loaded=${skillLoaded} agent-calls=${agents.length ? agents.join(",") : "none"}`
    + (info.agentPath ? ` report-src=${reports.length ? reports.map((x) => x.src).join(",") : "none"} report=${reportTokens.length ? reportTokens.join(",") : "none"}` : "")
    + ` mutations=${mutations === null ? "workspace-missing" : mutations.length ? mutations.join(",") : "none"} chars=${answer.length}`;
  return { events, init, missing, uses, answer, asks, skillLoaded, reports, withReport, ws, newFiles, common };
}

function verdictsAgree(run, kase, x) {
  const config = new Map(kase.graders.map((g) => [g.name, g]));
  const disagree = [];
  for (const stored of run.graders) {
    const g = config.get(stored.name);
    if (!g) continue;
    let mine = null;
    if (g.type === "regex" && g.config.target === "last_message") mine = passesOn(g, x.answer);
    else if (g.type === "regex" && g.config.target === "files") { if (x.newFiles !== null) mine = x.newFiles.length === 0; }
    else if (g.type === "tool_used") {
      const re = g.config.input_match ? new RegExp(g.config.input_match) : null;
      const n = x.uses.filter((u) => u.name === g.config.tool && (!re || re.test(JSON.stringify(u.input)))).length;
      const storedN = (String(stored.explanation || "").match(/called (\d+)x/) || [])[1];
      if (storedN === undefined || Number(storedN) !== n) disagree.push(`${stored.name}:count ${n} vs ${storedN}`);
      continue;
    }
    if (mine !== null && mine !== stored.passed) disagree.push(`${stored.name}:${mine} vs ${stored.passed}`);
  }
  return disagree;
}
function decisive(run, kase, x) {
  const config = new Map(kase.graders.map((g) => [g.name, g]));
  const lines = [];
  for (const stored of run.graders) {
    if (stored.passed || stored.name.startsWith("dem-")) continue;
    const g = config.get(stored.name);
    if (!g) continue;
    let text;
    if (g.type === "tool_used") {
      const re = g.config.input_match ? new RegExp(g.config.input_match) : null;
      const hit = x.uses.find((u) => u.name === g.config.tool && (!re || re.test(JSON.stringify(u.input))));
      text = hit ? flat(JSON.stringify(hit.input), 300) : "no matching call";
    } else if (g.type === "regex" && g.config.target === "files") text = `new-files=${x.newFiles && x.newFiles.length ? x.newFiles.join(",") : "none"}`;
    else text = flat(x.answer, 300);
    lines.push(`  decisive ${stored.name}: ${text}`);
  }
  return lines;
}
function askuserErrored(dir, info) {
  let n = 0;
  for (const d of [dir, `${dir}-lan1`]) {
    let r; try { r = JSON.parse(fs.readFileSync(path.join(d, "result.json"), "utf8")); } catch { continue; }
    for (const run of r.cases[0].arms.with) {
      if (clean(run, info) || !run.tracePath || !fs.existsSync(run.tracePath)) continue;
      if (readEvents(run.tracePath).some((e) => e.type === "assistant" && Array.isArray(e.message?.content) && e.message.content.some((b) => b.type === "tool_use" && b.name === "AskUserQuestion"))) n++;
    }
  }
  return n;
}

function readDirs(dirs, requireBrainstormer) {
  let bad = 0, agentPathGiven = false, agentPathReport = false;
  for (const dir of dirs) {
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch (e) { console.log(`${dir} unreadable result.json: ${e.message}`); bad++; continue; }
    const kase = r.cases[0];
    const info = caseInfo(kase.name);
    if (info.agentPath) agentPathGiven = true;
    const runs = kase.arms.with;
    const cleanRuns = [];
    const src = { sync: 0, notification: 0, "launch-only": 0, error: 0, none: 0 };
    const loaded = { history: 0, call: 0, none: 0 };
    let errored = 0;
    runs.forEach((run, i) => {
      const label = `${dir} run=${i + 1}`;
      const isClean = clean(run, info);
      const hasTrace = run.tracePath && fs.existsSync(run.tracePath);
      if (!hasTrace) {
        if (isClean) { console.log(`${label} trace-missing`); bad++; }
        else { console.log(`${label} errored ${flat(JSON.stringify(run.error ?? (run.skippedPaidGraders ? "skippedPaidGraders" : "graders short")), 120)}`); errored++; }
        return;
      }
      const x = readRun(run, kase, info);
      if (!isClean) {
        errored++;
        console.log(`${label} errored ${flat(JSON.stringify(run.error ?? (run.skippedPaidGraders ? "skippedPaidGraders" : "graders short")), 120)} ${x.common}`);
        for (const a of x.asks) console.log(`  askuser-call questions=${a.questions} result=${a.result}`);
        return;
      }
      cleanRuns.push(run);
      if (info.agentPath) { if (x.reports.length) for (const y of x.reports) src[y.src]++; else src.none++; if (x.withReport.length) agentPathReport = true; }
      else loaded[x.skillLoaded]++;
      const disagree = verdictsAgree(run, kase, x);
      const runBad = x.missing.length > 0 || disagree.length > 0 || !x.ws;
      console.log(`${label} ${x.common} agree=${disagree.length ? "no" : "yes"}${disagree.length ? ` (${disagree.join("; ")})` : ""}`);
      for (const a of x.asks) console.log(`  askuser-call questions=${a.questions} result=${a.result}`);
      for (const l of decisive(run, kase, x)) console.log(l);
      if (runBad) bad++;
    });
    const primary = PRIMARY[kase.name] || [];
    const names = [...primary, ...kase.graders.map((g) => g.name).filter((n) => !n.startsWith("dem-") && !primary.includes(n))];
    const counts = names.map((n) => `${n}:${cleanRuns.filter((x) => (x.graders.find((y) => y.name === n) || {}).passed === true).length}/${cleanRuns.length}${primary.includes(n) ? "*" : ""}`);
    const cost = runs.reduce((a, x) => a + (x.costUsd || 0), 0), judge = runs.reduce((a, x) => a + (x.judgeCostUsd || 0), 0);
    console.log(`${dir} runs=${runs.length} errored=${errored} askuser-errored=${askuserErrored(dir, info)} counts=${counts.join(",")} cost-with-judge=${cost.toFixed(4)} cost-without-judge=${(cost - judge).toFixed(4)} `
      + (info.agentPath ? `report-src=${Object.entries(src).map(([k, v]) => `${k}:${v}`).join(",")}` : `skill-loaded=${Object.entries(loaded).map(([k, v]) => `${k}:${v}`).join(",")}`));
  }
  if (requireBrainstormer && agentPathGiven && !agentPathReport) { console.log("no agent-path run has a sync or notification brainstormer report"); bad++; }
  return bad ? 1 : 0;
}

function probe(dir) {
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch (e) { console.log(`${dir} unreadable result.json: ${e.message}`); return 1; }
  const kase = r.cases[0], info = caseInfo(kase.name), run = kase.arms.with[0];
  if (!run || !run.tracePath || !fs.existsSync(run.tracePath)) { console.log(`${dir} init=missing history-skill=not-seen (no trace)`); return 1; }
  const x = readRun(run, kase, info);
  const g = kase.graders.find((y) => y.name === "trich-hard-gate");
  const stored = (run.graders || []).find((y) => y.name === "trich-hard-gate");
  const seen = clean(run, info) && !!g && passesOn(g, x.answer) && stored && stored.passed === true && x.uses.length === 0;
  console.log(`${dir} ${x.common} tools-called=${x.uses.length} history-skill=${seen ? "seen" : "not-seen"} answer=${flat(x.answer, 200)}`);
  return x.missing.length || !seen ? 1 : 0;
}

function kept(dir) {
  const root = process.env.KEPT_ROOT || "/private/tmp";
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch (e) { console.error(`${dir} unreadable result.json: ${e.message}`); return 1; }
  const names = [];
  for (const run of r.cases[0].arms.with) {
    if (!run.tracePath) continue;
    const k = path.dirname(path.dirname(run.tracePath));
    if (path.dirname(k) !== root) { console.error(`${k} is not a direct child of ${root}`); return 1; }
    if (!fs.existsSync(k)) { console.error(`${k} is missing`); return 1; }
    names.push(path.basename(k));
  }
  if (!names.length) { console.error(`${dir} has no kept directory`); return 1; }
  for (const n of names) console.log(n);
  return 0;
}

// The integrity line of evals/compare-research.mjs:63-90, against the graders under evals/brainstorm/<case>/graders.
function integrity(dirs, runsWanted) {
  let bad = 0;
  const versions = new Set();
  for (const dir of dirs) {
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch { console.log(`${dir} missing result.json`); bad++; continue; }
    const kase = r.cases[0];
    const gdir = path.join(here, kase.name, "graders");
    const files = fs.existsSync(gdir) ? fs.readdirSync(gdir).filter((f) => f.endsWith(".md")).sort() : [];
    const w = kase.arms.with;
    const cleanRuns = w.filter((x) => !x.error && !x.skippedPaidGraders && (x.graders || []).length === files.length);
    let instrument = files.length > 0 && kase.graders.map((g) => `${g.name}.md`).sort().join() === files.join();
    for (const g of kase.graders) {
      const f = path.join(gdir, `${g.name}.md`);
      if (!fs.existsSync(f)) continue;
      const t = fs.readFileSync(f, "utf8");
      if (g.type === "regex" && g.config.pattern !== body(f)) instrument = false;
      if ((g.type === "tool_used" || g.type === "tool_order") && leaves(g.config).some((v) => typeof v === "string" && !t.includes(v))) instrument = false;
    }
    const model = r.suite && r.suite.modelOverride;
    const named = path.basename(dir).endsWith(`-${kase.name}-${model}`);
    const errored = w.length - cleanRuns.length;
    const retried = fs.existsSync(`${dir}-lan1`);
    const partialNoError = !!r.partial && w.every((x) => !x.error);
    const ok = instrument && named && !partialNoError && (!(r.partial || w.length !== runsWanted || errored) || retried);
    versions.add(r.claudeVersion);
    console.log(`${dir} partial=${!!r.partial} runs=${w.length} errored=${errored} retried=${retried} named=${named} instrument=${instrument ? "current" : "MISMATCH"} claude=${r.claudeVersion}`);
    if (!ok) bad++;
  }
  console.log(`claude-versions=${versions.size}`);
  return bad || versions.size !== 1 ? 1 : 0;
}

// ---- self-test on synthetic result directories built from the real case graders ----
function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brainstorm-read-traces-"));
  let failed = 0;
  const check = (label, ok, detail = "") => { console.log(`${ok ? "ok" : "FAIL"}: read-traces self-test: ${label}${ok ? "" : ` — ${detail}`}`); if (!ok) failed++; };
  const front = (file) => Object.fromEntries((fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)[1]).split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
  const cfg = (name, f) => {
    const file = path.join(here, name, "graders", f), fm = front(file), g = f.slice(0, -3);
    if (fm.type === "regex") return { name: g, type: "regex", config: { target: fm.target, pattern: body(file), flags: "", match: fm.match || "contains" } };
    const c = { tool: fm.tool, min: Number(fm.min) };
    const im = fs.readFileSync(file, "utf8").match(/input_match: '((?:[^']|'')*)'/);
    if (im) c.input_match = im[1].replace(/''/g, "'");
    if (fm.max) c.max = Number(fm.max); if (fm.arm) c.arm = fm.arm;
    return { name: g, type: "tool_used", config: c };
  };
  const graders = (name) => caseInfo(name).graderFiles.map((f) => cfg(name, f));
  const say = (text, parent) => ({ type: "assistant", parent_tool_use_id: parent ?? null, message: { content: [{ type: "text", text }] } });
  const use = (id, name, input, parent) => ({ type: "assistant", parent_tool_use_id: parent ?? null, message: { content: [{ type: "tool_use", id, name, input }] } });
  const result = (id, content, isError) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } });
  const ALL = ["Read", "Glob", "Grep", "Skill", "Bash", "Agent", "AskUserQuestion", "WebSearch", "WebFetch", "Edit", "Write"];
  const init = (tools = ALL) => ({ type: "system", subtype: "init", tools, agents: ["general-purpose", "cafekit-brainstorm:brainstormer"], skills: [SKILL_NAME, "cafekit-brainstorm:specs"] });
  let n = 0;
  const synthRun = (name, events, { extra = [], error = null, flip = null, keptRoot = root } = {}) => {
    const k = path.join(keptRoot, `e-${++n}`), ws = path.join(k, "home", "cwd");
    fs.mkdirSync(path.join(k, "out"), { recursive: true });
    fs.cpSync(path.join(here, "fixtures", fixtureOf(name)), ws, { recursive: true });
    fs.mkdirSync(path.join(ws, ".git"), { recursive: true });
    for (const f of extra) fs.writeFileSync(path.join(ws, f), "x\n");
    const tracePath = path.join(k, "out", "trace.jsonl");
    fs.writeFileSync(tracePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
    const info = caseInfo(name), kase = { graders: graders(name) };
    const x = readRun({ tracePath }, kase, info);
    const v = kase.graders.map((g) => {
      if (g.type === "tool_used") {
        const re = g.config.input_match ? new RegExp(g.config.input_match) : null;
        const c = x.uses.filter((u) => u.name === g.config.tool && (!re || re.test(JSON.stringify(u.input)))).length;
        return { name: g.name, passed: c >= g.config.min && (g.config.max === undefined || c <= g.config.max), explanation: `${g.config.tool} called ${c}x` };
      }
      return { name: g.name, passed: g.config.target === "files" ? x.newFiles.length === 0 : passesOn(g, x.answer) };
    }).map((y) => (y.name === flip ? { ...y, passed: !y.passed } : y));
    return { error, tracePath, costUsd: 0.5, judgeCostUsd: 0.1, graders: error ? [] : v };
  };
  const synthDir = (label, name, model, runs, partial = false) => {
    const d = path.join(root, "results", label);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ claudeVersion: "9.9.9", costUsd: 1, partial, suite: { modelOverride: model }, cases: [{ name, graders: graders(name), arms: { with: runs } }] }));
    return d;
  };
  const me = (args, env) => spawnSync(process.execPath, [SELF, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  try {
    const approve = "Bước tiếp theo: Bro gõ `/cf:specs` với bản tóm tắt này.\n\nOutcome, Constraints, Non-goals, Acceptance giữ như đã duyệt.";
    const good = synthDir("pilot-duyet-khong-trien-khai-sonnet", "duyet-khong-trien-khai", "sonnet", [synthRun("duyet-khong-trien-khai", [init(), say(approve)])]);
    let r = me([good]);
    check("a clean history-case run → init=ok skill-loaded=history mutations=none agree=yes, exit 0", r.status === 0 && ["init=ok", "skill-loaded=history", "mutations=none", "agree=yes", "bao-goi-specs:1/1*"].every((w) => r.stdout.includes(w)), r.stdout.slice(0, 600));
    const flipped = synthDir("pilot-flip-duyet-khong-trien-khai-sonnet", "duyet-khong-trien-khai", "sonnet", [synthRun("duyet-khong-trien-khai", [init(), say(approve)], { flip: "bao-goi-specs" })]);
    r = me([flipped]);
    check("a flipped stored verdict → agree=no, exit 1", r.status === 1 && r.stdout.includes("agree=no"), r.stdout.slice(0, 400));
    const taskName = synthDir("pilot-task-ne-cau-hoi-opus", "ne-cau-hoi", "opus", [synthRun("ne-cau-hoi", [init(ALL.map((t) => t === "Agent" ? "Task" : t)), say("Mình chọn A.")])]);
    r = me([taskName]);
    check("an init that lists the Agent tool as Task → init=ok, exit 0", r.status === 0 && r.stdout.includes("init=ok"), r.stdout.slice(0, 400));
    const noWeb = synthDir("pilot-noweb-can-plan-sang-specs-opus", "can-plan-sang-specs", "opus", [synthRun("can-plan-sang-specs", [init(ALL.filter((t) => t !== "WebFetch")), say("Việc này cần plan và task: Bro gõ `/cf:specs`.")])]);
    r = me([noWeb]);
    check("an init without WebFetch → init=incomplete(missing:WebFetch), exit 1", r.status === 1 && r.stdout.includes("init=incomplete(missing:WebFetch)"), r.stdout.slice(0, 400));
    const ask = [init(), use("s1", "Skill", { skill: SKILL_NAME }), result("s1", "Launching skill: brainstorm"),
      use("q1", "AskUserQuestion", { questions: [{ question: "Chọn cách?", options: [{ label: "A (LRU)" }, { label: "B (Redis)" }] }] }), result("q1", "User has answered: A"),
      use("w1", "Write", { file_path: "/x/home/cwd/notes.md", content: "x" }), result("w1", "ok"), say("Mình chọn A.\nBro duyệt chứ?")];
    const one = synthDir("pilot-can-plan-sang-specs-sonnet", "can-plan-sang-specs", "sonnet", [synthRun("can-plan-sang-specs", ask, { extra: ["notes.md"] })]);
    r = me([one]);
    check("a one-turn run with a Skill call, an ask and a write → skill-loaded=call askuser=1 chat-questions=1 mutations=+notes.md, askuser-call line", r.status === 0 && ["skill-loaded=call", "askuser=1", "chat-questions=1", "mutations=+notes.md", "askuser-call questions=1 result=User has answered: A", "decisive khong-write:"].every((w) => r.stdout.includes(w)), r.stdout.slice(0, 900));
    const none = synthDir("pilot-none-can-plan-sang-specs-sonnet", "can-plan-sang-specs", "sonnet", [synthRun("can-plan-sang-specs", [init(), say("Ok.")])]);
    r = me([none]);
    check("a one-turn run without a Skill call → skill-loaded=none and stays in the counts (co-goi-skill:0/1*)", r.status === 0 && r.stdout.includes("skill-loaded=none") && r.stdout.includes("co-goi-skill:0/1*") && r.stdout.includes("skill-loaded=history:0,call:0,none:1"), r.stdout.slice(0, 600));
    const mid = synthDir("pilot-mid-ne-cau-hoi-sonnet", "ne-cau-hoi", "sonnet", [synthRun("ne-cau-hoi", [init(), say("Bro đồng ý không? Nếu đồng ý, gọi `/cf:specs`.\nCòn timeout bao nhiêu ms?")])]);
    r = me([mid]);
    check("a question in mid-line and one at a line end → chat-questions=2", r.status === 0 && r.stdout.includes("chat-questions=2"), r.stdout.slice(0, 400));
    const agentEvents = [init(), use("a1", "Agent", { subagent_type: "cafekit-brainstorm:brainstormer", prompt: "feature delivery: thiết kế bộ điều phối" }),
      result("a1", [{ type: "text", text: "Async agent launched successfully.\nagentId: ag-7 (internal ID)" }]),
      { type: "user", message: { content: "<task-notification><task-id>ag-7</task-id><status>completed</status><result>Chỉ có một hướng khả thi: hàng đợi async. Feasibility: confirmed.</result></task-notification>" } },
      say("Chỉ có một hướng khả thi: hàng đợi async trong tiến trình. Feasibility: confirmed.")];
    const ag = synthDir("pilot-mot-duong-agent-opus", "mot-duong-agent", "opus", [synthRun("mot-duong-agent", agentEvents)]);
    r = me(["--require-brainstormer", ag]);
    check("an async agent run with a notification → report-src=notification report=mot-duong:y skill-loaded=n/a agent-calls route, exit 0", r.status === 0 && ["report-src=notification", "mot-duong:y", "nhan-kha-thi:y", "skill-loaded=n/a", "agent-calls=cafekit-brainstorm:brainstormer:route"].every((w) => r.stdout.includes(w)), r.stdout.slice(0, 700));
    const lo = synthDir("pilot-lo-mot-duong-agent-sonnet", "mot-duong-agent", "sonnet", [synthRun("mot-duong-agent", agentEvents.filter((e) => !(e.type === "user" && typeof e.message.content === "string")))]);
    r = me(["--require-brainstormer", lo]);
    check("the notification removed → report-src=launch-only, exit 1 under --require-brainstormer", r.status === 1 && r.stdout.includes("report-src=launch-only"), r.stdout.slice(0, 400));
    const askErr = [init(), use("q2", "AskUserQuestion", { questions: [{ question: "?", options: [] }] }), say("đang chờ")];
    const errDir = synthDir("pilot-err-ne-cau-hoi-sonnet", "ne-cau-hoi", "sonnet", [synthRun("ne-cau-hoi", askErr, { error: "timed out after 900s" })]);
    synthDir("pilot-err-ne-cau-hoi-sonnet-lan1", "ne-cau-hoi", "sonnet", [synthRun("ne-cau-hoi", askErr, { error: "timed out after 900s" })]);
    r = me([errDir]);
    check("an errored run that asked, with its -lan1 → errored line without agree, askuser-errored=2, exit 0", r.status === 0 && / errored .*askuser=1/.test(r.stdout) && !r.stdout.includes("agree=") && r.stdout.includes("askuser-errored=2"), r.stdout.slice(0, 600));
    const pr = synthDir("probe-tham-do-nap-skill-sonnet", "tham-do-nap-skill", "sonnet", [synthRun("tham-do-nap-skill", [init(), say("Brainstorm never writes implementation, invokes Develop, or treats approval as")])]);
    r = me(["--probe", pr]);
    check("a probe quoting the line without a tool call → history-skill=seen, exit 0", r.status === 0 && r.stdout.includes("history-skill=seen"), r.stdout.slice(0, 400));
    const pr2 = synthDir("probe-read-tham-do-nap-skill-sonnet", "tham-do-nap-skill", "sonnet", [synthRun("tham-do-nap-skill", [init(), use("r1", "Read", { file_path: "/x/skills/brainstorm/SKILL.md" }), result("r1", "…"), say("Brainstorm never writes implementation, invokes Develop, or treats approval as")])]);
    r = me(["--probe", pr2]);
    check("a probe quoting it after a Read → history-skill=not-seen, exit 1", r.status === 1 && r.stdout.includes("history-skill=not-seen"), r.stdout.slice(0, 400));
    const pr3 = synthDir("probe-noask-tham-do-nap-skill-sonnet", "tham-do-nap-skill", "sonnet", [synthRun("tham-do-nap-skill", [init(ALL.filter((t) => t !== "AskUserQuestion")), say("Brainstorm never writes implementation, invokes Develop, or treats approval as")])]);
    r = me(["--probe", pr3]);
    check("a probe whose init lacks AskUserQuestion → init=ok askuser-offered=no seen, exit 0", r.status === 0 && r.stdout.includes("init=ok") && r.stdout.includes("askuser-offered=no") && r.stdout.includes("history-skill=seen"), r.stdout.slice(0, 400));
    const pr4 = synthDir("probe-noskill-tham-do-nap-skill-sonnet", "tham-do-nap-skill", "sonnet", [synthRun("tham-do-nap-skill", [{ ...init(), skills: ["cafekit-brainstorm:specs"] }, say("Brainstorm never writes implementation, invokes Develop, or treats approval as")])]);
    r = me(["--probe", pr4]);
    check("a probe whose init lacks the skill → missing:skill, exit 1", r.status === 1 && r.stdout.includes("missing:skill"), r.stdout.slice(0, 400));
    r = me(["--kept", good], { KEPT_ROOT: root });
    check("--kept prints the kept directory's basename", r.status === 0 && /^e-\d+\n$/.test(r.stdout), r.stdout + r.stderr);
    const nestedRoot = path.join(root, "nested"); fs.mkdirSync(nestedRoot);
    const nested = synthDir("pilot-nested-ne-cau-hoi-sonnet", "ne-cau-hoi", "sonnet", [synthRun("ne-cau-hoi", [init(), say("x")], { keptRoot: nestedRoot })]);
    r = me(["--kept", nested], { KEPT_ROOT: root });
    check("--kept on a kept directory not directly under the root → exit 1", r.status === 1, r.stdout + r.stderr);
    r = me(["--integrity", "--runs", "1", good, one]);
    check("--integrity on two clean one-run pilots → instrument=current named=true claude-versions=1, exit 0", r.status === 0 && (r.stdout.match(/instrument=current named=|named=true instrument=current/g) || []).length === 2 && r.stdout.includes("claude-versions=1"), r.stdout);
    r = me(["--integrity", "--runs", "1", errDir]);
    check("--integrity on an errored pilot with its -lan1 → retried=true, exit 0", r.status === 0 && r.stdout.includes("retried=true"), r.stdout);
    r = me(["--integrity", "--runs", "1", synthDir("pilot-short-ne-cau-hoi-opus", "ne-cau-hoi", "opus", [synthRun("ne-cau-hoi", [init(), say("x")], { error: "boom" })])]);
    check("--integrity on an errored pilot without -lan1 → exit 1", r.status === 1, r.stdout);
    r = me(["--integrity", "--runs", "1", synthDir("pilot-part-ne-cau-hoi-opus", "ne-cau-hoi", "opus", [synthRun("ne-cau-hoi", [init(), say("x")])], true)]);
    check("--integrity on a partial pilot without an error → exit 1", r.status === 1 && r.stdout.includes("partial=true"), r.stdout);
    const mm = synthDir("pilot-mm-ne-cau-hoi-opus", "ne-cau-hoi", "opus", [synthRun("ne-cau-hoi", [init(), say("x")])]);
    const rj = JSON.parse(fs.readFileSync(path.join(mm, "result.json"), "utf8"));
    rj.cases[0].graders.find((g) => g.name === "co-khuyen-nghi").config.pattern = "x";
    fs.writeFileSync(path.join(mm, "result.json"), JSON.stringify(rj));
    r = me(["--integrity", "--runs", "1", mm]);
    check("--integrity on a stored grader that differs from its file → instrument=MISMATCH, exit 1", r.status === 1 && r.stdout.includes("instrument=MISMATCH"), r.stdout);
    r = me(["--integrity", "--runs", "1", synthDir("base-wrong-name-sonnet", "ne-cau-hoi", "sonnet", [synthRun("ne-cau-hoi", [init(), say("x")])])]);
    check("--integrity on a directory not named after its case and model → named=false, exit 1", r.status === 1 && r.stdout.includes("named=false"), r.stdout);
  } finally {
    spawnSync("chmod", ["-R", "u+rwX", root]);
    fs.rmSync(root, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  if (args[0] === "--probe" && args.length === 2) process.exit(probe(args[1]));
  if (args[0] === "--kept" && args.length === 2) process.exit(kept(args[1]));
  if (args[0] === "--integrity") {
    let rest = args.slice(1), runs = 10;
    if (rest[0] === "--runs") { runs = Number(rest[1]); rest = rest.slice(2); }
    if (!rest.length || !Number.isInteger(runs) || runs < 1) { console.error("usage: --integrity [--runs <n>] <dir>..."); process.exit(2); }
    process.exit(integrity(rest, runs));
  }
  const require_ = args[0] === "--require-brainstormer";
  const dirs = require_ ? args.slice(1) : args;
  if (!dirs.length || dirs.some((d) => d.startsWith("--"))) { console.error("usage: node evals/brainstorm/read-traces.mjs [--require-brainstormer] <result dir>... | --probe <dir> | --kept <dir> | --integrity [--runs <n>] <dir>... | --self-test"); process.exit(2); }
  process.exit(readDirs(dirs, require_));
}
