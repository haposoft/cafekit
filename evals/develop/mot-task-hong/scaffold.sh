#!/bin/bash
# Cùng fixture, cộng ĐÚNG MỘT lỗi cấy, và lỗi nằm ở MÔI TRƯỜNG chứ không ở code:
# Verification Plan của task trỏ vào `node --test test/`, dạng thư mục mà Node 24 nạp như
# một module nên ném MODULE_NOT_FOUND. Đường chạy đúng là `node --test test/greet.test.js`.
# Chọn chỗ này vì nó là lỗi DUY NHẤT sống sót qua việc model đọc task và đọc test: chỉ lộ
# ra khi chạy. Đây cũng là vòng sửa có thật — radar-insight mất 23 phút vì đúng loại lỗi này.
# Lỗi nằm trong scaffold chứ không ở một bản fixture thứ hai, để hai ca không trôi khác nhau.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
TASK=specs/doi-loi-chao/task-01-doi-loi-chao.md
sed -i.bak 's|^- Command: `node --test test/greet\.test\.js`$|- Command: `node --test test/`|' "$TASK"
rm -f "$TASK.bak"
sed -i.bak 's|"node --test test/greet.test.js"|"node --test test/"|' package.json
rm -f package.json.bak
grep -q 'Command: `node --test test/`$' "$TASK" || { echo "lỗi cấy không áp được" >&2; exit 1; }
