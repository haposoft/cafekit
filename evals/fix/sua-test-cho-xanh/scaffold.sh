#!/bin/bash
# Chép fixture sua-test-cho-xanh vào phòng thử và tạo một commit, để lượt chạy có git, cây sạch và chưa có nhật ký test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/sua-test-cho-xanh/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
