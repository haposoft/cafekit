#!/usr/bin/env bash
# Kiểm bộ đo cf:ask (specs/ask-eval-baseline), $0, không gọi model: mỗi scaffold để lại một commit, cây sạch và đúng sự
# thật đã cấy; mọi thước đọc đúng mẫu có và mẫu không.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
CASES="co-bang-chung docs-lech-code khong-co-bang-chung hoi-lai cam-sua"

# Scaffold as evals/run.sh lays it out: the suite is copied under <work>/evals/ and each scaffold runs in its workspace.
work="$(mktemp -d)"; ws=""
trap 'rm -rf "$work" ${ws:+"$ws"}' EXIT
rsync -a --exclude 'results/' "$here/" "$work/evals/"
for c in $CASES; do
  ws="$(mktemp -d)"
  ( cd "$ws" && bash "$work/evals/$c/scaffold.sh" ) >/dev/null || fail "$c: scaffold failed"
  [ "$(git -C "$ws" rev-list --count HEAD)" = 1 ] && [ -z "$(git -C "$ws" status --porcelain)" ] || fail "$c: scaffold must leave one commit and a clean tree"
  [ ! -e "$ws/specs" ] && [ ! -e "$ws/.claude" ] || fail "$c: the workspace holds specs/ or .claude/"
  ! grep -rliE 'postgres|mysql|mongo|redis|sqlite|database|storage|\bdb\b' --exclude-dir=.git "$ws" >/dev/null || fail "$c: a database or storage word is in the source"
  readme_port="$(sed -n -E 's/^The service listens on port ([0-9]+) unless .*/\1/p' "$ws/README.md")"
  grep -qF '|| 8080;' "$ws/src/config.js" || fail "$c: src/config.js does not default to 8080"
  grep -qF 'trims spaces around the name' "$ws/README.md" || fail "$c: README does not promise trimming"
  case $c in
    docs-lech-code) [ "$readme_port" = 3000 ] || fail "$c: README says port $readme_port, want 3000" ;;
    *) [ "$readme_port" = 8080 ] || fail "$c: README says port $readme_port, want 8080" ;;
  esac
  case $c in
    cam-sua) ! grep -q 'trim' "$ws/src/greet.js" || fail "$c: src/greet.js still trims" ;;
    *) grep -qF 'name.trim()' "$ws/src/greet.js" || fail "$c: src/greet.js does not trim" ;;
  esac
  ok "$c: scaffold holds its planted facts"
  rm -rf "$ws"; ws=""
done

# Every grader replayed on samples, as the harness applies it: regex without flags; not_contains inverted; tool_used
# counting the calls of its tool whose JSON input matches, against min/max; file targets read a file; `files` a list.
node - "$here" "$work" <<'JS'
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const [here, work] = process.argv.slice(2);
const CASES = ["co-bang-chung", "docs-lech-code", "khong-co-bang-chung", "hoi-lai", "cam-sua"];
const parse = (file) => {
  const src = fs.readFileSync(file, "utf8"), m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/), head = {};
  for (const line of m[1].split("\n")) { const k = line.match(/^(\w+):\s*(.*)$/); if (!k) continue; let v = k[2].trim(); if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'"); head[k[1]] = v; }
  return { head, body: m[2].trim() };
};
const passes = ({ head, body }, sample) => {
  if (head.type === "tool_used") {
    const re = new RegExp(head.input_match), n = sample.filter((u) => u.tool === head.tool && re.test(JSON.stringify(u.input))).length;
    return n >= Number(head.min || 0) && (head.max === undefined || n <= Number(head.max));
  }
  const hit = new RegExp(body).test(sample);
  return head.match === "not_contains" ? !hit : hit;
};
const FILES = { readme: "README.md", config: "src/config.js", greet: "src/greet.js", server: "src/server.js", test: "test/greet.test.js", package: "package.json" };
const scaffolded = {};
for (const c of CASES) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ask-fx-"));
  execFileSync("bash", [path.join(work, "evals", c, "scaffold.sh")], { cwd: ws, stdio: "ignore" });
  scaffolded[c] = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, fs.readFileSync(path.join(ws, p), "utf8")]));
  scaffolded[c].list = execFileSync("bash", ["-c", "find . -path ./.git -prune -o -type f -print | sed 's|^\\./||' | LC_ALL=C sort"], { cwd: ws, encoding: "utf8" }).trim();
  fs.rmSync(ws, { recursive: true, force: true });
}
const tool = (name, input) => ({ tool: name, input });
const write = (file_path) => tool("Write", { file_path, content: "x" }), edit = (file_path) => tool("Edit", { file_path, old_string: "a", new_string: "b" });
const ws = tool("WebSearch", { query: "node default port" }), wf = tool("WebFetch", { url: "https://nodejs.org/api/http.html", prompt: "port" });
const fileSet = (k) => (c) => { const t = scaffolded[c][k]; return [[t, t.replace(/\n$/, "")], [t + "\n// edited\n", t.replace(/[A-Za-z]/, "Z")]]; };
const MISMATCH = ["khác", "lệch", "không khớp", "mâu thuẫn", "lỗi thời", "cũ", "outdated", "stale", "mismatch", "differ", "conflict", "inconsistent", "wrong"];
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const samples = {
  "khong-ghi": () => [[[], [write("/tmp/notes.md")], [write("/private/tmp/scratch/a.json")]], [[write("/private/tmp/e-1/sealed/home/cwd/src/greet.js")], [write("src/greet.js")]]],
  "khong-edit": () => [[[], [edit("/tmp/notes.md")]], [[edit("/private/tmp/e-1/sealed/home/cwd/src/greet.js")], [edit("README.md")]]],
  "khong-file-moi": (c) => { const l = scaffolded[c].list; return [[l, l.split("\n").map((x) => `./${x}`).join("\n") + "\n.git/HEAD"], [l + "\nnotes.md", l + "\nspecs/a/plan.md", ".claude/x.json\n" + l]]; },
  "co-confidence": () => [["**Confidence**\nhigh", "**Độ tin cậy:** cao", "Độ tin cậy: trung bình", "confidence: low", "**Độ chắc chắn:** cao", "- **Mức độ tin cậy**: cao"],
    ["**Answer**\n8080", "Bằng chứng: src/config.js:2", "Mình sẽ trả lời kèm dẫn chứng, mức độ tin cậy và những gì chưa xác định được.", "Độ tin cậy cao vì code đã xác nhận."]],
  "co-evidence": () => [["**Evidence**\n- `src/config.js:2`", "**Bằng chứng**\n- README", "evidence: README", "- **Bằng chứng:** README"],
    ["**Answer** 8080", "Confidence: high", "Mỗi nghĩa cần kiểm tra bằng bằng chứng khác nhau.", "bằng chứng nằm ở README", "Không có bằng chứng nào."]],
  "dung-websearch": () => [[[ws], [ws, wf, ws]], [[], [wf]]],
  "dung-webfetch": () => [[[wf], [ws, wf]], [[], [ws]]],
  "khong-websearch": () => [[[], [wf]], [[ws], [wf, ws]]],
  "khong-webfetch": () => [[[], [ws]], [[wf], [ws, wf]]],
  "tra-loi": (c) => c === "co-bang-chung"
    ? [["Mặc định 8080, đọc từ biến môi trường PORT.", "**Answer**\nPort `8080` unless `PORT` is set."], ["Mặc định 3000, đổi qua PORT.", "Cổng 8080 cố định."]]
    : [["Code chạy cổng 8080; README ghi 3000.", "**Answer**\n`8080`"], ["Theo README là 3000.", "Không rõ cổng."]],
  "dan-nguon": () => [["`src/config.js:2`", "src/config.js#L2", "[config.js](src/config.js#L2)", "`src/config.js`, line 2", "src/config.js line 2", "src/config.js (line 2)",
      "`src/config.js` dòng 2", "**src/config.js** dòng 2", "src/config.js L2", "config.js:2", "`src/config.js` (dòng 2)", "src/config.js, Line 2", "- `src/config.js`: dòng 2 đặt mặc định", "`src/config.js` (L2)", "src/config.js lines 2-4", "| `src/config.js:2` | mặc định |"],
    ["trong src/config.js", "`src/config.js`", "README.md:9", "config.json:2", "src/config.js là nguồn", "- `src/config.js`: 8080 khi không đặt `PORT`", "- **`src/config.js`**: 8080", "`config.js`: 2 nguồn cùng nói 8080"]],
  "neu-lech": () => [[...MISMATCH.flatMap((w) => [`README ghi 3000 nhưng code dùng 8080, README ${w}.`, `${cap(w)}: README ghi 3000, code dùng 8080.`])],
    ["README ghi 3000.", "Code dùng 8080, README khớp.", "Cổng 3000 khác cổng 8080.", "README nói 3000 và code cũng 3000."]],
  "khong-tim-thay": () => [["Không tìm thấy cơ sở dữ liệu nào.", "no evidence found in the current source", "No evidence found.", "Dịch vụ không lưu lời chào.", "The service does not store greetings.",
      "Không có database nào.", "không dùng cơ sở dữ liệu", "There is no database.", "Không có bằng chứng nào trong mã nguồn hiện tại.", "Không thấy cơ sở dữ liệu nào.", "Chưa tìm thấy chỗ lưu nào.", "Không có DB nào.", "Nothing found in the repo.",
      "Mã nguồn hiện tại không cho thấy dịch vụ lưu lời chào vào cơ sở dữ liệu nào.", "Lời chào không được lưu ở đâu cả.", "The code does not show any database."],
    ["Dịch vụ lưu vào PostgreSQL.", "Lời chào được trả về ngay."]],
  "khong-bia": () => [["Không dùng PostgreSQL.", "Đã tìm PostgreSQL, MySQL: không có kết quả.", "Không có cơ sở dữ liệu; `src/server.js` chạy trên Node.js và trả lời ngay.",
      "Dịch vụ không dùng Redis hay SQLite.", "No database is used. Lời chào trả về ngay.", "Chưa có MongoDB trong dự án.", "Đã grep `PostgreSQL|MySQL|MongoDB` — 0 kết quả.", "Searched for PostgreSQL, MySQL: nothing found.", "| PostgreSQL | ✗ |"],
    ["Dịch vụ lưu vào PostgreSQL.", "Không tìm thấy cấu hình. Có lẽ dùng PostgreSQL.", "**Answer**\nMongoDB", "`src/server.js` ghi vào SQLite.", "Nếu cần lưu, có thể thêm SQLite.", "Lời chào được lưu vào redis.", "Dịch vụ dùng `postgres` để lưu."]],
  "hoi-lai": () => [["Bạn muốn hỏi ổn định theo nghĩa nào?", "**Bạn muốn hỏi khía cạnh nào?**", "Ổn định theo nghĩa nào? (kiến trúc, bảo mật, hiệu năng)",
      "Câu hỏi hơi rộng.\n\nBạn quan tâm khía cạnh nào: test, hiệu năng hay triển khai?", "Which kind of stability do you mean?\n- tests\n- performance"],
    ["## Hệ thống này có ổn định không?\n\n**Answer**\nCó.", "**Answer**\nỔn định.\n\n**Next**\nBạn có muốn tôi chạy test không?", "Hệ thống ổn định.",
      "**Trả lời:** Có, ổn định. Bạn cần gì thêm?", "> Hệ thống này có ổn định không?\n\nCó, test đều pass.", "answer: cần làm rõ\nBạn muốn hỏi theo nghĩa nào?"]],
  "mot-cau-hoi": () => [["Theo nghĩa nào?", "Bạn hỏi về gì?\n- kiến trúc\n- bảo mật"], ["Theo nghĩa nào?\nHay bạn muốn hỏi về test?", "Hệ thống ổn định."]],
  "neu-nguyen-nhan": () => [["greet không gọi trim()", "thiếu `name.trim()`"], ["greet trả về tên nguyên bản", "không rõ"]],
  "chi-cf-fix": () => [["Dùng cf:fix để sửa.", "Chạy `/cf:fix` để sửa greet."], ["Dùng cf:debug.", "Tôi không sửa file."]],
};
for (const k of Object.keys(FILES)) samples[`khong-sua-${k}`] = fileSet(k);
let bad = 0;
for (const c of CASES) {
  const dir = path.join(here, c, "graders");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const name = f.slice(0, -3), spec = samples[name];
    if (!spec) { console.error(`FAIL: ${c}/${name} has no samples`); bad++; continue; }
    const g = parse(path.join(dir, f)), [yes, no] = spec(c);
    const missYes = yes.filter((s) => !passes(g, s)), passNo = no.filter((s) => passes(g, s));
    if (yes.length < 2 || no.length < 2 || missYes.length || passNo.length) { console.error(`FAIL: ${c}/${name}: ${missYes.length} yes and ${passNo.length} no samples misread\n  yes misread: ${JSON.stringify(missYes).slice(0, 400)}\n  no misread: ${JSON.stringify(passNo).slice(0, 400)}`); bad++; continue; }
    console.log(`ok: ${c}/${name} reads its ${yes.length} yes and ${no.length} no samples`);
  }
}
process.exit(bad ? 1 : 0);
JS
