#!/bin/bash
# Dự án không có cơ sở dữ liệu nào: với --repo, câu trả lời đúng nói không tìm thấy, không bịa tên DB, không lên mạng.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
