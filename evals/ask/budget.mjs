#!/usr/bin/env node
// Trần của bộ đo cf:ask, $100 (gói ask-eval-baseline, plan D-03; chép từ evals/test/budget.mjs, một ngân sách chung): cộng costUsd
// tầng trên cùng của mọi result.json dưới evals/results/ask/ (mọi độ sâu, gồm -lan1 và _capped/), cộng mọi
// _kept/**/*.lost.json — một ô bị ngắt không có result.json nên driver ghi số tiền tối đa nó có thể đã tiêu.
//   node evals/ask/budget.mjs spent [--root <results root>]          in spent=; thoát 1 khi đã vượt trần
//   node evals/ask/budget.mjs check <next> [--root …]                thoát 1 khi spent + next vượt trần
//   node evals/ask/budget.mjs ceiling <sonnet|opus> [--root …]       in max(4, ⌈12 × pilot đắt nhất⌉)
//   node evals/ask/budget.mjs reserve <sonnet|opus> [--root …]       in ceiling + pilot đắt nhất
//   node evals/ask/budget.mjs fits [--root …]                        thoát 1 khi spent + 5 × reserve mỗi model vượt trần
//   node evals/ask/budget.mjs --self-test
// ceiling đọc pilot-<ca>-<model> (hoặc -lan1) của năm ca; thoát 1 khi một pilot thiếu, partial hay không đúng một lượt sạch.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const CAP = 100;
const CASES = ["co-bang-chung", "docs-lech-code", "khong-co-bang-chung", "hoi-lai", "cam-sua"];
const MODELS = ["sonnet", "opus"];
const round = (x) => Number(x.toFixed(4));
const resolveCell = (dir) => (fs.existsSync(`${dir}-lan1`) ? `${dir}-lan1` : dir);
// An unreadable file or a missing cost must not count as $0: the budget would then open instead of close.
const costOf = (file) => {
  let j; try { j = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error(`${file}: unreadable, its cost is unknown`); }
  if (!Number.isFinite(Number(j.costUsd))) throw new Error(`${file}: no costUsd`);
  return Number(j.costUsd);
};

export function spent(root) {
  let total = 0;
  const walk = (dir, kept) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, kept || e.name === "_kept");
      else if (e.name === "result.json" || (e.name.endsWith(".lost.json") && kept)) total += costOf(p);
    }
  };
  const res = path.join(root, "ask");
  if (fs.existsSync(res)) walk(res, false);
  return round(total);
}

function pilots(root, model) {
  let top = 0;
  for (const kase of CASES) {
    const dir = resolveCell(path.join(root, "ask", `pilot-${kase}-${model}`)), file = path.join(dir, "result.json");
    if (!fs.existsSync(file)) return { error: `${dir}: pilot missing` };
    const r = JSON.parse(fs.readFileSync(file, "utf8")), runs = r.cases?.[0]?.arms?.with || [];
    if (r.partial || runs.length !== 1 || runs[0].error) return { error: `${dir}: not one clean run` };
    if (!Number.isFinite(Number(r.costUsd))) return { error: `${dir}: no costUsd` };
    top = Math.max(top, Number(r.costUsd));
  }
  return { top };
}
// ⌈12 × top⌉ on nine decimals: float noise below 1e-9 never adds a dollar, and a real fraction always does.
const ceilingOf = (top) => Math.max(4, Math.ceil(Number((12 * top).toFixed(9))));
export function ceiling(root, model) {
  const p = pilots(root, model);
  if (p.error) return p;
  const value = ceilingOf(p.top);
  return { value, reserve: round(value + p.top) };
}

function main(args) {
  let root = path.join(path.dirname(SELF), "..", "results");
  const r = args.indexOf("--root"); if (r >= 0) { root = args[r + 1]; args.splice(r, 2); }
  let x; try { x = spent(root); } catch (e) { console.error(e.message); return 1; }
  const num = (s) => s !== undefined && s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;
  if (args[0] === "spent" && args.length === 1) { console.log(`spent=${x} cap=${CAP}`); return x > CAP ? 1 : 0; }
  if (args[0] === "check" && args.length === 2 && num(args[1])) {
    const next = Number(args[1]); console.log(`spent=${x} next=${next} total=${round(x + next)} cap=${CAP}`); return x + next > CAP ? 1 : 0;
  }
  if ((args[0] === "ceiling" || args[0] === "reserve") && args.length === 2 && MODELS.includes(args[1])) {
    const c = ceiling(root, args[1]); if (c.error) { console.error(c.error); return 1; }
    console.log(String(args[0] === "ceiling" ? c.value : c.reserve)); return 0;
  }
  if (args[0] === "fits" && args.length === 1) {
    const cs = MODELS.map((m) => ceiling(root, m)), err = cs.find((c) => c.error);
    if (err) { console.error(err.error); return 1; }
    const need = round(x + CASES.length * cs[0].reserve + CASES.length * cs[1].reserve);
    console.log(`spent=${x} sonnet=${cs[0].value}+${round(cs[0].reserve - cs[0].value)} opus=${cs[1].value}+${round(cs[1].reserve - cs[1].value)} need=${need} cap=${CAP}`);
    return need > CAP ? 1 : 0;
  }
  console.error("usage: node evals/ask/budget.mjs spent | check <next> | ceiling <model> | reserve <model> | fits [--root <results root>] | --self-test");
  return 2;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ask-budget-st-"));
  let failed = 0;
  const me = (args) => spawnSync(process.execPath, [SELF, ...args, "--root", root], { encoding: "utf8" });
  const check = (label, ok, out) => { console.log(`${ok ? "ok" : "FAIL"}: budget self-test: ${label}${ok ? "" : ` — ${out}`}`); if (!ok) failed++; };
  const put = (rel, cost, runs = [{}], partial = false) => { const d = path.join(root, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial, cases: [{ arms: { with: runs } }] })); };
  try {
    put("ask/goc-hoi-lai-sonnet", 0.5); put("ask/_capped/goc-cam-sua-opus-cap1", 2); put("ask/goc-x-opus-lan1/nested", 0.25); put("test/rong-x", 50); put("brainstorm/x", 9);
    fs.mkdirSync(path.join(root, "ask", "_kept", "goc", "t04"), { recursive: true });
    fs.writeFileSync(path.join(root, "ask", "_kept", "goc", "t04", "goc-a.lost.json"), JSON.stringify({ costUsd: 1 }));
    fs.writeFileSync(path.join(root, "ask", "notes.lost.json"), JSON.stringify({ costUsd: 40 }));
    let r = me(["spent"]); check("result.json at any depth (incl. _capped/, -lan1) plus _kept/**/*.lost.json count; other suites and loose lost files not → spent=3.75", r.status === 0 && r.stdout.trim() === "spent=3.75 cap=100", r.stdout + r.stderr);
    r = me(["check", "96.25"]); check("check 96.25 on $3.75 → total=100, exit 0", r.status === 0 && r.stdout.includes("total=100 "), r.stdout);
    r = me(["check", "96.5"]); check("check 96.5 on $3.75 → exit 1", r.status === 1, r.stdout);
    r = me(["check", "-1"]); check("check -1 → usage, exit 2", r.status === 2, r.stdout);
    r = me(["ceiling", "sonnet"]); check("ceiling with pilots missing → exit 1", r.status === 1 && r.stderr.includes("pilot missing"), r.stderr);
    for (const k of CASES) { put(`ask/pilot-${k}-sonnet`, 0.1); put(`ask/pilot-${k}-opus`, k === "hoi-lai" ? 0.45 : 0.2); }
    r = me(["ceiling", "sonnet"]); check("ceiling keeps the $4 floor: max(4, ⌈12 × 0.1⌉) → 4", r.status === 0 && r.stdout === "4\n", r.stdout + r.stderr);
    r = me(["ceiling", "opus"]); check("ceiling is ⌈12 × highest pilot⌉: ⌈12 × 0.45⌉ → 6", r.status === 0 && r.stdout === "6\n", r.stdout + r.stderr);
    r = me(["reserve", "opus"]); check("reserve = ceiling + highest pilot → 6.45", r.status === 0 && r.stdout === "6.45\n", r.stdout);
    r = me(["fits"]); check("fits = spent 5.5 (3.75 + pilots 0.5 + 1.25) + 5 × 4.1 + 5 × 6.45 = 58.25 ≤ 100 → exit 0", r.status === 0 && r.stdout.includes("need=58.25 "), r.stdout + r.stderr);
    put("ask/pilot-hoi-lai-opus", 0.2, [{}, {}]);
    r = me(["ceiling", "opus"]); check("a pilot of two runs → exit 1", r.status === 1 && r.stderr.includes("not one clean run"), r.stderr);
    put("ask/pilot-hoi-lai-opus-lan1", 0.2);
    r = me(["ceiling", "opus"]); check("a pilot's -lan1 is read: ⌈12 × 0.2⌉ → 4 (floor)", r.status === 0 && r.stdout === "4\n", r.stdout + r.stderr);
    r = me(["fits"]); check("fits = spent 5.45 (3.75 + pilots 0.5 + 1.2) + 5 × 4.1 + 5 × 4.2 = 46.95 → exit 0", r.status === 0 && r.stdout.includes("need=46.95 "), r.stdout + r.stderr);
    put("ask/goc-big-sonnet", 55);
    r = me(["fits"]); check("fits refuses: spent 60.45 + 5 × 4.1 + 5 × 4.2 = 101.95 > 100 → exit 1", r.status === 1 && r.stdout.includes("need=101.95 "), r.stdout + r.stderr);
    fs.rmSync(path.join(root, "ask", "goc-big-sonnet"), { recursive: true, force: true });
    put("ask/pilot-cam-sua-sonnet", 0.1, [{ error: "boom" }]);
    r = me(["ceiling", "sonnet"]); check("an errored pilot → exit 1", r.status === 1, r.stderr);
    put("ask/pilot-cam-sua-sonnet", 0.1); fs.writeFileSync(path.join(root, "ask", "pilot-cam-sua-sonnet", "result.json"), JSON.stringify({ partial: false, cases: [{ arms: { with: [{}] } }] }));
    r = me(["ceiling", "sonnet"]); check("a pilot without costUsd → exit 1, not a $0 pilot", r.status === 1 && r.stderr.includes("no costUsd"), r.stderr);
    put("ask/pilot-cam-sua-sonnet", 0.1);
    r = me(["ceiling", "haiku"]); check("an unknown model → usage, exit 2", r.status === 2, r.stdout);
    put("ask/goc-big-opus", 100); r = me(["spent"]); check("spent above the $100 cap → exit 1", r.status === 1, r.stdout);
    fs.writeFileSync(path.join(root, "ask", "goc-big-opus", "result.json"), '{"costUsd":');
    r = me(["spent"]); check("an unreadable result.json makes spent exit 1, not count $0", r.status === 1 && r.stderr.includes("unreadable"), r.stderr + r.stdout);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

// realpath on both sides: a call through a symlinked path still runs the CLI.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(SELF)) {
  const args = process.argv.slice(2);
  process.exit(args[0] === "--self-test" ? selfTest() : main(args));
}
