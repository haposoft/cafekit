#!/usr/bin/env node
// Trần ngân sách chung $200 cho code-review và research (quyết định GATE-REVIEW của gói code-review-repair).
// evals/code-review/budget.mjs ghim CAP=150 và nằm trong bộ đo không được sửa, nên script này chỉ đọc con số
// `spent` nó in ra (cùng một tổng trên mọi result.json dưới evals/results/code-review/ và evals/results/research/)
// rồi so với 200.
//   node evals/budget-cap.mjs spent
//   node evals/budget-cap.mjs check <next>
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CAP = 200;

function spent() {
  const r = spawnSync(process.execPath, [path.join(here, "code-review", "budget.mjs"), "spent"], { encoding: "utf8" });
  const m = r.status === 0 ? (r.stdout || "").match(/^budget: spent=(\S+) cap=\S+$/m) : null;
  const x = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(x)) {
    console.error("budget-cap: unreadable spent line from evals/code-review/budget.mjs");
    process.exit(1);
  }
  return x;
}

const [mode, arg] = process.argv.slice(2);

if (mode === "spent") {
  console.log(`budget: spent=${spent()} cap=${CAP}`);
  process.exit(0);
}

if (mode === "check") {
  const n = arg === undefined || arg.trim() === "" ? NaN : Number(arg);
  if (!Number.isFinite(n)) {
    console.error(`budget-cap: next must be a number, got ${JSON.stringify(arg)}`);
    process.exit(1);
  }
  const x = spent();
  const total = x + n;
  console.log(`budget: spent=${x} next=${n} total=${total} cap=${CAP}`);
  process.exit(total > CAP ? 1 : 0);
}

console.error("usage: node evals/budget-cap.mjs <spent|check <next>>");
process.exit(2);
