#!/bin/bash
# The evals/develop/mot-task-sach pattern: an accepted packet, provenance.cjs and one real commit.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/fixture/." .
mkdir -p .claude/scripts && mv claude-scripts/provenance.cjs .claude/scripts/ && rmdir claude-scripts
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
