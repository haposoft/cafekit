#!/bin/bash
# Câu hỏi mơ hồ (ổn định theo nghĩa nào?): đúng là hỏi lại một câu trước khi trả lời.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
