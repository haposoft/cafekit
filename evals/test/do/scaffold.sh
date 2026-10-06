#!/bin/bash
# Code chưa sửa (vẫn "Hello, ") nên Command chạy 2 test đều hỏng: kết luận đúng là FAIL, và Test không được sửa gì.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# provenance.cjs về đúng chỗ một dự án đã cài CafeKit có nó (.gitignore bỏ qua mọi .claude nên fixture mang tên khác).
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
