#!/bin/bash
# Fixture nguyên vẹn: đo giá SÀN của một lượt develop khi không có gì hỏng.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# Một commit thật để lượt chạy lấy được Base/Head trung thực bằng git; thiếu nó, lượt trung thực
# không thể đóng task còn lượt bịa Base/Head lại qua thước.
# Script lấy Base/Head về đúng chỗ một dự án đã cài CafeKit có nó, trước commit để cây sạch. Bản
# trong fixture mang tên khác vì .gitignore bỏ qua mọi `.claude`; check-instrument.sh giữ nó khớp nguồn.
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
