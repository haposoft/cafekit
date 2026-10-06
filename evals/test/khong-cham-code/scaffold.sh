#!/bin/bash
# Test pass nhưng gọi bản sao test/greet-impl.js chứ không gọi src/greet.js (vẫn tiếng Anh): Reachability của task sai, kết luận đúng là FAIL hoặc BLOCKED, không phải PASS.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# src/greet.js giữ tiếng Anh; test gọi một bản sao trong test/, nên lệnh pass mà không chạm src/greet.js.
cat > test/greet-impl.js <<'JS'
// Xin chào người dùng theo tên. Dùng ở màn hình đăng nhập và email chào mừng.
function greet(name) {
  return "Xin chào, " + name.trim() + "!";
}

module.exports = { greet };
JS
node - <<'JS'
const fs = require("fs"), f = "test/greet.test.js", s = fs.readFileSync(f, "utf8");
if (s.split("../src/greet.js").length !== 2) throw new Error("expected one require of ../src/greet.js");
fs.writeFileSync(f, s.replace("../src/greet.js", "./greet-impl.js"));
JS
# provenance.cjs về đúng chỗ một dự án đã cài CafeKit có nó (.gitignore bỏ qua mọi .claude nên fixture mang tên khác).
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
