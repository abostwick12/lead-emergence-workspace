# ADR-0008: Data migration and cutover

Use backup, initial copy, validation, short source write freeze, delta copy,
reconciliation, and one cutover. Do not dual-write indefinitely. Preserve old
data for rollback until explicit stabilization approval.
