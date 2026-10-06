#!/bin/bash
# Chép fixture khong-co-loi (base rồi head) vào phòng thử, tạo hai commit, để lượt chạy có git, cây sạch và chưa có nhật ký test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/khong-co-loi/base/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: truy vấn báo cáo sắp xếp theo cột"
cp -R "$HERE/../fixtures/khong-co-loi/head/." .
git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: thêm chiều sắp xếp và giới hạn số dòng cho báo cáo"
