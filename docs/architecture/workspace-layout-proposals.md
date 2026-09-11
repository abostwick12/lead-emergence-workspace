# P22 Workspace layout proposals

Status: implemented and locally verified on `codex2/bundle-experience-integration`.
Portable source export: `8678d1e552bfcde404229f17c69fd78d3ed7e878`.
Overall client shipment remains **NOT READY TO SHIP**.

## User outcome

Workspace Experience can turn a user's stated priority into a concrete layout
recommendation without giving the assistant control of the layout. The native
`/workspace/layout` page shows the goal, summary, each exact change, its reason
and its grounding. The user can preview the complete resulting navigation,
attention-card order and starting workspace before accepting, or reject without
changing anything.

Pending and stale recommendations stay prominent. Accepted and rejected history
is retained in a collapsed section so accountability does not crowd today's
decision. Manual edits clear the selected recommendation and return to the
ordinary user-owned preview/save path.

## Deliberately asymmetric authority

The MCP server registers exactly two layout-proposal tools when the current
connection has `workspace.personalize`:

- `workspace_layout_proposal_context` reads capability-filtered active layout
  metadata and exact layout/access revisions; and
- `workspace_propose_layout` creates an immutable recommendation against those
  exact revisions.

There is no assistant tool for listing private proposal history, approving,
rejecting or saving a layout. OAuth-shaped clients are independently denied by
the native layout and decision functions and APIs. Closing this asymmetry in the
other direction would be a security regression, not a convenience feature.

## Privacy and grounding

The assistant context contains only admitted item IDs, labels, kinds, routes and
their current visible/pinned/order states; admitted starting routes; exact
revision tokens; and a count of dormant saved choices. It contains no private
domain body and no unavailable item identity.

Every operation has one exact target, one bounded reason and one or more declared
bases. Assistant inference may supplement but cannot replace a user-stated
priority, the current layout or an enabled capability. SQL independently checks
strict keys, bounds, grounding, duplicate operations, active targets and a real
resulting change. Dormant choices survive application without being disclosed.

## Storage and concurrency

Migration `20260915170000_workspace_layout_proposals.sql` creates private
proposal and decision receipts with RLS and no direct anonymous/authenticated
table grants. Proposal order uses a monotonic identity rather than transaction
timestamps. Request UUIDs bind exact proposal or decision meaning; same-input
retries recover one result and changed-input reuse fails.

A proposal is stale whenever its base layout revision or authority revision no
longer matches. Acceptance requires the direct native user, the current proposal
version, the exact current layout/access revisions and explicit confirmation.
The accepted proposal is persisted through the existing confirmed layout-save
function in the same transaction. Rejection permits a stale proposal to be
cleared while leaving the layout revision unchanged.

## Host surfaces

- `GET /api/bundles/layout` returns the native layout catalog, saved record and
  strict proposal list under `no-store` bearer authentication.
- `POST /api/bundles/layout/proposals/decision` accepts one bounded, confirmed
  native decision and returns a strict exact-retry receipt.
- `/api/mcp` composes the two proposal-only tools only from current capability
  authority and the resolved bundle experience.

## Release boundary

This is a provider-free implementation proven with fictional loopback accounts.
It does not prove recommendation quality for representative clients, installed
ChatGPT/Codex discovery, a hosted migration, backup/privacy/retention/support,
provider behavior or payment enforcement. Those remain release gates.
