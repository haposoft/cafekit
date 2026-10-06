#!/usr/bin/env node
// Đọc trace giữ lại (--keep-temp) của từng lượt và cho biết skill fix có thật sự được nạp không, và bản nào.
// Một lượt là `loaded` khi một lệnh gọi công cụ Skill có input.skill khớp ^([^:]*:)?fix$ nhận kết quả (cùng
// tool_use_id, không is_error) bắt đầu bằng `Launching skill: ` với tên khớp ^([^:]*:)?fix$, và trace có một message
// mà text bắt đầu bằng `Base directory for this skill: ` với dòng đầu kết thúc bằng `/skills/fix`. Thân skill có
// `<HARD-GATE-RED-BEFORE-FIX>` là bản vá (`sau`), không có là bản gốc (`goc`). Chuỗi HARD-GATE-SCOUT-FIRST không dùng
// được làm dấu: debug cũng có nó.
// Mỗi lượt in một dòng (run đếm từ 1, như evals/fix/verify-run-log.mjs), rồi luôn in một dòng tổng:
//   <dir> run=<i> loaded=<yes|no|no-trace> first-call=<launch|error|none> version=<goc|sau|-> model=<init model>
//   <dir> loaded=<k>/<n> first-launch=<j>/<n> version=<goc|sau|mixed|-> model=<các init model, sắp xếp>
// Thoát 1 chỉ khi một lượt có tracePath mà không đọc được.
//   node evals/fix-s55/skill-loaded.mjs <result dir>...
//   node evals/fix-s55/skill-loaded.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";

const FIX = /^([^:]*:)?fix$/;
const LAUNCH = /^Launching skill: ([^:\s]*:)?fix\s*$/;
const BASE = "Base directory for this skill: ";

const textOf = (content) => typeof content === "string" ? content
  : Array.isArray(content) ? content.map((x) => (typeof x === "string" ? x : x && x.text) || "").join("") : "";

function readRun(run) {
  if (!run.tracePath) return { loaded: "no-trace", first: "none", version: "-", model: "-" };
  let raw;
  try { raw = fs.readFileSync(run.tracePath, "utf8"); } catch { return null; }
  const events = raw.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  const calls = [], results = new Map();
  let skillText = null;
  for (const e of events) {
    const content = e.message && e.message.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (e.type === "assistant" && c.type === "tool_use" && c.name === "Skill") calls.push(c);
      if (e.type === "user" && c.type === "tool_result") results.set(c.tool_use_id, c);
      if (e.type === "user" && c.type === "text" && typeof c.text === "string" && c.text.startsWith(BASE)
        && c.text.split("\n")[0].trimEnd().endsWith("/skills/fix") && skillText === null) skillText = c.text;
    }
  }
  const outcome = (call) => {
    const r = results.get(call.id);
    return r && !r.is_error && textOf(r.content).startsWith("Launching skill: ") ? textOf(r.content) : null;
  };
  const first = calls.length === 0 ? "none" : outcome(calls[0]) ? "launch" : "error";
  const launched = calls.some((c) => c.input && FIX.test(String(c.input.skill || "")) && LAUNCH.test(outcome(c) || ""));
  const loaded = launched && skillText !== null;
  return {
    loaded: loaded ? "yes" : "no",
    first,
    version: loaded ? (skillText.includes("<HARD-GATE-RED-BEFORE-FIX>") ? "sau" : "goc") : "-",
    model: (init && init.model) || "-",
  };
}

// Returns { lines, bad }.
function check(dir) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const runs = result.cases[0].arms.with;
  const lines = [];
  let k = 0, j = 0, bad = 0;
  const versions = new Set(), models = new Set();
  runs.forEach((run, i) => {
    const r = readRun(run);
    if (r === null) {
      lines.push(`${dir} run=${i + 1} loaded=no first-call=none version=- model=- trace-unreadable=${run.tracePath}`);
      bad++;
      return;
    }
    if (r.loaded === "yes") { k++; versions.add(r.version); }
    if (r.first === "launch") j++;
    if (r.model !== "-") models.add(r.model);
    lines.push(`${dir} run=${i + 1} loaded=${r.loaded} first-call=${r.first} version=${r.version} model=${r.model}`);
  });
  const version = versions.size === 0 ? "-" : versions.size === 1 ? [...versions][0] : "mixed";
  lines.push(`${dir} loaded=${k}/${runs.length} first-launch=${j}/${runs.length} version=${version} model=${[...models].sort().join(",") || "-"}`);
  return { lines, bad };
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-loaded-"));
  let failed = 0;
  try {
    const init = { type: "system", subtype: "init", model: "claude-sonnet-5-5" };
    const call = (id, skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Skill", input: { skill } }] } });
    const res = (id, content, isError) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } });
    const base = (dir, body) => ({ type: "user", isSynthetic: true, message: { content: [{ type: "text", text: `${BASE}/tmp/w/skills/${dir}\n\n${body}` }] } });
    const read = (id) => [{ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Read", input: { file_path: "/tmp/w/skills/fix/SKILL.md" } }] } },
      res(id, "# Fix — root-cause repair workflow\n<HARD-GATE-SCOUT-FIRST>")];
    const goc = "# Fix — root-cause repair workflow\n<HARD-GATE-SCOUT-FIRST>\n";
    const sau = goc + "<HARD-GATE-RED-BEFORE-FIX>\n";
    const cases = [
      ["loaded goc", [init, call("a", "cafekit-fix:fix"), res("a", "Launching skill: cafekit-fix:fix"), base("fix", goc)], "loaded=yes first-call=launch version=goc"],
      ["loaded sau", [init, call("a", "cf:fix"), res("a", "Launching skill: cf:fix"), base("fix", sau)], "loaded=yes first-call=launch version=sau"],
      ["Skill call, no skill text", [init, call("a", "cafekit-fix:fix"), res("a", "Launching skill: cafekit-fix:fix")], "loaded=no first-call=launch version=-"],
      ["skill text, no Skill call", [init, base("fix", sau)], "loaded=no first-call=none version=-"],
      ["debug only", [init, call("a", "cafekit-fix:debug"), res("a", "Launching skill: cafekit-fix:debug"), base("debug", "<HARD-GATE-SCOUT-FIRST>")], "loaded=no first-call=launch version=-"],
      ["failed cf:fix then debug", [init, call("a", "cf:fix"), res("a", "Unknown skill: cf:fix", true), call("b", "cafekit-fix:debug"), res("b", "Launching skill: cafekit-fix:debug"), base("debug", "<HARD-GATE-SCOUT-FIRST>")], "loaded=no first-call=error version=-"],
      ["Read of the skill file", [init, ...read("a")], "loaded=no first-call=none version=-"],
      ["failed first call then cafekit-fix:fix", [init, call("a", "cf:fix"), res("a", "Unknown skill: cf:fix", true), call("b", "cafekit-fix:fix"), res("b", "Launching skill: cafekit-fix:fix"), base("fix", sau)], "loaded=yes first-call=error version=sau"],
      ["no tracePath", null, "loaded=no-trace first-call=none version=-"],
    ];
    cases.forEach(([label, events, want], n) => {
      const dir = path.join(tmp, `c${n}`);
      fs.mkdirSync(dir);
      const run = {};
      if (events) {
        run.tracePath = path.join(dir, "trace.jsonl");
        fs.writeFileSync(run.tracePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      }
      fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ arms: { with: [run] } }] }));
      const { lines } = check(dir);
      const ok = lines[0].includes(` run=1 ${want} `) && lines.length === 2;
      console.log(`${ok ? "ok" : "fail"}: ${label} → ${lines[0].slice(dir.length + 1)}`);
      if (!ok) failed++;
    });
    const dir = path.join(tmp, "summary");
    fs.mkdirSync(dir);
    const t1 = path.join(dir, "t1.jsonl");
    fs.writeFileSync(t1, [init, call("a", "cafekit-fix:fix"), res("a", "Launching skill: cafekit-fix:fix"), base("fix", sau)].map((e) => JSON.stringify(e)).join("\n"));
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ arms: { with: [{ tracePath: t1 }, {}, { tracePath: path.join(dir, "gone.jsonl") }] } }] }));
    const s = check(dir);
    const ok = s.bad === 1 && s.lines[1].includes(" run=2 loaded=no-trace ") && s.lines[2].includes("trace-unreadable=")
      && s.lines[3].endsWith(" loaded=1/3 first-launch=1/3 version=sau model=claude-sonnet-5-5");
    console.log(`${ok ? "ok" : "fail"}: summary over a loaded, a no-trace and an unreadable run → ${s.lines[3].slice(dir.length + 1)}`);
    if (!ok) failed++;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") process.exit(selfTest());
if (!args.length) { console.error("usage: node evals/fix-s55/skill-loaded.mjs <result dir>... | --self-test"); process.exit(2); }
let bad = 0;
for (const dir of args) {
  const r = check(dir);
  for (const l of r.lines) console.log(l);
  bad += r.bad;
}
process.exit(bad ? 1 : 0);
