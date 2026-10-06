#!/usr/bin/env node
// Lưu bằng chứng của từng lượt cf:ask để chấm lại được sau này (gói ask-eval-baseline, plan D-03; chép từ evals/test): với
// mỗi lượt có tracePath, thư mục giữ lại là dirname(dirname(tracePath)) và workspace là thư mục `home/cwd` đầu tiên bên dưới
// có .git (bố cục thật: sealed/home/cwd). Ghi evals/results/ask/_saved/<ô>.txt: dòng đầu mang sha256 của result.json, rồi
// mỗi `### run <n>` có skill=, init-skill=, skill-tool=, cap=, error=, README.md, src/config.js, src/greet.js, src/server.js,
// test/greet.test.js, package.json, `git status --porcelain` của workspace và câu trả lời cuối.
//   node evals/ask/save-runs.mjs [--require-loaded] [--require-clean <n>] [--min-loaded <n>] <ô>...   ghi, một dòng mỗi ô
//   node evals/ask/save-runs.mjs --check-saved [--require-loaded] [--require-clean <n>] [--min-loaded <n>] <ô>...
//                                                    chỉ đọc file đã lưu và result.json, không cần thư mục giữ lại
//   node evals/ask/save-runs.mjs --kept <ô>         in tên các thư mục giữ lại (để nén)
//   node evals/ask/save-runs.mjs --self-test
// Một ô có <ô>-lan1 thì dùng <ô>-lan1. Thoát 1 khi một lượt mất trace, workspace hay git status, file đã lưu thiếu hay cũ,
// hoặc một yêu cầu --require-*/--min-loaded không đạt.
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const SKILL_HEADING = "# Ask Skill";
const SKILL_NAME = /(^|:)ask$/;
const TIMEOUT_SECONDS = 600;
// Saved in this order; each becomes a `--- <name>` part of the run section.
// An absent file is saved as "(missing)".
const FILES = [["readme", "README.md"], ["config", "src/config.js"], ["greet", "src/greet.js"], ["server", "src/server.js"], ["test", "test/greet.test.js"], ["package", "package.json"]];
const PARTS = [...FILES.map(([k]) => k), "status", "answer"];
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
// A saved line that could read as a run or part marker gets one leading backslash, as does one that already starts with
// a backslash; parseSaved strips exactly one, so an answer quoting `### run 5` or `--- task` keeps its bytes.
const MARKER = new RegExp(`^(?:\\\\|### run \\d+$|--- (?:${PARTS.join("|")})$)`);
const escape = (text) => String(text).split("\n").map((l) => (MARKER.test(l) ? `\\${l}` : l)).join("\n");
const unescape = (text) => text.split("\n").map((l) => (l.startsWith("\\") ? l.slice(1) : l)).join("\n");

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
  if (!run.tracePath) return { error: "no trace" };
  // The kept directory is sealed (mode 000): open it before looking for the trace inside it.
  const kept = path.dirname(path.dirname(run.tracePath));
  if (fs.existsSync(kept)) spawnSync("chmod", ["-R", "u+rwX", kept]);
  if (!fs.existsSync(run.tracePath)) return { error: "no trace" };
  const events = fs.readFileSync(run.tracePath, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const ws = findWorkspace(kept);
  if (!ws) return { error: "no workspace" };
  // A slash command can expand the skill without a Skill call; the session transcript then holds the meta record.
  const transcripts = [];
  const walk = (d) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const q = path.join(d, e.name); if (e.isDirectory()) walk(q); else if (e.name.endsWith(".jsonl") && q.includes(`${path.sep}projects${path.sep}`)) transcripts.push(q); } };
  walk(kept);
  const init = events.find((e) => e.type === "system" && e.subtype === "init") || {};
  const initSkill = (init.skills || []).some((s) => SKILL_NAME.test(String(s)));
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
      for (const b of c) if (b.type === "tool_use" && b.name === "Skill" && SKILL_NAME.test(String(b.input?.skill || ""))) calls.push(b.id);
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
  // GIT_OPTIONAL_LOCKS=0 keeps git from refreshing the kept workspace's index while it reads it.
  const git = spawnSync("git", ["-C", ws, "status", "--porcelain"], { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  if (git.status !== 0) return { error: `git status failed: ${String(git.stderr || git.error || "").trim().split("\n")[0]}` };
  const status = git.stdout.replace(/\n$/, "");
  // turns in result.json is not the max_turns counter (specs/develop-efficiency); the trace's result event is.
  const cap = resultSubtype === "error_max_turns" || (run.durationSeconds || 0) >= TIMEOUT_SECONDS;
  return { kept: path.basename(kept), loaded: initSkill && (skillCall || heading), initSkill, skillTool, cap, result: resultSubtype, turns: run.turns || 0, ...Object.fromEntries(FILES.map(([k, rel]) => [k, read(rel)])), status, answer };
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
  // A run whose trace, workspace or git status was lost before saving is unreadable proof; D-06 re-runs such a cell.
  const lost = facts.map((f, i) => (f.error ? i + 1 : 0)).filter(Boolean);
  if (lost.length) { say(`${dir}: runs ${lost.join(",")} lost their trace or workspace before saving`); bad++; }
  if (opts.requireLoaded && facts.some((f) => !f.loaded)) { say(`${dir}: a run did not load the skill`); bad++; }
  const loaded = facts.filter((f) => f.loaded).length;
  if (opts.minLoaded !== null && loaded < opts.minLoaded) { say(`${dir}: ${loaded} runs loaded the skill (want at least ${opts.minLoaded})`); bad++; }
  if (opts.requireClean !== null) {
    const clean = runs.filter((x) => !x.error).length;
    if (r.partial || clean < opts.requireClean) { say(`${dir}: ${clean} clean runs (want ${opts.requireClean})${r.partial ? ", partial" : ""}`); bad++; }
  }
  return bad;
}

const DEFAULTS = { requireLoaded: false, requireClean: null, minLoaded: null };

export function save(cells, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  for (const raw of cells) {
    const dir = resolveCell(raw), res = loadResult(dir);
    if (!res) { say(`${dir}: no result.json`); bad++; continue; }
    const runs = res.r.cases?.[0]?.arms?.with || [];
    const facts = [], out = [`# result.json sha256=${res.hash}`];
    for (const [i, run] of runs.entries()) {
      const x = readRun(run);
      if (x.error) { say(`${dir}: run ${i + 1}: ${x.error}`); facts.push({ loaded: false, error: true }); out.push(`### run ${i + 1}`, `skill=none cap=no error=yes missing=${x.error.replace(/\s+/g, "-")}`, ...PARTS.flatMap((k) => [`--- ${k}`, ""])); continue; }
      facts.push(x);
      out.push(`### run ${i + 1}`, `skill=${x.loaded ? "loaded" : "none"} init-skill=${x.initSkill ? "yes" : "no"} skill-tool=${x.skillTool ? "yes" : "no"} cap=${x.cap ? "yes" : "no"} result=${x.result} turns=${x.turns} error=${run.error ? "yes" : "no"} kept=${x.kept}`,
        ...PARTS.flatMap((k) => [`--- ${k}`, escape(x[k])]));
    }
    const target = savedPath(dir);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const text = out.join("\n") + "\n";
    fs.writeFileSync(target, text);
    bad += requirements(dir, res.r, facts, o, say);
    const loaded = facts.filter((f) => f.loaded).length, capped = facts.filter((f) => f.cap).length;
    say(`${path.basename(dir)} runs=${runs.length} errors=${runs.filter((x) => x.error).length} skill=loaded:${loaded},none:${facts.filter((f) => !f.loaded && !f.error).length} lost=${facts.filter((f) => f.error).length} cap=${capped} saved=${target} sha256=${sha(Buffer.from(text))}`);
  }
  return { lines, bad };
}

export function parseSaved(text) {
  // No m flag: a JavaScript multiline `^`/`$` also breaks at \r, U+2028 and U+2029, which escape() does not split on.
  return text.split(/(?:^|\n)### run \d+(?=\n|$)/).slice(1).map((s) => {
    const meta = s.split("\n")[1] || "";
    const field = (k) => (meta.match(new RegExp(`${k}=(\\S+)`)) || [])[1];
    const part = (k) => { const m = s.match(new RegExp(`\\n--- ${k}\\n([\\s\\S]*?)(?=\\n--- (?:${PARTS.join("|")})\\n|\\n?$)`)); return m ? unescape(m[1]) : ""; };
    return { loaded: field("skill") === "loaded", cap: field("cap") === "yes", error: field("error") === "yes" && field("missing") !== undefined, runError: field("error") === "yes", ...Object.fromEntries(PARTS.map((k) => [k, part(k)])) };
  });
}

export function checkSaved(cells, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  for (const raw of cells) {
    const dir = resolveCell(raw), res = loadResult(dir), target = savedPath(dir);
    if (!res || !fs.existsSync(target)) { say(`${dir}: missing ${res ? target : "result.json"}`); bad++; continue; }
    const text = fs.readFileSync(target, "utf8");
    if (!text.startsWith(`# result.json sha256=${res.hash}\n`)) { say(`${dir}: saved file is stale for its result.json`); bad++; continue; }
    const facts = parseSaved(text);
    const runs = res.r.cases?.[0]?.arms?.with || [];
    if (facts.length !== runs.length) { say(`${dir}: saved file has ${facts.length} runs, result.json ${runs.length}`); bad++; continue; }
    const b = requirements(dir, res.r, facts, o, say);
    bad += b;
    say(`${path.basename(dir)} ${b ? "saved but refused" : "saved ok"} runs=${facts.length} skill=loaded:${facts.filter((f) => f.loaded).length}`);
  }
  return { lines, bad };
}

export function keptOf(cell) {
  const res = loadResult(resolveCell(cell));
  return (res?.r.cases?.[0]?.arms?.with || []).filter((x) => x.tracePath).map((x) => path.basename(path.dirname(path.dirname(x.tracePath))));
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ask-save-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: save-runs self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  // An answer quoting run and part markers, and a line already starting with a backslash.
  const ANSWER = "**Answer**\nCổng 8080\n### run 5\n--- readme\n\\escaped\n--- not a part\n### run 6\r\nx\r### run 7\ry\u2028### run 9\u2028z";
  try {
    const res = path.join(root, "results");
    const mkRun = (name, { skill = true, heading = true, turns = 12, call = null, callName = "cf:ask", initName = "cf:ask", subtype = "success", duration = 60, workspace = true, transcript = false } = {}) => {
      const k = path.join(root, "tmp", name), ws = path.join(k, "sealed", "home", "cwd");
      fs.mkdirSync(path.join(k, "out"), { recursive: true });
      if (transcript) { const t = path.join(k, "sealed", "config", "projects", "p"); fs.mkdirSync(t, { recursive: true }); fs.writeFileSync(path.join(t, "s.jsonl"), JSON.stringify({ isMeta: true, message: { content: `Base directory for this skill: x\n${SKILL_HEADING}` } }) + "\n"); }
      if (!workspace) { fs.writeFileSync(path.join(k, "out", "trace.jsonl"), "{}\n"); return { tracePath: path.join(k, "out", "trace.jsonl"), turns, durationSeconds: duration }; }
      for (const d of ["src", "test"]) fs.mkdirSync(path.join(ws, d), { recursive: true });
      spawnSync("git", ["init", "-q", ws]);
      for (const [key, rel] of FILES) fs.writeFileSync(path.join(ws, rel), `${key} bytes\n`);
      const ev = [{ type: "system", subtype: "init", skills: skill ? [initName] : [], tools: ["Skill", "Bash"] }];
      if (heading) ev.push({ type: "user", message: { content: `${SKILL_HEADING}\nbody` } });
      if (call) { ev.push({ type: "assistant", message: { content: [{ type: "tool_use", id: "s1", name: "Skill", input: { skill: callName } }] } }); ev.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "s1", is_error: call === "error", content: "Launching skill" }] } }); }
      ev.push({ type: "assistant", message: { content: [{ type: "text", text: ANSWER }] } });
      ev.push({ type: "assistant", parent_tool_use_id: "sub1", message: { content: [{ type: "text", text: "SUBAGENT TEXT" }] } });
      ev.push({ type: "result", subtype });
      fs.writeFileSync(path.join(k, "out", "trace.jsonl"), ev.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return { tracePath: path.join(k, "out", "trace.jsonl"), turns, durationSeconds: duration };
    };
    const cell = (name, runs, partial = false) => { const d = path.join(res, name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ partial, cases: [{ arms: { with: runs } }] })); return d; };
    const a = cell("x-hoi-lai-sonnet", [mkRun("e-a1"), mkRun("e-a2", { turns: 33, subtype: "error_max_turns" }), mkRun("e-a3", { turns: 33 }), mkRun("e-a4", { duration: 600 })]);
    let r = save([a]);
    const saved = fs.readFileSync(savedPath(a), "utf8");
    check("a sealed/home/cwd workspace is found and saved", r.bad === 0 && saved.includes("--- readme\nreadme bytes") && saved.includes("skill=loaded"), r.lines.join("\n"));
    check("README.md, src/config.js, src/greet.js, src/server.js, test/greet.test.js and package.json are saved", ["readme", "config", "greet", "server", "test", "package"].every((k) => saved.includes(`--- ${k}\n${k} bytes\n`)), saved);
    check("the workspace's git status --porcelain is saved", /--- status\n\?\? README\.md\n/.test(saved), saved);
    const parsed = parseSaved(saved)[0];
    const ab = mkRun("e-ab"); fs.rmSync(path.join(root, "tmp", "e-ab", "sealed", "home", "cwd", "src/server.js"));
    const absCell = cell("x-absent-sonnet", [ab]); save([absCell]);
    const abs = parseSaved(fs.readFileSync(savedPath(absCell), "utf8"))[0];
    check("an absent src/server.js is saved as (missing) and round-trips", abs.server === "(missing)" && parsed.server === "server bytes\n", JSON.stringify(abs));
    check("parseSaved returns every part and keeps an answer quoting `### run 5`, `--- readme`, a backslash line, CRLF, a lone \\r and U+2028", parsed.test === "test bytes\n" && parsed.status.includes("?? src/") && parsed.answer === ANSWER && parseSaved(saved).length === 4, JSON.stringify(parsed));
    check("the answer is the parent's last text, not a subagent's", !saved.includes("SUBAGENT TEXT"), saved);
    check("a run whose trace ends with error_max_turns is marked cap=yes", /### run 2\nskill=loaded [^\n]*cap=yes/.test(saved), saved);
    check("turns above 30 alone is not a cap", /### run 3\nskill=loaded [^\n]*cap=no/.test(saved), saved);
    check("a run at the 600 s timeout is marked cap=yes", /### run 4\nskill=loaded [^\n]*cap=yes/.test(saved), saved);
    r = checkSaved([a], { requireLoaded: true, requireClean: 4 });
    check("--check-saved reads the saved file without kept directories", r.bad === 0 && r.lines.join("\n").includes("saved ok"), r.lines.join("\n"));
    r = save([cell("x-cam-sua-opus", [mkRun("e-b1", { skill: false })])], { requireLoaded: true });
    check("--require-loaded fails a run whose init lacks the skill", r.bad === 1, r.lines.join("\n"));
    const m = cell("x-sach-sonnet-min", [mkRun("e-m1"), mkRun("e-m2", { skill: false }), mkRun("e-m3", { heading: false })]);
    r = save([m], { minLoaded: 2 });
    check("--min-loaded 2 fails a cell with one loaded run", r.bad === 1 && r.lines.join("\n").includes("1 runs loaded the skill (want at least 2)"), r.lines.join("\n"));
    r = checkSaved([m], { minLoaded: 1 });
    check("--min-loaded 1 passes it, from the saved file", r.bad === 0, r.lines.join("\n"));
    r = checkSaved([m], { minLoaded: 2 });
    check("a refused --check-saved never prints `saved ok`", r.bad === 1 && r.lines.join("\n").includes("saved but refused") && !r.lines.join("\n").includes("saved ok"), r.lines.join("\n"));
    r = save([cell("x-sach-sonnet", [mkRun("e-c1", { heading: false })])], { requireLoaded: true });
    check("a run with neither a Skill call nor the skill heading is not loaded", r.bad === 1, r.lines.join("\n"));
    r = save([cell("x-call-sonnet", [mkRun("e-f1", { heading: false, call: "ok" })])], { requireLoaded: true });
    check("a successful Skill call without the heading counts as loaded", r.bad === 0, r.lines.join("\n"));
    r = save([cell("x-calltest-sonnet", [mkRun("e-t1", { heading: false, call: "ok", callName: "cf:test" })])], { requireLoaded: true });
    check("a Skill call naming cf:test does not count as loading cf:ask", r.bad === 1, r.lines.join("\n"));
    r = save([cell("x-inittest-sonnet", [mkRun("e-t2", { skill: false })])], { requireLoaded: true });
    check("an init listing no skill is not loaded even with the heading", r.bad === 1, r.lines.join("\n"));
    r = save([cell("x-initother-sonnet", [mkRun("e-t3", { skill: true, initName: "cf:test" })])], { requireLoaded: true });
    check("an init listing only cf:test is not loaded even with the heading", r.bad === 1, r.lines.join("\n"));
    r = save([cell("x-callerr-sonnet", [mkRun("e-g1", { heading: false, call: "error" })])], { requireLoaded: true });
    check("a Skill call that returns an error does not count as loaded", r.bad === 1, r.lines.join("\n"));
    r = save([cell("x-meta-sonnet", [mkRun("e-h1", { heading: false, transcript: true })])], { requireLoaded: true });
    check("the skill heading in the session transcript counts as loaded (slash expansion)", r.bad === 0, r.lines.join("\n"));
    const ng = mkRun("e-j1"); fs.rmSync(path.join(root, "tmp", "e-j1", "sealed", "home", "cwd", ".git"), { recursive: true, force: true });
    r = save([cell("x-nogit-sonnet", [ng])]);
    check("a home/cwd without .git is not taken as the workspace", r.bad === 1 && r.lines.join("\n").includes("no workspace"), r.lines.join("\n"));
    const nw = cell("x-nows2-sonnet", [mkRun("e-i1"), mkRun("e-i2", { workspace: false })]);
    r = save([nw]);
    check("a run with a trace but no workspace fails and keeps its section", r.bad === 1 && r.lines.join("\n").includes("no workspace") && parseSaved(fs.readFileSync(savedPath(nw), "utf8")).length === 2, r.lines.join("\n"));
    r = checkSaved([nw], { requireClean: 2, minLoaded: 1 });
    check("--check-saved fails a cell whose saved file holds a run lost before saving", r.bad === 1 && r.lines.join("\n").includes("runs 2 lost their trace or workspace"), r.lines.join("\n"));
    const ge = mkRun("e-k1"); fs.writeFileSync(path.join(root, "tmp", "e-k1", "sealed", "home", "cwd", ".git", "HEAD"), "garbage\n");
    r = save([cell("x-badgit-sonnet", [ge])]);
    check("a workspace whose git status fails is a lost run", r.bad === 1 && r.lines.join("\n").includes("git status failed"), r.lines.join("\n"));
    r = save([cell("x-sach-opus", [mkRun("e-d1")], true)], { requireClean: 1 });
    check("--require-clean fails a partial cell", r.bad === 1, r.lines.join("\n"));
    const e = cell("x-lan-sonnet", [{ tracePath: "/nonexistent" }]); cell("x-lan-sonnet-lan1", [mkRun("e-e1")]);
    r = save([e]);
    check("a cell with -lan1 is read from -lan1", r.bad === 0 && r.lines.join("\n").includes("x-lan-sonnet-lan1"), r.lines.join("\n"));
    fs.writeFileSync(savedPath(a), fs.readFileSync(savedPath(a), "utf8").replace(/### run 4[\s\S]*$/, ""));
    r = checkSaved([a]);
    check("--check-saved refuses a saved file with fewer runs than result.json", r.bad === 1 && r.lines.join("\n").includes("saved file has 3 runs"), r.lines.join("\n"));
    fs.writeFileSync(path.join(a, "result.json"), JSON.stringify({ partial: false, cases: [{ arms: { with: [] } }] }));
    r = checkSaved([a]);
    check("--check-saved refuses a saved file older than its result.json", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    const sealed = mkRun("e-s1"); fs.chmodSync(path.join(root, "tmp", "e-s1"), 0o000);
    r = save([cell("x-sealed-sonnet", [sealed])], { requireLoaded: true });
    check("a kept directory sealed at mode 000 is opened before its trace is looked for", r.bad === 0, r.lines.join("\n"));
    // A stub git first on PATH records the environment it was given, then hands over to the real git.
    const realGit = spawnSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
    const stub = path.join(root, "stub"); fs.mkdirSync(stub);
    fs.writeFileSync(path.join(stub, "git"), `#!/bin/bash\necho "locks=\${GIT_OPTIONAL_LOCKS:-unset}" >> "${path.join(root, "git-env.txt")}"\nexec "${realGit}" "$@"\n`, { mode: 0o755 });
    const locks = cell("x-locks-sonnet", [mkRun("e-l1")]);
    const oldPath = process.env.PATH; process.env.PATH = `${stub}:${oldPath}`;
    try { save([locks]); } finally { process.env.PATH = oldPath; }
    const env = fs.existsSync(path.join(root, "git-env.txt")) ? fs.readFileSync(path.join(root, "git-env.txt"), "utf8") : "";
    check("git status runs with GIT_OPTIONAL_LOCKS=0", env.includes("locks=0") && !env.includes("locks=unset"), env);
    r = save([cell("x-nows-sonnet", [{ tracePath: path.join(root, "nope", "out", "trace.jsonl") }])]);
    check("a run without a trace fails", r.bad === 1, r.lines.join("\n"));
    check("--kept lists kept directory names", keptOf(path.join(res, "x-sach-sonnet")).join() === "e-c1");
    const cli = (args) => spawnSync(process.execPath, [SELF, ...args], { encoding: "utf8" }).status;
    check("--require-clean without a number, --min-loaded 0, an unknown flag or no cell exits 2", cli(["--require-clean", "abc", a]) === 2 && cli(["--min-loaded", "0", a]) === 2 && cli(["--check-save", a]) === 2 && cli(["--require-loaded"]) === 2);
  } finally { spawnSync("chmod", ["-R", "u+rwX", root]); fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

// realpath on both sides: a call through a symlinked path still runs the CLI.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(SELF)) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  if (args[0] === "--kept") { const k = keptOf(args[1]); if (!k.length) process.exit(1); console.log(k.join("\n")); process.exit(0); }
  const opts = { ...DEFAULTS, requireLoaded: args.includes("--require-loaded") };
  const numbered = [["--require-clean", "requireClean"], ["--min-loaded", "minLoaded"]].map(([flag, key]) => {
    const at = args.indexOf(flag);
    if (at >= 0) { opts[key] = Number(args[at + 1]); if (!Number.isInteger(opts[key]) || opts[key] < 1) { console.error(`${flag} needs a whole number of runs`); process.exit(2); } }
    return at;
  });
  const unknown = args.filter((a) => a.startsWith("--") && !["--require-loaded", "--require-clean", "--min-loaded", "--check-saved"].includes(a));
  const cells = args.filter((a, i) => !a.startsWith("--") && !numbered.some((at) => at >= 0 && i === at + 1));
  if (unknown.length || !cells.length) { console.error(`usage: save-runs.mjs [--check-saved] [--require-loaded] [--require-clean <n>] [--min-loaded <n>] <cell>...${unknown.length ? ` (unknown ${unknown.join(" ")})` : ""}`); process.exit(2); }
  const r = args.includes("--check-saved") ? checkSaved(cells, opts) : save(cells, opts);
  for (const l of r.lines) console.log(l);
  process.exit(r.bad ? 1 : 0);
}
