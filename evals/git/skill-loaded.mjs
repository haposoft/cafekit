#!/usr/bin/env node
// Đọc trace giữ lại (--keep-temp) của từng lượt và cho biết skill git có thật sự được nạp không. Một lượt là `loaded` khi một lệnh gọi
// công cụ Skill có input.skill là `git`, `cf:git` hay `<plugin>:git` nhận kết quả (cùng tool_use_id, không is_error) bắt đầu bằng
// `Launching skill: ` với tên đó, và trace có một message mà text bắt đầu bằng `Base directory for this skill: ` với dòng đầu kết thúc bằng
// `/skills/git`. Mỗi lượt in một dòng (run đếm từ 1), rồi luôn in một dòng tổng đọc được bởi evals/compare-git.mjs:
//   <dir> run=<i> loaded=<yes|no|no-trace> model=<model của sự kiện init>
//   <dir> loaded=<k>/<n> model=<các model, sắp xếp>
// Thoát 1 chỉ khi một lượt có tracePath mà không đọc được.
//   node evals/git/skill-loaded.mjs <result dir>...
//   node evals/git/skill-loaded.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const NAME = /^(?:[^:]*:)?git$/;
const LAUNCH = /^Launching skill: (?:[^:\s]*:)?git\s*$/;
const BASE = "Base directory for this skill: ";

const textOf = (content) => typeof content === "string" ? content
  : Array.isArray(content) ? content.map((x) => (typeof x === "string" ? x : x && x.text) || "").join("") : "";

// Trả null khi trace không đọc được.
export function readRun(run) {
  if (!run.tracePath) return { loaded: "no-trace", model: "-" };
  let events;
  try {
    events = fs.readFileSync(run.tracePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch { return null; }
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
        && c.text.split("\n")[0].trimEnd().endsWith("/skills/git") && skillText === null) skillText = c.text;
    }
  }
  const outcome = (call) => {
    const r = results.get(call.id);
    return r && !r.is_error && textOf(r.content).startsWith("Launching skill: ") ? textOf(r.content) : null;
  };
  const launched = calls.some((c) => c.input && NAME.test(String(c.input.skill || "")) && LAUNCH.test(outcome(c) || ""));
  return { loaded: launched && skillText !== null ? "yes" : "no", model: (init && init.model) || "-" };
}

export function check(dir) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const runs = result.cases[0].arms.with;
  const lines = [];
  let k = 0, bad = 0;
  const models = new Set();
  runs.forEach((run, i) => {
    const r = readRun(run);
    if (r === null) { lines.push(`${dir} run=${i + 1} loaded=no model=- trace-unreadable=${run.tracePath}`); bad++; return; }
    if (r.loaded === "yes") k++;
    if (r.model !== "-") models.add(r.model);
    lines.push(`${dir} run=${i + 1} loaded=${r.loaded} model=${r.model}`);
  });
  lines.push(`${dir} loaded=${k}/${runs.length} model=${[...models].sort().join(",") || "-"}`);
  return { lines, bad };
}

function selfTest() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "skill-loaded-"));
  const fail = (m) => { console.error(`self-test FAIL: ${m}`); process.exit(1); };
  try {
    const ev = (o) => JSON.stringify(o);
    const init = { type: "system", subtype: "init", model: "claude-opus-5-5" };
    const call = (id, skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Skill", input: { skill } }] } });
    const res = (id, text, isError) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: !!isError, content: text }] } });
    const base = (suffix) => ({ type: "user", message: { content: [{ type: "text", text: `${BASE}/x/skills/${suffix}\n# body` }] } });
    const write = (name, events) => { const f = path.join(T, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, events.map(ev).join("\n") + "\n"); return f; };
    const traces = {
      yes: write("a/out/trace.jsonl", [init, call("1", "cafekit-git:git"), res("1", "Launching skill: cafekit-git:git"), base("git")]),
      yesBare: write("b/out/trace.jsonl", [init, call("1", "cf:git"), res("1", "Launching skill: cf:git"), base("git")]),
      noCall: write("c/out/trace.jsonl", [init, { type: "assistant", message: { content: [{ type: "text", text: "no skill" }] } }]),
      errored: write("d/out/trace.jsonl", [init, call("1", "cafekit-git:git"), res("1", "Unknown skill", true)]),
      wrongSkill: write("e/out/trace.jsonl", [init, call("1", "cafekit-fix:fix"), res("1", "Launching skill: cafekit-fix:fix"), base("fix")]),
      noBase: write("f/out/trace.jsonl", [init, call("1", "cafekit-git:git"), res("1", "Launching skill: cafekit-git:git")]),
      // một kết quả is_error có chữ `Launching skill:` vẫn không phải là nạp; một lệnh gọi git nhận kết quả của skill khác không phải là nạp;
      // một lệnh gọi skill khác nhận chữ nạp git không phải là nạp
      errorWithLaunchText: write("g/out/trace.jsonl", [init, call("1", "cf:git"), res("1", "Launching skill: cf:git", true), base("git")]),
      otherResult: write("h/out/trace.jsonl", [init, call("1", "cf:git"), res("1", "Launching skill: cafekit-fix:fix"), base("git")]),
      otherCall: write("i/out/trace.jsonl", [init, call("1", "cafekit-fix:fix"), res("1", "Launching skill: cafekit-git:git"), base("git")]),
    };
    const dir = path.join(T, "cell"); fs.mkdirSync(dir);
    const runs = [...Object.values(traces).map((tracePath) => ({ tracePath })), { tracePath: path.join(T, "gone", "out", "trace.jsonl") }, {}];
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ arms: { with: runs } }] }));
    const { lines, bad } = check(dir);
    const want = ["yes", "yes", "no", "no", "no", "no", "no", "no", "no", "no", "no-trace"];
    const got = lines.slice(0, 11).map((l) => l.match(/loaded=(\S+)/)[1]);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`per-run verdicts ${got} != ${want}`);
    if (bad !== 1) fail(`expected one unreadable trace, got ${bad}`);
    if (!lines.at(-1).endsWith("loaded=2/11 model=claude-opus-5-5")) fail(`summary line: ${lines.at(-1)}`);
    console.log("self-test ok: launched=yes (plain, plugin-prefixed), no call=no, error result=no, other skill=no, missing base text=no, unreadable=error");
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") selfTest();
  else if (!args.length) { console.error("usage: node evals/git/skill-loaded.mjs <result dir>... | --self-test"); process.exit(2); }
  else {
    let bad = 0;
    for (const dir of args) { const r = check(dir); console.log(r.lines.join("\n")); bad += r.bad; }
    process.exit(bad ? 1 : 0);
  }
}
