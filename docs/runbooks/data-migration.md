# Data migration

At Gate B, resolve Andrew's source Auth user ID and create his personal Workspace. Back up source rows/files first. Copy only approved personal tables using a ledger with source ID, target ID, timestamps, and checksums. Preserve UUIDs where practical. Migrate integration metadata only and mark each connection `reconnect_required`. Reconcile counts, relationships, skipped rows, and file byte sizes before cutover.
