#!/usr/bin/env node
// Lưu bằng chứng của từng lượt develop để chấm lại được sau này (gói develop-substitution, plan D-03, D-04): với mỗi
// lượt có tracePath, thư mục giữ lại là dirname(dirname(tracePath)) và workspace là thư mục `home/cwd` đầu tiên bên dưới
// (bố cục thật: sealed/home/cwd). Ghi evals/results/develop/_saved/<ô>.txt: dòng đầu mang sha256 của result.json, rồi mỗi
// `### run <n>` có skill=, init-skill=, skill-tool=, cap=, error=, file task cuối, src/greet.js và câu trả lời cuối.
//   node evals/develop/save-runs.mjs [--require-loaded] [--require-clean <n>] <ô>...     ghi và in một dòng mỗi ô
//   node evals/develop/save-runs.mjs --check-saved [--require-loaded] [--require-clean <n>] <ô>...
//                                                    chỉ đọc file đã lưu và result.json, không cần thư mục giữ lại
//   node evals/develop/save-runs.mjs --kept <ô>      in tên các thư mục giữ lại (để nén)
//   node evals/develop/save-runs.mjs --self-test
// Một ô có <ô>-lan1 thì dùng <ô>-lan1. Thoát 1 khi một lượt thiếu trace hay workspace, file đã lưu thiếu hay cũ, hoặc
// một yêu cầu --require-* không đạt.
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const TASK = "specs/doi-loi-chao/task-01-doi-loi-chao.md";
const SKILL_HEADING = "# Develop — implement, prove, synchronize";
const TIMEOUT_SECONDS = 1200;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

export const resolveCell = (dir) => (fs.existsSync(`${dir}-lan1`) ? `${dir}-lan1` : dir);
const savedPath = (dir) => path.join(path.dirname(dir), "_saved", `${path.basename(dir)}.txt`);

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
const textOf = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : x.text || "")).join("\n") : "");

export function readRun(run) {
  if (!run.tracePath || !fs.existsSync(run.tracePath)) return { error: "no trace" };
  const kept = path.dirname(path.dirname(run.tracePath));
  spawnSync("chmod", ["-R", "u+rwX", kept]);
  const events = fs.readFileSync(run.tracePath, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const ws = findWorkspace(kept);
  if (!ws) return { error: "no workspace" };
  // A slash command can expand the skill without a Skill call; the session transcript then holds the meta record.
  const transcripts = [];
  const walk = (d) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const q = path.join(d, e.name); if (e.isDirectory()) walk(q); else if (e.name.endsWith(".jsonl") && q.includes(`${path.sep}projects${path.sep}`)) transcripts.push(q); } };
  walk(kept);
  const init = events.find((e) => e.type === "system" && e.subtype === "init") || {};
  const initSkill = (init.skills || []).some((s) => /(^|:)develop$/.test(String(s)));
  const skillTool = (init.tools || []).includes("Skill");
  const results = new Map();
  let answer = "", heading = false, skillCall = false, resultSubtype = "none";
  const calls = [];
  for (const e of events) {
    const c = e.message?.content;
    if (e.type === "result") resultSubtype = String(e.subtype || "none");
    if (e.type === "assistant" && !e.parent_tool_use_id && Array.isArray(c)) {
      const t = c.filter((b) => b.type === "text").map((b) => b.text);
      if (t.length) answer = t.join("\n");
      for (const b of c) if (b.type === "tool_use" && b.name === "Skill" && /(^|:)develop$/.test(String(b.input?.skill || ""))) calls.push(b.id);
    }
    if (e.type === "user") {
      if (textOf(c).includes(SKILL_HEADING)) heading = true;
      if (Array.isArray(c)) for (const b of c) if (b.type === "tool_result") {
        results.set(b.tool_use_id, b);
        if (textOf(b.content).includes(SKILL_HEADING)) heading = true;
      }
    }
  }
  for (const id of calls) { const r = results.get(id); if (r && r.is_error !== true) skillCall = true; }
  for (const t of transcripts) { try { if (fs.readFileSync(t, "utf8").includes(SKILL_HEADING)) heading = true; } catch { /* unreadable adds nothing */ } }
  const read = (rel) => { try { return fs.readFileSync(path.join(ws, rel), "utf8"); } catch { return "(missing)"; } };
  // turns in result.json is not the max_turns counter (specs/develop-efficiency); the trace's result event is.
  const cap = resultSubtype === "error_max_turns" || (run.durationSeconds || 0) >= TIMEOUT_SECONDS;
  return { kept: path.basename(kept), loaded: initSkill && (skillCall || heading), initSkill, skillTool, cap, result: resultSubtype, turns: run.turns || 0, task: read(TASK), greet: read("src/greet.js"), answer };
}

function loadResult(dir) {
  const file = path.join(dir, "result.json");
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  return { r: JSON.parse(bytes.toString("utf8")), hash: sha(bytes) };
}

function requirements(dir, r, facts, opts, say) {
  let bad = 0;
  const runs = r.cases?.[0]?.arms?.with || [];
  if (opts.requireLoaded && facts.some((f) => !f.loaded)) { say(`${dir}: a run did not load the skill`); bad++; }
  if (opts.requireClean !== null) {
    const clean = runs.filter((x) => !x.error).length;
    if (r.partial || clean < opts.requireClean) { say(`${dir}: ${clean} clean runs (want ${opts.requireClean})${r.partial ? ", partial" : ""}`); bad++; }
  }
  return bad;
}

export function save(cells, opts = {}) {
  const o = { requireLoaded: false, requireClean: null, ...opts };
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  for (const raw of cells) {
    const dir = resolveCell(raw), res = loadResult(dir);
    if (!res) { say(`${dir}: no result.json`); bad++; continue; }
    const runs = res.r.cases?.[0]?.arms?.with || [];
    const facts = [], out = [`# result.json sha256=${res.hash}`];
    for (const [i, run] of runs.entries()) {
      const x = readRun(run);
      if (x.error) { say(`${dir}: run ${i + 1}: ${x.error}`); bad++; facts.push({ loaded: false }); out.push(`### run ${i + 1}`, `skill=none cap=no error=yes missing=${x.error.replace(/ /g, "-")}`, "--- task", "", "--- greet", "", "--- answer", ""); continue; }
      facts.push(x);
      out.push(`### run ${i + 1}`, `skill=${x.loaded ? "loaded" : "none"} init-skill=${x.initSkill ? "yes" : "no"} skill-tool=${x.skillTool ? "yes" : "no"} cap=${x.cap ? "yes" : "no"} result=${x.result} turns=${x.turns} error=${run.error ? "yes" : "no"} kept=${x.kept}`,
        "--- task", x.task, "--- greet", x.greet, "--- answer", x.answer);
    }
    const target = savedPath(dir);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const text = out.join("\n") + "\n";
    fs.writeFileSync(target, text);
    bad += requirements(dir, res.r, facts, o, say);
    const loaded = facts.filter((f) => f.loaded).length, capped = facts.filter((f) => f.cap).length;
    say(`${path.basename(dir)} runs=${runs.length} errors=${runs.filter((x) => x.error).length} skill=loaded:${loaded},none:${runs.length - loaded} cap=${capped} saved=${target} sha256=${sha(Buffer.from(text))}`);
  }
  return { lines, bad };
}

export function parseSaved(text) {
  return text.split(/^### run \d+$/m).slice(1).map((s) => {
    const meta = s.split("\n")[1] || "";
    const field = (k) => (meta.match(new RegExp(`${k}=(\\S+)`)) || [])[1];
    const part = (k) => { const m = s.match(new RegExp(`--- ${k}\\n([\\s\\S]*?)(?=\\n--- |$)`)); return m ? m[1] : ""; };
    return { loaded: field("skill") === "loaded", cap: field("cap") === "yes", error: field("error") === "yes", task: part("task"), greet: part("greet"), answer: part("answer") };
  });
}

export function checkSaved(cells, opts = {}) {
  const o = { requireLoaded: false, requireClean: null, ...opts };
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  for (const raw of cells) {
    const dir = resolveCell(raw), res = loadResult(dir), target = savedPath(dir);
    if (!res || !fs.existsSync(target)) { say(`${dir}: missing ${res ? target : "result.json"}`); bad++; continue; }
    const text = fs.readFileSync(target, "utf8");
    if (!text.startsWith(`# result.json sha256=${res.hash}\n`)) { say(`${dir}: saved file is stale for its result.json`); bad++; continue; }
    const facts = parseSaved(text);
    const runs = res.r.cases?.[0]?.arms?.with || [];
    if (facts.length !== runs.length) { say(`${dir}: saved file has ${facts.length} runs, result.json ${runs.length}`); bad++; continue; }
    bad += requirements(dir, res.r, facts, o, say);
    say(`${path.basename(dir)} saved ok runs=${facts.length} skill=loaded:${facts.filter((f) => f.loaded).length}`);
  }
  return { lines, bad };
}

export function keptOf(cell) {
  const res = loadResult(resolveCell(cell));
  return (res?.r.cases?.[0]?.arms?.with || []).filter((x) => x.tracePath).map((x) => path.basename(path.dirname(path.dirname(x.tracePath))));
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "develop-save-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: save-runs self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  try {
    const res = path.join(root, "results");
    const mkRun = (name, { skill = true, heading = true, turns = 12, call = null, subtype = "success", duration = 60, workspace = true, transcript = false } = {}) => {
      const k = path.join(root, "tmp", name), ws = path.join(k, "sealed", "home", "cwd");
      fs.mkdirSync(path.join(k, "out"), { recursive: true });
      if (workspace) { fs.mkdirSync(path.join(ws, ".git"), { recursive: true }); fs.mkdirSync(path.join(ws, "specs", "doi-loi-chao"), { recursive: true }); fs.mkdirSync(path.join(ws, "src"), { recursive: true }); }
      if (transcript) { const t = path.join(k, "sealed", "config", "projects", "p"); fs.mkdirSync(t, { recursive: true }); fs.writeFileSync(path.join(t, "s.jsonl"), JSON.stringify({ isMeta: true, message: { content: `Base directory for this skill: x\n${SKILL_HEADING}` } }) + "\n"); }
      if (!workspace) { fs.writeFileSync(path.join(k, "out", "trace.jsonl"), "{}\n"); return { tracePath: path.join(k, "out", "trace.jsonl"), turns, durationSeconds: duration }; }
      fs.writeFileSync(path.join(ws, TASK), "Status: blocked\n"); fs.writeFileSync(path.join(ws, "src", "greet.js"), "x\n");
      const ev = [{ type: "system", subtype: "init", skills: skill ? ["cafekit-develop:develop"] : [], tools: ["Skill", "Bash"] }];
      if (heading) ev.push({ type: "user", message: { content: `${SKILL_HEADING}\nbody` } });
      if (call) { ev.push({ type: "assistant", message: { content: [{ type: "tool_use", id: "s1", name: "Skill", input: { skill: "cafekit-develop:develop" } }] } }); ev.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "s1", is_error: call === "error", content: "Launching skill" }] } }); }
      ev.push({ type: "assistant", message: { content: [{ type: "text", text: "Blocked: node --test test/" }] } });
      ev.push({ type: "assistant", parent_tool_use_id: "sub1", message: { content: [{ type: "text", text: "SUBAGENT TEXT" }] } });
      ev.push({ type: "result", subtype });
      fs.writeFileSync(path.join(k, "out", "trace.jsonl"), ev.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return { tracePath: path.join(k, "out", "trace.jsonl"), turns, durationSeconds: duration };
    };
    const cell = (name, runs, partial = false) => { const d = path.join(res, name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ partial, cases: [{ arms: { with: runs } }] })); return d; };
    const a = cell("v3-x-hong-sonnet", [mkRun("e-a1"), mkRun("e-a2", { turns: 33, subtype: "error_max_turns" }), mkRun("e-a3", { turns: 33 }), mkRun("e-a4", { duration: 1200 })]);
    let r = save([a]);
    const saved = fs.readFileSync(savedPath(a), "utf8");
    check("a sealed/home/cwd workspace is found and saved", r.bad === 0 && saved.includes("--- task\nStatus: blocked") && saved.includes("skill=loaded"), r.lines.join("\n"));
    check("the answer is the parent's last text, not a subagent's", saved.includes("--- answer\nBlocked: node --test test/") && !saved.includes("SUBAGENT TEXT"), saved);
    check("a run whose trace ends with error_max_turns is marked cap=yes", /### run 2\nskill=loaded [^\n]*cap=yes/.test(saved), saved);
    check("turns above 30 alone is not a cap", /### run 3\nskill=loaded [^\n]*cap=no/.test(saved), saved);
    check("a run at the timeout is marked cap=yes", /### run 4\nskill=loaded [^\n]*cap=yes/.test(saved), saved);
    r = checkSaved([a], { requireLoaded: true, requireClean: 4 });
    check("--check-saved reads the saved file without kept directories", r.bad === 0, r.lines.join("\n"));
    const b = cell("v3-x-hong-opus", [mkRun("e-b1", { skill: false })]);
    r = save([b], { requireLoaded: true });
    check("--require-loaded fails a run whose init lacks the skill", r.bad === 1, r.lines.join("\n"));
    const c = cell("v3-x-sach-sonnet", [mkRun("e-c1", { heading: false })]);
    r = save([c], { requireLoaded: true });
    check("a run with neither a Skill call nor the skill heading is not loaded", r.bad === 1, r.lines.join("\n"));
    r = save([cell("v3-x-call-sonnet", [mkRun("e-f1", { heading: false, call: "ok" })])], { requireLoaded: true });
    check("a successful Skill call without the heading counts as loaded", r.bad === 0, r.lines.join("\n"));
    r = save([cell("v3-x-callerr-sonnet", [mkRun("e-g1", { heading: false, call: "error" })])], { requireLoaded: true });
    check("a Skill call that returns an error does not count as loaded", r.bad === 1, r.lines.join("\n"));
    r = save([cell("v3-x-meta-sonnet", [mkRun("e-h1", { heading: false, transcript: true })])], { requireLoaded: true });
    check("the skill heading in the session transcript counts as loaded", r.bad === 0, r.lines.join("\n"));
    const ng = mkRun("e-j1"); fs.rmSync(path.join(root, "tmp", "e-j1", "sealed", "home", "cwd", ".git"), { recursive: true });
    r = save([cell("v3-x-nogit-sonnet", [ng])]);
    check("a home/cwd without .git is not taken as the workspace", r.bad === 1 && r.lines.join("\n").includes("no workspace"), r.lines.join("\n"));
    const nw = cell("v3-x-nows2-sonnet", [mkRun("e-i1"), mkRun("e-i2", { workspace: false })]);
    r = save([nw]);
    check("a run with a trace but no workspace fails and keeps its section", r.bad === 1 && r.lines.join("\n").includes("no workspace") && (fs.readFileSync(savedPath(nw), "utf8").match(/^### run \d+$/gm) || []).length === 2, r.lines.join("\n"));
    const d = cell("v3-x-sach-opus", [mkRun("e-d1")], true);
    r = save([d], { requireClean: 1 });
    check("--require-clean fails a partial cell", r.bad === 1, r.lines.join("\n"));
    const e = cell("v3-x-lan-sonnet", [{ tracePath: "/nonexistent" }]); cell("v3-x-lan-sonnet-lan1", [mkRun("e-e1")]);
    r = save([e]);
    check("a cell with -lan1 is read from -lan1", r.bad === 0 && r.lines.join("\n").includes("v3-x-lan-sonnet-lan1"), r.lines.join("\n"));
    const shortSaved = fs.readFileSync(savedPath(a), "utf8").replace(/### run 4[\s\S]*$/, "");
    const hdr = shortSaved.split("\n")[0];
    fs.writeFileSync(savedPath(a), shortSaved);
    r = checkSaved([a]);
    check("--check-saved refuses a saved file with fewer runs than result.json", r.bad === 1 && r.lines.join("\n").includes("saved file has 3 runs"), r.lines.join("\n") + hdr);
    fs.writeFileSync(path.join(a, "result.json"), JSON.stringify({ partial: false, cases: [{ arms: { with: [] } }] }));
    r = checkSaved([a]);
    check("--check-saved refuses a saved file older than its result.json", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    r = save([cell("v3-x-nows-sonnet", [{ tracePath: path.join(root, "nope", "out", "trace.jsonl") }])]);
    check("a run without a trace fails", r.bad === 1, r.lines.join("\n"));
    check("--kept lists kept directory names", keptOf(path.join(res, "v3-x-sach-sonnet")).join() === "e-c1");
    const cli = (args) => spawnSync(process.execPath, [SELF, ...args], { encoding: "utf8" }).status;
    check("--require-clean without a number, an unknown flag or no cell exits 2", cli(["--require-clean", "abc", a]) === 2 && cli(["--check-save", a]) === 2 && cli(["--require-loaded"]) === 2);
  } finally { spawnSync("chmod", ["-R", "u+rwX", root]); fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  if (args[0] === "--kept") { const k = keptOf(args[1]); if (!k.length) process.exit(1); console.log(k.join("\n")); process.exit(0); }
  const opts = { requireLoaded: args.includes("--require-loaded"), requireClean: null };
  const rc = args.indexOf("--require-clean");
  if (rc >= 0) { opts.requireClean = Number(args[rc + 1]); if (!Number.isInteger(opts.requireClean) || opts.requireClean < 1) { console.error("--require-clean needs a whole number of runs"); process.exit(2); } }
  const unknown = args.filter((a) => a.startsWith("--") && !["--require-loaded", "--require-clean", "--check-saved"].includes(a));
  const cells = args.filter((a, i) => !a.startsWith("--") && !(rc >= 0 && i === rc + 1));
  if (unknown.length || !cells.length) { console.error(`usage: save-runs.mjs [--check-saved] [--require-loaded] [--require-clean <n>] <cell>...${unknown.length ? ` (unknown ${unknown.join(" ")})` : ""}`); process.exit(2); }
  const r = args.includes("--check-saved") ? checkSaved(cells, opts) : save(cells, opts);
  for (const l of r.lines) console.log(l);
  process.exit(r.bad ? 1 : 0);
}
