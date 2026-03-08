# mapping-study-toolbox

This repository is now a monorepo with:
- `server` side API (Express + Sequelize + sqlite + TypeScript)
- `ui/` frontend source (Vue 3 + Vite)
- separated runtime: backend API on `3000`, frontend on `8080`

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

This starts:
- backend (auto-migrates sqlite and hot-reloads on backend file changes)
- frontend Vite dev server (hot-reloads on UI changes)
- if missing, `config/config.json` is created automatically from `config/config.example.json`

Open:
- UI (dev/HMR): http://localhost:8080
- API: http://localhost:3000/api
- sqlite DB file (default): `./db.sqlite3`

Useful commands:
```shell
docker compose down
docker compose logs -f
docker compose down -v   # also removes node_modules volumes
docker compose build     # rebuild images after dependency changes
```

## Local (without Docker)

### System requirements
- node.js v24 LTS or above (you can use [nvm](https://github.com/nvm-sh/nvm))
- npm
- sqlite3

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
3. Ensure DB config exists for runtime + migrations:
   - copy `config/config.example.json` to `config/config.json` and set sqlite path (`storage`)
4. Run local migrations:
```shell
npm run migrate
```
5. Start services:
```shell
npm start
npm run ui:dev
```

### Quality checks (recommended before commit)
```shell
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

### Run search
```
node scrapers/[scraper-name].js
```

## Api and GUI

The backend (`server.ts`) exposes only the API at `http://localhost:3000/api`.
The frontend runs separately with Vite dev server.

### Run UI dev server
```shell
npm run ui:dev
```
UI dev server runs on http://localhost:8080 and calls backend API at http://localhost:3000/api/.

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
