#!/bin/bash
# Cài CafeKit thật (`--platform claude --yes`) vào phòng thử, để probe đo xem harness có nạp `.claude/` của phòng thử không.
# Đường dẫn repo đến từ file .cafekit-root mà evals/run.sh ghi cạnh các ca (harness lọc biến môi trường của scaffold); installer cài vào thư mục hiện tại nên chỉ chạy dưới thư mục tạm và không bao giờ trong repo.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
root="$(cat "$HERE/../.cafekit-root" 2>/dev/null || true)"
[ -n "$root" ] && [ -f "$root/packages/spec/bin/install.js" ] || { echo "scaffold: không đọc được ../.cafekit-root (chạy qua evals/run.sh)" >&2; exit 1; }
here="$(pwd -P)"
case "$here" in /private/tmp/?*|/tmp/?*|/private/var/folders/?*|/var/folders/?*) ;; *) echo "scaffold: từ chối cài ngoài thư mục tạm: $here" >&2; exit 1;; esac
case "$here/" in "$(cd "$root" && pwd -P)"/*) echo "scaffold: từ chối cài vào repo: $here" >&2; exit 1;; esac
node "$root/packages/spec/bin/install.js" --platform claude --yes > .cafekit-install.log 2>&1
