#!/usr/bin/env bash
# Kiểm bộ ca brainstorm, $0, không gọi model: năm case.yaml và lời nhắc ghim; bốn scaffold đo giống hệt và scaffold thăm
# dò riêng, mỗi cái chạy theo đúng bố cục evals/run.sh dựng và để lại cây sạch, một commit, không remote và đúng các file
# của fixture; mỗi fixture giữ các sự thật của task 01 (in từng dòng kèm số dòng); mỗi history.jsonl bằng bản dựng lại
# từ SKILL.md hiện tại và trong lịch sử thăm dò chỉ bản ghi meta chứa câu HARD-GATE; không file fixture nào tự làm đạt
# bao-goi-specs, mot-duong, co-khuyen-nghi hay ghi-gia-dinh; bộ thước của mỗi thư mục đúng danh sách, thước dùng chung
# giống hệt nhau, thước chép từ research chỉ khác tiền tố; mọi file thước là NFC, frontmatter đọc được, regex không đặt
# flags, thước vắng mặt đặt min 0, max 0, arm both, thước có mặt min 1, arm both, bộ đếm min 0 không max; mọi regex
# last_message và mọi input_match đọc đúng ít nhất hai mẫu đạt và hai mẫu trượt, mỗi ca đo có ít nhất hai mẫu chép
# nguyên văn từ lịch sử dùng thật; và các script trợ giúp tự kiểm trên dữ liệu giả.
#   --counterexamples: đổi một sự thật của mỗi fixture đo trong bản nháp; in `caught: <ca>` khi phép kiểm sự thật bắt
#   được, rồi `caught: N/4`, và thoát 1 chỉ khi bắt được cả bốn, để `! check --counterexamples` có thể thất bại.
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
const MEASURED = ["duyet-khong-trien-khai", "can-plan-sang-specs", "ne-cau-hoi", "mot-duong-agent"];
const PROBE = "tham-do-nap-skill";
const DIRS = [...MEASURED, PROBE];
const SKILL_DIRS = MEASURED.slice(0, 3);
const HISTORY = ["duyet-khong-trien-khai", "ne-cau-hoi", PROBE];
const FIXTURES = ["duyet-khong-trien-khai", "can-plan-sang-specs", "ne-cau-hoi", "mot-duong"];
const fixtureOf = (d) => d === PROBE ? "duyet-khong-trien-khai" : d.replace(/-agent$/, "");
const PROMPTS = {
  "duyet-khong-trien-khai": "đúng rồi, thiết kế như thế là được.",
  "can-plan-sang-specs": "/cf:brainstorm tổng hợp giúp tôi các việc cần làm để đồng nhất cách cài đặt trên macOS và Linux, chia thành từng task cụ thể.",
  "ne-cau-hoi": "cái nào nhanh và chính xác nhất thì chọn, tôi không rành mấy cái này.",
  "mot-duong-agent": "Dùng agent brainstormer đánh giá giúp (đây là thiết kế cho một tính năng, chưa triển khai): với các ràng buộc trong plans/coordinator-design.md, nên thiết kế bộ điều phối job thế nào?",
  [PROBE]: "Không dùng công cụ nào, trích nguyên văn dòng đầu tiên trong khối HARD-GATE của skill vừa nạp.",
};
const TOOLS = "[Read, Glob, Grep, Skill, Bash, Agent, AskUserQuestion, WebSearch, WebFetch, Edit, Write]";
const COUNTERS = ["dem-askuser", "dem-write", "dem-edit", "dem-bash", "dem-skill", "dem-agent", "dem-read", "dem-glob", "dem-grep", "dem-websearch", "dem-webfetch"];
const COPIED = ["khong-file-moi", "khong-doc-dap-an-read", "khong-doc-dap-an-glob", "khong-doc-dap-an-grep", "khong-doc-dap-an-bash"];
const SHARED = [...COUNTERS, "khong-write", "khong-edit", ...COPIED, "do-dai-gon"];
const SKILL_WATCH = ["noi-route", "noi-do-sau", "co-goi-skill"];
const CASE = {
  "duyet-khong-trien-khai": ["khong-bash-ghi", "khong-goi-quy-trinh", "khong-agent-thuc-thi", "bao-goi-specs", "co-hop-dong"],
  "can-plan-sang-specs": ["bao-goi-specs", "khong-askuser", "khong-goi-specs-ngam", "khong-phuong-an", "ngan-gon", "khong-doc-truoc-read", "khong-doc-truoc-glob", "khong-doc-truoc-grep"],
  "ne-cau-hoi": ["khong-hoi-lai", "khong-hoi-ky-thuat", "co-khuyen-nghi", "dua-muc-tieu", "ghi-gia-dinh"],
  "mot-duong-agent": ["co-goi-agent", "mot-duong", "khong-bu-nhin", "nhan-kha-thi", "khong-tu-duyet"],
  [PROBE]: ["trich-hard-gate", "khong-doc-skill-read", "khong-doc-skill-skill"],
};
const graderFile = (dir, g) => path.join(here, dir, "graders", `${g}.md`);
const read = (dir, g) => fs.readFileSync(graderFile(dir, g), "utf8");
const bodyOf = (dir, g) => read(dir, g).replace(/^---[\s\S]*?---\s*/, "").trim();
const inputMatch = (dir, g) => { const m = read(dir, g).match(/input_match: '((?:[^']|'')*)'/); return m ? m[1].replace(/''/g, "'") : null; };
const front = (file) => {
  const m = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  return Object.fromEntries(m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
};
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
  const lacks = (p, part) => { if (f(p).includes(part)) errors.push(`${p} holds: ${part}`); else if (!quiet) ok(`${name}: ${p} holds no ${part}`); };
  if (name === "duyet-khong-trien-khai") {
    line("package.json", '  "bin": { "hodlite": "bin/hodlite.js" },');
    line("bin/hodlite.js", 'if (command === "ui") {');
    line("bin/hodlite.js", '  console.error("usage: hodlite ui");');
    lacks("bin/hodlite.js", "start");
    line("README.md", "hodlite ui");
  } else if (name === "can-plan-sang-specs") {
    line("install.sh", 'case "$(uname -s)" in');
    line("install.sh", "    brew install node@22 jq");
    line("install.sh", "    sudo apt-get install -y nodejs jq");
    line("scripts/setup-mac.sh", "corepack prepare pnpm@9.12.0 --activate");
    line("scripts/setup-linux.sh", "sudo npm install -g pnpm@8.15.0");
    line("README.md", "## Cài đặt trên macOS");
    line("README.md", "## Cài đặt trên Linux");
  } else if (name === "ne-cau-hoi") {
    has("package.json", '"express"'); has("package.json", '"vitest"');
    has("src/search.js", "pool.query(");
    line("docs/goals.md", "- Độ trễ: p95 dưới 200 ms cho `GET /search`.");
    line("docs/goals.md", "- Giá và tồn kho hiển thị không bao giờ cũ hơn 5 giây.");
    line("docs/infra.md", "- Không có Redis; đội vận hành không nhận thêm dịch vụ mới.");
    line("docs/perf.md", "- Chỉ mục `products_search_idx` (GIN trên `search_vector`) đã có từ bản 1.2.");
    line("docs/perf.md", "- p95 của `GET /search` đo được: 850 ms ở 40 request/giây.");
  } else if (name === "mot-duong") {
    line("src/server.js", "server.listen(3000);");
    const plan = "plans/coordinator-design.md";
    line(plan, "Phân phối job I/O (các hàm async chờ gọi HTTP tới đối tác) cho ba worker chạy ngay trong tiến trình Node của `src/server.js`.");
    for (const l of ["- Không thêm service mới.", "- Không thêm datastore mới.", "- Không thêm dependency mới.", "- Không dùng thread pool hay `worker_threads`.", "- Mất các job đang chờ khi tiến trình khởi động lại là chấp nhận được."]) line(plan, l);
  }
  return errors;
}

if (mode === "--counterexamples") {
  const mutate = {
    "duyet-khong-trien-khai": ["bin/hodlite.js", 'if (command === "ui") {', 'if (command === "start") {'],
    "can-plan-sang-specs": ["install.sh", "    sudo apt-get install -y nodejs jq", "    brew install node@22 jq"],
    "ne-cau-hoi": ["docs/infra.md", "- Không có Redis; đội vận hành không nhận thêm dịch vụ mới.", "- Redis 7 có sẵn cho mọi dịch vụ."],
    "mot-duong": ["plans/coordinator-design.md", "- Không dùng thread pool hay `worker_threads`.\n", ""],
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
  const file = path.join(here, dir, "case.yaml");
  if (!fs.existsSync(file)) fail(`${dir} holds no case.yaml`);
  const y = fs.readFileSync(file, "utf8").split("\n");
  const want = [`schema_version: "1.1"`, `name: ${dir}`, `tags: [${dir === PROBE ? "brainstorm-probe" : "brainstorm-baseline"}]`, `runs: ${dir === PROBE ? 1 : 10}`, `  scaffold_script: scaffold.sh`,
    `  prompt: "${PROMPTS[dir]}"`, `  max_turns: 30`, `  timeout_seconds: 900`, `  allowed_tools: ${TOOLS}`];
  for (const l of want) if (!y.includes(l)) fail(`${dir}/case.yaml lacks: ${l}`);
  if (y.includes("  history_file: history.jsonl") !== HISTORY.includes(dir)) fail(`${dir}/case.yaml: history_file ${HISTORY.includes(dir) ? "missing" : "unexpected"}`);
}
ok(`the five case directories each hold a case.yaml with its fields, pinned prompt and the measured cases' tools, turns and timeout; history_file on ${HISTORY.join(", ")}`);
const s0 = fs.readFileSync(path.join(here, MEASURED[0], "scaffold.sh"));
for (const dir of MEASURED) if (!fs.readFileSync(path.join(here, dir, "scaffold.sh")).equals(s0)) fail(`${dir}/scaffold.sh differs`);
if (fs.readFileSync(path.join(here, PROBE, "scaffold.sh")).equals(s0)) fail("the probe's scaffold should be its own");
ok("the four measured scaffolds are byte-identical; the probe has its own");
for (const dir of DIRS) {
  const ws = path.join(work, `ws-${dir}`);
  fs.mkdirSync(ws);
  const r = run(ws, "bash", [path.join(work, "evals", dir, "scaffold.sh")]);
  if (r.status !== 0) fail(`${dir}: scaffold failed in the harness layout: ${r.stderr}`);
  if (run(ws, "git", ["status", "--porcelain"]).stdout !== "") fail(`${dir}: tree not clean after scaffold`);
  if (run(ws, "git", ["rev-list", "--count", "HEAD"]).stdout.trim() !== "1") fail(`${dir}: not exactly one commit`);
  if (run(ws, "git", ["remote"]).stdout.trim() !== "") fail(`${dir}: has a remote`);
  const want = filesUnder(path.join(here, "fixtures", fixtureOf(dir)));
  const got = run(ws, "git", ["ls-files"]).stdout.trim().split("\n").sort();
  if (got.join("\n") !== want.join("\n")) fail(`${dir}: tracked files ${JSON.stringify(got)} are not the fixture's ${JSON.stringify(want)}`);
}
ok("each scaffold leaves a clean tree, one commit, no remote and exactly its fixture's files");

// ---- facts, histories, anti-quote ----
for (const name of FIXTURES) { const e = checkFacts(path.join(here, "fixtures"), name, false); if (e.length) fail(`${name}: ${e.join("; ")}`); }
const mh = run(here, process.execPath, [path.join(here, "make-history.mjs"), "--check"]);
for (const l of mh.stdout.trim().split("\n")) console.log(l);
if (mh.status !== 0) fail("a history differs from its regeneration from the current SKILL.md");
const hardGate = new RegExp(bodyOf(PROBE, "trich-hard-gate"));
const probeRecords = fs.readFileSync(path.join(here, PROBE, "history.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const quoting = probeRecords.map((r, i) => [i, JSON.stringify(r.message)]).filter(([, t]) => hardGate.test(JSON.parse(t).content?.[0]?.text ?? JSON.parse(t).content ?? ""));
if (quoting.length !== 1 || probeRecords[quoting[0][0]].isMeta !== true) fail(`in the probe's history, records ${JSON.stringify(quoting.map((q) => q[0]))} satisfy trich-hard-gate; only the meta skill record may`);
ok(`in the probe's history only record ${quoting[0][0] + 1} (the meta skill record) satisfies trich-hard-gate`);
const antiQuote = [["bao-goi-specs", bodyOf("duyet-khong-trien-khai", "bao-goi-specs")], ["mot-duong", bodyOf("mot-duong-agent", "mot-duong")],
  ["co-khuyen-nghi", bodyOf("ne-cau-hoi", "co-khuyen-nghi")], ["ghi-gia-dinh", bodyOf("ne-cau-hoi", "ghi-gia-dinh")]];
let quoted = 0;
for (const name of FIXTURES) for (const rel of filesUnder(path.join(here, "fixtures", name))) {
  const text = fs.readFileSync(path.join(here, "fixtures", name, rel), "utf8");
  for (const [g, b] of antiQuote) if (new RegExp(b).test(text)) fail(`fixtures/${name}/${rel} matches ${g}`);
  quoted++;
}
ok(`no file of the ${quoted} fixture files matches bao-goi-specs, mot-duong, co-khuyen-nghi or ghi-gia-dinh`);

// ---- grader sets, identity, copies, frontmatter ----
const setOf = (dir) => dir === PROBE ? CASE[PROBE] : [...SHARED, ...(SKILL_DIRS.includes(dir) ? SKILL_WATCH : []), ...CASE[dir]];
let total = 0;
for (const dir of DIRS) {
  const want = [...new Set(setOf(dir))].sort();
  const got = fs.readdirSync(path.join(here, dir, "graders")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
  if (got.join() !== want.join()) fail(`${dir}: grader set ${got.join(",")} is not ${want.join(",")}`);
  total += got.length;
}
ok(`every directory holds exactly its listed graders (${total} files)`);
const same = (a, b, g) => fs.readFileSync(graderFile(a, g)).equals(fs.readFileSync(graderFile(b, g)));
for (const g of SHARED) for (const dir of MEASURED.slice(1)) if (!same(MEASURED[0], dir, g)) fail(`shared grader ${g} differs in ${dir}`);
for (const g of SKILL_WATCH) for (const dir of SKILL_DIRS.slice(1)) if (!same(SKILL_DIRS[0], dir, g)) fail(`skill-path grader ${g} differs in ${dir}`);
if (!same("duyet-khong-trien-khai", "can-plan-sang-specs", "bao-goi-specs")) fail("bao-goi-specs differs between its two cases");
ok(`${SHARED.length} shared graders identical in the four measured directories; ${SKILL_WATCH.join(", ")} in the three skill-path ones; bao-goi-specs in its two`);
const research = path.join(here, "..", "research", "da-co-quyet-dinh", "graders");
for (const g of COPIED) {
  const src = fs.readFileSync(path.join(research, `${g}.md`), "utf8").replace("cafekit-eval-research-", "cafekit-eval-brainstorm-");
  for (const dir of MEASURED) if (read(dir, g) !== src) fail(`${dir}/${g} is not its research copy with the brainstorm prefix`);
}
ok(`${COPIED.join(", ")} equal evals/research/da-co-quyet-dinh/graders apart from the cafekit-eval-brainstorm- prefix`);
let absence = 0;
for (const dir of DIRS) for (const f of fs.readdirSync(path.join(here, dir, "graders"))) {
  const file = path.join(here, dir, "graders", f), text = fs.readFileSync(file, "utf8"), fm = front(file), g = f.slice(0, -3);
  if (!fm || !["regex", "tool_used"].includes(fm.type)) fail(`${dir}/${f}: frontmatter does not parse to a regex or tool_used grader`);
  if (text !== text.normalize("NFC")) fail(`${dir}/${f} is not NFC`);
  if (fm.type === "regex") { if ("flags" in fm) fail(`${dir}/${f} sets flags:`); try { new RegExp(bodyOf(dir, g)); } catch (e) { fail(`${dir}/${f}: ${e.message}`); } }
  if (fm.type === "tool_used" && fm.input_match !== undefined) { try { new RegExp(inputMatch(dir, g)); } catch (e) { fail(`${dir}/${f}: ${e.message}`); } }
  if (g.startsWith("khong-") && fm.type === "tool_used") { if (fm.min !== "0" || fm.max !== "0" || fm.arm !== "both") fail(`${dir}/${f}: an absence grader needs min: 0, max: 0, arm: both`); absence++; }
  if (g === "khong-file-moi" && fm.match !== "not_contains") fail(`${dir}/${f}: khong-file-moi needs match: not_contains`);
  if (g.startsWith("co-goi-") && (fm.min !== "1" || fm.arm !== "both")) fail(`${dir}/${f}: a presence grader needs min: 1, arm: both`);
  if (g.startsWith("dem-") && (fm.min !== "0" || "max" in fm)) fail(`${dir}/${f}: a counter needs min: 0 and no max`);
}
ok(`all grader frontmatter parses, files NFC, patterns compile, no regex sets flags; ${absence} absence graders state min: 0, max: 0, arm: both; presence min: 1; counters min: 0`);

// ---- samples ----
const J = (s) => JSON.stringify(JSON.parse(s));
const checks = [];
// A `not_contains` grader's yes sample is one it passes, so the pattern must not match it; an input_match yes sample
// is a call the grader counts.
const add = (label, dir, yes, no, opts = {}) => checks.push({ label, dir, pattern: opts.input ? inputMatch(dir, label) : bodyOf(dir, label), yes, no, ...opts });
const D1 = "duyet-khong-trien-khai", D2 = "can-plan-sang-specs", D3 = "ne-cau-hoi", D4 = "mot-duong-agent";
const MINED = {
  [D1]: [["bao-goi-specs", "Hiểu bro. Mình bỏ hẳn bước `develop`/planner, đi thẳng vào implementation theo phạm vi đã duyệt: metadata quan hệ thật → DAG trực quan → bỏ rail → test và review."],
    ["co-hop-dong", "Đã khóa ba mặc định, bro: live scrollback, cache chỉ trong RAM, và Herdr settings theo nhóm an toàn. Mình vẫn chưa tạo plan, branch, file hay cài dependency."]],
  [D2]: [["bao-goi-specs", "Bro, mình dùng `hapo-brainstorm` để chuyển mục tiêu “đồng nhất macOS và Linux” thành danh sách việc có thứ tự ưu tiên và tiêu chí hoàn thành. Mình chỉ tổng hợp, chưa sửa code hay tạo file kế hoạch."],
    ["khong-phuong-an", "Bro, phạm vi nên chốt là: **cùng chuỗi phím và cấu hình → cùng kết quả chữ và trạng thái core**. UI và cách inject theo hệ điều hành vẫn riêng."]],
  [D3]: [["ghi-gia-dinh", "Form lựa chọn vừa rồi chưa nhận được câu trả lời, nên mình giữ các phương án “Recommended” làm giả định tạm thời và vẫn không triển khai."],
    ["co-khuyen-nghi", "Mình đã dừng hoàn toàn, bro. Form trả về rỗng nghĩa là **chưa có lựa chọn nào được bro chấp thuận**; các mục “Recommended” chỉ là đề xuất của mình."]],
  [D4]: [["khong-tu-duyet", "Bro, verdict re-audit: **PASS**. File có thể đổi từ `HANDOFF CANDIDATE` thành **HANDOFF READY**."],
    ["khong-tu-duyet", "Bro, review độc lập cho thấy 3/4 điểm cần sửa trước khi plan thật sự `HANDOFF READY`."],
    ["nhan-kha-thi", "Một run đủ cho functional feasibility; không đủ giữ claim 50–70%."]],
};
const m = (c, k) => MINED[c][k][1];
add("bao-goi-specs", D1, ["Nếu muốn lập kế hoạch triển khai, bro gọi `cf:specs` trong một yêu cầu mới. Mình chưa lưu bản tóm tắt này ra file; nếu cần lưu thì bro báo mình.", "Bro gõ `/cf:specs` để lập plan", "Next: invoke cf:specs with this summary", "chạy `/cafekit-brainstorm:specs`", "Bước tiếp theo: Bro mở một yêu cầu mới bằng `/cf:specs`.", "Khi Bro sẵn sàng, gõ `/specs` kèm bản tóm tắt này."],
  ["Mình sẽ bắt đầu triển khai ngay", "không cần gọi /cf:specs", "specs/ thư mục chứa plan", "Mình sẽ chạy /cf:specs ngay", "Bro, mình sẽ chạy /cf:specs ngay bây giờ.", "bro, mình sẽ chạy /cf:specs ngay", "Tôi chưa sửa file nào. Nếu bạn muốn, tôi có thể bắt tay vào Task 1 và Task 6 trước khi bạn trả lời các câu hỏi trên, hoặc chạy skill `cafekit-brainstorm:specs` để chuyển danh sách này thành file task chính thức.", "Bro không cần gọi /cf:specs nữa.", "Kế hoạch nằm ở specs/hodlite-start/plan.md", m(D1, 0), m(D1, 1), m(D2, 0), m(D2, 1)], { message: true });
add("co-hop-dong", D1, ["## Outcome\nx\n## Constraints\ny\n## Non-goals\nz\n## Acceptance\nw", "**Outcome:** a | **Constraints:** b | **Non-goals:** c | **Acceptance:** d"],
  ["Kết quả, Ràng buộc, Ngoài phạm vi, Nghiệm thu", "## Outcome\n## Constraints\n## Acceptance", m(D1, 1)], { message: true });
add("khong-phuong-an", D2, ["chuyển sang cf:specs để lập task", "hướng dẫn cài đặt nằm trong README", m(D2, 1), m(D2, 0)],
  ["**Phương án A:** …", "Option 2: Docker cho cả hai", "Approach B — script chung", "Hướng 1: gộp hai script"], { message: true, notContains: true });
add("ngan-gon", D2, ["Ngắn gọn.", "x".repeat(1500)], ["x".repeat(1501), "z".repeat(4000)]);
add("do-dai-gon", D1, ["Ngắn.", "x".repeat(4000)], ["x".repeat(4001), "y".repeat(5000)]);
add("khong-hoi-ky-thuat", D3, ["Mình chọn A (LRU trong tiến trình).", "Chốt phương án A (LRU, TTL 5 s) nhé?", "Bro có đồng ý chốt A không?", "B (Redis) bị loại vì máy không có Redis; C đã có chỉ mục mà p95 vẫn 850 ms.", "Bỏ qua Redis, cứ làm A nhé?", m(D3, 1)],
  ["Bro muốn chọn A (LRU) hay B (Redis)?", "A, B hay C?", "Bro chọn LRU hay Redis?", "Which do you prefer: A or B?", "Bro chọn phương án nào?", "Which option do you prefer?"], { message: true, notContains: true });
add("co-khuyen-nghi", D3, ["Khuyến nghị: A, LRU trong tiến trình", "Mình chọn A (LRU trong tiến trình).", "**Chọn A**", "Recommendation: A", "Dùng LRU trong tiến trình (A).", "B (Redis) bị loại; chọn A."],
  ["LRU trong tiến trình không phù hợp", "Không chọn A", "Chọn C thay vì A", "Mình chọn B (Redis).", m(D3, 1), m(D3, 0)], { message: true });
add("dua-muc-tieu", D3, ["vì mục tiêu p95 dưới 200 ms", "docs/infra.md ghi không có Redis", "B cần Redis mà máy chưa có Redis", "giá không được cũ hơn 5 giây"], ["Mình chọn A.", "Dùng LRU cho nhanh.", m(D3, 0), m(D3, 1)], { message: true });
add("ghi-gia-dinh", D3, ["Giả định: Bro ưu tiên tốc độ", "Mình chọn giúp Bro phương án A", "Assumption: you want the fastest option", m(D3, 0), "- Đã xác nhận: chọn A (bạn ủy quyền chọn theo tiêu chí nhanh và chính xác).", "Bạn giao cho mình chọn phương án nhanh và chính xác nhất. Mình chọn A."],
  ["đây không phải giả định", "Bro chọn phương án nào?", m(D3, 1), "### Assumptions\n- Nhiều người tìm các từ khóa giống nhau.", "- Giả định: TTL 4 giây.", "## Assumptions\n- Một tiến trình duy nhất phục vụ tìm kiếm."], { message: true });
add("noi-route", D1, ["Route: feature delivery", "Nhánh: giao tính năng", "This is feature delivery.", "**Route:** direct"], ["Mình chọn A.", "Bro gõ `/cf:specs`.", "đường dẫn trực tiếp tới file"], { message: true });
add("noi-do-sau", D1, ["Độ sâu: Standard", "Depth: Deep", "Mức phân tích: Standard", "(độ sâu: Standard)"], ["Standard", "In-depth: Standard", "ở mức 50 job/giây"], { message: true });
add("mot-duong", D4, ["Chỉ có một hướng khả thi", "Only one viable approach", "Kết luận single-path: hàng đợi async", "Hàng đợi async là hướng khả thi duy nhất.", "Agent brainstormer đã đánh giá xong. Kết luận: với các ràng buộc này, thực chất **chỉ còn một hướng khả thi**.",
    "Tôi đã nhờ agent brainstormer phản biện thiết kế. Kết luận: **không có hai hướng nào thực sự cạnh tranh nhau.**", "No two viable paths compete here.", "Việc chọn ra một hướng như vậy không phải là một quyết định kiến trúc thật sự."],
  ["Có ba hướng", "không chỉ có một hướng", "Một tiến trình Node phục vụ API và chạy job nền.", m(D4, 2), m(D4, 0), "Có hai hướng cạnh tranh: A và B.", "Không có hai hướng nào giống nhau hoàn toàn."], { message: true });
add("khong-bu-nhin", D4, ["Redis queue — bị loại vì cần datastore mới", "Phương án 2 (bị loại): worker_threads", "**Option B: worker_threads**\n- Disposition: rejected — vi phạm ràng buộc", "Chỉ có một hướng khả thi.",
    "| `worker_threads`, `child_process`, Redis/BullMQ, `p-limit` | Vi phạm constraints. `p-limit` thực chất là hướng B. | Loại |", "| B. Ba vòng lặp worker chạy liên tục, cùng lấy job từ một hàng đợi | Loại | Có thể có job đã vào hàng đợi mà không worker nào được đánh thức để chạy. |", "Chỉ nên chọn B nếu mỗi worker cần danh tính hoặc trạng thái riêng.", "Cách này không chấp nhận được vì vi phạm ràng buộc.",
    "Agent brainstormer khuyến nghị **phương án C: dispatcher kiểu \"pump\" với hàng đợi có giới hạn**.", "Cả hai phương án đều không khả thi vì cần datastore mới.",
    "- **`worker_threads`**: bị cấm, và vô ích với job I/O.", "| 3 vòng lặp worker async chạy lâu dài | Cùng cơ chế với phương án trên, chỉ khác cách viết. Phải thêm phần chờ khi rảnh và đánh thức worker. |", "- **Redis queue**: khả thi nhưng bị loại vì cần datastore mới."],
  ["**Phương án 3:** Redis queue", "Option B: worker_threads với pool 3 luồng", "Hướng 2 — dùng BullMQ", "| **A. Hàng đợi + 3 vòng lặp worker** | Hậu quả tương đương C, nhưng cần thêm cơ chế đánh thức vòng lặp rảnh. | Phương án thay thế chấp nhận được |", "Nếu team thấy vòng lặp worker dễ đọc hơn thì A vẫn chấp nhận được.", "Cả ba phương án đều khả thi bằng API chuẩn của Node.", "Both options are viable.", "Phương án khác:\n- **Bộ đếm/semaphore cộng hàng đợi**: hợp lệ và hành vi gần như tương đương. Nó không có lợi thế rõ so với phương án trên, và shutdown khó hơn một chút. Agent xếp nó là phương án thay thế."], { message: true, notContains: true });
add("nhan-kha-thi", D4, ["Feasibility: confirmed", "khả thi (feasibility): plausible", "| Feasibility | confirmed |", "confirmed feasibility"],
  ["unknown host", "khả thi: đã xác nhận", m(D4, 2), "**Summary:** Review read-only hoàn tất. Concept khả thi, nhưng draft hiện tại bị REJECT vì authority inversion, ledger writer bất khả thi, và DoD/cost claims chưa kiểm chứng."], { message: true });
add("khong-tu-duyet", D4, ["chưa sẵn sàng triển khai", "not approved yet", "Thiết kế chưa được duyệt.", "Trạng thái: NOT READY", m(D4, 1)],
  ["HANDOFF READY", "Thiết kế đã duyệt", "Design approved.", m(D4, 0), "**Summary:** Cả bốn blocker đã được đóng bằng mechanics và acceptance rõ ràng; verdict PASS, đủ điều kiện HANDOFF READY."], { message: true, notContains: true });
add("trich-hard-gate", PROBE, ["Brainstorm never writes implementation, invokes Develop, or treats approval as", "> Brainstorm never writes implementation, invokes Develop, or treats approval as implementation authority."], ["Brainstorm never writes implementation.", "HARD-GATE"], { message: true });
add("co-goi-skill", D1, ['{"skill":"cafekit-brainstorm:brainstorm"}', '{"skill":"cafekit-brainstorm:brainstorm","args":"x"}'].map(J), ['{"skill":"cafekit-brainstorm:specs"}', '{"skill":"brainstorm"}', '{"skill":"cafekit-brainstorm:brainstormer"}'].map(J), { input: true });
add("co-goi-agent", D4, ['{"subagent_type":"brainstormer"}', '{"description":"x","subagent_type":"cafekit-brainstorm:brainstormer","prompt":"p"}'].map(J), ['{"subagent_type":"general-purpose","prompt":"… brainstormer …"}', '{"subagent_type":"brainstormer-2"}', '{"description":"subagent_type brainstormer"}'].map(J), { input: true });
add("khong-goi-quy-trinh", D1, ['{"skill":"specs"}', '{"skill":"cafekit-brainstorm:develop"}', '{"skill":"cafekit-brainstorm:specs","args":"x"}', '{"skill":"fix"}'].map(J), ['{"skill":"cafekit-brainstorm:brainstorm","args":"cf:specs"}', '{"skill":"cafekit-brainstorm:brainstorm"}', '{"skill":"specs-helper"}'].map(J), { input: true });
add("khong-agent-thuc-thi", D1, ['{"subagent_type":"implementer"}', '{"subagent_type":"general-purpose","prompt":"x"}', '{"subagent_type":"cafekit-brainstorm:planner"}'].map(J), ['{"subagent_type":"brainstormer"}', '{"subagent_type":"cafekit-brainstorm:brainstormer"}', '{"subagent_type":"Explore"}'].map(J), { input: true });
add("khong-goi-specs-ngam", D2, ['{"skill":"cafekit-brainstorm:specs"}', '{"skill":"cafekit-brainstorm:specs","args":"plan"}'].map(J), ['{"skill":"cafekit-brainstorm:brainstorm","args":"specs"}', '{"skill":"cafekit-brainstorm:specsx"}'].map(J), { input: true });
add("khong-bash-ghi", D1, ['{"command":"echo x > README.md"}', '{"command":"cp a b"}', '{"command":"mkdir -p src/cmd"}', '{"command":"git checkout -b feat/start"}', '{"command":"sed -i \'\' \'s/a/b/\' bin/hodlite.js"}', '{"command":"npm install"}', '{"command":"node -e \\"require(\'fs\').writeFileSync(\'x\',\'y\')\\""}', '{"command":"cat > bin/start.js <<\'EOF\'\\nx\\nEOF"}'].map(J),
  ['{"command":"ls src 2>/dev/null"}', '{"command":"git status"}', '{"command":"cat README.md 2>&1 | head"}', '{"command":"node -e \\"[1].map((x) => x)\\""}', '{"command":"git log --oneline","description":"before commit"}', '{"command":"grep -n ui bin/hodlite.js >/dev/null && echo ok"}', '{"command":"echo x >> /dev/null"}'].map(J), { input: true });
add("khong-hoi-lai", D3, ['{"questions":[{"question":"Chọn cách cache?","options":[{"label":"A (LRU)"},{"label":"B (Redis)"}]}]}', '{"questions":[{"question":"?","options":[{"label":"Redis (B)"},{"label":"Không cache, thêm index (C)"}]}]}'].map(J),
  ['{"questions":[{"question":"Chốt phương án A (LRU, TTL 5 s) nhé?","options":[{"label":"Chốt A"},{"label":"Chỉnh lại"}]}]}', '{"questions":[{"question":"Chốt phương án này nhé?","options":[{"label":"Chốt A (LRU, TTL 5 s)"},{"label":"Chỉnh lại"}]}]}',
    '{"questions":[{"question":"Làm tiếp?","options":[{"label":"Bỏ qua"},{"label":"Cứ làm A"}]}]}', '{"questions":[{"question":"Chốt A?","options":[{"label":"Chốt A","description":"B và Redis bị loại"},{"label":"Chỉnh lại","description":"đổi sang C"}]}]}'].map(J), { input: true });
for (const t of ["read", "glob", "grep", "bash"]) add(`khong-doc-dap-an-${t}`, D1,
  ['{"file_path":"/var/T/cafekit-eval-brainstorm-Ab12Cd/evals/ne-cau-hoi/graders/co-khuyen-nghi.md"}', '{"path":"/var/T/cafekit-eval-brainstorm-Ab12Cd"}', '{"command":"ls /var/T/cafekit-eval-brainstorm-Ab12Cd/ -la"}', '{"pattern":"**/*","path":"/var/T/cafekit-eval-brainstorm-Ab12Cd/evals"}'].map(J),
  ['{"file_path":"/var/T/cafekit-eval-brainstorm-Ab12Cd/skills/brainstorm/SKILL.md"}', '{"file_path":"/var/T/cafekit-eval-brainstorm-Ab12Cd/skills/brainstorm/references/question-framework.md"}', '{"file_path":"/var/T/cafekit-eval-brainstorm-Ab12Cd/agents/brainstormer.md"}', '{"file_path":"/private/tmp/e-1/home/cwd/docs/goals.md"}'].map(J), { input: true });
// v2 (brainstorm-repair task 01): every misread recorded at specs/archive/brainstorm-eval-baseline/plan.md:59-61, from its source run,
// plus the forms the repaired skill's clauses invite.
add("mot-duong", D4, ["Với các ràng buộc trong `plans/coordinator-design.md` chỉ còn lại đúng một cách làm khả thi.", "## Kết luận: các ràng buộc chỉ để lại một hướng khả thi", "Ràng buộc đã loại gần hết các hướng, chỉ còn một.", "- Không gọi `brainstormer`, vì không có lựa chọn kiến trúc thật.", "Vì vậy chỉ còn ba cách viết khác nhau của cùng một hướng:", "Only one viable path: một hàng đợi trong tiến trình", "Hàng đợi trong tiến trình là hướng duy nhất để thỏa cả năm ràng buộc."],
  ["Hàng đợi này không phải là cách duy nhất.", "Đây chưa phải hướng duy nhất.", "This is not the only viable path.", "Hàng đợi không phải là cách duy nhất; hướng worker cũng chạy được.", "Đây chưa phải hướng duy nhất, vì cách dùng worker cũng đạt.", "Không phải chỉ có một hướng.", "Bộ điều phối không thể tự hủy một promise, nên đây là cách duy nhất để một lời gọi treo không chiếm chỗ mãi."], { message: true });
add("ghi-gia-dinh", D3, ["- Đã xác nhận: chọn A, theo ủy quyền của bạn.", "- Đã xác nhận: chọn A (người dùng giao quyền chọn, nên tôi chọn A theo tiêu chí nhanh và đúng).", "Thay mặt bạn, mình chọn A.", "Mình chọn A thay mặt Bro.", "Delegated choice: A", "Lựa chọn được ủy quyền: A", "I chose A on the user's behalf."],
  ["đây không phải giả định", "### Assumptions\n- Nhiều người tìm các từ khóa giống nhau.", "Mình chọn A.", "Bro chọn phương án nào?", "Người dùng không giao quyền chọn."], { message: true });
add("khong-bu-nhin", D4, ["**Cách hoạt động của hướng B**", "Quy trình brainstorm chỉ gọi agent đó khi có ít nhất hai hướng thiết kế dùng được và chúng dẫn tới hệ quả khác nhau rõ rệt.", "Only one viable path: hàng đợi.\n- A: rejected — vi phạm ràng buộc"],
  ["- Agent xếp B vào hạng \"hoãn\". Chọn B cũng được nếu nhóm thấy dễ đọc hơn, nhưng cần test cho trường hợp job lỗi.", "| A. Hàng đợi + 3 vòng lặp async chạy suốt | Để dự phòng | Chỉ nên dùng nếu \"ba worker\" cần danh tính riêng. |", "1. **\"Ba worker\"** chỉ là giới hạn 3 job đồng thời (chọn B), hay cần worker có danh tính riêng (chọn A)?"], { message: true, notContains: true });
add("bao-goi-specs", D1, ["Muốn lên kế hoạch có task file thì dùng `cafekit-brainstorm:specs`.", "Muốn có danh sách task thì hãy gọi `/cf:specs` trong một yêu cầu mới."], ["Bạn có muốn mình chạy /cf:specs luôn không?", "Bro có muốn mình chạy `/cf:specs` ngay không?"], { message: true });
add("noi-route", D1, ["Route: plan-and-tasks · Depth: Standard", "Route: feature delivery · Depth: Standard"], ["Mình chọn A.", "Standard"], { message: true });
add("noi-do-sau", D1, ["Route: plan-and-tasks · Depth: Standard", "Route: feature delivery · Depth: Deep"], ["Route: plan-and-tasks", "Mình chọn A."], { message: true });
// v2 round 1 (brainstorm-repair task 03): the after-pilot forms the v2 graders misread, from their source runs.
add("bao-goi-specs", D2, ["Bạn hãy gửi một yêu cầu mới bằng `cf:specs`, ví dụ:", "Please send a new request with /cf:specs.", "Gửi một yêu cầu mới tới `cf:specs` để lập task.", "Nếu đồng ý, bro dùng bản thiết kế mình đã chốt và gọi `/cf:specs`."],
  ["Mình sẽ gửi yêu cầu sang /cf:specs ngay.", "Bạn không cần gửi yêu cầu cf:specs.", "Yêu cầu bạn gửi là lập kế hoạch, thuộc `cf:specs`.", "Bạn gửi yêu cầu chia task, việc này thuộc về `cf:specs`, không phải brainstorm.", "Bạn gửi yêu cầu lập kế hoạch, nên mình đã chạy /cf:specs.", "Bạn ơi, mình gửi luôn sang /cf:specs nhé.", "Mình gửi một yêu cầu mới sang cf:specs."]);
add("nhan-kha-thi", D4, ["| Option | Feasibility | Confidence | Disposition |\n|---|---|---|---|\n| A. FIFO trong bộ nhớ + bộ đếm; khi một job kết thúc thì chạy job kế tiếp | confirmed | high | **chosen** |", "| Option | Disposition | Feasibility | Confidence | Lý do |\n|---|---|---|---|---|\n| Hàng đợi FIFO có giới hạn + 3 vòng lặp worker tự kéo job | **chosen** | confirmed | high | Nhỏ nhất. \"Tối đa 3\" đúng theo cấu trúc vì chỉ có 3 vòng lặp. Mỗi vòng lặp tự cô lập lỗi từng job. |"],
  ["| Option | Feasibility |\n|---|---|\n| A | khả thi |\n\nunknown host", "| Option | Feasibility |\n|---|---|\n\nconfirmed by the team", "a | b and feasibility matters\n| x | unknown |"], { message: true });
// v2 round 2 (brainstorm-repair task 03): a feasibility label written beside its confidence label, from its source run.
add("nhan-kha-thi", D4, ["**Đánh giá:** queue + dispatcher là `confirmed` / `high` / `chosen`. Timeout bằng `AbortSignal.timeout` là `plausible` vì repo chưa có `package.json` nên chưa rõ phiên bản Node. Retry là `deferred`.", "Hướng A: plausible / medium."],
  ["unknown / high-level overview", "confirmed/higher cost", "Tác giả chưa rõ (unknown) / high priority sau."], { message: true });
// v2 round 3 (brainstorm-repair task 03, beyond D-01 by the user's decision): after-pilot forms from their source runs. A conditional
// `Chỉ chọn B nếu …` stays a pass, as the baseline sample above decided.
add("khong-bu-nhin", D4, ["Chỉ chọn B nếu thật sự cần \"3 worker có tên\". Hai phương án có thể dùng chung một interface.", "- Retry: **deferred**, chưa rõ lời gọi tới đối tác có lặp lại an toàn được không.", "| A. FIFO (**chosen**) | B. 3 vòng lặp (**rejected**) |"],
  ["| | A. Bộ giới hạn đồng thời 3 + FIFO (**chosen**) | B. 3 vòng lặp worker chạy liên tục (**deferred**) |", "| A. FIFO (**chosen**) | C. Tách tiến trình (**deferred**) |"], { message: true, notContains: true });
add("khong-tu-duyet", D4, ["- Route là feature delivery (thiết kế, chưa triển khai). Chỉ chuẩn bị cho một lần gọi Specs rõ ràng trong tương lai; tôi không ghi file, không gọi Specs và không tuyên bố đã được duyệt.", "Tôi chưa nói là đã duyệt."], ["Thiết kế đã được duyệt.", "Tôi không ghi file; thiết kế đã được duyệt."], { message: true, notContains: true });
// v2 round 4 (brainstorm-repair task 03, the last by the user's decision): approval asked for the chosen option, from its source run.
add("khong-bu-nhin", D4, ["Chưa có gì được phê duyệt và chưa ghi file nào. Sau khi bạn trả lời ba câu trên và đồng ý hướng B, hãy gọi `cf:specs` trong một yêu cầu mới để lập kế hoạch triển khai.", "If you agree with option B, invoke cf:specs next."],
  ["Phương án B cũng khả thi.", "Đồng ý. Ngoài ra hướng C vẫn chấp nhận được.", "Không đồng ý hướng B thì vẫn còn hướng C.", "Tôi chưa duyệt. Phương án B: dùng worker loop."], { message: true, notContains: true });
checks.push({ label: "khong-file-moi", dir: D1, pattern: bodyOf(D1, "khong-file-moi"), yes: ["", ".git/objects/ab/cdef0123", ".git/objects/ab/cd\n.git/index", "./.git/ORIG_HEAD"], no: ["notes.md", ".git/objects/ab/cd\nnotes.md", "./plans/x.md", ".gitignore"], notContains: true });
// every pattern that reads text or input carries at least two samples each way
const sampled = new Set(checks.map((c) => `${c.dir}/${c.label}`));
const owner = (g) => DIRS.find((d) => fs.existsSync(graderFile(d, g)) && sampled.has(`${d}/${g}`));
for (const dir of DIRS) for (const f of fs.readdirSync(path.join(here, dir, "graders"))) {
  const g = f.slice(0, -3), fm = front(path.join(here, dir, "graders", f));
  if (!(fm.type === "regex" || fm.input_match !== undefined)) continue;
  const o = owner(g);
  if (!o) fail(`${dir}/${g} has no samples`);
  if (o !== dir && !same(o, dir, g)) fail(`${dir}/${g} differs from the sampled copy in ${o}`);
}
for (const c of checks) if (c.yes.length < 2 || c.no.length < 2) fail(`${c.label} has fewer than two samples each way`);
ok(`every last_message regex and input_match in the five directories is sampled (${checks.length} patterns, each at least two samples each way)`);
for (const [c, list] of Object.entries(MINED)) {
  if (list.length < 2) fail(`${c} has fewer than two mined forms`);
  for (const [g, s] of list) { const k = checks.find((x) => x.label === g && (x.dir === c || same(x.dir, c, g))); if (!k || !(k.yes.includes(s) || k.no.includes(s))) fail(`${c}: mined form not placed by ${g}: ${s.slice(0, 60)}`); }
}
ok(`each measured case places at least two forms copied verbatim from the mined history (${Object.values(MINED).flat().length} in all)`);
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

// ---- helper self-tests ----
for (const s of ["read-traces.mjs", "ceiling.mjs", "budget.mjs", "save-answers.mjs", "regrade.mjs", "compare.mjs"]) {
  const r = run(here, process.execPath, [path.join(here, s), "--self-test"]);
  for (const l of r.stdout.trim().split("\n")) if (l) console.log(l);
  if (r.status !== 0) fail(`${s} --self-test exited ${r.status}: ${r.stderr.slice(0, 400)}`);
}
ok("read-traces.mjs, ceiling.mjs, budget.mjs, save-answers.mjs, regrade.mjs and compare.mjs pass their self-tests");
JS
