#!/bin/bash
# Dựng ./box/repo trong phòng thử: nhánh dev đi trước main đúng một commit, đang đứng ở dev, cây sạch, .gitignore có .claude/,
# và .claude/ (đã bị ignore) chứa skills/ cần chép cùng session-state/, .logs/, worktrees/ không được chép.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../lib/box.sh"
box_init
box_repo repo
box_ignore repo ".claude/"
box_git -C box/repo checkout -q -b dev
box_commit repo feature.txt "dev work" "feat: dev work"
mkdir -p box/repo/.claude/skills/x box/repo/.claude/session-state box/repo/.claude/.logs box/repo/.claude/worktrees/w
echo "skill" > box/repo/.claude/skills/x/SKILL.md
echo "{}" > box/repo/.claude/session-state/s.json
echo "log" > box/repo/.claude/.logs/l.log
echo "nested" > box/repo/.claude/worktrees/w/n.txt
