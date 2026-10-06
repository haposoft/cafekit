#!/usr/bin/env node
// Trần ngân sách $60 của gói git-skill-repair, đọc từ evals/results/git (hay --root). Tổng chi = costUsd của mọi result.json nằm
// ngay dưới một thư mục `base-*` hay `sau-*` (kể cả pilot `*-pilot-*` và lần chạy lại `-lan<k>`) cộng judgeCostUsd của từng lượt.
//   node evals/budget-git-sau.mjs spent                 budget: spent=<x> cap=<cap>; thoát 1 khi vượt trần
//   node evals/budget-git-sau.mjs check <next>          budget: spent=<x> next=<n> total=<t> cap=<cap>; thoát 1 khi spent + next vượt trần hay <next> không phải số
//   node evals/budget-git-sau.mjs estimate --runs <n>   estimate: spent=<x> remaining=<r> total=<t> cap=<cap>; thoát 1 khi total vượt trần
//   node evals/budget-git-sau.mjs --self-test
// estimate lấy chi phí cao nhất của một lượt trong các kết quả `*-pilot-*` hiện có (perRun) rồi tính phần CÒN LẠI của cả hai phía:
// mỗi ô gốc/sau chưa có (bốn ca) n lượt, mỗi pilot gốc/sau chưa có một lượt. Một thư mục `-lan<k>` không tính là ô đã có.
// Mọi lệnh nhận --cap <n> (mặc định 60) và --root <thư mục kết quả> (mặc định evals/results/git).
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(here, "results", "git");
const DEFAULT_CAP = 60;
const CASES = ["wt-plain-git-no-orca", "wt-cleanup-prune", "commit-secret-scan-portable", "wrong-checkout-guard"];
const MODEL = "opus";
const round4 = (x) => Number(x.toFixed(4));

const resultDirs = (root) => fs.existsSync(root)
  ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && /^(?:base|sau)-/.test(e.name) && fs.existsSync(path.join(root, e.name, "result.json"))).map((e) => e.name).sort()
  : [];
const readResult = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name, "result.json"), "utf8"));
const judgeOf = (r) => (r.cases || []).reduce((s, c) => s + c.arms.with.reduce((t, run) => t + (run.judgeCostUsd || 0), 0), 0);

export function spent(root) {
  return resultDirs(root).reduce((s, name) => { const r = readResult(root, name); return s + (r.costUsd || 0) + judgeOf(r); }, 0);
}

// Chi phí cao nhất của một lượt trong các pilot; null khi chưa có pilot.
export function perRunMax(root) {
  let best = null;
  for (const name of resultDirs(root).filter((n) => /-pilot-/.test(n))) {
    for (const c of readResult(root, name).cases || []) for (const run of c.arms.with) {
      const cost = (run.costUsd || 0) + (run.judgeCostUsd || 0);
      if (best === null || cost > best) best = cost;
    }
  }
  return best;
}

export function estimate(root, runs) {
  const perRun = perRunMax(root);
  if (perRun === null) return null;
  const present = new Set(resultDirs(root));
  let remaining = 0;
  for (const side of ["base", "sau"]) for (const kase of CASES) {
    if (!present.has(`${side}-${kase}-${MODEL}`)) remaining += runs * perRun;
    if (!present.has(`${side}-pilot-${kase}-${MODEL}`)) remaining += perRun;
  }
  const s = spent(root);
  return { spent: s, remaining, total: s + remaining, perRun };
}

function selfTest() {
  const bad = [];
  const eq = (label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "budget-git-"));
  try {
    const mk = (name, costUsd, runs) => {
      fs.mkdirSync(path.join(T, name), { recursive: true });
      fs.writeFileSync(path.join(T, name, "result.json"), JSON.stringify({ costUsd, cases: [{ arms: { with: runs } }] }));
    };
    eq("empty spent", spent(T), 0);
    eq("empty estimate", estimate(T, 10), null);
    // hai pilot (lượt đắt nhất 0.30 + judge 0.05), một ô gốc đã chạy, một lần chạy lại -lan1 vẫn được tính tiền
    mk("base-pilot-wt-plain-git-no-orca-opus", 0.2, [{ costUsd: 0.2, judgeCostUsd: 0.05 }]);
    mk("base-pilot-wt-cleanup-prune-opus", 0.3, [{ costUsd: 0.3, judgeCostUsd: 0.05 }]);
    mk("base-wt-plain-git-no-orca-opus", 2, [{ costUsd: 1, judgeCostUsd: 0.1 }, { costUsd: 1, judgeCostUsd: 0.1 }]);
    mk("base-wt-cleanup-prune-opus-lan1", 0.5, [{ costUsd: 0.5, judgeCostUsd: 0 }]);
    mk("sau-pilot-wt-plain-git-no-orca-opus", 0.1, [{ costUsd: 0.1, judgeCostUsd: 0 }]);
    fs.mkdirSync(path.join(T, "base-crashed")); fs.writeFileSync(path.join(T, "base-crashed", "result.json"), JSON.stringify({ costUsd: 0.4 }));
    fs.mkdirSync(path.join(T, "other-dir")); fs.writeFileSync(path.join(T, "other-dir", "result.json"), JSON.stringify({ costUsd: 99, cases: [] }));
    eq("spent counts pilots, judge cost, reruns and ignores other dirs", round4(spent(T)), round4(0.2 + 0.05 + 0.3 + 0.05 + 2 + 0.2 + 0.5 + 0.1 + 0.4));
    eq("perRun is the dearest run of a pilot", round4(perRunMax(T)), 0.35);
    // sau-pilot-wt-plain đã có, nên thiếu một pilot sau ít hơn (3), và result.json ghi dở (không có `cases`) vẫn đọc được
    const e = estimate(T, 10);
    // thiếu: ô gốc 3 (wt-cleanup chỉ có -lan1 nên vẫn thiếu) x10, ô sau 4 x10, pilot gốc 2, pilot sau 4  => (3*10 + 4*10 + 2 + 4) * 0.35
    eq("remaining covers both sides", round4(e.remaining), round4((30 + 40 + 2 + 3) * 0.35));
    eq("total = spent + remaining", round4(e.total), round4(e.spent + e.remaining));
    // hành vi dòng lệnh: cờ sai thì thoát 1 (không bao giờ mở trần), số âm bị từ chối
    const run = (...a) => spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...a, "--root", T], { encoding: "utf8" });
    eq("--cap abc fails closed", run("spent", "--cap", "abc").status, 1);
    eq("--cap -1 fails when anything is spent", run("spent", "--cap", "-1").status, 1);
    eq("a negative next is refused", run("check", "-5").status, 1);
    eq("check over the cap exits 1", run("check", "1000").status, 1);
    eq("check under the cap exits 0", run("check", "1").status, 0);
    eq("a flag with no value is refused", spawnSync(process.execPath, [fileURLToPath(import.meta.url), "spent", "--cap"], { encoding: "utf8" }).status, 1);
    eq("estimate over the cap exits 1", run("estimate", "--runs", "1000").status, 1);
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
  if (bad.length) { console.error(`self-test FAIL:\n${bad.join("\n")}`); process.exit(1); }
  console.log("self-test ok: spent, perRun, estimate");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  // --cap, --root, --runs nuốt giá trị đứng sau (kể cả `-1`); phần còn lại là tham số vị trí
  const flags = {}, positional = [];
  for (let i = 0; i < args.length; i++) {
    if (["--cap", "--root", "--runs"].includes(args[i])) {
      if (i + 1 >= args.length) { console.error(`budget: ${args[i]} needs a value`); process.exit(1); }
      flags[args[i]] = args[++i];
    } else positional.push(args[i]);
  }
  const cap = flags["--cap"] === undefined ? DEFAULT_CAP : Number(flags["--cap"]);
  if (!Number.isFinite(cap)) { console.error("budget: --cap needs a number"); process.exit(1); }
  const root = flags["--root"] ? path.resolve(flags["--root"]) : DEFAULT_ROOT;
  const runsArg = flags["--runs"] === undefined ? NaN : Number(flags["--runs"]);
  const [cmd, next] = positional;
  const s = spent(root);
  if (cmd === "spent") {
    console.log(`budget: spent=${round4(s)} cap=${cap}`);
    if (s > cap) process.exit(1);
  } else if (cmd === "check") {
    const n = Number(next);
    if (next === undefined || !Number.isFinite(n) || n < 0) { console.error("budget: check needs a number of at least 0"); process.exit(1); }
    console.log(`budget: spent=${round4(s)} next=${round4(n)} total=${round4(s + n)} cap=${cap}`);
    if (s + n > cap) process.exit(1);
  } else if (cmd === "estimate") {
    if (!Number.isFinite(runsArg) || runsArg < 1) { console.error("budget: estimate needs --runs <n>"); process.exit(1); }
    const e = estimate(root, runsArg);
    if (e === null) { console.error("estimate: no pilot results (a *-pilot-* directory) to take a per-run cost from"); process.exit(1); }
    console.log(`estimate: spent=${round4(e.spent)} remaining=${round4(e.remaining)} total=${round4(e.total)} cap=${cap}`);
    if (e.total > cap) process.exit(1);
  } else {
    console.error("usage: budget-git-sau.mjs spent | check <next> | estimate --runs <n> | --self-test  [--root <dir>] [--cap <n>]");
    process.exit(2);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
