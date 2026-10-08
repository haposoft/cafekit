#!/usr/bin/env node
// So số sau sửa (sau-<case>-<model>) với số gốc (base-<case>-<model>) của evals/code-review, không kết luận.
// Mỗi ô và mỗi thước chính (danh sách ở specs/archive/code-review-eval-baseline/task-02-ten-review-cases.md, mục Graders):
//   cell=<case>-<model> grader=<g> base=<x>/<n> after=<y>/<m> p=<p>
// đếm trên các lượt không có error, p là Fisher exact hai phía của bảng 2×2 (cộng mọi xác suất siêu bội không lớn
// hơn xác suất quan sát, dung sai tương đối 1e-7), chặn ở 1, in bằng toPrecision(4). Với ô đường agent còn in
//   cell=<case>-<model> r.<g> base=<x> after=<y> of=<số báo cáo gốc>/<số báo cáo sau>
// phía gốc đọc từ dòng thư mục của verify-runs trong Receipt của task 03 gói số gốc (thư mục giữ lại đã xóa), phía
// sau từ `evals/code-review/verify-runs.mjs` chạy trên thư mục sau-.
//   node evals/compare-code-review.mjs                 (hai mươi ô; thoát 1 khi thiếu ô, hay ô partial không có -lan1)
//   node evals/compare-code-review.mjs --cell <case>-<model>
//   node evals/compare-code-review.mjs --base-only     (base- ở cả hai phía; chỉ thoát 0 khi mọi p=1.000)
//   node evals/compare-code-review.mjs --self-test
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const results = path.join(root, "evals", "results", "code-review");
const baselineReceipt = path.join(root, "specs", "code-review-eval-baseline", "task-03-measure-baseline.md");

const CASES = ["giam-gia", "giam-gia-agent", "khong-co-loi", "khong-co-loi-agent", "chi-loi-nho", "chi-loi-nho-agent", "sua-ho", "sua-ho-agent", "thieu-tieu-chi", "thieu-tieu-chi-agent"];
const MODELS = ["sonnet", "opus"];
const SHARED = ["khong-chay-test", "khong-khai-test-xanh", "khong-commit", "khong-mo-pr", "khong-sua-san-pham-edit", "khong-sua-san-pham-write",
  "khong-doc-dap-an-read", "khong-doc-dap-an-grep", "khong-doc-dap-an-glob", "khong-doc-dap-an-bash"];
const BY_FIXTURE = {
  "giam-gia": ["bat-bien", "verdict-fail", "khong-bat-lam-tron", "con-nguyen"],
  "khong-co-loi": ["khong-fail", "khong-bat-nang", "khong-bat-injection"],
  "chi-loi-nho": ["log-la-low", "log-khong-nang"],
  "sua-ho": ["bat-phep-gan", "verdict-fail", "con-nguyen"],
  "thieu-tieu-chi": ["neu-ac-thieu", "khong-pass"],
};

function primaryOf(caseName) {
  const fixture = caseName.replace(/-agent$/, "");
  const agentPath = fixture !== caseName;
  return [...SHARED, ...(agentPath ? ["co-goi-agent"] : ["co-goi-skill", "co-header"]), ...BY_FIXTURE[fixture]];
}

// -- Fisher exact, two-sided --
const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
function fisher(x, n, y, m) {
  const a = x, b = n - x, c = y, d = m - y;
  const row1 = a + b, row2 = c + d, col1 = a + c;
  const observed = hyper(a, b, c, d);
  let p = 0;
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) {
    const q = hyper(k, row1 - k, col1 - k, row2 - col1 + k);
    if (q <= observed * (1 + 1e-7)) p += q;
  }
  return Math.min(1, p);
}
const fmt = (p) => p.toPrecision(4);

// -- a result directory's grader counts over runs without an error --
function readCell(dir) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const runs = r.cases[0].arms.with.filter((x) => !x.error);
  return { result: r, runs };
}
function count(cell, grader) {
  const passed = cell.runs.filter((x) => { const g = x.graders.find((y) => y.name === grader); return g && g.passed; }).length;
  return { passed, of: cell.runs.length };
}

// -- r.<grader> values: a verify-runs directory line --
function parseDirLine(line) {
  const r = {};
  for (const m of line.matchAll(/ r\.([a-z0-9-]+)=(\d+)/g)) r[m[1]] = Number(m[2]);
  const reports = line.match(/ report-runs=(\d+)/);
  return reports && Object.keys(r).length ? { r, reports: Number(reports[1]) } : null;
}
let receiptText = null;
function baselineR(cellName) {
  if (receiptText === null) {
    const t = fs.readFileSync(baselineReceipt, "utf8");
    const receipt = t.slice(t.indexOf("\n## Receipt"));
    const open = receipt.indexOf("\n```text\n");
    const close = receipt.indexOf("\n```\n", open + 1);
    receiptText = open < 0 || close < 0 ? "" : receipt.slice(open, close);
  }
  const prefix = `evals/results/code-review/base-${cellName} runs=`;
  const line = receiptText.split("\n").find((l) => l.startsWith(prefix));
  return line ? parseDirLine(line) : null;
}
function afterR(dir) {
  const v = spawnSync(process.execPath, [path.join(here, "code-review", "verify-runs.mjs"), dir], { cwd: root, encoding: "utf8" });
  const line = (v.stdout || "").split("\n").find((l) => l.startsWith(`${dir} runs=`));
  return v.status === 0 && line ? parseDirLine(line) : null;
}

// -- one cell's lines; returns false when the cell cannot be compared --
function compareCell(caseName, model, { baseOnly }) {
  const cellName = `${caseName}-${model}`;
  const baseDir = path.join(results, `base-${cellName}`);
  const afterRel = `evals/results/code-review/${baseOnly ? "base" : "sau"}-${cellName}`;
  const afterDir = path.join(root, afterRel);
  let ok = true;
  for (const [side, dir] of [["base", baseDir], ["after", afterDir]]) {
    if (!fs.existsSync(path.join(dir, "result.json"))) { console.log(`cell=${cellName} missing ${side} ${path.relative(root, dir)}`); ok = false; }
  }
  if (!ok) return false;
  const base = readCell(baseDir);
  const after = readCell(afterDir);
  if (after.result.partial && !fs.existsSync(`${afterDir}-lan1`)) { console.log(`cell=${cellName} partial with no -lan1 sibling`); ok = false; }
  for (const g of primaryOf(caseName)) {
    const b = count(base, g), a = count(after, g);
    const p = fisher(b.passed, b.of, a.passed, a.of);
    console.log(`cell=${cellName} grader=${g} base=${b.passed}/${b.of} after=${a.passed}/${a.of} p=${fmt(p)}`);
    if (baseOnly && fmt(p) !== "1.000") ok = false;
  }
  if (caseName.endsWith("-agent")) {
    const br = baselineR(cellName);
    if (!br) { console.log(`cell=${cellName} r. baseline line not found in ${path.relative(root, baselineReceipt)}`); return false; }
    if (baseOnly) {
      for (const [g, x] of Object.entries(br.r)) console.log(`cell=${cellName} r.${g} base=${x} of=${br.reports}`);
    } else {
      const ar = afterR(afterRel);
      if (!ar) { console.log(`cell=${cellName} r. after side unreadable: verify-runs.mjs failed on ${afterRel}`); return false; }
      for (const g of Object.keys(br.r)) console.log(`cell=${cellName} r.${g} base=${br.r[g]} after=${ar.r[g] ?? "none"} of=${br.reports}/${ar.reports}`);
    }
  }
  return ok;
}

const args = process.argv.slice(2);

if (args[0] === "--self-test") {
  const cases = [[10, 10, 0, 10, "0.00001083"], [5, 10, 5, 10, "1.000"], [9, 10, 1, 10, "0.001093"]];
  let bad = 0;
  for (const [x, n, y, m, want] of cases) {
    const got = fmt(fisher(x, n, y, m));
    console.log(`fisher ${x}/${n} vs ${y}/${m} p=${got}`);
    if (got !== want) { console.log(`  expected p=${want}`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}

if (args[0] === "--cell") {
  const m = /^(.+)-(sonnet|opus)$/.exec(args[1] || "");
  if (!m || !CASES.includes(m[1])) { console.error("usage: node evals/compare-code-review.mjs --cell <case>-<sonnet|opus>"); process.exit(2); }
  process.exit(compareCell(m[1], m[2], { baseOnly: false }) ? 0 : 1);
}

const baseOnly = args[0] === "--base-only";
if (args.length && !baseOnly) { console.error("usage: node evals/compare-code-review.mjs [--base-only | --cell <case>-<model> | --self-test]"); process.exit(2); }
let bad = 0;
for (const c of CASES) for (const m of MODELS) if (!compareCell(c, m, { baseOnly })) bad++;
process.exit(bad ? 1 : 0);
