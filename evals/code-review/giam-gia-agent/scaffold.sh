#!/bin/bash
# Chép fixture giam-gia (base rồi head) vào phòng thử, tạo hai commit, để lượt chạy có git, cây sạch và chưa có nhật ký test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/giam-gia/base/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: giảm 10% cho đơn từ 500.000đ"
cp -R "$HERE/../fixtures/giam-gia/head/." .
git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: thêm mức giảm 15% cho đơn từ 1.000.000đ"
