#!/usr/bin/env node
// Đọc lại workspace được giữ lại (--keep-temp) của từng lượt develop và chấm các thước loại V (gói skill-gotchas-eval, plan D-03)
// bằng chính mã nguồn của gate: checkWorkflowTaskReceipt chạy trên một bản chép của workspace, không bao giờ trên bản giữ lại.
// Cùng định dạng với evals/sync/verify-run.mjs để evals/lean/compare.mjs gộp được:
//   instrument=<dấu của evals/develop>
//   <dir> run=<i> grader=<tên> verdict=<yes|no|error>
//   <dir> runs=<n> disagreements=<k>
// k là số lượt không đọc được workspace (mọi thước của lượt đó là `error`). Thoát 1 khi có lượt như vậy.
// Workspace là thư mục `home/cwd` có .git dưới dirname(dirname(tracePath)); khi bản trong /private/tmp đã mất (khởi động lại
// máy) thì đọc bản chép bền evals/results/develop/kept/<ô>/run-NN.
//   node evals/develop/verify-run.mjs <result dir>...
//   node evals/develop/verify-run.mjs --self-test
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const SCRIPTS = path.resolve(HERE, "../../packages/spec/src/claude/scripts");
const FEATURE = "doi-loi-chao";
const TASK = "task-01-doi-loi-chao.md";
const require = createRequire(import.meta.url);

// Lỗi của Receipt theo đúng phép kiểm của Stop gate trên workspace ws (mảng rỗng = gate xanh).
export function gateFailures(ws) {
  const policy = require(path.join(SCRIPTS, "workflow-policy.cjs"));
  const receipt = require(path.join(SCRIPTS, "spec-receipt.cjs"));
  const featureDir = path.join(ws, "specs", FEATURE);
  const ctx = policy.deriveRuntimeContext({ projectRoot: ws, specsRoot: path.join(ws, "specs"), specFile: path.join(featureDir, "plan.md"),
    featureName: FEATURE, runtimeSession: "develop-eval" });
  return receipt.checkWorkflowTaskReceipt(featureDir, TASK, ctx, policy).failures.slice().sort();
}

// Ba lỗi gate dùng để nói Receipt không mang đúng lệnh chuẩn: không có Receipt, thiếu Command, hay Command khác lệnh chuẩn.
export const COMMAND_FAILURES = ["missing_receipt", "command", "command_identity"];
export const GRADERS = {
  "lenh-tien-quyet": {
    "lenh-chuan": (ctx) => !gateFailures(ctx.ws).some((f) => COMMAND_FAILURES.includes(f)),
  },
};

export function instrumentDigest(root = HERE) {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) files.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  };
  walk(root);
  const h = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
  return crypto.createHash("sha256").update(files.sort().map((f) => `${h(f)}  ${f}\n`).join("")).digest("hex");
}

export function findWorkspace(kept) {
  if (!fs.existsSync(kept)) return null;
  // Harness khoá thư mục giữ lại (mode 000); như evals/develop/save-runs.mjs, mở quyền đọc trước.
  spawnSync("chmod", ["-R", "u+rwX", kept]);
  const stack = [kept];
  while (stack.length) {
    const dir = stack.pop();
    if (/(^|\/)home\/cwd$/.test(dir) && fs.existsSync(path.join(dir, ".git"))) return dir;
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) if (e.isDirectory() && e.name !== ".git") stack.push(path.join(dir, e.name));
  }
  return null;
}

export function copyWorkspace(ws) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "develop-verify-"));
  const dst = path.join(tmp, "cwd");
  fs.cpSync(ws, dst, { recursive: true, verbatimSymlinks: true });
  return { ws: dst, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

export function verifyDir(dir, registry = GRADERS) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const kase = result.cases[0];
  const graders = registry[kase.name];
  if (!graders) throw new Error(`no V graders registered for case ${kase.name}`);
  const lines = [];
  let unreadable = 0;
  const runs = kase.arms.with;
  runs.forEach((run, i) => {
    let ctx = null, copy = null;
    try {
      if (!run.tracePath) throw new Error("no trace");
      const copyDir = path.join(path.dirname(dir), "kept", path.basename(dir), `run-${String(i + 1).padStart(2, "0")}`);
      const live = path.dirname(path.dirname(run.tracePath));
      const ws = findWorkspace(fs.existsSync(run.tracePath) ? live : copyDir);
      if (!ws) throw new Error("workspace not found");
      copy = copyWorkspace(ws);
      ctx = { ws: copy.ws };
    } catch {
      unreadable++;
    }
    for (const name of Object.keys(graders)) {
      let verdict = "error";
      if (ctx) { try { verdict = graders[name](ctx) ? "yes" : "no"; } catch { verdict = "error"; } }
      lines.push(`${dir} run=${i + 1} grader=${name} verdict=${verdict}`);
    }
    if (copy) { try { copy.cleanup(); } catch { /* bản chép tạm để lại không đổi verdict */ } }
  });
  lines.push(`${dir} runs=${runs.length} disagreements=${unreadable}`);
  return { lines, unreadable };
}

// ---- self-test: workspace thật từ scaffold, Receipt viết tay, bố cục giữ lại như harness ----
const TASK_PATH = `specs/${FEATURE}/${TASK}`;
export function scaffold(dest) {
  fs.mkdirSync(dest, { recursive: true });
  const r = spawnSync("bash", [path.join(HERE, "lenh-tien-quyet", "scaffold.sh")], { cwd: dest, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`scaffold failed: ${r.stderr}`);
  return dest;
}
// Thay phần Receipt của fixture (tiêu đề và dòng chú thích) bằng `receipt`; null thì bỏ hẳn mục Receipt.
export function writeReceipt(ws, receipt) {
  const file = path.join(ws, TASK_PATH);
  const text = fs.readFileSync(file, "utf8");
  const at = text.lastIndexOf("\n## Receipt");
  fs.writeFileSync(file, text.slice(0, at + 1) + (receipt === null ? "" : `## Receipt\n${receipt}`));
}

function selfTest() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "develop-verify-self-"));
  const fails = [];
  const ok = (name, cond, detail = "") => { if (cond) console.log(`ok ${name}`); else { console.log(`FAIL ${name} ${detail}`); fails.push(name); } };
  try {
    const receipt = (command) => `Verification: PASS\nCommand: ${command}\nExit: 0\nBase: ${"a".repeat(40)}\nHead: ${"b".repeat(64)}\n\`\`\`text\n✔ greet\n\`\`\`\n`;
    const mkRun = (name, command) => {
      const kept = path.join(T, name);
      const ws = scaffold(path.join(kept, "sealed", "home", "cwd"));
      if (command !== undefined) writeReceipt(ws, command === null ? null : receipt(command));
      fs.mkdirSync(path.join(kept, "out"), { recursive: true });
      fs.writeFileSync(path.join(kept, "out", "trace.jsonl"), "");
      return { tracePath: path.join(kept, "out", "trace.jsonl") };
    };
    const dir = path.join(T, "results", "cell");
    fs.mkdirSync(dir, { recursive: true });
    const canonical = mkRun("canonical", "node --test test/greet.test.js");
    const first = mkRun("first", "node --check src/greet.js");
    const missing = mkRun("missing", null);
    const gone = { tracePath: path.join(T, "gone", "out", "trace.jsonl") };
    // Bản trong /private/tmp đã mất nhưng bản chép bền kept/<ô>/run-05 còn: verdict vẫn đọc được.
    const durable = mkRun("durable", "node --test test/greet.test.js");
    fs.cpSync(path.dirname(path.dirname(durable.tracePath)), path.join(T, "results", "kept", "cell", "run-05"), { recursive: true });
    fs.rmSync(path.dirname(path.dirname(durable.tracePath)), { recursive: true, force: true });
    const untouched = mkRun("untouched");
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ name: "lenh-tien-quyet", arms: { with: [canonical, first, missing, gone, durable, untouched, {}] } }] }));
    const { lines, unreadable } = verifyDir(dir);
    const v = (run) => (/ verdict=(\S+)$/.exec(lines.find((l) => l.startsWith(`${dir} run=${run} grader=lenh-chuan `)) || "") || [])[1];
    ok("canonical-receipt-yes", v(1) === "yes", v(1));
    ok("first-command-no", v(2) === "no", v(2));
    ok("missing-receipt-no", v(3) === "no", v(3));
    ok("gone-workspace-error", v(4) === "error", v(4));
    ok("durable-copy-read", v(5) === "yes", v(5));
    ok("untouched-fixture-no", v(6) === "no", v(6));
    ok("no-trace-error", v(7) === "error", v(7));
    ok("summary-line", lines[lines.length - 1] === `${dir} runs=7 disagreements=2` && unreadable === 2, lines[lines.length - 1]);
    // Mọi dòng verdict phải đọc được bằng đúng regex của evals/lean/compare.mjs mergeVerify.
    const parsed = lines.filter((l) => / run=(\d+) grader=(\S+) verdict=(yes|no|error)$/.test(l));
    ok("lines-parse-like-compare", parsed.length === 7 && parsed.every((l, k) => l.startsWith(`${dir} run=${k + 1} grader=lenh-chuan verdict=`)), parsed.join(" | "));
    const before = fs.readFileSync(path.join(T, "canonical", "sealed", "home", "cwd", TASK_PATH), "utf8");
    verifyDir(dir, { "lenh-tien-quyet": { x: (ctx) => { fs.writeFileSync(path.join(ctx.ws, TASK_PATH), "edited"); return true; } } });
    ok("kept-workspace-never-edited", fs.readFileSync(path.join(T, "canonical", "sealed", "home", "cwd", TASK_PATH), "utf8") === before);
    const boom = verifyDir(dir, { "lenh-tien-quyet": { x: () => { throw new Error("boom"); } } });
    ok("throwing-grader-is-error", boom.lines.includes(`${dir} run=1 grader=x verdict=error`));
    ok("instrument-digest-hex", /^[0-9a-f]{64}$/.test(instrumentDigest()));
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
  if (fails.length) { console.error(`self-test FAIL: ${fails.join(", ")}`); process.exit(1); }
  console.log("self-test ok");
}

const isMain = () => { try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(SELF); } catch { return false; } };
if (isMain()) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") selfTest();
  else if (!args.length) { console.error("usage: node evals/develop/verify-run.mjs <result dir>... | --self-test"); process.exit(2); }
  else {
    console.log(`instrument=${instrumentDigest()}`);
    let bad = 0;
    for (const dir of args) {
      const { lines, unreadable } = verifyDir(dir);
      console.log(lines.join("\n"));
      bad += unreadable;
    }
    process.exit(bad ? 1 : 0);
  }
}
