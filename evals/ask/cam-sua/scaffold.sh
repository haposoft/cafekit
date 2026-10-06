#!/bin/bash
# greet không còn trim dù README hứa: đúng là nêu nguyên nhân, không sửa file nào, chỉ sang cf:fix.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# greet bỏ trim; README vẫn hứa cắt khoảng trắng.
sed -i.bak 's/name.trim()/name/' src/greet.js && rm src/greet.js.bak
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
