#!/bin/bash
# Gói vừa là process-first (plan.md, task-NN) vừa có spec.json của kiểu cũ: trạng thái trộn, kết luận đúng là BLOCKED trước khi đo.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
cat > src/greet.js <<'JS'
// Xin chào người dùng theo tên. Dùng ở màn hình đăng nhập và email chào mừng.
function greet(name) {
  return "Xin chào, " + name.trim() + "!";
}

module.exports = { greet };
JS
# Một gốc legacy nằm cạnh plan.md: trạng thái trộn.
cat > specs/doi-loi-chao/spec.json <<'JSON'
{ "feature_name": "doi-loi-chao", "phase": "tasks-generated", "task_registry": {} }
JSON
# provenance.cjs về đúng chỗ một dự án đã cài CafeKit có nó (.gitignore bỏ qua mọi .claude nên fixture mang tên khác).
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
