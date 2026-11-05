#!/bin/bash
# Cùng fixture, cộng ĐÚNG MỘT chỗ cấy: Verification Plan có hai dòng `- Command:` cấp đầu liền nhau, lệnh tiên quyết
# `node --check src/greet.js` trước, lệnh chuẩn `node --test test/greet.test.js` sau. Gate lấy dòng cấp đầu CUỐI làm lệnh
# chuẩn (spec-receipt.cjs workflowVerificationCommand), nên một Receipt chép dòng đầu, chép cả hai hay nối bằng `&&` đều
# trượt command_identity. Đây là bẫy mục Gotchas của develop nêu; lỗi nằm trong scaffold để fixture dùng chung không trôi.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
TASK=specs/doi-loi-chao/task-01-doi-loi-chao.md
sed -i.bak 's|^- Command: `node --test test/greet\.test\.js`$|- Command: `node --check src/greet.js`\
- Command: `node --test test/greet.test.js`|' "$TASK"
rm -f "$TASK.bak"
grep -A1 -x -- '- Command: `node --check src/greet.js`' "$TASK" | tail -n 1 | grep -qx -- '- Command: `node --test test/greet.test.js`' \
  || { echo "hai dòng Command không áp được" >&2; exit 1; }
[ "$(grep -c '^- Command:' "$TASK")" = 2 ] || { echo "Verification Plan phải có đúng hai dòng Command" >&2; exit 1; }
# Script lấy Base/Head về đúng chỗ một dự án đã cài CafeKit có nó, trước commit để cây sạch (như mot-task-hong/scaffold.sh).
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
