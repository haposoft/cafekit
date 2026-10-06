#!/bin/bash
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/fixture/." .
