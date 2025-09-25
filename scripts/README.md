# Scripts

- `import-fixtures.ts`: calls the `sync-matches` edge function for one or more league IDs. Usage: `ts-node scripts/import-fixtures.ts <league-id> [<league-id> ...]` with Supabase URL + service key available in `.env.local`.
- `seed-matches.ts`: legacy helper that inserts demo matches directly via Supabase REST if you need placeholder fixtures while developing offline.
- `compute-leaderboard.ts` / `update-points.ts`: helper utilities to recompute leaderboard data locally.
