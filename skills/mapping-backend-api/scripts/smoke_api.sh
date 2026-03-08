#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: smoke_api.sh [base_url]

Run lightweight contract checks against mapping-study-toolbox API.

Arguments:
  base_url    API base URL. Default: http://localhost:3000/api

Examples:
  ./skills/mapping-backend-api/scripts/smoke_api.sh
  ./skills/mapping-backend-api/scripts/smoke_api.sh http://localhost:3000/api
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

BASE_URL="${1:-http://localhost:3000/api}"
BASE_URL="${BASE_URL%/}"

echo "Checking API at: ${BASE_URL}"

records_json="$(curl -fsS "${BASE_URL}/records?offset=0&limit=1")"
printf '%s' "${records_json}" | node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
if (typeof payload.count !== "number") {
  throw new Error("GET /records: missing numeric count");
}
if (!Array.isArray(payload.records)) {
  throw new Error("GET /records: missing records array");
}
if (payload.records.length > 0) {
  const record = payload.records[0];
  if (typeof record.id !== "number") {
    throw new Error("GET /records: record.id is missing");
  }
  if (!("MappingOptions" in record)) {
    throw new Error("GET /records: MappingOptions include is missing");
  }
}
'
echo "OK: GET /records"

questions_json="$(curl -fsS "${BASE_URL}/mapping-questions")"
printf '%s' "${questions_json}" | node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
if (typeof payload.count !== "number") {
  throw new Error("GET /mapping-questions: missing numeric count");
}
if (!Array.isArray(payload.questions)) {
  throw new Error("GET /mapping-questions: missing questions array");
}
if (payload.questions.length > 0) {
  const question = payload.questions[0];
  if (typeof question.id !== "number") {
    throw new Error("GET /mapping-questions: question.id is missing");
  }
  if (!Array.isArray(question.MappingOptions)) {
    throw new Error("GET /mapping-questions: MappingOptions include is missing");
  }
}
'
echo "OK: GET /mapping-questions"

echo "All smoke checks passed."
