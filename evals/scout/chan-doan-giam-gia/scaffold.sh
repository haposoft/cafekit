#!/bin/bash
# Dự án cửa hàng khoảng 60 file: lỗi thật nằm năm tầng dưới điểm vào (checkout → summary → total →
# engine → rules/tier-threshold), vài file trong dự án trông giống thủ phạm, và một hàm cùng tên nằm
# trong node_modules làm mồi. Mồi lưu dưới tên khác vì .gitignore bỏ mọi
# node_modules/; không có .gitignore trong phòng thử để mồi thật sự tìm thấy được.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
mv fake_node_modules node_modules
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
