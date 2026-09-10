# P15 — private native editor recovery

Milestone: P15. Host: `abostwick12/lead-emergence-workspace`, branch
`codex2/bundle-experience-integration`, starting HEAD
`dd5ed334174b67851eaa9fbb8aca1ad8eef9404b`. Portable recovery contract:
`abostwick12/lead-emergence-bundles`, branch `codex2/bundle-platform-v1`,
pinned source `39f25d39525f5bcecab536df186f791aa64539db`, including its final
evidence-only follow-up. Overall client shipment remains **NOT READY TO SHIP**.

## Product contract

Private working-draft recovery now covers all 16 native record editors in
Ministry, Nonprofit Founder, Investor and Executive. Writer retains its existing
specialized import/editor recovery. A working draft is not a saved revision,
assistant proposal, approval, publication, message, trade, booking or provider
action.

The browser checks the server before opening an editor. If unfinished work
exists, editing stays closed until the user explicitly restores or discards it;
copy remains available as an escape hatch. Recovered work identifies changed
sections and its saved base revision. Stale work must be reviewed and explicitly
rebased before it can become an official revision.

Edits autosave to the private server record after a short idle interval. No
draft data is written to `localStorage`, `sessionStorage`, Git, analytics or an
assistant-visible surface. Failed and timed-out requests keep the work on
screen, explain that no official record changed, and allow the exact request to
be retried. Navigation warns while a draft is dirty or saving.

Final save is distinct from background protection. A user can request an
official save while autosave is in flight; the commit waits for that flight and
then locks only the official-save action. This prevents a short autosave state
change from swallowing the user’s click. Ministry profile-only state is never
sent by research or archive editors.

Executive meeting recovery additionally retains unapplied local-time and
availability-planner input. Neither becomes a recorded instant or saved meeting
snapshot until the user applies it. Pending time or availability blocks the
official commit.

## Authority and persistence

Recovery is a native editor primitive, not an assistant entitlement. Every read
and change requires the signed-in owner’s direct session, active Workspace and
the exact native domain capability. Requests accept no owner, tenant, email,
OAuth client or authorization identity. OAuth/client credentials are denied at
both the HTTP and database boundaries.

Each domain has separate private draft and receipt tables with RLS and no direct
anonymous/authenticated CRUD. Target identity is server-derived and drafts are
separated by owner, workspace, record kind and new/existing document. Receipts
store request hashes and outcomes, not bearer credentials or confirmation
state.

Save, discard and commit use exact request UUIDs, expected draft versions and
per-target advisory locks. Reusing an ID with a different request fails. A
lost response can replay the same effect; competing tabs cannot silently replace
one another. Source revision is checked again during commit.

Commit runs the canonical domain save and draft tombstone in one database
transaction. Canonical domain validation, expected revision, confirmation,
tenant isolation and history remain authoritative. Recovery’s relaxed shape
preserves object/array structure, enums and upper bounds so incomplete entry can
be protected; it is never used to authorize an official save.

## Failure and privacy behavior

- Failed recovery checks keep the editor closed and offer retry or the latest
  saved revision.
- A stale or conflicting save preserves on-screen edits and requires an explicit
  server check, compare/rebase or latest-revision choice.
- Discard affects only the exact private draft; saved records and proposals stay
  unchanged.
- Capability loss and sign-in changes fail closed; private state is not shown
  under the old authority.
- Completed commits report the saved document and revision with accessible live
  status. A persistent Ministry revision status announces proposal approvals.
- Payload, collection and string limits bound recovery storage. Free text still
  requires user review; recovery is not classification, redaction or retention
  policy.

## Integration and remaining boundaries

The portable repository owns the recovery contract and all 16 relaxed editor
shapes. The host owns direct-session authorization, private persistence, atomic
canonical dispatch and responsive UI. This milestone adds no MCP recovery tool,
assistant-readable drafts, provider adapter, scheduled worker, paid service,
hosted migration or production deployment.

Local synthetic acceptance proves reload, cross-tab, conflict, exact retry and
atomic save behavior. It does not prove operating-system crash durability under
all browsers, deployed backup/restore and retention, installed ChatGPT/Codex
behavior, representative client value, external providers, paywall enforcement
or support operations. See the P15 acceptance ledger for the executed evidence.
