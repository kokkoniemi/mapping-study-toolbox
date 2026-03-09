---
name: mapping-backend-api
description: Maintain and extend the mapping-study-toolbox backend API and persistence layer. Use when editing server.js, routes/*.js, models/*.js, migrations/*.js, or when response contracts consumed by ui/src/helpers/api.js may change.
---

# Mapping Backend API

## Workflow
1. Confirm expected request and response shapes in `references/api-contract.md`.
2. Confirm model relationships and sqlite-specific constraints in `references/data-model.md`.
3. Implement route/model changes with backward-compatible payloads unless a coordinated UI change is requested.
4. Add a new migration for schema changes; do not modify old migrations.
5. Validate:
   - Run `npm run migrate`.
   - Start backend with `npm start`.
   - Run `./skills/mapping-backend-api/scripts/smoke_api.sh`.

## Contract guardrails
- Keep `GET /api/records` response as `{ count, records }`.
- Keep `GET /api/mapping-questions` response as `{ count, questions }`.
- Preserve `Record` include aliases expected by UI: `Forum`, `MappingOptions`.
- Keep record status domain aligned with UI actions: `null`, `uncertain`, `excluded`, `included`.
- Keep position ordering behavior for mapping questions/options.

## Migration guardrails
- Add migrations instead of rewriting migration history.
- Prefer additive schema updates for sqlite compatibility.
- Keep migration `down` functions available where practical.
- Verify runtime config resolves `config/config.json` for the active `NODE_ENV`.

## Useful files
- `references/api-contract.md`: endpoint-level contract summary with payload expectations.
- `references/data-model.md`: table, field, and association summary for safe model changes.
- `scripts/smoke_api.sh`: curl + Node smoke checks for the API contract.
