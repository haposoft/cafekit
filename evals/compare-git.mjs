#!/usr/bin/env node
// So sánh từng ô của bộ ca git: gốc (`base-<ca>-opus`) với sau khi sửa (`sau-<ca>-opus`), đọc từ evals/results/git (hay --root).
// Mỗi ô: các grader của harness (result.json) cộng các thước trạng thái cuối (verify-run.txt); tên có ở cả hai nguồn chỉ tính `yes`
// khi cả hai là `yes`, lượt có thước V là `error` bị loại khỏi thước đó. In:
//   cell=<ca>-opus grader=<g> base=<x>/<n> after=<y>/<m> p=<p> <primary|watch>      (p: Fisher exact hai phía)
//   cell=<ca>-opus cost base=<x> after=<y> seconds base=<s> after=<t> errored base=<e>/<n> after=<f>/<m>
//   cell=<ca>-opus loaded base=<k>/<n> after=<j>/<m>                                 (từ skill-loaded.txt)
//   instrument=<same|changed|unlocked>     (so digest thước đo hiện tại với <root>/instrument.digest)
// Không có ô nào: in `no cells` và thoát 0 (thoát 1 khi có --strict).
//   node evals/compare-git.mjs [--base-only] [--strict] [--root <dir>]
//   node evals/compare-git.mjs --digest            in digest thước đo (D-08) của cây chứa script này
//   node evals/compare-git.mjs --self-test
// --base-only: ô gốc ở cả hai phía. --strict: thoát 1 khi một ô không nạp skill lần nào, mọi lượt lỗi, n dưới 5, n hai phía khác nhau,
// thiếu một ô, hai phía là cùng một kết quả, hay thước đo đã đổi so với lúc khoá.
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(here);
const DEFAULT_ROOT = path.join(here, "results", "git");

export const CASES = ["wt-plain-git-no-orca", "wt-cleanup-prune", "commit-secret-scan-portable", "wrong-checkout-guard"];
const MODEL = "opus";
// Thước chính của từng ca (bảng ca trong specs/archive/git-skill-repair/plan.md); các thước còn lại là `watch`.
export const PRIMARY = {
  "wt-plain-git-no-orca": ["base-dung", "thu-muc-anh-em", "hydrate-dung", "chi-git-rsync", "bao-cao-day-du"],
  "wt-cleanup-prune": ["dung-prune", "tu-choi-cay-ban", "tu-choi-cay-env", "branch-d-mac-dinh"],
  "commit-secret-scan-portable": ["quet-truoc", "dung-o-khoa", "khong-in-gia-tri", "khong-dung-vi-tokens", "khong-add-all", "khong-coauthor"],
  "wrong-checkout-guard": ["kiem-toplevel-truoc-stage", "khong-bashism", "push-dung-nhanh", "commit-dung-cho"],
};

// Thước đã chuyển từ grader harness sang V (đọc offline từ trace): giá trị `passed` cũ trong result.json bị bỏ qua, chỉ V được tính.
export const V_AUTHORITY = ["quet-truoc", "dung-prune", "khong-dung-vi-tokens"];

// ---- Fisher exact hai phía (cùng phép tính với evals/compare-code-review.mjs) ----
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
const fmtP = (p) => p.toFixed(6);
const round4 = (x) => Number(x.toFixed(4));

// ---- digest thước đo (D-08): sha256 của danh sách sha256 từng tệp, theo đường dẫn đã sắp ----
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return walk(full);
  return (e.isFile() || e.isSymbolicLink()) && e.name !== ".DS_Store" ? [full] : [];
});
// Mỗi dòng: sha256 nội dung, bit thực thi (x/-) và đường dẫn; một liên kết tượng trưng ghi `l:<đích>` thay cho nội dung.
export function instrumentDigest(root = repoRoot) {
  const files = [
    ...walk(path.join(root, "evals", "git")),
    ...["compare-git.mjs", "budget-git-sau.mjs"].map((f) => path.join(root, "evals", f)).filter((f) => fs.existsSync(f)),
  ].map((f) => path.relative(root, f).split(path.sep).join("/")).sort();
  const lines = files.map((rel) => {
    const full = path.join(root, rel);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) return `l:${fs.readlinkSync(full)}  - ${rel}`;
    return `${sha256(fs.readFileSync(full))}  ${st.mode & 0o111 ? "x" : "-"} ${rel}`;
  });
  return sha256(lines.join("\n") + "\n");
}

// ---- đọc một ô ----
function loadCell(root, name) {
  const dir = path.join(root, name);
  const file = path.join(dir, "result.json");
  if (!fs.existsSync(file)) return null;
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const all = result.cases[0].arms.with;
  const valid = all.map((run, i) => ({ run, idx: i + 1 })).filter((x) => !x.run.error && !x.run.skippedPaidGraders);
  const verify = new Map();
  const vf = path.join(dir, "verify-run.txt");
  if (fs.existsSync(vf)) {
    for (const line of fs.readFileSync(vf, "utf8").split("\n")) {
      const m = line.match(/ run=(\d+) grader=(\S+) verdict=(yes|no|error)$/);
      if (!m) continue;
      if (!verify.has(Number(m[1]))) verify.set(Number(m[1]), new Map());
      verify.get(Number(m[1])).set(m[2], m[3]);
    }
  }
  let loaded = null;
  const lf = path.join(dir, "skill-loaded.txt");
  if (fs.existsSync(lf)) {
    const m = fs.readFileSync(lf, "utf8").match(/^.* loaded=(\d+)\/(\d+)(?: |$)/m);
    if (m) loaded = { k: Number(m[1]), n: Number(m[2]) };
  }
  const cost = result.costUsd + all.reduce((s, r) => s + (r.judgeCostUsd || 0), 0);
  return { dir, name, result, all, valid, verify, loaded, cost };
}

function graderNames(cell) {
  const names = new Set();
  for (const { run } of cell.valid) for (const g of run.graders) if (!V_AUTHORITY.includes(g.name)) names.add(g.name);
  for (const per of cell.verify.values()) for (const g of per.keys()) names.add(g);
  return names;
}

// yes/n của một thước trên một ô: harness AND V; lượt có V = error bị loại.
function tally(cell, grader) {
  let yes = 0, n = 0;
  for (const { run, idx } of cell.valid) {
    const h = V_AUTHORITY.includes(grader) ? undefined : run.graders.find((g) => g.name === grader);
    const v = cell.verify.has(idx) ? cell.verify.get(idx).get(grader) : undefined;
    if (h === undefined && v === undefined) continue;
    if (v === "error") continue;
    n++;
    if ((h === undefined || h.passed) && (v === undefined || v === "yes")) yes++;
  }
  return { yes, n };
}

// ---- so sánh toàn bộ ----
export function compare(root, { baseOnly = false, strict = false } = {}) {
  const lines = [];
  const problems = [];
  let any = false;
  const digestFile = path.join(root, "instrument.digest");
  for (const kase of CASES) {
    const cell = `${kase}-${MODEL}`;
    const base = loadCell(root, `base-${cell}`);
    const after = baseOnly ? base : loadCell(root, `sau-${cell}`);
    if (base || after) any = true;
    if (!base && !after) { problems.push(`${cell}: no result on either side`); continue; }
    if (!base) problems.push(`${cell}: base cell missing`);
    if (!after && !baseOnly) problems.push(`${cell}: after cell missing`);
    const names = new Set([...(base ? graderNames(base) : []), ...(after ? graderNames(after) : [])]);
    for (const g of [...names].sort()) {
      const b = base ? tally(base, g) : null, a = after ? tally(after, g) : null;
      const kind = PRIMARY[kase].includes(g) ? "primary" : "watch";
      const p = b && a && b.n > 0 && a.n > 0 ? fmtP(fisher(b.yes, b.n, a.yes, a.n)) : "-";
      lines.push(`cell=${cell} grader=${g} base=${b ? `${b.yes}/${b.n}` : "-/-"} after=${a ? `${a.yes}/${a.n}` : "-/-"} p=${p} ${kind}`);
    }
    const errored = (c) => (c ? `${c.all.length - c.valid.length}/${c.all.length}` : "-/-");
    lines.push(`cell=${cell} cost base=${base ? round4(base.cost) : "-"} after=${after ? round4(after.cost) : "-"} seconds base=${base ? base.result.durationSeconds : "-"} after=${after ? after.result.durationSeconds : "-"} errored base=${errored(base)} after=${errored(after)}`);
    const ld = (c) => (c && c.loaded ? `${c.loaded.k}/${c.loaded.n}` : "-/-");
    lines.push(`cell=${cell} loaded base=${ld(base)} after=${ld(after)}`);
    for (const [side, c] of [["base", base], ["after", baseOnly ? null : after]]) {
      if (!c) continue;
      if (c.result.partial === true) problems.push(`${cell}: ${side} result is partial`);
      // nguồn V phải phủ mọi lượt hợp lệ, và mọi thước chính phải có mặt (ít nhất một lượt) ở mỗi phía
      for (const { idx } of c.valid) if (!c.verify.has(idx)) problems.push(`${cell}: ${side} verify-run.txt lacks run ${idx}`);
      for (const g of PRIMARY[kase]) if (tally(c, g).n === 0) problems.push(`${cell}: ${side} primary grader ${g} is absent`);
      if (!c.loaded || c.loaded.k === 0) problems.push(`${cell}: ${side} skill never loaded (or skill-loaded.txt missing)`);
      if (c.valid.length === 0) problems.push(`${cell}: ${side} every run errored`);
      if (c.all.length < 5) problems.push(`${cell}: ${side} has ${c.all.length} runs (minimum 5)`);
    }
    if (!baseOnly && base && after) {
      if (base.all.length !== after.all.length) problems.push(`${cell}: n differs (${base.all.length} vs ${after.all.length})`);
      if (fs.realpathSync(base.dir) === fs.realpathSync(after.dir) || (base.result.startedAt !== undefined && base.result.startedAt === after.result.startedAt && base.cost === after.cost)) problems.push(`${cell}: both sides are the same result`);
    }
  }
  if (!any) return { lines: ["no cells"], problems: ["no cells"], any };
  let instrument = "unlocked";
  if (fs.existsSync(digestFile)) instrument = fs.readFileSync(digestFile, "utf8").trim().split(/\s+/)[0] === instrumentDigest() ? "same" : "changed";
  lines.push(`instrument=${instrument}`);
  if (instrument !== "same") problems.push(`instrument is ${instrument}`);
  return { lines, problems, any };
}

// ---- tự kiểm ----
function selfTest() {
  const bad = [];
  const eq = (label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  eq("fisher 10/10 vs 0/10", fmtP(fisher(10, 10, 0, 10)), "0.000011");
  eq("fisher 5/10 vs 5/10", fmtP(fisher(5, 10, 5, 10)), "1.000000");
  eq("fisher 3/5 vs 0/5", fmtP(fisher(3, 5, 0, 5)), "0.166667");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "compare-git-"));
  const wipe = () => { for (const e of fs.readdirSync(T)) fs.rmSync(path.join(T, e), { recursive: true, force: true }); };
  // Một ô: n lượt, lượt cuối lỗi (trừ khi allError), các lượt trong skipped bị bỏ qua phần chấm trả tiền. Thước harness = thước chính
  // của ca (mọi lượt đạt, trừ `fail` = [thước, lượt] không đạt) + khong-push; V = thước chính của ca cho lượt 1..n-1, cộng `v-only`.
  const mk = (name, kase, { n = 6, cost = 1, startedAt = name, loaded = 6, partial = false, allError = false, skipped = [], harnessFail = [], verifyRows = null, noVerify = false, drop = [] } = {}) => {
    const dir = path.join(T, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const primaries = PRIMARY[kase].filter((g) => !drop.includes(g));
    const runs = [];
    for (let i = 1; i <= n; i++) runs.push({
      costUsd: cost / n, judgeCostUsd: 0.01, error: allError || i === n ? "boom" : null, skippedPaidGraders: skipped.includes(i),
      graders: [...primaries, "khong-push"].map((g) => ({ name: g, passed: !harnessFail.some(([hg, hi]) => hg === g && hi === i) })),
    });
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ costUsd: cost, durationSeconds: 60, startedAt, partial, cases: [{ name: kase, arms: { with: runs } }] }));
    if (!noVerify) {
      const rows = verifyRows || [];
      if (!verifyRows) for (let i = 1; i < n; i++) for (const g of [...primaries, "v-only"]) rows.push([i, g, "yes"]);
      fs.writeFileSync(path.join(dir, "verify-run.txt"), rows.map(([i, g, v]) => `${dir} run=${i} grader=${g} verdict=${v}`).join("\n") + "\n");
    }
    if (loaded !== null) fs.writeFileSync(path.join(dir, "skill-loaded.txt"), `${dir} loaded=${loaded}/${n} model=m\n`);
  };
  const lockInstrument = () => fs.writeFileSync(path.join(T, "instrument.digest"), instrumentDigest() + "\n");
  const clean = () => {
    wipe();
    for (const kase of CASES) { mk(`base-${kase}-${MODEL}`, kase); mk(`sau-${kase}-${MODEL}`, kase, { cost: 2 }); }
    lockInstrument();
  };
  const probs = (opts) => compare(T, opts).problems;
  const has = (needle, opts) => probs(opts).some((x) => x.includes(needle));
  try {
    eq("empty root", compare(T).lines, ["no cells"]);
    // digest thước đo: nhạy với nội dung, bit thực thi, tệp thêm/xoá/đổi tên và liên kết tượng trưng; không nhạy với .DS_Store
    const D = fs.mkdtempSync(path.join(os.tmpdir(), "digest-"));
    try {
      fs.mkdirSync(path.join(D, "evals", "git"), { recursive: true });
      const f = path.join(D, "evals", "git", "a.sh"); fs.writeFileSync(f, "echo a\n");
      const d0 = instrumentDigest(D);
      const changed = (label, act) => { act(); const d = instrumentDigest(D); eq(`digest changes: ${label}`, d !== changed.last, true); changed.last = d; };
      changed.last = d0;
      fs.writeFileSync(path.join(D, "evals", "git", ".DS_Store"), "x"); eq("digest ignores .DS_Store", instrumentDigest(D), d0);
      changed("the executable bit", () => fs.chmodSync(f, 0o755));
      changed("a byte of content", () => fs.writeFileSync(f, "echo b\n"));
      changed("a new file", () => fs.writeFileSync(path.join(D, "evals", "git", "b.sh"), "x\n"));
      changed("a rename", () => fs.renameSync(path.join(D, "evals", "git", "b.sh"), path.join(D, "evals", "git", "c.sh")));
      changed("a symlink", () => fs.symlinkSync("a.sh", path.join(D, "evals", "git", "link")));
      changed("a deleted file", () => fs.rmSync(path.join(D, "evals", "git", "c.sh")));
      changed("compare-git.mjs itself", () => fs.writeFileSync(path.join(D, "evals", "compare-git.mjs"), "// x\n"));
      changed("budget-git-sau.mjs itself", () => fs.writeFileSync(path.join(D, "evals", "budget-git-sau.mjs"), "// y\n"));
    } finally { fs.rmSync(D, { recursive: true, force: true }); }
    clean();
    eq("a clean fixture has no problem", probs(), []);
    const cl = CASES[1] + "-" + MODEL; // wt-cleanup-prune: dung-prune là thước chính, có ở cả harness và V
    // tu-choi-cay-ban gốc (có ở cả harness và V): lượt 1 yes; lượt 2 V=no; lượt 3 V=error (loại); lượt 4 yes; lượt 5 H=không đạt => n=4 yes=2.
    // dung-prune đã chuyển sang V (V_AUTHORITY): H không đạt ở lượt 4 bị BỎ QUA, cả 5 lượt V=yes => 5/5.
    const others = PRIMARY[CASES[1]].filter((g) => g !== "tu-choi-cay-ban");
    mk(`base-${cl}`, CASES[1], { harnessFail: [["tu-choi-cay-ban", 5], ["dung-prune", 4]], verifyRows: [[1, "tu-choi-cay-ban", "yes"], [2, "tu-choi-cay-ban", "no"], [3, "tu-choi-cay-ban", "error"], [4, "tu-choi-cay-ban", "yes"], [5, "tu-choi-cay-ban", "yes"], ...[1, 2, 3, 4, 5].flatMap((i) => [...others, "v-only"].map((g) => [i, g, "yes"]))] });
    let r = compare(T);
    const line = (l, needle) => l.find((x) => x.startsWith(needle));
    eq("AND-merge (H false, V=no, V=error excluded)", line(r.lines, `cell=${cl} grader=tu-choi-cay-ban `).replace(/ p=\S+/, ""), `cell=${cl} grader=tu-choi-cay-ban base=2/4 after=5/5 primary`);
    eq("a grader moved to V ignores the stored harness verdict", line(r.lines, `cell=${cl} grader=dung-prune `).replace(/ p=\S+/, ""), `cell=${cl} grader=dung-prune base=5/5 after=5/5 primary`);
    eq("a V-only grader is listed", line(r.lines, `cell=${cl} grader=v-only `).replace(/ p=\S+/, ""), `cell=${cl} grader=v-only base=5/5 after=5/5 watch`);
    eq("a watch grader", line(r.lines, `cell=${cl} grader=khong-push `).replace(/ p=\S+/, ""), `cell=${cl} grader=khong-push base=5/5 after=5/5 watch`);
    eq("cost line", line(r.lines, `cell=${cl} cost `), `cell=${cl} cost base=1.06 after=2.06 seconds base=60 after=60 errored base=1/6 after=1/6`);
    eq("loaded line", line(r.lines, `cell=${cl} loaded `), `cell=${cl} loaded base=6/6 after=6/6`);
    // một thước đã chuyển sang V mà V không có dòng nào cho nó thì không được hiện ra từ giá trị harness cũ
    mk(`base-${cl}`, CASES[1], { verifyRows: [1, 2, 3, 4, 5].flatMap((i) => [...PRIMARY[CASES[1]].filter((g) => g !== "dung-prune"), "v-only"].map((g) => [i, g, "yes"])) });
    eq("a V-authority grader with no V rows is not listed from the stored harness verdict", compare(T, { baseOnly: true }).lines.some((x) => x.startsWith(`cell=${cl} grader=dung-prune `)), false);
    mk(`base-${cl}`, CASES[1], { harnessFail: [["tu-choi-cay-ban", 5], ["dung-prune", 4]], verifyRows: [[1, "tu-choi-cay-ban", "yes"], [2, "tu-choi-cay-ban", "no"], [3, "tu-choi-cay-ban", "error"], [4, "tu-choi-cay-ban", "yes"], [5, "tu-choi-cay-ban", "yes"], ...[1, 2, 3, 4, 5].flatMap((i) => [...others, "v-only"].map((g) => [i, g, "yes"]))] });
    eq("same instrument line", r.lines.at(-1), "instrument=same");
    eq("--base-only reads the base cell on both sides", line(compare(T, { baseOnly: true }).lines, `cell=${cl} grader=tu-choi-cay-ban `).replace(/ p=\S+/, ""), `cell=${cl} grader=tu-choi-cay-ban base=2/4 after=2/4 primary`);
    // lượt bị bỏ qua phần chấm trả tiền là lượt lỗi (cùng lượt cuối lỗi): errored 2/6
    clean(); mk(`base-${CASES[2]}-${MODEL}`, CASES[2], { skipped: [2] });
    eq("skippedPaidGraders runs count as errored", line(compare(T).lines, `cell=${CASES[2]}-${MODEL} cost `).replace(/^.*errored /, ""), "base=2/6 after=1/6");
    // các điều kiện strict
    clean(); fs.writeFileSync(path.join(T, "instrument.digest"), "0".repeat(64) + "\n");
    eq("changed instrument line", compare(T).lines.at(-1), "instrument=changed"); eq("changed instrument is a problem", has("instrument is changed"), true);
    clean(); fs.rmSync(path.join(T, "instrument.digest")); eq("unlocked instrument is a problem", has("instrument is unlocked"), true);
    clean(); mk(`base-${cl}`, CASES[1], { loaded: 0 }); eq("loaded 0", has("skill never loaded"), true);
    clean(); mk(`base-${cl}`, CASES[1], { loaded: null }); eq("skill-loaded.txt missing", has("skill never loaded"), true);
    clean(); mk(`base-${cl}`, CASES[1], { allError: true }); eq("every run errored", has("every run errored"), true);
    clean(); mk(`base-${cl}`, CASES[1], { n: 4 }); eq("n below 5", has("minimum 5"), true);
    clean(); mk(`sau-${cl}`, CASES[1], { n: 7 }); eq("n differs", has("n differs"), true); eq("n differs is ignored under --base-only", has("n differs", { baseOnly: true }), false);
    clean(); fs.rmSync(path.join(T, `sau-${cl}`), { recursive: true }); eq("missing after cell", has("after cell missing"), true); eq("base-only ignores a missing after cell", has("after cell missing", { baseOnly: true }), false);
    clean(); fs.cpSync(path.join(T, `base-${cl}`), path.join(T, `sau-${cl}`), { recursive: true }); eq("the same result on both sides", has("same result"), true);
    clean(); mk(`base-${cl}`, CASES[1], { partial: true }); eq("partial result", has("is partial"), true);
    clean(); mk(`base-${cl}`, CASES[1], { noVerify: true }); eq("verify-run.txt missing", has("verify-run.txt lacks run"), true);
    clean(); mk(`base-${cl}`, CASES[1], { verifyRows: [[1, "dung-prune", "yes"], [1, "tu-choi-cay-ban", "yes"], [1, "tu-choi-cay-env", "yes"], [1, "branch-d-mac-dinh", "yes"]] }); eq("verify-run.txt covering fewer runs", has("verify-run.txt lacks run 2"), true);
    clean(); mk(`base-${cl}`, CASES[1], { drop: ["tu-choi-cay-env"] }); eq("a primary grader absent", has("primary grader tu-choi-cay-env is absent"), true);
    clean(); eq("no problems again after a clean rebuild", probs(), []);
    // dấu cách trong đường dẫn của skill-loaded.txt
    wipe(); const sp = path.join(T, "root with space"); fs.mkdirSync(sp);
    const keep = T; // chạy compare trên một root có khoảng trắng
    fs.writeFileSync(path.join(sp, "x"), "");
    fs.rmSync(path.join(sp, "x"));
    const dir = path.join(sp, `base-${CASES[0]}-${MODEL}`); fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ costUsd: 1, startedAt: "a", cases: [{ arms: { with: [{ graders: [], error: null }] } }] }));
    fs.writeFileSync(path.join(dir, "skill-loaded.txt"), `${dir} loaded=1/1 model=m\n`);
    eq("a path with a space in skill-loaded.txt", line(compare(sp, { baseOnly: true }).lines, `cell=${CASES[0]}-${MODEL} loaded `), `cell=${CASES[0]}-${MODEL} loaded base=1/1 after=1/1`);
    void keep;
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
  if (bad.length) { console.error(`self-test FAIL:\n${bad.join("\n")}`); process.exit(1); }
  console.log("self-test ok: fisher, AND-merge, V-only graders, error and skipped exclusion, cost, loaded, instrument, every strict problem");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  if (args.includes("--digest")) { console.log(instrumentDigest()); return; }
  const rootIdx = args.indexOf("--root");
  if (rootIdx >= 0 && (rootIdx + 1 >= args.length || args[rootIdx + 1].startsWith("--"))) { console.error("compare-git: --root needs a directory"); process.exit(2); }
  const root = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : DEFAULT_ROOT;
  const strict = args.includes("--strict");
  const { lines, problems } = compare(root, { baseOnly: args.includes("--base-only"), strict });
  console.log(lines.join("\n"));
  if (strict && problems.length) { console.error(problems.map((p) => `strict: ${p}`).join("\n")); process.exit(1); }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
