#!/bin/bash
# Chép fixture của ca (tên thư mục này, bỏ đuôi -agent) vào phòng thử và tạo một commit: cây sạch, một commit, không remote.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME="$(basename "$HERE")"; NAME="${NAME%-agent}"
cp -R "$HERE/../fixtures/$NAME/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
