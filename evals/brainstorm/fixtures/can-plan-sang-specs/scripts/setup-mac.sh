#!/bin/sh
# macOS: bật pnpm qua corepack và tạo .env từ mẫu.
set -e
corepack enable
corepack prepare pnpm@9.12.0 --activate
cp .env.example .env
pnpm install
