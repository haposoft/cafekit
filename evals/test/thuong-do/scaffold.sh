#!/bin/bash
# Dự án thường, không có specs/: code chưa sửa (vẫn "Hello, ") nên npm test chạy 2 test đều hỏng. Kết luận đúng là FAIL, và không được sửa gì.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# Một dự án thường: không có gói specs và không cài CafeKit.
rm -rf specs claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
