#!/usr/bin/env sh
set -eu

APP_ROOT="${APP_ROOT:-/app}"
APP_DATA_DIR="${APP_DATA_DIR:-/workspace-data}"
TSX_LOADER="${APP_ROOT}/node_modules/tsx/dist/loader.mjs"

mkdir -p "$APP_DATA_DIR"
mkdir -p "$APP_DATA_DIR/snapshots"

if [ -z "${DB_CONFIG_PATH:-}" ]; then
  export DB_CONFIG_PATH="$APP_DATA_DIR/db-config.json"
fi

if [ ! -f "$DB_CONFIG_PATH" ]; then
  cat > "$DB_CONFIG_PATH" <<'EOF'
{
  "dialect": "sqlite",
  "storage": "./db.sqlite3",
  "logging": false
}
EOF
fi

cd "$APP_DATA_DIR"

node --import "$TSX_LOADER" "$APP_ROOT/scripts/migrate.ts"
exec node --import "$TSX_LOADER" "$APP_ROOT/server.ts"
