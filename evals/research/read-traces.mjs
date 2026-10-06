#!/usr/bin/env node
// Đọc lại mỗi lượt chạy đã giữ (--keep-temp) của evals/research, $0, không chạy lệnh nào bên trong thư mục giữ lại
// (chỉ chmod -R u+rwX như các bộ đọc khác). Mỗi lượt in init= (agent researcher, hai công cụ web, skill
// cafekit-research:research), host-research=, tools=, sub=, web=, researcher=, report-src=, last-from=, chars=,
// new-files= (và plan-diff= cho ca 3), report= và agree= (các thước regex last_message, tool_used, khong-file-moi và
// plan-giu-nguyen chấm lại so với điểm đã lưu); các dòng web-call, decisive và cap-check thụt vào. Lượt có error:
// không trace thì in errored và bỏ qua; có trace thì in phần hành vi, không kiểm agree. Mỗi thư mục in một dòng
// tổng. Thoát 1 khi có lượt xấu; với --require-researcher, thêm khi đã đưa thư mục đường agent mà không lượt nào có
// báo cáo researcher sync hay notification.
// Báo cáo notification: một <task-notification> trong tin nhắn user có <task-id> bằng agentId của lần phóng, hoặc
// (dạng stream mà gói code-review đã thấy) summary của sự kiện system task_notification mang tool_use_id của lần phóng.
//   node evals/research/read-traces.mjs [--require-researcher] <result dir>...
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const requireResearcher = args[0] === "--require-researcher";
const dirs = requireResearcher ? args.slice(1) : args;
if (!dirs.length) { console.error("usage: node evals/research/read-traces.mjs [--require-researcher] <result dir>..."); process.exit(2); }

const RESEARCHER = /(^|:)researcher$/;
const textOf = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x && x.type === "text").map((x) => x.text).join("\n") : "";
const flat = (s, n) => String(s).slice(0, n).replace(/\n/g, "⏎");
const median = (a) => { if (!a.length) return "none"; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const isSub = (e) => typeof e.parent_tool_use_id === "string" && e.parent_tool_use_id !== "";

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
// A synchronous hand-back opens with "[Subagent hand-back]" and indents every report line by two spaces.
function unframe(text) {
  if (!text.startsWith("[Subagent hand-back]")) return text;
  const body = [];
  for (const line of text.split("\n").slice(1)) {
    if (line.startsWith("  ")) body.push(line.slice(2));
    else if (line === "") body.push("");
    else break;
  }
  return body.join("\n").replace(/\n+$/, "");
}

function researcherReports(events, uses, results) {
  const calls = uses.filter((u) => u.name === "Agent" && RESEARCHER.test(u.input?.subagent_type || ""));
  const out = [];
  for (const call of calls) {
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

let bad = 0;
let agentPathGiven = false, agentPathReport = false;
for (const dir of dirs) {
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch (e) { console.log(`${dir} unreadable result.json: ${e.message}`); bad++; continue; }
  const kase = r.cases[0];
  const caseName = kase.name;
  const fixture = caseName.replace(/-agent$/, "");
  const agentPath = caseName !== fixture;
  if (agentPath) agentPathGiven = true;
  const config = new Map(kase.graders.map((g) => [g.name, g]));
  const lastMessageRegex = kase.graders.filter((g) => g.type === "regex" && g.config.target === "last_message");
  const fixtureFiles = new Set(filesUnder(path.join(here, "fixtures", fixture)));
  const fixturePlan = fixture === "khong-luu-khong-sua" ? fs.readFileSync(path.join(here, "fixtures", fixture, "plans/sync-v2/plan.md"), "utf8") : null;

  let errored = 0, timeouts = 0, webCalls = 0, webOk = 0, runsWithWebOk = 0, researcherOkRuns = 0, disagreements = 0;
  const timeoutChars = [], chars = [];
  const src = { sync: 0, notification: 0, "launch-only": 0, error: 0 };
  const reportVsAnswer = Object.fromEntries(lastMessageRegex.map((g) => [g.name, [0, 0]]));

  kase.arms.with.forEach((run, i) => {
    const label = `${dir} run=${i + 1}`;
    const hasTrace = run.tracePath && fs.existsSync(run.tracePath);
    if (run.error && !hasTrace) { console.log(`${label} errored ${flat(JSON.stringify(run.error), 120)}`); errored++; return; }
    if (!hasTrace) { console.log(`${label} trace-missing`); bad++; return; }
    const kept = path.dirname(path.dirname(run.tracePath));
    spawnSync("chmod", ["-R", "u+rwX", kept]);
    const events = fs.readFileSync(run.tracePath, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });

    const init = events.find((e) => e.type === "system" && e.subtype === "init");
    const hasAgent = !!init && (init.agents || []).some((a) => RESEARCHER.test(a));
    const hasWeb = !!init && (init.tools || []).includes("WebSearch") && (init.tools || []).includes("WebFetch");
    const hasSkill = !!init && (init.skills || []).includes("cafekit-research:research");
    const initStr = init ? [hasAgent ? "agent" : "no-agent", hasWeb ? "web" : "no-web", hasSkill ? "skill" : "no-skill"].join(",") : "missing";
    const hostResearch = ((init && init.skills) || []).filter((s) => /research/.test(s) && !s.startsWith("cafekit-research:"));

    const uses = [], results = new Map(), parent = {}, sub = {};
    let subEvents = 0, answer = null, lastFrom = "none";
    for (const e of events) {
      if (e.type === "assistant" && Array.isArray(e.message?.content)) {
        if (isSub(e)) subEvents++;
        const texts = e.message.content.filter((c) => c.type === "text").map((c) => c.text);
        if (texts.length) { answer = texts.join("\n"); lastFrom = isSub(e) ? "sub" : "parent"; }
        for (const b of e.message.content) if (b.type === "tool_use") {
          uses.push(b);
          const bucket = isSub(e) ? sub : parent;
          bucket[b.name] = (bucket[b.name] || 0) + 1;
        }
      }
      if (e.type === "user" && Array.isArray(e.message?.content)) for (const b of e.message.content) if (b.type === "tool_result") results.set(b.tool_use_id, b);
    }
    answer = answer ?? "";
    const fmt = (o) => `{${Object.entries(o).map(([k, v]) => `${k}:${v}`).join(",")}}`;

    const web = uses.filter((u) => u.name === "WebSearch" || u.name === "WebFetch");
    const webLines = [];
    let ok = 0;
    for (const u of web) {
      const res = results.get(u.id);
      if (res && res.is_error !== true) { ok++; webLines.push(`  web-call ${u.name} ${u.input?.query ?? u.input?.url ?? JSON.stringify(u.input)} → ${flat(textOf(res.content), 160)}`); }
    }
    const reports = researcherReports(events, uses, results);
    const withReport = reports.filter((x) => x.src === "sync" || x.src === "notification");
    const srcStr = reports.length ? reports.map((x) => x.src).join(",") : "none";
    const common = `init=${initStr} host-research=${hostResearch.length ? hostResearch.join(",") : "none"} tools=parent${fmt(parent)} sub${fmt(sub)} sub=${subEvents} web=${ok}/${web.length} researcher=${withReport.length}/${reports.length} report-src=${srcStr} last-from=${lastFrom} chars=${answer.length}`;

    if (run.error) {
      errored++;
      const isTimeout = /timed out/.test(String(run.error));
      if (isTimeout) { timeouts++; timeoutChars.push(answer.length); }
      console.log(`${label} errored ${flat(JSON.stringify(run.error), 120)} ${common}`);
      for (const l of webLines) console.log(l);
      return;
    }

    let runBad = !init || !hasAgent || !hasWeb || !hasSkill;
    webCalls += web.length; webOk += ok; if (ok) runsWithWebOk++;
    if (withReport.length) { researcherOkRuns++; if (agentPath) agentPathReport = true; }
    for (const x of reports) src[x.src] = (src[x.src] || 0) + 1;
    chars.push(answer.length);

    const ws = findWorkspace(kept);
    let newFiles = null, planDiff = null, planText = null;
    if (!ws) runBad = true;
    else {
      newFiles = filesUnder(ws).filter((f) => !fixtureFiles.has(f));
      if (fixturePlan !== null) {
        const p = path.join(ws, "plans/sync-v2/plan.md");
        planText = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
        if (planText === null) planDiff = "missing";
        else if (planText === fixturePlan) planDiff = "none";
        else {
          const a = planText.split("\n"), b = fixturePlan.split("\n");
          let k = 0; while (k < Math.max(a.length, b.length) && a[k] === b[k]) k++;
          planDiff = `${k + 1}:${flat(a[k] ?? "(end of file)", 120)}`;
        }
      }
    }

    // Recompute each stored verdict this reader can recompute.
    const disagree = [];
    for (const stored of run.graders) {
      const g = config.get(stored.name);
      if (!g) continue;
      let mine = null;
      if (g.type === "regex" && g.config.target === "last_message") {
        const hit = new RegExp(g.config.pattern).test(answer);
        mine = g.config.match === "not_contains" ? !hit : hit;
      } else if (g.type === "regex" && g.config.target === "files") {
        if (newFiles !== null) mine = newFiles.length === 0;
      } else if (g.type === "regex" && g.config.target && g.config.target.source === "file") {
        if (ws) mine = planText !== null && g.config.target.path === "plans/sync-v2/plan.md" ? new RegExp(g.config.pattern).test(planText) : null;
      } else if (g.type === "tool_used") {
        const re = g.config.input_match ? new RegExp(g.config.input_match) : null;
        const n = uses.filter((u) => u.name === g.config.tool && (!re || re.test(JSON.stringify(u.input)))).length;
        const storedN = (String(stored.explanation || "").match(/called (\d+)x/) || [])[1];
        if (storedN === undefined || Number(storedN) !== n) disagree.push(`${stored.name}:count ${n} vs ${storedN}`);
        continue;
      }
      if (mine !== null && mine !== stored.passed) disagree.push(`${stored.name}:${mine} vs ${stored.passed}`);
    }
    if (disagree.length) { runBad = true; disagreements += disagree.length; }

    const reportTokens = [];
    for (const g of lastMessageRegex) {
      const re = new RegExp(g.config.pattern);
      const inAnswer = re.test(answer);
      const inReport = withReport.some((x) => re.test(x.report));
      if (inAnswer) reportVsAnswer[g.name][1]++;
      if (inReport) reportVsAnswer[g.name][0]++;
      if (withReport.length) reportTokens.push(`${g.name}:${inReport ? "y" : "n"}`);
    }

    console.log(`${label} ${common} new-files=${newFiles === null ? "workspace-missing" : newFiles.length ? newFiles.join(",") : "none"}${planDiff !== null ? ` plan-diff=${planDiff}` : ""} report=${reportTokens.length ? reportTokens.join(",") : "none"} agree=${disagree.length ? "no" : "yes"}${disagree.length ? ` (${disagree.join("; ")})` : ""}`);
    for (const l of webLines) console.log(l);
    for (const stored of run.graders) {
      if (stored.passed || stored.name.startsWith("dem-")) continue;
      const g = config.get(stored.name);
      if (!g) continue;
      let text;
      if (g.type === "tool_used") {
        const re = g.config.input_match ? new RegExp(g.config.input_match) : null;
        const hit = uses.find((u) => u.name === g.config.tool && (!re || re.test(JSON.stringify(u.input))));
        text = hit ? flat(JSON.stringify(hit.input), 300) : "no matching call";
      } else if (stored.name === "plan-giu-nguyen") text = `plan-diff=${planDiff}`;
      else if (g.type === "regex" && g.config.target === "files") text = `new-files=${newFiles && newFiles.length ? newFiles.join(",") : "none"}`;
      else text = flat(answer, 300);
      console.log(`  decisive ${stored.name}: ${text}`);
    }
    if (fixture === "da-co-quyet-dinh") {
      const v = (n) => (run.graders.find((x) => x.name === n) || {}).passed;
      const ask = v("trich-adr") === true && v("chon-drizzle") === true && answer.length > 4000;
      console.log(`  cap-check chars=${answer.length} trich-adr=${v("trich-adr")} chon-drizzle=${v("chon-drizzle")} → ${ask ? "ask" : "ok"}`);
    }
    if (runBad) bad++;
  });

  console.log(`${dir} runs=${kase.arms.with.length} errored=${errored} timeouts=${timeouts} timeout-chars=${timeoutChars.length ? timeoutChars.join(",") : "none"} `
    + `web-calls=${webCalls} web-ok=${webOk} runs-with-web-ok=${runsWithWebOk} researcher-ok-runs=${researcherOkRuns} `
    + `report-src=sync:${src.sync},notification:${src.notification},launch-only:${src["launch-only"]},error:${src.error} chars-median=${median(chars)} disagreements=${disagreements} `
    + Object.entries(reportVsAnswer).map(([n, [a, b]]) => `${n}=${a}/${b}`).join(" "));
}

let code = bad ? 1 : 0;
if (requireResearcher && agentPathGiven && !agentPathReport) { console.log("no agent-path run has a sync or notification researcher report"); code = 1; }
process.exit(code);
