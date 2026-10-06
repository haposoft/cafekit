#!/usr/bin/env node
// Count what a measurement task must report, from named result directories only.
//
//   node evals/summarize.mjs evals/results/specs/sonnet-single evals/results/specs/sonnet-history
//
// Why this exists: the harness prints one score per case, not the per-grader pass counts an
// acceptance bar is written in, and a date filter would pool smoke runs, aborted runs and
// retries into one denominator. So the caller names the directories, and a directory whose
// run was cut short (`partial: true`) is reported and skipped rather than counted.
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const directories = process.argv.slice(2).filter((value) => !value.startsWith("-"));
if (directories.length === 0) {
  console.error("usage: node evals/summarize.mjs <result directory>...");
  process.exit(2);
}

const SKILL_GRADERS = new Set(["co-goi-skill", "khong-goi-specs", "goi-scout"]);

function armRuns(caseEntry) {
  const arms = caseEntry.arms && typeof caseEntry.arms === "object" ? caseEntry.arms : {};
  return Object.entries(arms).map(([arm, runs]) => [arm, Array.isArray(runs) ? runs : []]);
}

// One run counts as having invoked the skill when its skill grader observed a call. The
// `tool_used` explanation carries the observed count ("Skill called 2x (expected 1..)"), so a
// negative case that passes with `min: 0, max: 0` still reports zero invocations, not a pass.
function skillCalls(run) {
  for (const grader of run.graders || []) {
    if (!SKILL_GRADERS.has(grader.name)) continue;
    const match = /Skill called (\d+)x/.exec(grader.explanation || "");
    if (match) return Number(match[1]);
  }
  return null;
}

// `dem-*` graders are `tool_used` with `min: 0`: they always pass and carry the observed count in
// their explanation ("Read called 7x ..."), so a median of that count is the tool-call figure.
function toolCount(run, name) {
  const grader = (run.graders || []).find((g) => g.name === name);
  const match = /called (\d+)x/.exec(grader?.explanation || "");
  return match ? Number(match[1]) : null;
}

function median(values) {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const loaded = [];
// The same directory passed twice must not double every denominator this summary reports.
// Deduplicate on the resolved path but print the argument as given, so a summary quoted into a
// committed Receipt carries a repository-relative path instead of someone's home directory.
for (const [directory, shown] of new Map(directories.map((value) => [resolve(value), value]))) {
  const file = join(directory, "result.json");
  let report;
  try {
    report = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    console.error(`skipped ${shown}: ${error.message}`);
    continue;
  }
  if (report.partial) {
    console.error(`skipped ${shown}: partial run (${report.partialReason || "reason not recorded"})`);
    continue;
  }
  loaded.push({ directory: shown, report });
}
if (loaded.length === 0) {
  console.error("no complete result.json to summarize");
  process.exit(1);
}

const totals = new Map();
for (const { directory, report } of loaded) {
  const model = report.suite?.modelOverride || "(default model)";
  const judge = report.suite?.judgeModel || "(default judge)";
  console.log(`\n${directory}  model=${model}  judge=${judge}  ablation=${report.suite?.ablation}  started=${report.startedAt}  cost=$${(report.costUsd ?? 0).toFixed(2)}`);
  for (const caseEntry of report.cases || []) {
    for (const [arm, runs] of armRuns(caseEntry)) {
      const calls = runs.map((run) => skillCalls(run));
      const invoked = calls.filter((value) => value !== null && value > 0).length;
      // Two different gaps, never merged: a run with no skill grader at all, and a run whose
      // skill grader ran but whose explanation this parser could not read.
      const noGrader = runs.filter((run) => !(run.graders || []).some((g) => SKILL_GRADERS.has(g.name))).length;
      const unreadable = calls.filter((value) => value === null).length - noGrader;
      const graderNames = [...new Set(runs.flatMap((run) => (run.graders || []).map((g) => g.name)))];
      const passes = graderNames
        .map((name) => `${name} ${runs.filter((run) => (run.graders || []).some((g) => g.name === name && g.passed)).length}/${runs.length}`)
        .join("  ");
      const key = `${caseEntry.name}|${arm}`;
      const row = totals.get(key) || { runs: 0, invoked: 0, graders: new Map() };
      row.runs += runs.length;
      row.invoked += invoked;
      for (const name of graderNames) {
        const hit = runs.filter((run) => (run.graders || []).some((g) => g.name === name && g.passed)).length;
        const prior = row.graders.get(name) || { pass: 0, of: 0 };
        row.graders.set(name, { pass: prior.pass + hit, of: prior.of + runs.length });
      }
      totals.set(key, row);
      const gaps = [
        noGrader ? `${noGrader} run(s) with no skill grader` : "",
        unreadable > 0 ? `${unreadable} run(s) whose skill grader explanation was not parsed` : "",
      ].filter(Boolean).join(", ");
      row.gaps = (row.gaps || 0) + noGrader + Math.max(unreadable, 0);
      console.log(`  ${caseEntry.name} [${arm}]  runs ${runs.length}  Skill invoked ${invoked}/${runs.length}${gaps ? ` (${gaps})` : ""}  ${passes}`);
      // Added, indented lines only; every line printed before stays byte-identical.
      const counters = graderNames.filter((name) => name.startsWith("dem-"));
      if (counters.length) {
        console.log(`    median tool calls over all runs: ${counters.map((name) => `${name} ${median(runs.map((run) => toolCount(run, name))) ?? "n/a"}`).join("  ")}`);
      }
      if (calls.some((value) => value !== null)) {
        const invokedRuns = runs.filter((_, index) => calls[index] > 0);
        const onlyInvoked = graderNames
          .map((name) => `${name} ${invokedRuns.filter((run) => (run.graders || []).some((g) => g.name === name && g.passed)).length}/${invokedRuns.length}`)
          .join("  ");
        console.log(`    over the ${invokedRuns.length} run(s) that invoked the skill: ${onlyInvoked}`);
        if (counters.length && invokedRuns.length) {
          console.log(`    median tool calls over those runs: ${counters.map((name) => `${name} ${median(invokedRuns.map((run) => toolCount(run, name))) ?? "n/a"}`).join("  ")}`);
        }
      }
    }
  }
}

if (loaded.length > 1) {
  console.log(`\nAGGREGATE over ${loaded.length} directories`);
  for (const [key, row] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    const [name, arm] = key.split("|");
    const graders = [...row.graders].map(([g, v]) => `${g} ${v.pass}/${v.of}`).join("  ");
    console.log(`  ${name} [${arm}]  runs ${row.runs}  Skill invoked ${row.invoked}/${row.runs}${row.gaps ? ` (${row.gaps} run(s) with an unread skill count)` : ""}  ${graders}`);
  }
}
