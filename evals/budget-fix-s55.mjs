#!/usr/bin/env node
// Trần ngân sách chung $60 của gói fix-repair khi có thêm phần đo sonnet (quyết định GATE-SCOPE). spent = số
// `spent=` mà evals/budget-fix-sau.mjs in ra (phần opus của task 03, đọc bất kể mã thoát) cộng, trên mọi
// result.json nằm ngay dưới một thư mục <root>/evals/results/fix/, costUsd tầng trên với judgeCostUsd của từng lượt.
// So với cap bằng đúng số đã in (làm tròn 4 chữ số).
//   spent           in spent so với cap; thoát 1 khi spent vượt cap
//   check <next>    thoát 1 khi spent + next vượt cap, hay khi next không phải số
//   estimate        dự toán tám ô trước khi chạy ô nào: mỗi ô min(6, 15 × chi phí pilot của nó) (mười lượt, dư 1.5),
//                   pilot-goc-<case> cho base-<case>, pilot-sau-<case> cho sau-<case>; thoát 1 khi tổng vượt cap
//                   hay thiếu pilot
//   --self-test
// Mọi lệnh nhận --root <dir> (mặc định evals/results/fix-s55/root) và --cap <n> (mặc định 60).
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CASES = ["red-truoc", "sua-test-cho-xanh", "cham-hop-dong", "loi-don-gian"];
const r4 = (v) => Number(v.toFixed(4));

function opusSpent() {
  const r = spawnSync(process.execPath, [path.join(here, "budget-fix-sau.mjs"), "spent"], { encoding: "utf8" });
  const m = (r.stdout || "").match(/^budget: spent=(\S+) /m);
  const x = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(x)) throw new Error("no spent= line from evals/budget-fix-sau.mjs");
  return x;
}
const costOf = (r) => (r.costUsd || 0) + (r.cases || []).reduce((s, c) => s + ((c.arms && c.arms.with) || []).reduce((t, w) => t + (w.judgeCostUsd || 0), 0), 0);
function sonnetSpent(root) {
  const dir = path.join(root, "evals", "results", "fix");
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, d.name, "result.json");
    if (d.isDirectory() && fs.existsSync(f)) total += costOf(JSON.parse(fs.readFileSync(f, "utf8")));
  }
  return total;
}
function estimateCells(root) {
  let p = 0;
  for (const side of ["goc", "sau"]) for (const c of CASES) {
    const f = path.join(root, "evals", "results", "fix", `pilot-${side}-${c}-sonnet`, "result.json");
    if (!fs.existsSync(f)) throw new Error(`missing pilot pilot-${side}-${c}-sonnet`);
    p += Math.min(6, 15 * costOf(JSON.parse(fs.readFileSync(f, "utf8"))));
  }
  return p;
}

// Returns { out, code }.
function run(argv, opus = opusSpent) {
  const a = [...argv];
  const take = (flag, dflt) => { const i = a.indexOf(flag); if (i < 0) return dflt; const v = a[i + 1]; a.splice(i, 2); return v; };
  const root = take("--root", path.join(here, "results", "fix-s55", "root"));
  const cap = Number(take("--cap", "60"));
  if (!Number.isFinite(cap)) return { out: "budget-fix-s55: --cap takes a number", code: 2 };
  try {
    if (a[0] === "spent") {
      const x = r4(opus() + sonnetSpent(root));
      return { out: `budget: spent=${x} cap=${cap}`, code: x > cap ? 1 : 0 };
    }
    if (a[0] === "check") {
      const n = a[1] === undefined || a[1].trim() === "" ? NaN : Number(a[1]);
      if (!Number.isFinite(n)) return { out: `budget-fix-s55: next must be a number, got ${JSON.stringify(a[1])}`, code: 1 };
      const x = r4(opus() + sonnetSpent(root)), total = r4(x + n);
      return { out: `budget: spent=${x} next=${n} total=${total} cap=${cap}`, code: total > cap ? 1 : 0 };
    }
    if (a[0] === "estimate") {
      const x = r4(opus() + sonnetSpent(root)), p = r4(estimateCells(root)), total = r4(x + p);
      return { out: `estimate: spent=${x} cells=${p} total=${total} cap=${cap}`, code: total > cap ? 1 : 0 };
    }
  } catch (err) {
    return { out: `budget-fix-s55: ${err.message}`, code: 1 };
  }
  return { out: "usage: node evals/budget-fix-s55.mjs <spent | check <next> | estimate> [--root dir] [--cap n] | --self-test", code: 2 };
}

function selfTest() {
  let failed = 0;
  const expect = (label, argv, code, text) => {
    const r = run(argv, () => 10);
    const ok = r.code === code && r.out.includes(text);
    console.log(`${ok ? "ok" : "fail"}: ${label} → ${r.out} (exit ${r.code})`);
    if (!ok) failed++;
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "budget-fix-s55-"));
  try {
    const put = (name, body) => { const d = path.join(root, "evals", "results", "fix", name); fs.mkdirSync(d, { recursive: true }); if (body) fs.writeFileSync(path.join(d, "result.json"), JSON.stringify(body)); };
    expect("empty root: spent is the opus part", ["spent", "--root", root], 0, "spent=10 cap=60");
    expect("empty root: estimate without pilots stops", ["estimate", "--root", root], 1, "missing pilot pilot-goc-red-truoc-sonnet");
    for (const side of ["goc", "sau"]) for (const c of CASES) put(`pilot-${side}-${c}-sonnet`, { costUsd: 0.2, cases: [{ arms: { with: [{ judgeCostUsd: 0.05 }] } }] });
    put("base-red-truoc-sonnet-reboot", null);
    expect("eight pilots at $0.25 with judge cost", ["spent", "--root", root], 0, "spent=12 cap=60");
    expect("check 48 reaches the cap exactly", ["check", "48", "--root", root], 0, "total=60 cap=60");
    expect("check 48.01 passes the cap", ["check", "48.01", "--root", root], 1, "total=60.01");
    expect("check without a number stops", ["check", "--root", root], 1, "next must be a number");
    expect("estimate at $0.25 pilots", ["estimate", "--root", root], 0, "estimate: spent=12 cells=30 total=42 cap=60");
    put("pilot-sau-loi-don-gian-sonnet", { costUsd: 1, cases: [{ arms: { with: [{ judgeCostUsd: 0 }] } }] });
    expect("a $1 pilot caps its cell at 6", ["estimate", "--root", root], 0, "spent=12.75 cells=32.25 total=45");
    expect("estimate above a lower cap stops", ["estimate", "--root", root, "--cap", "44"], 1, "total=45 cap=44");
    expect("spent above the cap exits 1", ["spent", "--root", root, "--cap", "12"], 1, "spent=12.75 cap=12");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

const argv = process.argv.slice(2);
if (argv[0] === "--self-test") process.exit(selfTest());
const r = run(argv);
(r.code === 2 || r.out.startsWith("budget-fix-s55:") ? console.error : console.log)(r.out);
process.exit(r.code);
