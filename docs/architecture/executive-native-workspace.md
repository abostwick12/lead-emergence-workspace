# Executive native coordination foundation

Updated 2026-09-09. P9a is a backend/contract checkpoint, not the finished
Executive experience. **All six bundles remain NOT READY TO SHIP.**

## Ownership and records

Reusable Executive 0.2.0 contracts, analysis and explicit-availability scheduling
remain in lead-emergence-bundles. Bundle Contract 1.0 and UI Manifest Contract 1.0
are unchanged. Workspace owns this migration and native persistence. The host's
active twenty-one-file export is still pinned to the P8 source revision
606c9ebcb22704306b77d9afdc76c9f50c2783d3; Executive is not yet registered in its UI
composer or MCP tool registry. Declared source routes are not live pages.

Five kinds are independent: commitment, decision, meeting, daily_brief and
weekly_review. They have per-kind capability checks, strict generated base
schemas and independent database cross-field validation. Commitments preserve
outcome, owner, dates, next move and completion/blocker evidence. Decisions keep
alternatives, tradeoffs, a chosen option, rationale and decision date. Meetings
preserve explicit instants, a named display zone, agreement state and outcomes;
a saved plan is never a calendar booking. Briefs keep bounded observations,
actions, reflection and an explicit inclusive period.

Private documents, immutable versions and proposals are separate from every
other bundle. Current server-derived Workspace identity is the only tenant
authority. Direct anonymous/authenticated table operations are denied. Native
saves and decisions require a direct session and exact-record confirmation.
Assistant-oriented proposals cannot approve themselves. Real MCP invocation
of Executive remains untested and is not yet wired into the host.

Concurrent writes serialize per Workspace; expected revisions prevent silent
overwrites. Request IDs support identical retries and reject changed/superseded
requests. History retains all revisions and returns the original plus nine
latest revisions. There is no permanent-delete route in this slice.

Assistant normalization marks changed records inferred, demotes changed
observations/actions and those affected by changed references, returns edited
reviewed briefs to draft, and removes claimed agreement when meeting timing or
participants change. Native approval preserves inference labels.

## Explicit source permissions

Two more private tables store source-permission selections and their revision
audit. Selection starts empty. Only native users with Executive coordination
may change it, with exact current revision and explicit task-metadata consent.
Each selected source capability must currently be entitled.

The allowlist covers Writing resource status, Ministry research/archive status,
Nonprofit roadmap/partner/meeting/research metadata and Investor research-review
metadata. It excludes the theological profile, clinical content, personal
accounts and all full-content domain operations. Titles can themselves be
sensitive: the future native consent UI must say exactly what metadata is shared.

Each reference contains capability, kind, document ID and recorded revision.
The reader checks both current source sharing and current source entitlement,
then selects only title, state, review state where applicable, current revision,
due/review date and updated timestamp. It does not call full-content domain RPCs
or return bodies, research findings, financial theses, clinical notes or source
excerpts. Real four-domain canary tests exercise this projection.

Resolution returns current, changed or unavailable. Removed sharing, revoked
source access, a wrong Workspace, an unknown ID or an impossible future revision
cannot return source metadata. Previously saved Executive briefs remain readable
as the user's own work; source labels are resolved live, not copied into a
durable cross-domain snapshot. Saving a record with unavailable references is
rejected until the user removes them or restores authorized access.

## Implemented native database operations

- Get/search/save an Executive record; search is bounded to fifty results.
- Propose new records or revisions; list twenty-five native-review proposals.
- Approve/reject an exact proposal and retrieve bounded private history.
- Get/set source-permission selections.
- Resolve up to twenty explicitly supplied source references.

These ten authenticated database operations are not ten installed MCP tools.
No Executive app HTTP routes, native pages, attention aggregation, notification
worker or scheduler are implemented in P9a.

## Local proof and limitations

All 27 migrations replayed from a fresh isolated database. The actual migration
count was rechecked. Seven real native authenticated RPC groups pass, including
five record kinds, exact retries, concurrency, original preservation, proposal
decisions, source permissions, metadata-only projection across four domains,
cross-client/kind denial and live source revocation. Source records in the final
run are created through their real native guarded operations.

All 488 PostgreSQL assertions across fourteen suites pass, including 67 Executive
table/RLS/helper/RPC privilege checks. Source has 64 tests, including seventeen
Executive contract/analysis/scheduling cases. Five generated base schemas and
ten source definitions exactly match the reusable source. Workspace's 217
existing unit tests, 32 schema/policy tests, typecheck, lint, boundary scan and
41-page optimized build pass. Those are regressions, not Executive UI proof.

An ambiguous SQL variable was found by real source resolution and corrected.
The final fresh replay includes that fix. Earlier fixture attempts used a
malformed revocation update and an incorrect Nonprofit RPC parameter; the final
test uses the actual guarded source creation/revocation operations. Fresh replay
removed those earlier disposable fictional fixtures; no client data was present.

Remaining: task-level attention aggregation and coverage; typed HTTP/MCP bridges;
native editors, source controls and source-change presentation; daily/weekly
first-value flow and full review coverage; scheduling UI; approved automation
and meaningful-change notification lifecycle; cross-bundle recovery; installed
host, representative utility, accessibility, deployment and commercial gates.
