#!/bin/bash
# Chép fixture thieu-tieu-chi (base rồi head) vào phòng thử, tạo hai commit, để lượt chạy có git, cây sạch và chưa có nhật ký test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/thieu-tieu-chi/base/." .
rm -f .test-runs.log
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "docs(specs): lập kế hoạch tạo slug"
cp -R "$HERE/../fixtures/thieu-tieu-chi/head/." .
git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm "feat: slugify cho tiêu đề bài viết" -m "Task: specs/tao-slug/task-01-slugify.md"
