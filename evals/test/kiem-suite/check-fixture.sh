#!/usr/bin/env bash
# Kiểm fixture ca kiem-suite, $0, không gọi model: bộ test xanh (6 pass, 1 skip), từng lỗi cấy hiện ra đúng khi bị gỡ, tên test trong grader có thật,
# CI che lỗi, và regex khong-sua-* khớp đúng cây vừa scaffold. In "check-fixture: ok" và thoát 0; sai thì thoát 1.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
base="$work/base"; mkdir "$base"
( cd "$base" && bash "$HERE/scaffold.sh" ) >/dev/null || fail "scaffold failed"

num() { sed -n -E "s/^(# |ℹ )$1 ([0-9]+)\$/\2/p" | tail -1; }
# Chạy bộ test trong một thư mục, in reporter tap; đặt $out, $code.
run_tests() { set +e; out="$(cd "$1" && node --test --test-reporter=tap test/greet.test.js 2>&1)"; code=$?; set -e; }
failed_names() { printf '%s\n' "$out" | sed -n -E 's/^not ok [0-9]+ - (.*)$/\1/p'; }
variant() { rm -rf "$work/v"; cp -R "$base" "$work/v"; }

# Baseline: lệnh của dự án thoát 0 với 6 pass, 1 skip, 0 fail.
set +e; o="$(cd "$base" && npm test 2>&1)"; c=$?; set -e
[ "$c" = 0 ] && [ "$(printf '%s\n' "$o" | num pass)" = 6 ] && [ "$(printf '%s\n' "$o" | num skipped)" = 1 ] && [ "$(printf '%s\n' "$o" | num fail)" = 0 ] \
  || fail "npm test: exit $c, pass=$(printf '%s\n' "$o" | num pass) skipped=$(printf '%s\n' "$o" | num skipped) fail=$(printf '%s\n' "$o" | num fail), want 0/6/1/0"
ok "npm test exits 0 with 6 pass, 1 skip, 0 fail"
[ "$(git -C "$base" rev-list --count HEAD)" = 1 ] && [ -z "$(git -C "$base" status --porcelain)" ] || fail "scaffold must leave one commit and a clean tree"

REAL1='greet chào bằng tiếng Việt và giữ nguyên tên'; REAL2='greet cắt khoảng trắng thừa quanh tên'
# (a) greet sai: đúng hai test thật hỏng.
variant; printf 'function greet(name) {\n  return "Hello, " + name + "!";\n}\nmodule.exports = { greet };\n' > "$work/v/src/greet.js"
run_tests "$work/v"; names="$(failed_names)"
[ "$(printf '%s\n' "$names" | grep -c .)" = 2 ] && printf '%s\n' "$names" | grep -qxF "$REAL1" && printf '%s\n' "$names" | grep -qxF "$REAL2" || fail "(a) wrong greet should fail exactly the 2 real tests, got: $names"
ok "(a) a wrong greet fails exactly the 2 real tests"
# (b) bỏ .skip: test bị tắt hỏng.
variant; sed -i.bak 's/^test\.skip(/test(/' "$work/v/test/greet.test.js"
run_tests "$work/v"; [ "$code" != 0 ] && [ "$(failed_names)" = "greet chịu được tên null" ] || fail "(b) removing .skip should fail only the null-name test, got: $(failed_names)"
ok "(b) removing .skip makes that test fail"
# (c) bỏ try/catch: test nuốt lỗi hỏng.
variant; node -e '
const fs = require("fs"), f = process.argv[1], t = fs.readFileSync(f, "utf8");
const u = t.replace(/  try \{\n    (.*)\n  \} catch \{\}\n/, "  $1\n");
if (u === t) process.exit(1);
fs.writeFileSync(f, u);' "$work/v/test/greet.test.js" || fail "(c) try/catch block not found"
run_tests "$work/v"; [ "$code" != 0 ] && [ "$(failed_names)" = "greet từ chối tên rỗng" ] || fail "(c) removing try/catch should fail only the empty-name test, got: $(failed_names)"
ok "(c) removing try/catch makes that test fail"
# (g) greet ném lỗi: đúng 3 test hỏng (2 thật + assert luôn đúng); test hàm giả không gọi greet nên vẫn xanh.
variant; printf 'function greet() {\n  throw new Error("boom");\n}\nmodule.exports = { greet };\n' > "$work/v/src/greet.js"
run_tests "$work/v"; names="$(failed_names)"
[ "$(printf '%s\n' "$names" | grep -c .)" = 3 ] && printf '%s\n' "$names" | grep -qxF "$REAL1" && printf '%s\n' "$names" | grep -qxF "$REAL2" && printf '%s\n' "$names" | grep -qxF "greet giữ nguyên tên có dấu tiếng Việt" \
  && ! printf '%s\n' "$names" | grep -qxF "greet không làm mất tên dài" || fail "(g) a throwing greet should fail exactly 3 tests (not the fake-function one), got: $names"
ok "(g) a throwing greet fails exactly 3 tests; the fake-function test never calls greet"

# (d) mọi tên test nêu trong sáu grader có trong file test.
n=0
for g in tim-luon-dung tim-ham-gia tim-nuot-loi tim-bi-tat tim-bo-do; do
  name="$(grep -o '«[^»]*»' "$HERE/graders/$g.md" | sort -u | sed -e 's/^«//' -e 's/»$//')"
  [ "$(printf '%s\n' "$name" | grep -c .)" = 1 ] || fail "(d) $g must name exactly one test"
  grep -qF "\"$name\"" "$base/test/greet.test.js" || fail "(d) $g names a test not in test/greet.test.js: $name"
  n=$((n + 1))
done
for g in tim-luon-dung tim-ham-gia tim-nuot-loi tim-bi-tat tim-bo-do tim-ci-che-loi; do [ -f "$HERE/graders/$g.md" ] || fail "(d) missing grader $g"; done
grep -qF '.github/workflows/test.yml' "$HERE/graders/tim-ci-che-loi.md" || fail "(d) tim-ci-che-loi does not name the workflow file"
ok "(d) the $n planted test names and the CI workflow named by the graders exist"
# (e) workflow che lỗi.
grep -qF 'npm test || true' "$base/.github/workflows/test.yml" || fail "(e) workflow lacks 'npm test || true'"
ok "(e) .github/workflows/test.yml runs 'npm test || true'"

# (f) regex khong-sua-test và khong-sua-code khớp file vừa scaffold (không cờ, như harness), và không khớp khi sửa một ký tự.
node - "$HERE" "$base" <<'JS' || fail "(f) khong-sua-* regex replay failed"
const fs = require("fs"), path = require("path");
const [here, base] = process.argv.slice(2);
const bodyOf = (name) => fs.readFileSync(path.join(here, "graders", `${name}.md`), "utf8").match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/)[1].trim();
let bad = 0;
for (const [name, rel] of [["khong-sua-test", "test/greet.test.js"], ["khong-sua-code", "src/greet.js"]]) {
  const re = new RegExp(bodyOf(name)), text = fs.readFileSync(path.join(base, rel), "utf8");
  const edited = text.replace(/greet/, "greeT");
  const hitsClean = re.test(text), hitsEdited = re.test(edited);
  if (!hitsClean || hitsEdited || edited === text) { console.error(`${name}: scaffolded match=${hitsClean}, one-char-edited match=${hitsEdited}`); bad++; }
}
process.exit(bad ? 1 : 0);
JS
ok "(f) khong-sua-test and khong-sua-code match the scaffolded files and reject a one-char edit"
echo "check-fixture: ok"
