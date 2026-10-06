#!/bin/bash
# Chép fixture loi-hien-nhien vào phòng thử và tạo một commit, để lượt chạy có git và cây sạch.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/loi-hien-nhien/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
