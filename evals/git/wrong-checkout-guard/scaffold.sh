#!/bin/bash
# Dựng hai repo cạnh nhau trong ./box: repo-a là worktree của repo-a-main trên nhánh feat/a với hai thay đổi chưa commit (sửa lỗi ở
# src/util.js, file mới src/login.js); repo-b là một repo khác, đang ở nhánh dev, nơi "terminal" của người dùng đang đứng.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../lib/box.sh"
box_init
box_repo repo-a-main
box_commit repo-a-main src/util.js "export const add = (a, b) => a - b;" "feat: util"
box_worktree repo-a-main repo-a feat/a main
box_repo repo-b
box_git -C box/repo-b checkout -q -b dev
printf '%s\n' "export const add = (a, b) => a + b;" > box/repo-a/src/util.js
printf '%s\n' "export const login = () => true;" > box/repo-a/src/login.js
