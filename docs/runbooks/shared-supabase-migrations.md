# Shared Supabase migrations

Workspace owns source SQL but may not run remote push/link/repair. Run `npm run schema:checksum`, then `npm run build:shared-migration -- <commit>`. Copy the exact generated SQL into a timestamped ministry-repository migration with owner/repository/commit/checksum header. Verify with `npm run verify:shared-migration`, test a recreated shared schema, open a ministry-only PR, then request Gate A. Never edit an applied migration.
