#!/bin/bash
# Chép fixture sua-ho (base rồi pending) vào phòng thử, tạo một commit rồi để phần sửa lọc admin chưa commit.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/sua-ho/base/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: lọc người dùng đang hoạt động"
cp -R "$HERE/../fixtures/sua-ho/pending/." .
