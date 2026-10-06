#!/usr/bin/env node
// Pre-registered decision of specs/specs-fast-lane (plan D-04), read from the lean-fl-goc-* cells and their traces
// copied to evals/results/specs/_traces/<cell>/run-NN.jsonl.
//   node evals/specs/fast-lane-decision.mjs [--prefix lean-fl-goc-]
// A specs call is read from the trace by skill name, because `khong-goi-specs` matches any Skill input that
// contains "specs" (for example develop's argument `specs/google-login`).
// Direct-done: no specs call, and an Edit or Write that does the asked change. Over-routing per model: direct-done
// ≤16 of the 20 pooled runs of the two direct cases. develop-auth is wrongly stopped when a run calls specs, or
// writes nothing under src/ and does not mark its task blocked; develop-blocked per model: 3 or more of 10.
// mo-ho-drop (report only): a grader shared with lean-re-* that fell by 3 or more runs.
// Exits 1 when a cell is missing or partial, or a trace is missing.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const results = path.resolve(here, "..", "results", "specs");
const MODELS = ["sonnet", "opus"];
const prefix = process.argv[2] === "--prefix" ? process.argv[3] : "lean-fl-goc-";
let bad = 0;

function cell(name) {
  let dir = path.join(results, name);
  if (fs.existsSync(`${dir}-lan1`)) dir += "-lan1";
  const file = path.join(dir, "result.json");
  if (!fs.existsSync(file)) { console.log(`missing ${name}`); bad++; return null; }
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  if (r.partial !== false) { console.log(`partial ${name}`); bad++; return null; }
  return { name: path.basename(dir), runs: r.cases[0].arms.with };
}

function uses(cellName, i) {
  const file = path.join(results, "_traces", cellName, `run-${String(i + 1).padStart(2, "0")}.jsonl`);
  if (!fs.existsSync(file)) { console.log(`missing trace ${cellName} run=${i + 1}`); bad++; return []; }
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "assistant" && Array.isArray(e.message?.content)) for (const b of e.message.content) if (b.type === "tool_use") out.push(b);
  }
  return out;
}

const calledSpecs = (u) => u.some((b) => b.name === "Skill" && /(^|:)specs$/.test(String(b.input?.skill || b.input?.command || "")));
const writes = (u, re) => u.some((b) => (b.name === "Edit" || b.name === "Write") && re.test(JSON.stringify(b.input)));
const DIRECT = { "lam-thang-doi-ten": /formatCustomerName/, "lam-thang-xoa-module": /"file_path":"[^"]*src\/app\.js"/ };

const flags = { over: [], dev: [], drop: [] };
for (const m of MODELS) {
  let done = 0, n = 0;
  const per = [];
  for (const [c, re] of Object.entries(DIRECT)) {
    const x = cell(`${prefix}${c}-${m}`); if (!x) continue;
    let k = 0;
    x.runs.forEach((_, i) => { const u = uses(x.name, i); n++; if (!calledSpecs(u) && writes(u, re)) { k++; done++; } });
    per.push(`${c}=${k}/${x.runs.length}`);
  }
  const over = n === 20 && done <= 16;
  console.log(`direct model=${m} ${per.join(" ")} direct-done=${done}/${n} over-routing=${over ? "yes" : "no"}`);
  if (over) flags.over.push(m);

  const d = cell(`${prefix}develop-auth-${m}`);
  if (d) {
    let src = 0, blocked = 0, specs = 0, cap = 0, wrong = 0;
    d.runs.forEach((x, i) => {
      const u = uses(d.name, i);
      const s = calledSpecs(u), w = writes(u, /"file_path":"[^"]*\/src\//);
      const b = (x.graders || []).some((g) => g.name === "dung-blocked" && g.passed);
      if (w) src++; if (b) blocked++; if (s) specs++;
      if (x.error && /maximum number of turns/.test(x.error)) cap++;
      if (s || (!w && !b)) wrong++;
    });
    const blockedFlag = wrong >= 3;
    console.log(`develop model=${m} src-writes=${src}/${d.runs.length} blocked=${blocked} specs=${specs} turncap=${cap} wrongly-stopped=${wrong} develop-blocked=${blockedFlag ? "yes" : "no"}`);
    if (blockedFlag) flags.dev.push(m);
  }

  for (const c of ["mo-ho-c1", "mo-ho-du-cua"]) {
    const a = cell(`${prefix}${c}-${m}`), b = cell(`lean-re-${c}-${m}`);
    if (!a || !b) continue;
    const count = (runs, g) => runs.filter((x) => (x.graders || []).some((y) => y.name === g && y.passed)).length;
    const names = new Set(b.runs.flatMap((x) => (x.graders || []).map((g) => g.name)));
    const shared = [...new Set(a.runs.flatMap((x) => (x.graders || []).map((g) => g.name)))].filter((g) => names.has(g)).sort();
    const line = shared.map((g) => `${g}=${count(b.runs, g)}→${count(a.runs, g)}`);
    for (const g of shared) if (count(b.runs, g) - count(a.runs, g) >= 3) flags.drop.push(`${c}-${m}:${g}`);
    console.log(`mo-ho model=${m} case=${c} ${line.join(" ")}`);
  }
}
console.log(`over-routing=${flags.over.length ? `yes (${flags.over.join(",")})` : "no"}`);
console.log(`develop-blocked=${flags.dev.length ? `yes (${flags.dev.join(",")})` : "no"}`);
console.log(`mo-ho-drop=${flags.drop.length ? flags.drop.join(",") : "none"}`);
process.exit(bad ? 1 : 0);
