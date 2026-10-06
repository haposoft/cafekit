#!/usr/bin/env node
// Trần ngân sách của gói research-repair: $260 cho code-review và research cộng lại (quyết định GATE-SCOPE), hay
// --cap theo quyết định sau pilot. evals/research/budget.mjs nằm trong bộ đo được ghim và tự thoát 1 khi tổng vượt
// $230 của nó, nên script này chỉ đọc dòng `spent=` nó in ra, bất kể mã thoát.
//   spent                      in spent so với cap
//   check <next>               thoát 1 khi spent + next vượt cap
//   ceiling <model> <route>    max(6, ⌈12 × costUsd cao nhất⌉) trên bốn pilot sau-pilot-* của model và đường, đọc
//                              theo tên hiện tại (bản chạy lại khi có -lan1), sạch hay không; không có trần trên
//   estimate [--runs n] [--cells a,b] [--print-only]
//                              spent + runs × costUsd pilot của các ô tiên quyết còn lại + ceiling của ô Command, và
//                              max-check = tổng cao nhất mà một lần `check` còn lại sẽ in theo thứ tự chạy của task 04
//   --self-test
// Mọi lệnh nhận --cap <n> và --root <thư mục results> (mặc định evals/results).
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CASES = ["da-co-quyet-dinh", "da-co-quyet-dinh-agent", "nguon-cu-mau-thuan", "nguon-cu-mau-thuan-agent", "khong-luu-khong-sua", "khong-luu-khong-sua-agent", "chon-kien-truc-theo-rang-buoc", "chon-kien-truc-theo-rang-buoc-agent"];
const ORDER = CASES.flatMap((c) => ["sonnet", "opus"].map((m) => `${c}-${m}`));
const COMMAND_CELL = "chon-kien-truc-theo-rang-buoc-agent-opus";
const modelOf = (cell) => cell.slice(cell.lastIndexOf("-") + 1);
const routeOf = (cell) => cell.slice(0, cell.lastIndexOf("-")).endsWith("-agent") ? "agent" : "skill";

function spent(root) {
  const r = spawnSync(process.execPath, [path.join(here, "research", "budget.mjs"), "0", "--root", root], { encoding: "utf8" });
  const m = (r.stdout || "").match(/^spent=(\S+) /m);
  const x = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(x)) throw new Error("no spent= line from evals/research/budget.mjs");
  return x;
}

function pilot(root, cell) {
  const f = path.join(root, "research", `sau-pilot-${cell}`, "result.json");
  let r;
  try { r = JSON.parse(fs.readFileSync(f, "utf8")); } catch { throw new Error(`missing pilot sau-pilot-${cell}`); }
  const runs = (r.cases && r.cases[0] && r.cases[0].arms && r.cases[0].arms.with) || [];
  if (runs.length !== 1) throw new Error(`pilot sau-pilot-${cell} does not hold exactly one run`);
  return { runCost: runs[0].costUsd || 0, cost: r.costUsd || 0 };
}

function ceiling(root, model, route) {
  if (!["sonnet", "opus"].includes(model) || !["skill", "agent"].includes(route)) throw new Error("usage: ceiling <sonnet|opus> <skill|agent>");
  const cells = ORDER.filter((c) => modelOf(c) === model && routeOf(c) === route);
  return Math.max(6, Math.ceil(12 * Math.max(...cells.map((c) => pilot(root, c).runCost))));
}

function estimate(root, runs, cells) {
  const x = spent(root);
  const listed = ORDER.filter((c) => cells.includes(c));
  const done = (c) => fs.existsSync(path.join(root, "research", `sau-${c}`));
  const c = listed.includes(COMMAND_CELL) && !done(COMMAND_CELL) ? ceiling(root, "opus", "agent") : 0;
  let acc = x, maxCheck = 0;
  for (const cell of listed) {
    if (cell === COMMAND_CELL || done(cell)) continue;
    maxCheck = Math.max(maxCheck, acc + ceiling(root, modelOf(cell), routeOf(cell)) + c);
    acc += runs * pilot(root, cell).cost;
  }
  if (c) maxCheck = Math.max(maxCheck, acc + c);
  return { x, y: acc - x, c, total: acc + c, maxCheck };
}

// Returns { out, code }.
function run(argv) {
  const a = [...argv];
  const take = (flag, dflt) => { const i = a.indexOf(flag); if (i < 0) return dflt; const v = a[i + 1]; a.splice(i, 2); return v; };
  const root = take("--root", path.join(here, "results"));
  const cap = Number(take("--cap", "260"));
  const runs = Number(take("--runs", "10"));
  const cellsArg = take("--cells", null);
  const printOnly = a.includes("--print-only") ? (a.splice(a.indexOf("--print-only"), 1), true) : false;
  if (!Number.isFinite(cap) || !Number.isFinite(runs)) return { out: "budget-research-sau: --cap and --runs take numbers", code: 2 };
  try {
    if (a[0] === "spent") return { out: `budget: spent=${spent(root)} cap=${cap}`, code: 0 };
    if (a[0] === "check") {
      const n = a[1] === undefined || a[1].trim() === "" ? NaN : Number(a[1]);
      if (!Number.isFinite(n)) return { out: `budget-research-sau: next must be a number, got ${JSON.stringify(a[1])}`, code: 1 };
      const x = spent(root);
      return { out: `budget: spent=${x} next=${n} total=${x + n} cap=${cap}`, code: x + n > cap ? 1 : 0 };
    }
    if (a[0] === "ceiling") return { out: String(ceiling(root, a[1], a[2])), code: 0 };
    if (a[0] === "estimate") {
      const cells = cellsArg ? cellsArg.split(",").filter(Boolean) : ORDER;
      const unknown = cells.filter((c) => !ORDER.includes(c));
      if (unknown.length) return { out: `budget-research-sau: unknown cells ${unknown.join(",")}`, code: 2 };
      const e = estimate(root, runs, cells);
      const over = e.total > cap || e.maxCheck > cap;
      const r4 = (v) => Number(v.toFixed(4));
      return { out: `estimate: spent=${r4(e.x)} remaining=${r4(e.y)} reserve=${e.c} total=${r4(e.total)} max-check=${r4(e.maxCheck)} cap=${cap}`, code: over && !printOnly ? 1 : 0 };
    }
  } catch (err) {
    return { out: `budget-research-sau: ${err.message}`, code: 1 };
  }
  return { out: "usage: node evals/budget-research-sau.mjs <spent | check <next> | ceiling <model> <route> | estimate [--runs n] [--cells a,b] [--print-only]> [--cap n] [--root dir] | --self-test", code: 2 };
}

function selfTest() {
  let failed = 0;
  const expect = (label, argv, code, text) => {
    const r = run(argv);
    const ok = r.code === code && (text === undefined || r.out.includes(text));
    console.log(`${ok ? "ok" : "fail"}: ${label} → ${r.out} (exit ${r.code})`);
    if (!ok) failed++;
  };
  const make = (codeReview, pilotCost) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "budget-research-sau-"));
    const put = (rel, body) => { fs.mkdirSync(path.join(root, rel), { recursive: true }); fs.writeFileSync(path.join(root, rel, "result.json"), JSON.stringify(body)); };
    put("code-review/a", { costUsd: codeReview });
    for (const c of ORDER) put(`research/sau-pilot-${c}`, { costUsd: pilotCost, partial: false, cases: [{ arms: { with: [{ costUsd: pilotCost }] } }] });
    return root;
  };
  const roots = [];
  try {
    const a = make(190, 0.25); roots.push(a);
    expect("spent 194: check 66 passes at the cap", ["check", "66", "--root", a], 0, "total=260 cap=260");
    expect("spent 194: check 67 stops", ["check", "67", "--root", a], 1, "total=261");
    expect("ceiling opus agent at $0.25 pilots", ["ceiling", "opus", "agent", "--root", a], 0, "6");
    expect("estimate at $0.25 pilots", ["estimate", "--root", a], 0, "remaining=37.5 reserve=6 total=237.5 max-check=241 cap=260");
    const b = make(190, 0.5); roots.push(b);
    expect("estimate at $0.5 pilots passes the cap", ["estimate", "--root", b], 1, "remaining=75 reserve=6 total=279 max-check=280 cap=260");
    expect("estimate at $0.5 pilots under --cap 300", ["estimate", "--cap", "300", "--root", b], 0, "max-check=280 cap=300");
    expect("estimate --print-only exits 0 above the cap", ["estimate", "--print-only", "--root", b], 0, "total=279");
    const lan1 = path.join(a, "research", "sau-pilot-da-co-quyet-dinh-agent-opus");
    fs.renameSync(lan1, `${lan1}-lan1`);
    fs.mkdirSync(lan1);
    fs.writeFileSync(path.join(lan1, "result.json"), JSON.stringify({ costUsd: 1, partial: false, cases: [{ arms: { with: [{ costUsd: 1, error: "timed out" }] } }] }));
    expect("a re-run pilot with an errored run still gives its cost", ["ceiling", "opus", "agent", "--root", a], 0, "12");
    const d = make(231, 0.25); roots.push(d);
    expect("spent 235 is read although budget.mjs exits 1", ["spent", "--root", d], 0, "spent=235 cap=260");
    expect("spent 235: check 25 passes", ["check", "25", "--root", d], 0, "total=260");
    expect("spent 235: check 26 stops", ["check", "26", "--root", d], 1, "total=261");
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

const argv = process.argv.slice(2);
if (argv[0] === "--self-test") process.exit(selfTest());
const r = run(argv);
(r.code === 2 || r.out.startsWith("budget-research-sau:") ? console.error : console.log)(r.out);
process.exit(r.code);
