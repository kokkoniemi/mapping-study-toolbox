# AGENTS.md

## Purpose
This repository contains a mapping-study backend API and a separate frontend app in the same monorepo.

## Repositories in scope
- `mapping-study-toolbox` (this repo): Express API, Sequelize models/migrations, shared contracts, and UI source in `ui/`.

## Local setup checklist
1. Preferred dev mode: `docker compose up` (backend + ui hot reload).
2. For local non-docker mode: install dependencies (`npm install`, `npm run ui:install`).
3. Create `config/config.json`, usually by copying `config/config.example.json` and setting sqlite `storage`.
5. Run migrations: `npm run migrate`.
6. Start backend API: `npm start` (serves `/api` on `http://localhost:3000`).
7. Start UI dev server: `npm run ui:dev` (serves app on `http://localhost:8080`).

## Contract-critical behavior
- UI calls are defined in `ui/src/helpers/api.ts`.
- Keep these response shapes stable unless UI and backend are updated together:
  - `GET /api/records` -> `{ count, records }`
  - `GET /api/mapping-questions` -> `{ count, questions }`
- Keep include aliases stable in record payloads: `Forum`, `MappingOptions`.
- Valid inclusion/exclusion status values are `null`, `uncertain`, `excluded`, `included`.
- Mapping question and option ordering is based on `position`.

## Schema change policy
- Never rewrite existing migration files.
- Add new migration files for every schema change.
- Keep changes additive when possible to protect existing sqlite datasets.

## UI sync policy
- Treat `ui/` as the UI source of truth.
- Backend and frontend are intentionally separate services/ports.
- `npm run ui:build` outputs static files to `ui/dist` for external/static hosting.

## Data operations
- Use `config/config.json` (from `config/config.example.json`) for runtime + migrations.
- Run migrations before first startup against a new sqlite DB.
- Keep schema changes additive via new migration files.

## Project-local skills
- `skills/mapping-backend-api`: backend API + Sequelize contract maintenance.
- `skills/mapping-ui-sync`: GUI build and sync workflow inside this monorepo.
- `skills/mapping-data-operations`: sqlite setup and migration workflow.
