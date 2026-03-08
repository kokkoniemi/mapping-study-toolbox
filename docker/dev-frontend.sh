#!/usr/bin/env sh
set -eu

cd /workspace/ui

LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
INSTALLED_HASH=""
if [ -f node_modules/.package-lock.hash ]; then
  INSTALLED_HASH="$(cat node_modules/.package-lock.hash)"
fi

if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$INSTALLED_HASH" ]; then
  echo "[frontend] Installing dependencies because lockfile changed or node_modules is missing..."
  npm ci --no-audit --no-fund
  mkdir -p node_modules
  printf "%s" "$LOCK_HASH" > node_modules/.package-lock.hash
fi

exec node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080
