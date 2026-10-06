#!/usr/bin/env node
// Trần riêng của gói test-eval-baseline ($100, plan D-04): cộng costUsd tầng trên cùng của mọi result.json dưới
// evals/results/test/ (mọi độ sâu, gồm -lan1), cộng mọi _kept/**/*.lost.json — một ô bị ngắt không có result.json nên
// driver ghi số tiền tối đa nó có thể đã tiêu (plan D-06).
//   node evals/test/budget.mjs spent [--root <results root>]          in spent=; thoát 1 khi đã vượt 100
//   node evals/test/budget.mjs check <next> [--root …]                thoát 1 khi spent + next vượt 100
//   node evals/test/budget.mjs ceiling <sonnet|opus> [--root …]       in một số nguyên max(4, ⌈12 × pilot đắt nhất⌉)
//   node evals/test/budget.mjs reserve <sonnet|opus> [--root …]       in ceiling + pilot đắt nhất (một ô có thể vượt một lượt)
//   node evals/test/budget.mjs fits [--assume-missing <usd>] [--root …]
//                                     thoát 1 khi spent + 4 × reserve mỗi model vượt 100; --assume-missing cộng <usd> vào
//                                     spent cho mỗi pilot còn thiếu, và trần của model lấy từ các pilot đã có
//   node evals/test/budget.mjs --self-test
// ceiling đọc pilot-<ca>-<model> (hoặc -lan1) của bốn ca; thoát 1 khi một pilot thiếu, partial hay không đúng một lượt sạch.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const CAP = 100;
// Two packets share evals/results/test/. Without --packet the baseline budget is unchanged (every result.json and every
// _kept/**/*.lost.json); --packet hard (specs/test-eval-hard D-04) counts only its own cells, at any depth (so a cell moved
// to _capped/ or _pilot-lan1/ still counts), and only _kept/hard/**/*.lost.json.
const HARD_CELL = /^(kho-|pilot-(tron-legacy|trung-probe|khong-cham-code)-)/;
const COVERAGE_CELL = /^(rong-|pilot-(thuong-sach|thuong-do|chap-chon)-)/;
const PACKETS = {
  baseline: { cases: ["sach", "do", "khong-test", "thieu-cong-cu"], cells: 4, result: () => true, lost: (p) => p.includes(`${path.sep}_kept${path.sep}`) },
  hard: { cases: ["tron-legacy", "trung-probe", "khong-cham-code"], cells: 3, result: (p) => p.split(path.sep).some((seg) => HARD_CELL.test(seg)), lost: (p) => p.includes(`${path.sep}_kept${path.sep}hard${path.sep}`) },
  // specs/test-proof-repair D-03: the after-cells `sau-*` only; ceilings over the measured cases' existing pilots, never
  // tighter than the caps their before-cells ran under, so before and after run on equal footing.
  repair: { cases: ["sach", "thieu-cong-cu", "tron-legacy", "khong-cham-code"], cells: 4, floor: { sonnet: 4, opus: 5 },
    result: (p) => p.split(path.sep).some((seg) => seg.startsWith("sau-")), lost: (p) => p.includes(`${path.sep}_kept${path.sep}repair${path.sep}`) },
  // specs/test-eval-coverage D-03: the cells `rong-*` and the three cases' pilots, at any depth; ceilings as the hard packet.
  coverage: { cases: ["thuong-sach", "thuong-do", "chap-chon"], cells: 3, result: (p) => p.split(path.sep).some((seg) => COVERAGE_CELL.test(seg)),
    lost: (p) => p.includes(`${path.sep}_kept${path.sep}rong${path.sep}`) },
  // specs/test-flaky-repair D-03: the after-cells `ondinh-*` at any depth; ceilings over the two cases' existing pilots,
  // never under the cap their before-cells ran at.
  flaky: { cases: ["thuong-sach", "chap-chon"], cells: 2, floor: { sonnet: 4, opus: 4 },
    result: (p) => p.split(path.sep).some((seg) => seg.startsWith("ondinh-")), lost: (p) => p.includes(`${path.sep}_kept${path.sep}ondinh${path.sep}`) },
};
const MODELS = ["sonnet", "opus"];
const round = (x) => Number(x.toFixed(4));
const resolveCell = (dir) => (fs.existsSync(`${dir}-lan1`) ? `${dir}-lan1` : dir);
// An unreadable file or a missing cost must not count as $0: the budget would then open instead of close.
const costOf = (file) => {
  let j; try { j = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error(`${file}: unreadable, its cost is unknown`); }
  if (!Number.isFinite(Number(j.costUsd))) throw new Error(`${file}: no costUsd`);
  return Number(j.costUsd);
};

export function spent(root, packet = PACKETS.baseline) {
  let total = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if ((e.name === "result.json" && packet.result(p)) || (e.name.endsWith(".lost.json") && packet.lost(p))) total += costOf(p);
    }
  };
  const res = path.join(root, "test");
  if (fs.existsSync(res)) walk(res);
  return round(total);
}

// The pilots of one model: their highest cost and how many are missing. A present pilot must be one clean run.
function pilots(root, model, packet) {
  let top = 0, missing = 0;
  for (const kase of packet.cases) {
    const dir = resolveCell(path.join(root, "test", `pilot-${kase}-${model}`)), file = path.join(dir, "result.json");
    if (!fs.existsSync(file)) { missing++; continue; }
    const r = JSON.parse(fs.readFileSync(file, "utf8")), runs = r.cases?.[0]?.arms?.with || [];
    if (r.partial || runs.length !== 1 || runs[0].error) return { error: `${dir}: not one clean run` };
    top = Math.max(top, r.costUsd || 0);
  }
  return { top, missing };
}
// ⌈12 × top⌉ on nine decimals: float noise below 1e-9 never adds a dollar, and a real fraction always does.
const ceilingOf = (top) => Math.max(4, Math.ceil(Number((12 * top).toFixed(9))));

export function ceiling(root, model, { allowMissing = false, packet = PACKETS.baseline } = {}) {
  const p = pilots(root, model, packet);
  if (p.error) return p;
  if (p.missing && !allowMissing) return { error: `${model}: ${p.missing} pilot(s) missing` };
  const value = Math.max(ceilingOf(p.top), (packet.floor || {})[model] || 0);
  return { value, reserve: round(value + p.top), missing: p.missing };
}

function main(args) {
  let root = path.join(path.dirname(SELF), "..", "results");
  const r = args.indexOf("--root"); if (r >= 0) { root = args[r + 1]; args.splice(r, 2); }
  let packet = PACKETS.baseline;
  const pk = args.indexOf("--packet");
  if (pk >= 0) { packet = PACKETS[args[pk + 1]]; if (!packet || args[pk + 1] === "baseline") { console.error("--packet takes hard, repair, coverage or flaky"); return 2; } args.splice(pk, 2); }
  let x; try { x = spent(root, packet); } catch (e) { console.error(e.message); return 1; }
  const num = (s) => s !== undefined && s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;
  if (args[0] === "spent" && args.length === 1) { console.log(`spent=${x} cap=${CAP}`); return x > CAP ? 1 : 0; }
  if (args[0] === "check" && args.length === 2 && num(args[1])) {
    const next = Number(args[1]); console.log(`spent=${x} next=${next} total=${round(x + next)} cap=${CAP}`); return x + next > CAP ? 1 : 0;
  }
  if ((args[0] === "ceiling" || args[0] === "reserve") && args.length === 2 && MODELS.includes(args[1])) {
    const c = ceiling(root, args[1], { packet }); if (c.error) { console.error(c.error); return 1; }
    console.log(String(args[0] === "ceiling" ? c.value : c.reserve)); return 0;
  }
  const am = args.indexOf("--assume-missing");
  if (args[0] === "fits" && (args.length === 1 || (args.length === 3 && am === 1 && num(args[2])))) {
    const assume = am === 1 ? Number(args[2]) : null;
    const cs = MODELS.map((m) => ceiling(root, m, { allowMissing: assume !== null, packet })), err = cs.find((c) => c.error);
    if (err) { console.error(err.error); return 1; }
    const extra = assume === null ? 0 : assume * cs.reduce((n, c) => n + c.missing, 0);
    const need = round(x + extra + packet.cells * cs[0].reserve + packet.cells * cs[1].reserve);
    console.log(`spent=${x} missing=${round(extra)} sonnet=${cs[0].value}+${round(cs[0].reserve - cs[0].value)} opus=${cs[1].value}+${round(cs[1].reserve - cs[1].value)} need=${need} cap=${CAP}`);
    return need > CAP ? 1 : 0;
  }
  console.error("usage: node evals/test/budget.mjs spent | check <next> | ceiling <model> | reserve <model> | fits [--assume-missing <usd>] [--packet hard] [--root <results root>] | --self-test");
  return 2;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-budget-st-"));
  let failed = 0;
  const me = (args) => spawnSync(process.execPath, [SELF, ...args, "--root", root], { encoding: "utf8" });
  const check = (label, ok, out) => { console.log(`${ok ? "ok" : "FAIL"}: budget self-test: ${label}${ok ? "" : ` — ${out}`}`); if (!ok) failed++; };
  const res = (rel, cost, runs = [{}], partial = false) => { const d = path.join(root, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial, cases: [{ arms: { with: runs } }] })); };
  try {
    res("test/nap-sach-sonnet", 0.5); res("test/base-do-sonnet-lan1/nested", 1.5); res("develop/v3-x", 50); res("brainstorm/x", 9);
    fs.mkdirSync(path.join(root, "test", "_kept", "t05"), { recursive: true });
    fs.writeFileSync(path.join(root, "test", "_kept", "t05", "base-sach-opus.lost.json"), JSON.stringify({ costUsd: 2 }));
    fs.writeFileSync(path.join(root, "test", "notes.lost.json"), JSON.stringify({ costUsd: 50 }));
    let r = me(["spent"]); check("result.json at any depth plus _kept/**/*.lost.json count, other suites and loose files not → spent=4", r.status === 0 && r.stdout.trim() === "spent=4 cap=100", r.stdout);
    r = me(["check", "96"]); check("check 96 on $4 → total=100, exit 0", r.status === 0 && r.stdout.includes("total=100 "), r.stdout);
    r = me(["check", "96.5"]); check("check 96.5 on $4 → exit 1", r.status === 1, r.stdout);
    r = me(["check", "-1"]); check("check -1 → usage, exit 2", r.status === 2, r.stdout);
    for (const k of ["sach", "do", "khong-test"]) res(`test/pilot-${k}-sonnet`, 0.1);
    r = me(["ceiling", "sonnet"]); check("ceiling with a pilot missing → exit 1", r.status === 1 && r.stderr.includes("missing"), r.stderr);
    res("test/pilot-thieu-cong-cu-sonnet", 0.2, [{}, {}]);
    r = me(["ceiling", "sonnet"]); check("ceiling with a pilot of two runs → exit 1", r.status === 1 && r.stderr.includes("not one clean run"), r.stderr);
    res("test/pilot-thieu-cong-cu-sonnet-lan1", 0.25);
    r = me(["ceiling", "sonnet"]); check("ceiling reads -lan1 and keeps the $4 floor: max(4, ⌈12 × 0.25⌉) → 4", r.status === 0 && r.stdout === "4\n", r.stdout);
    r = me(["reserve", "sonnet"]); check("reserve = ceiling + highest pilot → 4.25", r.status === 0 && r.stdout === "4.25\n", r.stdout);
    for (const k of ["sach", "do", "khong-test"]) res(`test/pilot-${k}-opus`, 0.6);
    r = me(["fits"]); check("fits without a pilot → exit 1", r.status === 1 && r.stderr.includes("missing"), r.stderr);
    r = me(["fits", "--assume-missing", "4"]); check("fits --assume-missing 4: spent 6.55 + 4 + 4 × 4.25 + 4 × (8 + 0.6) = 61.95, exit 0", r.status === 0 && r.stdout.includes("missing=4 ") && r.stdout.includes("need=61.95"), r.stdout);
    res("test/pilot-thieu-cong-cu-opus", 0.51, [{ error: "boom" }]);
    r = me(["ceiling", "opus"]); check("ceiling with an errored pilot → exit 1", r.status === 1, r.stderr);
    res("test/pilot-thieu-cong-cu-opus", 0.51);
    r = me(["ceiling", "opus"]); check("ceiling prints one integer: ⌈12 × 0.6⌉ → 8", r.status === 0 && r.stdout === "8\n", r.stdout);
    r = me(["fits"]); check("fits: spent 7.06 + 4 × 4.25 + 4 × 8.6 = 58.46 → exit 0", r.status === 0 && r.stdout.includes("need=58.46"), r.stdout);
    res("test/base-x-opus", 45);
    r = me(["fits"]); check("fits: spent 52.06 + 51.4 = 103.46 > 100 → exit 1", r.status === 1 && r.stdout.includes("need=103.46"), r.stdout);
    res("test/pilot-sach-opus", 0.6, [{}], true);
    r = me(["ceiling", "opus"]); check("ceiling with a partial pilot → exit 1", r.status === 1 && r.stderr.includes("not one clean run"), r.stderr);
    res("test/pilot-sach-opus", 0.6);
    r = me(["ceiling", "haiku"]); check("ceiling for an unknown model → usage, exit 2", r.status === 2, r.stdout);
    r = me(["fits", "--assume-missing"]); check("fits --assume-missing without a cost → usage, exit 2", r.status === 2, r.stdout);
    res("test/base-y-opus", 50); r = me(["spent"]); check("spent 102.06 above the cap → exit 1", r.status === 1, r.stdout);
    const hd = fs.mkdtempSync(path.join(os.tmpdir(), "test-budget-hard-"));
    try {
      const put = (rel, cost, runs = [{}], partial = false) => { const d = path.join(hd, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial, cases: [{ arms: { with: runs } }] })); };
      const h = (a) => spawnSync(process.execPath, [SELF, ...a, "--root", hd], { encoding: "utf8" });
      put("test/base-sach-opus", 30); put("test/pilot-sach-sonnet", 9); put("test/_capped/base-x-opus-cap1", 7);
      put("test/kho-tron-legacy-opus", 2); put("test/_capped/kho-khong-cham-code-opus-cap1", 3); put("test/_pilot-lan1/pilot-trung-probe-sonnet", 0.5);
      fs.mkdirSync(path.join(hd, "test", "_kept", "hard", "t04"), { recursive: true }); fs.mkdirSync(path.join(hd, "test", "_kept", "t05"), { recursive: true });
      fs.writeFileSync(path.join(hd, "test", "_kept", "hard", "t04", "kho-do-sonnet.lost.json"), JSON.stringify({ costUsd: 1 }));
      fs.writeFileSync(path.join(hd, "test", "_kept", "t05", "base-x.lost.json"), JSON.stringify({ costUsd: 20 }));
      r = h(["--packet", "hard", "spent"]); check("--packet hard counts kho-*, its pilots, _capped/ and _pilot-lan1/ copies and _kept/hard lost files only → spent=6.5", r.status === 0 && r.stdout.trim() === "spent=6.5 cap=100", r.stdout + r.stderr);
      r = h(["spent"]); check("without --packet every result.json and _kept lost file still counts → spent=72.5", r.stdout.trim() === "spent=72.5 cap=100", r.stdout);
      for (const k of ["tron-legacy", "trung-probe", "khong-cham-code"]) { put(`test/pilot-${k}-sonnet`, 0.2); put(`test/pilot-${k}-opus`, k === "khong-cham-code" ? 0.45 : 0.3); }
      r = h(["--packet", "hard", "ceiling", "opus"]); check("--packet hard takes its ceiling over the three new cases: ⌈12 × 0.45⌉ = 6", r.status === 0 && r.stdout === "6\n", r.stdout + r.stderr);
      r = h(["--packet", "hard", "fits"]); check("--packet hard fits = spent + 3 × each reserve: 8.15 + 3 × 4.2 + 3 × 6.45 = 40.1", r.status === 0 && r.stdout.includes("need=40.1 "), r.stdout + r.stderr);
      r = h(["--packet", "baseline", "spent"]); check("--packet takes only hard, repair, coverage or flaky", r.status === 2, r.stdout);
      put("test/sau-sach-sonnet", 1.25); put("test/_capped/sau-x-opus-cap1", 2); put("test/sau-thing/nested", 0.5);
      fs.mkdirSync(path.join(hd, "test", "_kept", "repair", "t03"), { recursive: true });
      fs.writeFileSync(path.join(hd, "test", "_kept", "repair", "t03", "sau-do-opus.lost.json"), JSON.stringify({ costUsd: 1 }));
      r = h(["--packet", "repair", "spent"]); check("--packet repair counts sau-* at any depth and _kept/repair lost files, not base-*/kho-*/pilots → spent=4.75", r.status === 0 && r.stdout.trim() === "spent=4.75 cap=100", r.stdout + r.stderr);
      r = h(["--packet", "hard", "spent"]); check("--packet hard is unchanged by sau-* cells → spent=8.15", r.stdout.trim() === "spent=8.15 cap=100", r.stdout);
      for (const k of ["sach", "thieu-cong-cu"]) { put(`test/pilot-${k}-sonnet`, 0.2); put(`test/pilot-${k}-opus`, 0.3); }
      r = h(["--packet", "repair", "ceiling", "opus"]); check("--packet repair keeps the before-cells' opus cap: max(⌈12 × 0.45⌉ = 6, 5) → 6", r.status === 0 && r.stdout === "6\n", r.stdout + r.stderr);
      r = h(["--packet", "repair", "ceiling", "sonnet"]); check("--packet repair sonnet: max(4, ⌈12 × 0.2⌉, 4) → 4", r.status === 0 && r.stdout === "4\n", r.stdout + r.stderr);
      put("test/pilot-khong-cham-code-opus", 0.3);
      r = h(["--packet", "repair", "ceiling", "opus"]); check("--packet repair never goes under the opus floor: pilots give 4, floor 5 → 5", r.status === 0 && r.stdout === "5\n", r.stdout + r.stderr);
      r = h(["--packet", "repair", "fits"]); check("--packet repair fits = spent + 4 × each reserve: 4.75 + 4 × 4.2 + 4 × 5.3 = 42.75", r.status === 0 && r.stdout.includes("need=42.75 "), r.stdout + r.stderr);
      r = h(["--packet", "coverage", "spent"]); check("--packet coverage with none of its cells → spent=0", r.status === 0 && r.stdout.trim() === "spent=0 cap=100", r.stdout + r.stderr);
      const before = ["hard", "repair"].map((k) => h(["--packet", k, "spent"]).stdout).concat(h(["spent"]).stdout);
      put("test/rong-thuong-sach-sonnet", 1.5); put("test/_capped/rong-chap-chon-opus-cap1", 2); put("test/rong-thuong-do-opus-lan1/nested", 0.25); put("test/_pilot-lan1/pilot-chap-chon-sonnet", 0.1);
      put("test/pilot-thuong-do-opus", 0.2); put("test/thuong-sach-sonnet", 9); put("test/pilot-thuong-sach", 9); put("test/xrong-thuong-do-opus", 9);
      fs.mkdirSync(path.join(hd, "test", "_kept", "rong", "t04"), { recursive: true });
      fs.writeFileSync(path.join(hd, "test", "_kept", "rong", "t04", "rong-thuong-do-sonnet.lost.json"), JSON.stringify({ costUsd: 1 }));
      r = h(["--packet", "coverage", "spent"]); check("--packet coverage counts rong-* and its pilots at any depth and _kept/rong lost files, nothing else → spent=5.05", r.status === 0 && r.stdout.trim() === "spent=5.05 cap=100", r.stdout + r.stderr);
      check("the hard and repair packets are unchanged by coverage cells; without --packet they count too", ["hard", "repair"].every((k, i) => h(["--packet", k, "spent"]).stdout === before[i]) && h(["spent"]).stdout.trim() === `spent=${round(Number(before[2].match(/spent=([\d.]+)/)[1]) + 32.05)} cap=100`, before.join(""));
      for (const k of ["thuong-sach", "thuong-do", "chap-chon"]) { put(`test/pilot-${k}-sonnet`, 0.2); put(`test/pilot-${k}-opus`, k === "chap-chon" ? 0.55 : 0.3); }
      r = h(["--packet", "coverage", "ceiling", "opus"]); check("--packet coverage takes its ceiling over its three cases: ⌈12 × 0.55⌉ = 7", r.status === 0 && r.stdout === "7\n", r.stdout + r.stderr);
      r = h(["--packet", "coverage", "fits"]); check("--packet coverage fits = spent + 3 × each reserve: 6.6 + 3 × 4.2 + 3 × 7.55 = 41.85", r.status === 0 && r.stdout.includes("need=41.85 "), r.stdout + r.stderr);
      r = h(["--packet", "flaky", "spent"]); check("--packet flaky with none of its cells → spent=0", r.status === 0 && r.stdout.trim() === "spent=0 cap=100", r.stdout + r.stderr);
      const others = ["hard", "repair", "coverage"].map((k) => h(["--packet", k, "spent"]).stdout), all = h(["spent"]).stdout;
      put("test/ondinh-chap-chon-sonnet", 1.25); put("test/_capped/ondinh-thuong-sach-opus-cap1", 2); put("test/ondinh-chap-chon-opus-lan1/nested", 0.5); put("test/xondinh-chap-chon-opus", 9);
      fs.mkdirSync(path.join(hd, "test", "_kept", "ondinh", "t03"), { recursive: true });
      fs.writeFileSync(path.join(hd, "test", "_kept", "ondinh", "t03", "ondinh-thuong-sach-sonnet.lost.json"), JSON.stringify({ costUsd: 1 }));
      r = h(["--packet", "flaky", "spent"]); check("--packet flaky counts ondinh-* at any depth and _kept/ondinh lost files, not rong-*/pilots/xondinh-*/_kept/rong → spent=4.75", r.status === 0 && r.stdout.trim() === "spent=4.75 cap=100", r.stdout + r.stderr);
      check("the hard, repair and coverage packets are unchanged by flaky cells; without --packet they count too (+13.75)", ["hard", "repair", "coverage"].every((k, i) => h(["--packet", k, "spent"]).stdout === others[i]) && h(["spent"]).stdout.trim() === `spent=${round(Number(all.match(/spent=([\d.]+)/)[1]) + 13.75)} cap=100`, others.join("") + all);
      r = h(["--packet", "flaky", "ceiling", "opus"]); check("--packet flaky takes its ceiling over thuong-sach and chap-chon pilots: ⌈12 × 0.55⌉ = 7", r.status === 0 && r.stdout === "7\n", r.stdout + r.stderr);
      r = h(["--packet", "flaky", "ceiling", "sonnet"]); check("--packet flaky sonnet: max(⌈12 × 0.2⌉, floor 4) → 4", r.status === 0 && r.stdout === "4\n", r.stdout + r.stderr);
      r = h(["--packet", "flaky", "fits"]); check("--packet flaky fits = spent + 2 × each reserve: 4.75 + 2 × 4.2 + 2 × 7.55 = 28.25", r.status === 0 && r.stdout.includes("need=28.25 "), r.stdout + r.stderr);
    } finally { fs.rmSync(hd, { recursive: true, force: true }); }
    const two = fs.mkdtempSync(path.join(os.tmpdir(), "test-budget-two-"));
    try {
      const put = (rel, cost) => { const d = path.join(two, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, cases: [{ arms: { with: [{}] } }] })); };
      for (const k of ["sach", "do"]) { put(`test/pilot-${k}-sonnet`, 0.4166667); put(`test/pilot-${k}-opus`, 0.1); }
      const t = (a) => spawnSync(process.execPath, [SELF, ...a, "--root", two], { encoding: "utf8" });
      r = t(["fits", "--assume-missing", "4"]);
      check("fits --assume-missing 4 with four pilots missing adds 4 × 4 = 16", r.status === 0 && r.stdout.includes("missing=16 "), r.stdout);
      check("ceiling is ⌈12 × 0.4166667⌉ = 6, not rounded down", t(["fits", "--assume-missing", "4"]).stdout.includes("sonnet=6+"), r.stdout);
      fs.writeFileSync(path.join(two, "test", "pilot-sach-opus", "result.json"), '{"costUsd":');
      r = t(["spent"]); check("an unreadable result.json makes spent exit 1, not count $0", r.status === 1 && r.stderr.includes("unreadable"), r.stderr + r.stdout);
    } finally { fs.rmSync(two, { recursive: true, force: true }); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

// realpath on both sides: a call through a symlinked path still runs the CLI.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(SELF)) {
  const args = process.argv.slice(2);
  process.exit(args[0] === "--self-test" ? selfTest() : main(args));
}
