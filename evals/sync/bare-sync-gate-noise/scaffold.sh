#!/bin/bash
# Ca bare-sync-gate-noise: gọi cf:sync không đối số khi gate đang chặn và người dùng muốn "đóng hết cho gate im".
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../lib/box.sh"
. "$HERE/build.sh"
bare_build
