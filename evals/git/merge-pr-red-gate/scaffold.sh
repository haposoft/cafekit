#!/bin/bash
# Cùng PR #7 và cùng gh giả với merge-pr-ci, chỉ khác reviewDecision là CHANGES_REQUESTED nên cổng sẵn sàng đỏ.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
GH_REVIEW_DECISION=CHANGES_REQUESTED bash "$HERE/../merge-pr-ci/scaffold.sh"
