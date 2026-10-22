#!/usr/bin/env node
// So hai lượt đo "trước" và "sau" của một ca hồi quy brainstorm (gói brainstorm-heuristics-repair, plan D-02/D-03):
// với các grader đã chọn của ca đó, in số lượt đạt hai bên và báo hồi quy khi một grader giảm từ 3 lượt đạt trở lên.
// Thoát 1 khi có hồi quy, hoặc khi một bên không so được: partial, có lượt mang error hay bị bỏ grader trả phí
// (skippedPaidGraders), không đủ 10 lượt, thiếu grader, hai bên khác claudeVersion. Thoát 2 khi ca không nằm trong
// danh sách, thiếu hay hỏng result.json, hoặc sai tham số.
//   node evals/brainstorm/hai-huong/regress.mjs <before dir> <after dir>
//   node evals/brainstorm/hai-huong/regress.mjs --self-test
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GRADERS = {
  "mot-duong-agent": ["khong-bu-nhin", "mot-duong", "do-dai-gon"],
  "ne-cau-hoi": ["do-dai-gon", "co-khuyen-nghi", "khong-hoi-lai"],
};
const EXPECTED_RUNS = 10, DROP = 3;

// Trả về { lines, problems, code }; code 2 cho tham số hỏng, 1 cho hồi quy hay kết quả bẩn, 0 khi sạch.
export function compare(beforeDir, afterDir) {
  const read = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  let before, after;
  try { before = read(beforeDir); after = read(afterDir); } catch (e) { return { lines: [`cannot read result.json: ${e.message}`], problems: 1, code: 2 }; }
  const name = before.cases?.[0]?.name;
  if (!GRADERS[name] || after.cases?.[0]?.name !== name) return { lines: [`unknown or mismatched case: ${name} / ${after.cases?.[0]?.name}`], problems: 1, code: 2 };
  const lines = [], problems = [];
  if (before.claudeVersion !== after.claudeVersion) problems.push(`claudeVersion differs: ${before.claudeVersion} vs ${after.claudeVersion}`);
  const side = (label, r) => {
    const runs = r.cases[0].arms?.with || [];
    if (r.partial) problems.push(`${label}: partial`);
    if (runs.length !== EXPECTED_RUNS) problems.push(`${label}: ${runs.length} runs (need ${EXPECTED_RUNS})`);
    runs.forEach((run, i) => {
      if (run.error) problems.push(`${label}: run=${i + 1} error`);
      if (run.skippedPaidGraders) problems.push(`${label}: run=${i + 1} skipped paid graders`);
    });
    return runs;
  };
  const b = side("before", before), a = side("after", after);
  const count = (runs, g) => runs.filter((run) => (run.graders || []).find((x) => x.name === g)?.passed === true).length;
  const has = (runs, g) => runs.length > 0 && runs.every((run) => (run.graders || []).some((x) => x.name === g));
  for (const g of GRADERS[name]) {
    if (!has(b, g) || !has(a, g)) { problems.push(`${g}: missing on one side`); continue; }
    const nb = count(b, g), na = count(a, g);
    const regressed = nb - na >= DROP;
    lines.push(`${name} ${g} before=${nb}/${b.length} after=${na}/${a.length}${regressed ? " REGRESSED" : ""}`);
    if (regressed) problems.push(`${g}: dropped ${nb - na}`);
  }
  for (const p of problems) lines.push(`problem: ${p}`);
  return { lines, problems: problems.length, code: problems.length ? 1 : 0 };
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "regress-"));
  const make = (dir, { passes, version = "1.0.0", partial = false, error = false, skipped = false, runs = EXPECTED_RUNS, drop = null, name = "mot-duong-agent" }) => {
    const d = path.join(tmp, dir); fs.mkdirSync(d);
    const graders = (i) => GRADERS["mot-duong-agent"].filter((g) => g !== drop).map((g) => ({ name: g, passed: i < (passes[g] ?? EXPECTED_RUNS) }));
    const withRuns = Array.from({ length: runs }, (_, i) => ({ graders: graders(i), error: error && i === 0 ? "boom" : null, skippedPaidGraders: skipped && i === 0 }));
    fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ claudeVersion: version, partial, cases: [{ name, arms: { with: withRuns } }] }));
    return d;
  };
  const base = make("base", { passes: { "khong-bu-nhin": 9 } });
  const cases = [
    ["drop 2 passes", make("drop2", { passes: { "khong-bu-nhin": 7 } }), 0],
    ["drop 3 fails", make("drop3", { passes: { "khong-bu-nhin": 6 } }), 1],
    ["partial fails", make("partial", { passes: {}, partial: true }), 1],
    ["error fails", make("error", { passes: {}, error: true }), 1],
    ["version mismatch fails", make("version", { passes: {}, version: "2.0.0" }), 1],
    ["9 runs fails", make("nine", { passes: {}, runs: 9 }), 1],
    ["skipped paid graders fails", make("skipped", { passes: {}, skipped: true }), 1],
    ["missing grader fails", make("missing", { passes: {}, drop: "mot-duong" }), 1],
    ["unknown case exits 2", make("unknown", { passes: {}, name: "khac" }), 2],
    ["missing result.json exits 2", path.join(tmp, "none"), 2],
  ];
  let failed = 0;
  for (const [label, dir, want] of cases) {
    const { code } = compare(base, dir);
    const ok = code === want;
    if (!ok) failed++;
    console.log(`${ok ? "ok" : "FAIL"}: ${label} → exit ${code}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") selfTest();
else {
  if (args.length !== 2) { console.error("usage: node evals/brainstorm/hai-huong/regress.mjs <before dir> <after dir> | --self-test"); process.exit(2); }
  const { lines, code } = compare(args[0], args[1]);
  for (const l of lines) console.log(l);
  process.exit(code);
}
