#!/bin/sh
# Cài môi trường phát triển cho dự án.
set -e
case "$(uname -s)" in
  Darwin)
    brew install node@22 jq
    sh scripts/setup-mac.sh
    ;;
  Linux)
    sudo apt-get install -y nodejs jq
    sh scripts/setup-linux.sh
    ;;
  *)
    echo "hệ điều hành chưa hỗ trợ" >&2
    exit 1
    ;;
esac
