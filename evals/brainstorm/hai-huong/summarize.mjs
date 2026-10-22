#!/usr/bin/env node
// Tổng hợp một lượt đo của ca hai-huong: chỉ đếm lượt hợp lệ (đạt co-khuyen-nghi và cf:brainstorm thật sự được nạp),
// rồi cho biết mỗi heuristic đạt bao nhiêu lượt hợp lệ, tỉ lệ thiếu và số lần gọi AskUserQuestion.
// Nạp skill do evals/lean/loaded.mjs quyết định (gọi qua CLI vì import module đó chạy luôn phần CLI và thoát 2).
// Thoát 1 khi số lượt ≠ 10, có lượt no-trace/unreadable (hoặc loaded.mjs lỗi), hoặc số lượt hợp lệ k < 8.
//   node evals/brainstorm/hai-huong/summarize.mjs <out name> [<results dir>]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [out] = process.argv.slice(2);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const resultsDir = path.resolve(process.argv[3] || path.join(repo, "evals/results/brainstorm"), out || "");
if (!out) { console.error("usage: node evals/brainstorm/hai-huong/summarize.mjs <out name> [<results dir>]"); process.exit(2); }

const HEURISTICS = ["gia-dinh-diem-gay", "truong-hop-xau", "re-nhat-de-bo", "xet-huong-tot-hon"];
const EXPECTED_RUNS = 10, MIN_VALID = 8;

const runs = JSON.parse(fs.readFileSync(path.join(resultsDir, "result.json"), "utf8")).cases[0].arms.with;
const cli = spawnSync(process.execPath, [path.join(repo, "evals/lean/loaded.mjs"), "brainstorm", resultsDir], { encoding: "utf8" });
const loaded = new Map();
for (const m of (cli.stdout || "").matchAll(/ run=(\d+) loaded=(\S+)/g)) loaded.set(Number(m[1]), m[2]);

const grader = (run, name) => (run.graders || []).find((g) => g.name === name);
const passed = (run, name) => grader(run, name)?.passed === true;
const askCalls = (run) => Number(/called (\d+)x/.exec(grader(run, "dem-askuser")?.explanation || "")?.[1] ?? 0);

const valid = [], excluded = [];
let broken = cli.status !== 0;
runs.forEach((run, i) => {
  const state = loaded.get(i + 1) ?? "unreadable";
  if (state === "no-trace" || state === "unreadable") broken = true;
  if (run.error) { broken = true; excluded.push(`run=${i + 1} excluded: harness error`); return; }
  if (state !== "yes") excluded.push(`run=${i + 1} excluded: cf:brainstorm not loaded (${state})`);
  else if (!passed(run, "co-khuyen-nghi")) excluded.push(`run=${i + 1} excluded: no recommendation (co-khuyen-nghi failed)`);
  else valid.push(run);
});

const k = valid.length;
console.log(`runs=${runs.length} loaded=${[...loaded.values()].filter((v) => v === "yes").length} valid=${k}`);
for (const h of HEURISTICS) {
  const x = valid.filter((run) => passed(run, h)).length;
  console.log(`${h}=${x}/${k} missing=${k ? Math.round(((k - x) / k) * 100) : "n/a"}%`);
}
console.log(`askuser_calls=${runs.reduce((s, run) => s + askCalls(run), 0)}`);
for (const line of excluded) console.log(line);
if (cli.status !== 0) console.log(`loaded.mjs exited ${cli.status}`);

if (runs.length !== EXPECTED_RUNS || broken || k < MIN_VALID) {
  console.log(`insufficient: runs=${runs.length} (need ${EXPECTED_RUNS}), trace problems=${broken}, valid=${k} (need >=${MIN_VALID})`);
  process.exit(1);
}
