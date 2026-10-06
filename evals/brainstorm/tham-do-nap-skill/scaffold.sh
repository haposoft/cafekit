#!/bin/bash
# Ca thăm dò: chép fixture của duyet-khong-trien-khai (cùng lịch sử phát lại) và tạo một commit.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixtures/duyet-khong-trien-khai/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
