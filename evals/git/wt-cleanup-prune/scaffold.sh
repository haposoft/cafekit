#!/bin/bash
# Dựng ./box/repo với: repo-ci (thư mục đã bị rm -rf, nên prunable), repo-wip (sửa README chưa commit), repo-env (chỉ có .env bị
# ignore), feat/done (đã merge, không có worktree) và feat/old (có commit chưa merge, không có worktree).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../lib/box.sh"
box_init
box_repo repo
box_ignore repo ".env"
box_worktree repo repo-ci feat/ci main
box_worktree repo repo-wip feat/wip main
box_worktree repo repo-env feat/env main
box_git -C box/repo branch feat/done main
box_git -C box/repo checkout -q -b feat/old
box_commit repo old.txt "old work" "feat: old work"
box_git -C box/repo checkout -q main
rm -rf box/repo-ci
echo "edited" >> box/repo-wip/README
echo "K=1" > box/repo-env/.env
