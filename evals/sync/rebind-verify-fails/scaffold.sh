#!/bin/bash
# Ca rebind-verify-fails: như rebind-base-moved, nhưng commit ngoài specs/ đổi câu tạm biệt nên Command của task-02 nay thoát 1.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../lib/box.sh"
. "$HERE/../fixtures/rebind/build.sh"
rebind_build fail
