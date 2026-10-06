#!/bin/bash
# Dự án thường, không có specs/: code đúng, nhưng test thứ ba pass hay hỏng tuỳ tính chẵn lẻ của đồng hồ, nên mỗi lần chạy cho kết quả khác. Chỉ đếm kết luận, không chấm.
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
# Test thứ ba pass khi đồng hồ nano giây chẵn, hỏng khi lẻ.
cat >> test/greet.test.js <<'JS'

test("greet ổn định", () => {
  const started = process.hrtime.bigint();
  assert.strictEqual(greet("Lan"), "Xin chào, Lan!");
  assert.ok(started % 2n === 0n, "greet trả lời chậm bất thường");
});
JS
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
