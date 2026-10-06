#!/usr/bin/env node
// Ngân sách dùng chung với gói code-review (plan D-09, trần $230): cộng costUsd tầng trên cùng của mọi result.json ở
// mọi độ sâu dưới <root>/code-review/ và <root>/research/ (gồm cả -lan1 và _pilot-lan*), cộng các trần sắp chạy —
// một trần cho mỗi ô sắp bắt đầu, nên hai ô chạy song song được kiểm cùng lúc — và thoát 1 khi tổng vượt 230.
//   node evals/research/budget.mjs <ceiling>... [--root <results root>]
//   node evals/research/budget.mjs --worst-case [--root <results root>]   (chỉ in, thoát 0)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CASES, ceilingOf } from "./ceiling.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CAP = 230;

function spent(root) {
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
  walk(path.join(root, "code-review"));
  walk(path.join(root, "research"));
  return total;
}

const args = process.argv.slice(2);
let root = path.join(here, "..", "results");
const r = args.indexOf("--root");
if (r >= 0) { root = args[r + 1]; args.splice(r, 2); }
if (!root) { console.error("usage: --root <results root>"); process.exit(2); }

if (args[0] === "--worst-case") {
  const x = spent(root);
  let y = 0;
  for (const c of CASES) for (const route of ["skill", "agent"]) for (const model of ["sonnet", "opus"]) {
    const cell = `base-${c}${route === "agent" ? "-agent" : ""}-${model}`;
    if (fs.existsSync(path.join(root, "research", cell))) continue;
    const k = ceilingOf(model, route, path.join(root, "research"));
    if (k.error) { console.log(`worst-case: ${k.error}`); process.exit(0); }
    y += k.ceiling;
  }
  console.log(`worst-case: spent=${x} remaining-ceilings=${y} total=${x + y} cap=${CAP}`);
  process.exit(0);
}

if (!args.length || args.some((a) => a.trim() === "" || !Number.isFinite(Number(a)) || Number(a) < 0)) {
  console.error("usage: node evals/research/budget.mjs <ceiling>... [--root <results root>] | --worst-case");
  process.exit(1);
}
const x = spent(root);
const next = args.reduce((a, s) => a + Number(s), 0);
console.log(`spent=${x} next=${next} total=${x + next} cap=${CAP}`);
process.exit(x + next > CAP ? 1 : 0);
