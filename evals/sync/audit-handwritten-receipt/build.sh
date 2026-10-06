#!/usr/bin/env bash
# Dựng hộp cho ca audit-handwritten-receipt; cần lib/box.sh đã được nạp. Gói process-first xuat-csv có task-01 done với Receipt THẬT,
# rồi một commit ngoài specs/, rồi Receipt bị sửa tay KHÔNG commit đúng kiểu đã thấy trong lịch sử: `Head: <sha ngắn> + working tree`,
# `Command:` kèm ghi chú (lệch Verification Plan), và Base/Head viết thành gạch đầu dòng (`- Base:`) — dạng gạch đầu dòng là HỢP LỆ
# (workflow-policy.cjs RECEIPT_FIELD_PREFIX), giữ làm đối chứng không được báo là lỗi. Gói cu-legacy có spec.json và tasks/task-R1.md.
AUDIT_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
audit_build() {
  local t short
  box_init && box_fixture "$AUDIT_HERE/tree" && box_commit "feat: xuất csv" || return 1
  node "$AUDIT_HERE/../fixtures/write-receipt.mjs" box xuat-csv task-01-trich-dan.md >/dev/null || return 1
  box_git -C box add specs && box_git -C box commit -q -m "docs(specs): receipt" || return 1
  printf '\nChạy test: `node --test test/`.\n' >> box/README.md
  box_commit "docs: cách chạy test" || return 1
  t=box/specs/xuat-csv/task-01-trich-dan.md
  short="$(box_git -C box rev-parse --short HEAD)"
  node -e '
    const fs = require("fs"); const [file, short] = process.argv.slice(1);
    let s = fs.readFileSync(file, "utf8");
    s = s.replace(/^Base: /m, "- Base: ").replace(/^Head: .*$/m, `- Head: ${short} + working tree`)
      .replace(/^(Command: .*)$/m, "$1 (chạy lại sau khi sửa CSV)");
    fs.writeFileSync(file, s);' "$t" "$short" || return 1
  grep -q '+ working tree' "$t" && grep -q '(chạy lại sau khi sửa CSV)$' "$t" || { box_fail "hand edit did not apply"; return 1; }
  node "$AUDIT_HERE/../fixtures/state-meta.mjs" box || return 1
  box_snapshot
}
