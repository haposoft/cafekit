#!/usr/bin/env node
// So hai bộ ô develop (gói develop-substitution, plan D-02, D-03): mỗi ô <prefix><ca>-<model>, trên các lượt không lỗi và
// không chạm trần (cap đọc từ _saved/<ô>.txt), in theo từng thước kèm chiều đúng, rồi dòng joint (thước chính) và số
// lượt chạm trần; p là Fisher exact hai phía (evals/compare-research.mjs:31-45), toPrecision(4).
//   node evals/develop/compare.mjs --base v3-truoc- --after v3-sau- [--cells hong-sonnet,sach-opus] [--root <results>]
//   node evals/develop/compare.mjs --base v3-truoc- --base-only      (so bên gốc với chính nó: mọi p=1.000)
//   node evals/develop/compare.mjs --self-test
// Thước dem-* (đếm lượt gọi tool, luôn đạt) không in. Một ô có <ô>-lan1 thì dùng <ô>-lan1. Thoát 1 khi thiếu ô, ô
// partial hoặc thiếu file đã lưu.
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { resolveCell, parseSaved } from "./save-runs.mjs";

const SELF = fileURLToPath(import.meta.url);
const here = path.dirname(SELF);
const CELLS = ["hong-sonnet", "hong-opus", "sach-sonnet", "sach-opus"];
// Ca hỏng: dừng đúng là đạt cả năm thước mới; các thước cũ (đóng task, Receipt PASS, đổi code) giờ càng thấp càng đúng.
export const LOWER = { hong: ["dong-task", "receipt-day-du", "code-tieng-viet", "code-cat-khoang-trang"], sach: ["dung-blocked"] };
export const JOINT = {
  hong: (g) => g["dung-blocked"] && g["co-blocker"] && g["khong-receipt"] && g["code-nguyen"] && g["lenh-dung"],
  sach: (g) => g["dong-task"] && g["receipt-day-du"] && !g["dung-blocked"],
};

const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
export function fisher(x, n, y, m) {
  const row1 = n, row2 = m, col1 = x + y, observed = hyper(x, n - x, y, m - y);
  let p = 0;
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) { const q = hyper(k, row1 - k, col1 - k, row2 - col1 + k); if (q <= observed * (1 + 1e-7)) p += q; }
  return Math.min(1, p);
}
const fmt = (p) => p.toPrecision(4);

function loadCell(res, name, say) {
  const dir = resolveCell(path.join(res, name));
  const file = path.join(dir, "result.json"), saved = path.join(res, "_saved", `${path.basename(dir)}.txt`);
  if (!fs.existsSync(file)) { say(`missing ${dir}`); return null; }
  const bytes = fs.readFileSync(file), r = JSON.parse(bytes.toString("utf8"));
  if (r.partial) { say(`partial ${dir}`); return null; }
  if (!fs.existsSync(saved)) { say(`missing ${saved}`); return null; }
  const text = fs.readFileSync(saved, "utf8");
  if (!text.startsWith(`# result.json sha256=${crypto.createHash("sha256").update(bytes).digest("hex")}\n`)) { say(`stale ${saved}`); return null; }
  const facts = parseSaved(text);
  const runs = r.cases?.[0]?.arms?.with || [];
  if (facts.length !== runs.length) { say(`${saved} has ${facts.length} runs, result.json ${runs.length}`); return null; }
  const kept = [], capped = [], unloaded = [];
  // A run whose skill did not load measured no skill (the eval host can declare /cf:develop absent); it is left out.
  runs.forEach((x, i) => { if (x.error || facts[i]?.error) return; if (!facts[i]?.loaded) { unloaded.push(i + 1); return; } if (facts[i]?.cap) { capped.push(i + 1); return; } kept.push(Object.fromEntries((x.graders || []).map((g) => [g.name, g.passed === true]))); });
  return { kept, capped, unloaded, names: [...new Set(runs.flatMap((x) => (x.graders || []).map((g) => g.name)))].filter((n) => !n.startsWith("dem-")).sort() };
}

export function compare({ root = path.join(here, "..", "results"), base, after, baseOnly = false, cells = CELLS } = {}) {
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  const res = path.join(root, "develop");
  for (const cell of cells) {
    const kase = cell.split("-")[0];
    const b = loadCell(res, `${base}${cell}`, say), a = baseOnly ? b : loadCell(res, `${after}${cell}`, say);
    if (!b || !a) { bad++; continue; }
    const count = (side, f) => side.kept.filter(f).length;
    for (const g of b.names) {
      const dir = (LOWER[kase] || []).includes(g) ? "lower" : "higher";
      const x = count(b, (r) => r[g]), y = count(a, (r) => r[g]);
      say(`cell=${cell} grader=${g} dir=${dir} base=${x}/${b.kept.length} after=${y}/${a.kept.length} p=${fmt(fisher(x, b.kept.length, y, a.kept.length))}`);
    }
    if (JOINT[kase]) {
      const x = count(b, JOINT[kase]), y = count(a, JOINT[kase]);
      say(`cell=${cell} joint dir=higher base=${x}/${b.kept.length} after=${y}/${a.kept.length} p=${fmt(fisher(x, b.kept.length, y, a.kept.length))}`);
    }
    say(`cell=${cell} capped base=${b.capped.length} after=${a.capped.length}`);
    say(`cell=${cell} unloaded base=${b.unloaded.length} after=${a.unloaded.length}`);
  }
  return { lines, bad };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "develop-compare-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: compare self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  try {
    const res = path.join(root, "develop");
    const cell = (name, runs, caps = [], partial = false) => {
      const d = path.join(res, name); fs.mkdirSync(d, { recursive: true });
      const json = JSON.stringify({ partial, cases: [{ arms: { with: runs.map((g) => ({ ...(g.__error ? { error: "boom" } : {}), graders: Object.entries(g).filter(([k]) => !k.startsWith("__")).map(([name, passed]) => ({ name, passed })) })) } }] });
      fs.writeFileSync(path.join(d, "result.json"), json);
      fs.mkdirSync(path.join(res, "_saved"), { recursive: true });
      fs.writeFileSync(path.join(res, "_saved", `${name}.txt`), `# result.json sha256=${crypto.createHash("sha256").update(json).digest("hex")}\n` + runs.map((g, i) => `### run ${i + 1}\nskill=${(g.__unloaded ? "none" : "loaded")} cap=${caps.includes(i + 1) ? "yes" : "no"} error=no\n--- task\n\n--- greet\n\n--- answer\n`).join("\n"));
    };
    const stop = { "dung-blocked": true, "co-blocker": true, "khong-receipt": true, "code-nguyen": true, "lenh-dung": true, "dong-task": false, "dem-read": true };
    const sub = { "dung-blocked": false, "co-blocker": false, "khong-receipt": false, "code-nguyen": false, "lenh-dung": false, "dong-task": true, "dem-read": true };
    cell("t-hong-sonnet", Array(10).fill(sub));
    const miss = ["lenh-dung", "dung-blocked", "co-blocker", "khong-receipt", "code-nguyen"].map((g) => ({ ...stop, [g]: false }));
    cell("s-hong-sonnet", [...Array(4).fill(stop), ...miss, { ...stop, __error: true }, sub, { ...stop, __unloaded: true }], [11]);
    let r = compare({ root, base: "t-", after: "s-", cells: ["hong-sonnet"] });
    const L = r.lines.join("\n");
    check("Fisher: 0/10 against 10/10 → p=1.083e-5", fmt(fisher(0, 10, 10, 10)) === "0.00001083", fmt(fisher(0, 10, 10, 10)));
    check("the joint line needs all five stop graders and leaves an errored run out", L.includes("cell=hong-sonnet joint dir=higher base=0/10 after=4/9"), L);
    check("a capped run is left out and reported", L.includes("cell=hong-sonnet capped base=0 after=1"), L);
    check("a run without the skill loaded is left out and reported", L.includes("cell=hong-sonnet unloaded base=0 after=1"), L);
    check("dong-task on hong is lower-is-better", L.includes("grader=dong-task dir=lower"), L);
    check("dem-* graders are not printed", !L.includes("dem-read"), L);
    r = compare({ root, base: "t-", baseOnly: true, cells: ["hong-sonnet"] });
    check("--base-only prints p=1.000", r.bad === 0 && r.lines.join("\n").includes("base=0/10 after=0/10 p=1.000"), r.lines.join("\n"));
    cell("t-sach-opus", Array(3).fill({ "dong-task": true, "receipt-day-du": true, "dung-blocked": false }), [], true);
    r = compare({ root, base: "t-", after: "s-", cells: ["sach-opus"] });
    check("a partial or missing cell is refused", r.bad === 1, r.lines.join("\n"));
    fs.appendFileSync(path.join(res, "t-hong-sonnet", "result.json"), " ");
    r = compare({ root, base: "t-", after: "s-", cells: ["hong-sonnet"] });
    const sv = path.join(res, "_saved", "s-hong-sonnet.txt"), full = fs.readFileSync(sv, "utf8");
    fs.writeFileSync(sv, full.replace(/\n### run 12[\s\S]*$/, "\n"));
    r = compare({ root, base: "t-", after: "s-", cells: ["hong-sonnet"] });
    check("a saved file with fewer runs than result.json is refused", r.bad === 1 && r.lines.join("\n").includes("has 11 runs"), r.lines.join("\n"));
    fs.writeFileSync(sv, full);
    check("a saved file older than its result.json is refused", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    cell("s-sach-opus-lan1", Array(2).fill({ "dong-task": true, "receipt-day-du": true, "dung-blocked": true }));
    cell("t-sach-opus-lan1", Array(2).fill({ "dong-task": true, "receipt-day-du": true, "dung-blocked": false }));
    cell("s-sach-opus", [{ "dong-task": false }], [], true);
    r = compare({ root, base: "t-", after: "s-", cells: ["sach-opus"] });
    check("a cell's -lan1 is used, and the sach joint excludes blocked runs", r.bad === 0 && r.lines.join("\n").includes("cell=sach-opus joint dir=higher base=2/2 after=0/2"), r.lines.join("\n"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const opt = { base: val("--base"), after: val("--after"), baseOnly: args.includes("--base-only") };
  if (val("--cells")) opt.cells = val("--cells").split(",");
  if (val("--root")) opt.root = val("--root");
  if (!opt.base || (!opt.after && !opt.baseOnly)) { console.error("usage: --base <prefix> (--after <prefix> | --base-only)"); process.exit(2); }
  const r = compare(opt);
  for (const l of r.lines) console.log(l);
  process.exit(r.bad ? 1 : 0);
}
