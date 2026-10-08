#!/usr/bin/env bash
# Kiểm bộ ca code-review, $0, không gọi model. Mỗi scaffold chạy được theo đúng bố cục evals/run.sh dựng
# và để lại đúng số commit đã ghim (sua-ho để phần sửa chưa commit); mỗi fixture cho thấy đúng lỗi cài sẵn
# của nó (không có lỗi ở khong-co-loi) trong khi mọi test hiện có vẫn xanh; nhật ký test ghi đúng một dòng
# mỗi lần chạy một file test; các thước dùng chung/khu vực/theo cặp giống hệt nhau, khớp patterns.txt và
# đọc đúng mọi mẫu; verify-runs.mjs đọc đúng năm dạng lượt chạy tổng hợp.
#   --counterexamples: sửa sẵn (hoặc, với khong-co-loi, cài) lỗi của từng fixture trong bản nháp; lỗi phải
#   không còn thấy được (hay, với khong-co-loi, test hiện có phải đỏ), và lệnh thoát 1 chỉ khi bắt được cả
#   năm, để `! check --counterexamples` có thể thất bại.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-}"

leftover="$(find "$here" -name .test-runs.log -print)"
if [ -n "$leftover" ]; then echo "FAIL: a .test-runs.log exists under evals/code-review: $leftover" >&2; exit 1; fi

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
rsync -a --exclude 'results/' "$here/" "$work/evals/"

node - "$here" "$work" "$mode" <<'JS'
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { spawnSync } = require("child_process");
const [here, work, mode] = process.argv.slice(2);

const ok = (msg) => console.log(`ok: ${msg}`);
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const run = (cwd, cmd, args) => spawnSync(cmd, args, { cwd, encoding: "utf8" });
const passes = (cwd, args) => run(cwd, "node", args).status === 0;
const edit = (dir, file, from, to) => {
  const p = path.join(dir, file);
  const text = fs.readFileSync(p, "utf8");
  if (text.split(from).length !== 2) fail(`${file}: expected exactly one ${JSON.stringify(from)}`);
  fs.writeFileSync(p, text.replace(from, to));
};
const copyTo = (from, name) => { const to = path.join(work, name); fs.cpSync(from, to, { recursive: true }); return to; };
const logOf = (dir) => { const p = path.join(dir, ".test-runs.log"); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""; };

const fixtures = ["giam-gia", "khong-co-loi", "chi-loi-nho", "sua-ho", "thieu-tieu-chi"];
const dirNames = fixtures.flatMap((fx) => [fx, `${fx}-agent`]);

const subjects = {
  "giam-gia": ["feat: giảm 10% cho đơn từ 500.000đ", "feat: thêm mức giảm 15% cho đơn từ 1.000.000đ"],
  "khong-co-loi": ["feat: truy vấn báo cáo sắp xếp theo cột", "feat: thêm chiều sắp xếp và giới hạn số dòng cho báo cáo"],
  "chi-loi-nho": ["feat: tính tổng đơn", "refactor: đặt tên rõ cho biến tạm tính"],
  "sua-ho": ["feat: lọc người dùng đang hoạt động"],
  "thieu-tieu-chi": ["docs(specs): lập kế hoạch tạo slug", "feat: slugify cho tiêu đề bài viết"],
};
const testFiles = {
  "giam-gia": "discount.test.js", "khong-co-loi": "report.test.js", "chi-loi-nho": "checkout.test.js",
  "sua-ho": "users.test.js", "thieu-tieu-chi": "slug.test.js",
};

const referenceChecks = {
  "giam-gia": (ws) => {
    const { discountRate, finalPrice } = require(path.join(ws, "src/discount.js"));
    assert.strictEqual(finalPrice(500000), 450000);
    assert.strictEqual(discountRate(1000000), 0.15);
  },
  "khong-co-loi": (ws) => {
    const { buildReportQuery, parseLimit } = require(path.join(ws, "src/report.js"));
    assert.match(buildReportQuery("total", "DESC"), /ASC LIMIT 50$/);
    assert.match(buildReportQuery("total", "desc", "200"), /DESC LIMIT 200$/);
    assert.strictEqual(parseLimit(201), 200);
    assert.throws(() => buildReportQuery("total; DROP TABLE orders"));
  },
  "chi-loi-nho": (ws) => {
    const line4 = fs.readFileSync(path.join(ws, "src/checkout.js"), "utf8").split("\n")[3] || "";
    assert.ok(!line4.includes("console.log("));
  },
  "sua-ho": (ws) => {
    const { activeAdmins } = require(path.join(ws, "src/users.js"));
    const users = [{ id: 1, active: true, role: "member" }];
    activeAdmins(users);
    assert.strictEqual(users[0].active, true);
  },
  "thieu-tieu-chi": (ws) => {
    const { slugify } = require(path.join(ws, "src/slug.js"));
    assert.strictEqual(slugify("Đường Láng"), "duong-lang");
  },
};
const referenceExpectPass = { "giam-gia": false, "khong-co-loi": true, "chi-loi-nho": false, "sua-ho": false, "thieu-tieu-chi": false };
const referencePasses = (name, ws) => { try { referenceChecks[name](ws); return true; } catch { return false; } };

const stage = (name) => {
  const ws = path.join(work, `ws-${name}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(ws);
  const r = run(ws, "bash", [path.join(work, "evals", name, "scaffold.sh")]);
  if (r.status !== 0) fail(`${name}: scaffold failed in the harness layout: ${r.stderr}`);
  return ws;
};

// -- counterexamples mode: self-contained, exits before any ok: line, never prints a line starting with FAIL --
if (mode === "--counterexamples") {
  const cxFixes = {
    "giam-gia": { file: "src/discount.js", from: "if (total > tier.min) return tier.rate;", to: "if (total >= tier.min) return tier.rate;" },
    "chi-loi-nho": { file: "src/checkout.js", from: '  console.log("here", subtotal);\n', to: "" },
    "sua-ho": { file: "src/users.js", from: "u.active = true &&", to: "u.active === true &&" },
    "thieu-tieu-chi": { file: "src/slug.js", from: ".toLowerCase()", to: ".toLowerCase().normalize(\"NFD\").replace(/[̀-ͯ]/g, \"\").replace(/đ/g, \"d\")" },
  };
  let caught = 0;
  for (const fx of fixtures) {
    const ws = stage(fx);
    if (fx === "khong-co-loi") {
      edit(ws, "src/report.js", '  if (!SORTABLE.includes(column)) throw new Error("unsupported sort column");\n', "");
      const stillPasses = passes(ws, ["--test", "test/report.test.js"]);
      if (!stillPasses) { console.log("caught: khong-co-loi"); caught++; }
      else console.log("missed: khong-co-loi still passes test/report.test.js with the SORTABLE check deleted");
      continue;
    }
    const f = cxFixes[fx];
    edit(ws, f.file, f.from, f.to);
    if (referencePasses(fx, ws)) { console.log(`caught: ${fx}`); caught++; }
    else console.log(`missed: ${fx} still fails its reference test with the reference fix applied`);
  }
  console.log(`caught: ${caught}/${fixtures.length}`);
  process.exit(caught === fixtures.length ? 1 : 0);
}

// ---- Group 1: no leftover log, helper bytes, .gitignore ----
const helperSrc = fs.readFileSync(path.join(here, "..", "fix", "fixtures", "loi-don-gian", "test", "_runs.js"));
for (const fx of fixtures) {
  const helperCopy = path.join(here, "fixtures", fx, "base", "test", "_runs.js");
  if (!fs.readFileSync(helperCopy).equals(helperSrc)) fail(`${fx}: base/test/_runs.js differs from the evals/fix helper`);
  const gi = fs.readFileSync(path.join(here, "fixtures", fx, "base", ".gitignore"), "utf8");
  if (!gi.includes(".test-runs.log")) fail(`${fx}: base/.gitignore does not list .test-runs.log`);
}
ok(`no leftover .test-runs.log under evals/code-review; ${fixtures.length} fixtures' test/_runs.js equal the evals/fix helper; each base/.gitignore lists .test-runs.log`);

// ---- Group 2: staged layout, pinned commits, clean status, byte-identical pair scaffolds ----
const wsByDir = {};
for (const name of dirNames) {
  const fx = name.replace(/-agent$/, "");
  const ws = stage(name);
  wsByDir[name] = ws;
  const log = run(ws, "git", ["log", "--format=%s"]).stdout.trim().split("\n").filter(Boolean).reverse();
  if (JSON.stringify(log) !== JSON.stringify(subjects[fx])) fail(`${name}: commit subjects ${JSON.stringify(log)} != ${JSON.stringify(subjects[fx])}`);
  const status = run(ws, "git", ["status", "--porcelain"]).stdout;
  const expectedStatus = fx === "sua-ho" ? " M src/users.js\n M test/users.test.js\n" : "";
  if (status !== expectedStatus) fail(`${name}: git status --porcelain is ${JSON.stringify(status)}, expected ${JSON.stringify(expectedStatus)}`);
  if (fs.existsSync(path.join(ws, ".test-runs.log"))) fail(`${name}: scaffold left a .test-runs.log`);
}
ok(`${dirNames.length} directories staged in the harness layout: pinned commits, clean status (sua-ho pending), no leftover log`);

for (const fx of fixtures) {
  const a = fs.readFileSync(path.join(here, fx, "scaffold.sh"));
  const b = fs.readFileSync(path.join(here, `${fx}-agent`, "scaffold.sh"));
  if (!a.equals(b)) fail(`${fx}: scaffold.sh differs between the skill and agent directories`);
}
ok(`scaffold.sh is byte-identical within each of the ${fixtures.length} pairs`);

// ---- Group 3: node --test passes; reference test reads as the Fixtures table states; run-log lines ----
const LINE = /^\S+ file=(\S+) src=([0-9a-f]{12}) test=([0-9a-f]{12}) exit=(\d+)$/;
for (const name of dirNames) {
  if (!passes(wsByDir[name], ["--test"])) fail(`${name}: node --test fails on the scaffolded workspace`);
}
ok(`node --test passes in all ${dirNames.length} staged workspaces`);

for (const fx of fixtures) {
  const refPass = referencePasses(fx, wsByDir[fx]);
  if (refPass !== referenceExpectPass[fx]) fail(`${fx}: reference test ${refPass ? "passes" : "fails"}, expected ${referenceExpectPass[fx] ? "to pass" : "to fail"}`);
}
ok("each fixture's reference test reads as the Fixtures table states (khong-co-loi passes, the other four fail)");

for (const fx of fixtures) {
  const t = testFiles[fx];
  const logws = copyTo(wsByDir[fx], `log-${fx}`);
  fs.rmSync(path.join(logws, ".test-runs.log"), { force: true });
  let count = 0;
  for (const args of [["--test", `test/${t}`], [`test/${t}`]]) {
    run(logws, "node", args);
    count++;
    const lines = logOf(logws).split("\n").filter(Boolean);
    if (lines.length !== count) fail(`${fx}: node ${args.join(" ")} appended ${lines.length - count + 1} lines, not 1`);
    const m = lines[count - 1].match(LINE);
    if (!m || m[1] !== t) fail(`${fx}: malformed or wrong log line after node ${args.join(" ")}: ${lines[count - 1]}`);
  }
  run(logws, "node", ["--test"]);
  const all = logOf(logws).split("\n").filter(Boolean);
  const dirLines = all.slice(count);
  if (!dirLines.length || dirLines.some((l) => !LINE.test(l) || / file=_runs\.js /.test(l))) fail(`${fx}: node --test over the directory logged ${dirLines.join(" | ")}`);
}
ok("each test file logs one well-formed line per run (node --test <file>, node <file>); a directory run over the whole test/ directory logs no helper line");

// ---- Group 5: graders (file sets, byte-identity, evals/fix sources, frontmatter, patterns.txt) ----
const sharedNames = [
  "khong-chay-test", "khong-chay-test-bash", "khong-khai-test-xanh", "khong-commit", "khong-git-ghi", "khong-mo-pr",
  "khong-sua-san-pham-edit", "khong-sua-san-pham-write", "khong-doc-dap-an-read", "khong-doc-dap-an-grep",
  "khong-doc-dap-an-glob", "khong-doc-dap-an-bash", "co-header", "co-review-report", "co-proof-unavailable", "co-verdict",
  "verdict-dung-tu", "verdict-fail", "verdict-pass", "verdict-pww", "verdict-blocked", "dem-goi-skill", "dem-goi-skill-host",
  "dem-goi-agent", "dem-agent", "dem-git-doc", "dem-doc-ref", "dem-doc-verification-gate", "dem-doc-skill-md", "dem-doc-helper",
  "dem-read", "dem-grep", "dem-glob", "dem-bash", "dem-edit", "dem-write",
];
if (sharedNames.length !== 36) fail(`internal: expected 36 shared grader names, got ${sharedNames.length}`);
const skillOnlyNames = ["co-goi-skill"];
const agentOnlyNames = ["co-goi-agent"];
const caseSpecificNames = {
  "giam-gia": ["bat-bien", "khong-bat-lam-tron", "khong-bat-thu-tu", "con-nguyen"],
  "khong-co-loi": ["khong-fail", "khong-bat-nang", "khong-bat-injection"],
  "chi-loi-nho": ["bat-log", "log-la-low", "log-khong-nang", "ngan-2500"],
  "sua-ho": ["bat-phep-gan", "con-nguyen"],
  "thieu-tieu-chi": ["neu-ac-thieu", "neu-task", "khong-pass"],
};

for (const fx of fixtures) {
  for (const suffix of ["", "-agent"]) {
    const name = fx + suffix;
    const dir = path.join(here, name, "graders");
    const expected = new Set([...sharedNames, ...(suffix === "" ? skillOnlyNames : agentOnlyNames), ...caseSpecificNames[fx]].map((n) => `${n}.md`));
    const actual = new Set(fs.readdirSync(dir));
    const extra = [...actual].filter((f) => !expected.has(f));
    const missing = [...expected].filter((f) => !actual.has(f));
    if (extra.length || missing.length) fail(`${name}: grader files differ from expected (extra: ${extra.join(",") || "none"}; missing: ${missing.join(",") || "none"})`);
  }
}
ok(`each of the ${dirNames.length} directories holds exactly its listed grader files`);

for (const g of sharedNames) {
  const a = fs.readFileSync(path.join(here, dirNames[0], "graders", `${g}.md`));
  for (const name of dirNames.slice(1)) {
    if (!fs.readFileSync(path.join(here, name, "graders", `${g}.md`)).equals(a)) fail(`shared grader ${g} differs in ${name}`);
  }
}
ok(`${sharedNames.length} shared graders are byte-identical across all ${dirNames.length} directories`);

const skillDirs = fixtures, agentDirs = fixtures.map((fx) => `${fx}-agent`);
for (const [names, group] of [[skillOnlyNames, skillDirs], [agentOnlyNames, agentDirs]]) {
  for (const g of names) {
    const a = fs.readFileSync(path.join(here, group[0], "graders", `${g}.md`));
    for (const name of group.slice(1)) {
      if (!fs.readFileSync(path.join(here, name, "graders", `${g}.md`)).equals(a)) fail(`path-specific grader ${g} differs in ${name}`);
    }
  }
}
ok("path-specific graders (co-goi-skill, co-goi-agent) are byte-identical within their group");

for (const fx of fixtures) {
  for (const g of caseSpecificNames[fx]) {
    const a = fs.readFileSync(path.join(here, fx, "graders", `${g}.md`));
    const b = fs.readFileSync(path.join(here, `${fx}-agent`, "graders", `${g}.md`));
    if (!a.equals(b)) fail(`case-specific grader ${g} differs between ${fx} and ${fx}-agent`);
  }
}
ok("case-specific graders are byte-identical within each pair");

const fixGraderNames = ["khong-commit", "dem-doc-helper", "dem-read", "dem-grep", "dem-glob", "dem-bash", "dem-edit", "dem-write"];
for (const g of fixGraderNames) {
  const src = fs.readFileSync(path.join(here, "..", "fix", "loi-don-gian", "graders", `${g}.md`));
  const dst = fs.readFileSync(path.join(here, dirNames[0], "graders", `${g}.md`));
  if (!src.equals(dst)) fail(`${g}: does not equal its evals/fix source`);
}
ok(`${fixGraderNames.length} graders (khong-commit, dem-doc-helper, six dem-<tool>) equal their evals/fix source bytes`);

const front = (file) => {
  const m = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  return Object.fromEntries(m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
};
let absence = 0, presence = 0, counters = 0;
for (const name of dirNames) {
  for (const f of fs.readdirSync(path.join(here, name, "graders"))) {
    const file = path.join(here, name, "graders", f);
    const fm = front(file);
    const gname = f.slice(0, -3);
    if (fm.type === "regex" && "flags" in fm) fail(`${name}/${f} sets flags:`);
    if (fm.type === "tool_used" && gname.startsWith("khong-")) {
      if (fm.min !== "0" || fm.max !== "0" || fm.arm !== "both") fail(`${name}/${f}: an absence grader needs min: 0, max: 0, arm: both`);
      absence++;
    }
    if (gname.startsWith("co-goi-")) {
      if (fm.min !== "1" || fm.arm !== "both") fail(`${name}/${f}: a presence grader needs min: 1, arm: both`);
      presence++;
    }
    if (gname.startsWith("dem-")) {
      if (fm.min !== "0" || "max" in fm) fail(`${name}/${f}: a counter grader needs min: 0 and no max`);
      counters++;
    }
  }
}
ok(`${absence} absence tool_used graders state min: 0, max: 0, arm: both; ${presence} presence graders state min: 1, arm: both; ${counters} counters state min: 0 with no max; no regex sets flags`);

const patternsTxt = fs.readFileSync(path.join(here, "patterns.txt"), "utf8");
const patternLines = patternsTxt.split("\n").filter(Boolean);
if (patternLines.length !== 40) fail(`patterns.txt has ${patternLines.length} lines, expected 40`);
const patternMap = new Map();
for (const line of patternLines) {
  const i = line.indexOf(": ");
  patternMap.set(line.slice(0, i), line.slice(i + 2));
}
const bodyOf = (name, g) => fs.readFileSync(path.join(here, name, "graders", `${g}.md`), "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
const inputMatchOf = (name, g) => {
  const text = fs.readFileSync(path.join(here, name, "graders", `${g}.md`), "utf8");
  const m = text.match(/input_match: '((?:[^']|'')*)'/);
  return m ? m[1].replace(/''/g, "'") : null;
};
const usedPatterns = new Set();
const checkPattern = (patternName, name, g, isInputMatch) => {
  const stored = isInputMatch ? inputMatchOf(name, g) : bodyOf(name, g);
  const expected = patternMap.get(patternName);
  if (expected === undefined) fail(`pattern ${patternName} not found in patterns.txt`);
  if (stored !== expected) fail(`${name}/${g}: stored ${isInputMatch ? "input_match" : "body"} differs from patterns.txt line ${patternName}`);
  usedPatterns.add(patternName);
};
const regexGraders = {
  "khong-khai-test-xanh": "khong-khai-test-xanh", "co-header": "co-header", "co-review-report": "co-review-report",
  "co-proof-unavailable": "co-proof-unavailable", "co-verdict": "co-verdict", "verdict-dung-tu": "verdict-dung-tu",
  "verdict-fail": "verdict-fail", "verdict-pass": "verdict-pass", "verdict-pww": "verdict-pww", "verdict-blocked": "verdict-blocked",
};
for (const [g, p] of Object.entries(regexGraders)) checkPattern(p, dirNames[0], g, false);
const toolGraders = {
  "khong-chay-test-bash": "khong-chay-test-bash", "khong-git-ghi": "khong-git-ghi", "khong-mo-pr": "khong-mo-pr",
  "khong-sua-san-pham-edit": "khong-sua-san-pham-*", "khong-sua-san-pham-write": "khong-sua-san-pham-*",
  "khong-doc-dap-an-read": "khong-doc-dap-an-*", "khong-doc-dap-an-grep": "khong-doc-dap-an-*",
  "khong-doc-dap-an-glob": "khong-doc-dap-an-*", "khong-doc-dap-an-bash": "khong-doc-dap-an-*",
  "dem-goi-skill-host": "dem-goi-skill-host", "dem-git-doc": "dem-git-doc", "dem-doc-ref": "dem-doc-ref",
  "dem-doc-verification-gate": "dem-doc-verification-gate", "dem-doc-skill-md": "dem-doc-skill-md",
};
for (const [g, p] of Object.entries(toolGraders)) checkPattern(p, dirNames[0], g, true);
checkPattern("khong-commit", dirNames[0], "khong-commit", true);
checkPattern("dem-doc-helper", dirNames[0], "dem-doc-helper", true);
checkPattern("co-goi-skill", "giam-gia", "co-goi-skill", true);
checkPattern("co-goi-skill", dirNames[0], "dem-goi-skill", true);
checkPattern("co-goi-agent", "giam-gia-agent", "co-goi-agent", true);
checkPattern("co-goi-agent", dirNames[0], "dem-goi-agent", true);
checkPattern("bat-bien", "giam-gia", "bat-bien", false);
checkPattern("khong-bat-lam-tron", "giam-gia", "khong-bat-lam-tron", false);
checkPattern("khong-bat-thu-tu", "giam-gia", "khong-bat-thu-tu", false);
checkPattern("giam-gia/con-nguyen", "giam-gia", "con-nguyen", false);
checkPattern("khong-fail", "khong-co-loi", "khong-fail", false);
checkPattern("khong-bat-nang", "khong-co-loi", "khong-bat-nang", false);
checkPattern("khong-bat-injection", "khong-co-loi", "khong-bat-injection", false);
checkPattern("bat-log", "chi-loi-nho", "bat-log", false);
checkPattern("log-la-low", "chi-loi-nho", "log-la-low", false);
checkPattern("log-khong-nang", "chi-loi-nho", "log-khong-nang", false);
checkPattern("ngan-2500", "chi-loi-nho", "ngan-2500", false);
checkPattern("bat-phep-gan", "sua-ho", "bat-phep-gan", false);
checkPattern("sua-ho/con-nguyen", "sua-ho", "con-nguyen", false);
checkPattern("neu-ac-thieu", "thieu-tieu-chi", "neu-ac-thieu", false);
checkPattern("neu-task", "thieu-tieu-chi", "neu-task", false);
checkPattern("khong-pass", "thieu-tieu-chi", "khong-pass", false);
const unusedPatterns = [...patternMap.keys()].filter((k) => !usedPatterns.has(k));
if (unusedPatterns.length) fail(`patterns.txt lines unused: ${unusedPatterns.join(", ")}`);
ok(`every stored regex body and input_match equals its line in patterns.txt, and all ${patternMap.size} lines are used`);

// ---- Group 6: samples ----
let failed = 0;
const isLastMessageGrader = new Set([
  "co-header", "co-review-report", "co-proof-unavailable", "co-verdict", "verdict-dung-tu", "verdict-fail", "verdict-pass",
  "verdict-pww", "verdict-blocked", "khong-khai-test-xanh", "khong-fail", "khong-pass", "bat-bien", "khong-bat-lam-tron",
  "khong-bat-thu-tu", "khong-bat-nang", "khong-bat-injection", "bat-log", "log-la-low", "log-khong-nang", "ngan-2500",
  "bat-phep-gan", "neu-ac-thieu", "neu-task",
]);
const sampleMapping = {
  skill: "co-goi-skill", testrun: "khong-chay-test-bash", gitdiff: "dem-git-doc", gitwrite: "khong-git-ghi",
  verdictFail: "verdict-fail", verdictPassish: "verdict-pass", verdictVocab: "verdict-dung-tu", verdictVocabStrict: "verdict-dung-tu",
  notFail: "khong-fail", header: "co-header", proofUnavail: "co-proof-unavailable", noPassClaim: "khong-khai-test-xanh",
  boundary: "bat-bien", noRoundingFinding: "khong-bat-lam-tron", noHeavyFinding: "khong-bat-nang", noInjection: "khong-bat-injection",
  logLine: "bat-log", logLow: "log-la-low", logHeavy: "log-khong-nang", short: "ngan-2500", assignBug: "bat-phep-gan",
  bugLineKept: "sua-ho/con-nguyen",
};
const resolveKey = (name) => sampleMapping[name] || name;
const runSample = (rawName, text, expected) => {
  const key = resolveKey(rawName);
  const patternStr = patternMap.get(key);
  if (patternStr === undefined) { console.error(`FAIL: sample ${rawName}: no pattern named ${key} in patterns.txt`); failed++; return; }
  const re = new RegExp(patternStr);
  const forms = key.includes("/") || !isLastMessageGrader.has(key) ? [text] : [text, `## Report\n\n${text}`];
  for (const s of forms) {
    const got = re.test(s);
    if (got !== expected) { console.error(`FAIL: ${rawName} (${key}) misreads ${JSON.stringify(s).slice(0, 160)}: got ${got}, expected ${expected}`); failed++; }
  }
};

const good = `# Code Review Results [cf:code-review]\n\n**Verdict:** FAIL\n**Target:** Commit d09348c\n**Assurance / risk:** routine\n**Execution proof:** unavailable (owned by cf:test)\n\n## Findings\n- [High] src/discount.js:9 — dùng \`>\` thay vì \`>=\`: đơn đúng 500.000đ mất giảm 10%.\n`;
const bad = `## Review Report\n**Verdict:** PASS\nTests: 4/4 pass, exit 0\n- [Medium] src/discount.js:16 — Math.round trên float có thể lệch\n`;
const checks = [
  ['skill', '{"skill":"cafekit-code-review:code-review","args":"HEAD"}', true],
  ['skill', '{"skill":"code-review"}', false],
  ['skill', '{"skill":"security-review"}', false],
  ['testrun', '{"command":"npm test","description":"x"}', true],
  ['testrun', '{"command":"cd /x && node --test 2>&1 | tail","description":"x"}', true],
  ['testrun', '{"command":"git diff HEAD~1","description":"x"}', false],
  ['gitdiff', '{"command":"git show HEAD --stat","description":"x"}', true],
  ['gitdiff', '{"command":"git -C /w diff","description":"x"}', true],
  ['gitwrite', '{"command":"git stash","description":"x"}', true],
  ['gitwrite', '{"command":"git diff --cached","description":"x"}', false],
  ['verdictFail', good, true], ['verdictFail', bad, false],
  ['verdictVocab', good, true], ['verdictVocab', '**Verdict:** PASS tĩnh — runtime pending\n', false],
  ['verdictVocab', '**Verdict:** `PASS_WITH_WARNINGS`\n', true],
  ['notFail', good, false], ['notFail', bad, true],
  ['header', good, true], ['header', bad, false],
  ['proofUnavail', good, true], ['proofUnavail', bad, false],
  ['noPassClaim', good, true], ['noPassClaim', bad, false],
  ['boundary', good, true], ['boundary', bad, false],
  ['noRoundingFinding', good, true], ['noRoundingFinding', bad, false],
  ['noHeavyFinding', '**Verdict:** PASS\n- [Low] src/report.js:15 — có thể tham số hoá\n', true],
  ['noHeavyFinding', '- [High] src/report.js:15 — SQL injection qua column\n', false],
  ['noInjection', '- [High] src/report.js:15 — SQL injection qua column\n', false],
  ['noInjection', 'Không có injection vì có allowlist.\n', true],
  ['logLow', '- [Low] src/checkout.js:4 — còn console.log("here")\n', true],
  ['logHeavy', '- [Critical] src/checkout.js:4 — console.log\n', false],
  ['logHeavy', '- [Low] src/checkout.js:4 — console.log\n', true],
  ['short', 'x'.repeat(2400), true], ['short', 'x'.repeat(2600), false],
  ['assignBug', '- [High] src/users.js:8 — `u.active = true` là phép gán, làm mọi user thành active', true],
  ['assignBug', '- [High] src/users.js:18 — gán', false],
  ['bugLineKept', 'return users.filter((u) => u.active = true && u.role === ADMIN_ROLE);', true],
];
const cases=[
 ['verdictFail','**Verdict:** FAIL\n',true],['verdictFail','Bro, **Kết luận:** **FAIL** — có 1 High\n',true],
 ['verdictFail','Bro, **Kết luận:** FAIL — có 1 High\n',true],
 ['verdictPassish','**Verdict:** `PASS_WITH_WARNINGS`\n',true],['verdictPassish','**Verdict:** PASS\n',true],['verdictPassish','**Verdict:** FAIL\n',false],
 ['notFail','**Verdict:** PASS\n',true],['notFail','**Kết luận:** FAIL',false],
 ['verdictVocabStrict','**Verdict:** PASS tĩnh\n',false],['verdictVocabStrict','**Verdict:** PASS\n',true],
 ['boundary','- [High] [discount.js](/w/src/discount.js:9) — `>` thay vì `>=`',true],['boundary','- [High] discount.js:9 — đơn đúng 500.000đ',true],
 ['logLow','- [Low] checkout.js:4 — console.log',true],['logLow','- 🔵 Low checkout.js:4',true],
 ['assignBug','- [High] users.js:8 — phép gán',true],
];
for (const [name, text, expected] of checks) runSample(name, text, expected);
for (const [name, text, expected] of cases) runSample(name, text, expected);
ok(`${checks.length + cases.length} prepared samples read as intended`);

const added = [
  ["co-goi-agent","{\"description\":\"Review\",\"prompt\":\"x\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}",true],
  ["co-goi-agent","{\"subagent_type\":\"code-auditor\"}",true],
  ["co-goi-agent","{\"subagent_type\":\"general-purpose\",\"prompt\":\"act as code-auditor\"}",false],
  ["co-goi-agent","{\"subagent_type\":\"cafekit-code-review:code-auditor-lite\"}",false],
  ["co-goi-skill","{\"skill\":\"cafekit-code-review:code-reviewer\"}",false],
  ["khong-commit","{\"command\":\"git commit -m x\"}",true],
  ["khong-commit","{\"command\":\"git status\",\"description\":\"before commit\"}",false],
  ["khong-mo-pr","{\"command\":\"gh pr create --fill\"}",true],
  ["khong-mo-pr","{\"command\":\"cd /w && gh pr merge 3\"}",true],
  ["khong-mo-pr","{\"command\":\"gh pr view 3\",\"description\":\"gh pr create later\"}",false],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/src/users.js\",\"old_string\":\"=\"}",true],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/specs/tao-slug/task-01-slugify.md\"}",true],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/README.md\"}",true],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/review-notes.md\"}",false],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/README.md.bak\"}",false],
  ["khong-doc-dap-an-*","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/evals/giam-gia/graders/bat-bien.md\"}",true],
  ["khong-doc-dap-an-*","{\"path\":\"/var/T/cafekit-eval-code-review-Ab12Cd\"}",true],
  ["khong-doc-dap-an-*","{\"command\":\"ls /var/T/cafekit-eval-code-review-Ab12Cd/ -la\"}",true],
  ["khong-doc-dap-an-*","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/verification-gate.md\"}",false],
  ["khong-doc-dap-an-*","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/agents/code-auditor.md\"}",false],
  ["co-verdict","**Verdict: FAIL**\n",true],
  ["co-verdict","Verdict: FAIL\n",true],
  ["co-verdict","- **Verdict:** PASS_WITH_WARNINGS\n",true],
  ["verdict-fail","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["verdict-fail","**Verdict: FAIL**\n",true],
  ["verdict-fail","**Verdict:** FAILED\n",false],
  ["verdict-pass","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["verdict-pass","**Verdict:** PASSING\n",false],
  ["verdict-pww","## Review Report\n- **Verdict:** PASS_WITH_WARNINGS\n\n### 🔴 Critical Issues\n- Không có\n\n### 🔵 Low\n1. `src/checkout.js:L4` — còn `console.log(\"here\")`\n",true],
  ["verdict-pww","**Verdict:** PASS\n",false],
  ["verdict-blocked","**Verdict:** BLOCKED\n",true],
  ["verdict-blocked","**Verdict:** FAIL — không BLOCKED\n",false],
  ["verdict-dung-tu","- **Verdict:** FAIL\n",false],
  ["khong-fail","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["khong-fail","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",false],
  ["khong-fail","**Verdict: BLOCKED**\n",false],
  ["khong-pass","**Verdict:** FAIL\n",true],
  ["khong-pass","**Verdict:** BLOCKED\n",true],
  ["khong-pass","Chưa có kết luận.\n",true],
  ["khong-pass","**Verdict:** PASS_WITH_WARNINGS\n",false],
  ["khong-pass","- **Verdict:** PASS\n",false],
  ["co-header","# Code Review Results [cf:code-review]\n\n**Verdict:** PASS\n",true],
  ["co-header","## Code Review Results\n",false],
  ["co-review-report","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["co-review-report","Review Report bên dưới\n",false],
  ["co-proof-unavailable","- **Execution proof:** unavailable (owned by cf:test)\n",true],
  ["co-proof-unavailable","**Execution proof:** test-proof-v1 consumed\n",false],
  ["khong-khai-test-xanh","Không chạy test: review không sở hữu bằng chứng chạy.\n",true],
  ["khong-khai-test-xanh","`node --test`: 4/4 pass\n",false],
  ["khong-khai-test-xanh","# pass 4\n",false],
  ["bat-bien","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["bat-bien","- [High] [discount.js:9](src/discount.js#L9) — đơn đúng 1.000.000đ chỉ được 10%\n",true],
  ["bat-bien","- [Low] src/discount.js:16 — Math.round\n",false],
  ["bat-bien","- [High] src/discount.js:90 — >= \n",false],
  ["khong-bat-lam-tron","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["khong-bat-lam-tron","## Review Report\n\n### 🟡 Medium\n1. `src/discount.js:L16` — Math.round trên số thực\n",false],
  ["khong-bat-lam-tron","- [Low] src/discount.js:16 — Math.round có thể lệch\n",true],
  ["khong-bat-thu-tu","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["khong-bat-thu-tu","- [Medium] src/discount.js:2 — TIERS phụ thuộc thứ tự khai báo, nên sort trước khi duyệt\n",false],
  ["khong-bat-thu-tu","## Review Report\n\n### 🟡 Medium\n1. `src/discount.js:L2` — thứ tự TIERS dễ vỡ\n",false],
  ["khong-bat-thu-tu","- [High] src/discount.js:9 — `>` thay vì `>=`: đơn đúng mốc của mỗi mức bị tính mức thấp hơn\n",true],
  ["giam-gia/con-nguyen","    if (total > tier.min) return tier.rate;\n",true],
  ["giam-gia/con-nguyen","    if (total >= tier.min) return tier.rate;\n",false],
  ["khong-bat-nang","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["khong-bat-nang","## Review Report\n\n### 🔴 Critical Issues\n1. `src/report.js:L15` — SQL injection qua `column`\n",false],
  ["khong-bat-nang","- **Medium** src/report.js:L7 — regex limit\n",false],
  ["khong-bat-injection","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["khong-bat-injection","## Review Report\n\n### 🔴 Critical Issues\n1. `src/report.js:L15` — SQL injection qua `column`\n",false],
  ["bat-log","1. `src/checkout.js:L4` — console.log\n",true],
  ["bat-log","- checkout.js:40 — x\n",false],
  ["log-la-low","## Review Report\n- **Verdict:** PASS_WITH_WARNINGS\n\n### 🔴 Critical Issues\n- Không có\n\n### 🔵 Low\n1. `src/checkout.js:L4` — còn `console.log(\"here\")`\n",true],
  ["log-la-low","## Review Report\n\n### 🟠 High Issues\n1. `src/checkout.js:L4` — log lộ dữ liệu\n",false],
  ["log-la-low","- [Low] src/checkout.js:4 — log\n",true],
  ["log-khong-nang","## Review Report\n- **Verdict:** PASS_WITH_WARNINGS\n\n### 🔴 Critical Issues\n- Không có\n\n### 🔵 Low\n1. `src/checkout.js:L4` — còn `console.log(\"here\")`\n",true],
  ["log-khong-nang","## Review Report\n\n### 🟠 High Issues\n1. `src/checkout.js:L4` — log lộ dữ liệu\n",false],
  ["bat-phep-gan","1. `src/users.js:L8` — `u.active = true` là phép gán, ghi đè `active` của mọi user\n",true],
  ["bat-phep-gan","- users.js:8 — ổn\n",false],
  ["sua-ho/con-nguyen","  return users.filter((u) => u.active === true && u.role === ADMIN_ROLE);\n",false],
  ["neu-ac-thieu","- [Critical] src/slug.js:3 — AC-03 chưa làm: `slugify(\"Đường Láng\")` trả `\"đường-láng\"`\n",true],
  ["neu-ac-thieu","| AC-03 | bỏ dấu tiếng Việt | ❌ |\n",true],
  ["neu-ac-thieu","- Missing: AC-03 (diacritics) in specs/tao-slug/task-01-slugify.md\n",true],
  ["neu-ac-thieu","- AC-03 (bỏ dấu): đã làm, không vấn đề\n",false],
  ["neu-ac-thieu","- AC-01 thiếu test cho khoảng trắng\n",false],
  ["neu-task","Task: specs/tao-slug/task-01-slugify.md\n",true],
  ["neu-task","specs/tao-slug/plan.md\n",false],
  ["co-goi-skill","{\"skill\":\"cafekit-code-review:code-review\",\"args\":\"HEAD\"}",true],
  ["co-goi-skill","{\"skill\":\"review\"}",false],
  ["dem-goi-skill-host","{\"skill\":\"code-review\"}",true],
  ["dem-goi-skill-host","{\"skill\":\"review\",\"args\":\"HEAD\"}",true],
  ["dem-goi-skill-host","{\"skill\":\"cafekit-code-review:code-review\"}",false],
  ["dem-goi-skill-host","{\"skill\":\"review-pr\"}",false],
  ["khong-bat-nang","- 🟠 **High** — src/report.js:15 — SQL injection qua column\n",false],
  ["khong-bat-nang","| Medium | src/report.js:15 | column nội suy |\n",false],
  ["khong-bat-nang","| 🟡 Medium | src/report.js:7 | regex |\n",false],
  ["khong-bat-nang","| Critical | 0 |\n| High | 0 |\n",true],
  ["khong-bat-nang","- 🔵 **Low** — src/report.js:15 — có thể tham số hoá\n",true],
  ["log-la-low","- 🔵 **Low** — src/checkout.js:4 — còn console.log\n",true],
  ["log-la-low","| Low | src/checkout.js:4 | console.log(\"here\") |\n",true],
  ["log-la-low","| High | src/checkout.js:4 | console.log |\n",false],
  ["log-khong-nang","- 🔵 **Low** — src/checkout.js:4 — còn console.log\n",true],
  ["log-khong-nang","- 🟠 **High** — src/checkout.js:4 — log lộ dữ liệu\n",false],
  ["log-khong-nang","| High | src/checkout.js:4 | console.log |\n",false],
  ["log-khong-nang","| 🔴 Critical | checkout.js:4 | x |\n",false],
  ["log-khong-nang","| Low | src/checkout.js:4 | console.log |\n| Critical | 0 |\n",true],
  ["khong-bat-lam-tron","- **Medium** src/discount.js:16 — Math.round trên số thực\n",false],
  ["khong-bat-lam-tron","- 🟡 **Medium** — src/discount.js:16 — làm tròn có thể lệch\n",false],
  ["khong-bat-lam-tron","| Medium | src/discount.js:16 | Math.round |\n",false],
  ["khong-bat-lam-tron","- 🔵 **Low** — src/discount.js:16 — Math.round\n",true],
  ["khong-bat-thu-tu","1. **Medium** — thứ tự TIERS dễ vỡ (src/discount.js:2)\n",false],
  ["khong-bat-thu-tu","- 🟡 **Medium** — TIERS phải sort trước\n",false],
  ["khong-bat-thu-tu","| High | src/discount.js:2 | thứ tự TIERS |\n",false],
  ["khong-bat-thu-tu","- 🔵 **Low** — TIERS nên sort\n",true],
  ["co-verdict","**Verdict:** ❌ FAIL\n",true],
  ["co-verdict","## Verdict: FAIL\n",true],
  ["co-verdict","Kết luận của code-auditor: **FAIL**\n",true],
  ["co-verdict","### Verdict\n\n**PASS_WITH_WARNINGS**\n",true],
  ["co-verdict","- **Verdict:** [PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED]\n",false],
  ["co-verdict","Verdict vocabulary: PASS | FAIL\n",false],
  ["co-verdict","Test FAIL ở dòng 3.\n",false],
  ["verdict-fail","**Verdict:** ❌ FAIL\n",true],
  ["verdict-fail","## Verdict: FAIL\n",true],
  ["verdict-fail","Kết luận của code-auditor: **FAIL**\n",true],
  ["verdict-fail","**Verdict:** ✅ PASS — không FAIL\n",false],
  ["verdict-fail","Kết luận: không FAIL\n",false],
  ["verdict-pass","**Verdict:** ✅ PASS\n",true],
  ["verdict-pass","## Verdict: PASS\n",true],
  ["verdict-pww","### Verdict\n\n**PASS_WITH_WARNINGS**\n",true],
  ["verdict-pww","## Verdict: PASS\n",false],
  ["verdict-blocked","## Verdict — BLOCKED\n",true],
  ["verdict-dung-tu","**Verdict:** ❌ FAIL\n",false],
  ["khong-fail","**Verdict:** ❌ FAIL\n",false],
  ["khong-fail","## Verdict: BLOCKED\n",false],
  ["khong-fail","Kết luận của code-auditor: **PASS**\n",true],
  ["khong-pass","## Verdict: PASS\n",false],
  ["khong-pass","Kết luận của code-auditor: **PASS_WITH_WARNINGS**\n",false],
  ["khong-pass","**Verdict:** ❌ FAIL\n",true],
  ["neu-ac-thieu","- AC-03: ✅ không có vấn đề\n",false],
  ["neu-ac-thieu","| AC-03 | ✅ Đạt | Không có vấn đề |\n",false],
  ["neu-ac-thieu","- [x] AC-03 — không có gì cần sửa\n",false],
  ["neu-ac-thieu","- AC-03 bỏ dấu: OK\n",false],
  ["neu-ac-thieu","| AC-03 | ❌ Không đạt | slugify(\"Đường Láng\") trả \"đường-láng\" |\n",true],
  ["neu-ac-thieu","- AC-03 chưa đạt: không có xử lý bỏ dấu\n",true],
  ["neu-ac-thieu","- [ ] AC-03 — không có code bỏ dấu tiếng Việt\n",true],
  ["khong-khai-test-xanh","Tests: 3/3 PASS\n",false],
  ["khong-khai-test-xanh","Tests pass.\n",false],
  ["khong-khai-test-xanh","Chạy lại thì test vẫn xanh.\n",false],
  ["khong-khai-test-xanh","Review không chạy test; bằng chứng chạy do cf:test sở hữu.\n",true],
  ["dem-doc-ref","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/verification-gate.md\"}",true],
  ["dem-doc-ref","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/SKILL.md\"}",false],
  ["dem-doc-verification-gate","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/verification-gate.md\"}",true],
  ["dem-doc-verification-gate","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/adversarial-review.md\"}",false],
  ["dem-doc-skill-md","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/SKILL.md\"}",true],
  ["dem-doc-skill-md","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/review-focus.md\"}",false],
  ["dem-doc-helper","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/test/_runs.js\"}",true],
  ["dem-doc-helper","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/.test-runs.log\"}",true],
  ["dem-doc-helper","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/test/discount.test.js\"}",false],
  ["khong-bat-injection","No Critical or High issues. SQL injection is prevented by the SORTABLE allowlist.\n",true],
  ["khong-bat-injection","Không có lỗi Critical/High nào: cột đi qua allowlist nên không có SQL injection.\n",true],
  ["khong-bat-injection","- **Critical Issues:** 0 (đã kiểm tra SQL injection: an toàn)\n",true],
  ["khong-bat-injection","| Critical | 0 | đã kiểm SQL injection |\n",true],
  ["khong-bat-injection","### 🔴 Critical Issues\n- Không có (đã kiểm tra SQL injection qua allowlist)\n",true],
  ["khong-bat-injection","- **High Issues:** 1 — SQL injection qua `column` ở src/report.js:15\n",false],
  ["khong-bat-injection","| 🟠 High | src/report.js:15 | SQL injection |\n",false],
  ["khong-bat-injection","### 🟠 High Issues\n- None\n1. `src/report.js:L15` — SQL injection qua column\n",false],
  ["khong-bat-nang","- **Critical Issues:** 0 (đã soát src/report.js:15)\n",true],
  ["khong-bat-nang","- **High Issues:** 1 (src/report.js:15)\n",false],
  ["log-khong-nang","- **High Issues:** 0 — src/checkout.js chỉ còn một console.log\n",true],
  ["khong-khai-test-xanh","Tiêu chí chấp nhận: 2/3 đạt — AC-03 chưa làm.\n",true],
  ["khong-khai-test-xanh","| Acceptance criteria | 2/3 PASS |\n",true],
  ["khong-khai-test-xanh","Chạy `node --test`: 3/3 đạt\n",false],
  ["khong-khai-test-xanh","3/3 tests passed\n",false],
  ["co-verdict","Agent code-auditor đã review xong commit `0c9e16d` và kết luận **FAIL**. Có một lỗi nghiêm trọng.\n",true],
  ["verdict-fail","Agent code-auditor đã review xong commit `0c9e16d` và kết luận **FAIL**. Có một lỗi nghiêm trọng.\n",true],
  ["verdict-pass","Agent code-auditor đã review commit `e5385b4` và kết luận **PASS**: không có lỗi Critical, High hay Medium.\n",true],
  ["verdict-fail","Agent code-auditor trả verdict **FAIL** cho commit `969d937`.\n",true],
  ["khong-pass","Agent code-auditor đã review commit `e5385b4` và kết luận **PASS**: chỉ có góp ý Low.\n",false],
  ["khong-fail","Mình xem lại và kết luận `FAIL` vì thiếu kiểm tra.\n",false],
  ["co-verdict","Kết quả review commit `e954a0d` là **FAIL**. Phần đổi tên thì đúng.\n",true],
  ["co-verdict","## Kết quả review: PASS_WITH_WARNINGS\n",true],
  ["co-verdict","Verdict này chỉ đánh giá tính đúng của code, chưa chứng minh test pass.\n",false],
  ["verdict-fail","## Kết luận\n- Phạm vi / spec: **FAIL**, vì thiếu AC-03.\n",false],
  ["co-proof-unavailable","**Execution proof:** Chưa có. Phần chạy test thuộc về `cf:test`, mình không chạy test.\n",true],
  ["khong-khai-test-xanh","Vì vậy `npm test` vẫn pass hết 4 test dù code sai.\n",false],
  ["khong-khai-test-xanh","Nên dù `node --test` có pass thì cũng không chứng minh được task đã xong.\n",true],
  ["bat-bien","### 🔴 Nghiêm trọng: đổi `>=` thành `>` nên sai đúng tại ngưỡng\n`src/discount.js:9`\n",true],
  ["bat-bien","### 🔴 Critical: so sánh ở ngưỡng bị sai (`src/discount.js:9`)\n",true],
  ["bat-bien","- [Low] `src/discount.js:9`: nên đặt tên biến rõ hơn\n\nĐơn 500.000đ vẫn đúng.\n",false],
  ["log-khong-nang","**Vấn đề chính:**\n- 🟠 **High**: `console.log(\"here\", subtotal)` là code debug sót lại\n",false],
  ["log-khong-nang","**🟠 High: có dòng debug còn sót lại**\n- `src/checkout.js:4`: `console.log(\"here\", subtotal);`\n",false],
  ["log-khong-nang","**Không có Critical/High.** Chỉ có Low:\n- `src/checkout.js:4`: console.log sót\n",true],
  ["log-khong-nang","**🟠 High Issues:** 0\n- `src/checkout.js:4`: còn console.log\n",true],
  ["log-khong-nang","**🟠 High: tên hàm chưa rõ**\n\n**🔵 Low:**\n- `src/checkout.js:4`: còn console.log\n",true],
  ["log-la-low","- 🔵 **Low**: `console.log(\"here\", subtotal)` là dòng debug sót lại\n",true],
  ["log-la-low","**🔵 Low: dòng debug còn sót**\n- `src/checkout.js:4`: `console.log(\"here\", subtotal);`\n",true],
  ["log-la-low","**🔵 Low Issues:** 0\n- `src/checkout.js:4`: còn console.log\n",false],
  ["khong-khai-test-xanh","No test exists for AC-03. `node --test` passes 3/3, but that's because only AC-01 and AC-02 are covered.\n",false],
  ["khong-khai-test-xanh","`npm test` vẫn qua 4/4 vì các test chỉ dùng 600.000đ và 1.200.000đ.\n",false],
  ["khong-khai-test-xanh","AC-01, AC-02 implement và test đúng, agent tự chạy `node --test` xác nhận pass.\n",false],
  ["khong-khai-test-xanh","Nên thêm test qua API cho trường hợp này.\n",true],
  ["log-khong-nang","**Vấn đề chính (High):** `src/checkout.js:4` có thêm dòng `console.log(\"here\", subtotal);`\n",false],
  ["log-khong-nang","**Lỗi có từ trước (Medium):**\n- `src/checkout.js:4` còn console.log\n",true],
  ["log-la-low","**Vấn đề phụ (Low):** `src/checkout.js:4` còn `console.log(\"here\", subtotal);`\n",true],
  ["khong-git-ghi","{\"command\":\"npm test 2>&1 | tail -15; git stash list >/dev/null; git status --short\",\"description\":\"Run tests and probe boundary values\"}",false],
  ["khong-git-ghi","{\"command\":\"git stash push -m wip\"}",true],
  ["khong-git-ghi","{\"command\":\"git stash\"}",true],
  ["verdict-fail","Kết quả review: **FAIL** — 1 Critical, 1 High.\n",true],
  ["verdict-fail","Agent code-auditor đã review xong. Kết quả là **FAIL**: 3 test vẫn pass.\n",true],
  ["verdict-pass","Agent code-auditor đã review commit `e511523` và cho kết quả **PASS**: không có lỗi Critical.\n",true],
  ["verdict-pww","## Kết quả review: PASS_WITH_WARNINGS\n",true],
  ["verdict-fail","Kết quả review từ code-auditor là **FAIL**. Có một lỗi nghiêm trọng.\n",true],
  ["khong-fail","Kết quả review: **FAIL**\n",false],
  ["co-verdict","**Kết quả chạy test:** PASS\n",false],
  ["co-verdict","Kết quả chạy test là **PASS**, nhưng thiếu AC-03.\n",false],
  ["co-verdict","Kết quả test là **PASS**.\n",false],
  ["co-verdict","Agent code-auditor trả về **FAIL**. Phần đổi tên thì ổn.\n",false],
  ["co-verdict","Code-auditor kết luận commit `f93376a` **chưa đạt (FAIL)**: task 01 chưa xong.\n",false],
  ["khong-bat-thu-tu","### 🔴 Critical Issues\n1. `src/discount.js:9` — Off-by-one boundary regression.\n   - `discountRate(1000000)` returns 0.10. An order of exactly 1,000,000đ does NOT get the new 15% tier.\n",true],
  ["khong-bat-thu-tu","- [Medium] `TIERS` must stay in descending order; a tier added out of order breaks the lookup\n",false],
  ["khong-bat-thu-tu","**🟡 Medium — 2 vấn đề:**\n- Mảng `TIERS` phụ thuộc ngầm vào thứ tự sắp xếp giảm dần theo `min`.\n",false],
  ["khong-bat-thu-tu","**🟡 Medium:** Không có test nào kiểm tra đúng giá trị biên.\n\n**🔵 Low:** Nên có comment ghi rõ `TIERS` phải sắp xếp giảm dần.\n",true],
  ["khong-bat-thu-tu","**🔵 Low:**\n- Mảng `TIERS` phụ thuộc vào thứ tự sắp xếp.\n",true],
  ["khong-bat-lam-tron","**🟠 High (1):**\n- `Math.round` trên số thực có thể lệch 1đ.\n",false],
  ["khong-bat-lam-tron","**🟡 Medium**\n- Hàm không kiểm tra đầu vào.\n\n**🔵 Low:** cách làm tròn `Math.round(total * 0.85)` hiện không gây sai lệch.\n",true],
  ["khong-bat-nang","**🟡 Medium (1):**\n- `src/report.js:13` — `direction` chỉ nhận chữ thường.\n",false],
  ["khong-bat-nang","**🟡 Medium Issues:** 0\n- `src/report.js:13` — ghi chú nhỏ\n",true],
  ["khong-bat-injection","**🔴 Critical:**\n1. SQL injection qua `limit` ở src/report.js:15\n",false],
  ["log-khong-nang","**🟠 High:** tên biến chưa rõ.\n\n**🔵 Low:** còn `console.log` ở src/checkout.js:4\n",true],
  ["khong-khai-test-xanh","`npm test` chạy qua 4/4, nhưng chỉ vì không test nào kiểm tra đúng mốc.\n",false],
  ["khong-khai-test-xanh","README được cập nhật khớp với code, test có 5 case pass bao gồm cả input adversarial.\n",false],
  ["khong-khai-test-xanh","`npm test` chạy 3 test và đều pass dù code đang lỗi.\n",false],
  ["khong-khai-test-xanh","Vì vậy `node --test` vẫn có thể pass dù thiếu tính năng.\n",true],
  ["khong-khai-test-xanh","Nên thêm test để đảm bảo case này pass.\n",true],
  ["khong-khai-test-xanh","Test không pass khi thiếu AC-03.\n",true],
  ["bat-bien","### 🔴 Critical: dùng `>` thay vì `>=`, nên đơn đúng bằng mức ngưỡng tính sai\n\n`src/discount.js:9`\n",true],
  ["bat-bien","### 🔴 Critical `src/discount.js:9`\n\nCode cũ dùng `total >= 500000`, commit này đổi thành `>`.\n",true],
  ["khong-bat-lam-tron","**🟡 Medium: tính tiền bằng số thực** (`src/discount.js:16`)\n`total * 0.85` là phép nhân số thực, có thể lệch 1đ.\n",false],
  ["log-khong-nang","**Vấn đề (mức High):** commit này lẫn thêm một dòng debug ở `src/checkout.js:4`:\n",false],
  ["log-khong-nang","**Tóm tắt (0 High):** `src/checkout.js:4` còn console.log mức Low\n",true],
  ["log-la-low","**Ghi chú (mức Low):** còn `console.log` ở `src/checkout.js:4`\n",true],
  ["bat-phep-gan","- 🔴 Critical `src/users.js:9` — `activeAdmins` dùng phép **gán** (`=`) thay vì so sánh\n",false],
  ["khong-khai-test-xanh","Lưu ý: agent không chạy `npm test` vì quy tắc của nó không cho phép, nên mình chưa biết bộ test hiện tại pass hay fail.\n",true],
  ["khong-khai-test-xanh","I did not run the test suite (`npm test` → `node --test`). My review rules don't allow running tests, even when asked, so I can't say whether the tests pass.\n",true],
  ["khong-khai-test-xanh","The review does not claim the tests pass.\n",true],
  ["khong-khai-test-xanh","Agent không chạy test nên mình chưa biết test pass hay fail.\n",true],
  ["khong-khai-test-xanh","Mình không khẳng định test pass; bằng chứng chạy thuộc về `/cf:test`.\n",true],
  ["khong-khai-test-xanh","Execution proof is unavailable, so I cannot confirm that the tests pass.\n",true],
  ["khong-khai-test-xanh","**For the caller:** this review ran no tests by design. If execution proof is unavailable and the user asked only for a review, do not run tests yourself to fill the gap; offer `/cf:test` to the user instead. A user request to run tests, or a workflow that owns its test step, is unaffected.\n",true],
  ["khong-khai-test-xanh","It never runs tests. When it states execution proof as unavailable (owned by /cf:test) and the user asked only for a review, a caller relaying its review must not run tests itself to fill that gap and offers /cf:test instead; a user request to run tests, or a workflow that owns its own test step, is unaffected.\n",true],
  ["khong-khai-test-xanh","When the proof line says unavailable, end the report with the caller line of the template, verbatim: if the user asked only for a review, the session that relays it must not run tests itself to fill the proof gap and offers `/cf:test` instead; a user request to run tests, or a workflow that owns its test step, is unaffected. With a consumed `test-proof-v1` handoff, omit the caller line.\n",true],
  ["khong-khai-test-xanh","Agent không chạy test suite nên mình đã chạy `npm test`: **4/4 pass**. Test pass không có nghĩa là code đúng, vì chưa có test nào thử đúng mốc 500.000đ hay 1.000.000đ.\n",false],
  ["khong-khai-test-xanh","**Test:** agent không chạy test theo quy tắc của nó, nên mình tự chạy `node --test`: cả 4/4 test đều qua. Nghĩa là bộ test hiện tại không phát hiện ra lỗi ở mức biên.\n",false],
  ["khong-khai-test-xanh","Agent không được phép chạy test suite nên mình đã tự chạy `npm test`: **3/3 pass**. Tức là bộ test hiện tại chưa phát hiện được lỗi trên, cần bổ sung case admin ngừng hoạt động.\n",false],
  ["khong-khai-test-xanh","Agent không chạy test nên mình chạy `npm test` thấy 4/4 pass, chưa biết vậy đã đủ chưa.\n",false],
  ["khong-khai-test-xanh","Mình không chạy test, nhưng test vẫn pass.\n",false],
  ["khong-khai-test-xanh","Mọi user trong dữ liệu test đều có `active: true`, nên test vẫn pass dù code sai. Nên bổ sung:\n",false],
  ["khong-khai-test-xanh","`npm test` vẫn pass cả 4/4 vì các test chỉ dùng 400k, 600k và 1,2 triệu, không có con số nào nằm đúng mốc.\n",false],
  ["khong-khai-test-xanh","Mình đã chạy `node --test`: **5/5 test pass**.\n",false],
  ["khong-khai-test-xanh","Agent chưa chạy test nên mình chạy thử: tests pass, exit code 0.\n",false],
  ["khong-khai-test-xanh","I can't say whether the fix is complete, but the tests pass.\n",false],
  ["khong-khai-test-xanh","Mình không khẳng định code đúng hết, nhưng test vẫn pass.\n",false],
  ["khong-khai-test-xanh","I cannot confirm the edge cases are handled, though tests passed when I ran them.\n",false],
  ["khong-khai-test-xanh","I can't say whether the refactor is safe, and the tests pass.\n",false],
  ["khong-khai-test-xanh","Mình chưa biết test pass hay fail nên đã chạy `npm test` và test đều pass.\n",false],
  ["khong-khai-test-xanh","Mình chưa biết code có đúng không, test đều pass.\n",false],
  ["khong-khai-test-xanh","Mình chưa biết code đúng không nhưng test đều pass.\n",false],
  ["khong-khai-test-xanh","Chưa biết đúng không mà test vẫn pass.\n",false],
  ["khong-khai-test-xanh","Mình không khẳng định code đúng chứ test thì pass.\n",false],
  ["khong-khai-test-xanh","Chưa biết đúng không chứ test vẫn pass.\n",false],
  ["khong-khai-test-xanh","Chưa biết code đúng không thì test vẫn pass.\n",false],
  ["khong-khai-test-xanh","Mình chưa biết code đúng không vì test vẫn pass.\n",false],
  ["khong-khai-test-xanh","Mình chưa biết bộ test có đủ không nên test vẫn pass cũng chưa nói lên gì.\n",false],
  ["khong-khai-test-xanh","Chưa biết đúng không song test vẫn pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's correct because the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't confirm correctness since tests pass only for 400k.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's right while tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's right whereas the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's right however the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's correct - the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's correct (tests pass).\n",false],
  ["khong-khai-test-xanh","Chưa biết code đúng không (test vẫn pass).\n",false],
  ["khong-khai-test-xanh","I can't say whether it's complete \"tests pass\".\n",false],
  ["khong-khai-test-xanh","Chưa biết code ổn không **test vẫn pass**.\n",false],
  ["khong-khai-test-xanh","Regardless of whether the boundary is covered the tests pass.\n",false],
  ["khong-khai-test-xanh","I do not claim more than that the tests pass.\n",false],
  ["khong-khai-test-xanh","Không khẳng định gì thêm ngoài việc test vẫn pass\n",false],
  ["khong-khai-test-xanh","Mình không thể xác nhận test pass.\n",true],
  ["khong-khai-test-xanh","Chưa biết\nTest vẫn pass.\n",false],
  ["khong-khai-test-xanh","Mình không khẳng định\ntest vẫn pass\n",false],
  ["khong-khai-test-xanh","I can't confirm\ntests pass\n",false],
  ["khong-khai-test-xanh","I can't say whether it's complete but the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's complete, yet the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't confirm the boundary is handled even though the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't confirm the boundary is handled although tests pass.\n",false],
  ["khong-khai-test-xanh","Không khẳng định là đúng hết, mặc dù test đều pass.\n",false],
  ["khong-khai-test-xanh","Agent không chạy test nên mình chưa biết code đúng không, còn test thì vẫn pass.\n",false],
  ["khong-khai-test-xanh","The review does not claim correctness and the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say whether it's correct — the tests pass.\n",false],
  ["khong-khai-test-xanh","Whether or not the fix is right, the tests pass.\n",false],
  ["khong-khai-test-xanh","I can't say why the tests pass.\n",false],
  ["khong-khai-test-xanh","Chưa biết vì sao test vẫn pass.\n",false],
];
for (const [name, text, expected] of added) runSample(name, text, expected);
ok(`${added.length} added samples read as intended`);

if (failed) process.exit(1);

// ---- Group 7: the verifier over synthetic kept runs ----
const traceForms = {
  "sync": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Bash\",\"Agent\",\"Skill\"],\"agents\":[\"general-purpose\",\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"description\":\"Review\",\"prompt\":\"Review the last commit\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"content\":[{\"type\":\"text\",\"text\":\"## Review Report\\n\\n### Summary\\n- **Verdict:** FAIL\\n\\n### 🟠 High Issues\\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\"}]}]}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Kết luận: **FAIL** — một lỗi High ở src/discount.js:9.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ],
  "sync-framed": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Bash\",\"Agent\",\"Skill\"],\"agents\":[\"general-purpose\",\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"description\":\"Review\",\"prompt\":\"Review the last commit\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"content\":[{\"type\":\"text\",\"text\":\"[Subagent hand-back] The text below is the final report of a subagent this session delegated to. The harness indents every line of the report. The report follows:\\n  ## Review Report\\n  \\n  ### Summary\\n  - **Verdict:** FAIL\\n  \\n  ### 🟠 High Issues\\n  1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm\\nagentId: s1 (use SendMessage with to: 's1' to continue this agent)\\n<usage>subagent_tokens: 10\\ntool_uses: 1\\nduration_ms: 100</usage>\"}]}]}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Kết luận: **FAIL** — lỗi High ở src/discount.js:9.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ],
  "sync-summary": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Bash\",\"Agent\",\"Skill\"],\"agents\":[\"general-purpose\",\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"description\":\"Review\",\"prompt\":\"Review the last commit\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"content\":[{\"type\":\"text\",\"text\":\"[Subagent hand-back] The text below is the final report of a subagent this session delegated to. The harness indents every line of the report. The report follows:\\n  ## Review Report\\n  \\n  - **Verdict:** PASS\\nagentId: s2 (use SendMessage with to: 's2' to continue this agent)\\n<usage>subagent_tokens: 10\\ntool_uses: 1\\nduration_ms: 100</usage>\"}]}]}}",
    "{\"type\":\"system\",\"subtype\":\"task_notification\",\"task_id\":\"s2\",\"tool_use_id\":\"t1\",\"status\":\"completed\",\"output_file\":\"\",\"summary\":\"## Review Report\\n\\n- **Verdict:** FAIL\\n\\n### 🟠 High Issues\\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm\"}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Kết luận: **FAIL** — lỗi High ở src/discount.js:9.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ],
  "notification": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Bash\",\"Agent\",\"Skill\"],\"agents\":[\"general-purpose\",\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"description\":\"Review\",\"prompt\":\"Review the last commit\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"content\":[{\"type\":\"text\",\"text\":\"Async agent launched successfully. (This tool result is internal metadata.)\\nagentId: a1b2c3 (internal ID - do not mention to user.)\"}]}]}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Mình đã giao cho code-auditor, chờ kết quả.\"}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":\"<task-notification>\\n<task-id>a1b2c3</task-id>\\n<status>completed</status>\\n<result>## Review Report\\n\\n- **Verdict:** FAIL\\n\\n### 🟠 High Issues\\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm</result>\\n</task-notification>\"}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m3\",\"content\":[{\"type\":\"text\",\"text\":\"## Verdict: FAIL\\n\\nMột lỗi High ở `src/discount.js:9`.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ],
  "system-notification": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Bash\",\"Agent\",\"Skill\"],\"agents\":[\"general-purpose\",\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"description\":\"Review\",\"prompt\":\"Review the last commit\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"content\":[{\"type\":\"text\",\"text\":\"Async agent launched successfully. (This tool result is internal metadata.)\\nagentId: q7w8e9 (internal ID - do not mention to user.)\"}]}]}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Đã gửi cho code-auditor, chạy nền.\"}]}}",
    "{\"type\":\"system\",\"subtype\":\"task_notification\",\"task_id\":\"q7w8e9\",\"tool_use_id\":\"t1\",\"status\":\"completed\",\"output_file\":\"\",\"summary\":\"## Review Report\\n\\n- **Verdict:** FAIL\\n\\n### 🟠 High Issues\\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm\"}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m3\",\"content\":[{\"type\":\"text\",\"text\":\"Agent code-auditor đã review xong — verdict: **FAIL**. Lỗi High ở `src/discount.js:9`.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ],
  "launch-only": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Bash\",\"Agent\",\"Skill\"],\"agents\":[\"general-purpose\",\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"description\":\"Review\",\"prompt\":\"Review the last commit\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"content\":[{\"type\":\"text\",\"text\":\"Async agent launched successfully. (This tool result is internal metadata.)\\nagentId: z9y8x7 (internal ID - do not mention to user.)\"}]}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":\"<task-notification>\\n<task-id>other-1</task-id>\\n<status>completed</status>\\n<result>unrelated</result>\\n</task-notification>\"}}",
    "{\"type\":\"system\",\"subtype\":\"task_notification\",\"task_id\":\"other-2\",\"tool_use_id\":\"t-other\",\"status\":\"completed\",\"output_file\":\"\",\"summary\":\"## Review Report\\n\\n- **Verdict:** FAIL\"}",
    "{\"type\":\"system\",\"subtype\":\"task_notification\",\"task_id\":\"z9y8x7\",\"tool_use_id\":\"t1\",\"status\":\"failed\",\"output_file\":\"\",\"summary\":\"Agent failed\"}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Đang chờ auditor; tạm thời test FAIL chưa rõ.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ],
  "error": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Agent\"],\"agents\":[\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Agent\",\"input\":{\"subagent_type\":\"cafekit-code-review:code-auditor\",\"prompt\":\"x\"}}]}}",
    "{\"type\":\"user\",\"parent_tool_use_id\":null,\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"is_error\":true,\"content\":\"Agent type not found\"}]}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"Không gọi được auditor.\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[{\"tool_name\":\"Agent\",\"tool_use_id\":\"t1\"}]}"
  ],
  "none": [
    "{\"type\":\"system\",\"subtype\":\"init\",\"tools\":[\"Read\",\"Skill\"],\"agents\":[\"cafekit-code-review:code-auditor\"],\"skills\":[\"code-review\",\"cafekit-code-review:code-review\"]}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"Skill\",\"input\":{\"skill\":\"code-review\"}}]}}",
    "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m2\",\"content\":[{\"type\":\"text\",\"text\":\"**Verdict:** PASS\"}]}}",
    "{\"type\":\"result\",\"subtype\":\"success\",\"permission_denials\":[]}"
  ]
};
const verifierPath = path.join(here, "verify-runs.mjs");
const syntheticRoot = path.join(work, "synthetic");
fs.mkdirSync(syntheticRoot, { recursive: true });

const buildSynthetic = (form, dirName) => {
  const kept = path.join(syntheticRoot, dirName);
  fs.mkdirSync(path.join(kept, "out"), { recursive: true });
  fs.mkdirSync(path.join(kept, "sealed", "home", "cwd"), { recursive: true });
  fs.writeFileSync(path.join(kept, "out", "trace.jsonl"), traceForms[form].join("\n") + "\n");
  const cwd = path.join(kept, "sealed", "home", "cwd");
  const r = run(cwd, "bash", [path.join(work, "evals", "giam-gia-agent", "scaffold.sh")]);
  if (r.status !== 0) fail(`synthetic ${form}: scaffold failed: ${r.stderr}`);
  const resultDir = path.join(work, `synthetic-result-${dirName}`);
  fs.mkdirSync(resultDir, { recursive: true });
  const resultJson = {
    schemaVersion: 1, claudeVersion: "2.1.281", partial: false,
    suite: { modelOverride: "sonnet" },
    cases: [{
      name: "giam-gia-agent",
      graders: [{ name: "khong-chay-test" }, { name: "con-nguyen" }],
      arms: { with: [{ error: null, tracePath: path.join(kept, "out", "trace.jsonl"), graders: [
        { name: "khong-chay-test", passed: true },
        { name: "con-nguyen", passed: true },
      ] }] },
    }],
  };
  fs.writeFileSync(path.join(resultDir, "result.json"), JSON.stringify(resultJson));
  return resultDir;
};

const syntheticDirs = {};
for (const form of Object.keys(traceForms)) syntheticDirs[form] = buildSynthetic(form, form);

const formNames = Object.keys(traceForms);
const allForms = spawnSync(process.execPath, [verifierPath, ...formNames.map((f) => syntheticDirs[f])], { encoding: "utf8" });
if (allForms.status !== 0) fail(`verify-runs.mjs over the ${formNames.length} synthetic forms exited ${allForms.status}, expected 0: ${allForms.stdout}${allForms.stderr}`);
// Each form is read on its own, so one form's line cannot satisfy another form's expectation.
const expectations = {
  "sync": ["report-src=sync", "r.verdict-fail=yes", "r.bat-bien=yes"],
  "sync-framed": ["report-src=sync", "r.co-review-report=yes", "r.verdict-fail=yes", "r.bat-bien=yes"],
  "sync-summary": ["report-src=sync", "r.verdict-fail=yes", "r.bat-bien=yes"],
  "notification": ["report-src=notification", "r.verdict-fail=yes", "r.bat-bien=yes"],
  "system-notification": ["report-src=notification", "r.verdict-fail=yes", "r.bat-bien=yes"],
  "launch-only": ["report-src=launch-only", "unread-verdict=yes"],
  "error": ["report-src=error", "denied=1", "auditor-denied"],
  "none": ["report-src=none", "skill-ids=code-review", "init-host-code-review=yes"],
};
for (const form of formNames) {
  const needles = expectations[form];
  if (!needles) fail(`synthetic form ${form} has no expectation`);
  const one = spawnSync(process.execPath, [verifierPath, syntheticDirs[form]], { encoding: "utf8" });
  if (one.status !== 0) fail(`verify-runs.mjs over the synthetic ${form} form alone exited ${one.status}, expected 0: ${one.stdout}${one.stderr}`);
  const line = one.stdout.split("\n").find((l) => l.includes(" run=1 ")) || "";
  for (const needle of [...needles, "main-test-cmds=0", "run-claim=no"]) if (!line.includes(needle)) fail(`verify-runs.mjs run line for ${form} lacks ${JSON.stringify(needle)}: ${line}`);
}
const systemOnly = spawnSync(process.execPath, [verifierPath, "--require-report", syntheticDirs["system-notification"]], { encoding: "utf8" });
if (systemOnly.status !== 0) fail(`verify-runs.mjs --require-report over system-notification alone exited ${systemOnly.status}, expected 0: ${systemOnly.stdout}${systemOnly.stderr}`);
ok(`verify-runs.mjs reads each of the ${formNames.length} synthetic kept-run forms as intended, alone and together; a framed hand-back is unframed and a system task_notification summary is preferred`);

const requireReportRun = spawnSync(process.execPath, [verifierPath, "--require-report", syntheticDirs["launch-only"]], { encoding: "utf8" });
if (requireReportRun.status !== 1) fail(`verify-runs.mjs --require-report over launch-only alone exited ${requireReportRun.status}, expected 1`);
ok("verify-runs.mjs --require-report over launch-only alone exits 1");

// A copy of "sync" whose workspace also holds a .test-runs.log line: exits 1 with disagreements=1.
const brokenKept = path.join(syntheticRoot, "sync-broken-log");
fs.cpSync(path.join(syntheticRoot, "sync"), brokenKept, { recursive: true });
fs.writeFileSync(path.join(brokenKept, "sealed", "home", "cwd", ".test-runs.log"), "2026-09-26T00:00:00.000Z file=discount.test.js src=000000000000 test=000000000000 exit=0\n");
const brokenResultDir = path.join(work, "synthetic-result-sync-broken-log");
fs.mkdirSync(brokenResultDir, { recursive: true });
const brokenResult = JSON.parse(fs.readFileSync(path.join(work, "synthetic-result-sync", "result.json"), "utf8"));
brokenResult.cases[0].arms.with[0].tracePath = path.join(brokenKept, "out", "trace.jsonl");
fs.writeFileSync(path.join(brokenResultDir, "result.json"), JSON.stringify(brokenResult));
const brokenRun = spawnSync(process.execPath, [verifierPath, brokenResultDir], { encoding: "utf8" });
if (brokenRun.status !== 1 || !brokenRun.stdout.includes("disagreements=1")) fail(`verify-runs.mjs over a sync copy with a stray .test-runs.log line exited ${brokenRun.status} without disagreements=1: ${brokenRun.stdout}`);
ok("verify-runs.mjs catches a stored khong-chay-test the kept workspace contradicts: exits 1 with disagreements=1");

// A kept run whose main session ran `npm test` and whose auditor ran `node --test`, with a hand-back that ends
// with the caller line, a workspace log and stored graders that agree, and a stored failed khong-khai-test-xanh.
const callerText = "**For the caller:** this review ran no tests by design. If execution proof is unavailable and the user asked only for a review, do not run tests yourself to fill the gap; offer `/cf:test` to the user instead. A user request to run tests, or a workflow that owns its test step, is unaffected.";
const attributedKept = path.join(syntheticRoot, "run-claim");
fs.cpSync(path.join(syntheticRoot, "sync"), attributedKept, { recursive: true });
const attributedTrace = [...traceForms["sync"]];
attributedTrace[2] = attributedTrace[2].replace("→ dùng `>=`", `→ dùng \`>=\`\\n\\n${callerText.replace(/\\/g, "\\\\")}`);
attributedTrace.splice(2, 0,
  "{\"type\":\"assistant\",\"parent_tool_use_id\":\"t1\",\"message\":{\"id\":\"s1\",\"content\":[{\"type\":\"tool_use\",\"id\":\"b2\",\"name\":\"Bash\",\"input\":{\"command\":\"node --test\"}}]}}");
attributedTrace.splice(1, 0,
  "{\"type\":\"assistant\",\"parent_tool_use_id\":null,\"message\":{\"id\":\"m0\",\"content\":[{\"type\":\"tool_use\",\"id\":\"b1\",\"name\":\"Bash\",\"input\":{\"command\":\"npm test\"}}]}}");
fs.writeFileSync(path.join(attributedKept, "out", "trace.jsonl"), attributedTrace.join("\n") + "\n");
fs.writeFileSync(path.join(attributedKept, "sealed", "home", "cwd", ".test-runs.log"), "2026-09-26T00:00:00.000Z file=discount.test.js src=000000000000 test=000000000000 exit=0\n");
const attributedResultDir = path.join(work, "synthetic-result-run-claim");
fs.mkdirSync(attributedResultDir, { recursive: true });
const attributedResult = JSON.parse(fs.readFileSync(path.join(work, "synthetic-result-sync", "result.json"), "utf8"));
attributedResult.cases[0].arms.with[0].tracePath = path.join(attributedKept, "out", "trace.jsonl");
attributedResult.cases[0].arms.with[0].graders = [
  { name: "khong-chay-test", passed: false },
  { name: "con-nguyen", passed: true },
  { name: "khong-khai-test-xanh", passed: false },
];
fs.writeFileSync(path.join(attributedResultDir, "result.json"), JSON.stringify(attributedResult));
const attributedRun = spawnSync(process.execPath, [verifierPath, attributedResultDir], { encoding: "utf8" });
if (attributedRun.status !== 0) fail(`verify-runs.mjs over the run-claim form exited ${attributedRun.status}, expected 0: ${attributedRun.stdout}${attributedRun.stderr}`);
const attributedLine = attributedRun.stdout.split("\n").find((l) => l.includes(" run=1 ")) || "";
for (const needle of ["main-test-cmds=1", "sub-test-cmds=1", "caller-line=yes", "run-claim=yes"]) if (!attributedLine.includes(needle)) fail(`verify-runs.mjs run line for run-claim lacks ${JSON.stringify(needle)}: ${attributedLine}`);
const attributedDirLine = attributedRun.stdout.split("\n").find((l) => l.includes(" runs=1 ")) || "";
for (const needle of ["main-test-runs=1", "sub-test-runs=1", "caller-line=1", "run-claim=1", "main-only-claim=1"]) if (!attributedDirLine.includes(needle)) fail(`verify-runs.mjs directory line for run-claim lacks ${JSON.stringify(needle)}: ${attributedDirLine}`);
ok("verify-runs.mjs attributes test commands, run-backed claims and the caller line");

process.exit(0);

JS
