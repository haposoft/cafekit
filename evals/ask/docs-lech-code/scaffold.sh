#!/bin/bash
# README nói cổng 3000 nhưng code vẫn 8080: câu trả lời đúng theo code (8080) và chỉ ra README đang lệch.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# README nói cổng 3000; src/config.js vẫn 8080.
sed -i.bak 's/listens on port 8080/listens on port 3000/' README.md && rm README.md.bak
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
