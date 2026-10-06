#!/usr/bin/env node
// Trần ngân sách của gói fix-repair: $60 (quyết định GATE-SCOPE), hay --cap theo quyết định sau của user.
// Cộng, trên mọi result.json nằm ngay dưới một thư mục evals/results/fix/sau-* (pilot và mọi thư mục cất riêng
// -lan1, -reboot, -ver đều tính), costUsd tầng trên cùng với judgeCostUsd của từng lượt: costUsd tầng trên chỉ là tổng
// costUsd các lượt, không gồm tiền chấm. So với cap bằng đúng số đã in (làm tròn 4 chữ số).
//   spent           in spent so với cap; thoát 1 khi spent vượt cap
//   check <next>    thoát 1 khi spent + next vượt cap, hay khi next không phải số
// Mọi lệnh nhận --cap <n> (mặc định 60).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const results = path.join(here, "results", "fix");
const r4 = (v) => Number(v.toFixed(4));

function spent() {
  let total = 0;
  const dirs = fs.existsSync(results) ? fs.readdirSync(results, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("sau-")) : [];
  for (const d of dirs) {
    const f = path.join(results, d.name, "result.json");
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    total += r.costUsd || 0;
    for (const c of r.cases || []) for (const w of (c.arms && c.arms.with) || []) total += w.judgeCostUsd || 0;
  }
  return total;
}

const a = process.argv.slice(2);
const i = a.indexOf("--cap");
const cap = i < 0 ? 60 : Number(a.splice(i, 2)[1]);
if (!Number.isFinite(cap)) { console.error("budget-fix-sau: --cap takes a number"); process.exit(2); }

if (a[0] === "spent") {
  const x = r4(spent());
  console.log(`budget: spent=${x} cap=${cap}`);
  process.exit(x > cap ? 1 : 0);
}
if (a[0] === "check") {
  const n = a[1] === undefined || a[1].trim() === "" ? NaN : Number(a[1]);
  if (!Number.isFinite(n)) { console.error(`budget-fix-sau: next must be a number, got ${JSON.stringify(a[1])}`); process.exit(1); }
  const x = r4(spent()), total = r4(x + n);
  console.log(`budget: spent=${x} next=${n} total=${total} cap=${cap}`);
  process.exit(total > cap ? 1 : 0);
}
console.error("usage: node evals/budget-fix-sau.mjs <spent | check <next>> [--cap n]");
process.exit(2);
