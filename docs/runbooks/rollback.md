# Rollback

Rollback when reconciliation fails, access is unauthorized, login/storage
fails materially, ministry access breaks, secrets are exposed, or error rates
exceed the approved threshold. Promote the recorded last-known-good Workspace
deployment, restore the legacy Ministry UI/API release, and restore only the
seven recorded legacy table write grants. Preserve all Workspace and legacy
evidence, revoke compromised credentials, and document corrective work.

The additive `workspace.user_profiles.clock_timezones` column is safe to retain
during an application rollback; the prior release ignores it. Do not drop the
column or preference values as part of an emergency rollback. Do not delete
failed migration evidence.
