#!/usr/bin/env node
// Ngân sách riêng của gói brainstorm (plan D-04, trần $100 cho gói số gốc và gói sửa sau): cộng costUsd tầng trên cùng của
// mọi result.json ở mọi độ sâu dưới <root>/brainstorm/ (gồm probe-*, pilot-*, base-*, -lan1, -quota, -reboot và
// _pilot-lan*). Tự đọc con số đã tiêu, không dựa vào mã thoát của script khác.
//   node evals/brainstorm/budget.mjs spent [--root <results root>]          in spent=; thoát 1 khi đã vượt 100
//   node evals/brainstorm/budget.mjs check <next> [--root <results root>]   thoát 1 khi spent + next vượt 100
//   node evals/brainstorm/budget.mjs worst-case [--root <results root>] [--prefix <p>]
//                                                                             spent cộng trần của các ô chưa có (base-*;
//                                                                             với --prefix sau-pilot- là các ô sau-*);
//                                                                             thoát 1 chỉ khi một trần không tính được
//   node evals/brainstorm/budget.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { ROUTES, ceilingOf } from "./ceiling.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const CAP = 100;
const round = (x) => Number(x.toFixed(4));

export function spent(root) {
  let total = 0;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "result.json") {
        try { total += JSON.parse(fs.readFileSync(p, "utf8")).costUsd || 0; } catch { /* an unreadable result adds nothing */ }
      }
    }
  };
  walk(path.join(root, "brainstorm"));
  return round(total);
}

function main(args) {
  let root = path.join(here, "..", "results");
  const r = args.indexOf("--root");
  if (r >= 0) { root = args[r + 1]; args.splice(r, 2); }
  if (!root) { console.error("usage: --root <results root>"); return 2; }
  let prefix = "pilot-";
  const pr = args.indexOf("--prefix");
  if (pr >= 0) { prefix = args[pr + 1]; args.splice(pr, 2); }
  if (!prefix) { console.error("usage: --prefix <p>"); return 2; }
  const cellPrefix = prefix === "pilot-" ? "base-" : prefix.replace(/pilot-$/, "");
  const x = spent(root);
  if (args[0] === "spent" && args.length === 1) { console.log(`spent=${x} cap=${CAP}`); return x > CAP ? 1 : 0; }
  if (args[0] === "check" && args.length === 2 && args[1].trim() !== "" && Number.isFinite(Number(args[1])) && Number(args[1]) >= 0) {
    const next = Number(args[1]);
    console.log(`spent=${x} next=${next} total=${round(x + next)} cap=${CAP}`);
    return x + next > CAP ? 1 : 0;
  }
  if (args[0] === "worst-case" && args.length === 1) {
    let y = 0;
    for (const [route, cases] of Object.entries(ROUTES)) for (const c of cases) for (const model of ["sonnet", "opus"]) {
      if (fs.existsSync(path.join(root, "brainstorm", `${cellPrefix}${c}-${model}`))) continue;
      const k = ceilingOf(model, route, path.join(root, "brainstorm"), prefix);
      if (k.error) { console.log(`worst-case: ${k.error}`); return 1; }
      y += k.ceiling;
    }
    console.log(`worst-case: spent=${x} remaining-ceilings=${y} total=${round(x + y)} cap=${CAP} over-cap=${x + y > CAP ? "yes" : "no"}`);
    return 0;
  }
  console.error("usage: node evals/brainstorm/budget.mjs spent | check <next> | worst-case [--root <results root>] | --self-test");
  return 2;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brainstorm-budget-"));
  let failed = 0;
  const me = (args) => spawnSync(process.execPath, [SELF, ...args, "--root", root], { encoding: "utf8" });
  const check = (label, ok, out) => { console.log(`${ok ? "ok" : "FAIL"}: budget self-test: ${label}${ok ? "" : ` — ${out}`}`); if (!ok) failed++; };
  const res = (rel, cost, runs) => { const d = path.join(root, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial: false, cases: [{ arms: { with: (runs || [cost]).map((c) => ({ costUsd: c })) } }] })); };
  try {
    res("brainstorm/probe-tham-do-nap-skill-sonnet", 0.3); res("brainstorm/_pilot-lan1/pilot-ne-cau-hoi-sonnet", 0.7); res("research/base-x-sonnet", 50);
    let r = me(["spent"]);
    check("spent counts brainstorm only, nested sets included → spent=1", r.status === 0 && r.stdout.trim() === "spent=1 cap=100", r.stdout);
    r = me(["check", "99"]); check("check 99 on $1 → total=100, exit 0", r.status === 0 && r.stdout.includes("total=100 "), r.stdout);
    r = me(["check", "99.5"]); check("check 99.5 on $1 → exit 1", r.status === 1, r.stdout);
    r = me(["check", "-1"]); check("check -1 → usage, exit 2", r.status === 2, r.stdout);
    r = me(["worst-case"]); check("worst-case without pilots → names the missing pilot, exit 1", r.status === 1 && r.stdout.includes("missing pilot"), r.stdout);
    for (const c of ROUTES.skill) for (const m of ["sonnet", "opus"]) res(`brainstorm/pilot-${c}-${m}`, 0.25);
    for (const m of ["sonnet", "opus"]) res(`brainstorm/pilot-mot-duong-agent-${m}`, 0.5);
    res("brainstorm/base-ne-cau-hoi-sonnet", 2, [0.2]);
    r = me(["worst-case"]);
    // spent = 1 + 6 × 0.25 + 2 × 0.5 + 2 = 5.5; ceilings: skill 4 each for 5 cells left = 20, agent ⌈7.5⌉ = 8 twice = 16
    check("worst-case skips the finished base cell → spent=5.5 remaining-ceilings=36 total=41.5", r.status === 0 && r.stdout.trim() === "worst-case: spent=5.5 remaining-ceilings=36 total=41.5 cap=100 over-cap=no", r.stdout);
    res("brainstorm/base-ne-cau-hoi-opus", 99, [99]);
    r = me(["spent"]); check("spent above the cap → exit 1", r.status === 1 && r.stdout.startsWith("spent=104.5 "), r.stdout);
    for (const c of ROUTES.skill) for (const m of ["sonnet", "opus"]) res(`brainstorm/sau-pilot-${c}-${m}`, 0.25);
    for (const m of ["sonnet", "opus"]) res(`brainstorm/sau-pilot-mot-duong-agent-${m}`, 0.5);
    res("brainstorm/sau-ne-cau-hoi-sonnet", 1, [0.1]);
    r = me(["worst-case", "--prefix", "sau-pilot-"]);
    // spent = 104.5 + 6 × 0.25 + 2 × 0.5 + 1 = 108; after-ceilings: skill 4 each for 5 cells left, agent 8 twice
    check("worst-case --prefix sau-pilot- skips the finished sau- cell → remaining-ceilings=36", r.status === 0 && r.stdout.includes("remaining-ceilings=36 ") && r.stdout.includes("over-cap=yes"), r.stdout);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  process.exit(args[0] === "--self-test" ? selfTest() : main(args));
}
