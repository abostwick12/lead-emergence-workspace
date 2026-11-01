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

## Personal productization release

Keep `https://lead-emergence-workspace.vercel.app` available throughout the
custom-domain release. To roll back the application, promote the recorded
last-known-good Workspace deployment without removing the custom domain or its
certificate. Verify both the custom domain and rollback URL after promotion.

If Entry routing or Personal OIDC fails, restore the prior Entry deployment and
its prior environment-specific Personal destination, or disable only the new
Personal OAuth client/provider while preserving the explicit Workspace password
login. Do not alter Consulting routing.

If MCP authorization fails or is compromised, disconnect/revoke the affected
OAuth grant, disable the `workspace_mcp` capability if wider containment is
required, and verify old bearers are denied. For a third-party service connected
in the client's ChatGPT account, direct the client to that account's connection
settings and supported provider recovery flow; Workspace rollback does not
repair or revoke that service connection. Treat any separately approved
Lead-Emergence-owned adapter incident under its own authorized procedure; do not
enable a legacy adapter or use Workspace provider records as ChatGPT health
evidence. See the [canonical connection
model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).

The productization migration is additive. Application rollback may retain its
plan, onboarding, configuration, authorization-metadata, and event tables; the
prior application ignores them. Do not delete configuration or rewrite hosted
migration history. Repair an invalid onboarding state with a reviewed forward
migration or approved admin procedure, preserving confirmed information.
