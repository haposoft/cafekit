#!/usr/bin/env node
// Trần riêng của gói sync-skill-repair ($120, plan D-07): cộng costUsd tầng trên cùng của mọi result.json trong các thư mục
// evals/results/sync/base-* và sau-* (gồm pilot `base-pilot-*`/`sau-pilot-*` và lần chạy lại `-lan<k>`). Thư mục không có result.json
// (ô bị ngắt) cộng 0; thư mục kept/ (bản chép bằng chứng) không được đọc.
//   node evals/budget-sync.mjs spent [--root <dir>]              in `budget: spent=<usd> cap=120`; thoát 1 khi đã vượt trần
//   node evals/budget-sync.mjs check <next> [--root <dir>]       thoát 1 khi spent + next vượt trần
//   node evals/budget-sync.mjs estimate <per-run> <runs> [--root <dir>]   in dự toán; thoát 1 khi spent + per-run × runs vượt trần
//   node evals/budget-sync.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

export const CAP = 120;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "results", "sync");
const round = (x) => Number(x.toFixed(4));

export function spent(root = ROOT) {
  if (!fs.existsSync(root)) return 0;
  let total = 0;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || !/^(?:base|sau)-/.test(e.name)) continue;
    const f = path.join(root, e.name, "result.json");
    try { total += JSON.parse(fs.readFileSync(f, "utf8")).costUsd || 0; } catch { /* không có hay không đọc được: cộng 0 */ }
  }
  return round(total);
}

function parse(argv) {
  const opts = { root: ROOT, cap: CAP, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--root" || argv[i] === "--cap") && argv[i + 1] === undefined) { console.error(`budget: ${argv[i]} needs a value`); process.exit(2); }
    if (argv[i] === "--root") opts.root = path.resolve(argv[++i]);
    else if (argv[i] === "--cap") opts.cap = Number(argv[++i]);
    else opts.rest.push(argv[i]);
  }
  if (!Number.isFinite(opts.cap) || opts.cap < 0) { console.error("budget: --cap must be a non-negative number"); process.exit(2); }
  return opts;
}

function selfTest() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "budget-sync-"));
  const fail = (m) => { console.error(`self-test FAIL: ${m}`); process.exit(1); };
  try {
    const cell = (name, cost) => { fs.mkdirSync(path.join(T, name), { recursive: true }); if (cost !== null) fs.writeFileSync(path.join(T, name, "result.json"), JSON.stringify({ costUsd: cost })); };
    cell("base-rebind-base-moved-opus", 10.5);
    cell("base-pilot-rebind-base-moved-opus", 1.25);
    cell("base-rebind-base-moved-opus-lan1", 2);
    cell("sau-audit-handwritten-receipt-sonnet", 0.25);
    cell("base-bare-sync-gate-noise-opus", null);
    cell("kept", 99);
    cell("other-thing", 50);
    const s = spent(T);
    if (s !== 14) fail(`spent ${s} != 14`);
    console.log("ok pilot-counted");
    console.log("ok rerun-counted");
    console.log("ok no-result-ignored");
    if (spent(path.join(T, "missing")) !== 0) fail("a missing root must spend 0");
    console.log("self-test ok");
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
}

const isMain = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) {
  const [cmd, ...argv] = process.argv.slice(2);
  if (cmd === "--self-test") selfTest();
  else {
    const o = parse(argv);
    const s = spent(o.root);
    if (cmd === "spent") { console.log(`budget: spent=${s} cap=${o.cap}`); process.exit(s > o.cap ? 1 : 0); }
    else if (cmd === "check") {
      const next = Number(o.rest[0]);
      if (!Number.isFinite(next) || next < 0) { console.error("usage: budget-sync.mjs check <next>"); process.exit(2); }
      const total = round(s + next);
      console.log(`budget: spent=${s} next=${next} total=${total} cap=${o.cap}`);
      process.exit(total > o.cap ? 1 : 0);
    } else if (cmd === "estimate") {
      const per = Number(o.rest[0]), runs = Number(o.rest[1]);
      if (!Number.isFinite(per) || !Number.isFinite(runs) || per < 0 || runs < 0) { console.error("usage: budget-sync.mjs estimate <per-run> <runs>"); process.exit(2); }
      const est = round(per * runs), total = round(s + est);
      console.log(`budget: spent=${s} estimate=${est} total=${total} cap=${o.cap} remaining=${round(o.cap - total)}`);
      process.exit(total > o.cap ? 1 : 0);
    } else { console.error("usage: budget-sync.mjs spent|check <next>|estimate <per-run> <runs> [--root <dir>] | --self-test"); process.exit(2); }
  }
}
