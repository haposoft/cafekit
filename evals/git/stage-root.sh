#!/usr/bin/env bash
# Dựng một gốc chạy riêng cho evals/run.sh: bản chép byte của evals/run.sh, evals/compare-git.mjs, evals/budget-git-sau.mjs,
# packages/spec/package.json và evals/git/, kèm skills/git của bản gốc (goc = git archive 26103b9) hay của cây hiện tại (sau).
# evals/run.sh lấy gốc từ chính đường dẫn của nó nên chạy <root>/evals/run.sh là chạy đúng các bản chép này, và kết quả rơi vào
# <root>/evals/results/git/<tên>; người gọi chép từng ô ra evals/results/git/ ngay sau khi chạy. Không bao giờ ghi vào evals/results/.
#   evals/git/stage-root.sh <goc|sau> <root>      (root: thư mục tạm do người gọi truyền, ví dụ `mktemp -d`; không nằm trong evals/results/)
set -euo pipefail
side="${1:?usage: evals/git/stage-root.sh <goc|sau> <root>}"
root_arg="${2:?usage: evals/git/stage-root.sh <goc|sau> <root>}"
case "$side" in goc|sau) ;; *) echo "unknown side: $side" >&2; exit 2;; esac
top="$(cd "$(dirname "$0")/../.." && pwd -P)"
# kiểm TRƯỚC khi tạo bất cứ thư mục nào: đường dẫn thật (kể cả khi chưa tồn tại) không được nằm trong evals/results/
root="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$root_arg")"
# so sánh không phân biệt hoa/thường: macOS (APFS) coi evals/Results và evals/results là một thư mục
lc() { printf '%s' "$1" | tr 'A-Z' 'a-z'; }
case "$(lc "$root")/" in "$(lc "$top")/evals/results/"*) echo "refusing a root inside evals/results/: $root" >&2; exit 2;; esac
mkdir -p "$root"
skills="$root/packages/spec/src/claude/skills"

mkdir -p "$root/evals" "$root/packages/spec" "$skills"
cp -p "$top/evals/run.sh" "$top/evals/compare-git.mjs" "$top/evals/budget-git-sau.mjs" "$root/evals/"
cp -p "$top/packages/spec/package.json" "$root/packages/spec/package.json"
rsync -a --delete --exclude results/ "$top/evals/git/" "$root/evals/git/"
if [ "$side" = goc ]; then
  t="$(mktemp -d)"
  trap 'rm -rf "$t"' EXIT
  git -C "$top" archive 26103b9 packages/spec/src/claude/skills/git | tar -x -C "$t"
  rm -rf "$skills/git"
  mv "$t/packages/spec/src/claude/skills/git" "$skills/git"
else
  rsync -a --delete "$top/packages/spec/src/claude/skills/git/" "$skills/git/"
fi

dg() { ( cd "$1" && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256 ) | shasum -a 256 | cut -d' ' -f1; }
echo "side=$side"
echo "run-sh-sha256: $(shasum -a 256 "$root/evals/run.sh" | cut -d' ' -f1)"
echo "instrument: $(node "$root/evals/compare-git.mjs" --digest)"
echo "skill-git: $(dg "$skills/git")"
