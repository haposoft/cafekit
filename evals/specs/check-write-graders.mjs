#!/usr/bin/env node
// Replay the specs cases' tool_used graders over saved run traces, at $0 (specs/specs-routing-repair task 01).
// `khong-code` reads only last_message, so a run that implements through Edit/Write passes it; `khong-sua-code` and
// `khong-viet-code` catch writes under src/. This replays them over the lean-re traces copied to
// evals/results/specs/_traces/<cell>/run-NN.jsonl and must fail exactly the three runs known to have implemented.
// To show the replay matches the harness, each case's Skill grader (`co-goi-skill`; `da-goi-specs` in mo-ho-du-cua) is
// replayed the same way and must agree with the stored verdict in all 80 runs.
//   node evals/specs/check-write-graders.mjs
//   node evals/specs/check-write-graders.mjs --cells   (task 04: union-miss of lean-goc vs lean-sau build cells)
// Prints `fail <cell> run=<n> grader=<g>`, `disagree <cell> run=<n>`, then
// `runs=<n> failing=<cell:run,…> disagree=<k>`, `compared=<n>` and `digest=<evals/specs digest>`; exits 0 only for the
// expected failing set, 80 runs, 80 compared and no disagreement.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const results = path.join(repo, "evals", "results", "specs");
const CASES = ["dung-o-c1", "export-csv", "mo-ho-c1", "mo-ho-du-cua"];
const MODELS = ["sonnet", "opus"];
const WRITE_GRADERS = ["khong-sua-code", "khong-viet-code"];
const EXPECTED = "dung-o-c1-sonnet:9,dung-o-c1-sonnet:10,export-csv-sonnet:3";

export function readGrader(file) {
  const text = fs.readFileSync(file, "utf8");
  const field = (k) => { const m = text.match(new RegExp(`^${k}:\\s*(.*)$`, "m")); return m ? m[1].trim().replace(/^'(.*)'$/, (_, v) => v.replace(/''/g, "'")).replace(/^"(.*)"$/, "$1") : undefined; };
  if (field("type") !== "tool_used") throw new Error(`${file}: not a tool_used grader`);
  const min = field("min"), max = field("max");
  return { tool: field("tool"), match: new RegExp(field("input_match")), min: min === undefined ? 1 : Number(min), max: max === undefined ? Infinity : Number(max) };
}

export function toolUses(traceFile) {
  const uses = [];
  for (const line of fs.readFileSync(traceFile, "utf8").split("\n")) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type !== "assistant" || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) if (b.type === "tool_use") uses.push(b);
  }
  return uses;
}

export function passes(grader, uses) {
  const n = uses.filter((u) => u.name === grader.tool && grader.match.test(JSON.stringify(u.input))).length;
  return n >= grader.min && n <= grader.max;
}

function digest(dir) {
  return execSync(`(cd '${dir}' && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16`, { encoding: "utf8" }).trim();
}

function traceMode() {
  let total = 0, compared = 0, disagree = 0;
  const failing = [];
  for (const c of CASES) {
    // mo-ho-du-cua has no co-goi-skill grader; its Skill call is graded by da-goi-specs.
    const skillGrader = c === "mo-ho-du-cua" ? "da-goi-specs" : "co-goi-skill";
    const graders = Object.fromEntries([...WRITE_GRADERS, skillGrader].map((g) => [g, readGrader(path.join(here, c, "graders", `${g}.md`))]));
    for (const m of MODELS) {
      const cell = `${c}-${m}`;
      const stored = JSON.parse(fs.readFileSync(path.join(results, `lean-re-${cell}`, "result.json"), "utf8")).cases[0].arms.with;
      const dir = path.join(results, "_traces", `lean-re-${cell}`);
      const files = fs.readdirSync(dir).filter((f) => /^run-\d+\.jsonl$/.test(f)).sort();
      if (files.length !== stored.length) throw new Error(`${cell}: ${files.length} traces for ${stored.length} runs`);
      files.forEach((f, i) => {
        const uses = toolUses(path.join(dir, f));
        const run = i + 1;
        total++;
        let failed = false;
        for (const g of WRITE_GRADERS) if (!passes(graders[g], uses)) { console.log(`fail ${cell} run=${run} grader=${g}`); failed = true; }
        if (failed) failing.push(`${cell}:${run}`);
        const saved = stored[i].graders.find((x) => x.name === skillGrader);
        if (saved) compared++;
        if (!saved || saved.passed !== passes(graders[skillGrader], uses)) { console.log(`disagree ${cell} run=${run}`); disagree++; }
      });
    }
  }
  console.log(`runs=${total} failing=${failing.join(",")} disagree=${disagree}`);
  console.log(`compared=${compared}`);
  console.log(`digest=${digest(here)}`);
  return total === 80 && failing.join(",") === EXPECTED && compared === 80 && disagree === 0 ? 0 : 1;
}

// A build run misses when it edits or writes under src/ (either write grader fails on its trace). Counting from the trace
// keeps runs that ended on the turn cap, which evals/lean/compare.mjs drops with every errored run (D-05).
async function cellsMode() {
  const { fisher, fmt } = await import("../lean/compare.mjs");
  let bad = 0;
  for (const m of MODELS) {
    const counts = {};
    for (const side of ["goc", "sau"]) {
      let miss = 0, n = 0;
      for (const c of ["dung-o-c1", "export-csv"]) {
        const graders = WRITE_GRADERS.map((g) => readGrader(path.join(here, c, "graders", `${g}.md`)));
        let name = `lean-${side}-${c}-${m}`;
        if (fs.existsSync(path.join(results, `${name}-lan1`))) name += "-lan1";
        const stored = JSON.parse(fs.readFileSync(path.join(results, name, "result.json"), "utf8")).cases[0].arms.with;
        const dir = path.join(results, "_traces", name);
        fs.mkdirSync(dir, { recursive: true });
        stored.forEach((x, i) => {
          const file = path.join(dir, `run-${String(i + 1).padStart(2, "0")}.jsonl`);
          if (!fs.existsSync(file)) {
            try { fs.copyFileSync(x.tracePath, file); } catch { console.log(`missing trace ${name} run=${i + 1}`); bad++; return; }
          }
          n++;
          if (graders.some((g) => !passes(g, toolUses(file)))) miss++;
        });
      }
      counts[side] = [miss, n];
    }
    const [[x, n], [y, k]] = [counts.goc, counts.sau];
    console.log(`union-miss model=${m} base=${x}/${n} after=${y}/${k} p=${fmt(fisher(x, n, y, k))}`);
  }
  return bad ? 1 : 0;
}

const arg = process.argv[2];
if (arg !== undefined && arg !== "--cells") { console.error("usage: node evals/specs/check-write-graders.mjs [--cells]"); process.exit(2); }
process.exit(arg === "--cells" ? await cellsMode() : traceMode());
