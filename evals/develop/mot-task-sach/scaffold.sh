#!/bin/bash
# Fixture nguyên vẹn: đo giá SÀN của một lượt develop khi không có gì hỏng.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
