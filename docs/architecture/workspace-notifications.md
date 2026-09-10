# P14 — native current-condition notifications

Milestone: P14. Host: abostwick12/lead-emergence-workspace, branch
codex2/bundle-experience-integration. Parent: e25fd73733fc384e01fb1107323a823cebc540f8.
Portable source: abostwick12/lead-emergence-bundles, codex2/bundle-platform-v1,
e9f666768c9794ea7b9a55f975ae907c6e77353c. Export: 35 allowlisted files.
Overall client shipment remains NOT READY.

## Product contract

This is a current-condition inbox, not a historical event log, delivery queue,
or scheduled monitoring service. Opening or refreshing checks saved data.
No email, push, provider refresh, market verification, publication, outreach,
task completion or background reminder is performed. The shell button opens
the inbox; it deliberately has no unverified global unread badge.

Eight types are currently implemented:

| Source capability | Current condition |
| --- | --- |
| writer.resource.library | Resource marked ready |
| ministry.research | Non-archived research date within seven days or overdue |
| nonprofit.partners | Non-closed partner follow-up today or overdue |
| investor.thesis | Saved challenged/invalidated assessment or triggered invalidation |
| executive.coordination | Open commitment/decision due, blocked commitment, or due/blocked meeting action |
| executive.brief | Due or blocked action in a non-archived daily brief |
| executive.review | Due or blocked action in a non-archived weekly review |
| workspace.notifications | Active assistant grant unfinished/blocked, or expired stored external credential |

The server uses the owner's saved supported time zone, falling back to UTC.
Only selected metadata is returned, never document bodies, source credentials,
raw OAuth client IDs or Executive cross-domain sharing content.

## Authority and persistence

A direct native owner session, active core Workspace and current
workspace.notifications capability are required. Each source is separately
checked against actual server-resolved bundle capabilities. Shared Auth identity
is the only cross-product dependency. No model-supplied owner/workspace ID is
accepted. OAuth clients cannot use the public RPCs or native HTTP routes.
All four storage tables are private, RLS-enabled and have no direct
anon/authenticated privileges.

Current conditions are derived on read. Personal acknowledgement/preferences
are stored only on explicit user action. Per-type mute is independent of
per-item read/dismiss/snooze; muted items have their own view. Restoring an item
makes it unread. Snooze is exactly 24 hours from the server's transaction time
and returns on a later check, not through background delivery.

IDs are owner-bound hashes. Condition revisions track dates, date categories,
recorded concerns and connection authority, not title spelling or ordinary
request timestamps. Changed conditions can reopen unread. A condition that
disappears and returns with the same fingerprint retains its old choice.
This deliberate current-inbox behavior must not be described as full event history.

Mutations review 1–25 distinct exact IDs/revisions or one explicit boolean type
preference. A per-workspace advisory lock and expected global choices version
reject stale tabs. Bulk validation uses one source snapshot. No partial bulk
mutation succeeds. Exact request receipts prevent duplicate effects and snooze
extension; conflicting reuse fails. Authority and current source condition are
rechecked even before replaying a saved receipt.

Source removal, resolution, revocation and entitlement expiry remove inaccessible
items from every current view/count without deleting prior personal choices.
Enabling a muted type does not grant source access.

## Interface and failure behavior

Inbox, unread, later, dismissed and muted views have complete current counts,
separate type filtering and deterministic pages of 25. The page-read action
acknowledges only unread items actually shown, never unseen or newly arriving
records. Opening a page/source does not mark read.

There is no optimistic success. An uncertain write retains its exact request
for retry. Refresh clears old data first; failed or late responses cannot
repopulate cleared state. Leaving the tab clears data and requires refresh.
Account, workspace and entitlement revision key the component. Source records
link to exact native records/tasks. Connection cues open the owner connection
center and supply a short connection reference; they are not a live health check.

Desktop/mobile controls use text labels, accessible statuses, explicit
preferences and reversible actions. Dismissal never completes underlying work.

## Integration and remaining boundaries

The portable manifest contributes types/navigation; the host owns storage,
authorization, source evaluation and UI. No MCP notification tool, plugin
scope expansion, provider adapter, paid service or hosted deployment was added.
Existing optional Wix/Logos/Finances functionality remains unavailable.

Native notifications do not close recurring delivery, installed-host,
representative-value, shared crash-recovery, privacy/retention or deployed
release gates. See the acceptance ledger for actual checks rather than treating
this architecture description as evidence.
