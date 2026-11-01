# Data migration

At Gate B, resolve Andrew's source Auth user ID and create his personal Workspace. Back up source rows/files first. Copy only approved personal tables using a ledger with source ID, target ID, timestamps, and checksums. Preserve UUIDs where practical. Migrate integration metadata only and mark each connection `reconnect_required`. Reconcile counts, relationships, skipped rows, and file byte sizes before cutover.

Historical extraction note: `reconnect_required` records the state of migrated
legacy Workspace integration metadata. It does not describe a service
connection managed by the client's ChatGPT account, establish that account's
health, or authorize a Workspace-side reconnection. Apply the [canonical
connection model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md)
for current ownership and recovery boundaries.
