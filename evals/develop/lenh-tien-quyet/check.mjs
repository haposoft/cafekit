#!/usr/bin/env node
// Kiểm dụng cụ đo của ca lenh-tien-quyet, $0, không gọi model (gói skill-gotchas-eval, task 01):
//   scaffold-stable       hai lần scaffold (bố cục harness: evals/develop rsync vào <work>/evals/) cho cùng bytes task
//   gate-canonical        trong hai lệnh của Verification Plan, gate chỉ nhận lệnh thứ hai làm lệnh chuẩn
//   gate-agree-<bố cục>   verdict lenh-chuan của verify-run.mjs bằng đúng "gate không báo missing_receipt/command/command_identity"
//                         và bằng giá trị mong đợi của bố cục đó
//   plan-edit-caught      bỏ một dòng cấy thì thước ke-hoach-nguyen trượt (đọc cả `match:` của thước)
// In `ok <probe>` mỗi probe; thoát 1 khi có probe sai.
//   node evals/develop/lenh-tien-quyet/check.mjs
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { COMMAND_FAILURES, gateFailures, verifyDir, writeReceipt } from "../verify-run.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TASK_PATH = "specs/doi-loi-chao/task-01-doi-loi-chao.md";
const PRE = "node --check src/greet.js";
const CANON = "node --test test/greet.test.js";

const T = fs.mkdtempSync(path.join(os.tmpdir(), "lenh-tien-quyet-check-"));
const fails = [];
const ok = (name, cond, detail = "") => { if (cond) console.log(`ok ${name}`); else { console.log(`FAIL ${name} ${detail}`); fails.push(name); } };

// Như evals/develop/check-instrument.sh: scaffold chạy từ bản rsync của evals/develop, không từ repo.
const work = path.join(T, "work");
fs.mkdirSync(path.join(work, "evals"), { recursive: true });
const rs = spawnSync("rsync", ["-a", "--exclude", "results/", `${path.dirname(HERE)}/`, `${work}/evals/`]);
if (rs.status !== 0) { console.error("rsync failed"); process.exit(1); }
const scaffold = (dest) => {
  fs.mkdirSync(dest, { recursive: true });
  const r = spawnSync("bash", [path.join(work, "evals", "lenh-tien-quyet", "scaffold.sh")], { cwd: dest, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`scaffold failed: ${r.stderr}`);
  return dest;
};
const gitOut = (ws, ...args) => spawnSync("git", ["-C", ws, ...args], { encoding: "utf8" }).stdout.trim();
// Thước regex của harness: thân sau front matter, không cờ; `match: not_contains` đảo kết quả.
const regexGrader = (name, ws) => {
  const src = fs.readFileSync(path.join(HERE, "graders", `${name}.md`), "utf8");
  const head = src.match(/^---\n([\s\S]*?)\n---/)[1];
  const target = /path:\s*([^\s}]+)/.exec(head)[1];
  const hit = new RegExp(src.replace(/^---[\s\S]*?---\s*/, "").trim()).test(fs.readFileSync(path.join(ws, target), "utf8"));
  return /^match:\s*not_contains\s*$/m.test(head) ? !hit : hit;
};
const commandFailing = (ws) => gateFailures(ws).some((f) => COMMAND_FAILURES.includes(f));

try {
  const a = scaffold(path.join(T, "a")), b = scaffold(path.join(T, "b"));
  const bytes = (ws) => fs.readFileSync(path.join(ws, TASK_PATH));
  ok("scaffold-stable", bytes(a).equals(bytes(b)) && gitOut(a, "status", "--porcelain") === "" && gitOut(a, "rev-list", "--count", "HEAD") === "1"
    && regexGrader("ke-hoach-nguyen", a));

  const fields = (command) => `Verification: PASS\nCommand: ${command}\nExit: 0\nBase: ${"a".repeat(40)}\nHead: ${"b".repeat(64)}\n`;
  const fence = (extra = "") => `\`\`\`text\n${extra}✔ greet\n\`\`\`\n`;
  const accepted = [PRE, CANON].filter((c) => { const ws = scaffold(path.join(T, `canon-${c.split(" ")[1]}`)); writeReceipt(ws, fields(c) + fence()); return !commandFailing(ws); });
  ok("gate-canonical", accepted.length === 1 && accepted[0] === CANON, JSON.stringify(accepted));

  // [bố cục, Receipt (null = không có mục Receipt), verdict mong đợi]
  const layouts = [
    ["plain", fields(CANON) + fence(), true],
    ["bullet", fields(CANON).replace(`Command: ${CANON}`, `- Command: ${CANON}`) + fence(), true],
    ["indented", fields(CANON).replace(`Command: ${CANON}`, `  Command: ${CANON}`) + fence(), true],
    ["bold", fields(CANON).replace(`Command: ${CANON}`, `**Command:** ${CANON}`) + fence(), false],
    ["fenced-extra", fields(CANON) + fence(`Command: ${PRE}\n`), true],
    ["doubled", fields(CANON).replace(`Command: ${CANON}\n`, `Command: ${CANON}\nCommand: ${PRE}\n`) + fence(), false],
    ["first", fields(PRE) + fence(), false],
    ["chained", fields(`${PRE} && ${CANON}`) + fence(), false],
    ["missing", null, false],
  ];
  // Mỗi bố cục là một lượt của một ô giả, giữ lại theo bố cục harness (<kept>/sealed/home/cwd, <kept>/out/trace.jsonl).
  const dir = path.join(T, "results", "cell");
  fs.mkdirSync(dir, { recursive: true });
  const runs = layouts.map(([name, receipt]) => {
    const kept = path.join(T, "kept", name);
    writeReceipt(scaffold(path.join(kept, "sealed", "home", "cwd")), receipt);
    fs.mkdirSync(path.join(kept, "out"), { recursive: true });
    fs.writeFileSync(path.join(kept, "out", "trace.jsonl"), "");
    return { tracePath: path.join(kept, "out", "trace.jsonl") };
  });
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ name: "lenh-tien-quyet", arms: { with: runs } }] }));
  const { lines } = verifyDir(dir);
  layouts.forEach(([name, , expected], i) => {
    const verdict = (/ verdict=(\S+)$/.exec(lines.find((l) => l.startsWith(`${dir} run=${i + 1} grader=lenh-chuan `)) || "") || [])[1];
    const gate = !commandFailing(path.join(T, "kept", name, "sealed", "home", "cwd"));
    ok(`gate-agree-${name}`, verdict === (gate ? "yes" : "no") && gate === expected, `verdict=${verdict} gate=${gate} expected=${expected}`);
  });

  const c = scaffold(path.join(T, "c"));
  const intact = regexGrader("ke-hoach-nguyen", c);
  const task = path.join(c, TASK_PATH);
  fs.writeFileSync(task, fs.readFileSync(task, "utf8").replace(`- Command: \`${PRE}\`\n`, ""));
  ok("plan-edit-caught", intact && !regexGrader("ke-hoach-nguyen", c));
} catch (e) {
  fails.push(`exception: ${e.message}`);
  console.log(`FAIL exception ${e.message}`);
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}
if (fails.length) { console.error(`check FAIL: ${fails.join(", ")}`); process.exit(1); }
