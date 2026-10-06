#!/usr/bin/env bash
# Dựng một gốc chạy riêng cho bộ đo sonnet: bản chép byte của evals/run.sh, evals/compare-fix.mjs,
# packages/spec/package.json và evals/fix/, đè bốn case.yaml của evals/fix-s55/ lên, kèm skills debug và scout
# của worktree và skills/fix của bản gốc (goc = git archive 2f5dfef) hay bản vá (sau = worktree).
# evals/run.sh lấy gốc từ chính đường dẫn của nó, nên chạy <root>/evals/run.sh là chạy đúng các bản chép này.
# Không bao giờ ghi vào <root>/evals/results/.
#   evals/fix-s55/stage-root.sh <goc|sau> [root]     (root mặc định evals/results/fix-s55/root)
set -euo pipefail
side="${1:?usage: evals/fix-s55/stage-root.sh <goc|sau> [root]}"
case "$side" in goc|sau) ;; *) echo "unknown side: $side" >&2; exit 2;; esac
top="$(cd "$(dirname "$0")/../.." && pwd)"
root="${2:-$top/evals/results/fix-s55/root}"
skills="$root/packages/spec/src/claude/skills"
cases=(red-truoc sua-test-cho-xanh cham-hop-dong loi-don-gian)

mkdir -p "$root/evals" "$skills"
cp -p "$top/evals/run.sh" "$top/evals/compare-fix.mjs" "$root/evals/"
cp -p "$top/packages/spec/package.json" "$root/packages/spec/package.json"
rsync -a --delete --exclude results/ "$top/evals/fix/" "$root/evals/fix/"
for c in "${cases[@]}"; do cp "$top/evals/fix-s55/$c/case.yaml" "$root/evals/fix/$c/case.yaml"; done
for f in debug scout; do rsync -a --delete "$top/packages/spec/src/claude/skills/$f/" "$skills/$f/"; done
if [ "$side" = goc ]; then
  t="$(mktemp -d)"
  trap 'rm -rf "$t"' EXIT
  git -C "$top" archive 2f5dfef packages/spec/src/claude/skills/fix | tar -x -C "$t"
  rm -rf "$skills/fix"
  mv "$t/packages/spec/src/claude/skills/fix" "$skills/fix"
else
  rsync -a --delete "$top/packages/spec/src/claude/skills/fix/" "$skills/fix/"
fi

dg() { ( cd "$1" && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256 ) | shasum -a 256 | cut -d' ' -f1; }
echo "side=$side"
echo "run-sh-sha256: $(shasum -a 256 "$root/evals/run.sh" | cut -d' ' -f1)"
echo "instrument: $(dg "$root/evals/fix")"
for f in fix debug scout; do echo "$(dg "$skills/$f")  skills/$f/"; done
