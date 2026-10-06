#!/bin/bash
# Chép fixture chi-loi-nho (base rồi head) vào phòng thử, tạo hai commit, để lượt chạy có git, cây sạch và chưa có nhật ký test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/chi-loi-nho/base/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: tính tổng đơn"
cp -R "$HERE/../fixtures/chi-loi-nho/head/." .
git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "refactor: đặt tên rõ cho biến tạm tính"
