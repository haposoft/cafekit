#!/bin/bash
# Same Express fixture the other cases use: one project, one place to cite.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../dung-o-c1/fixture/." .
