#!/usr/bin/env node
// Đọc trace giữ lại (--keep-temp) của từng lượt và cho biết skill sync có THẬT SỰ được nạp không (plan D-06). Một lượt là `loaded` khi
// một lệnh gọi công cụ Skill có input.skill là `sync`, `cf:sync` hay `<plugin>:sync` nhận kết quả (cùng tool_use_id, không is_error) bắt
// đầu bằng `Launching skill: ` với tên đó, và trace có một message mà text bắt đầu bằng `Base directory for this skill: ` với dòng đầu
// kết thúc bằng `/skills/sync`. Câu trả lời kiểu "/cf:sync is not available" không phải là nạp. Mỗi lượt in một dòng, rồi một dòng tổng
// đọc được bởi evals/compare-sync.mjs:
//   <dir> run=<i> loaded=<yes|no|no-trace> model=<model của sự kiện init>
//   <dir> loaded=<k>/<n> model=<các model, sắp xếp>
// Thoát 1 chỉ khi một lượt có tracePath mà không đọc được.
//   node evals/sync/skill-loaded.mjs <result dir>...
//   node evals/sync/skill-loaded.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const NAME = /^(?:[^:]*:)?sync$/;
const LAUNCH = /^Launching skill: (?:[^:\s]*:)?sync\s*$/;
const BASE = "Base directory for this skill: ";

const textOf = (content) => typeof content === "string" ? content
  : Array.isArray(content) ? content.map((x) => (typeof x === "string" ? x : x && x.text) || "").join("") : "";

// null khi trace không đọc được.
export function readRun(run) {
  if (!run.tracePath) return { loaded: "no-trace", model: "-" };
  let events;
  try {
    events = fs.readFileSync(run.tracePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch { return null; }
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  const calls = [], results = new Map();
  let based = false;
  for (const e of events) {
    const content = e.message && e.message.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (e.type === "assistant" && c.type === "tool_use" && c.name === "Skill") calls.push(c);
      if (e.type === "user" && c.type === "tool_result") results.set(c.tool_use_id, c);
      if (e.type === "user" && c.type === "text" && typeof c.text === "string" && c.text.startsWith(BASE)
        && c.text.split("\n")[0].trimEnd().endsWith("/skills/sync")) based = true;
    }
  }
  const outcome = (call) => {
    const r = results.get(call.id);
    return r && !r.is_error ? textOf(r.content) : "";
  };
  const launched = calls.some((c) => c.input && NAME.test(String(c.input.skill || "")) && LAUNCH.test(outcome(c)));
  return { loaded: launched && based ? "yes" : "no", model: (init && init.model) || "-" };
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
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "sync-skill-loaded-"));
  const fail = (m) => { console.error(`self-test FAIL: ${m}`); process.exit(1); };
  try {
    const init = { type: "system", subtype: "init", model: "claude-sonnet-5-5" };
    const call = (id, skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Skill", input: { skill } }] } });
    const res = (id, text, isError) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: !!isError, content: text }] } });
    const base = (suffix) => ({ type: "user", message: { content: [{ type: "text", text: `${BASE}/x/skills/${suffix}\n# body` }] } });
    const say = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });
    const write = (name, events) => { const f = path.join(T, name, "out", "trace.jsonl"); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, events.map((e) => JSON.stringify(e)).join("\n") + "\n"); return f; };
    const traces = [
      ["yes", write("a", [init, call("1", "cafekit-sync:sync"), res("1", "Launching skill: cafekit-sync:sync"), base("sync")])],
      ["yes", write("b", [init, call("1", "cf:sync"), res("1", "Launching skill: cf:sync"), base("sync")])],
      // sonnet 5.5 trả lời "/cf:sync is not available" mà không gọi công cụ Skill (handoff; plan D-06)
      ["no", write("c", [init, say("/cf:sync is not available in this session.")])],
      ["no", write("d", [init, call("1", "cafekit-sync:sync"), res("1", "Unknown skill", true)])],
      ["no", write("e", [init, call("1", "cafekit-specs:specs"), res("1", "Launching skill: cafekit-specs:specs"), base("specs")])],
      ["no", write("f", [init, call("1", "cafekit-sync:sync"), res("1", "Launching skill: cafekit-sync:sync")])],
      ["no", write("g", [init, call("1", "cf:sync"), res("1", "Launching skill: cf:sync", true), base("sync")])],
      ["no", write("h", [init, call("1", "cafekit-specs:specs"), res("1", "Launching skill: cafekit-sync:sync"), base("sync")])],
    ];
    const dir = path.join(T, "cell"); fs.mkdirSync(dir);
    const runs = [...traces.map(([, tracePath]) => ({ tracePath })), { tracePath: path.join(T, "gone", "out", "trace.jsonl") }, {}];
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ arms: { with: runs } }] }));
    const { lines, bad } = check(dir);
    const want = [...traces.map(([w]) => w), "no", "no-trace"];
    const got = lines.slice(0, want.length).map((l) => l.match(/loaded=(\S+)/)[1]);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`per-run verdicts ${got} != ${want}`);
    if (bad !== 1) fail(`expected one unreadable trace, got ${bad}`);
    if (!lines.at(-1).endsWith("loaded=2/10 model=claude-sonnet-5-5")) fail(`summary line: ${lines.at(-1)}`);
    console.log("ok not-available-trace");
    console.log("self-test ok: launched=yes, not-available=no, error=no, other skill=no, missing base text=no, unreadable=error");
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") selfTest();
  else if (!args.length) { console.error("usage: node evals/sync/skill-loaded.mjs <result dir>... | --self-test"); process.exit(2); }
  else {
    let bad = 0;
    for (const dir of args) { const r = check(dir); console.log(r.lines.join("\n")); bad += r.bad; }
    process.exit(bad ? 1 : 0);
  }
}
