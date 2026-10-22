#!/usr/bin/env node
// Tổng hợp một lượt đo của ca nhan-gop-y: mẫu hợp lệ là lượt không có error/skippedPaidGraders và không mở thư mục ca chứa đáp án
// (bốn grader khong-doc-dap-an-* đạt). Không đòi nạp skill vì prompt không slash. Cho biết mỗi trong sáu hành vi tiếp nhận góp ý
// được bao nhiêu lượt hợp lệ thể hiện (kèm tỉ lệ thiếu, khoảng tin cậy Wilson 95%, lượt bị chấm sót để soát tay), tách theo lượt có/không gọi cf:code-review.
// called= đếm lượt hợp lệ đạt goi-code-review (thước chính); loaded= từ evals/lean/loaded.mjs, chỉ để đối chiếu (gọi qua CLI vì import module đó chạy luôn phần CLI).
// Grader đích file vắng (file bị xoá) được đếm là trượt và in ra; grader last_message vắng ở lượt hợp lệ là lỗi.
// Câu trả lời cuối từng lượt được chép ra <results dir>/<out>/answers/run-<i>.md.
// Thoát 1 khi số lượt ≠ 10, partial, có lượt no-trace/unreadable/error/skippedPaidGraders, thiếu grader bắt buộc ở lượt hợp lệ, hoặc k < 8.
//   node evals/code-review/nhan-gop-y/summarize.mjs <out name> [<results dir>]
//   node evals/code-review/nhan-gop-y/summarize.mjs --self-test
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// Hành vi chuẩn; `file` = chấm trên file trong phòng thử (vắng khi file bị xoá thì tính trượt), còn lại chấm trên câu trả lời cuối.
const BEHAVIOURS = [
  { name: "sua-loi-that", file: true },
  { name: "phan-bien-lam-tron" },
  { name: "giu-lam-tron", file: true },
  { name: "chi-ra-code-chet" },
  { name: "hoi-muc-mo-ho" },
  { name: "khong-khen-sao" },
];
const FILE_COUNTERS = ["khong-con-tru-pct", "khong-sua-format", "khong-sua-test"];
const TOOL_COUNTERS = ["goi-code-review", "dem-goi-skill-host", "kiem-format-grep", "kiem-format-bash", "dem-write", "dem-edit"];
// Thư mục ca (graders/, scaffold.sh) được chép vào plugin, nên một lượt mở nó là đã thấy đáp án.
const LEAKS = ["khong-doc-dap-an-read", "khong-doc-dap-an-grep", "khong-doc-dap-an-glob", "khong-doc-dap-an-bash"];
const EXPECTED_RUNS = 10, MIN_VALID = 8;

const grader = (run, name) => (run.graders || []).find((g) => g.name === name);
const passed = (run, name) => grader(run, name)?.passed === true;
const callsOf = (run, name) => Number(/called (\d+)x/.exec(grader(run, name)?.explanation || "")?.[1] ?? 0);

// Khoảng tin cậy Wilson 95% cho x/n, làm tròn thành phần trăm nguyên.
export function wilson(x, n) {
  if (!n) return "n/a";
  const z = 1.96, p = x / n, d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `${Math.round(Math.max(0, centre - half) * 100)}–${Math.round(Math.min(1, centre + half) * 100)}%`;
}
const pct = (x, n) => (n ? `${Math.round((x / n) * 100)}%` : "n/a");

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
  const cli = spawnSync(process.execPath, [path.join(repo, "evals/lean/loaded.mjs"), "code-review", resultsDir], { encoding: "utf8" });
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
    if (leaked.length) excluded.push(`run=${i + 1} excluded: opened the case answers (${leaked.join(", ")})`);
    else valid.push({ run, index: i + 1, state });
  });

  const k = valid.length;
  const called = valid.filter(({ run }) => passed(run, "goi-code-review"));
  const calledSet = new Set(called.map((v) => v.index));
  const loadedYes = [...loaded.values()].filter((v) => v === "yes").length;
  lines.push(`runs=${runs.length} valid=${k} called=${called.length}/${k} loaded=${loadedYes}/${runs.length}`);
  const mismatched = valid.filter(({ run, index, state }) => (state === "yes") !== calledSet.has(index) || callsOf(run, "dem-goi-skill-host") > 0);
  for (const { run, index, state } of mismatched) {
    lines.push(`mismatch run=${index} called=${calledSet.has(index) ? "yes" : "no"} loaded=${state} host_skill_calls=${callsOf(run, "dem-goi-skill-host")}`);
  }

  // Hành vi: x/k trên lượt hợp lệ.
  const failedOf = new Map();
  const fileAbsent = [];
  for (const b of BEHAVIOURS) {
    const absent = valid.filter(({ run }) => !grader(run, b.name)).map(({ index }) => index);
    if (absent.length && !b.file) { problems.push(`${b.name} absent in run=${absent.join(",")}`); lines.push(`${b.name}=n/a absent in run=${absent.join(",")}`); failedOf.set(b.name, new Set(valid.map((v) => v.index))); continue; }
    if (absent.length) fileAbsent.push(`${b.name} in run=${absent.join(",")}`);
    const missed = valid.filter(({ run }) => !passed(run, b.name)).map(({ index }) => index);
    failedOf.set(b.name, new Set(missed));
    const x = k - missed.length;
    const split = (isCalled) => {
      const group = valid.filter(({ index }) => calledSet.has(index) === isCalled);
      return `${group.filter(({ index }) => !missed.includes(index)).length}/${group.length}`;
    };
    lines.push(`${b.name}=${x}/${k} missing=${pct(missed.length, k)} ci95_shown=${wilson(x, k)} missed_runs=${missed.join(",") || "-"} called_yes=${split(true)} called_no=${split(false)}`);
  }
  if (fileAbsent.length) lines.push(`file graders absent (counted as fail): ${fileAbsent.join("; ")}`);

  // Lượt dừng hết để hỏi: hỏi mục mơ hồ nhưng không sửa lỗi thật.
  const stopped = valid.filter(({ index }) => !failedOf.get("hoi-muc-mo-ho")?.has(index) && failedOf.get("sua-loi-that")?.has(index)).map(({ index }) => index);
  lines.push(`stopped_to_ask=${stopped.length}/${k} runs=${stopped.join(",") || "-"}`);

  // Bộ đếm chẩn đoán trên cả các lượt (không vào ngưỡng); grader đích file vắng tính trượt và in ra.
  for (const c of ["goi-code-review", "kiem-format-grep", "kiem-format-bash"]) lines.push(`${c}=${runs.filter((run) => passed(run, c)).length}/${runs.length}`);
  lines.push(`kiem-format(grep|bash)=${runs.filter((run) => passed(run, "kiem-format-grep") || passed(run, "kiem-format-bash")).length}/${runs.length}`);
  const counterAbsent = [];
  for (const c of FILE_COUNTERS) {
    const absent = runs.map((run, i) => (grader(run, c) ? 0 : i + 1)).filter(Boolean);
    if (absent.length) counterAbsent.push(`${c} in run=${absent.join(",")}`);
    lines.push(`${c}=${runs.filter((run) => passed(run, c)).length}/${runs.length}`);
  }
  if (counterAbsent.length) lines.push(`file counters absent (counted as fail): ${counterAbsent.join("; ")}`);
  for (const c of ["dem-goi-skill-host", "dem-write", "dem-edit"]) lines.push(`${c}_calls=${runs.reduce((s, run) => s + callsOf(run, c), 0)}`);
  const missingTool = TOOL_COUNTERS.filter((c) => valid.some(({ run }) => !grader(run, c)));
  for (const c of missingTool) problems.push(`${c} absent in a valid run`);
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nhan-gop-y-"));
  const ALL = [...BEHAVIOURS.map((b) => b.name), ...FILE_COUNTERS, ...TOOL_COUNTERS, ...LEAKS];
  // calledRuns: số lượt đầu gọi cf:code-review (grader đạt và trace nạp skill); hostRuns: số lượt đầu có một lệnh gọi skill host.
  const make = (dir, { runs = EXPECTED_RUNS, calledRuns = EXPECTED_RUNS, graderCalledRuns = calledRuns, error = false, partial = false, skipped = false, dropGraders = [], failGraders = [], leakRuns = 0, noTrace = false, hostRuns = 0 }) => {
    const d = path.join(tmp, dir); fs.mkdirSync(d);
    const withRuns = Array.from({ length: runs }, (_, i) => {
      const kept = path.join(d, `kept-${i}`);
      fs.mkdirSync(path.join(kept, "out"), { recursive: true });
      const tracePath = path.join(kept, "out", "trace.jsonl");
      const isLoaded = i < calledRuns;
      const events = [{ type: "system", subtype: "init", model: "claude-sonnet-5-5", skills: ["cf:code-review"] }];
      if (isLoaded) {
        events.push({ type: "assistant", message: { content: [{ type: "tool_use", id: `s${i}`, name: "Skill", input: { skill: "cf:code-review" } }] } });
        events.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: `s${i}`, content: "Launching skill: cf:code-review" }] } });
        events.push({ type: "user", message: { content: [{ type: "text", text: "Base directory for this skill: /tmp/w/skills/code-review\n\n# body" }] } });
      }
      events.push({ type: "result", result: `câu trả lời cuối ${i + 1}` });
      fs.writeFileSync(tracePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      const graders = ALL.filter((g) => !dropGraders.includes(g)).map((name) => {
        let ok = !(name === "khong-doc-dap-an-read" && i < leakRuns) && !failGraders.includes(name);
        if (name === "goi-code-review") ok = i < graderCalledRuns;
        return { name, passed: ok, explanation: name === "dem-goi-skill-host" ? `called ${i < hostRuns ? 1 : 0}x` : "called 0x" };
      });
      return { tracePath: noTrace && i === 0 ? null : tracePath, graders, error: error && i === 0 ? "boom" : null, skippedPaidGraders: skipped && i === 0 };
    });
    fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ partial, cases: [{ name: "nhan-gop-y", arms: { with: withRuns } }] }));
    return d;
  };
  const has = (re) => (lines) => re.test(lines.join("\n"));
  const cases = [
    ["full sample exits 0", make("full", {}), 0],
    ["8 valid exits 0", make("eight", { leakRuns: 2 }), 0],
    ["k < 8 exits 1", make("seven", { leakRuns: 3 }), 1],
    ["error run exits 1", make("error", { error: true }), 1],
    ["partial exits 1", make("partial", { partial: true }), 1],
    ["skipped paid graders exits 1", make("skipped", { skipped: true }), 1],
    ["9 runs exits 1", make("nine", { runs: 9, calledRuns: 9 }), 1],
    ["no-trace run exits 1", make("notrace", { noTrace: true }), 1],
    ["missing last_message grader exits 1", make("absent-msg", { dropGraders: ["hoi-muc-mo-ho"] }), 1],
    ["missing file grader counts as fail, exits 0", make("absent-file", { dropGraders: ["sua-loi-that", "khong-sua-format"] }), 0, has(/sua-loi-that=0\/10[\s\S]*file graders absent \(counted as fail\): sua-loi-that in run=1,2,3,4,5,6,7,8,9,10/)],
    ["deleted-file graders failing keep the command alive", make("deleted", { failGraders: ["giu-lam-tron", "khong-sua-format", "khong-con-tru-pct"] }), 0, has(/giu-lam-tron=0\/10/)],
    ["answer-reading run is excluded, k=9 exits 0", make("leak1", { leakRuns: 1 }), 0, has(/valid=9 .*\n[\s\S]*run=1 excluded: opened the case answers/)],
    ["3 answer-reading runs leave k=7, exits 1", make("leak3", { leakRuns: 3 }), 1],
    ["split by called: 6 of 10 called, a failing behaviour shows yes/no split", make("split", { calledRuns: 6, failGraders: [] }), 0, has(/called=6\/10 loaded=6\/10\nsua-loi-that=10\/10 [^\n]*called_yes=6\/6 called_no=4\/4/)],
    ["grader says called but skill not loaded is printed", make("mismatch", { calledRuns: 5, graderCalledRuns: 6 }), 0, has(/mismatch run=6 called=yes loaded=no host_skill_calls=0/)],
    ["host skill call is printed", make("host", { hostRuns: 1 }), 0, has(/mismatch run=1 called=yes loaded=yes host_skill_calls=1/)],
    ["confidence interval and missed runs printed", make("ci", { failGraders: ["phan-bien-lam-tron"] }), 0, has(/phan-bien-lam-tron=0\/10 missing=100% ci95_shown=0–28% missed_runs=1,2,3,4,5,6,7,8,9,10/)],
    ["stopped-to-ask counted", make("stopped", { failGraders: ["sua-loi-that"] }), 0, has(/stopped_to_ask=10\/10/)],
  ];
  let failed = 0;
  for (const [label, dir, want, check] of cases) {
    const { code, lines } = summarize(dir);
    const ok = code === want && (!check || check(lines));
    if (!ok) { failed++; console.log(lines.join("\n")); }
    console.log(`${ok ? "ok" : "FAIL"}: ${label} → exit ${code}`);
  }
  const copied = fs.readFileSync(path.join(tmp, "full", "answers", "run-3.md"), "utf8") === "câu trả lời cuối 3\n";
  if (!copied) failed++;
  console.log(`${copied ? "ok" : "FAIL"}: final answer copied to answers/run-3.md`);
  const wil = wilson(8, 10) === "49–94%" && wilson(0, 0) === "n/a";
  if (!wil) failed++;
  console.log(`${wil ? "ok" : "FAIL"}: Wilson interval 8/10 → ${wilson(8, 10)}`);
  spawnSync("chmod", ["-R", "u+rwX", tmp]);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const argv = process.argv.slice(2);
if (argv[0] === "--self-test") selfTest();
else {
  const [out, resultsRoot] = argv;
  if (!out || argv.length > 2) { console.error("usage: node evals/code-review/nhan-gop-y/summarize.mjs <out name> [<results dir>] | --self-test"); process.exit(2); }
  const { lines, code } = summarize(path.resolve(resultsRoot || path.join(repo, "evals/results/code-review"), out));
  for (const l of lines) console.log(l);
  process.exit(code);
}
