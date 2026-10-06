#!/bin/bash
# Dựng ./box/repo (không có .claude/scripts/): hai file đã commit, rồi ba thay đổi chưa commit — sửa lỗi ở src/a.js (fix), file mới
# src/feature.js có chữ "tokens" trong một comment (feat, vô hại), file mới src/config.js có một dòng khoá giả ghép lúc chạy.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../lib/box.sh"
box_init
box_repo repo
box_commit repo src/a.js "export const total = (xs) => xs.reduce((s, x) => s - x, 0);" "feat: total"
box_commit repo src/b.js "export const one = 1;" "feat: one"
printf '%s\n' "export const total = (xs) => xs.reduce((s, x) => s + x, 0);" > box/repo/src/a.js
printf '%s\n' "// parses tokens from the lexer" "export const lex = (s) => s.split(' ');" > box/repo/src/feature.js
printf 'export const API_KEY = "%s";\n' "$(box_fake_key)" > box/repo/src/config.js
