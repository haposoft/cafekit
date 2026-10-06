#!/usr/bin/env node
// So số sau sửa (sau-<ô>) với số gốc đã chấm lại (base-<ô>) của evals/brainstorm, không kết luận (gói brainstorm-repair
// task 01, plan D-06). Đọc hai phía từ evals/results/brainstorm/_regraded/ (regrade.mjs viết), chỉ trên lượt sạch. In:
//   cell=<ô> grader=<g> set=<primary|watch> base=<x>/<n> after=<y>/<m> p=<p>     (mọi thước không bắt đầu bằng dem-;
//        p là Fisher exact hai phía như evals/compare-research.mjs:32-46, toPrecision(4))
//   cell=<ô> reports base=<k>/<n> after=<k>/<m>   và   cell=<ô> r.<g> base=<x>/<k> after=<y>/<k'> p=<p>   (đường agent)
//   cell=<ô> agent-route base=<x>/<n> after=<y>/<m> p=<p>                            (đường agent)
//   cell=<ô> loaded grader=<g> base=<x>/<k> after=<y>/<k'> p=<p>   (can-plan-sang-specs: thước chính trên lượt nạp skill)
//   cell=<ô> integrity partial=… runs=… …                          (ô sau, như read-traces.mjs --integrity)
// rồi claude-versions=<n>. Thoát 1 khi thiếu file _regraded của một phía, sha256 thước trong file khác file thước hiện
// hành (chấm lại bằng thước cũ), hay integrity của các ô sau thất bại.
//   node evals/brainstorm/compare.mjs [--cells a,b] [--root <results root>]
//   node evals/brainstorm/compare.mjs --base-prefix sau- --after-prefix sau2- [--cells a,b]   (any two cell prefixes;
//        defaults base- and sau-; integrity runs on the after-prefix directories)
//   node evals/brainstorm/compare.mjs --base-only      (so số gốc đã chấm lại với chính nó: mọi p=1.000)
//   node evals/brainstorm/compare.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { PRIMARY } from "./read-traces.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const CASES = ["duyet-khong-trien-khai", "can-plan-sang-specs", "ne-cau-hoi", "mot-duong-agent"];
const CELLS = CASES.flatMap((c) => ["sonnet", "opus"].map((m) => `${c}-${m}`));

const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
export function fisher(x, n, y, m) {
  const a = x, b = n - x, c = y, d = m - y, row1 = a + b, row2 = c + d, col1 = a + c;
  const observed = hyper(a, b, c, d);
  let p = 0;
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) {
    const q = hyper(k, row1 - k, col1 - k, row2 - col1 + k);
    if (q <= observed * (1 + 1e-7)) p += q;
  }
  return Math.min(1, p);
}
const fmt = (p) => p.toPrecision(4);
const count = (v) => v.filter(Boolean).length;
const caseOf = (cell) => cell.slice(0, cell.lastIndexOf("-"));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function load(file, cases, say) {
  if (!fs.existsSync(file)) { say(`missing ${file}`); return null; }
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const files = fs.readdirSync(path.join(cases, j.case, "graders")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort().join();
  if (Object.keys(j.graders).sort().join() !== files) { say(`stale ${file}: its grader set differs from the current graders`); return null; }
  for (const [g, v] of Object.entries(j.graders)) {
    const f = path.join(cases, j.case, "graders", `${g}.md`);
    if (!fs.existsSync(f) || sha(f) !== v.sha256) { say(`stale ${file}: grader ${g} differs from the current file`); return null; }
  }
  return j;
}

export function compare({ root = path.join(here, "..", "results"), cases = here, cells = CELLS, baseOnly = false, integrity = true, basePrefix = "base-", afterPrefix = "sau-" } = {}) {
  const lines = [];
  let bad = 0;
  const say = (l) => { lines.push(l); };
  const res = path.join(root, "brainstorm");
  const pair = (label, bx, bn, ax, an) => `${label} base=${bx}/${bn} after=${ax}/${an} p=${fmt(fisher(bx, bn, ax, an))}`;
  for (const cell of cells) {
    const kase = caseOf(cell);
    const b = load(path.join(res, "_regraded", `${basePrefix}${cell}.json`), cases, say);
    const a = baseOnly ? b : load(path.join(res, "_regraded", `${afterPrefix}${cell}.json`), cases, say);
    if (!b || !a) { bad++; continue; }
    const primary = PRIMARY[kase] || [];
    const names = [...primary, ...Object.keys(b.graders).filter((g) => !g.startsWith("dem-") && !primary.includes(g)).sort()];
    for (const g of names) {
      if (!b.graders[g] || !a.graders[g]) { say(`cell=${cell} grader=${g} missing on one side`); bad++; continue; }
      const bv = b.graders[g].regraded, av = a.graders[g].regraded;
      say(`cell=${cell} grader=${g} set=${primary.includes(g) ? "primary" : "watch"} ${pair("", count(bv), bv.length, count(av), av.length).trim()}`);
    }
    if (b.reports && a.reports) {
      say(`cell=${cell} reports base=${b.reports.runs.length}/${b.clean.length} after=${a.reports.runs.length}/${a.clean.length}`);
      for (const g of Object.keys(b.reports.graders).sort()) {
        const bv = b.reports.graders[g], av = a.reports.graders[g] || [];
        say(`cell=${cell} ${pair(`r.${g}`, count(bv), bv.length, count(av), av.length)}`);
      }
    }
    if (b.agentRoute && a.agentRoute) say(`cell=${cell} ${pair("agent-route", count(b.agentRoute), b.agentRoute.length, count(a.agentRoute), a.agentRoute.length)}`);
    if (kase === "can-plan-sang-specs" && b.skillLoaded && a.skillLoaded) {
      for (const g of primary) {
        const sel = (j) => j.graders[g].regraded.filter((_, i) => j.skillLoaded[i] !== "none");
        const bv = sel(b), av = sel(a);
        say(`cell=${cell} loaded ${pair(`grader=${g}`, count(bv), bv.length, count(av), av.length)}`);
      }
    }
  }
  if (!baseOnly && integrity) {
    const dirs = cells.map((c) => path.join(res, `${afterPrefix}${c}`));
    const r = spawnSync(process.execPath, [path.join(here, "read-traces.mjs"), "--integrity", ...dirs], { encoding: "utf8" });
    for (const l of r.stdout.trim().split("\n").filter(Boolean)) say(l.startsWith("claude-versions=") ? l : `integrity ${l}`);
    if (r.status !== 0) bad++;
  }
  return { lines, bad };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brainstorm-compare-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: compare self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  try {
    check("Fisher: 0/10 against 10/10 → p=0.00001083", fmt(fisher(0, 10, 10, 10)) === "0.00001083", fmt(fisher(0, 10, 10, 10)));
    check("Fisher: equal counts → p=1.000", fmt(fisher(3, 10, 3, 10)) === "1.000");
    const cases = path.join(root, "cases", "syn-agent", "graders");
    fs.mkdirSync(cases, { recursive: true });
    fs.writeFileSync(path.join(cases, "mot-duong.md"), "---\ntype: regex\ntarget: last_message\n---\n\nx\n");
    const h = sha(path.join(cases, "mot-duong.md"));
    const dir = path.join(root, "results", "brainstorm", "_regraded");
    fs.mkdirSync(dir, { recursive: true });
    const j = (v, route, rep) => JSON.stringify({ agentRoute: route, case: "syn-agent", cell: "x", clean: v.map((_, i) => i + 1), graders: { "mot-duong": { regraded: v, sha256: h, stored: v, type: "regex" } }, reports: { graders: { "mot-duong": rep }, runs: rep.map((_, i) => i + 1) } });
    fs.writeFileSync(path.join(dir, "base-syn-agent-opus.json"), j(Array(10).fill(false), Array(10).fill(false), [true, false]));
    fs.writeFileSync(path.join(dir, "sau-syn-agent-opus.json"), j(Array(10).fill(true), Array(10).fill(true), [true, true, true]));
    let r = compare({ root: path.join(root, "results"), cases: path.join(root, "cases"), cells: ["syn-agent-opus"], integrity: false });
    const L = r.lines.join("\n");
    check("a grader pair prints counts and p", L.includes("cell=syn-agent-opus grader=mot-duong set=watch base=0/10 after=10/10 p=0.00001083"), L);
    check("report-side and agent-route pairs print", L.includes("cell=syn-agent-opus reports base=2/10 after=3/10") && L.includes("r.mot-duong base=1/2 after=3/3") && L.includes("agent-route base=0/10 after=10/10"), L);
    fs.writeFileSync(path.join(dir, "sau2-syn-agent-opus.json"), j(Array(10).fill(true), Array(10).fill(true), [true]));
    r = compare({ root: path.join(root, "results"), cases: path.join(root, "cases"), cells: ["syn-agent-opus"], integrity: false, basePrefix: "sau-", afterPrefix: "sau2-" });
    check("--base-prefix sau- --after-prefix sau2- pairs the two after sets", r.bad === 0 && r.lines.join("\n").includes("grader=mot-duong set=watch base=10/10 after=10/10 p=1.000") && r.lines.join("\n").includes("reports base=3/10 after=1/10"), r.lines.join("\n"));
    r = compare({ root: path.join(root, "results"), cases: path.join(root, "cases"), cells: ["syn-agent-opus"], baseOnly: true });
    check("--base-only prints p=1.000", r.bad === 0 && r.lines.join("\n").includes("base=0/10 after=0/10 p=1.000"), r.lines.join("\n"));
    fs.writeFileSync(path.join(cases, "mot-duong.md"), "---\ntype: regex\ntarget: last_message\n---\n\ny\n");
    r = compare({ root: path.join(root, "results"), cases: path.join(root, "cases"), cells: ["syn-agent-opus"], integrity: false });
    check("a regrade made with another grader is refused as stale", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    r = compare({ root: path.join(root, "results"), cases: path.join(root, "cases"), cells: ["missing-opus"], integrity: false });
    check("a missing cell is refused", r.bad === 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  const opt = { baseOnly: args.includes("--base-only") };
  const bp = args.indexOf("--base-prefix"); if (bp >= 0) opt.basePrefix = args[bp + 1];
  const ap = args.indexOf("--after-prefix"); if (ap >= 0) opt.afterPrefix = args[ap + 1];
  const c = args.indexOf("--cells"); if (c >= 0) opt.cells = args[c + 1].split(",");
  const r0 = args.indexOf("--root"); if (r0 >= 0) opt.root = args[r0 + 1];
  const r = compare(opt);
  for (const l of r.lines) console.log(l);
  process.exit(r.bad ? 1 : 0);
}
