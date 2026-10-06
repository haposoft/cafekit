#!/usr/bin/env node
// Trần tiền của gói lean-fix-debug, $150 (plan D-04): cộng costUsd tầng trên cùng và judgeCostUsd của mọi lượt, trên mọi
// result.json nằm ngay dưới một thư mục evals/results/{fix,debug}/lean-* (pilot, ô và các ô -lan1 đều tính).
//   node evals/lean/budget.mjs spent [--root <results root>]         in `budget: spent=<x> cap=150`; thoát 1 khi vượt trần
//   node evals/lean/budget.mjs check <next> [--root <results root>]  in thêm next= total=; thoát 1 khi spent + next vượt trần
//   --skills <a,b> (default fix,debug) and --cap <n> (default 150) may sit anywhere (specs/lean-ask D-04).
//   node evals/lean/budget.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_CAP = 150;
const DEFAULT_SKILLS = ["fix", "debug"];
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function spent(root, skills = DEFAULT_SKILLS) {
  let total = 0;
  for (const skill of skills) {
    const dir = path.join(root, skill);
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || !e.name.startsWith("lean-")) continue;
      const file = path.join(dir, e.name, "result.json");
      if (!fs.existsSync(file)) continue;
      const r = JSON.parse(fs.readFileSync(file, "utf8"));
      total += r.costUsd || 0;
      for (const c of r.cases || []) for (const arm of Object.values(c.arms || {})) for (const x of arm || []) total += x.judgeCostUsd || 0;
    }
  }
  return Number(total.toFixed(4));
}

function main(args) {
  let root = path.join(repo, "evals", "results");
  let skills = DEFAULT_SKILLS;
  let CAP = DEFAULT_CAP;
  // Flags may sit anywhere; each is removed from the positional list before it is read.
  const take = (flag) => { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1]; args = args.filter((_, k) => k !== i && k !== i + 1); if (v === undefined || v === "") throw new Error(`${flag} takes a value`); return v; };
  try {
  const r = take("--root"); if (r !== null) root = path.resolve(r);
  const sk = take("--skills"); if (sk !== null) skills = sk.split(",").filter(Boolean);
  const cp = take("--cap"); if (cp !== null) { CAP = Number(cp); if (!Number.isFinite(CAP) || CAP < 0) { console.error("--cap takes a number"); return 2; } }
  } catch (err) { console.error(err.message); return 2; }
  const s = spent(root, skills);
  if (args[0] === "spent" && args.length === 1) {
    console.log(`budget: spent=${s} cap=${CAP}`);
    return s > CAP ? 1 : 0;
  }
  if (args[0] === "check" && args.length === 2 && Number.isFinite(Number(args[1])) && Number(args[1]) >= 0) {
    const next = Number(args[1]);
    const total = Number((s + next).toFixed(4));
    console.log(`budget: spent=${s} next=${next} total=${total} cap=${CAP}`);
    return total > CAP ? 1 : 0;
  }
  console.error("usage: node evals/lean/budget.mjs spent | check <next> [--root <results root>] [--skills <a,b>] [--cap <n>] | --self-test");
  return 2;
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lean-budget-"));
  let failed = 0;
  const expect = (label, cond, detail) => { console.log(`${cond ? "ok" : "fail"}: ${label}${cond ? "" : ` → ${detail}`}`); if (!cond) failed++; };
  try {
    expect("empty root → 0", spent(tmp) === 0, spent(tmp));
    const mk = (skill, name, cost, judges) => {
      const dir = path.join(tmp, skill, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ costUsd: cost, cases: [{ arms: { with: judges.map((j) => ({ judgeCostUsd: j })) } }] }));
    };
    mk("fix", "lean-goc-a-sonnet", 2, [0.1, 0.2]);
    mk("debug", "lean-pilot-goc-b-opus", 1.5, [0.05]);
    mk("fix", "lean-goc-a-sonnet-lan1", 1, []);
    mk("fix", "base-a-sonnet", 50, [1]);
    mk("ask", "lean-goc-x-sonnet", 50, []);
    fs.mkdirSync(path.join(tmp, "fix", "lean-empty"), { recursive: true });
    expect("sums lean-* under fix and debug only", spent(tmp) === 4.85, spent(tmp));
    expect("check within cap → 0", main(["check", "100", "--root", tmp]) === 0, "exit");
    expect("check above cap → 1", main(["check", "146", "--root", tmp]) === 1, "exit");
    expect("spent within cap → 0", main(["spent", "--root", tmp]) === 0, "exit");
    mk("debug", "lean-sau-big-opus", 200, []);
    expect("spent above cap → 1", main(["spent", "--root", tmp]) === 1, "exit");
    expect("bad usage → 2", main(["check", "-1", "--root", tmp]) === 2, "exit");
    mk("ask", "lean-goc-x-sonnet-2", 3, [0.5]);
    expect("--skills ask sums ask only", spent(tmp, ["ask"]) === 53.5, spent(tmp, ["ask"]));
    expect("--skills ask --cap 60 after check → 1 above 60", main(["check", "7", "--skills", "ask", "--cap", "60", "--root", tmp]) === 1, "exit");
    expect("--skills without a value → 2", main(["spent", "--skills"]) === 2, "exit");
    expect("--cap empty → 2", main(["spent", "--cap", ""]) === 2, "exit");
    expect("--skills ask --cap 60 spent within → 0", main(["spent", "--skills", "ask", "--cap", "60", "--root", tmp]) === 0, "exit");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") selfTest();
else process.exit(main(args));
