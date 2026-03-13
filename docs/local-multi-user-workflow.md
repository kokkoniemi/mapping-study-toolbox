# Local Multi-User Workflow

This runbook describes the local-first collaboration model:
- every reviewer runs the app on their own machine
- each reviewer writes to their own profile-specific assessments
- snapshots are exchanged through Git
- final resolved decisions are written separately to canonical record fields

## Core rules

1. Keep one stable profile name per person (for example `Alice Reviewer`).
2. Use one fixed snapshot filename per person (for example `snapshots/alice.json`).
3. Commit snapshots only when file content changes.
4. Do not edit snapshot JSON manually.

Notes:
- Canonical `Record.status`, `Record.comment`, and `Record.MappingOptions` are resolved outputs.
- Per-user assessments remain intact for audit/comparison after resolution.

## One-time setup on each machine

1. Start the app (Docker or local setup is fine).
2. Create your user profile in the UI (`Profile` selector -> `Manage`).
3. Select your profile as active before reviewing records.
4. Find your numeric profile id (needed for export script):

```sh
curl -s http://localhost:3000/api/users
```

## Reviewer daily workflow

1. Pull latest app changes and latest shared snapshots repo changes.
2. Review records in the UI with your active profile selected.
3. Export your current snapshot to your fixed file path:

```sh
npm run snapshots:export -- --user-id <YOUR_USER_ID> --out ./snapshots/<your-file>.json
```

4. Commit only if changed:

```sh
git add ./snapshots/<your-file>.json
git diff --cached --quiet || git commit -m "snapshot: <your name>"
git push
```

## Coordinator workflow

1. Pull latest snapshot commits.
2. Import all reviewer snapshot files:

```sh
for file in ./snapshots/*.json; do
  npm run snapshots:import -- --in "$file"
done
```

3. Generate comparison report:

```sh
npm run assessments:compare -- --out ./reports/compare-latest.md
```

Optional: compare only specific users.

```sh
npm run assessments:compare -- --users 1,2,3 --out ./reports/compare-1-2-3.md
```

4. Open the app UI -> `Data` -> `Compare` tab.
5. Resolve disagreements manually. This writes final values to canonical record fields only.

## Snapshot Git contract

Use one fixed path per reviewer, for example:
- `snapshots/alice.json`
- `snapshots/bob.json`
- `snapshots/charlie.json`

Why this matters:
- filename stays stable
- unchanged exports do not rewrite file content
- Git history is clean and diffs are easy to browse

## Troubleshooting

1. Import created an unexpected new user profile:
   - ensure profile names are consistent across machines
   - ensure each snapshot belongs to the intended reviewer
2. `Selected user profile is inactive`:
   - reactivate the profile from `Profile` -> `Manage`
3. No commit after export:
   - expected when snapshot content has not changed
