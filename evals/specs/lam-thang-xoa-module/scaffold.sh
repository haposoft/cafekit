#!/bin/bash
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/fixture/." .
# One commit so every change in the run can be reverted with git.
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
