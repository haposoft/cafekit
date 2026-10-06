#!/usr/bin/env node
// So số sau sửa (sau-<case>-<model>) với số gốc (base-<case>-<model>) của evals/fix, không kết luận.
// Mỗi ô và mỗi thước không bắt đầu bằng `dem-`:
//   cell=<case>-<model> grader=<g> base=<x>/<n> after=<y>/<m> p=<p> <primary|watch>
// đếm trên các lượt không có error và không có skippedPaidGraders; `primary` cho do-truoc và test-truoc-sua, mọi thước
// khác là theo dõi hồi quy. p là Fisher exact hai phía như evals/compare-code-review.mjs, in bằng toPrecision(4).
// Rồi mỗi ô một dòng
//   cell=<case>-<model> cost base=<usd> after=<usd> seconds base=<median> after=<median> errored base=<k> after=<k>
// với cost = costUsd cộng judgeCostUsd của mọi lượt, seconds = trung vị durationSeconds của các lượt được đếm.
//   node evals/compare-fix.mjs                 (tám ô; thoát 1 khi thiếu ô hay ô partial)
//   node evals/compare-fix.mjs --cell <case>-<model>
//   node evals/compare-fix.mjs --base-only     (base- ở cả hai phía; chỉ thoát 0 khi mọi p=1.000)
//   node evals/compare-fix.mjs --self-test
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const results = path.join(root, "evals", "results", "fix");

const CASES = ["red-truoc", "sua-test-cho-xanh", "cham-hop-dong", "loi-don-gian"];
const MODELS = ["sonnet", "opus"];
const PRIMARY = ["do-truoc", "test-truoc-sua"];

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

// -- a result directory: counted runs, errored runs, cost and median seconds --
function readCell(dir) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const all = result.cases[0].arms.with;
  const runs = all.filter((x) => !x.error && !x.skippedPaidGraders);
  const cost = all.reduce((s, x) => s + (x.costUsd || 0) + (x.judgeCostUsd || 0), 0);
  const secs = runs.map((x) => x.durationSeconds || 0).sort((a, b) => a - b);
  const mid = secs.length / 2;
  const median = secs.length === 0 ? 0 : secs.length % 2 ? secs[Math.floor(mid)] : (secs[mid - 1] + secs[mid]) / 2;
  return { result, runs, errored: all.filter((x) => x.error).length, cost, median };
}
function count(cell, grader) {
  const passed = cell.runs.filter((x) => { const g = x.graders.find((y) => y.name === grader); return g && g.passed; }).length;
  return { passed, of: cell.runs.length };
}
function graderNames(...cells) {
  const names = [];
  for (const c of cells) for (const r of c.runs) for (const g of r.graders) if (!g.name.startsWith("dem-") && !names.includes(g.name)) names.push(g.name);
  return names;
}

// -- one cell's lines; returns false when the cell cannot be compared --
function compareCell(caseName, model, { baseOnly }) {
  const cellName = `${caseName}-${model}`;
  const baseDir = path.join(results, `base-${cellName}`);
  const afterDir = path.join(results, `${baseOnly ? "base" : "sau"}-${cellName}`);
  let ok = true;
  for (const [side, dir] of [["base", baseDir], ["after", afterDir]]) {
    if (!fs.existsSync(path.join(dir, "result.json"))) { console.log(`cell=${cellName} missing ${side} ${path.relative(root, dir)}`); ok = false; }
  }
  if (!ok) return false;
  const base = readCell(baseDir);
  const after = readCell(afterDir);
  for (const [side, c] of [["base", base], ["after", after]]) {
    if (c.result.partial !== false) { console.log(`cell=${cellName} ${side} partial=${c.result.partial}`); ok = false; }
  }
  for (const g of graderNames(base, after)) {
    const b = count(base, g), a = count(after, g);
    const p = fisher(b.passed, b.of, a.passed, a.of);
    console.log(`cell=${cellName} grader=${g} base=${b.passed}/${b.of} after=${a.passed}/${a.of} p=${fmt(p)} ${PRIMARY.includes(g) ? "primary" : "watch"}`);
    if (baseOnly && fmt(p) !== "1.000") ok = false;
  }
  console.log(`cell=${cellName} cost base=${base.cost.toFixed(4)} after=${after.cost.toFixed(4)} seconds base=${base.median} after=${after.median} errored base=${base.errored} after=${after.errored}`);
  return ok;
}

const args = process.argv.slice(2);

if (args[0] === "--self-test") {
  const cases = [[10, 10, 0, 10, "0.00001083"], [5, 10, 5, 10, "1.000"]];
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
  if (!m || !CASES.includes(m[1])) { console.error("usage: node evals/compare-fix.mjs --cell <case>-<sonnet|opus>"); process.exit(2); }
  process.exit(compareCell(m[1], m[2], { baseOnly: false }) ? 0 : 1);
}

const baseOnly = args[0] === "--base-only";
if (args.length && !baseOnly) { console.error("usage: node evals/compare-fix.mjs [--base-only | --cell <case>-<model> | --self-test]"); process.exit(2); }
let bad = 0;
for (const c of CASES) for (const m of MODELS) if (!compareCell(c, m, { baseOnly })) bad++;
process.exit(bad ? 1 : 0);
