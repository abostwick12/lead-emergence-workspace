# Workspace production-project separation

This runbook prepares the move from the shared Ministry Supabase project to the
dedicated Personal project. It is a readiness artifact only. It does not
authorize a database copy, identity change, Production environment update, PR
merge, or traffic cutover.

## Fixed project roles

| Role | Project | Current posture |
| --- | --- | --- |
| Source/rollback | `emergence-ministry-platform` (`cirqqhuvzekbvysiyedg`) | Active production; preserve unchanged until explicit cutover approval. |
| Workspace candidate | `lead-emergence-personal-sandbox` (`nhkugzifuapplwpnfpbt`) | Accepted migration chain; zero Auth users and zero Workspace tenant rows after cleanup. |
| Entry candidate | New partner-backed project preferred; Meridian fallback | Must be a separate project. Meridian remains paused/preserved until separately approved. |

## Current source ledger

Read-only inventory on 2026-08-22 found:

| Table | Rows |
| --- | ---: |
| `workspace.workspaces` | 1 |
| `workspace.workspace_memberships` | 1 |
| `workspace.integration_connections` | 7 |
| `workspace.ai_conversations` | 18 |
| `workspace.daily_briefings` | 1 |
| `workspace.audit_events` | 52 |

Every other `workspace` and `workspace_private` user-data table is empty. All
seven connection rows are `reconnect_required`; none has a secret reference or
connected-account label. Never copy a provider token or legacy secret.

## Preconditions

1. Record explicit approval for the exact source, destination, migration bytes,
   maintenance window, release owner, rollback owner, and recovery point.
2. Complete or explicitly defer real ChatGPT and Claude client acceptance.
3. Provision/configure a distinct Entry production project and prove one-login
   against isolated synthetic identities.
4. Back up the Ministry source and Personal destination; record restore IDs and
   verify both backups are usable.
5. Re-run exact source/destination counts and checksums. Stop if they differ from
   the approved ledger or contain an unclassified table/object.
6. Confirm the existing source owner is the intended real-user migration. Do not
   match identities by email. Map the source Auth UUID to the canonical Entry
   subject through the approved identity-link procedure.

## Rehearsal

1. Create a disposable destination branch/project from the accepted Personal
   migration chain; do not rehearse by editing Ministry production.
2. Copy the one Workspace graph in foreign-key order while preserving Workspace
   and record UUIDs where safe: Workspace, membership, integration metadata, AI
   conversations, Daily Brief, and audit events.
3. Rebind membership/creator references only through the approved canonical
   identity map. Preserve original source identifiers and copy timestamps in a
   migration ledger.
4. Keep every integration `reconnect_required`; copy no secret reference,
   provider token, OAuth grant, or Auth session.
5. Compare row counts, primary/foreign keys, content checksums, event chronology,
   and owner/RLS behavior. Prove a different user receives no row.
6. Run the complete one-login, returning-user, Workspace Home, Memory, Daily
   Brief, no-connector, MCP-denial, mobile, console, network, and 5xx matrix.
7. Destroy only the disposable rehearsal target after evidence is recorded.

## Authorized cutover sequence

1. Announce the maintenance window and temporarily stop source Workspace writes
   without changing Ministry/Consulting access.
2. Capture final source/destination ledgers and backup recovery points.
3. Execute the reviewed copy once. Fail closed on duplicate IDs, identity-map
   mismatch, count drift, or any nonempty credential field.
4. Configure Workspace Production to the dedicated Personal project with fresh
   Production keys, the exact Entry provider, canonical origin, OAuth server,
   MCP resource, consent route, and callback allow-list.
5. Deploy canary, then prove the migrated owner and a fresh synthetic user. Do
   not invite additional real users before both paths pass.
6. Switch Workspace traffic only after the named release owner records approval.
   Merge Entry, then Workspace; the public landing remains the last switch.
7. Preserve Ministry source rows, legacy login, legacy Vercel URL, and the last
   known good deployments through the stabilization window.

## Rollback

Promote the recorded last-known-good Workspace deployment and restore its prior
Production Supabase environment values. Re-enable source writes only through the
reviewed rollback procedure. Do not reverse-copy destination rows, delete source
evidence, rewrite migration history, or remove the dedicated project. Reconcile
any post-cutover writes before a later retry.
