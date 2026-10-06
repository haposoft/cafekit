#!/bin/bash
# README và src/config.js cùng nói cổng 8080: câu trả lời đúng nêu 8080, biến PORT và dẫn src/config.js kèm số dòng.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
