# Database And Import Workflow

## 1. Configure sqlite paths
- Runtime config file:
  - `db-config.json`
- Migration config file:
  - `config/config.json`
- Keep both pointing to the same sqlite file.

## 2. Run migrations
- Command:
  - `npm run migrate`
- Run before first API start on a new DB and before import scripts.

## 3. Initialize scraper submodule
- If `scrapers/` is empty or missing expected scripts:
  - `git submodule update --init --recursive`

## 4. Run scraper/import scripts
- Typical pattern:
  - Edit query inside target scraper script in `scrapers/`.
  - Execute script with Node.
- Imports update the sqlite database consumed by this backend API.

## 5. Verify data from API
- Start backend:
  - `npm start`
- Validate with API call:
  - `curl "http://localhost:3000/api/records?offset=0&limit=5"`
- Confirm count and record payloads are returned.

## Common pitfalls
- Migrations fail because `config/config.json` is missing.
- Runtime fails because `db-config.json` still has placeholder storage path.
- Scraper scripts unavailable because submodule was not initialized.
