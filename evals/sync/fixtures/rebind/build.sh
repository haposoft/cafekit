#!/usr/bin/env bash
# Dựng hộp cho hai ca rebind (plan D-01). Dùng chung để hai ca không trôi khác nhau; cần lib/box.sh đã được nạp.
#   rebind_build pass|fail
# 1. commit code + gói (hai task done, Receipt rỗng); 2. chạy THẬT Command của từng task, ghi Receipt hợp lệ, commit gói;
# 3. một commit NGOÀI specs/ (Base dời): `pass` sửa README, `fail` đổi câu tạm biệt nên test của task-02 fail từ đây;
# 4. sửa lỗi chính tả trong Outcome của cả hai file task mà KHÔNG commit — file task lệch bản đã commit nên gate ràng buộc Base/Head
#    sống, và hai Receipt cũ fail `provenance` (một commit ngoài specs/ một mình không làm Receipt đã commit cũ đi: spec-receipt.cjs:210-234);
# 5. ghi box/.eval/meta.json cho thước rồi chụp ảnh trạng thái.
REBIND_FIX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REBIND_TASKS="task-01-loi-chao.md task-02-tam-biet.md"

rebind_build() {
  local mode="$1" t
  case "$mode" in pass|fail) ;; *) box_fail "rebind_build pass|fail"; return 1;; esac
  box_init && box_fixture "$REBIND_FIX/tree" && box_commit "feat: lời chào và lời tạm biệt có tên" || return 1
  for t in $REBIND_TASKS; do node "$REBIND_FIX/../write-receipt.mjs" box doi-ten "$t" >/dev/null || return 1; done
  box_git -C box add specs && box_git -C box commit -q -m "docs(specs): receipts" || return 1
  if [ "$mode" = pass ]; then
    printf '\nChạy test: `node --test test/`.\n' >> box/README.md
    box_commit "docs: cách chạy test" || return 1
  else
    sed -i.bak 's/Tạm biệt, /Hẹn gặp lại, /' box/src/farewell.mjs && rm -f box/src/farewell.mjs.bak
    box_commit "refactor: đổi câu tạm biệt" || return 1
  fi
  for t in $REBIND_TASKS; do
    sed -i.bak 's/có tên nguoi dùng\./có tên người dùng./' "box/specs/doi-ten/$t" && rm -f "box/specs/doi-ten/$t.bak"
    grep -q 'có tên người dùng\.' "box/specs/doi-ten/$t" || { box_fail "typo fix did not apply to $t"; return 1; }
  done
  node "$REBIND_FIX/meta.mjs" box || return 1
  box_snapshot
}
