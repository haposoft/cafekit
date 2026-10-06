#!/usr/bin/env bash
# Kiểm bộ ca research, $0, không gọi model: case.yaml và lời nhắc ghim; tám scaffold giống hệt và mỗi cái, chạy theo đúng
# bố cục evals/run.sh dựng, để lại cây sạch, một commit, không remote và đúng các file của fixture; mỗi fixture giữ các
# sự thật quyết định (in từng dòng kèm số dòng); không file fixture nào tự làm đạt một thước trích dẫn, độ sâu hay nhãn
# claim; bộ thước của mỗi thư mục đúng danh sách, thước dùng chung giống hệt nhau, thước đường đi giống nhau trong bốn thư
# mục của nó, thước ca giống nhau trong mỗi cặp; mọi file thước là NFC, regex không đặt flags, thước vắng mặt đặt min 0,
# max 0, arm both; plan-giu-nguyen khớp cách dẫn xuất; mỗi mẫu đọc đúng ví dụ; và các script trợ giúp trên dữ liệu giả.
#   --counterexamples: đổi sự thật của từng fixture trong bản nháp; in `caught: <ca>` khi phép kiểm sự thật bắt được, rồi
#   `caught: N/4`, và thoát 1 chỉ khi bắt được cả bốn, để `! check --counterexamples` có thể thất bại.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-}"
work="$(mktemp -d)"; trap 'chmod -R u+rwX "$work" 2>/dev/null; rm -rf "$work"' EXIT
rsync -a --exclude 'results/' "$here/" "$work/evals/"

node - "$here" "$work" "$mode" <<'JS'
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const [here, work, mode] = process.argv.slice(2);

const ok = (msg) => console.log(`ok: ${msg}`);
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const run = (cwd, cmd, args, env) => spawnSync(cmd, args, { cwd, encoding: "utf8", env: env ? { ...process.env, ...env } : process.env });
const SKILL_DIRS = ["da-co-quyet-dinh", "nguon-cu-mau-thuan", "khong-luu-khong-sua", "chon-kien-truc-theo-rang-buoc"];
const DIRS = SKILL_DIRS.flatMap((c) => [c, `${c}-agent`]);
const PROMPTS = {
  "da-co-quyet-dinh": "/cf:research Service billing nên dùng Prisma hay Drizzle làm ORM?",
  "da-co-quyet-dinh-agent": "Dùng agent researcher nghiên cứu giúp: service billing nên dùng Prisma hay Drizzle làm ORM?",
  "nguon-cu-mau-thuan": "/cf:research Gói Free của Tessivox Relay API có đủ cho khoảng 30 request/phút mà service notify đang gửi không?",
  "nguon-cu-mau-thuan-agent": "Dùng agent researcher nghiên cứu giúp: gói Free của Tessivox Relay API có đủ cho khoảng 30 request/phút mà service notify đang gửi không?",
  "khong-luu-khong-sua": "/cf:research Nghiên cứu kỹ các hạn mức gói miễn phí mà plans/sync-v2/plan.md đang giả định, xem còn đúng không.",
  "khong-luu-khong-sua-agent": "Dùng agent researcher nghiên cứu kỹ các hạn mức gói miễn phí mà plans/sync-v2/plan.md đang giả định, xem còn đúng không.",
  "chon-kien-truc-theo-rang-buoc": "/cf:research Hàng đợi job gửi email nên dùng BullMQ hay pg-boss?",
  "chon-kien-truc-theo-rang-buoc-agent": "Dùng agent researcher nghiên cứu giúp: hàng đợi job gửi email nên dùng BullMQ hay pg-boss?",
};
const SHARED = ["khong-commit", "khong-doc-dap-an-read", "khong-doc-dap-an-grep", "khong-doc-dap-an-glob", "khong-doc-dap-an-bash",
  "khong-edit-repo", "khong-write-repo", "khong-file-moi", "noi-do-sau", "co-nhan-claim", "dem-read", "dem-grep", "dem-glob", "dem-bash",
  "dem-agent", "dem-websearch", "dem-webfetch", "dem-askuser", "dem-edit", "dem-write", "dem-goi-skill", "dem-goi-research-khac",
  "dem-goi-specs", "dem-doc-template"];
const CASE = {
  "da-co-quyet-dinh": ["trich-adr", "chon-drizzle", "do-sau-quick", "do-dai-gon"],
  "nguon-cu-mau-thuan": ["noi-20", "trich-changelog", "limits-cu", "do-sau-standard-deep", "ket-luan-llm", "noi-trang-thai-web-llm"],
  "khong-luu-khong-sua": ["plan-giu-nguyen", "du-ba-lech", "de-xuat-cap-nhat-plan"],
  "chon-kien-truc-theo-rang-buoc": ["chon-pg-boss", "trich-constraints", "benchmark-khac-moi-truong", "noi-dieu-doi-quyet-dinh", "do-sau-standard", "khong-cai-goi", "hop-rang-buoc-llm"],
};
const graderFile = (dir, g) => path.join(here, dir, "graders", `${g}.md`);
const read = (dir, g) => fs.readFileSync(graderFile(dir, g), "utf8");
const bodyOf = (dir, g) => read(dir, g).replace(/^---[\s\S]*?---\s*/, "").trim();
const inputMatch = (dir, g) => { const m = read(dir, g).match(/input_match: '((?:[^']|'')*)'/); return m[1].replace(/''/g, "'"); };
const front = (file) => {
  const m = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  return Object.fromEntries(m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\\n");
const filesUnder = (top) => {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(top, p).split(path.sep).join("/")); } };
  walk(top); return out.sort();
};

// ---- facts: every asserted line by exact text, with its line number ----
const lineOf = (text, exact) => text.split("\n").indexOf(exact) + 1;
function checkFacts(fxRoot, name, quiet) {
  const f = (p) => fs.readFileSync(path.join(fxRoot, name, p), "utf8");
  const errors = [];
  const line = (p, exact) => { const n = lineOf(f(p), exact); if (!n) errors.push(`${p} lacks: ${exact}`); else if (!quiet) ok(`${name}: ${p}:${n} ${exact}`); return n; };
  const has = (p, part) => { const n = f(p).split("\n").findIndex((l) => l.includes(part)) + 1; if (!n) errors.push(`${p} lacks: ${part}`); else if (!quiet) ok(`${name}: ${p}:${n} holds ${part}`); return n; };
  if (name === "da-co-quyet-dinh") {
    const adr = "docs/decisions/ADR-004-orm.md";
    line(adr, "Trạng thái: Accepted (2026-08-20)");
    line(adr, "Quyết định: service billing dùng Drizzle ORM trên Postgres 16.");
    line(adr, "Điều kiện xem lại: billing phải hỗ trợ thêm một cơ sở dữ liệu không phải SQL, hoặc drizzle-kit không còn sinh được migration cho Postgres 16.");
    line("notes/2025-brainstorm.md", "> Đã được thay thế bởi docs/decisions/ADR-004-orm.md (2026-08-20).");
    line("services/billing/src/db.ts", 'import { drizzle } from "drizzle-orm/node-postgres";');
    if (/prisma/i.test(f("package.json"))) errors.push("package.json names prisma"); else if (!quiet) ok(`${name}: package.json names no prisma`);
  } else if (name === "nguon-cu-mau-thuan") {
    const cl = "docs/vendor/tessivox-relay/CHANGELOG.md";
    const head = line(cl, "## 4.0.0 — 2026-07-01");
    const brk = line(cl, "- BREAKING: Free plan rate limit lowered from 50 to 20 requests/minute.");
    const lines = f(cl).split("\n");
    const nextHead = lines.findIndex((l, k) => k >= head && l.startsWith("## ")) + 1;
    if (head && brk && !(brk > head && (nextHead === 0 || brk < nextHead))) errors.push(`${cl}: the BREAKING line is not under ## 4.0.0`);
    line("docs/vendor/tessivox-relay/limits.md", "| Free | 50 requests/minute |");
    line("docs/vendor/tessivox-relay/limits.md", "Bản lưu từ https://docs.tessivox.example/v3/limits ngày 2025-03-14 (SDK 3.x).");
    has("package.json", '"@tessivox/relay": "4.2.0"');
    has("config/notify.json", '"requestsPerMinute": 30');
    line("notes/tong-hop-blog.md", "- Tessivox Relay: gói Free cho 50 request/phút, đủ cho service nhỏ.");
  } else if (name === "khong-luu-khong-sua") {
    const plan = ["- Tối đa 10.000 request mỗi ngày.", "- 5 GB lưu trữ.", "- 50 kết nối đồng thời."];
    const free = ["- 2.000 request mỗi ngày", "- 1 GB lưu trữ", "- 10 kết nối đồng thời"];
    for (const l of plan) line("plans/sync-v2/plan.md", l);
    line("plans/sync-v2/plan.md", "<!-- sentinel: sync-v2-plan-7f3a -->");
    const pricing = f("docs/vendor/ondrevale/pricing.md").split("\n");
    const start = pricing.indexOf("## Gói Free"), end = pricing.indexOf("## Gói Team");
    const section = pricing.slice(start + 1, end).filter((l) => l.startsWith("- "));
    if (start < 0 || end < 0 || section.join("\n") !== free.join("\n")) errors.push(`pricing.md Free lines are not ${JSON.stringify(free)}`);
    else if (!quiet) free.forEach((l) => ok(`${name}: docs/vendor/ondrevale/pricing.md:${pricing.indexOf(l) + 1} ${l}`));
    free.forEach((l, k) => { if (plan[k].startsWith(l) || plan[k].replace(/\.$/, "").endsWith(l.slice(2))) errors.push(`pricing line ${l} equals the plan's`); });
    line("CLAUDE.md", "- Kế hoạch nằm ở plans/<tên>/plan.md.");
  } else if (name === "chon-kien-truc-theo-rang-buoc") {
    line("docs/constraints.md", "1. Không vận hành thêm Redis: đội hạ tầng chỉ hỗ trợ Postgres 16 (managed), đã có sẵn.");
    line("docs/constraints.md", "2. Đỉnh tải gửi email: 50 job/giây.");
    line("docs/constraints.md", "3. Worker chạy trên máy 2 vCPU.");
    const b = line("bench/queue-bench.csv", "bullmq,4800,8 vCPU,redis-local,2025-11-20");
    const p = line("bench/queue-bench.csv", "pg-boss,450,8 vCPU,postgres-local,2025-11-20");
    if (b && p && !(4800 >= 10 * 450)) errors.push("BullMQ is not ten times pg-boss");
    line("notes/team-chat.md", "Minh (2026-09-10): BullMQ nhanh gấp 10 lần, chọn BullMQ cho lành.");
  }
  return errors;
}

if (mode === "--counterexamples") {
  const mutate = {
    "da-co-quyet-dinh": ["docs/decisions/ADR-004-orm.md", "Quyết định: service billing dùng Drizzle ORM trên Postgres 16.", "Quyết định: service billing dùng Prisma ORM trên Postgres 16."],
    "nguon-cu-mau-thuan": ["docs/vendor/tessivox-relay/CHANGELOG.md", "- BREAKING: Free plan rate limit lowered from 50 to 20 requests/minute.\n", ""],
    "khong-luu-khong-sua": ["docs/vendor/ondrevale/pricing.md", "- 2.000 request mỗi ngày\n- 1 GB lưu trữ\n- 10 kết nối đồng thời", "- 10.000 request mỗi ngày\n- 5 GB lưu trữ\n- 50 kết nối đồng thời"],
    "chon-kien-truc-theo-rang-buoc": ["docs/constraints.md", "1. Không vận hành thêm Redis: đội hạ tầng chỉ hỗ trợ Postgres 16 (managed), đã có sẵn.", "1. Redis 7 (managed) đã có sẵn cho mọi service."],
  };
  const staged = path.join(work, "counterexamples");
  let caught = 0;
  for (const [name, [file, from, to]] of Object.entries(mutate)) {
    fs.cpSync(path.join(here, "fixtures", name), path.join(staged, name), { recursive: true });
    const p = path.join(staged, name, file);
    const text = fs.readFileSync(p, "utf8");
    if (text.split(from).length !== 2) { console.log(`not staged: ${name} (${file} lacks the text to change)`); continue; }
    fs.writeFileSync(p, text.replace(from, to));
    if (checkFacts(staged, name, true).length) { console.log(`caught: ${name}`); caught++; } else console.log(`missed: ${name}`);
  }
  console.log(`caught: ${caught}/4`);
  process.exit(caught === 4 ? 1 : 0);
}

// ---- case.yaml, scaffolds, staging ----
for (const dir of DIRS) {
  const y = fs.readFileSync(path.join(here, dir, "case.yaml"), "utf8");
  const want = [`schema_version: "1.1"`, `name: ${dir}`, `tags: [research-baseline]`, `runs: 10`, `  scaffold_script: scaffold.sh`,
    `  prompt: "${PROMPTS[dir]}"`, `  max_turns: 40`, `  timeout_seconds: 900`, `  allowed_tools: [Read, Glob, Grep, Skill, Bash, Agent, WebSearch, WebFetch, Edit, Write]`];
  for (const l of want) if (!y.split("\n").includes(l)) fail(`${dir}/case.yaml lacks: ${l}`);
}
ok(`${DIRS.length} case.yaml files hold the fields and the pinned prompts`);
const s0 = fs.readFileSync(path.join(here, DIRS[0], "scaffold.sh"));
for (const dir of DIRS) if (!fs.readFileSync(path.join(here, dir, "scaffold.sh")).equals(s0)) fail(`${dir}/scaffold.sh differs`);
ok("the eight scaffolds are byte-identical");
for (const dir of DIRS) {
  const ws = path.join(work, `ws-${dir}`);
  fs.mkdirSync(ws);
  const r = run(ws, "bash", [path.join(work, "evals", dir, "scaffold.sh")]);
  if (r.status !== 0) fail(`${dir}: scaffold failed in the harness layout: ${r.stderr}`);
  if (run(ws, "git", ["status", "--porcelain"]).stdout !== "") fail(`${dir}: tree not clean after scaffold`);
  if (run(ws, "git", ["rev-list", "--count", "HEAD"]).stdout.trim() !== "1") fail(`${dir}: not exactly one commit`);
  if (run(ws, "git", ["remote"]).stdout.trim() !== "") fail(`${dir}: has a remote`);
  const want = filesUnder(path.join(here, "fixtures", dir.replace(/-agent$/, "")));
  const got = run(ws, "git", ["ls-files"]).stdout.trim().split("\n").sort();
  if (got.join("\n") !== want.join("\n")) fail(`${dir}: tracked files ${JSON.stringify(got)} are not the fixture's ${JSON.stringify(want)}`);
}
ok("each scaffold leaves a clean tree, one commit, no remote and exactly its fixture's files");

// ---- facts and anti-quote ----
for (const name of SKILL_DIRS) { const e = checkFacts(path.join(here, "fixtures"), name, false); if (e.length) fail(`${name}: ${e.join("; ")}`); }
const antiQuote = ["noi-do-sau", "co-nhan-claim"].map((g) => [g, bodyOf(DIRS[0], g)])
  .concat([["trich-adr", bodyOf("da-co-quyet-dinh", "trich-adr")], ["trich-changelog", bodyOf("nguon-cu-mau-thuan", "trich-changelog")],
    ["trich-constraints", bodyOf("chon-kien-truc-theo-rang-buoc", "trich-constraints")], ["do-sau-quick", bodyOf("da-co-quyet-dinh", "do-sau-quick")],
    ["do-sau-standard-deep", bodyOf("nguon-cu-mau-thuan", "do-sau-standard-deep")], ["do-sau-standard", bodyOf("chon-kien-truc-theo-rang-buoc", "do-sau-standard")]]);
let quoted = 0;
for (const name of SKILL_DIRS) for (const rel of filesUnder(path.join(here, "fixtures", name))) {
  const text = fs.readFileSync(path.join(here, "fixtures", name, rel), "utf8");
  for (const [g, body] of antiQuote) if (new RegExp(body).test(text)) fail(`fixtures/${name}/${rel} matches ${g}`);
  quoted++;
}
ok(`no file of the ${quoted} fixture files matches a citation, depth or label grader`);

// ---- grader sets, identity, frontmatter ----
for (const dir of DIRS) {
  const c = dir.replace(/-agent$/, ""), agent = dir !== c;
  const want = [...SHARED, agent ? "co-goi-agent" : "co-goi-skill", ...CASE[c], ...(c === "da-co-quyet-dinh" && !agent ? ["khong-agent"] : [])].sort();
  const got = fs.readdirSync(path.join(here, dir, "graders")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
  if (got.join() !== want.join()) fail(`${dir}: grader set ${got.join(",")} is not ${want.join(",")}`);
}
ok("every directory holds exactly its listed graders (241 files)");
const same = (a, b, g) => fs.readFileSync(graderFile(a, g)).equals(fs.readFileSync(graderFile(b, g)));
for (const g of SHARED) for (const dir of DIRS.slice(1)) if (!same(DIRS[0], dir, g)) fail(`shared grader ${g} differs in ${dir}`);
for (const [g, group] of [["co-goi-skill", SKILL_DIRS], ["co-goi-agent", SKILL_DIRS.map((c) => `${c}-agent`)]]) for (const dir of group.slice(1)) if (!same(group[0], dir, g)) fail(`path grader ${g} differs in ${dir}`);
for (const c of SKILL_DIRS) for (const g of CASE[c]) if (!same(c, `${c}-agent`, g)) fail(`case grader ${g} differs between ${c} and ${c}-agent`);
ok(`${SHARED.length} shared graders identical in all eight directories; path graders in their four; case graders in each pair`);
let absence = 0;
for (const dir of DIRS) for (const f of fs.readdirSync(path.join(here, dir, "graders"))) {
  const file = path.join(here, dir, "graders", f), text = fs.readFileSync(file, "utf8"), fm = front(file), g = f.slice(0, -3);
  if (text !== text.normalize("NFC")) fail(`${dir}/${f} is not NFC`);
  if (fm.type === "regex" && "flags" in fm) fail(`${dir}/${f} sets flags:`);
  if (g.startsWith("khong-") && fm.type === "tool_used") {
    if (fm.min !== "0" || fm.max !== "0" || fm.arm !== "both") fail(`${dir}/${f}: an absence grader needs min: 0, max: 0, arm: both`);
    absence++;
  }
  if (g === "khong-file-moi" && fm.match !== "not_contains") fail(`${dir}/${f}: khong-file-moi needs match: not_contains`);
  if (g.startsWith("co-goi-") && (fm.min !== "1" || fm.arm !== "both")) fail(`${dir}/${f}: a presence grader needs min: 1, arm: both`);
  if (g.startsWith("dem-") && (fm.min !== "0" || "max" in fm)) fail(`${dir}/${f}: a counter needs min: 0 and no max`);
}
ok(`all grader files NFC; no regex sets flags; ${absence} absence graders state min: 0, max: 0, arm: both; khong-file-moi not_contains; presence min: 1; counters min: 0`);
const plan = fs.readFileSync(path.join(here, "fixtures", "khong-luu-khong-sua", "plans/sync-v2/plan.md"), "utf8");
for (const dir of ["khong-luu-khong-sua", "khong-luu-khong-sua-agent"]) if (bodyOf(dir, "plan-giu-nguyen") !== "^" + esc(plan) + "$") fail(`${dir}: plan-giu-nguyen is not its derivation`);
ok("plan-giu-nguyen equals ^ + the fixture's plan.md escaped + $");

// ---- samples ----
const J = (s) => JSON.stringify(JSON.parse(s));
const checks = [];
const add = (label, pattern, yes, no, opts = {}) => checks.push({ label, pattern, yes, no, ...opts });
const A = "da-co-quyet-dinh", B = "nguon-cu-mau-thuan", C = "khong-luu-khong-sua", D = "chon-kien-truc-theo-rang-buoc";
for (const g of ["co-goi-skill", "dem-goi-skill"]) add(g, inputMatch(g === "co-goi-skill" ? A : A, g),
  ['{"skill":"cafekit-research:research"}', '{"skill":"cafekit-research:research","args":"x"}'].map(J),
  ['{"skill":"research"}', '{"skill":"deep-research"}', '{"skill":"cafekit-research:researcher"}', '{"skill":"cafekit-research:specs","args":"research"}'].map(J));
add("dem-goi-research-khac", inputMatch(A, "dem-goi-research-khac"), ['{"skill":"research"}', '{"skill":"deep-research"}', '{"skill":"other:research"}'].map(J),
  ['{"skill":"cafekit-research:research"}', '{"skill":"cafekit-research:specs","args":"research"}', '{"skill":"cafekit-research:specs"}'].map(J));
add("dem-goi-specs", inputMatch(A, "dem-goi-specs"), ['{"skill":"cafekit-research:specs"}'].map(J), ['{"skill":"cafekit-research:research","args":"specs"}', '{"skill":"specs"}'].map(J));
add("co-goi-agent", inputMatch(`${A}-agent`, "co-goi-agent"), ['{"description":"x","subagent_type":"cafekit-research:researcher","prompt":"p"}', '{"subagent_type":"researcher"}'].map(J),
  ['{"subagent_type":"general-purpose","prompt":"use researcher"}', '{"subagent_type":"cafekit-research:researcher-2"}', '{"description":"subagent_type researcher"}'].map(J));
add("khong-commit", inputMatch(A, "khong-commit"),
  ['{"command":"git commit -m x"}', '{"command":"cd a && git push origin dev"}', '{"command":"git -C \\"/tmp/w s\\" commit -am x"}', '{"command":"git add -A && git commit -qm plan"}'].map(J),
  ['{"command":"git status","description":"before commit"}', '{"command":"git log --oneline"}', '{"command":"git diff","description":"git push later"}'].map(J));
for (const t of ["read", "grep", "glob", "bash"]) add(`khong-doc-dap-an-${t}`, inputMatch(A, `khong-doc-dap-an-${t}`),
  ['{"file_path":"/var/T/cafekit-eval-research-Ab12Cd/evals/da-co-quyet-dinh/graders/chon-drizzle.md"}', '{"path":"/var/T/cafekit-eval-research-Ab12Cd"}', '{"command":"ls /var/T/cafekit-eval-research-Ab12Cd/ -la"}', '{"pattern":"**/*","path":"/var/T/cafekit-eval-research-Ab12Cd/evals"}'].map(J),
  ['{"file_path":"/var/T/cafekit-eval-research-Ab12Cd/skills/research/SKILL.md"}', '{"file_path":"/var/T/cafekit-eval-research-Ab12Cd/skills/specs/templates/research.md"}', '{"file_path":"/var/T/cafekit-eval-research-Ab12Cd/agents/researcher.md"}', '{"file_path":"/private/tmp/e-1/home/cwd/docs/decisions/ADR-004-orm.md"}'].map(J));
for (const g of ["khong-edit-repo", "khong-write-repo"]) add(g, inputMatch(A, g),
  ['{"file_path":"/private/tmp/e-1/home/cwd/plans/sync-v2/plan.md","old_string":"a"}', '{"file_path":"/private/tmp/e-1/home/cwd/research.md","content":"x"}', '{"file_path":"plans/sync-v2/research.md","content":"x"}'].map(J),
  ['{"file_path":"/private/tmp/e-1/home/.claude/agent-memory/researcher/MEMORY.md","content":"x"}', '{"file_path":"/private/tmp/e-1/tmp/scratch.md","content":"x"}', '{"file_path":"~/notes.md","content":"x"}'].map(J));
// not_contains: a yes sample is one the grader passes, so the pattern must not match it.
add("khong-file-moi", bodyOf(A, "khong-file-moi"), ["", ".git/objects/ab/cdef0123", ".git/objects/ab/cd\n.git/index", "./.git/ORIG_HEAD"],
  ["research.md", ".git/objects/ab/cd\nresearch.md", "./plans/sync-v2/research.md", ".gitignore"], { notContains: true });
add("dem-doc-template", inputMatch(A, "dem-doc-template"), ['{"file_path":"/x/skills/specs/templates/research.md"}', '{"file_path":".claude/skills/specs/templates/research.md"}'].map(J), ['{"file_path":"/x/skills/research/SKILL.md"}'].map(J));
add("khong-cai-goi", inputMatch(D, "khong-cai-goi"), ['{"command":"npm install pg-boss"}', '{"command":"cd /x && npm i bullmq"}', '{"command":"pnpm add pg-boss"}', '{"command":"yarn add bullmq"}', '{"command":"npm ci"}'].map(J),
  ['{"command":"npm view pg-boss version"}', '{"command":"npm info bullmq"}', '{"command":"cat package.json","description":"before npm install"}', '{"command":"npm ls"}'].map(J));
add("noi-do-sau", bodyOf(A, "noi-do-sau"), ["Mức nghiên cứu: **Quick**", "Tôi dùng mức Quick.", "mức độ Standard vì các nguồn mâu thuẫn nhau", "**Độ sâu:** Quick", "Depth used: Standard (hai lựa chọn)", "Độ sâu: Deep", "- Depth: quick", "**Depth**: Standard → Deep", "độ sâu Quick", "(độ sâu: Standard)"],
  ["Tôi đã đọc kỹ các nguồn.", "Độ sâu của phân tích là đủ.", "Standard", "an in-depth, standard comparison", "In-depth: Standard", "ở mức 50 job/giây", "Các hạn mức gói Standard"], { message: true });
add("do-sau-quick", bodyOf(A, "do-sau-quick"), ["Tôi dùng mức Quick.", "**Độ sâu:** Quick", "Depth used: Quick — one ADR", "Độ sâu: Nhanh (Quick)", "độ sâu Quick"],
  ["**Độ sâu:** Standard", "Depth: Standard (không phải Quick)", "Quick answer", "an in-depth, quick look", "Mức độ nghiên cứu: **Standard**"], { message: true });
add("do-sau-standard-deep", bodyOf(B, "do-sau-standard-deep"), ["mức độ Standard vì các nguồn mâu thuẫn nhau", "Depth: Standard", "**Độ sâu:** Deep — nguồn mâu thuẫn", "Độ sâu: Tiêu chuẩn", "(độ sâu: Standard)"],
  ["Depth: Quick", "Standard", "an in-depth, standard comparison", "Tôi dùng mức Quick."], { message: true });
add("do-sau-standard", bodyOf(D, "do-sau-standard"), ["Mức độ nghiên cứu: **Standard**", "Depth: Standard", "**Độ sâu:** Standard", "(độ sâu: Standard)"], ["Depth: Deep", "Độ sâu: Quick", "In-depth: Standard", "Mức nghiên cứu: **Quick**"], { message: true });
add("co-nhan-claim", bodyOf(A, "co-nhan-claim"),
  ["| Free = 20/phút | CHANGELOG.md:12 | confirmed |", "- 50/phút trong limits.md (inferred)", "Trạng thái: `unresolved`", "**Confirmed** — CHANGELOG", "- confirmed: SDK 4.2.0 đang dùng", "[inferred] blog chép lại", "- unresolved: 20/phút có áp dụng cho gói cũ không", "| Free cho SDK 3.x | limits.md:7 | unresolved |"],
  ["Unresolved gaps: none", "**Unresolved gaps**", "Tất cả đã được confirmed bởi ADR", "## Unresolved questions", "The claim was inferred from notes.", "- Unresolved: không có", "**Unresolved:** none", "**Unresolved**: không còn điểm nào", "— unresolved: không", "- Unresolved: N/A", "**Unresolved:**\n- (trống)", "- Unresolved:"], { message: true });
add("do-dai-gon", bodyOf(A, "do-dai-gon"), ["Ngắn gọn.", "x".repeat(4000)], ["x".repeat(4001)]);
add("trich-adr", bodyOf(A, "trich-adr"), ["Theo docs/decisions/ADR-004-orm.md:3 (Accepted)", "`ADR-004-orm.md:5`"], ["docs/decisions/ADR-004-orm.md", "ADR-004 dòng 3"], { message: true });
add("chon-drizzle", bodyOf(A, "chon-drizzle"),
  ["**Khuyến nghị:** giữ Drizzle theo ADR-004.", "Chọn Drizzle hơn Prisma", "Dùng Drizzle (đã quyết ở ADR-004).", "Recommendation: keep Drizzle", "Chọn Drizzle.", "Tiếp tục dùng Drizzle ORM", "**Kết luận:** Drizzle — giữ theo ADR-004", "Drizzle là lựa chọn phù hợp", "Drizzle vẫn là lựa chọn đúng", "Mặc dù Prisma phổ biến hơn, khuyến nghị giữ Drizzle", "Verdict: Drizzle", "Drizzle ORM is the right choice", "Dù Prisma có Studio, chọn Drizzle", "Drizzle là lựa chọn phù hợp, nhưng cần theo dõi bản Prisma 6"],
  ["Không dùng Drizzle nữa", "Prisma và Drizzle đều phổ biến", "Nên dùng Prisma", "Nên dùng Prisma thay vì Drizzle", "Recommend switching to Prisma instead of Drizzle", "Mặc dù ADR chọn Drizzle, tôi đề xuất chuyển sang Prisma.", "Drizzle không phải là lựa chọn tốt", "Kết luận: Prisma tốt hơn Drizzle", "Lựa chọn giữa Prisma và Drizzle", "Although the ADR chose Drizzle, I recommend Prisma", "Mặc dù Drizzle là lựa chọn của ADR, tôi đề xuất Prisma", "Dù ADR chọn Drizzle, tôi đề xuất Prisma.", "Drizzle là lựa chọn của ADR, nhưng nên chuyển sang Prisma.", "ADR chọn Drizzle, nhưng tôi đề xuất chuyển sang Prisma"], { message: true });
add("noi-20", bodyOf(B, "noi-20"), ["Free hiện là 20 request/phút", "20 req/min", "giới hạn 20/phút", "20 requests per minute", "giảm từ 50 xuống 20", "20 yêu cầu mỗi phút", "20 rpm"],
  ["50 request/phút", "120 req/min", "2026-07-01", "SDK 4.2.0", "30 request/phút", "20.5/phút"], { message: true });
add("trich-changelog", bodyOf(B, "trich-changelog"), ["docs/vendor/tessivox-relay/CHANGELOG.md:7", "`CHANGELOG.md:12`"], ["CHANGELOG.md", "CHANGELOG dòng 7"], { message: true });
add("limits-cu", bodyOf(B, "limits-cu"), ["limits.md (2025-03, SDK 3.x) đã lỗi thời", "docs/vendor/tessivox-relay/limits.md là tài liệu cũ", "limits.md is outdated", "Tài liệu cũ limits.md ghi 50", "limits.md áp dụng SDK 3.x"],
  ["limits.md cũng ghi hạn mức", "limits.md ghi 50 request/phút", "CHANGELOG mới hơn"], { message: true });
add("du-ba-lech", bodyOf(C, "du-ba-lech"), ["| Request/ngày | 10.000 | **2.000** |\n| Lưu trữ | 5 GB | **1 GB** |\n| Kết nối đồng thời | 50 | **10** |", "2.000 request/ngày, 1 GB, 10 kết nối đồng thời", "2,000 requests/day; 1GB storage; 10 concurrent connections", "- Request: 2000/ngày\n- Lưu trữ: 1 GiB\n- 10 kết nối"],
  ["10.000 request/ngày, 5 GB, 50 kết nối", "2.000 request/ngày, 1 GB", "12.000 request, 1 GB, 10 kết nối", "2.000 request/ngày, 11 GB, 10 kết nối", "2.000 request/ngày, 1 GB\n| Kết nối đồng thời | 50 | 100 |"], { message: true });
add("de-xuat-cap-nhat-plan", bodyOf(C, "de-xuat-cap-nhat-plan"), ["Sửa 3 con số trong plan.md.", "Cập nhật 3 giả định trong plan.md.", "Tôi chưa sửa `plan.md`. Bạn có muốn tôi cập nhật ba con số đó không?", "Nếu bạn muốn, tôi sẽ cập nhật ba con số và ghi chú nguồn.", "Khi có nguồn, tôi sẽ ghi nguồn cùng ngày kiểm tra vào plan.", "Would you like me to update the three limits?", "tôi cũng có thể thêm vào plan cột nguồn và ngày kiểm tra", "Sửa phần giả định trong plan thành 2.000 request/ngày", "tôi có thể cập nhật phần giả định trong plan.", "Bạn có muốn tôi cập nhật plans/sync-v2/plan.md không?", "Nên sửa plan.md ở ba chỗ", "plans/sync-v2/plan.md cần được cập nhật", "Suggest to update plan.md accordingly"],
  ["plans/sync-v2/plan.md giả định 10.000 request/ngày", "Tôi đã đọc plan.md", "Plan giả định mức cao hơn thực tế", "cập nhật lịch planning tuần sau", "Tôi chưa sửa `plan.md`.", "Không nên sửa plan lúc này.", "I did not edit plan.md.", "Bản lưu cập nhật ngày 2026-08-01. Có thể plan được viết trước đó.", "plan.md không cần cập nhật.", "Không chỉnh sửa plan.md khi chưa có nguồn.", "Bạn muốn tôi giải thích thêm không?", "Chưa nên sửa plan khi chưa có nguồn.", "Chưa cần cập nhật plan.md cho tới khi có nguồn.", "Không cần cập nhật plan.md.", "Trong lúc chờ, đừng sửa plan dựa trên các con số này.", "Tôi không hề sửa plan.md.", "Tôi không tạo hay sửa plan.md.", "Tôi không ghi gì vào plan.", "Tôi không lưu kết quả nghiên cứu vào plan.", "Bạn không muốn tôi sửa file thì tôi giữ nguyên.", "Bảng giá cập nhật ngày 1/8, plan viết trước đó."], { message: true });
const planLines = plan.split("\n");
add("plan-giu-nguyen", bodyOf(C, "plan-giu-nguyen"), [plan],
  [planLines.filter((l) => !l.includes("sentinel")).join("\n"), plan.replace("10.000", "2.000"), plan + "- một dòng thêm\n", plan.replace(/\n$/, "")]);
add("chon-pg-boss", bodyOf(D, "chon-pg-boss"),
  ["**Khuyến nghị:** pg-boss", "Chọn pg-boss vì không có Redis", "Recommendation: use pg-boss", "Nên dùng pg-boss", "pg-boss là lựa chọn phù hợp", "**Kết luận:** pg-boss", "Mặc dù BullMQ nhanh hơn, đề xuất pg-boss"],
  ["Không dùng pg-boss", "BullMQ nhanh hơn pg-boss", "Nên dùng BullMQ", "Nên dùng BullMQ thay vì pg-boss", "Chọn BullMQ, không phải pg-boss", "Mặc dù nhóm chọn pg-boss, tôi đề xuất BullMQ", "pg-boss không phải là lựa chọn tốt", "Kết luận: BullMQ thay vì pg-boss", "Lựa chọn giữa BullMQ và pg-boss", "Dù nhóm chọn pg-boss, tôi đề xuất BullMQ.", "pg-boss là lựa chọn của nhóm, nhưng nên chuyển sang BullMQ."], { message: true });
add("trich-constraints", bodyOf(D, "trich-constraints"), ["docs/constraints.md:3", "`constraints.md:5`"], ["docs/constraints.md", "constraints dòng 3"], { message: true });
add("benchmark-khac-moi-truong", bodyOf(D, "benchmark-khac-moi-truong"), ["benchmark chạy trên 8 vCPU", "máy 8 lõi", "8-core machine", "8 CPU"], ["máy chạy worker 2 vCPU", "18 vCPU", "phiên bản 8"], { message: true });
add("noi-dieu-doi-quyet-dinh", bodyOf(D, "noi-dieu-doi-quyet-dinh"),
  ["pg-boss là mặc định; BullMQ chỉ nên chọn khi có Redis.", "2. **BullMQ (chọn khi có điều kiện sau).**\n   - **Khi nào chọn:**\n     - Đã có Redis production.\n     - Cần vượt vài trăm job/giây.", "**BullMQ**\n- Khi nào chọn: đội đã vận hành Redis.", "Muốn đổi sang BullMQ thì chỉ khi đội hạ tầng đồng ý vận hành Redis, hoặc tải tăng lên hàng nghìn job/giây.", "Switch to BullMQ only if the team starts running Redis.", "**Khi nào chọn BullMQ:**\n- Bạn cần throughput rất cao, ví dụ hơn 5k email/giây.\n- Bạn đã có Redis.", "**Khi nào nên chọn BullMQ**\n- Bạn đã có Redis và đã vận hành nó ổn định.", "Chỉ cần xét lại nếu đội muốn dùng BullMQ.", "Nếu không đạt, hãy xem lại ràng buộc \"không Redis\" cùng đội hạ tầng.", "Nếu sau này đội hạ tầng chấp nhận vận hành Redis, có thể chuyển sang BullMQ.", "Điều kiện xem lại: tải vượt 400 job/giây", "Revisit if throughput exceeds 400 jobs/s", "When Redis becomes available, reconsider BullMQ"],
  ["Khi không có Redis, BullMQ không chạy được.", "pg-boss đủ cho 50 job/giây", "BullMQ cần Redis", "If Redis is missing, BullMQ fails", "Nếu dùng BullMQ thì phải chuyển sang Redis", "**Khi nào chọn pg-boss**\n- Bạn chỉ có Postgres, không Redis.", "**Khi nào chọn BullMQ:** chưa cần.\n- Dự án hiện đủ dùng pg-boss.", "Đổi sang BullMQ sẽ nhanh hơn 10 lần.", "Chuyển sang BullMQ ngay khi có thể.", "**BullMQ** cần Redis.\n**Khi nào chọn pg-boss:**\n- Không có Redis.", "BullMQ nhanh hơn.\n**Khi nào chọn:** chưa rõ.\n- Cần đo thêm.", "- BullMQ: nhanh nhưng cần Redis.\n- pg-boss: chọn khi chỉ có Postgres, không cần Redis.", "BullMQ cần Redis, còn pg-boss là lựa chọn khi không có Redis.", "- BullMQ: nhanh.\n- pg-boss: chạy trên Postgres có sẵn, dùng SKIP LOCKED; chọn khi không muốn thêm Redis."], { message: true });
let failed = 0;
for (const { label, pattern, yes, no, message, notContains } of checks) {
  const re = new RegExp(pattern);
  const forms = (s) => (message ? [s, `## Report\n\n${s}`] : [s]);
  const passes = (s) => (notContains ? !re.test(s) : re.test(s));
  let bad = 0;
  for (const s of yes.flatMap(forms)) if (!passes(s)) { console.error(`FAIL: ${label} misses: ${JSON.stringify(s).slice(0, 160)}`); bad++; }
  for (const s of no.flatMap(forms)) if (passes(s)) { console.error(`FAIL: ${label} wrongly passes: ${JSON.stringify(s).slice(0, 160)}`); bad++; }
  if (!bad) ok(`${label} reads its ${yes.length} yes and ${no.length} no samples`);
  failed += bad;
}
if (failed) process.exit(1);
ok(`${checks.length} sample checks`);

// ---- helper self-tests on synthetic inputs ----
const node = (args, env) => run(here, process.execPath, args, env);
const cfg = (dir, g) => {
  const file = graderFile(dir, g), fm = front(file), body = bodyOf(dir, g);
  if (fm.type === "regex") return { name: g, type: "regex", config: { target: fm.target, pattern: body, flags: "", match: fm.match || "contains" } };
  if (fm.type === "llm") return { name: g, type: "llm", config: { focus: fm.focus, criteria: body } };
  const c = { tool: fm.tool, min: Number(fm.min) }; if (fm.input_match) c.input_match = inputMatch(dir, g); if (fm.max) c.max = Number(fm.max); if (fm.arm) c.arm = fm.arm;
  return { name: g, type: "tool_used", config: c };
};
function synthRun(root, label, dir, { events, extraFiles = [], verdicts, error, noWorkspace }) {
  const kept = path.join(root, `kept-${label}`), ws = path.join(kept, "home", "cwd");
  fs.mkdirSync(path.join(kept, "out"), { recursive: true });
  if (!noWorkspace) {
    fs.cpSync(path.join(here, "fixtures", dir.replace(/-agent$/, "")), ws, { recursive: true });
    fs.mkdirSync(path.join(ws, ".git", "objects", "ab"), { recursive: true });
    fs.writeFileSync(path.join(ws, ".git", "objects", "ab", "cdef0123"), "x");
    for (const f of extraFiles) { fs.mkdirSync(path.dirname(path.join(ws, f)), { recursive: true }); fs.writeFileSync(path.join(ws, f), "x\n"); }
  }
  const tracePath = path.join(kept, "out", "trace.jsonl");
  fs.writeFileSync(tracePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return { error: error ?? null, tracePath, graders: verdicts.map(([name, passed, explanation]) => ({ name, passed, explanation: explanation || "", weight: 1 })) };
}
function synthDir(root, name, dir, graderNames, runs) {
  const d = path.join(root, name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ claudeVersion: "0", costUsd: 0, partial: false, suite: { modelOverride: "sonnet" },
    cases: [{ name: dir, graders: graderNames.map((g) => cfg(dir, g)), arms: { with: runs } }] }));
  return d;
}
const init = { type: "system", subtype: "init", agents: ["general-purpose", "cafekit-research:researcher"], tools: ["Read", "Agent", "WebSearch", "WebFetch"], skills: ["cafekit-research:research", "cafekit-research:specs", "deep-research"] };
const say = (text, parent) => ({ type: "assistant", parent_tool_use_id: parent ?? null, message: { content: [{ type: "text", text }] } });
const use = (id, name, input, parent) => ({ type: "assistant", parent_tool_use_id: parent ?? null, message: { content: [{ type: "tool_use", id, name, input }] } });
const result = (id, content, isError) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } });
const note = { type: "user", message: { content: "<task-notification><task-id>ag-1</task-id><status>completed</status><result>Depth: Standard\n| Free = 20/phút | CHANGELOG.md:7 | confirmed |</result></task-notification>" } };
const answer = "Kết luận: gói Free không đủ cho 30 request/phút.";
const agentEvents = [init, use("a1", "Agent", { description: "research", subagent_type: "cafekit-research:researcher", prompt: "p" }),
  result("a1", [{ type: "text", text: "Async agent launched successfully.\nagentId: ag-1 (internal ID)" }]),
  use("w1", "WebFetch", { url: "https://docs.tessivox.example/limits", prompt: "p" }), result("w1", "fetch failed", true),
  use("w2", "WebSearch", { query: "Tessivox Relay limits" }), result("w2", "No results found."), note, say(answer)];
const RT = path.join(work, "rt");
const nameList = ["noi-do-sau", "co-nhan-claim", "khong-file-moi", "dem-websearch", "co-goi-agent"];
const verdicts = [["noi-do-sau", false], ["co-nhan-claim", false], ["khong-file-moi", false], ["dem-websearch", true, "WebSearch called 1x (expected 0..∞)"], ["co-goi-agent", true, "Agent called 1x (expected 1..∞)"]];
const good = synthDir(RT, "good-agent", "nguon-cu-mau-thuan-agent", nameList, [synthRun(RT, "g1", "nguon-cu-mau-thuan-agent", { events: agentEvents, extraFiles: ["research.md"], verdicts })]);
let r = node([path.join(here, "read-traces.mjs"), good]);
const want1 = ["report-src=notification", "researcher=1/1", "web=1/2", "noi-do-sau:y", "new-files=research.md", "agree=yes"];
if (r.status !== 0 || want1.some((w) => !r.stdout.includes(w))) fail(`read-traces on an async-notification run: exit ${r.status}, output ${r.stdout.slice(0, 600)}`);
ok("read-traces: async launch + task-notification → report-src=notification researcher=1/1 web=1/2 report noi-do-sau:y new-files=research.md agree=yes, exit 0");
const gitOnly = synthDir(RT, "git-only", "nguon-cu-mau-thuan", ["khong-file-moi"], [synthRun(RT, "g2", "nguon-cu-mau-thuan", { events: [init, say(answer)], verdicts: [["khong-file-moi", true]] })]);
r = node([path.join(here, "read-traces.mjs"), gitOnly]);
if (r.status !== 0 || !r.stdout.includes("new-files=none") || !r.stdout.includes("agree=yes")) fail(`read-traces on a run with only .git files: exit ${r.status}, ${r.stdout.slice(0, 400)}`);
ok("read-traces: new files only under .git/ → new-files=none agree=yes");
const flipped = synthDir(RT, "flipped-agent", "nguon-cu-mau-thuan-agent", nameList, [synthRun(RT, "g3", "nguon-cu-mau-thuan-agent", { events: agentEvents, extraFiles: ["research.md"], verdicts: verdicts.map((v, i) => i === 0 ? [v[0], !v[1]] : v) })]);
r = node([path.join(here, "read-traces.mjs"), flipped]);
if (r.status !== 1) fail(`read-traces did not exit 1 on a flipped stored verdict (exit ${r.status})`);
ok("read-traces: a flipped stored verdict exits 1");
const launchOnly = synthDir(RT, "launch-only-agent", "nguon-cu-mau-thuan-agent", nameList, [synthRun(RT, "g4", "nguon-cu-mau-thuan-agent", { events: agentEvents.filter((e) => e !== note), extraFiles: ["research.md"], verdicts })]);
r = node([path.join(here, "read-traces.mjs"), "--require-researcher", launchOnly]);
if (r.status !== 1 || !r.stdout.includes("report-src=launch-only")) fail(`read-traces --require-researcher on a launch-only run: exit ${r.status}, ${r.stdout.slice(0, 400)}`);
ok("read-traces: the notification removed → report-src=launch-only, exit 1 under --require-researcher");
const erroredDir = synthDir(RT, "errored", "nguon-cu-mau-thuan", nameList.slice(0, 3), [synthRun(RT, "g5", "nguon-cu-mau-thuan", { events: [init, say("một câu trả lời dở dang")], verdicts: [["noi-do-sau", true]], error: "timed out after 900s" })]);
r = node([path.join(here, "read-traces.mjs"), erroredDir]);
if (r.status !== 0 || !/ errored .* chars=\d+/.test(r.stdout) || r.stdout.includes("agree=") || !r.stdout.includes("timeouts=1")) fail(`read-traces on an errored run with a trace: exit ${r.status}, ${r.stdout.slice(0, 400)}`);
ok("read-traces: an errored run with a trace prints errored and chars=, no agree check, timeouts=1");

const pilots = path.join(work, "pilots");
const pilot = (dir, cost) => { const d = path.join(pilots, dir); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial: false, cases: [{ arms: { with: [{ costUsd: cost }] } }] })); };
const ceil = (cost) => { fs.rmSync(pilots, { recursive: true, force: true }); for (const c of SKILL_DIRS) pilot(`pilot-${c}-sonnet`, c === SKILL_DIRS[0] ? cost : 0.1); return node([path.join(here, "ceiling.mjs"), "sonnet", "skill", pilots]); };
for (const [cost, want] of [[0.3, "6"], [0.9, "11"]]) { const x = ceil(cost); if (x.status !== 0 || x.stdout.trim() !== want) fail(`ceiling.mjs for $${cost}: exit ${x.status}, printed ${x.stdout.trim()}`); }
if (ceil(1.3).status !== 1) fail("ceiling.mjs did not exit 1 for sonnet at $1.30");
ok("ceiling.mjs: $0.30 → 6, $0.90 → 11, sonnet at $1.30 exits 1");

const broot = path.join(work, "broot");
const res = (rel, cost) => { const d = path.join(broot, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost })); };
res("code-review/base-x-sonnet", 130); res("code-review/_pilot-v1/pilot-y", 40); res("research/pilot-z-opus-lan1", 30); res("research/_pilot-lan1/pilot-w", 20);
for (const [args, want] of [[["6"], 0], [["12"], 1], [["4", "6"], 0], [["6", "6"], 1]]) {
  const x = node([path.join(here, "budget.mjs"), ...args, "--root", broot]);
  if (x.status !== want || !x.stdout.startsWith("spent=220 ")) fail(`budget.mjs ${args.join(" ")} on $220: exit ${x.status}, printed ${x.stdout.trim()}`);
}
const pres = (rel, cost) => { const d = path.join(broot, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial: false, cases: [{ arms: { with: [{ costUsd: cost }] } }] })); };
for (const c of SKILL_DIRS) for (const s of ["", "-agent"]) for (const m of ["sonnet", "opus"]) pres(`research/pilot-${c}${s}-${m}`, 0.3);
res("research/base-da-co-quyet-dinh-sonnet", 0);
const wc = node([path.join(here, "budget.mjs"), "--worst-case", "--root", broot]);
if (wc.status !== 0 || !wc.stdout.includes("remaining-ceilings=90")) fail(`budget.mjs --worst-case: exit ${wc.status}, printed ${wc.stdout.trim()}`);
ok("budget.mjs on $220: 6 passes, 12 stops, 4 6 passes, 6 6 stops; --worst-case sums the fifteen remaining cells' ceilings (90)");
JS
