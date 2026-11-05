#!/bin/bash
# Ca sua-task-done (specs/skill-gotchas-eval D-04): hai task done, Receipt hợp lệ và ĐÃ COMMIT; task-01 có `- [ ] AC-01` chưa tick;
# rồi một commit ngoài specs/ làm Base dời. Gate xanh vì file task khớp bản đã commit (chế độ structure); tick checkbox làm file
# lệch bản đã commit, gate ràng buộc Base/Head sống và Receipt cũ fail `provenance` cho tới khi được rebind.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../lib/box.sh"
FIX="$HERE/../fixtures/rebind"
T1=box/specs/doi-ten/task-01-loi-chao.md
box_init
box_fixture "$FIX/tree"
sed -i.bak 's/^- AC-01: /- [ ] AC-01: /' "$T1" && rm -f "$T1.bak"
[ "$(grep -c '^- \[ \] AC-01: ' "$T1")" = 1 ] || { box_fail "checkbox did not apply to task-01"; exit 1; }
box_commit "feat: lời chào và lời tạm biệt có tên"
for t in task-01-loi-chao.md task-02-tam-biet.md; do node "$HERE/../fixtures/write-receipt.mjs" box doi-ten "$t" >/dev/null; done
box_git -C box add specs && box_git -C box commit -q -m "docs(specs): receipts"
printf '\nChạy test: `node --test test/`.\n' >> box/README.md
box_commit "docs: cách chạy test"
node "$FIX/meta.mjs" box
box_snapshot
