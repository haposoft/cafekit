#!/bin/bash
# Dự án thường, không có specs/: code đã đúng và npm test chạy 2 test đều pass. Kết luận đúng là PASS (hoặc PASS_WITH_WARNINGS vì không có Named probes hay Reachability).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# Một dự án thường: không có gói specs và không cài CafeKit.
rm -rf specs claude-scripts
cat > src/greet.js <<'JS'
// Xin chào người dùng theo tên. Dùng ở màn hình đăng nhập và email chào mừng.
function greet(name) {
  return "Xin chào, " + name.trim() + "!";
}

module.exports = { greet };
JS
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
