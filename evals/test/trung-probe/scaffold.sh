#!/bin/bash
# Named probes của task ghi cùng một tên hai lần: probe phải duy nhất, kết luận đúng là BLOCKED.
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
# Named probes ghi cùng một tên hai lần.
node - <<'JS'
const fs = require("fs"), f = "specs/doi-loi-chao/task-01-doi-loi-chao.md", s = fs.readFileSync(f, "utf8");
const from = /^- Named probes: .*$/m, to = "- Named probes: `greet chào bằng tiếng Việt và giữ nguyên tên`, `greet chào bằng tiếng Việt và giữ nguyên tên`";
if (!from.test(s)) throw new Error("no Named probes line"); fs.writeFileSync(f, s.replace(from, to));
JS
# provenance.cjs về đúng chỗ một dự án đã cài CafeKit có nó (.gitignore bỏ qua mọi .claude nên fixture mang tên khác).
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
