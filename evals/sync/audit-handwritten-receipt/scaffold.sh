#!/bin/bash
# Ca audit-handwritten-receipt: audit một gói có Receipt viết tay (Head kèm "+ working tree", Command kèm ghi chú) cạnh một gói legacy.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../lib/box.sh"
. "$HERE/build.sh"
audit_build
