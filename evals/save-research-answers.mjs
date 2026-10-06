#!/usr/bin/env node
// Lưu, trước khi thư mục giữ lại (--keep-temp) bị xoá, ba thứ của mọi lượt trong một thư mục kết quả evals/research:
// toàn văn câu trả lời cuối, báo cáo researcher và model — gói research-repair, $0.
//   <answers>/<tên>.txt  mỗi lượt một dòng `### run <n>` (hay `### run <n> errored` khi lượt không sạch: có error,
//                        có skippedPaidGraders, hay thiếu thước), rồi câu trả lời dựng lại như read-traces.mjs dựng
//                        (text của sự kiện assistant cuối cùng có text, nối bằng xuống dòng), hay `(no trace)`
//   <reports>/<tên>.txt  cùng các dòng header, mỗi báo cáo researcher có dòng `--- report <k> src=<src>` đứng trước,
//                        hay `(no report)`; cách tìm báo cáo chép từ researcherReports của read-traces.mjs (script đó
//                        chạy ngay khi được import nên không import được)
//   <models>/<tên>.txt   mỗi lượt `run=<n> agent-input-model=… researcher=… parent=…`
// Lượt sạch mà không có trace thì thoát 1; số header đọc lại từ file khác số lượt thì thoát 1.
//   node evals/save-research-answers.mjs --answers <dir> --reports <dir> --models <dir> <result dir>...
//   node evals/save-research-answers.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const RESEARCHER = /(^|:)researcher$/;
const HEADER = /^### run [0-9]+( errored)?$/;
const textOf = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x && x.type === "text").map((x) => x.text).join("\n") : "";
const isSub = (e) => typeof e.parent_tool_use_id === "string" && e.parent_tool_use_id !== "";

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

function readRun(tracePath) {
  spawnSync("chmod", ["-R", "u+rwX", path.dirname(path.dirname(tracePath))]);
  const events = fs.readFileSync(tracePath, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const uses = [], results = new Map(), researcherModels = new Set(), parentModels = new Set();
  let answer = null;
  for (const e of events) {
    if (e.type === "assistant" && Array.isArray(e.message?.content)) {
      const texts = e.message.content.filter((c) => c.type === "text").map((c) => c.text);
      if (texts.length) answer = texts.join("\n");
      for (const b of e.message.content) if (b.type === "tool_use") uses.push(b);
      if (e.message.model) (isSub(e) ? researcherModels : parentModels).add(e.message.model);
    }
    if (e.type === "user" && Array.isArray(e.message?.content)) for (const b of e.message.content) if (b.type === "tool_result") results.set(b.tool_use_id, b);
  }
  const inputModels = uses.filter((u) => u.name === "Agent" && RESEARCHER.test(u.input?.subagent_type || "")).map((u) => u.input?.model || "none");
  const list = (s, empty) => s.size ? [...s].sort().join(",") : empty;
  return {
    answer: answer ?? "",
    reports: researcherReports(events, uses, results),
    models: `agent-input-model=${inputModels.length ? [...new Set(inputModels)].sort().join(",") : "none"} researcher=${list(researcherModels, "unknown")} parent=${list(parentModels, "unknown")}`,
  };
}

// Returns { lines, bad }; writes the three files of every result directory.
function saveAll(dirs, out, researchDir = path.join(here, "research")) {
  const lines = [];
  let bad = 0;
  for (const d of [out.answers, out.reports, out.models]) fs.mkdirSync(d, { recursive: true });
  for (const dir of dirs) {
    const name = path.basename(dir);
    const r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
    const kase = r.cases[0];
    const files = fs.readdirSync(path.join(researchDir, kase.name, "graders")).filter((f) => f.endsWith(".md")).length;
    const answers = [], reports = [], models = [];
    kase.arms.with.forEach((run, i) => {
      const clean = !run.error && !run.skippedPaidGraders && (run.graders || []).length === files;
      const header = `### run ${i + 1}${clean ? "" : " errored"}`;
      if (!run.tracePath || !fs.existsSync(run.tracePath)) {
        if (clean) { lines.push(`${dir} run=${i + 1} clean run without a trace`); bad++; }
        answers.push(`${header}\n(no trace)`); reports.push(`${header}\n(no trace)`); models.push(`run=${i + 1} (no trace)`);
        return;
      }
      const x = readRun(run.tracePath);
      answers.push(`${header}\n${x.answer}`);
      reports.push(`${header}\n${x.reports.length ? x.reports.map((p, k) => `--- report ${k + 1} src=${p.src}${p.report !== undefined ? `\n${p.report}` : ""}`).join("\n") : "(no report)"}`);
      models.push(`run=${i + 1} ${x.models}`);
    });
    const runs = kase.arms.with.length;
    const write = (d, parts) => { const f = path.join(d, `${name}.txt`); fs.writeFileSync(f, parts.join("\n") + "\n"); return f; };
    const count = (f) => fs.readFileSync(f, "utf8").split("\n").filter((l) => HEADER.test(l)).length;
    const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    const a = write(out.answers, answers), p = write(out.reports, reports);
    write(out.models, models);
    const ha = count(a), hp = count(p);
    if (ha !== runs || hp !== runs) bad++;
    lines.push(`answers ${a} headers=${ha} runs=${runs} sha256=${sha(a)}`);
    lines.push(`reports ${p} headers=${hp} sha256=${sha(p)}`);
  }
  return { lines, bad };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-research-answers-"));
  let failed = 0;
  const check = (label, ok) => { console.log(`${ok ? "ok" : "fail"}: ${label}`); if (!ok) failed++; };
  try {
    const research = path.join(root, "research");
    fs.mkdirSync(path.join(research, "syn-agent", "graders"), { recursive: true });
    for (const g of ["a", "b"]) fs.writeFileSync(path.join(research, "syn-agent", "graders", `${g}.md`), "---\ntype: regex\n---\nx\n");
    const trace = (id, events) => {
      const p = path.join(root, id, "out", "trace.jsonl");
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return p;
    };
    const graders = [{ name: "a", passed: true }, { name: "b", passed: false }];
    const result = (name, runs) => { const d = path.join(root, "results", name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ cases: [{ name: "syn-agent", arms: { with: runs } }] })); return d; };
    const syncRun = trace("e-sync", [
      { type: "assistant", message: { model: "parent-m", content: [{ type: "text", text: "first text" }, { type: "tool_use", id: "t1", name: "Agent", input: { subagent_type: "researcher" } }] } },
      { type: "assistant", parent_tool_use_id: "t1", message: { model: "sub-m", content: [{ type: "text", text: "sub text" }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "[Subagent hand-back]\n  Depth: Standard (chosen: two options)\n\n  claim (confirmed)\nnot part" }] }] } },
      { type: "assistant", message: { model: "parent-m", content: [{ type: "text", text: "final line 1" }, { type: "text", text: "final line 2" }] } },
    ]);
    const asyncRun = trace("e-async", [
      { type: "assistant", message: { model: "parent-o", content: [{ type: "tool_use", id: "t2", name: "Agent", input: { subagent_type: "cafekit-research:researcher", model: "haiku" } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t2", content: "Async agent launched successfully.\nagentId: abc123" }] } },
      { type: "assistant", parent_tool_use_id: "t2", message: { model: "sub-h", content: [{ type: "text", text: "working" }] } },
      { type: "user", message: { content: "<task-notification>\n<task-id>abc123</task-id>\n<result>Depth: Quick (assigned)\nx (inferred)</result>\n</task-notification>" } },
      { type: "assistant", message: { model: "parent-o", content: [{ type: "text", text: "done" }] } },
    ]);
    const d1 = result("sau-syn-agent-sonnet", [{ graders, tracePath: syncRun }, { graders, skippedPaidGraders: true }]);
    const d2 = result("sau-syn-agent-opus", [{ graders, tracePath: asyncRun }]);
    const out = { answers: path.join(root, "a"), reports: path.join(root, "r"), models: path.join(root, "m") };
    const r = saveAll([d1, d2], out, research);
    check("two directories saved without a failure", r.bad === 0 && r.lines.length === 4);
    const read = (d, n) => fs.readFileSync(path.join(d, `${n}.txt`), "utf8");
    check("answers keep the last text-bearing event and mark the skipped run errored", read(out.answers, "sau-syn-agent-sonnet") === "### run 1\nfinal line 1\nfinal line 2\n### run 2 errored\n(no trace)\n");
    check("a sync report is unframed, its blank line kept", read(out.reports, "sau-syn-agent-sonnet") === "### run 1\n--- report 1 src=sync\nDepth: Standard (chosen: two options)\n\nclaim (confirmed)\n### run 2 errored\n(no trace)\n");
    check("models name the researcher's and the parent's models", read(out.models, "sau-syn-agent-sonnet") === "run=1 agent-input-model=none researcher=sub-m parent=parent-m\nrun=2 (no trace)\n");
    check("a notification report is found by its agentId", read(out.reports, "sau-syn-agent-opus") === "### run 1\n--- report 1 src=notification\nDepth: Quick (assigned)\nx (inferred)\n");
    check("an Agent call's model override is recorded", read(out.models, "sau-syn-agent-opus") === "run=1 agent-input-model=haiku researcher=sub-h parent=parent-o\n");
    const d3 = result("sau-syn-agent-bad", [{ graders }]);
    check("a clean run without a trace fails", saveAll([d3], out, research).bad === 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") process.exit(selfTest());
const opt = {};
const dirs = [];
for (let i = 0; i < args.length; i++) {
  if (["--answers", "--reports", "--models"].includes(args[i])) opt[args[i].slice(2)] = args[++i];
  else dirs.push(args[i]);
}
if (!opt.answers || !opt.reports || !opt.models || !dirs.length) {
  console.error("usage: node evals/save-research-answers.mjs --answers <dir> --reports <dir> --models <dir> <result dir>... | --self-test");
  process.exit(2);
}
const { lines, bad } = saveAll(dirs, opt);
for (const l of lines) console.log(l);
process.exit(bad ? 1 : 0);
