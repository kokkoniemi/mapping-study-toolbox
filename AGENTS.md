# AGENTS.md

## Purpose
This repository is the backend and packaged UI host for a mapping-study literature classification tool.

## Repositories in scope
- `mapping-study-toolbox` (this repo): Express API, Sequelize models/migrations, UI source in `ui/`, and packaged static UI in `public/`.
- `scrapers/`: git submodule (`mapping-study-scrapers`) used for importing search results.

## Local setup checklist
1. Install dependencies in this repo: `npm install`.
2. Install UI dependencies: `npm run ui:install`.
3. Create `db-config.json` (runtime DB config) with sqlite `storage` path.
4. Create `config/config.json` (sequelize-cli config), usually by copying `config/config.example.json` and setting the same sqlite `storage`.
5. Run migrations: `npm run migrate`.
6. Build UI into `public/`: `npm run ui:build`.
7. Start backend + packaged UI host: `npm start` (serves `/api` and `public/` on `http://localhost:3000`).

## Contract-critical behavior
- UI calls are defined in `ui/src/helpers/api.js`.
- Keep these response shapes stable unless UI and backend are updated together:
  - `GET /api/records` -> `{ count, records }`
  - `GET /api/mapping-questions` -> `{ count, questions }`
- Keep include aliases stable in record payloads: `Publication`, `MappingOptions`.
- Valid inclusion/exclusion status values are `null`, `uncertain`, `excluded`, `included`.
- Mapping question and option ordering is based on `position`.

## Schema change policy
- Never rewrite existing migration files.
- Add new migration files for every schema change.
- Keep changes additive when possible to protect existing sqlite datasets.

## UI sync policy
- Treat `ui/` as the UI source of truth.
- After UI changes, run `npm run ui:build` to refresh `public/`.
- Ensure `public/index.html` references existing hashed assets in `public/assets/`.

## Scraper and data operations
- Initialize scrapers submodule when needed: `git submodule update --init --recursive`.
- Scrapers populate/augment the sqlite DB used by this backend.
- Run migrations before scraper/import runs on a new DB.

## Project-local skills
- `skills/mapping-backend-api`: backend API + Sequelize contract maintenance.
- `skills/mapping-ui-sync`: GUI build and sync workflow inside this monorepo.
- `skills/mapping-data-operations`: sqlite setup, migrations, and scraper/import operations.
