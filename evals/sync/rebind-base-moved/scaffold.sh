#!/bin/bash
# Ca rebind-base-moved: hai task done có Receipt cũ đi vì Base dời và file task bị sửa sau commit; lệnh của cả hai vẫn pass.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../lib/box.sh"
. "$HERE/../fixtures/rebind/build.sh"
rebind_build pass
