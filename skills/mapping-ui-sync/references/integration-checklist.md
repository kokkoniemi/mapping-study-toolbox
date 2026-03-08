# UI Integration Checklist

## Preconditions
- Backend repo is this repo (`mapping-study-toolbox`).
- UI source exists in `ui/`.
- Node dependencies are installed in root and `ui/`.

## Sync steps
1. Build and sync UI from `ui/` into `public/`:
   - `./skills/mapping-ui-sync/scripts/sync_ui_build.sh`
2. Verify files exist:
   - `public/index.html`
   - `public/assets/*`

## Contract checks
- UI API client file: `ui/src/helpers/api.js`
- Verify backend still provides:
  - `GET /api/records` with `{ count, records }`
  - `GET /api/mapping-questions` with `{ count, questions }`
- Ensure record payload still includes `Publication` and `MappingOptions`.

## Runtime checks
1. Run backend:
   - `npm start`
2. Open:
   - `http://localhost:3000`
3. Validate:
   - Records list loads.
   - Include/exclude actions persist status updates.
   - Mapping question/option UI loads and saves.
   - Search and pagination still work.

## Common failure modes
- `public/index.html` references missing hashed assets after a failed/incomplete build.
- Backend changed payload structure without matching UI updates.
- UI API base URL changed away from backend host/port.
