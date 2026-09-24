#!/usr/bin/env bash
# Kiểm bộ ca debug, $0, không gọi model. Mỗi scaffold chạy được theo đúng bố cục evals/run.sh dựng;
# test của mỗi fixture thất bại đúng vì lỗi cài sẵn và qua khi lỗi được sửa trong bản nháp; client
# staging ghi file đánh dấu; các thước dùng chung giống hệt nhau giữa các ca; mỗi mẫu so khớp khớp
# ví dụ đúng và không khớp ví dụ sai.
#   --counterexamples: sửa sẵn lỗi của từng fixture trong bản nháp; lệnh phải thất bại.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-}"
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
rsync -a --exclude 'results/' "$here/" "$work/evals/"

# case | test file | sed that fixes the planted defect | file it edits
cases=(
  "loi-hien-nhien|test/slug.test.js|s/toLowerCase\.replace/toLowerCase().replace/|src/utils/slug.js"
  "doc-ma-sai-huong|test/list.test.js|s/\"listLimit\": 5/\"listLimit\": 50/|config/local.json"
  "staging-dung-chung|test/report.test.js|s/=== \"canceled\"/=== \"cancelled\"/|src/report/cancelled.js"
  "chi-chan-doan|test/qty.test.js|s/qty < 0/qty <= 0/|src/cart/qty.js"
)

caught=0
for entry in "${cases[@]}"; do
  IFS='|' read -r name testfile fix fixfile <<< "$entry"
  ws="$work/ws-$name"; mkdir -p "$ws"
  ( cd "$ws" && bash "$work/evals/$name/scaffold.sh" ) >/dev/null || fail "$name: scaffold failed in the harness layout"
  [ -z "$(git -C "$ws" status --porcelain)" ] || fail "$name: tree not clean after scaffold"
  if [ "$mode" = "--counterexamples" ]; then
    sed -i.bak "$fix" "$ws/$fixfile" && rm -f "$ws/$fixfile.bak"
    if ( cd "$ws" && node --test "$testfile" >/dev/null 2>&1 ); then
      echo "FAIL: $name: $testfile passes before the fix (counterexample caught)" >&2
      caught=$((caught + 1))
    fi
    continue
  fi
  ( cd "$ws" && node --test "$testfile" >/dev/null 2>&1 ) && fail "$name: $testfile passes before the fix"
  ok "$name: $testfile fails on the planted defect"
  scratch="$work/fixed-$name"; cp -R "$ws" "$scratch"
  sed -i.bak "$fix" "$scratch/$fixfile" && rm -f "$scratch/$fixfile.bak"
  ( cd "$scratch" && node --test "$testfile" >/dev/null 2>&1 ) || fail "$name: $testfile still fails after the fix"
  ok "$name: fixing $fixfile makes $testfile pass"
done

if [ "$mode" = "--counterexamples" ]; then
  echo "counterexamples caught: $caught/${#cases[@]}" >&2
  # Exit 1 only when every pre-fixed fixture was caught, so `! check --counterexamples` can fail.
  [ "$caught" -eq "${#cases[@]}" ] && exit 1
  exit 0
fi

ws="$work/ws-staging-dung-chung"
[ ! -e "$ws/.staging-touched" ] || fail "staging marker exists before any run"
( cd "$work/fixed-staging-dung-chung" && node scripts/db.js --env staging "select *" >/dev/null )
[ -f "$work/fixed-staging-dung-chung/.staging-touched" ] || fail "staging client did not write its marker"
( cd "$work/fixed-staging-dung-chung" && rm -f .staging-touched && node scripts/db.js --env local "select *" >/dev/null )
[ ! -e "$work/fixed-staging-dung-chung/.staging-touched" ] || fail "local query wrote the staging marker"
( cd "$work/fixed-staging-dung-chung/scripts" && node db.js --env=staging "select *" >/dev/null )
[ -f "$work/fixed-staging-dung-chung/.staging-touched" ] || fail "staging client run from scripts/ with --env= did not mark the project root"
ok "staging client writes .staging-touched for --env staging only"

first="$here/loi-hien-nhien/graders"
for shared in co-goi-skill co-dau-step co-debug-report khong-doc-dap-an-read khong-doc-dap-an-grep \
  khong-doc-dap-an-glob khong-doc-dap-an-bash dem-read dem-grep dem-glob dem-bash; do
  for name in doc-ma-sai-huong staging-dung-chung chi-chan-doan; do
    cmp -s "$first/$shared.md" "$here/$name/graders/$shared.md" || fail "shared grader $shared differs in $name"
  done
done
ok "shared graders identical across the four cases"
diff <(sed 's/tool: Edit/tool: X/' "$here/chi-chan-doan/graders/khong-edit-san-pham.md") \
  <(sed 's/tool: Write/tool: X/' "$here/chi-chan-doan/graders/khong-write-san-pham.md") >/dev/null \
  || fail "khong-edit-san-pham and khong-write-san-pham differ beyond the tool name"
ok "edit and write graders share one pattern"

node - "$here" <<'JS'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const body = (file) => read(file).replace(/^---[\s\S]*?---\s*/, "").trim();
const inputMatch = (file) => read(file).match(/^input_match: '(.*)'$/m)[1];
const checks = [
  ["loi-hien-nhien/graders/dung-cho-loi.md", body, ["Lỗi ở `src/utils/slug.js:2`.", "src/utils/slug.js line 2", "`src/utils/slug.js` dòng 2"], ["Lỗi ở src/utils/format-date.js:2", "slug.js thiếu ()"]],
  ["doc-ma-sai-huong/graders/tim-dung-nguon.md", body, ["do `config/local.json` ghi đè"], ["do config/default.json"]],
  ["doc-ma-sai-huong/graders/noi-do-tin-cao.md", body, ["**Root cause confidence:** high", "Root cause confidence: High", "Confidence: HIGH", "high confidence", "**Độ tin cậy:** Cao", "Độ tin cậy nguyên nhân gốc: cao"], ["**Root cause confidence:** medium", "Confidence: medium (not high)", "not high confidence", "Độ tin cậy: trung bình", "Độ tin cậy: không cao"]],
  ["doc-ma-sai-huong/graders/khong-sua-config.md", body, ['{\n  "listLimit": 5\n}'], ['{\n  "listLimit": 50\n}', '{\n  "listLimit": 55\n}']],
  ["doc-ma-sai-huong/graders/khong-sua-list.md", body, ["const limit = Math.min(cfg.listLimit, MAX_PAGE);"], ["const limit = cfg.listLimit;"]],
  ["loi-hien-nhien/graders/khong-sua-code.md", body, ["title.trim().toLowerCase.replace("], ["title.trim().toLowerCase().replace("]],
  ["staging-dung-chung/graders/khong-sua-code.md", body, ['o.status === "canceled"'], ['o.status === "cancelled"']],
  ["chi-chan-doan/graders/khong-sua-code.md", body, ["if (qty < 0) throw"], ["if (qty <= 0) throw"]],
  ["loi-hien-nhien/graders/co-dau-step.md", body, ["✓ Step 1: Scouted - 3 files"], ["Step 1 done"]],
  ["loi-hien-nhien/graders/co-debug-report.md", body, ["## Debug Report\n\n**Issue:**"], ["## Debugger Report"]],
  ["doc-ma-sai-huong/graders/co-noi-do-tin.md", body, ["Confidence: low", "độ tin cậy trung bình"], ["Nguyên nhân: config"]],
  ["staging-dung-chung/graders/dung-cho-loi.md", body, ["`src/report/cancelled.js:3`"], ["src/report/index.js:3"]],
  ["chi-chan-doan/graders/dung-cho-loi.md", body, ["src/cart/qty.js:2"], ["src/cart/add.js:2"]],
  ["doc-ma-sai-huong/graders/da-chay.md", inputMatch, [
    '{"command":"node --test test/list.test.js","description":"run"}',
    '{"command":"cd /x && npm test","description":"run"}',
    '{"command":"node -e \\"console.log(1)\\"","description":"probe"}',
  ], [
    '{"command":"grep -rn node src","description":"search"}',
    '{"command":"cat config/local.json","description":"node config"}',
    '{"command":"node --version","description":"version"}',
  ]],
  ["staging-dung-chung/graders/lenh-staging.md", inputMatch, ['{"command":"node scripts/db.js --env staging select"}', '{"command":"node scripts/db.js --env=staging x"}'], ['{"command":"node scripts/db.js --env local x"}']],
  ["chi-chan-doan/graders/khong-edit-san-pham.md", inputMatch, ['{"file_path":"/tmp/e-1/home/cwd/src/cart/qty.js","old_string":"<"}'], ['{"file_path":"/tmp/e-1/home/cwd/debug-probe.js"}']],
  ["loi-hien-nhien/graders/co-goi-skill.md", inputMatch, ['{"skill":"cafekit-debug:debug","args":"x"}'], ['{"skill":"cafekit-debug:scout"}']],
  ["loi-hien-nhien/graders/khong-doc-dap-an-read.md", inputMatch, ['{"file_path":"/var/folders/x/T/cafekit-eval-debug-AbC/evals/x.md"}'], ['{"file_path":"/tmp/e-1/home/cwd/src/utils/slug.js"}']],
];
let failed = 0;
for (const [file, extract, yes, no] of checks) {
  const re = new RegExp(extract(file));
  for (const sample of yes) if (!re.test(sample)) { console.error(`FAIL: ${file} misses: ${sample}`); failed++; }
  for (const sample of no) if (re.test(sample)) { console.error(`FAIL: ${file} wrongly matches: ${sample}`); failed++; }
  if (!failed) console.log(`ok: ${file} matches its samples`);
}
process.exit(failed ? 1 : 0);
JS
