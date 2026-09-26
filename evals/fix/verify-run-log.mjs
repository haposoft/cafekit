#!/usr/bin/env node
// Đọc lại nhật ký test của từng lượt chạy trong thư mục được giữ lại (--keep-temp), tính lại các thước
// đọc nhật ký theo đúng mẫu trong evals/fix, và so với phán quyết đã lưu trong result.json.
// Mỗi lượt in một dòng: phán quyết tính lại và đã lưu, test-truoc-sua đã lưu, `split` khi do-truoc và
// test-truoc-sua lệch nhau, và các file test gốc không còn `require("./_runs")`. Thoát 1 chỉ khi một
// phán quyết đã lưu trái với nhật ký, hoặc không đọc được nhật ký của một lượt.
//   node evals/fix/verify-run-log.mjs <result dir>...
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dirs = process.argv.slice(2);
if (!dirs.length) { console.error("usage: node evals/fix/verify-run-log.mjs <result dir>..."); process.exit(2); }

const body = (file) => fs.readFileSync(file, "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return entry.isFile() ? [full] : [];
});
const stored = (run, name) => {
  const g = run.graders.find((x) => x.name === name);
  return g ? g.passed : "absent";
};

let disagreements = 0;
for (const dir of dirs) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const kase = result.cases[0];
  const graders = path.join(here, kase.name, "graders");
  const logGraders = ["do-truoc", "xanh-sau", "import-van-xanh"].filter((g) => fs.existsSync(path.join(graders, `${g}.md`)));
  const patterns = Object.fromEntries(logGraders.map((g) => [g, new RegExp(body(path.join(graders, `${g}.md`)))]));
  const originals = fs.readdirSync(path.join(here, "fixtures", kase.name, "test")).filter((f) => f.endsWith(".test.js")).sort();
  let split = 0, missing = 0, bad = 0;
  kase.arms.with.forEach((run, i) => {
    const label = `${dir} run=${i + 1}`;
    if (!run.tracePath) { console.log(`${label} no-trace error=${JSON.stringify(run.error || null)} (reported, not verified)`); return; }
    const kept = path.dirname(path.dirname(run.tracePath));
    if (!fs.existsSync(kept)) { console.log(`${label} kept-directory-missing ${kept}`); bad++; return; }
    spawnSync("chmod", ["-R", "u+rwX", kept]);
    const files = walk(kept);
    const logs = files.filter((f) => path.basename(f) === ".test-runs.log");
    if (logs.length > 1) { console.log(`${label} logs=${logs.length} (more than one .test-runs.log) agree=no`); bad++; return; }
    const log = logs.length ? fs.readFileSync(logs[0], "utf8") : "";
    // The workspace holds the log; without one, it is the directory holding the first original test file.
    const firstTest = files.find((f) => f.endsWith(`${path.sep}test${path.sep}${originals[0]}`) && !f.includes(`${path.sep}evals${path.sep}`));
    const ws = logs.length ? path.dirname(logs[0]) : firstTest ? path.dirname(path.dirname(firstTest)) : null;
    const requireMissing = ws
      ? originals.filter((t) => { const p = path.join(ws, "test", t); return !fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes('require("./_runs")'); })
      : ["workspace-not-found"];
    let agree = true;
    const parts = logGraders.map((g) => {
      const again = patterns[g].test(log), was = stored(run, g);
      if (again !== was) agree = false;
      return `${g}=${again}(stored ${was})`;
    });
    const order = stored(run, "test-truoc-sua");
    const isSplit = patterns["do-truoc"].test(log) !== order;
    if (isSplit) split++;
    if (requireMissing.length) missing++;
    if (!agree) bad++;
    console.log(`${label} log=${logs.length ? "found" : "no-log"} ${parts.join(" ")} test-truoc-sua=${order} split=${isSplit ? "yes" : "no"} require-missing=${requireMissing.length ? requireMissing.join(",") : "none"} agree=${agree ? "yes" : "no"}`);
  });
  console.log(`${dir} runs=${kase.arms.with.length} split=${split} require-missing=${missing} disagreements=${bad}`);
  disagreements += bad;
}
process.exit(disagreements ? 1 : 0);
