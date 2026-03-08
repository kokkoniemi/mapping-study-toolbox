#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: sync_ui_build.sh [options]

Build ui/ and refresh packaged assets in public/.

Options:
  --ui-dir <path>        Path to monorepo UI directory. Default: <repo>/ui
  --public-dir <path>    Path to packaged public directory. Default: <repo>/public
  --skip-build           Skip npm run build and only validate output files.
  --dry-run              Print actions without running build.
  -h, --help             Show this help message.

Defaults:
  ui-dir:      ui/ in this repository
  public-dir:  public/ in this repository
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

UI_DIR="${DEFAULT_REPO_DIR}/ui"
PUBLIC_DIR="${DEFAULT_REPO_DIR}/public"
SKIP_BUILD=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ui-dir)
      UI_DIR="$2"
      shift 2
      ;;
    --public-dir)
      PUBLIC_DIR="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

UI_DIR="$(cd "${UI_DIR}" && pwd)"
PUBLIC_DIR="$(cd "${PUBLIC_DIR}" && pwd)"

if [[ ! -d "${UI_DIR}" ]]; then
  echo "UI directory not found: ${UI_DIR}" >&2
  exit 1
fi

if [[ ! -d "${PUBLIC_DIR}" ]]; then
  echo "Public directory not found: ${PUBLIC_DIR}" >&2
  exit 1
fi

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  echo "Building UI in ${UI_DIR}"
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "Dry run mode: skipping build command."
    exit 0
  fi
  (cd "${UI_DIR}" && npm run build)
fi

INDEX_FILE="${PUBLIC_DIR}/index.html"
ASSETS_DIR="${PUBLIC_DIR}/assets"

if [[ ! -f "${INDEX_FILE}" ]]; then
  echo "Missing packaged index file: ${INDEX_FILE}" >&2
  exit 1
fi

if [[ ! -d "${ASSETS_DIR}" ]]; then
  echo "Missing packaged assets directory: ${ASSETS_DIR}" >&2
  exit 1
fi

echo "UI build sync complete."
echo "Packaged assets:"
find "${ASSETS_DIR}" -maxdepth 1 -type f -printf "%f\n" | sort
