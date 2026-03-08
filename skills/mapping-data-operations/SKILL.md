---
name: mapping-data-operations
description: Configure sqlite runtime and migration settings and run data operations for mapping-study-toolbox. Use when preparing a new database, running sequelize migrations, initializing scraper submodule, or importing records into sqlite.
---

# Mapping Data Operations

## Workflow
1. Configure database files:
   - Runtime config: `db-config.json`
   - sequelize-cli config: `config/config.json`
2. Run migrations with `npm run migrate`.
3. Initialize scraper submodule if needed:
   - `git submodule update --init --recursive`
4. Run scraper/import scripts against the migrated sqlite DB.
5. Validate API can read imported data through `/api/records`.

## Safe defaults
- Keep sqlite paths explicit and environment-local.
- Avoid destructive data operations unless explicitly requested.
- Run migrations before imports on new DB files.
- Keep both config files pointed to the same sqlite file path.

## Script usage
- Generate/update both DB config files, optionally run migrations:
  - `./skills/mapping-data-operations/scripts/bootstrap_sqlite.sh --db /absolute/path/mapping.sqlite3`
- Configure files only:
  - `./skills/mapping-data-operations/scripts/bootstrap_sqlite.sh --db /absolute/path/mapping.sqlite3 --no-migrate`

## Useful files
- `references/db-and-import-workflow.md`: concise setup/import runbook.
- `scripts/bootstrap_sqlite.sh`: deterministic DB config bootstrap utility.
