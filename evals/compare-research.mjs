#!/usr/bin/env node
// So số sau sửa (sau-<cell>) với số gốc (base-<cell>) của evals/research, không kết luận — gói research-repair.
// Chỉ đếm lượt sạch: không error, không skippedPaidGraders, đủ số thước của thư mục ca. Mỗi ô in:
//   cell=<c> grader=<g> set=<primary|watch> base=<x>/<n> after=<y>/<m> p=<p>   (mọi thước không bắt đầu bằng dem-;
//        primary là noi-do-sau, co-nhan-claim, trich-* ở đường agent và co-nhan-claim ở đường skill; p là Fisher
//        exact hai phía như evals/compare-code-review.mjs, toPrecision(4))
//   cell=<c> dem-goi-research-khac base-calls=<b> after-calls=<a>        (tổng "called Nx" trong explanation)
//   cell=<c> cost base=<costUsd> after=<costUsd>
//   cell=<c> answers relay … vi-status … over-4000 … chars-max …         (từ _answers/ và _answers-sau/)
//   cell=<c> r.<g> base=<in-report>/<in-final> after=…                   (đường agent, thước regex last_message;
//        phía gốc đọc dòng thư mục trong Receipt task 02 của gói số gốc vì thư mục giữ lại đã xoá, phía sau từ
//        evals/research/read-traces.mjs)
//   cell=<c> reports base=<sync+notification>/<runs> after=…   và   cell=<c> launch-only base=<n> after=<n>
//   cell=<c> models <researcher model>:<số lượt>,…                     (từ _models-sau/)
//   cell=<c> integrity partial=… runs=… errored=… retried=… named=… instrument=… claude=…
// rồi claude-versions=<n>. Thoát 1 khi thiếu ô, ô partial, sai số lượt hay có lượt không sạch mà không có -lan1,
// named=false, instrument=MISMATCH, claude-versions khác 1, read-traces.mjs thoát khác 0, hay có launch-only.
//   node evals/compare-research.mjs [--cells a,b] [--runs n] [--root dir] [--receipt file] [--research dir]
//   node evals/compare-research.mjs --cell <cell> | --pilots [--except <cell>] | --base-only | --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CASES = ["da-co-quyet-dinh", "da-co-quyet-dinh-agent", "nguon-cu-mau-thuan", "nguon-cu-mau-thuan-agent", "khong-luu-khong-sua", "khong-luu-khong-sua-agent", "chon-kien-truc-theo-rang-buoc", "chon-kien-truc-theo-rang-buoc-agent"];
const VI_STATUS = /(chưa (được )?(kiểm chứng|xác minh|xác nhận)|suy luận|đã (được )?(kiểm chứng|xác minh|xác nhận))/iu;
const HEADER = /^### run ([0-9]+)( errored)?$/;

// -- Fisher exact, two-sided (the method of evals/compare-code-review.mjs:44-56) --
const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
function fisher(x, n, y, m) {
  const a = x, b = n - x, c = y, d = m - y;
  const row1 = a + b, row2 = c + d, col1 = a + c;
  const observed = hyper(a, b, c, d);
  let p = 0;
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) {
    const q = hyper(k, row1 - k, col1 - k, row2 - col1 + k);
    if (q <= observed * (1 + 1e-7)) p += q;
  }
  return Math.min(1, p);
}
const fmt = (p) => p.toPrecision(4);

function context(o) {
  const research = o.research || path.join(here, "research");
  const cases = fs.readdirSync(research).filter((d) => fs.existsSync(path.join(research, d, "case.yaml")))
    .sort((a, b) => (CASES.indexOf(a) + 1 || 99) - (CASES.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return {
    research, cases,
    cells: cases.flatMap((c) => ["sonnet", "opus"].map((m) => `${c}-${m}`)),
    results: path.join(o.root || path.join(here, "results"), "research"),
    receipt: o.receipt || path.join(here, "..", "specs", "research-eval-baseline", "task-02-measure-baseline.md"),
    runs: o.runs || 10,
  };
}
const caseOf = (cell) => cell.slice(0, cell.lastIndexOf("-"));
const body = (f) => fs.readFileSync(f, "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
const leaves = (o) => o && typeof o === "object" ? Object.values(o).flatMap(leaves) : [o];

// A result directory: its runs, the clean ones, and its integrity line fields.
function readCell(ctx, dir, cell, runsWanted) {
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch { return null; }
  const kase = r.cases[0];
  const gdir = path.join(ctx.research, caseOf(cell), "graders");
  const files = fs.readdirSync(gdir).filter((f) => f.endsWith(".md")).sort();
  const w = kase.arms.with;
  const clean = w.filter((x) => !x.error && !x.skippedPaidGraders && (x.graders || []).length === files.length);
  let instrument = kase.graders.map((g) => `${g.name}.md`).sort().join() === files.join();
  for (const g of kase.graders) {
    const f = path.join(gdir, `${g.name}.md`);
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    if (g.type === "regex" && g.config.pattern !== body(f)) instrument = false;
    if (g.type === "llm" && g.config.criteria !== body(f)) instrument = false;
    if ((g.type === "tool_used" || g.type === "tool_order") && leaves(g.config).some((x) => typeof x === "string" && !t.includes(x))) instrument = false;
  }
  const model = r.suite && r.suite.modelOverride;
  const named = `${kase.name}-${model}` === cell && path.basename(dir).endsWith(`-${kase.name}-${model}`);
  const errored = w.length - clean.length;
  const retried = fs.existsSync(`${dir}-lan1`);
  const partialNoError = !!r.partial && w.every((x) => !x.error);
  const ok = instrument && named && !partialNoError && (!(r.partial || w.length !== runsWanted || errored) || retried);
  return { r, kase, clean, files, errored, retried, named, instrument, ok,
    line: `partial=${!!r.partial} runs=${w.length} errored=${errored} retried=${retried} named=${named} instrument=${instrument ? "current" : "MISMATCH"} claude=${r.claudeVersion}` };
}

const passes = (cellData, g) => cellData.clean.filter((x) => (x.graders.find((y) => y.name === g) || {}).passed === true).length;
function calls(cellData) {
  let s = 0;
  for (const x of cellData.clean) {
    const g = x.graders.find((y) => y.name === "dem-goi-research-khac");
    if (!g) continue;
    const m = String(g.explanation || "").match(/called (\d+)x/);
    if (!m) return NaN;
    s += Number(m[1]);
  }
  return s;
}

// The clean runs' answers of an answers file: `### run <n>` headers without `errored`.
function answers(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").replace(/\n$/, "").split("\n");
  const out = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(HEADER);
    if (m) { cur = m[2] ? null : []; if (cur) out.push(cur); continue; }
    if (cur) cur.push(l);
  }
  return out.map((a) => a.join("\n"));
}
function answerCounts(list) {
  return { relay: list.filter((a) => a.includes("Relay:")).length, vi: list.filter((a) => VI_STATUS.test(a)).length,
    over: list.filter((a) => a.length > 4000).length, max: list.length ? Math.max(...list.map((a) => a.length)) : 0 };
}

// A read-traces per-directory line: report-src and the last_message pairs.
function parseDirLine(line) {
  if (!line) return null;
  const src = line.match(/ report-src=sync:(\d+),notification:(\d+),launch-only:(\d+),error:(\d+)/);
  const runs = line.match(/ runs=(\d+)/);
  const pairs = {};
  for (const m of line.matchAll(/ ([a-z0-9-]+)=(\d+)\/(\d+)(?= |$)/g)) pairs[m[1]] = `${m[2]}/${m[3]}`;
  return src && runs ? { reports: `${Number(src[1]) + Number(src[2])}/${runs[1]}`, launchOnly: Number(src[3]), pairs } : null;
}
function baselineLine(ctx, cell) {
  const prefix = `evals/results/research/base-${cell} runs=`;
  const receipt = fs.readFileSync(ctx.receipt, "utf8");
  const after = receipt.slice(Math.max(0, receipt.indexOf("\n## Receipt\n")));
  const open = after.indexOf("```text\n"), close = open < 0 ? -1 : after.indexOf("\n```", open + 8);
  const fence = open < 0 || close < 0 ? "" : after.slice(open + 8, close);
  const line = fence.split("\n").find((l) => l.startsWith(prefix));
  return parseDirLine(line);
}
function readTraces(dir) {
  const v = spawnSync(process.execPath, [path.join(here, "research", "read-traces.mjs"), dir], { encoding: "utf8" });
  const line = (v.stdout || "").split("\n").find((l) => l.startsWith(`${dir} runs=`));
  return { code: v.status, parsed: parseDirLine(line) };
}

function modelsLine(file) {
  if (!fs.existsSync(file)) return null;
  const n = {};
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    const m = l.match(/^run=\d+ .*researcher=(\S+)/);
    if (m) n[m[1]] = (n[m[1]] || 0) + 1;
  }
  return Object.entries(n).sort().map(([k, v]) => `${k}:${v}`).join(",") || "none";
}

// Prints one cell's lines; returns { ok, version }.
function compareCell(ctx, cell, { baseOnly }) {
  const say = (s) => console.log(`cell=${cell} ${s}`);
  const baseDir = path.join(ctx.results, `base-${cell}`);
  const afterDir = path.join(ctx.results, baseOnly ? `base-${cell}` : `sau-${cell}`);
  const base = readCell(ctx, baseDir, cell, 10);
  const after = readCell(ctx, afterDir, cell, baseOnly ? 10 : ctx.runs);
  if (!base || !after) { say(`missing ${!base ? baseDir : afterDir}`); return { ok: false }; }
  let ok = true;
  const agentPath = caseOf(cell).endsWith("-agent");
  const primary = (g) => g === "co-nhan-claim" || (agentPath && (g === "noi-do-sau" || g.startsWith("trich-")));
  for (const f of after.files) {
    const g = f.slice(0, -3);
    if (g.startsWith("dem-")) continue;
    const x = passes(base, g), n = base.clean.length, y = passes(after, g), m = after.clean.length;
    const p = fmt(fisher(x, n, y, m));
    if (baseOnly && (p !== "1.000" || x !== y || n !== m)) ok = false;
    say(`grader=${g} set=${primary(g) ? "primary" : "watch"} base=${x}/${n} after=${y}/${m} p=${p}`);
  }
  const bc = calls(base), ac = calls(after);
  if (!Number.isFinite(bc) || !Number.isFinite(ac)) ok = false;
  say(`dem-goi-research-khac base-calls=${bc} after-calls=${ac}`);
  say(`cost base=${(base.r.costUsd || 0).toFixed(4)} after=${(after.r.costUsd || 0).toFixed(4)}`);
  const ba = answers(path.join(ctx.results, "_answers", `base-${cell}.txt`));
  const aa = baseOnly ? ba : answers(path.join(ctx.results, "_answers-sau", `sau-${cell}.txt`));
  if (!ba || !aa) { say("answers missing"); ok = false; }
  else {
    const b = answerCounts(ba), a = answerCounts(aa);
    say(`answers relay base=${b.relay} after=${a.relay} vi-status base=${b.vi} after=${a.vi} over-4000 base=${b.over} after=${a.over} chars-max base=${b.max} after=${a.max}`);
  }
  let rt = null;
  if (!baseOnly) {
    rt = readTraces(afterDir);
    if (rt.code !== 0 || !rt.parsed) { say(`read-traces exit ${rt.code}`); ok = false; }
  }
  if (agentPath) {
    const bl = baselineLine(ctx, cell);
    const al = baseOnly ? bl : rt && rt.parsed;
    if (!bl || !al) { say("report counts missing"); ok = false; }
    else {
      const regexes = after.kase.graders.filter((g) => g.type === "regex" && g.config.target === "last_message").map((g) => g.name).sort();
      for (const g of regexes) say(`r.${g} base=${bl.pairs[g] ?? "none"} after=${al.pairs[g] ?? "none"}`);
      say(`reports base=${bl.reports} after=${al.reports}`);
      say(`launch-only base=${bl.launchOnly} after=${al.launchOnly}`);
      if (!baseOnly && al.launchOnly > 0) ok = false;
    }
  }
  if (!baseOnly) {
    const models = modelsLine(path.join(ctx.results, "_models-sau", `sau-${cell}.txt`));
    if (models === null) ok = false;
    say(`models ${models ?? "missing"}`);
  }
  say(`integrity ${after.line}`);
  if (!after.ok) ok = false;
  return { ok, version: after.r.claudeVersion };
}

function comparePilots(ctx, except) {
  let ok = true;
  const versions = new Set();
  for (const cell of ctx.cells.filter((c) => c !== except)) {
    const dir = path.join(ctx.results, `sau-pilot-${cell}`);
    const p = readCell(ctx, dir, cell, 1);
    if (!p) { console.log(`cell=${cell} pilot missing ${dir}`); ok = false; continue; }
    versions.add(p.r.claudeVersion);
    console.log(`cell=${cell} pilot integrity ${p.line}`);
    if (!p.ok) ok = false;
    const rt = readTraces(dir);
    if (rt.code !== 0) { console.log(`cell=${cell} pilot read-traces exit ${rt.code}`); ok = false; }
  }
  console.log(`claude-versions=${versions.size}`);
  return ok && versions.size === 1;
}

function compareAll(ctx, cells, baseOnly) {
  let ok = true;
  const versions = new Set();
  for (const cell of cells) {
    const r = compareCell(ctx, cell, { baseOnly });
    if (!r.ok) ok = false;
    if (r.version) versions.add(r.version);
  }
  console.log(`claude-versions=${versions.size}`);
  return ok && versions.size === 1;
}

function selfTest() {
  let failed = 0;
  const cases = [[10, 10, 0, 10, "0.00001083"], [5, 10, 5, 10, "1.000"], [9, 10, 1, 10, "0.001093"]];
  for (const [x, n, y, m, want] of cases) {
    const got = fmt(fisher(x, n, y, m));
    console.log(`fisher ${x}/${n} vs ${y}/${m} p=${got}`);
    if (got !== want) { console.log(`  expected p=${want}`); failed++; }
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "compare-research-"));
  try {
    const research = path.join(root, "instrument");
    const gdir = path.join(research, "syn-agent", "graders");
    fs.mkdirSync(gdir, { recursive: true });
    fs.writeFileSync(path.join(research, "syn-agent", "case.yaml"), "name: syn-agent\n");
    const G = {
      "co-nhan-claim": { type: "regex", config: { target: "last_message", pattern: "\\((?:confirmed|inferred|unresolved)\\)" } },
      "dem-goi-research-khac": { type: "tool_used", config: { tool: "Skill", input_match: "research", min: 0 } },
      "khong-x": { type: "regex", config: { target: "last_message", pattern: "FORBIDDEN", match: "not_contains" } },
      "noi-do-sau": { type: "regex", config: { target: "last_message", pattern: "Depth: (?:Quick|Standard|Deep)" } },
    };
    for (const [n, g] of Object.entries(G)) {
      const front = g.type === "regex" ? `type: regex\ntarget: last_message${g.config.match ? `\nmatch: ${g.config.match}` : ""}` : `type: tool_used\ntool: ${g.config.tool}\ninput_match: ${g.config.input_match}\nmin: 0`;
      fs.writeFileSync(path.join(gdir, `${n}.md`), `---\n${front}\n---\n\n${g.type === "regex" ? g.config.pattern : ""}\n`);
    }
    const stored = Object.entries(G).map(([name, g]) => ({ name, ...g }));
    const verdicts = (claim, khong, depth, called) => [
      { name: "co-nhan-claim", passed: claim }, { name: "dem-goi-research-khac", passed: true, explanation: `Skill called ${called}x (expected 0..∞)` },
      { name: "khong-x", passed: khong }, { name: "noi-do-sau", passed: depth }];
    const results = path.join(root, "results", "research");
    const put = (name, body) => { fs.mkdirSync(path.join(results, name), { recursive: true }); fs.writeFileSync(path.join(results, name, "result.json"), JSON.stringify(body)); };
    const kept = (id, events) => {
      fs.mkdirSync(path.join(root, id, "home", "cwd", ".git"), { recursive: true });
      const p = path.join(root, id, "out", "trace.jsonl");
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return p;
    };
    const init = { type: "system", subtype: "init", agents: ["researcher"], tools: ["Agent", "WebSearch", "WebFetch"], skills: ["cafekit-research:research"] };
    const say = (text) => ({ type: "assistant", message: { model: "parent-m", content: [{ type: "text", text }] } });
    put("base-syn-agent-sonnet", { costUsd: 1.5, partial: false, claudeVersion: "9.9.9", suite: { modelOverride: "sonnet" },
      cases: [{ name: "syn-agent", graders: stored, arms: { with: [{ graders: verdicts(false, true, false, 0) }, { graders: verdicts(true, true, false, 1) }] } }] });
    const t1 = kept("e-one", [init,
      { type: "assistant", message: { model: "parent-m", content: [{ type: "tool_use", id: "t1", name: "Agent", input: { subagent_type: "researcher" } }] } },
      { type: "assistant", parent_tool_use_id: "t1", message: { model: "sub-m", content: [{ type: "text", text: "working" }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "[Subagent hand-back]\n  Depth: Standard (chosen: two options)\n  claim (confirmed)" }] }] } },
      say("Depth: Standard (assigned)\nclaim (confirmed)\nRelay: keep the Depth line")]);
    const t2 = kept("e-two", [init, say("suy luận thôi")]);
    put("sau-syn-agent-sonnet", { costUsd: 2.25, partial: false, claudeVersion: "9.9.9", suite: { modelOverride: "sonnet" },
      cases: [{ name: "syn-agent", graders: stored, arms: { with: [{ graders: verdicts(true, true, true, 0), tracePath: t1 }, { graders: verdicts(false, true, false, 0), tracePath: t2, skippedPaidGraders: true }] } }] });
    fs.mkdirSync(path.join(results, "_answers"), { recursive: true });
    fs.writeFileSync(path.join(results, "_answers", "base-syn-agent-sonnet.txt"), "### run 1\nchưa kiểm chứng\n### run 2\nclaim (inferred)\n");
    fs.mkdirSync(path.join(results, "_answers-sau"), { recursive: true });
    fs.writeFileSync(path.join(results, "_answers-sau", "sau-syn-agent-sonnet.txt"), "### run 1\nDepth: Standard (assigned)\nclaim (confirmed)\nRelay: keep the Depth line\n### run 2 errored\nsuy luận thôi\n");
    fs.mkdirSync(path.join(results, "_models-sau"), { recursive: true });
    fs.writeFileSync(path.join(results, "_models-sau", "sau-syn-agent-sonnet.txt"), "run=1 agent-input-model=none researcher=sub-m parent=parent-m\nrun=2 agent-input-model=none researcher=unknown parent=parent-m\n");
    const receipt = path.join(root, "receipt.md");
    fs.writeFileSync(receipt, "```text\nevals/results/research/base-syn-agent-sonnet runs=2 errored=0 timeouts=0 timeout-chars=none web-calls=0 web-ok=0 runs-with-web-ok=0 researcher-ok-runs=2 report-src=sync:2,notification:0,launch-only:0,error:0 chars-median=15.5 disagreements=0 co-nhan-claim=2/1 khong-x=0/0 noi-do-sau=0/0\n```\n");
    const want = [
      "cell=syn-agent-sonnet grader=co-nhan-claim set=primary base=1/2 after=1/1 p=1.000",
      "cell=syn-agent-sonnet grader=khong-x set=watch base=2/2 after=1/1 p=1.000",
      "cell=syn-agent-sonnet grader=noi-do-sau set=primary base=0/2 after=1/1 p=0.3333",
      "cell=syn-agent-sonnet dem-goi-research-khac base-calls=1 after-calls=0",
      "cell=syn-agent-sonnet cost base=1.5000 after=2.2500",
      "cell=syn-agent-sonnet answers relay base=0 after=1 vi-status base=1 after=0 over-4000 base=0 after=0 chars-max base=16 after=71",
      "cell=syn-agent-sonnet r.co-nhan-claim base=2/1 after=1/1",
      "cell=syn-agent-sonnet r.khong-x base=0/0 after=0/0",
      "cell=syn-agent-sonnet r.noi-do-sau base=0/0 after=1/1",
      "cell=syn-agent-sonnet reports base=2/2 after=1/2",
      "cell=syn-agent-sonnet launch-only base=0 after=0",
      "cell=syn-agent-sonnet models sub-m:1,unknown:1",
      "cell=syn-agent-sonnet integrity partial=false runs=2 errored=1 retried=false named=true instrument=current claude=9.9.9",
      "claude-versions=1",
    ];
    const runSelf = () => spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--root", path.join(root, "results"), "--receipt", receipt, "--research", research, "--cells", "syn-agent-sonnet", "--runs", "2"], { encoding: "utf8" });
    let v = runSelf();
    const got = (v.stdout || "").trim().split("\n");
    const same = JSON.stringify(got) === JSON.stringify(want);
    console.log(`${same ? "ok" : "fail"}: a synthetic after-cell prints every line`);
    if (!same) { failed++; for (const l of got) console.log(`  got ${l}`); }
    console.log(`${v.status === 1 ? "ok" : "fail"}: the skipped-paid-graders run counts as errored and the cell fails without its -lan1 (exit ${v.status})`);
    if (v.status !== 1) failed++;
    fs.mkdirSync(path.join(results, "sau-syn-agent-sonnet-lan1"));
    v = runSelf();
    const retried = v.status === 0 && (v.stdout || "").includes("retried=true");
    console.log(`${retried ? "ok" : "fail"}: with its -lan1 the cell passes (exit ${v.status})`);
    if (!retried) failed++;
    kept("e-two", [init, { type: "assistant", message: { model: "parent-m", content: [{ type: "tool_use", id: "t9", name: "Agent", input: { subagent_type: "researcher" } }] } }, say("suy luận thôi")]);
    v = runSelf();
    const launch = v.status === 1 && (v.stdout || "").includes("cell=syn-agent-sonnet launch-only base=0 after=1") && (v.stdout || "").includes("retried=true");
    console.log(`${launch ? "ok" : "fail"}: a launch-only researcher call fails the cell even with its -lan1 (exit ${v.status})`);
    if (!launch) failed++;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") process.exit(selfTest());
const o = {};
const take = (flag) => { const i = args.indexOf(flag); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
o.root = take("--root"); o.receipt = take("--receipt"); o.research = take("--research");
const cellsArg = take("--cells"), runsArg = take("--runs"), one = take("--cell"), except = take("--except");
if (runsArg !== undefined) o.runs = Number(runsArg);
const ctx = context(o);
const pick = (list) => { const bad = list.filter((c) => !ctx.cells.includes(c)); if (bad.length) { console.error(`unknown cells: ${bad.join(",")}`); process.exit(2); } return list; };
if (args.includes("--pilots")) process.exit(comparePilots(ctx, except) ? 0 : 1);
const baseOnly = args.includes("--base-only");
const cells = one ? pick([one]) : cellsArg ? pick(cellsArg.split(",").filter(Boolean)) : ctx.cells;
process.exit(compareAll(ctx, cells, baseOnly) ? 0 : 1);
