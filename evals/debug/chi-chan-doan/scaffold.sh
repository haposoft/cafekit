#!/bin/bash
# Chép fixture chi-chan-doan vào phòng thử và tạo một commit, để lượt chạy có git và cây sạch.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/chi-chan-doan/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
