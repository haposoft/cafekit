#!/usr/bin/env node
// Figures the debug baseline needs that evals/summarize.mjs does not print:
//   - for a case with `da-chay` and `noi-do-tin-cao`: runs by (executed code?) x (stated high
//     confidence?), plus the runs that stated no confidence at all (`co-noi-do-tin` failed);
//   - median duration and cost over all runs;
//   - every grader a run left unscored, and whether paid graders were skipped by the cost ceiling.
//
//   node evals/debug/cross-count.mjs evals/results/debug/<dir>...
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const directories = process.argv.slice(2);
if (directories.length === 0) {
  console.error("usage: node evals/debug/cross-count.mjs <result directory>...");
  process.exit(2);
}

const median = (values) => {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const grader = (run, name) => (run.graders || []).find((item) => item.name === name);
const calls = (run, name) => Number(/called (\d+)x/.exec(grader(run, name)?.explanation || "")?.[1] ?? NaN);

let failed = false;
for (const directory of directories) {
  let report;
  try {
    report = JSON.parse(await readFile(join(directory, "result.json"), "utf8"));
  } catch (error) {
    console.error(`skipped ${directory}: ${error.message}`);
    failed = true;
    continue;
  }
  // Same denominator rule as evals/summarize.mjs: a run cut short is reported and skipped.
  if (report.partial) {
    console.error(`skipped ${directory}: partial run (${report.partialReason || "reason not recorded"})`);
    continue;
  }
  for (const caseEntry of report.cases || []) {
    for (const [arm, runs] of Object.entries(caseEntry.arms || {})) {
      console.log(`\n${directory}  ${caseEntry.name} [${arm}]  runs ${runs.length}`);
      const cost = median(runs.map((run) => run.costUsd));
      console.log(`  median seconds ${median(runs.map((run) => run.durationSeconds)) ?? "n/a"}  median cost ${cost === null ? "n/a" : `$${cost.toFixed(4)}`} (run cost, judge cost excluded)`);
      if (runs.some((run) => grader(run, "da-chay") && grader(run, "noi-do-tin-cao"))) {
        const cell = { ranHigh: 0, ranNotHigh: 0, notRanHigh: 0, notRanNotHigh: 0, notStated: 0, errored: 0 };
        for (const run of runs) {
          if (run.error || !grader(run, "da-chay") || !grader(run, "noi-do-tin-cao")) { cell.errored++; continue; }
          if (!grader(run, "co-noi-do-tin")?.passed) { cell.notStated++; continue; }
          const ran = calls(run, "da-chay") > 0;
          const high = Boolean(grader(run, "noi-do-tin-cao")?.passed);
          cell[`${ran ? "ran" : "notRan"}${high ? "High" : "NotHigh"}`]++;
        }
        console.log(`  stated high:     executed ${cell.ranHigh}   not executed ${cell.notRanHigh}`);
        console.log(`  stated not high: executed ${cell.ranNotHigh}   not executed ${cell.notRanNotHigh}`);
        console.log(`  stated no confidence: ${cell.notStated}   errored or ungraded: ${cell.errored}`);
      }
      runs.forEach((run, index) => {
        const unscored = (run.graders || []).filter((item) => item.scored === false).map((item) => item.name);
        if (unscored.length || run.skippedPaidGraders || run.error) {
          console.log(`  run ${index + 1}: ${run.error ? `error "${run.error}" ` : ""}${unscored.length ? `unscored ${unscored.join(", ")} ` : ""}${run.skippedPaidGraders ? "paid graders skipped" : ""}`.trimEnd());
        }
      });
    }
  }
}
process.exit(failed ? 1 : 0);
