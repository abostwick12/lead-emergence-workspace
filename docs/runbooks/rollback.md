# Rollback

Rollback when reconciliation fails, access is unauthorized, login/storage
fails materially, ministry access breaks, secrets are exposed, or error rates
exceed the approved threshold. Promote the recorded last-known-good Workspace
deployment and restore Ministry merge
`ba61a28f297d72ee359d097fda805032d155f801` to recover the legacy UI/API while
the data freeze stays in place. Then apply a reviewed rollback migration that
drops `gate_d_legacy_write_freeze` from exactly the seven recorded tables and
drops `lead_emergence_private.reject_legacy_command_center_write()`. No table
grants or RLS policies need restoration because Gate D changed neither.

After rollback, verify the retained row counts and authenticated write behavior.
Preserve all Workspace and legacy evidence, revoke compromised credentials when
applicable, and document corrective work.

The additive `workspace.user_profiles.clock_timezones` column is safe to retain
during an application rollback; the prior release ignores it. Do not drop the
column or preference values as part of an emergency rollback. Do not delete
failed migration evidence or any legacy source record.
