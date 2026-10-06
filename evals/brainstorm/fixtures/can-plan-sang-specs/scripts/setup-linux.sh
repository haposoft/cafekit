#!/bin/sh
# Linux: cài pnpm bằng npm toàn cục; không tạo .env.
set -e
sudo npm install -g pnpm@8.15.0
pnpm install --frozen-lockfile
