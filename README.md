# mapping-study-toolbox

This repository is now a monorepo with:
- `server` side API (Express + Sequelize + sqlite + TypeScript)
- `ui/` frontend source (Vue 3 + Vite)
- dev split-runtime (`3000` API + `8080` Vite) and single-image runtime (`3000` serves UI + API)

![Screenshot of the GUI](screenshot.png)

## Quick start (Docker, recommended)
### 1. Clone the project
```
git clone https://github.com/kokkoniemi/mapping-study-toolbox.git
```
### 2. Start development stack
```shell
docker compose up --build
```

After the first build, normal startup is faster:
```shell
docker compose up
```

When `package-lock.json` (backend or `ui/`) changes, dependencies are automatically refreshed inside containers on next startup.

This starts:
- backend (auto-migrates sqlite and hot-reloads on backend file changes)
- frontend Vite dev server (hot-reloads on UI changes)
- Python keywording worker on `:8001`
- GROBID service on `:8070`
- backend DB config comes from `db-config.json` when present, otherwise defaults are used
- worker image includes `PyMuPDF`, `pdftoppm`, `tesseract`, and OpenAI/GROBID integration for PDF evidence extraction + taxonomy audit runs

Open:
- UI (dev/HMR): http://localhost:8080
- API: http://localhost:3000/api
- Keywording worker health: http://localhost:8001/health
- GROBID: http://localhost:8070
- sqlite DB file (default): `./db.sqlite3`

Useful commands:
```shell
docker compose down
docker compose logs -f
docker compose down -v   # also removes node_modules volumes
docker compose build     # rebuild images after dependency changes
```

Troubleshooting:
- If frontend reports missing module imports after adding dependencies, run:
  - `docker compose down -v && docker compose up --build`
- If API requests fail right after startup, wait for backend healthcheck and refresh once.

## Single-image release

Use this mode when you want the backend app image from GHCR plus the local worker/GROBID sidecars defined in the release compose file.

1. Move to the folder you wish to use for the mapping:
```shell
cd /path/to/my-research-project
```

2. Download the release compose file as `docker-compose.yml`:
```shell
curl -fsSL https://raw.githubusercontent.com/kokkoniemi/mapping-study-toolbox/master/docker-compose.release.yml -o docker-compose.yml
```

3. Start the app:
```shell
docker compose up -d
```

4. Open the app:
- UI: http://localhost:3000

Daily commands:
```shell
docker compose down # Shuts down the mapping tool
docker compose pull # Updates the mapping tool
docker compose up -d # Starts up the mapping tool
```

If your folder already has a `docker-compose.yml`, use a separate filename:
```shell
curl -fsSL https://raw.githubusercontent.com/kokkoniemi/mapping-study-toolbox/master/docker-compose.release.yml -o docker-compose.mapping-tool.yml
docker compose -f docker-compose.mapping-tool.yml up -d
```

What gets persisted in your research folder:
- `db.sqlite3`
- `snapshots/`
- `db-config.json` (created on first run when missing)

Notes:
- The release container auto-runs migrations at startup.
- You can pin image tag with `MAPPING_TOOL_IMAGE=ghcr.io/<owner>/<repo>:<tag>`.
- If you want to use OpenAlex for data enrichment, add api key (it's free) to OPENALEX_API_KEY variable in docker-compose.yml. See https://developers.openalex.org/guides/authentication.
- For GPT-backed taxonomy audit runs, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-5.4`) in the compose file or shell environment before `docker compose up`.
- Advanced keywording can run longer than standard jobs because it makes multiple sequential model calls. If needed, raise `KEYWORDING_ADVANCED_WORKER_TIMEOUT_MS` on the app service (default `1200000`, 20 minutes). `KEYWORDING_WORKER_TIMEOUT_MS` still controls the default timeout for standard worker calls (default `180000`, 3 minutes).
- Requires Docker Compose v2.
- Port `3000` must be available (or adjust the port mapping in the compose file).

## Local (without Docker)

### System requirements
- node.js v24 LTS or above (you can use [nvm](https://github.com/nvm-sh/nvm))
- npm
- sqlite3
- Python 3.12+
- `pdftoppm` / `pdftotext` (Poppler) if you want PDF evidence extraction outside Docker
- `tesseract` with English language data if you want OCR fallback outside Docker
- a reachable GROBID service if you want scholarly section parsing outside Docker

If you use nvm:
```shell
nvm install 24
nvm use 24
```

### Setup
1. Install backend dependencies:
```shell
npm install
```
2. Install UI dependencies:
```shell
npm run ui:install
```
3. (Optional) customize DB config in `db-config.json`:
   - by default, runtime + migrations use sqlite `./db.sqlite3` with logging disabled
   - in test environment, sqlite is always `:memory:`
   - optional override: set `DB_CONFIG_PATH` to use another `db-config.json` location
4. Run local migrations:
```shell
npm run migrate
```
5. Start services:
```shell
npm start
npm run ui:dev
```

To run the keywording worker locally too:
```shell
python3 -m venv .venv
. .venv/bin/activate
pip install -r worker/requirements.txt
uvicorn worker.app:app --host 0.0.0.0 --port 8001
```

If you run the backend outside Docker, export worker timeout overrides in the same shell before `npm start` when advanced jobs need more time:
```shell
export KEYWORDING_ADVANCED_WORKER_TIMEOUT_MS=1200000
```

### Quality checks (recommended before commit)
```shell
npm run lint
npm run typecheck
npm test
npm run ui:typecheck
npm run ui:test
npm run ui:lint
npm run ui:build
```

### Init Sqlite database
This is safe and does not affect the existing data in the database.
```
npm run migrate
```

## Api and GUI

In dev mode, backend and frontend run separately:
- backend API at `http://localhost:3000/api`
- frontend Vite dev server at `http://localhost:8080`

In single-image release mode, backend serves the built UI and API from the same host (`/` + `/api`).

GUI tabs:
- `Include/exclude literature`: focused classification flow
- `Map literature`: mapping questions/options flow
- `Data`: spreadsheet-like editable table for records and mapping assignments
  - built with Handsontable (`non-commercial-and-evaluation` license key in development)

### Run UI dev server
```shell
npm run ui:dev
```
UI dev server runs on http://localhost:8080 and calls backend API at http://localhost:3000/api/.

### DB config resolution
- Runtime and migrations share the same DB config resolver.
- For `NODE_ENV !== test`:
  - use `DB_CONFIG_PATH` when provided, otherwise `./db-config.json`
  - if config file is missing, fallback defaults are used (`sqlite`, `./db.sqlite3`, `logging: false`)
- For `NODE_ENV === test`:
  - DB is always `sqlite` with `:memory:` storage (file config ignored)

### Data tab backend endpoint
- `PATCH /api/records/:id` for partial record updates used by the Data tab.
  - supports `year` (`integer` or `null`) in addition to existing patchable fields.
- `POST /api/records/enrichment-jobs` to start bulk Crossref enrichment for selected record IDs.
  - accepts `mode: "missing" | "full"` (default `missing`).
- `GET /api/records/enrichment-jobs/:jobId` to poll job progress/results.
  - compact polling supported via `compact=1&resultCursor=<n>&updatedCursor=<n>` (delta payloads)
- `POST /api/records/enrichment-jobs/:jobId/cancel` to stop queued/running enrichment jobs.
- `GET /api/forums/duplicates` to discover duplicate forum groups (name/alias/issn based).
- `POST /api/forums/merge` to preview/apply forum merges (`dryRun=true|false`).
- `POST /api/imports/preview` to parse file content and preview import rows before writing records.
- `POST /api/imports` to create an import and insert new records.
- `GET /api/imports` to list imports with linked record counts.
- `DELETE /api/imports/:id` to remove an import and records created by that import.

### Crossref + OpenAlex enrichment
- In the `Data` tab, select rows (leftmost checkbox column), open the `Enrichment` tools sub-tab, choose service (`Crossref`, `OpenAlex`, or `Crossref + OpenAlex`) and mode (`Missing only` / `Full`), then click `Enrich selected`.
- Default service is `Crossref + OpenAlex`.
- Default mode is `Missing only`.
- You can stop a running job with the `Stop` button (cancels after the current record finishes).
- `Force refresh` bypasses freshness windows and executes as full re-fetch.
- Enrichment updates record DOI/author details/references and forum metadata (`publisher`, `issn`, `jufoLevel` when found).
- Enrichment also records per-field provenance (`provider`, confidence level + score, reason, timestamp, source identifier) to:
  - `Record.enrichmentProvenance`
  - `Forum.enrichmentProvenance`
- OpenAlex enrichment updates:
  - citation count
  - citation list (title/doi/link/year/forum)
  - topic list
  - author affiliations
- Reference list comes from Crossref only.
- Reference titles are backfilled from Crossref by DOI when missing (bounded by `CROSSREF_REFERENCE_TITLE_LOOKUP_MAX`, default `12` lookups per record).
- During processing, the status panel shows per-API counters:
  - records processed via Crossref/OpenAlex/JUFO
  - request counts sent to Crossref/OpenAlex/JUFO
- Queue controls:
  - queue size limit (`ENRICHMENT_MAX_QUEUED_JOBS`, default `20`)
  - per-job record limit (`ENRICHMENT_MAX_RECORDS_PER_JOB`, default `500`)
- DOI detection order:
  1. try extracting DOI from `url` / `alternateUrls`
  2. fallback to Crossref/OpenAlex title + author (+ year when available) search
  3. if DOI is found and URL is missing, URL is filled from provider metadata or DOI URL fallback
- JUFO lookup:
  - if forum ISSN is available, service does `etsi.php?issn=...` then resolves `/kanava/{id}` for level
  - JUFO requests are throttled with low concurrency and respectful pacing
- Rate-limit handling:
  - requests are throttled
  - `429` / `503` responses use backoff + retry (`Retry-After` honored when provided)
- Optional env vars:
  - `CROSSREF_BASE_URL` (default `https://api.crossref.org`)
  - `CROSSREF_MAILTO` (recommended contact email for Crossref requests)
  - `CROSSREF_REFERENCE_TITLE_LOOKUP_MAX` (default `12`)
  - `CROSSREF_REFRESH_MS` (default `30 days`)
  - `OPENALEX_BASE_URL` (default `https://api.openalex.org`)
  - `OPENALEX_API_KEY` (required for OpenAlex access)
  - `OPENALEX_MIN_DELAY_MS` (default `250`)
  - `OPENALEX_MAX_DELAY_MS` (default `800`)
  - `OPENALEX_REFRESH_MS` (default `30 days`)
  - `OPENALEX_MAX_CITATIONS` (optional hard cap; default `5000`)
  - `JUFO_BASE_URL` (default `https://jufo-rest.csc.fi/v1.1`)
  - `JUFO_MIN_DELAY_MS` (default `500`)
  - `JUFO_MAX_DELAY_MS` (default `1000`)
  - `CORS_ALLOWED_ORIGINS` (comma-separated list, default `http://localhost:8080,http://localhost:3000`)
  - `REQUEST_BODY_LIMIT` (default `8mb`)
  - `IMPORT_MAX_CONTENT_BYTES` (default `8000000`)
  - `IMPORT_PREVIEW_MAX_ROWS` (default `200`)
  - `ENRICHMENT_RATE_LIMIT_MAX_REQUESTS` (default `20`)
  - `ENRICHMENT_RATE_LIMIT_WINDOW_MS` (default `60000`)
  - `ENRICHMENT_MAX_QUEUED_JOBS` (default `20`)
  - `ENRICHMENT_MAX_RECORDS_PER_JOB` (default `500`)
  - `RECORD_LIST_LIMIT_MAX` (default `250`)

### Include/Map literature viewer
- References and citations are shown with structured viewers (collapsed by default, `See more / See less`).
- Viewer features:
  - sorting (`Year ↓`, `Year ↑`, `Title`, `Forum`)
  - free-text filtering (`title/forum/doi`)
  - DOI filter (`All`, `Has DOI`, `Missing DOI`)
  - progressive `Load more` rendering for large lists
- DOI-first rendering is used (no extra generic link when DOI link exists).
- Enriched field confidence/provenance badges are shown near record metadata.

### Forum cleanup tools (Data tab)
- Open Data tab -> `Forums` tools sub-tab.
- Workflow:
  1. Load/search duplicate groups.
  2. Select group.
  3. Choose one target forum and one or more source forums.
  4. Run `Preview merge`.
  5. Run `Apply merge`.
- Merge behavior:
  - transactional apply
  - moves all source forum records to target forum
  - merges aliases with normalization + dedupe
  - target values win; missing target values can be filled from sources
  - source forums are soft-deleted (paranoid model)

### Data import tools (Data tab)
- Open Data tab -> `Import` tools sub-tab.
- Supported input:
  - Scopus CSV
  - Scopus/ACM/Google Scholar BibTeX
  - other CSV/BibTeX files with common `title/author/year/doi/url` columns/fields
- Workflow:
  1. choose file
  2. choose source (`Auto detect` recommended)
  3. click `Preview`
  4. inspect rows (`new`, `duplicate`, `invalid`)
  5. click `Import`
- Duplicate detection is applied before insert using:
  - DOI match
  - URL/alternate URL match
  - title + first author family + year compatibility
- Import history is shown in the same panel and supports deleting an import together with its imported records.

### Local multi-user assessment workflow (no server auth)
- This mode is designed for local-first collaboration where each reviewer runs the tool on their own computer.
- User profiles are managed in-app (name + active/inactive), and review decisions are stored per user in separate assessment tables.
- Canonical `Record.status/comment/MappingOptions` are now treated as resolved/final outputs.
- Reviewer actions (`include/exclude`, mapping keyword selections, comments) are written to per-user assessments.
- Data tab has a `Compare` tools panel for:
  - pairwise agreement percentage
  - pairwise Cohen's Kappa (+ 95% CI)
  - disagreement listing (status + mapping; comments shown side-by-side for context)
  - manual resolution into canonical record fields

#### Snapshot exchange via Git (fixed filename per user)
- Export one deterministic snapshot file per user:
```shell
npm run snapshots:export -- --user-id 1 --out ./snapshots/user-1.json
```
- If the snapshot content did not change, the file is not rewritten (clean git history).
- Import a snapshot from another user:
```shell
npm run snapshots:import -- --in ./snapshots/user-2.json
```
- Generate markdown compare report from local DB:
```shell
npm run assessments:compare -- --users 1,2 --out ./reports/compare-1-2.md
```

### Where to put `OPENALEX_API_KEY`
- Docker: add `OPENALEX_API_KEY` under `services.backend.environment` in `docker-compose.yml` (or use `${OPENALEX_API_KEY}` with a local `.env` file).
- Local non-docker: export env var before starting backend, for example:
```shell
export OPENALEX_API_KEY='your-key-here'
npm start
```
- Do not commit secrets into git-tracked files.

### Build UI for deployment/static hosting
```shell
npm run ui:build
```
This outputs static files to `ui/dist`.

### UI tests and type safety
```shell
npm run ui:typecheck
npm run ui:test
```

## CI
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Runs backend and frontend checks on pushes and pull requests:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run ui:typecheck`
  - `npm run ui:test`
  - `npm run ui:build`
