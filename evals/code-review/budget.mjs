#!/usr/bin/env node
// Luật ngân sách dùng chung với gói research (plan D-06), không làm gì khác.
//   node evals/code-review/budget.mjs spent
//   node evals/code-review/budget.mjs check <next>
//   node evals/code-review/budget.mjs ceilings <pilot result dir>...
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const CAP = 150;

function walkResultFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === "result.json") out.push(full);
    }
  }
  return out;
}

function costOf(result) {
  let total = 0;
  for (const kase of result.cases || []) {
    for (const arm of Object.values(kase.arms || {})) {
      for (const run of arm) total += run.costUsd || 0;
    }
  }
  return total;
}

function spent() {
  const files = [
    ...walkResultFiles(path.join(root, "evals", "results", "code-review")),
    ...walkResultFiles(path.join(root, "evals", "results", "research")),
  ];
  let total = 0;
  for (const f of files) {
    try { total += costOf(JSON.parse(fs.readFileSync(f, "utf8"))); } catch { /* unreadable result: contributes 0, not silently trusted elsewhere */ }
  }
  return total;
}

const mode = process.argv[2];

if (mode === "spent") {
  const x = spent();
  console.log(`budget: spent=${x} cap=${CAP}`);
  process.exit(0);
}

if (mode === "check") {
  const n = Number(process.argv[3]);
  const x = spent();
  const total = x + n;
  console.log(`budget: spent=${x} next=${n} total=${total} cap=${CAP}`);
  process.exit(total > CAP ? 1 : 0);
}

if (mode === "ceilings") {
  const dirs = process.argv.slice(3);
  const expectedKeys = ["opus-agent", "opus-skill", "sonnet-agent", "sonnet-skill"].sort();
  const groups = Object.fromEntries(expectedKeys.map((k) => [k, []]));
  let broken = false;
  for (const dir of dirs) {
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch { broken = true; continue; }
    if (r.partial) broken = true;
    const model = r.suite && r.suite.modelOverride;
    const kase = r.cases && r.cases[0];
    if (!kase || !model) { broken = true; continue; }
    const pathGroup = /-agent$/.test(kase.name) ? "agent" : "skill";
    const key = `${model}-${pathGroup}`;
    if (!(key in groups)) { broken = true; continue; }
    for (const arm of Object.values(kase.arms || {})) for (const run of arm) groups[key].push(run.costUsd || 0);
  }
  const H = {};
  let missing = false;
  for (const key of expectedKeys) {
    if (!groups[key].length) { missing = true; continue; }
    H[key] = Math.max(...groups[key]);
  }
  if (missing || broken) {
    console.log("ceilings: a group is missing or a directory is partial or unreadable");
    process.exit(1);
  }
  const ceilings = {};
  for (const key of expectedKeys) {
    ceilings[key] = Math.max(6, Math.ceil(12 * H[key]));
    console.log(`ceiling-${key}=${ceilings[key]}`);
  }
  const overCap = expectedKeys.filter((key) => ceilings[key] > (key.startsWith("opus") ? 20 : 15));
  console.log(`over-cap=${overCap.length ? overCap.join(",") : "none"}`);
  const worst = spent() + expectedKeys.reduce((sum, key) => sum + 5 * (ceilings[key] + H[key]), 0);
  console.log(`worst-case-usd=${worst}`);
  process.exit(0);
}

console.error("usage: node evals/code-review/budget.mjs <spent|check <next>|ceilings <pilot result dir>...>");
process.exit(2);
