---
name: mapping-ui-sync
description: Build, validate, and sync UI artifacts from ui/ into mapping-study-toolbox/public in this monorepo. Use when frontend code changes, packaged assets in public/ are stale, or backend and UI integration needs verification.
---

# Mapping UI Sync

## Workflow
1. Treat `ui/` as source of truth for UI code.
2. Apply and validate UI changes in `ui/`.
3. Run `scripts/sync_ui_build.sh` to build `ui/` and refresh this repo's `public/`.
4. Verify `public/index.html` points to existing files in `public/assets/`.
5. Smoke-check the full app by running backend (`npm start`) and opening `http://localhost:3000`.

## Guardrails
- Do not hand-edit hashed files in `public/assets/`; rebuild from UI source.
- Keep the API contract in sync with `ui/src/helpers/api.js`.
- Keep backend server port and UI API base aligned (default backend on `3000`).
- When changing contract-sensitive behavior, update backend and UI together.

## Script usage
- Build + sync with defaults:
  - `./skills/mapping-ui-sync/scripts/sync_ui_build.sh`
- Use explicit paths:
  - `./skills/mapping-ui-sync/scripts/sync_ui_build.sh --ui-dir ./ui --public-dir ./public`
- Validate steps without writing:
  - `./skills/mapping-ui-sync/scripts/sync_ui_build.sh --dry-run --skip-build`

## Useful files
- `references/integration-checklist.md`: end-to-end UI and backend compatibility checklist.
- `scripts/sync_ui_build.sh`: deterministic build-and-copy workflow for packaged UI assets.
