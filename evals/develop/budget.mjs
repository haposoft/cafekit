#!/usr/bin/env node
// Trần riêng của gói develop-substitution ($40, plan D-03): cộng costUsd tầng trên cùng của mọi result.json dưới
// evals/results/develop/v3-* (mọi độ sâu, gồm -lan1). Một ô bị ngắt mà không có result.json không được cộng.
//   node evals/develop/budget.mjs spent [--root <results root>]          in spent=; thoát 1 khi đã vượt 40
//   node evals/develop/budget.mjs check <next> [--root <results root>]   thoát 1 khi spent + next vượt 40
//   node evals/develop/budget.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const CAP = 40;
const round = (x) => Number(x.toFixed(4));

export function spent(root) {
  let total = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "result.json") { try { total += JSON.parse(fs.readFileSync(p, "utf8")).costUsd || 0; } catch { /* unreadable adds nothing */ } }
    }
  };
  const res = path.join(root, "develop");
  if (fs.existsSync(res)) for (const e of fs.readdirSync(res, { withFileTypes: true })) if (e.isDirectory() && e.name.startsWith("v3-")) walk(path.join(res, e.name));
  return round(total);
}

function main(args) {
  let root = path.join(path.dirname(SELF), "..", "results");
  const r = args.indexOf("--root"); if (r >= 0) { root = args[r + 1]; args.splice(r, 2); }
  const x = spent(root);
  if (args[0] === "spent" && args.length === 1) { console.log(`spent=${x} cap=${CAP}`); return x > CAP ? 1 : 0; }
  if (args[0] === "check" && args.length === 2 && Number.isFinite(Number(args[1])) && Number(args[1]) >= 0 && args[1].trim() !== "") {
    const next = Number(args[1]); console.log(`spent=${x} next=${next} total=${round(x + next)} cap=${CAP}`); return x + next > CAP ? 1 : 0;
  }
  console.error("usage: node evals/develop/budget.mjs spent | check <next> [--root <results root>] | --self-test");
  return 2;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "develop-budget-st-"));
  let failed = 0;
  const me = (args) => spawnSync(process.execPath, [SELF, ...args, "--root", root], { encoding: "utf8" });
  const check = (label, ok, out) => { console.log(`${ok ? "ok" : "FAIL"}: budget self-test: ${label}${ok ? "" : ` — ${out}`}`); if (!ok) failed++; };
  const res = (rel, cost) => { const d = path.join(root, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost })); };
  try {
    res("develop/v3-probe-hong-sonnet", 0.5); res("develop/v3-truoc-hong-sonnet-lan1/nested", 3.5); res("develop/git-sau-hong-sonnet", 50); res("brainstorm/x", 9);
    let r = me(["spent"]); check("only v3-* develop cells count, at any depth, -lan1 included → spent=4", r.status === 0 && r.stdout.trim() === "spent=4 cap=40", r.stdout);
    r = me(["check", "36"]); check("check 36 on $4 → total=40, exit 0", r.status === 0 && r.stdout.includes("total=40 "), r.stdout);
    r = me(["check", "36.5"]); check("check 36.5 on $4 → exit 1", r.status === 1, r.stdout);
    r = me(["check", "-1"]); check("check -1 → usage, exit 2", r.status === 2, r.stdout);
    res("develop/v3-sau-hong-opus", 37); r = me(["spent"]); check("spent above the cap → exit 1", r.status === 1, r.stdout);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  process.exit(args[0] === "--self-test" ? selfTest() : main(args));
}
