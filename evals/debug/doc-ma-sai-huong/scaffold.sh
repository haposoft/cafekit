#!/bin/bash
# Chép fixture doc-ma-sai-huong vào phòng thử và tạo một commit, để lượt chạy có git và cây sạch.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/doc-ma-sai-huong/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
