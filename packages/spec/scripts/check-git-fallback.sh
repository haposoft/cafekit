#!/usr/bin/env bash
# Chạy khối quét bí mật dự phòng của cf:git (giữa hai dấu `fallback-scan` trong SKILL.md) bằng /bin/bash trên các repo tạm và kiểm: mọi dạng khoá được
# báo đúng `file:line:class`, không in giá trị nào, văn xuôi (`tokens`, giá trị rỗng, tham chiếu env) im lặng, và các tình huống khó của git không làm sót
# im lặng: tên file không phải ASCII hay có dấu cách, CRLF, thiếu dấu xuống dòng cuối, repo chưa có commit, `diff.noprefix`/`diff.mnemonicPrefix`, chạy từ thư mục con, cây sạch.
#   bash packages/spec/scripts/check-git-fallback.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
skill="$here/../src/claude/skills/git/SKILL.md"
block="$(sed -n '/<!-- fallback-scan:start -->/,/<!-- fallback-scan:end -->/p' "$skill" | sed '1d;$d' | sed '/^```/d')"
[ -n "$block" ] || { echo "FAIL: no fallback block between the fallback-scan markers" >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail=0
G() { env -u GIT_DIR git -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"; }
newrepo() { local d="$tmp/$1"; mkdir -p "$d" && ( cd "$d" && env -u GIT_DIR git init -q -b main . ); printf '%s' "$d"; }
# Khoá giả ghép từ các mảnh lúc chạy; không chuỗi nào trong tệp này giống một khoá.
a="abcdefghij"; b="0123456789"; k1="sk-"; k2="abcdefghij0123456789ABCD"; g1="ghp"; g2="_0123456789abcdefghijABCDEFGHIJ"
pw="${a}${b}klmnop"

# expect <tên> <repo> <thư mục chạy> <đầu ra mong đợi>
expect() {
  local name="$1" repo="$2" cwd="$3" want="$4" got
  got="$(cd "$cwd" && /bin/bash -c "$block" 2>"$tmp/stderr")"
  if [ "$got" != "$want" ]; then echo "FAIL: $name" >&2; printf 'expected:\n%s\ngot:\n%s\n' "$want" "$got" >&2; fail=1; return; fi
  if [ -n "$got" ] && printf '%s\n' "$got" | grep -Evq '^[^:]+:[0-9]+:[a-z-]+$'; then echo "FAIL: $name: a line is not file:line:class" >&2; fail=1; fi
  if printf '%s\n' "$got" | grep -q -e "$a$b" -e "$k2" -e "$g2" -e "$pw"; then echo "FAIL: $name: a secret value was printed" >&2; fail=1; fi
  if [ -s "$tmp/stderr" ]; then echo "FAIL: $name: stderr is not empty: $(head -c 200 "$tmp/stderr")" >&2; fail=1; fi
  echo "ok: $name"
}

# 1. mọi dạng khoá, văn xuôi và tham chiếu env (tracked đã sửa + untracked)
r="$(newrepo shapes)"; ( cd "$r" && printf '%s\n' "// header" > code.js && G add code.js && G commit -qm base )
cat >> "$r/code.js" <<LINES
// tokens: refresh every thirty minutes
const password = config.get("db")
pw = process.env.PASSWORD
secret = \$SECRET_FROM_ENV_VALUE
password: ""
// parses tokens from the lexer
api_key = "${a}${b}"
API_KEY=${a}${b}ABCDEF
token: '${a}${b}xx'
h = "${k1}${k2}"
g = ${g1}${g2}
Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123
-----BEGIN RSA PRIVATE KEY-----
LINES
printf '%s\n' "DB_PASSWORD=${pw}" > "$r/new.env"
shapes="code.js:8:assignment
code.js:9:assignment
code.js:10:assignment
code.js:11:sk-prefix
code.js:12:gh-prefix
code.js:13:bearer
code.js:14:private-key-block
new.env:1:assignment"
expect "shapes, prose and env references" "$r" "$r" "$shapes"
mkdir -p "$r/sub" && expect "run from a subdirectory (the block moves to the top-level)" "$r" "$r/sub" "$shapes"

# 2. tên file không phải ASCII và có dấu cách, tracked và untracked; cấu hình diff.noprefix / diff.mnemonicPrefix
r="$(newrepo names)"
( cd "$r" && printf '%s\n' "x" > "tên.txt" && printf '%s\n' "x" > "sp ace.txt" && G add . && G commit -qm base )
printf 'password = "%s"\n' "$pw" >> "$r/tên.txt"; printf 'password = "%s"\n' "$pw" >> "$r/sp ace.txt"; printf 'password = "%s"\n' "$pw" > "$r/ün.txt"
names="sp ace.txt:2:assignment
tên.txt:2:assignment
ün.txt:1:assignment"
expect "non-ASCII and spaced file names, tracked and untracked" "$r" "$r" "$names"
( cd "$r" && env -u GIT_DIR git config diff.noprefix true )
expect "diff.noprefix=true" "$r" "$r" "$names"
( cd "$r" && env -u GIT_DIR git config --unset diff.noprefix && env -u GIT_DIR git config diff.mnemonicPrefix true )
expect "diff.mnemonicPrefix=true" "$r" "$r" "$names"

# 3. CRLF (giá trị không dấu nháy)
r="$(newrepo crlf)"; printf 'token=%s\r\n' "$pw" > "$r/crlf.txt"
expect "CRLF line endings" "$r" "$r" "crlf.txt:1:assignment"

# 4. repo chưa có commit nào: tệp đã stage và tệp chưa theo dõi đều phải được quét
r="$(newrepo nohead)"; printf 'password = "%s"\n' "$pw" > "$r/staged.txt"; ( cd "$r" && G add staged.txt ); printf 'password = "%s"\n' "$pw" > "$r/loose.txt"
expect "a repository with no commit yet (staged and untracked)" "$r" "$r" "staged.txt:1:assignment
loose.txt:1:assignment"

# 5. tệp chưa theo dõi KHÔNG có dấu xuống dòng cuối không được nuốt tiêu đề của tệp kế tiếp
r="$(newrepo nonl)"; printf 'password = "%s"' "$pw" > "$r/c_nonl"; printf 'api_key = "%s"\n' "${a}${b}klmnopqrst" > "$r/d_second"
expect "an untracked file with no final newline does not swallow the next header" "$r" "$r" "c_nonl:1:assignment
d_second:1:assignment"

# 6. cây sạch: không in gì
r="$(newrepo clean)"; ( cd "$r" && printf '%s\n' "hello" > a.txt && G add a.txt && G commit -qm base )
expect "a clean tree prints nothing" "$r" "$r" ""

[ "$fail" = 0 ] || exit 1
echo "check-git-fallback: ok (shapes, prose, subdirectory, non-ASCII and spaced names, diff prefix configs, CRLF, no commit yet, no final newline, clean tree) on bash $(/bin/bash -c 'echo $BASH_VERSION')"
