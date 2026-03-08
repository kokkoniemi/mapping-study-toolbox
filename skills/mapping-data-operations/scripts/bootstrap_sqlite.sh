#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bootstrap_sqlite.sh --db <sqlite_path> [options]

Create/update mapping-study-toolbox sqlite config files:
  - db-config.json
  - config/config.json

Options:
  --db <path>           sqlite file path to use in both config files.
  --repo-root <path>    Path to mapping-study-toolbox repo.
  --no-migrate          Do not run npm run migrate after writing config files.
  -h, --help            Show this help message.

Examples:
  ./skills/mapping-data-operations/scripts/bootstrap_sqlite.sh \
    --db /home/user/data/mapping.sqlite3
  ./skills/mapping-data-operations/scripts/bootstrap_sqlite.sh \
    --db ./mapping.sqlite3 --no-migrate
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DB_PATH=""
RUN_MIGRATE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)
      DB_PATH="$2"
      shift 2
      ;;
    --repo-root)
      REPO_ROOT="$2"
      shift 2
      ;;
    --no-migrate)
      RUN_MIGRATE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${DB_PATH}" ]]; then
  echo "Missing required --db argument." >&2
  usage >&2
  exit 1
fi

REPO_ROOT="$(cd "${REPO_ROOT}" && pwd)"
mkdir -p "${REPO_ROOT}/config"

cat > "${REPO_ROOT}/db-config.json" <<EOF
{
  "dialect": "sqlite",
  "storage": "${DB_PATH}",
  "logging": false
}
EOF

cat > "${REPO_ROOT}/config/config.json" <<EOF
{
  "development": {
    "dialect": "sqlite",
    "storage": "${DB_PATH}",
    "logging": false
  },
  "test": {
    "dialect": "sqlite",
    "storage": ":memory:"
  },
  "production": {
    "dialect": "sqlite",
    "storage": "${DB_PATH}",
    "logging": false
  }
}
EOF

echo "Wrote sqlite config files:"
echo "- ${REPO_ROOT}/db-config.json"
echo "- ${REPO_ROOT}/config/config.json"

if [[ "${RUN_MIGRATE}" -eq 1 ]]; then
  echo "Running migrations..."
  (cd "${REPO_ROOT}" && npm run migrate)
fi

echo "Done."
