#!/usr/bin/env node
// Tổng hợp một lượt đo của ca kiem-suite: mẫu hợp lệ là lượt mà cf:test thật sự được nạp (evals/lean/loaded.mjs báo loaded=yes)
// và không mở thư mục ca chứa đáp án (bốn grader khong-doc-dap-an-* đạt),
// rồi cho biết mỗi trong sáu lỗi đã cấy được bao nhiêu lượt hợp lệ chỉ ra kèm lý do, tỉ lệ bỏ sót và lượt bị chấm sót (để soát tay).
// Bộ đếm chẩn đoán chạy trên cả 10 lượt; câu trả lời cuối từng lượt được chép ra <results dir>/<out>/answers/run-<i>.md.
// Nạp skill do loaded.mjs quyết định (gọi qua CLI vì import module đó chạy luôn phần CLI và thoát 2).
// Thoát 1 khi số lượt ≠ 10, có lượt no-trace/unreadable/error/skippedPaidGraders, kết quả partial, thiếu một grader tim-* ở lượt
// hợp lệ, hoặc số lượt hợp lệ k < 8 (chưa đủ mẫu).
//   node evals/test/kiem-suite/summarize.mjs <out name> [<results dir>]
//   node evals/test/kiem-suite/summarize.mjs --self-test
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FINDERS = ["tim-luon-dung", "tim-ham-gia", "tim-nuot-loi", "tim-bi-tat", "tim-bo-do", "tim-ci-che-loi"];
const COUNTERS = ["bao-pass", "bao-fail", "khong-sua-test", "khong-sua-code", "khong-edit"];
// Thư mục ca (graders/, scaffold.sh) được chép vào plugin, nên một lượt mở nó là đã thấy đáp án.
const LEAKS = ["khong-doc-dap-an-read", "khong-doc-dap-an-grep", "khong-doc-dap-an-glob", "khong-doc-dap-an-bash"];
const EXPECTED_RUNS = 10, MIN_VALID = 8;

const grader = (run, name) => (run.graders || []).find((g) => g.name === name);
const passed = (run, name) => grader(run, name)?.passed === true;

// Câu trả lời cuối của một lượt: trường `result` của sự kiện `result` cuối cùng trong trace.
function finalAnswer(tracePath) {
  const kept = path.dirname(path.dirname(tracePath));
  if (fs.existsSync(kept)) spawnSync("chmod", ["-R", "u+rwX", kept]);
  let raw;
  try { raw = fs.readFileSync(tracePath, "utf8"); } catch { return null; }
  let answer = null;
  for (const line of raw.split("\n").filter(Boolean)) {
    try { const e = JSON.parse(line); if (e.type === "result" && typeof e.result === "string") answer = e.result; } catch { /* dòng hỏng không có câu trả lời */ }
  }
  return answer;
}

// Trả về { lines, code }; code 1 khi mẫu chưa đủ hay bẩn, 0 khi sạch.
export function summarize(resultsDir) {
  const lines = [];
  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, "result.json"), "utf8"));
  const runs = result.cases[0].arms.with;
  const cli = spawnSync(process.execPath, [path.join(repo, "evals/lean/loaded.mjs"), "test", resultsDir], { encoding: "utf8" });
  const loaded = new Map();
  for (const m of (cli.stdout || "").matchAll(/ run=(\d+) loaded=(\S+)/g)) loaded.set(Number(m[1]), m[2]);

  const problems = [];
  if (result.partial) problems.push("result is partial");
  if (cli.status !== 0) problems.push(`loaded.mjs exited ${cli.status}`);
  const valid = [], excluded = [];
  runs.forEach((run, i) => {
    const state = loaded.get(i + 1) ?? "unreadable";
    if (state === "no-trace" || state === "unreadable") problems.push(`run=${i + 1} trace ${state}`);
    if (run.error) problems.push(`run=${i + 1} harness error`);
    if (run.skippedPaidGraders) problems.push(`run=${i + 1} skipped paid graders`);
    if (run.error) return;
    const missingLeak = LEAKS.filter((g) => !grader(run, g));
    if (missingLeak.length) problems.push(`run=${i + 1} missing ${missingLeak.join(", ")}`);
    const leaked = LEAKS.filter((g) => grader(run, g) && !passed(run, g));
    if (state !== "yes") excluded.push(`run=${i + 1} excluded: cf:test not loaded (${state})`);
    else if (leaked.length) excluded.push(`run=${i + 1} excluded: opened the case answers (${leaked.join(", ")})`);
    else valid.push({ run, index: i + 1 });
  });

  const k = valid.length;
  lines.push(`runs=${runs.length} loaded=${[...loaded.values()].filter((v) => v === "yes").length} valid=${k}`);
  for (const f of FINDERS) {
    const absent = valid.filter(({ run }) => !grader(run, f)).map(({ index }) => index);
    if (absent.length) { problems.push(`${f} absent in run=${absent.join(",")}`); lines.push(`${f}=n/a absent in run=${absent.join(",")}`); continue; }
    const missed = valid.filter(({ run }) => !passed(run, f)).map(({ index }) => index);
    const x = k - missed.length;
    lines.push(`${f}=${x}/${k} missing=${k ? Math.round((missed.length / k) * 100) : "n/a"}% missed_runs=${missed.join(",") || "-"}`);
  }
  for (const c of COUNTERS) lines.push(`${c}=${runs.filter((run) => passed(run, c)).length}/${runs.length}`);
  const writes = runs.reduce((s, run) => s + Number(/called (\d+)x/.exec(grader(run, "dem-write")?.explanation || "")?.[1] ?? 0), 0);
  lines.push(`dem-write_calls=${writes}`);
  for (const line of excluded) lines.push(line);

  const answers = path.join(resultsDir, "answers");
  fs.mkdirSync(answers, { recursive: true });
  runs.forEach((run, i) => {
    const text = run.tracePath ? finalAnswer(run.tracePath) : null;
    if (text === null) lines.push(`run=${i + 1} answer: not found in trace`);
    else fs.writeFileSync(path.join(answers, `run-${i + 1}.md`), text.endsWith("\n") ? text : `${text}\n`);
  });

  if (runs.length !== EXPECTED_RUNS) problems.push(`runs=${runs.length} (need ${EXPECTED_RUNS})`);
  if (k < MIN_VALID) problems.push(`valid=${k} (need >=${MIN_VALID})`);
  for (const p of problems) lines.push(`problem: ${p}`);
  if (problems.length) lines.push(`insufficient: chưa đủ mẫu (${problems.length} problem)`);
  return { lines, code: problems.length ? 1 : 0 };
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kiem-suite-"));
  const make = (dir, { loadedRuns = EXPECTED_RUNS, runs = EXPECTED_RUNS, error = false, partial = false, skipped = false, dropFinder = null, leakRuns = 0, noTrace = false }) => {
    const d = path.join(tmp, dir); fs.mkdirSync(d);
    const withRuns = Array.from({ length: runs }, (_, i) => {
      const kept = path.join(d, `kept-${i}`);
      fs.mkdirSync(path.join(kept, "out"), { recursive: true });
      const tracePath = path.join(kept, "out", "trace.jsonl");
      const isLoaded = i < loadedRuns;
      const events = [{ type: "system", subtype: "init", model: "claude-sonnet-5-5", skills: isLoaded ? ["cf:test"] : [] }];
      if (isLoaded) events.push({ type: "user", message: { content: [{ type: "text", text: "Base directory for this skill: /tmp/w/skills/test\n\n# body" }] } });
      events.push({ type: "result", result: `câu trả lời cuối ${i + 1}` });
      fs.writeFileSync(tracePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      const graders = [...FINDERS.filter((g) => g !== dropFinder), ...COUNTERS, ...LEAKS, "dem-write"].map((name) => ({ name, passed: !(name === "khong-doc-dap-an-read" && i < leakRuns), explanation: name === "dem-write" ? "called 0x" : "ok" }));
      return { tracePath: noTrace && i === 0 ? null : tracePath, graders, error: error && i === 0 ? "boom" : null, skippedPaidGraders: skipped && i === 0 };
    });
    fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ partial, cases: [{ name: "kiem-suite", arms: { with: withRuns } }] }));
    return d;
  };
  const cases = [
    ["full sample exits 0", make("full", {}), 0],
    ["8 valid exits 0", make("eight", { loadedRuns: 8 }), 0],
    ["k < 8 exits 1", make("seven", { loadedRuns: 7 }), 1],
    ["error run exits 1", make("error", { error: true }), 1],
    ["partial exits 1", make("partial", { partial: true }), 1],
    ["missing tim-* grader exits 1", make("absent", { dropFinder: "tim-bo-do" }), 1],
    ["skipped paid graders exits 1", make("skipped", { skipped: true }), 1],
    ["9 runs exits 1", make("nine", { runs: 9, loadedRuns: 9 }), 1],
    ["no-trace run exits 1", make("notrace", { noTrace: true }), 1],
    ["1 answer-reading run is excluded, k=9 exits 0", make("leak1", { leakRuns: 1 }), 0],
    ["3 answer-reading runs leave k=7, exits 1", make("leak3", { leakRuns: 3 }), 1],
  ];
  let failed = 0;
  for (const [label, dir, want] of cases) {
    const { code } = summarize(dir);
    const ok = code === want;
    if (!ok) failed++;
    console.log(`${ok ? "ok" : "FAIL"}: ${label} → exit ${code}`);
  }
  const copied = fs.readFileSync(path.join(tmp, "full", "answers", "run-3.md"), "utf8") === "câu trả lời cuối 3\n";
  if (!copied) failed++;
  console.log(`${copied ? "ok" : "FAIL"}: final answer copied to answers/run-3.md`);
  spawnSync("chmod", ["-R", "u+rwX", tmp]);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const argv = process.argv.slice(2);
if (argv[0] === "--self-test") selfTest();
else {
  const [out, resultsRoot] = argv;
  if (!out || argv.length > 2) { console.error("usage: node evals/test/kiem-suite/summarize.mjs <out name> [<results dir>] | --self-test"); process.exit(2); }
  const { lines, code } = summarize(path.resolve(resultsRoot || path.join(repo, "evals/results/test"), out));
  for (const l of lines) console.log(l);
  process.exit(code);
}
