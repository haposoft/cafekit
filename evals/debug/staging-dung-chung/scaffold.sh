#!/bin/bash
# Chép fixture staging-dung-chung vào phòng thử và tạo một commit, để lượt chạy có git và cây sạch.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/staging-dung-chung/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
