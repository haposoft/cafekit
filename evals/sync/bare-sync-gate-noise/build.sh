#!/usr/bin/env bash
# Dựng hộp cho ca bare-sync-gate-noise; cần lib/box.sh đã được nạp. Ba gói process-first:
#   them-dang-nhap — gói đang mở: task-01 done với Receipt thật rồi cũ đi như plan D-01 (commit ngoài specs/ + sửa chính tả Outcome
#                    không commit), task-02 in_progress với việc thật CHƯA xong (login trả null, test fail). Cùng một gói vì khi có
#                    một gói đang mở, gate chỉ kiểm Receipt của gói đó;
#   bao-cao, don-dep — đã đóng: task-01 done, Receipt thật, đã commit và không đổi (hợp lệ).
# `.claude/` có runtime.json, settings.json và cả cây hooks/ với các script nó cần, để model có thể chạy lại gate.
BARE_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bare_build() {
  local t
  box_init && box_fixture "$BARE_HERE/tree" && box_commit "feat: đăng nhập, báo cáo, dọn dữ liệu" || return 1
  node "$BARE_HERE/../fixtures/write-receipt.mjs" box them-dang-nhap task-01-kiem-mat-khau.md >/dev/null || return 1
  node "$BARE_HERE/../fixtures/write-receipt.mjs" box bao-cao task-01-tong.md >/dev/null || return 1
  node "$BARE_HERE/../fixtures/write-receipt.mjs" box don-dep task-01-cat-khoang-trang.md >/dev/null || return 1
  box_git -C box add specs && box_git -C box commit -q -m "docs(specs): receipts" || return 1
  printf '\nChạy test: `node --test test/`.\n' >> box/README.md
  box_commit "docs: cách chạy test" || return 1
  t=box/specs/them-dang-nhap/task-01-kiem-mat-khau.md
  sed -i.bak 's/ngắn hon tám/ngắn hơn tám/' "$t" && rm -f "$t.bak"
  grep -q 'ngắn hơn tám' "$t" || { box_fail "typo fix did not apply"; return 1; }
  node "$BARE_HERE/../fixtures/state-meta.mjs" box || return 1
  box_snapshot
}
