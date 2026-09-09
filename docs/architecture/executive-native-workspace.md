# Executive native coordination

Updated 2026-09-09. P9b implements native pages, HTTP/MCP bridges and record-level
attention. **All six bundles remain NOT READY TO SHIP.**

## Ownership and native work

Workspace imports 26 allowlisted reusable files from source revision
ff7d7c29a1e856818d828f6fa821718642463c20. Executive 0.2.0 uses Bundle Contract 1.0
and UI Manifest Contract 1.0. The host now registers Executive navigation, its
attention widget and scoped tools. No runtime import reaches the source repo.

Five independent kinds have focused editors: commitments, decisions, meetings,
daily briefs and weekly reviews. Libraries expose search, paging and proposals.
Editors preserve owners, next moves, evidence, dates and explicit review states.
Native exact-record confirmation resets after edits. Failed or stale saves keep
the draft in the current editor; this is not crash/autosave recovery. History
retains the original plus nine recent versions; restoring one prepares a copy
for explicit confirmation. Downloads contain the saved revision, not unsaved
edits or live source metadata.

Decisions require a chosen alternative, rationale and decision date when decided.
Completed commitments require the actual completion date. Meeting entry uses a
local date/time and named zone, rejects nonexistent daylight-saving times and
requires the intended instant during a repeated hour. Changes to timing,
duration or participants clear reported agreement. A saved meeting neither
checks availability nor books a calendar event.

Brief preparation makes an unsaved, inferred draft from current attention, with
bounded references and source coverage. Observations distinguish evidence from
interpretation and suggestion. Weekly preparation explicitly does not claim a
complete historical account of the chosen period. The user supplies outcomes
and reflection; no activity history is fabricated.

## Authority, persistence and connected assistant

Private documents, immutable versions, proposals and source permissions remain
independent of other bundles. Identity and entitlements are derived server-side,
never from a submitted Workspace ID. Direct private-table operations are denied.
Expected revisions and serialized writes reject silent overwrites; request IDs
allow identical retries and reject changed or superseded requests.

Native HTTP has strict inputs, bounded bodies and private no-store responses.
There are 17 Executive MCP tools with all three capabilities: list/get/propose
for each of five kinds, attention and explicit reference resolution. Five are
proposal-only writes. No tool grants canonical save, approval, history access,
source-sharing changes, booking, messaging or recurring execution. Every handler
rechecks live authorization; annotations are descriptive, not authority.

Assistant proposals preserve inference labels through native approval. Changed
reference evidence demotes affected record/action/observation confirmation.
Native source edits and approval are separate explicit decisions.

## Explicit source sharing

Sharing starts empty. A direct user with Executive coordination chooses each
currently entitled source capability and confirms the exact current selection.
The native page discloses that titles themselves may be sensitive and that
authorized Executive assistants may read the selected metadata.

The ten-source allowlist covers Writing resource status, Ministry research and
archive status, Nonprofit roadmap/partner/meeting/research status, and Investor
research-review status. It excludes theological profiles, clinical records,
personal accounts and full-content domain operations.

Each reference stores capability, kind, ID and recorded revision only. A guarded
reader selects six fields: title, state, review state where applicable, revision,
due/review date and update time. It does not call full-content RPCs or return
manuscripts, research findings, investment theses or source excerpts. Resolution
returns current, changed or unavailable and is refreshed on focus or request.
Changed references can be updated explicitly; unavailable ones can be removed.

Withdrawn sharing and revoked source entitlement close subsequent reads. Already
saved Executive work remains readable as the user's own record. Saving with
unavailable links is refused until those links are removed or access restored.
Previously read or downloaded information cannot be retroactively withdrawn.

## Attention scope and limits

Migration 28 adds a read-only aggregate over guarded scalar record metadata,
never underlying bodies. It reports all 13 capability coverage states with exact
matching totals; unshared/unavailable counts are null. At most 50 cues are ordered
by priority, due date and stable ID. Each explains its saved-state rule, source
revision and next action. Terminal records, including held meetings, are omitted.
The native view offers a date comparison, not a historical snapshot.

This is **parent-record attention**, not nested task/catalyst extraction. Nested
roadmap milestones, meeting actions and investment catalysts still need a
purpose-built consent/projection contract. The reference picker currently draws
from the first attention page, not a complete cross-bundle source search.

## Verification and remaining work

See the P9b section in docs/testing/test-evidence.md and the local proof runbook
for exact final counts, corrected attempts and execution receipts. Local tests
use only fictional accounts and real guarded database/HTTP/OAuth/MCP operations.
They do not constitute installed ChatGPT/Codex or client acceptance.

Remaining: nested task attention; useful full-period weekly outcomes; explicit-
availability scheduling UI; approved recurring lifecycle and meaningful-change
notification delivery; complete source discovery; crash/autosave recovery;
shared search/quick-action/connection/preferences experiences; representative
utility, accessibility and deployed privacy/retention/commercial acceptance.
No hosted migration, deployment, provider/client connection, installed-plugin
change or marketplace submission is included.
