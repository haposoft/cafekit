#!/usr/bin/env node
// Đọc trace giữ lại (--keep-temp) của từng lượt và cho biết skill <skill> có thật sự được nạp không (gói lean-fix-debug,
// plan D-04). Một lượt là `loaded` khi sự kiện init liệt kê skill dưới một plugin (/^[^:]+:<skill>$/; host có skill built-in trùng tên như `debug` và `code-review`, nên tên trần không tính) và thân skill đã vào hội thoại: một
// khối text của sự kiện `user` (không tính tool_result, nơi output lệnh có thể chứa chuỗi bất kỳ) bắt đầu bằng
// `Base directory for this skill: ` với dòng đầu kết thúc bằng `/skills/<skill>`, trong trace hoặc trong transcript phiên (*.jsonl dưới một thư mục `projects/` của thư mục giữ lại). Một slash command mở rộng skill mà không
// gọi công cụ Skill, nên thân skill khi đó chỉ nằm trong transcript (evals/test/save-runs.mjs:61-90). `via=tool` khi một
// lệnh gọi Skill cho skill này nhận kết quả không lỗi bắt đầu bằng `Launching skill: ` (evals/fix-s55/skill-loaded.mjs),
// còn lại `via=slash`. Thư mục giữ lại bị khoá mode 000, nên mở bằng chmod -R u+rwX trước khi đọc.
//   <dir> run=<i> loaded=<yes|no|no-trace|unreadable> via=<tool|slash|-> model=<init model>
//   <dir> loaded=<k>/<n> model=<các init model, sắp xếp>
// Thoát 1 khi một lượt có tracePath mà không đọc được (unreadable).
//   node evals/lean/loaded.mjs <skill> <result dir>...
//   node evals/lean/loaded.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textOf = (content) => typeof content === "string" ? content
  : Array.isArray(content) ? content.map((x) => (typeof x === "string" ? x : x && x.text) || "").join("") : "";

const BASE = "Base directory for this skill: ";
// Text blocks a user event carries itself (a string content, or text items); tool results are left out on purpose.
const userTexts = (e) => {
  if (!e || e.type !== "user" || !e.message) return [];
  const c = e.message.content;
  if (typeof c === "string") return [c];
  return Array.isArray(c) ? c.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text) : [];
};
const parse = (raw) => raw.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const hasHeading = (events, skill) => events.some((e) => userTexts(e).some((t) => t.startsWith(BASE) && t.split("\n")[0].trimEnd().endsWith(`/skills/${skill}`)));

function transcripts(kept) {
  const out = [];
  const walk = (d) => {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) walk(q);
      else if (e.name.endsWith(".jsonl") && q.includes(`${path.sep}projects${path.sep}`)) out.push(q);
    }
  };
  walk(kept);
  return out;
}

export function readRun(skill, run) {
  if (!run.tracePath) return { loaded: "no-trace", via: "-", model: "-" };
  const kept = path.dirname(path.dirname(run.tracePath));
  if (fs.existsSync(kept)) spawnSync("chmod", ["-R", "u+rwX", kept]);
  let raw;
  try { raw = fs.readFileSync(run.tracePath, "utf8"); } catch { return { loaded: "unreadable", via: "-", model: "-" }; }
  const events = parse(raw);
  const init = events.find((e) => e.type === "system" && e.subtype === "init") || {};
  const nameRe = new RegExp(`^[^:]+:${esc(skill)}$`);
  const callRe = new RegExp(`^([^:]*:)?${esc(skill)}$`);
  const initSkill = (init.skills || []).some((s) => nameRe.test(String(s)));
  const calls = [], results = new Map();
  for (const e of events) {
    const c = e.message && e.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (e.type === "assistant" && b.type === "tool_use" && b.name === "Skill" && callRe.test(String((b.input || {}).skill || ""))) calls.push(b.id);
      if (e.type === "user" && b.type === "tool_result") results.set(b.tool_use_id, b);
    }
  }
  const tool = calls.some((id) => { const r = results.get(id); return r && r.is_error !== true && textOf(r.content).startsWith("Launching skill: "); });
  let heading = hasHeading(events, skill);
  if (!heading) for (const t of transcripts(kept)) { try { if (hasHeading(parse(fs.readFileSync(t, "utf8")), skill)) { heading = true; break; } } catch { /* unreadable adds nothing */ } }
  const loaded = initSkill && heading;
  return { loaded: loaded ? "yes" : "no", via: loaded ? (tool ? "tool" : "slash") : "-", model: init.model || "-" };
}

export function check(skill, dir) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const runs = result.cases[0].arms.with;
  const lines = [];
  let k = 0, bad = 0;
  const models = new Set();
  runs.forEach((run, i) => {
    const r = readRun(skill, run);
    if (r.loaded === "yes") k++;
    if (r.loaded === "unreadable") bad++;
    if (r.model !== "-") models.add(r.model);
    lines.push(`${dir} run=${i + 1} loaded=${r.loaded} via=${r.via} model=${r.model}`);
  });
  lines.push(`${dir} loaded=${k}/${runs.length} model=${[...models].sort().join(",") || "-"}`);
  return { lines, bad };
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lean-loaded-"));
  let failed = 0;
  try {
    const init = (skills) => ({ type: "system", subtype: "init", model: "claude-sonnet-5-5", skills });
    const call = (id, skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Skill", input: { skill } }] } });
    const res = (id, content, isError) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } });
    const base = (dir) => ({ type: "user", message: { content: [{ type: "text", text: `Base directory for this skill: /tmp/w/skills/${dir}\n\n# body` }] } });
    const readFile = [{ type: "assistant", message: { content: [{ type: "tool_use", id: "r", name: "Read", input: { file_path: "/tmp/w/skills/fix/SKILL.md" } }] } }, res("r", "# Fix\n")];
    const transcript = (dir) => JSON.stringify({ type: "user", message: { content: `<command-name>/cf:${dir}</command-name>` } }) + "\n"
      + JSON.stringify({ type: "user", isMeta: true, message: { content: [{ type: "text", text: `Base directory for this skill: /tmp/w/skills/${dir}\n\n# body` }] } }) + "\n";
    const cases = [
      ["slash load (transcript only)", "fix", [init(["cf:fix", "cf:debug"])], { transcript: "fix" }, "loaded=yes via=slash"],
      ["tool load", "fix", [init(["cf:fix"]), call("a", "cf:fix"), res("a", "Launching skill: cf:fix"), base("fix")], {}, "loaded=yes via=tool"],
      ["failed Skill call, no transcript", "fix", [init(["cf:fix"]), call("a", "cf:fix"), res("a", "Unknown skill: cf:fix", true)], {}, "loaded=no via=-"],
      ["Read of the skill file only", "fix", [init(["cf:fix"]), ...readFile], {}, "loaded=no via=-"],
      ["another skill loaded", "fix", [init(["cf:fix", "cf:debug"])], { transcript: "debug" }, "loaded=no via=-"],
      ["skill not in init", "fix", [init(["cf:debug"])], { transcript: "fix" }, "loaded=no via=-"],
      ["host built-in of the same name only", "debug", [init(["debug", "code-review"])], { transcript: "debug" }, "loaded=no via=-"],
      ["sealed kept directory still loads", "debug", [init(["cf:debug"])], { transcript: "debug", seal: true }, "loaded=yes via=slash"],
      ["heading string inside a tool result only", "fix", [init(["cf:fix"]), { type: "assistant", message: { content: [{ type: "tool_use", id: "b", name: "Bash", input: {} }] } }, res("b", "log: Base directory for this skill: /x/skills/fix\nend")], {}, "loaded=no via=-"],
      ["another skill body mentioning /skills/fix later", "fix", [init(["cf:fix", "cf:test"])], { transcriptText: "Base directory for this skill: /tmp/w/skills/test\nSee /x/skills/fix\n" }, "loaded=no via=-"],
      ["bare-name Skill call counts as tool", "fix", [init(["cf:fix"]), call("a", "fix"), res("a", "Launching skill: fix"), base("fix")], {}, "loaded=yes via=tool"],
      ["skill name with -", "web-testing", [init(["cf:web-testing"])], { transcript: "web-testing" }, "loaded=yes via=slash"],
      ["no tracePath", "fix", null, {}, "loaded=no-trace via=-"],
      ["unreadable tracePath", "fix", "missing", {}, "loaded=unreadable via=-"],
    ];
    cases.forEach(([label, skill, events, opt, want], n) => {
      const dir = path.join(tmp, `c${n}`);
      fs.mkdirSync(dir);
      const run = {};
      if (events === "missing") run.tracePath = path.join(dir, "kept", "out", "trace.jsonl");
      else if (events) {
        const kept = path.join(dir, "kept");
        fs.mkdirSync(path.join(kept, "out"), { recursive: true });
        run.tracePath = path.join(kept, "out", "trace.jsonl");
        fs.writeFileSync(run.tracePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
        if (opt.transcript || opt.transcriptText) {
          const proj = path.join(kept, "config", "projects", "-tmp-w");
          fs.mkdirSync(proj, { recursive: true });
          fs.writeFileSync(path.join(proj, "s.jsonl"), opt.transcript ? transcript(opt.transcript)
            : JSON.stringify({ type: "user", isMeta: true, message: { content: [{ type: "text", text: opt.transcriptText }] } }) + "\n");
        }
        if (opt.seal) spawnSync("chmod", ["-R", "000", kept]);
      }
      fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ arms: { with: [run] } }] }));
      const { lines, bad } = check(skill, dir);
      const ok = lines[0].includes(` run=1 ${want} `) && lines.length === 2 && (bad === (want.includes("unreadable") ? 1 : 0));
      console.log(`${ok ? "ok" : "fail"}: ${label} → ${lines[0].slice(dir.length + 1)}`);
      if (!ok) failed++;
    });
    const dir = path.join(tmp, "summary");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ arms: { with: [{}, {}] } }] }));
    const { lines } = check("fix", dir);
    const ok = lines[2] === `${dir} loaded=0/2 model=-`;
    console.log(`${ok ? "ok" : "fail"}: summary line → ${lines[2].slice(dir.length + 1)}`);
    if (!ok) failed++;
  } finally {
    spawnSync("chmod", ["-R", "u+rwX", tmp]);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") selfTest();
else {
  const [skill, ...dirs] = args;
  if (!skill || !/^[a-z0-9][a-z0-9-]*$/.test(skill) || dirs.length === 0) {
    console.error("usage: node evals/lean/loaded.mjs <skill> <result dir>... | --self-test");
    process.exit(2);
  }
  let bad = 0;
  for (const dir of dirs) { const r = check(skill, dir); for (const l of r.lines) console.log(l); bad += r.bad; }
  process.exit(bad ? 1 : 0);
}
