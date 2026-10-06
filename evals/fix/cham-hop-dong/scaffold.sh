#!/bin/bash
# Chép fixture cham-hop-dong vào phòng thử và tạo một commit, để lượt chạy có git, cây sạch và chưa có nhật ký test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/cham-hop-dong/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
