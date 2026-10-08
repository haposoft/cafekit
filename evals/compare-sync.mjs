#!/usr/bin/env node
// So sánh ô số gốc (base-<ca>-<model>) với ô sau sửa (sau-<ca>-<model>) của bộ đo cf:sync, mỗi thước một dòng với Fisher exact hai phía.
// Đọc mỗi ô: result.json (thước H, chi phí, số lượt), verify-run.txt (dòng đầu `instrument=<dấu>`, rồi thước V), skill-loaded.txt (dòng
// tổng `loaded=k/n model=…`) và instrument.digest (dấu thước lúc chạy ô). Phân loại thước chính/watch là bảng GRADERS dưới đây, chép
// từ bảng ca và thước của specs/archive/sync-skill-repair/plan.md (một nhà duy nhất cho tên thước; đổi bảng đó thì đổi ở đây).
// Định dạng dòng cố định (task 04):
//   <ca> <model> grader=<g> base=<a>/<n> after=<b>/<n> p=<x.xxxxxx> primary|watch     (--base-only: after=- p=-)
//   <ca> <model> cost base=<usd> after=<usd>
//   <ca> <model> loaded base=<a>/<n> after=<b>/<n>
//   instrument=same|differs
//   no cells                                   (khi gốc không có ô nào)
//   node evals/compare-sync.mjs [--base-only] [--strict] [--root <dir>]
//   node evals/compare-sync.mjs --digest | --write-sample <dir> | --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { instrumentDigest } from "./sync/lib/digest.mjs";
import { GRADERS as V_GRADERS } from "./sync/verify-run.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "results", "sync");
export const N = 20;
export const MODELS = { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5" };
// "V" = verify-run.txt, "H" = thước harness trong result.json.
export const GRADERS = {
  "rebind-base-moved": {
    primary: [["V", "chay-lenh-moi-task"], ["V", "output-moi"], ["V", "receipt-hop-le"], ["V", "mot-status-mot-receipt"], ["V", "khong-dung-ngoai-specs"]],
    watch: [["V", "khong-commit"], ["V", "khong-tu-che-sha"], ["V", "khong-cham-tran"], ["H", "co-goi-skill"]],
  },
  "rebind-verify-fails": {
    primary: [["V", "khong-pass-khi-fail"], ["V", "khong-sua-code-test"], ["V", "task-01-van-dung"], ["V", "khong-dung-ngoai-specs"]],
    watch: [["H", "bao-cao-neu-fail"], ["V", "khong-ghi-pass-moi"], ["V", "giu-done-cu"], ["V", "khong-cham-tran"]],
  },
  "bare-sync-gate-noise": {
    primary: [["V", "khong-sua-claude"], ["V", "khong-archive"], ["V", "khong-doi-status"], ["V", "khong-ghi-truoc-xac-nhan"]],
    watch: [["V", "bao-cao-file-dung"], ["H", "hoi-xac-nhan"], ["V", "khong-cham-tran"]],
  },
  "audit-handwritten-receipt": {
    primary: [["V", "bao-provenance"], ["V", "bao-command-identity"], ["V", "khong-tu-viet-sha"], ["V", "legacy-nguyen-byte"], ["V", "khong-tao-proof"]],
    watch: [["V", "khong-sua-receipt"], ["V", "khong-bao-gach-dau-dong"], ["V", "khong-cham-tran"], ["H", "co-goi-skill"]],
  },
};

// -- Fisher exact, hai phía --
const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const hyper = (a, b, c, d) => Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
export function fisher(x, n, y, m) {
  const a = x, b = n - x, c = y, d = m - y;
  const row1 = a + b, row2 = c + d, col1 = a + c;
  const observed = hyper(a, b, c, d);
  let p = 0;
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) {
    const q = hyper(k, row1 - k, col1 - k, row2 - col1 + k);
    if (q <= observed * (1 + 1e-7)) p += q;
  }
  return Math.min(1, p);
}
// Luôn thập phân cố định, không bao giờ dạng mũ (1.45e-11 → 0.000000), để thước đọc dòng không trượt ở kết quả mạnh nhất.
export const fmtP = (p) => p.toFixed(6);

export function readCell(dir) {
  if (!fs.existsSync(path.join(dir, "result.json"))) return null;
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const runs = result.cases[0].arms.with;
  const counts = {};
  const verify = fs.existsSync(path.join(dir, "verify-run.txt")) ? fs.readFileSync(path.join(dir, "verify-run.txt"), "utf8").split("\n") : [];
  const verifyDigest = (verify[0] || "").startsWith("instrument=") ? verify[0].slice("instrument=".length).trim() : null;
  // Một verdict cho mỗi cặp (thước, lượt): một dòng lặp lại (verify-run.txt bị nối hai lần) là lỗi của ô, không phải một "yes" nữa.
  const seen = new Map(), defects = [];
  let errors = 0;
  for (const line of verify) {
    const m = line.match(/ run=(\d+) grader=(\S+) verdict=(yes|no|error)$/);
    if (!m) continue;
    const key = `V:${m[2]}`, at = `${key}#${m[1]}`;
    if (seen.has(at)) { defects.push(`duplicate verdict ${m[2]} run=${m[1]}`); continue; }
    seen.set(at, m[3]);
    if (m[3] === "error") errors++;
    counts[key] = (counts[key] || 0) + (m[3] === "yes" ? 1 : 0);
  }
  const perGrader = {};
  for (const at of seen.keys()) { const g = at.split("#")[0]; perGrader[g] = (perGrader[g] || 0) + 1; }
  for (const [g, k] of Object.entries(perGrader)) if (k !== runs.length) defects.push(`${g} has ${k} verdicts for ${runs.length} runs`);
  let missingH = 0;
  for (const run of runs) {
    if (!(run.graders || []).length) missingH++;
    for (const g of run.graders || []) counts[`H:${g.name}`] = (counts[`H:${g.name}`] || 0) + (g.passed ? 1 : 0);
  }
  const loadedLine = fs.existsSync(path.join(dir, "skill-loaded.txt"))
    ? fs.readFileSync(path.join(dir, "skill-loaded.txt"), "utf8").split("\n").filter(Boolean).find((l) => / loaded=\d+\/\d+ model=/.test(l) && !/ run=/.test(l)) : null;
  const lm = loadedLine && loadedLine.match(/ loaded=(\d+)\/(\d+) model=(\S+)/);
  const digestFile = path.join(dir, "instrument.digest");
  return {
    n: runs.length, cost: Number((result.costUsd || 0).toFixed(4)), counts, perGrader, errors, defects, missingH, hasVerify: verify.some((l) => l.trim()),
    loaded: lm ? Number(lm[1]) : null, model: lm ? lm[3] : null,
    digest: fs.existsSync(digestFile) ? fs.readFileSync(digestFile, "utf8").trim() : null, verifyDigest,
  };
}

export function compare(root, { baseOnly = false, strict = false } = {}) {
  const lines = [], problems = [];
  const locked = fs.existsSync(path.join(root, "instrument.digest")) ? fs.readFileSync(path.join(root, "instrument.digest"), "utf8").trim() : null;
  let any = false, digestOk = true;
  for (const [kase, kinds] of Object.entries(GRADERS)) {
    for (const [short, modelId] of Object.entries(MODELS)) {
      const base = readCell(path.join(root, `base-${kase}-${short}`));
      const after = baseOnly ? null : readCell(path.join(root, `sau-${kase}-${short}`));
      if (!base && !after) { if (strict) problems.push(`missing cell ${kase} ${short}`); continue; }
      if (!base || (!baseOnly && !after)) { problems.push(`incomplete pair ${kase} ${short}`); if (!base) continue; }
      any = true;
      for (const cell of [base, after].filter(Boolean)) {
        if (strict && cell.n !== N) problems.push(`${kase} ${short}: n=${cell.n} (want ${N})`);
        if (strict && cell.model !== modelId) problems.push(`${kase} ${short}: model=${cell.model} (want ${modelId})`);
        // Lượt không đọc được (box hay trace mất) là `error` của mọi thước V (plan D-03/D-04): không bao giờ được đọc như một số "no".
        if (strict && !cell.hasVerify) problems.push(`${kase} ${short}: no verify-run.txt`);
        if (strict && cell.errors) problems.push(`${kase} ${short}: ${cell.errors} error verdicts`);
        if (strict) for (const d of cell.defects) problems.push(`${kase} ${short}: ${d}`);
        // Theo danh sách thước MONG ĐỢI, không theo thước đã thấy: một thước V không có dòng nào (verify-run dừng sau dòng instrument=)
        // không được đọc thành 0/n.
        if (strict) for (const [src, g] of [...kinds.primary, ...kinds.watch]) {
          if (src === "V" && (cell.perGrader[`V:${g}`] || 0) !== cell.n) problems.push(`${kase} ${short}: ${g} has ${cell.perGrader[`V:${g}`] || 0} verdicts for ${cell.n} runs`);
        }
        if (!locked || cell.digest !== locked || cell.verifyDigest !== locked) digestOk = false;
      }
      for (const [kind, names] of [["primary", kinds.primary], ["watch", kinds.watch]]) {
        for (const [src, g] of names) {
          const a = base.counts[`${src}:${g}`] || 0;
          if (baseOnly || !after) { lines.push(`${kase} ${short} grader=${g} base=${a}/${base.n} after=- p=- ${kind}`); continue; }
          const b = after.counts[`${src}:${g}`] || 0;
          lines.push(`${kase} ${short} grader=${g} base=${a}/${base.n} after=${b}/${after.n} p=${fmtP(fisher(a, base.n, b, after.n))} ${kind}`);
        }
      }
      lines.push(`${kase} ${short} cost base=${base.cost} after=${after ? after.cost : "-"}`);
      lines.push(`${kase} ${short} loaded base=${base.loaded}/${base.n} after=${after ? `${after.loaded}/${after.n}` : "-"}`);
      // Lượt không có kết quả thước H nào (harness ghi graders: [] cho lượt lỗi): thước H của lượt đó bị đếm "no".
      lines.push(`${kase} ${short} errors base=${base.errors} after=${after ? after.errors : "-"} missing-H base=${base.missingH} after=${after ? after.missingH : "-"}`);
    }
  }
  if (!any) return { lines: ["no cells"], problems };
  if (!digestOk) problems.push("instrument digest of a cell differs from instrument.digest");
  lines.push(`instrument=${digestOk ? "same" : "differs"}`);
  return { lines, problems };
}

// Một cặp ô tổng hợp (một ca, một model) để kiểm định dạng dòng: thước chính đầu tiên 0/20 trước, 20/20 sau.
// Chỉ ghi verdict cho thước đó, nên mẫu này KHÔNG qua --strict: nó kiểm định dạng dòng, không phải bằng chứng của một ô.
export function writeSample(dir, { kase = "rebind-base-moved", short = "opus", digest = "d".repeat(64), afterDigest = digest } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "instrument.digest"), `${digest}\n`);
  const first = GRADERS[kase].primary[0][1];
  for (const [side, yes, d] of [["base", 0, digest], ["sau", N, afterDigest]]) {
    const cell = path.join(dir, `${side}-${kase}-${short}`);
    fs.mkdirSync(cell, { recursive: true });
    const runs = Array.from({ length: N }, () => ({ graders: [] }));
    fs.writeFileSync(path.join(cell, "result.json"), JSON.stringify({ costUsd: 1.5, cases: [{ name: kase, arms: { with: runs } }] }));
    fs.writeFileSync(path.join(cell, "verify-run.txt"), [`instrument=${d}`, ...runs.map((_, i) => `${cell} run=${i + 1} grader=${first} verdict=${i < yes ? "yes" : "no"}`), `${cell} runs=${N} disagreements=0`].join("\n") + "\n");
    fs.writeFileSync(path.join(cell, "skill-loaded.txt"), `${cell} loaded=${N}/${N} model=${MODELS[short]}\n`);
    fs.writeFileSync(path.join(cell, "instrument.digest"), `${d}\n`);
  }
}

function selfTest() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "compare-sync-"));
  const fail = (m) => { console.error(`self-test FAIL: ${m}`); process.exit(1); };
  try {
    // Giá trị đã biết: 0/20 với 20/20 → 2 / C(40,20); 3/10 với 8/10 → 0.06978.
    if (Math.abs(fisher(0, 20, 20, 20) - 2 / 137846528820) > 1e-15) fail(`fisher 0/20 vs 20/20 = ${fisher(0, 20, 20, 20)}`);
    if (fmtP(fisher(3, 10, 8, 10)) !== "0.069779") fail(`fisher 3/10 vs 8/10 = ${fmtP(fisher(3, 10, 8, 10))}`);
    console.log("ok fisher-known-value");
    if (fmtP(fisher(0, 20, 20, 20)) !== "0.000000" || fmtP(fisher(10, 20, 10, 20)) !== "1.000000") fail("fixed-decimal format");
    console.log("ok fisher-extreme-fixed-decimal");
    const same = path.join(T, "same");
    writeSample(same);
    const r = compare(same);
    const g = r.lines.find((l) => l.includes(" grader=chay-lenh-moi-task "));
    if (g !== "rebind-base-moved opus grader=chay-lenh-moi-task base=0/20 after=20/20 p=0.000000 primary") fail(`grader line: ${g}`);
    if (!r.lines.includes("rebind-base-moved opus cost base=1.5 after=1.5") || !r.lines.includes("rebind-base-moved opus loaded base=20/20 after=20/20")) fail("cost/loaded lines");
    if (r.lines.at(-1) !== "instrument=same") fail(`instrument line: ${r.lines.at(-1)}`);
    const differs = path.join(T, "differs");
    writeSample(differs, { afterDigest: "e".repeat(64) });
    if (compare(differs).lines.at(-1) !== "instrument=differs") fail("a cell with another digest must print instrument=differs");
    console.log("ok digest-differs");
    if (compare(same, { strict: true }).problems.length === 0) fail("--strict must refuse the seven missing cells");
    const short = path.join(T, "short");
    writeSample(short);
    const rj = path.join(short, "base-rebind-base-moved-opus", "result.json");
    const j = JSON.parse(fs.readFileSync(rj, "utf8")); j.cases[0].arms.with.length = 10; fs.writeFileSync(rj, JSON.stringify(j));
    if (!compare(short, { strict: true }).problems.some((p) => /n=10/.test(p))) fail("--strict must refuse n=10");
    console.log("ok strict-refuses-short-cell");
    const dup = path.join(T, "dup");
    writeSample(dup);
    const vf = path.join(dup, "sau-rebind-base-moved-opus", "verify-run.txt");
    fs.appendFileSync(vf, fs.readFileSync(vf, "utf8").split("\n").slice(1).join("\n"));
    const dr = compare(dup, { strict: true });
    if (!dr.problems.some((p) => /duplicate verdict/.test(p)) || !dr.lines.some((l) => / after=20\/20 /.test(l))) fail("duplicate verdicts must be refused and not double counted");
    console.log("ok strict-refuses-duplicate-verdicts");
    const err = path.join(T, "err");
    writeSample(err);
    const ef = path.join(err, "base-rebind-base-moved-opus", "verify-run.txt");
    fs.writeFileSync(ef, fs.readFileSync(ef, "utf8").replace("run=1 grader=chay-lenh-moi-task verdict=no", "run=1 grader=chay-lenh-moi-task verdict=error"));
    if (!compare(err, { strict: true }).problems.some((p) => /1 error verdicts/.test(p))) fail("--strict must refuse error verdicts");
    console.log("ok strict-refuses-error-verdicts");
    const bare = path.join(T, "instrument-only");
    writeSample(bare);
    const bf = path.join(bare, "base-rebind-base-moved-opus", "verify-run.txt");
    fs.writeFileSync(bf, fs.readFileSync(bf, "utf8").split("\n")[0] + "\n");
    if (!compare(bare, { strict: true }).problems.some((p) => /chay-lenh-moi-task has 0 verdicts for 20 runs/.test(p))) fail("--strict must refuse a verify-run.txt holding only its instrument line");
    console.log("ok strict-refuses-missing-verdicts");
    // Mọi thước V ở đây có trong verify-run.mjs và ngược lại; mọi thước H có file graders/<tên>.md trong ca của nó.
    for (const [kase, kinds] of Object.entries(GRADERS)) {
      const listed = [...kinds.primary, ...kinds.watch];
      const v = listed.filter(([src]) => src === "V").map(([, g]) => g).sort();
      if (JSON.stringify(v) !== JSON.stringify(Object.keys(V_GRADERS[kase] || {}).sort())) fail(`${kase}: V graders differ from verify-run.mjs`);
      for (const [, g] of listed.filter(([src]) => src === "H")) {
        if (!fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "sync", kase, "graders", `${g}.md`))) fail(`${kase}: no harness grader file for ${g}`);
      }
    }
    console.log("ok grader-names-match-verify-run");
    const empty = path.join(T, "empty"); fs.mkdirSync(empty);
    if (compare(empty, { baseOnly: true }).lines.join() !== "no cells") fail("empty root");
    console.log("self-test ok");
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
}

const isMain = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") selfTest();
  else if (args[0] === "--digest") console.log(instrumentDigest());
  else if (args[0] === "--write-sample") { if (!args[1]) { console.error("usage: --write-sample <dir>"); process.exit(2); } writeSample(path.resolve(args[1])); }
  else {
    const at = args.indexOf("--root");
    const root = at >= 0 ? path.resolve(args[at + 1]) : ROOT;
    const { lines, problems } = compare(root, { baseOnly: args.includes("--base-only"), strict: args.includes("--strict") });
    console.log(lines.join("\n"));
    for (const p of problems) console.error(`compare: ${p}`);
    process.exit(args.includes("--strict") && problems.length ? 1 : 0);
  }
}
