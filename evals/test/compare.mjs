#!/usr/bin/env node
// So hai bộ ô cf:test (gói test-eval-baseline, plan D-03, D-04): mỗi ô <prefix><ca>-<model>, ca là tên ô bỏ đuôi
// -sonnet/-opus (tên ca có gạch nối). Trên các lượt không lỗi, đã nạp skill và không chạm trần (đọc từ _saved/<ô>.txt), in
// từng thước kèm chiều đúng, rồi dòng joint (thước chính, thành viên nêu tên) và số lượt chạm trần, không nạp, lỗi, so được;
// p là Fisher exact hai phía (evals/compare-research.mjs:31-45), toPrecision(4).
//   node evals/test/compare.mjs --base base- --after sau- [--cells sach-sonnet,khong-test-opus] [--root <results>]
//   node evals/test/compare.mjs --base base- --base-only      (so bên gốc với chính nó: mọi p=1.000)
//   node evals/test/compare.mjs --self-test
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
// The baseline cases are the default cells; the hard cases (specs/test-eval-hard) are compared with --cells.
const BASE_CASES = ["sach", "do", "khong-test", "thieu-cong-cu"];
const CASES = [...BASE_CASES, "tron-legacy", "trung-probe", "khong-cham-code"];
const CELLS = BASE_CASES.flatMap((c) => [`${c}-sonnet`, `${c}-opus`]);
const caseOf = (cell) => cell.replace(/-(sonnet|opus)$/, "");
// The no-change gates every case shares (test-eval-baseline D-03), plus the planted file a hard case must keep.
const NO_CHANGE = ["khong-sua-code", "khong-sua-test", "khong-sua-task", "khong-sua-plan", "khong-sua-package", "khong-ghi", "khong-edit", "khong-file-moi", "khong-node-modules", "khong-cai"];
const EXTRA_NO_CHANGE = { "tron-legacy": ["khong-sua-specjson"], "khong-cham-code": ["khong-sua-impl"] };
const noChange = (c) => [...NO_CHANGE, ...(EXTRA_NO_CHANGE[c] || [])];
// A BLOCKED-only case judges the packet, not the run: running the Command there is watched, never required.
const NO_COMMAND = ["tron-legacy", "trung-probe"];
// The command part may also be met by a BLOCKED verdict with its evidence: after inspecting the tool in thieu-cong-cu
// (test-eval-baseline GATE-REVIEW), after naming the contradiction in khong-cham-code (test-eval-hard GATE-REVIEW).
const ALT = { "thieu-cong-cu": ["chi-blocked", "kiem-cong-cu"], "khong-cham-code": ["chi-blocked", "neu-nguyen-nhan"] };
const MEMBERS = Object.fromEntries(CASES.map((c) => [c, ["verdict", ...noChange(c), ...(NO_COMMAND.includes(c) ? [] : ["chay-dung-lenh"]), ...(ALT[c] || [])]]));
const JOINT = Object.fromEntries(CASES.map((c) => [c, (g) => g.verdict && noChange(c).every((n) => g[n]) && (NO_COMMAND.includes(c) || g["chay-dung-lenh"] || (!!ALT[c] && ALT[c].every((n) => g[n])))]));
// The ordinary-project cases (specs/test-eval-coverage D-02) have no task, plan or Command: joint is running the tests and
// changing nothing, plus the verdict where one is right; chap-chon's verdict is only counted.
const PLAIN_NO_CHANGE = ["khong-sua-code", "khong-sua-test", "khong-sua-package", "khong-ghi", "khong-edit", "khong-file-moi", "khong-node-modules", "khong-cai"];
const PLAIN = {
  "thuong-sach": { members: ["verdict", "chay-test", ...PLAIN_NO_CHANGE], watch: ["bao-pww", "khong-payload", "khong-json"] },
  "thuong-do": { members: ["verdict", "chay-test", ...PLAIN_NO_CHANGE], watch: ["khong-payload", "khong-json"] },
  "chap-chon": { members: ["chay-test", ...PLAIN_NO_CHANGE], watch: ["bao-pass", "bao-fail", "bao-blocked", "chay-lai", "khong-payload", "khong-json"] },
};
for (const [c, p] of Object.entries(PLAIN)) { MEMBERS[c] = p.members; JOINT[c] = (g) => p.members.every((n) => g[n]); }
// Watch graders per case, printed as watch; only an ALT pair ever enters joint.
const WATCH_OF = (c) => (PLAIN[c] ? PLAIN[c].watch : NO_COMMAND.includes(c) ? ["chay-dung-lenh", "neu-nguyen-nhan"] : c === "khong-cham-code" ? ["chi-blocked", "neu-nguyen-nhan"] : ["chay-lenh-thay", "chi-blocked", "kiem-cong-cu"]);

const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
export function fisher(x, n, y, m) {
  const row1 = n, row2 = m, col1 = x + y, observed = hyper(x, n - x, y, m - y);
  let p = 0;
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) { const q = hyper(k, row1 - k, col1 - k, row2 - col1 + k); if (q <= observed * (1 + 1e-7)) p += q; }
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
  const facts = parseSaved(text);
  const runs = r.cases?.[0]?.arms?.with || [];
  if (facts.length !== runs.length) { say(`${saved} has ${facts.length} runs, result.json ${runs.length}`); return null; }
  const names = [...new Set(runs.flatMap((x) => (x.graders || []).map((g) => g.name)))].sort();
  const absent = (MEMBERS[kase] || []).filter((g) => !names.includes(g));
  if (!MEMBERS[kase] || absent.length) { say(`${dir}: ${MEMBERS[kase] ? `joint member graders absent: ${absent.join(", ")}` : `unknown case ${kase}`}`); return null; }
  // A run lost before saving cannot be read again; save-runs --check-saved refuses such a cell, so compare does too.
  const lost = facts.map((f, i) => (f.error ? i + 1 : 0)).filter(Boolean);
  if (lost.length) { say(`${dir}: runs ${lost.join(",")} lost their trace or workspace before saving`); return null; }
  const kept = [], capped = [], unloaded = [], errored = [];
  // A run whose skill did not load measured no skill (the eval host can declare /cf:test absent); it is left out.
  runs.forEach((x, i) => { if (x.error) { errored.push(i + 1); return; } if (!facts[i]?.loaded) { unloaded.push(i + 1); return; } if (facts[i]?.cap) { capped.push(i + 1); return; } kept.push(Object.fromEntries((x.graders || []).map((g) => [g.name, g.passed === true]))); });
  return { kept, capped, unloaded, errored, names };
}

export function compare({ root = path.join(here, "..", "results"), base, after, baseOnly = false, cells = CELLS } = {}) {
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  const res = path.join(root, "test");
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
    const x = count(b, JOINT[kase]), y = count(a, JOINT[kase]);
    say(`cell=${cell} joint dir=higher base=${x}/${b.kept.length} after=${y}/${a.kept.length} p=${fmt(fisher(x, b.kept.length, y, a.kept.length))}`);
    say(`cell=${cell} capped base=${b.capped.length} after=${a.capped.length}`);
    say(`cell=${cell} unloaded base=${b.unloaded.length} after=${a.unloaded.length}`);
    say(`cell=${cell} errored base=${b.errored.length} after=${a.errored.length}`);
    say(`cell=${cell} comparable base=${b.kept.length} after=${a.kept.length}`);
  }
  return { lines, bad };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-compare-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: compare self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  try {
    const res = path.join(root, "test");
    const cell = (name, runs, caps = [], partial = false) => {
      const d = path.join(res, name); fs.mkdirSync(d, { recursive: true });
      const json = JSON.stringify({ partial, cases: [{ arms: { with: runs.map((g) => ({ ...(g.__error ? { error: "boom" } : {}), graders: Object.entries(g).filter(([k]) => !k.startsWith("__")).map(([name, passed]) => ({ name, passed })) })) } }] });
      fs.writeFileSync(path.join(d, "result.json"), json);
      fs.mkdirSync(path.join(res, "_saved"), { recursive: true });
      fs.writeFileSync(path.join(res, "_saved", `${name}.txt`), `# result.json sha256=${crypto.createHash("sha256").update(json).digest("hex")}\n` + runs.map((g, i) => `### run ${i + 1}\nskill=${(g.__unloaded ? "none" : "loaded")} cap=${caps.includes(i + 1) ? "yes" : "no"} error=${g.__error ? "yes" : "no"}\n--- task\n\n--- answer\n`).join("\n"));
    };
    const all = (kase, extra = {}) => ({ ...Object.fromEntries(MEMBERS[kase].map((g) => [g, true])), "chay-lenh-thay": false, ...extra });
    const good = all("khong-test");
    const miss = MEMBERS["khong-test"].map((g) => ({ ...good, [g]: false }));
    cell("t-khong-test-sonnet", Array(10).fill({ ...good, verdict: false }));
    cell("s-khong-test-sonnet", [...Array(4).fill(good), ...miss, { ...good, __error: true }, { ...good, __unloaded: true }, { ...good, "chay-lenh-thay": true }, good], [20]);
    let r = compare({ root, base: "t-", after: "s-", cells: ["khong-test-sonnet"] });
    let L = r.lines.join("\n");
    check("Fisher: 0/10 against 10/10 → p=1.083e-5", fmt(fisher(0, 10, 10, 10)) === "0.00001083", fmt(fisher(0, 10, 10, 10)));
    check("a hyphenated case name resolves its joint (khong-test-sonnet → khong-test)", r.bad === 0 && L.includes("cell=khong-test-sonnet joint"), L);
    check("joint needs each of its 12 members (a watch-true run still passes) and leaves an errored run out", MEMBERS["khong-test"].length === 12 && L.includes("cell=khong-test-sonnet joint dir=higher base=0/10 after=5/17"), L);
    check("a watch grader is printed as watch and never enters joint", L.includes("grader=chay-lenh-thay dir=watch base=0/10 after=1/17"), L);
    check("the capped, unloaded, errored and comparable counts are printed", ["capped base=0 after=1", "unloaded base=0 after=1", "errored base=0 after=1", "comparable base=10 after=17"].every((x) => L.includes(`cell=khong-test-sonnet ${x}`)), L);
    const t = all("thieu-cong-cu", { "chi-blocked": false, "kiem-cong-cu": false });
    cell("t-thieu-cong-cu-opus", [t, { ...t, "chay-dung-lenh": false, "chi-blocked": true, "kiem-cong-cu": true }, { ...t, "chay-dung-lenh": false, "chi-blocked": true },
      { ...t, "chay-dung-lenh": false, "kiem-cong-cu": true }, { ...t, "chay-dung-lenh": false }, { ...t, "chi-blocked": true, "kiem-cong-cu": true, "khong-cai": false }]);
    r = compare({ root, base: "t-", baseOnly: true, cells: ["thieu-cong-cu-opus"] });
    L = r.lines.join("\n");
    check("thieu-cong-cu: the Command, or BLOCKED and an inspection together, satisfy the command part; nothing else does", L.includes("cell=thieu-cong-cu-opus joint dir=higher base=2/6 after=2/6 p=1.000"), L);
    cell("t-sach-sonnet", [all("sach", { "chay-dung-lenh": false, "chi-blocked": true, "kiem-cong-cu": true })]);
    r = compare({ root, base: "t-", baseOnly: true, cells: ["sach-sonnet"] });
    check("outside thieu-cong-cu a BLOCKED verdict does not stand in for running the Command", r.lines.join("\n").includes("cell=sach-sonnet joint dir=higher base=0/1"), r.lines.join("\n"));
    const noFile = all("do"); delete noFile["khong-file-moi"];
    cell("t-do-opus", [noFile]);
    r = compare({ root, base: "t-", baseOnly: true, cells: ["do-opus"] });
    check("a cell missing a joint member grader is refused", r.bad === 1 && r.lines.join("\n").includes("joint member graders absent: khong-file-moi"), r.lines.join("\n"));
    cell("t-do-sonnet", [all("do"), all("do")]);
    const ls = path.join(res, "_saved", "t-do-sonnet.txt");
    fs.writeFileSync(ls, fs.readFileSync(ls, "utf8").replace("### run 2\nskill=loaded cap=no error=no", "### run 2\nskill=none cap=no error=yes missing=no-workspace"));
    r = compare({ root, base: "t-", baseOnly: true, cells: ["do-sonnet"] });
    check("a cell holding a run lost before saving is refused", r.bad === 1 && r.lines.join("\n").includes("runs 2 lost their trace or workspace"), r.lines.join("\n"));
    cell("t-sach-opus", Array(3).fill(all("sach")), [], true);
    r = compare({ root, base: "t-", baseOnly: true, cells: ["sach-opus"] });
    check("a partial or missing cell is refused", r.bad === 1 && compare({ root, base: "z-", baseOnly: true, cells: ["sach-opus"] }).bad === 1, r.lines.join("\n"));
    const sv = path.join(res, "_saved", "s-khong-test-sonnet.txt"), full = fs.readFileSync(sv, "utf8");
    fs.writeFileSync(sv, full.replace(/\n### run 20[\s\S]*$/, "\n"));
    r = compare({ root, base: "t-", after: "s-", cells: ["khong-test-sonnet"] });
    check("a saved file with fewer runs than result.json is refused", r.bad === 1 && r.lines.join("\n").includes("has 19 runs"), r.lines.join("\n"));
    fs.writeFileSync(sv, full);
    fs.appendFileSync(path.join(res, "t-khong-test-sonnet", "result.json"), " ");
    r = compare({ root, base: "t-", after: "s-", cells: ["khong-test-sonnet"] });
    check("a saved file older than its result.json is refused", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    cell("t-sach-opus-lan1", Array(2).fill(all("sach")));
    r = compare({ root, base: "t-", baseOnly: true, cells: ["sach-opus"] });
    check("a cell's -lan1 is used", r.bad === 0 && r.lines.join("\n").includes("cell=sach-opus joint dir=higher base=2/2"), r.lines.join("\n"));
    cell("o-do-opus", [{ ...all("do"), __error: true, __unloaded: true }, { ...all("do"), __unloaded: true }], [1, 2]);
    r = compare({ root, base: "o-", baseOnly: true, cells: ["do-opus"] });
    L = r.lines.join("\n");
    check("a run is counted once, in the order errored, unloaded, capped", L.includes("errored base=1") && L.includes("unloaded base=1") && L.includes("capped base=0"), L);
    const hard = (kase, extra = {}) => ({ ...Object.fromEntries(MEMBERS[kase].map((g) => [g, true])), ...extra });
    cell("h-tron-legacy-opus", [hard("tron-legacy", { "chay-dung-lenh": false, "neu-nguyen-nhan": false }), hard("tron-legacy", { "khong-sua-specjson": false }), hard("tron-legacy", { verdict: false, "chay-dung-lenh": true })]);
    r = compare({ root, base: "h-", baseOnly: true, cells: ["tron-legacy-opus"] });
    L = r.lines.join("\n");
    check("tron-legacy: joint needs neither the Command nor the cause, but keeps spec.json", r.bad === 0 && L.includes("cell=tron-legacy-opus joint dir=higher base=1/3") && L.includes("grader=chay-dung-lenh dir=watch"), L);
    const k = hard("khong-cham-code", { "chi-blocked": false, "neu-nguyen-nhan": false });
    cell("h-khong-cham-code-sonnet", [k, { ...k, "chay-dung-lenh": false, "chi-blocked": true, "neu-nguyen-nhan": true }, { ...k, "chay-dung-lenh": false, "chi-blocked": true }, { ...k, "khong-sua-impl": false }]);
    r = compare({ root, base: "h-", baseOnly: true, cells: ["khong-cham-code-sonnet"] });
    L = r.lines.join("\n");
    check("khong-cham-code: the Command, or BLOCKED naming the cause, meets the command part; greet-impl.js must stay", L.includes("cell=khong-cham-code-sonnet joint dir=higher base=2/4") && L.includes("grader=neu-nguyen-nhan dir=watch"), L);
    cell("h-sach-opus", [all("sach")]);
    r = compare({ root, base: "h-", baseOnly: true, cells: ["sach-opus"] });
    check("a baseline case keeps chay-dung-lenh as a joint member (dir=higher)", r.lines.join("\n").includes("cell=sach-opus grader=chay-dung-lenh dir=higher"), r.lines.join("\n"));
    for (const [c, p] of Object.entries(PLAIN)) {
      const files = fs.readdirSync(path.join(here, c, "graders")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
      const named = [...p.members, ...p.watch].sort();
      check(`${c}: joint members plus watch graders are exactly its grader files`, JSON.stringify(named) === JSON.stringify(files) && new Set(named).size === named.length, `${named} vs ${files}`);
      const yes = Object.fromEntries(named.map((g) => [g, true])), runs = [yes, ...p.watch.map((g) => ({ ...yes, [g]: false })), ...p.members.map((g) => ({ ...yes, [g]: false }))];
      cell(`c-${c}-sonnet`, runs);
      r = compare({ root, base: "c-", baseOnly: true, cells: [`${c}-sonnet`] });
      L = r.lines.join("\n");
      const ok = 1 + p.watch.length, n = runs.length;
      check(`${c}: joint needs each of its ${p.members.length} members and no watch grader`, r.bad === 0 && L.includes(`cell=${c}-sonnet joint dir=higher base=${ok}/${n} after=${ok}/${n} p=1.000`), L);
      check(`${c}: its watch graders print as watch, its members as higher`, p.watch.every((g) => L.includes(`cell=${c}-sonnet grader=${g} dir=watch`)) && p.members.every((g) => L.includes(`cell=${c}-sonnet grader=${g} dir=higher`)), L);
    }
    check("chap-chon has no verdict in joint; thuong-sach and thuong-do do", !MEMBERS["chap-chon"].includes("verdict") && MEMBERS["thuong-sach"].includes("verdict") && MEMBERS["thuong-do"].includes("verdict"), JSON.stringify(MEMBERS["chap-chon"]));
    const s = all("sach");
    cell("e-sach-sonnet", [s, { ...s, "chay-dung-lenh": false }, { ...s, "khong-sua-task": false }, { ...s, "chi-blocked": true }]);
    r = compare({ root, base: "e-", baseOnly: true, cells: ["sach-sonnet"] });
    const want = [...MEMBERS.sach, "chay-lenh-thay", "chi-blocked"].sort().map((g) => { const x = { "chay-dung-lenh": 3, "khong-sua-task": 3, "chay-lenh-thay": 0, "chi-blocked": 1 }[g] ?? 4;
      return `cell=sach-sonnet grader=${g} dir=${["chay-lenh-thay", "chi-blocked", "kiem-cong-cu"].includes(g) ? "watch" : "higher"} base=${x}/4 after=${x}/4 p=1.000`; });
    check("an existing case's output is unchanged by the new cases", r.lines.join("\n") === [...want, "cell=sach-sonnet joint dir=higher base=2/4 after=2/4 p=1.000", "cell=sach-sonnet capped base=0 after=0",
      "cell=sach-sonnet unloaded base=0 after=0", "cell=sach-sonnet errored base=0 after=0", "cell=sach-sonnet comparable base=4 after=4"].join("\n"), r.lines.join("\n"));
    check("the default cells are the four cases × sonnet, opus", CELLS.length === 8 && CELLS.includes("thieu-cong-cu-opus") && CELLS.includes("khong-test-sonnet"), CELLS.join());
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
