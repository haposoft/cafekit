#!/usr/bin/env bash
# Hàm dùng chung cho scaffold của bộ ca cf:sync: dựng một repo git tạm `./box/` ngay trong phòng thử của lượt chạy.
# Từ chối chạy ngoài thư mục tạm, không đặt remote, không ghi ngoài phòng thử. `box/.eval/` (nhật ký, ảnh chụp) nằm trong
# .git/info/exclude của hộp: provenance.cjs đọc cả file chưa track, nên một file log ngoài specs/ sẽ làm đổi Head mỗi lần chạy lệnh.
BOX_MARKER=".sync-eval-box"
BOX_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

box_fail() { echo "box: $*" >&2; return 1; }

# git với danh tính cố định, không ký, không hook của người dùng, không biến GIT_* thừa kế.
box_git() {
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -c user.name=eval -c user.email=eval@example.invalid -c commit.gpgsign=false \
    -c core.hooksPath=/dev/null -c init.defaultBranch=main "$@"
}

# Đường dẫn có nằm dưới một thư mục tạm (/tmp, /var/folders, TMPDIR) hay dưới $BOX_ALLOW_DIR không. $HOME và / không bao giờ là thư mục tạm.
box_path_in_temp() {
  local here root
  here="$(cd "$1" 2>/dev/null && pwd -P)" || return 1
  # chính $TMPDIR (macOS: /var/folders/…/T) là chỗ dùng chung dù nó nằm dưới /var/folders
  [ "$here" != "$(cd "${TMPDIR:-/tmp}" 2>/dev/null && pwd -P)" ] || return 1
  for root in /tmp /private/tmp /var/tmp /private/var/tmp /var/folders /private/var/folders \
    "$(cd "${TMPDIR:-/tmp}" 2>/dev/null && pwd -P)" ${BOX_ALLOW_DIR:+"$(cd "$BOX_ALLOW_DIR" 2>/dev/null && pwd -P)"}; do
    [ -n "$root" ] && [ "$root" != / ] && [ "$root" != "$(cd "$HOME" 2>/dev/null && pwd -P)" ] || continue
    # ít nhất một cấp con: chính /tmp hay $TMPDIR là chỗ dùng chung, không phải phòng thử
    case "$here/" in "$root"/?*/) return 0;; esac
  done
  return 1
}

# Tạo ./box (repo git trên main) và dấu `.sync-eval-box` ở phòng thử; ghim đường dẫn tuyệt đối của nhật ký shim vào box/.eval/shim.path; loại .eval/ khỏi git.
# Harness niêm phong một `home/` vốn đã là repo git và đặt phòng thử trong đó; một repo thật ngoài thư mục tạm thì bị từ chối.
box_init() {
  local top
  case "$PWD" in /|"$HOME") box_fail "refusing to build in $PWD"; return 1;; esac
  box_path_in_temp "$PWD" || { box_fail "cwd is not under a temp directory or BOX_ALLOW_DIR: $PWD"; return 1; }
  top="$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null)" || top=""
  if [ -n "$top" ] && ! box_path_in_temp "$top"; then box_fail "cwd is inside a git repository outside a temp directory: $top"; return 1; fi
  [ ! -e box ] || { box_fail "box already exists"; return 1; }
  mkdir -p box/.eval && box_git -C box init -q -b main || return 1
  printf '.eval/\n' >> box/.git/info/exclude
  printf '%s\n' "$PWD/box/.eval/shim.log" > box/.eval/shim.path
  : > "$BOX_MARKER"
}

box_guard() { [ -f "$BOX_MARKER" ] && [ -d box/.git ] && [ ! -L box ] || box_fail "box_init has not run in $PWD"; }

# box_fixture <fixture dir>: chép fixture vào hộp; thư mục `claude-dir/` của fixture thành `box/.claude/` (.gitignore của repo nguồn bỏ qua
# mọi `.claude`, nên fixture không thể lưu nó dưới tên thật).
box_fixture() {
  box_guard && [ -d "$1" ] || { box_fail "no fixture at $1"; return 1; }
  cp -R "$1/." box/ || return 1
  if [ -d box/claude-dir ]; then [ ! -e box/.claude ] || { box_fail "box/.claude exists"; return 1; }; mv box/claude-dir box/.claude; fi
}

# box_commit <message>: commit mọi thay đổi trong hộp (trừ .eval/, đã bị loại).
box_commit() { box_guard && box_git -C box add -A && box_git -C box commit -q -m "$1"; }

# box_snapshot: chụp trạng thái cuối của scaffold (mã băm từng file + dòng git status) để thước đo so sánh sau lượt chạy.
box_snapshot() { box_guard && node "$BOX_LIB/state.mjs" --snapshot box; }
