#!/usr/bin/env sh
set -eu

cd /workspace

LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
INSTALLED_HASH=""
if [ -f node_modules/.package-lock.hash ]; then
  INSTALLED_HASH="$(cat node_modules/.package-lock.hash)"
fi

if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$INSTALLED_HASH" ]; then
  echo "[backend] Installing dependencies because lockfile changed or node_modules is missing..."
  npm ci --no-audit --no-fund
  mkdir -p node_modules
  printf "%s" "$LOCK_HASH" > node_modules/.package-lock.hash
fi

npm run migrate
exec node --watch --import tsx server.ts
