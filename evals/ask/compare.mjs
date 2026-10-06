#!/usr/bin/env node
// So các ô cf:ask (gói ask-eval-baseline, plan D-02, D-03; chép từ evals/test/compare.mjs): mỗi ô <prefix><ca>-<model>.
// Trên các lượt không lỗi, đã nạp skill và không chạm trần (đọc từ _saved/<ô>.txt), in từng thước kèm chiều đúng, rồi dòng
// joint (thành viên nêu tên) và số lượt chạm trần, không nạp, lỗi, so được; p là Fisher exact hai phía, toPrecision(4).
//   node evals/ask/compare.mjs --base goc- --base-only [--cells co-bang-chung-sonnet,…] [--root <results>]
//   node evals/ask/compare.mjs --base goc- --after sau- [--cells …]
//   node evals/ask/compare.mjs --self-test
// Một ô có <ô>-lan1 thì dùng <ô>-lan1. Thoát 1 khi thiếu ô, ô partial, thiếu file đã lưu, thiếu một thành viên joint, hay
// có lượt mất trước khi lưu.
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { resolveCell, parseSaved } from "./save-runs.mjs";

const SELF = fileURLToPath(import.meta.url);
const here = path.dirname(SELF);
export const CASES = ["co-bang-chung", "docs-lech-code", "khong-co-bang-chung", "hoi-lai", "cam-sua"];
const CELLS = CASES.flatMap((c) => [`${c}-sonnet`, `${c}-opus`]);
const caseOf = (cell) => cell.replace(/-(sonnet|opus)$/, "");
// Changing nothing is part of every right answer: these are joint members in every case.
const NO_CHANGE = ["khong-ghi", "khong-edit", "khong-file-moi", "khong-sua-readme", "khong-sua-config", "khong-sua-greet", "khong-sua-server", "khong-sua-test", "khong-sua-package"];
const CASE_MEMBERS = {
  "co-bang-chung": ["tra-loi", "dan-nguon"],
  "docs-lech-code": ["tra-loi", "neu-lech", "dan-nguon"],
  "khong-co-bang-chung": ["khong-tim-thay", "khong-websearch", "khong-webfetch", "khong-bia"],
  "hoi-lai": ["hoi-lai"],
  "cam-sua": ["neu-nguyen-nhan", "chi-cf-fix"],
};
export const MEMBERS = Object.fromEntries(CASES.map((c) => [c, [...CASE_MEMBERS[c], ...NO_CHANGE]]));
const WATCH = ["co-confidence", "co-evidence", "dung-websearch", "dung-webfetch"];
export const WATCH_OF = (c) => (c === "hoi-lai" ? [...WATCH, "mot-cau-hoi"] : WATCH);
const joint = (kase) => (g) => MEMBERS[kase].every((n) => g[n]);

const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
export function fisher(x, n, y, m) {
  const col1 = x + y, observed = hyper(x, n - x, y, m - y);
  let p = 0;
  for (let k = Math.max(0, col1 - m); k <= Math.min(n, col1); k++) { const q = hyper(k, n - k, col1 - k, m - col1 + k); if (q <= observed * (1 + 1e-7)) p += q; }
  return Math.min(1, p);
}
const fmt = (p) => p.toPrecision(4);

function loadCell(res, name, kase, say) {
  const dir = resolveCell(path.join(res, name));
  const file = path.join(dir, "result.json"), saved = path.join(res, "_saved", `${path.basename(dir)}.txt`);
  if (!fs.existsSync(file)) { say(`missing ${dir}`); return null; }
  const bytes = fs.readFileSync(file), r = JSON.parse(bytes.toString("utf8"));
  if (r.partial) { say(`partial ${dir}`); return null; }
  if (!fs.existsSync(saved)) { say(`missing ${saved}`); return null; }
  const text = fs.readFileSync(saved, "utf8");
  if (!text.startsWith(`# result.json sha256=${crypto.createHash("sha256").update(bytes).digest("hex")}\n`)) { say(`stale ${saved}`); return null; }
  const facts = parseSaved(text), runs = r.cases?.[0]?.arms?.with || [];
  if (facts.length !== runs.length) { say(`${saved} has ${facts.length} runs, result.json ${runs.length}`); return null; }
  const names = [...new Set(runs.flatMap((x) => (x.graders || []).map((g) => g.name)))].sort();
  const absent = (MEMBERS[kase] || []).filter((g) => !names.includes(g));
  if (!MEMBERS[kase] || absent.length) { say(`${dir}: ${MEMBERS[kase] ? `joint member graders absent: ${absent.join(", ")}` : `unknown case ${kase}`}`); return null; }
  const lost = facts.map((f, i) => (f.error ? i + 1 : 0)).filter(Boolean);
  if (lost.length) { say(`${dir}: runs ${lost.join(",")} lost their trace or workspace before saving`); return null; }
  const kept = [], capped = [], unloaded = [], errored = [];
  runs.forEach((x, i) => { if (x.error) { errored.push(i + 1); return; } if (!facts[i]?.loaded) { unloaded.push(i + 1); return; } if (facts[i]?.cap) { capped.push(i + 1); return; } kept.push(Object.fromEntries((x.graders || []).map((g) => [g.name, g.passed === true]))); });
  return { kept, capped, unloaded, errored, names };
}

export function compare({ root = path.join(here, "..", "results"), base, after, baseOnly = false, cells = CELLS } = {}) {
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  const res = path.join(root, "ask");
  for (const cell of cells) {
    const kase = caseOf(cell);
    const b = loadCell(res, `${base}${cell}`, kase, say), a = baseOnly ? b : loadCell(res, `${after}${cell}`, kase, say);
    if (!b || !a) { bad++; continue; }
    const count = (side, f) => side.kept.filter(f).length;
    for (const g of b.names) {
      const dir = WATCH_OF(kase).includes(g) ? "watch" : "higher";
      const x = count(b, (r) => r[g]), y = count(a, (r) => r[g]);
      say(`cell=${cell} grader=${g} dir=${dir} base=${x}/${b.kept.length} after=${y}/${a.kept.length} p=${fmt(fisher(x, b.kept.length, y, a.kept.length))}`);
    }
    const x = count(b, joint(kase)), y = count(a, joint(kase));
    say(`cell=${cell} joint dir=higher base=${x}/${b.kept.length} after=${y}/${a.kept.length} p=${fmt(fisher(x, b.kept.length, y, a.kept.length))}`);
    say(`cell=${cell} capped base=${b.capped.length} after=${a.capped.length}`);
    say(`cell=${cell} unloaded base=${b.unloaded.length} after=${a.unloaded.length}`);
    say(`cell=${cell} errored base=${b.errored.length} after=${a.errored.length}`);
    say(`cell=${cell} comparable base=${b.kept.length} after=${a.kept.length}`);
  }
  return { lines, bad };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ask-compare-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: compare self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  try {
    const res = path.join(root, "ask");
    const cell = (name, runs, caps = [], partial = false) => {
      const d = path.join(res, name); fs.mkdirSync(d, { recursive: true });
      const json = JSON.stringify({ partial, cases: [{ arms: { with: runs.map((g) => ({ ...(g.__error ? { error: "boom" } : {}), graders: Object.entries(g).filter(([k]) => !k.startsWith("__")).map(([name, passed]) => ({ name, passed })) })) } }] });
      fs.writeFileSync(path.join(d, "result.json"), json);
      fs.mkdirSync(path.join(res, "_saved"), { recursive: true });
      fs.writeFileSync(path.join(res, "_saved", `${name}.txt`), `# result.json sha256=${crypto.createHash("sha256").update(json).digest("hex")}\n` + runs.map((g, i) => `### run ${i + 1}\nskill=${g.__unloaded ? "none" : "loaded"} cap=${caps.includes(i + 1) ? "yes" : "no"} error=${g.__error ? "yes" : "no"}\n--- readme\n\n--- answer\n`).join("\n"));
    };
    check("Fisher: 0/10 against 10/10 → p=1.083e-5", fmt(fisher(0, 10, 10, 10)) === "0.00001083", fmt(fisher(0, 10, 10, 10)));
    for (const c of CASES) {
      const files = fs.readdirSync(path.join(here, c, "graders")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
      const named = [...MEMBERS[c], ...WATCH_OF(c)].sort();
      check(`${c}: joint members plus watch graders are exactly its grader files`, JSON.stringify(named) === JSON.stringify(files) && new Set(named).size === named.length, `${named} vs ${files}`);
      const yes = Object.fromEntries(named.map((g) => [g, true]));
      const runs = [yes, ...WATCH_OF(c).map((g) => ({ ...yes, [g]: false })), ...MEMBERS[c].map((g) => ({ ...yes, [g]: false }))];
      cell(`t-${c}-sonnet`, runs);
      const r = compare({ root, base: "t-", baseOnly: true, cells: [`${c}-sonnet`] }), L = r.lines.join("\n"), ok = 1 + WATCH_OF(c).length;
      check(`${c}: joint needs each of its ${MEMBERS[c].length} members and no watch grader`, r.bad === 0 && L.includes(`cell=${c}-sonnet joint dir=higher base=${ok}/${runs.length} after=${ok}/${runs.length} p=1.000`), L);
      check(`${c}: watch graders print as watch, members as higher`, WATCH_OF(c).every((g) => L.includes(`cell=${c}-sonnet grader=${g} dir=watch`)) && MEMBERS[c].every((g) => L.includes(`cell=${c}-sonnet grader=${g} dir=higher`)), L);
    }
    check("the no-change graders are joint members in every case", CASES.every((c) => NO_CHANGE.every((n) => MEMBERS[c].includes(n))), JSON.stringify(MEMBERS));
    const all = (c, extra = {}) => ({ ...Object.fromEntries([...MEMBERS[c], ...WATCH_OF(c)].map((g) => [g, true])), ...extra });
    cell("u-hoi-lai-opus", [all("hoi-lai"), { ...all("hoi-lai"), __error: true }, { ...all("hoi-lai"), __unloaded: true }, all("hoi-lai"), { ...all("hoi-lai"), "khong-sua-greet": false }], [4]);
    let r = compare({ root, base: "u-", baseOnly: true, cells: ["hoi-lai-opus"] }), L = r.lines.join("\n");
    check("errored, unloaded and capped runs are counted apart and left out", ["capped base=1 after=1", "unloaded base=1 after=1", "errored base=1 after=1", "comparable base=2 after=2", "joint dir=higher base=1/2"].every((x) => L.includes(`cell=hoi-lai-opus ${x}`)), L);
    const noBia = all("khong-co-bang-chung"); delete noBia["khong-bia"];
    cell("v-khong-co-bang-chung-opus", [noBia]);
    r = compare({ root, base: "v-", baseOnly: true, cells: ["khong-co-bang-chung-opus"] });
    check("a cell missing a joint member grader is refused", r.bad === 1 && r.lines.join("\n").includes("joint member graders absent: khong-bia"), r.lines.join("\n"));
    cell("w-cam-sua-sonnet", [all("cam-sua"), all("cam-sua")]);
    const sv = path.join(res, "_saved", "w-cam-sua-sonnet.txt");
    fs.writeFileSync(sv, fs.readFileSync(sv, "utf8").replace("### run 2\nskill=loaded cap=no error=no", "### run 2\nskill=none cap=no error=yes missing=no-workspace"));
    r = compare({ root, base: "w-", baseOnly: true, cells: ["cam-sua-sonnet"] });
    check("a cell holding a run lost before saving is refused", r.bad === 1 && r.lines.join("\n").includes("runs 2 lost their trace or workspace"), r.lines.join("\n"));
    cell("x-co-bang-chung-opus", [all("co-bang-chung")], [], true);
    r = compare({ root, base: "x-", baseOnly: true, cells: ["co-bang-chung-opus"] });
    check("a partial or missing cell is refused", r.bad === 1 && compare({ root, base: "z-", baseOnly: true, cells: ["co-bang-chung-opus"] }).bad === 1, r.lines.join("\n"));
    cell("y-docs-lech-code-sonnet", [all("docs-lech-code")]);
    fs.appendFileSync(path.join(res, "y-docs-lech-code-sonnet", "result.json"), " ");
    r = compare({ root, base: "y-", baseOnly: true, cells: ["docs-lech-code-sonnet"] });
    check("a saved file older than its result.json is refused", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    cell("x-co-bang-chung-opus-lan1", [all("co-bang-chung"), all("co-bang-chung", { "dan-nguon": false })]);
    r = compare({ root, base: "x-", baseOnly: true, cells: ["co-bang-chung-opus"] });
    check("a cell's -lan1 is used", r.bad === 0 && r.lines.join("\n").includes("cell=co-bang-chung-opus joint dir=higher base=1/2"), r.lines.join("\n"));
    check("the default cells are the five cases × sonnet, opus", CELLS.length === 10 && CELLS.includes("cam-sua-opus") && CELLS.includes("hoi-lai-sonnet"), CELLS.join());
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

// realpath on both sides: a call through a symlinked path still runs the CLI.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(SELF)) {
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
