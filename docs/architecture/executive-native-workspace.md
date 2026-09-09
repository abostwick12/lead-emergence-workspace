# Executive native coordination

Updated 2026-09-09. P9c adds individually consented task metadata, paged
attention and complete paged source discovery. **All six bundles remain
NOT READY TO SHIP.**

## Ownership and native work

Workspace imports 27 allowlisted reusable files from source revision
28d6b4cb876a37709e899526f7087a596b3aec67. Executive 0.3.0 retains Bundle
Contract 1.0 and UI Manifest Contract 1.0. The host registers entitlement-based
Executive navigation, widgets and scoped tools; it does not import source-repo
runtime paths.

Five focused record editors cover commitments, decisions, meetings, daily
briefs and weekly reviews. Exact-record confirmation resets after edits.
Failed/stale saves preserve the current editor draft, not crash/autosave recovery.
History retains the original plus nine recent versions for explicit restoration.
Downloads contain saved work, not unsaved edits or live source metadata.

Decisions need a selected alternative, rationale and actual decision date.
Completed commitments need their completion date. Meeting-time entry uses an
explicit instant and named zone, rejects nonexistent local times and requires a
choice during repeated hours. Timing/participant changes clear reported agreement.
A saved meeting does not check availability or book a calendar.

## Authority and persistence

Private records, immutable versions, proposals and source permissions remain
independent of other domains. Identity and live capabilities are derived
server-side, never from a submitted tenant ID. Private-table/helper access is
denied. Serialized expected-revision writes reject silent overwrites; exact
request IDs support identical retries and reject changed/superseded requests.

Native HTTP validates inputs and responses with private no-store caching.
With all three capabilities, 19 Executive MCP tools are registered: five sets
of list/get/propose, legacy record attention, enhanced record/task attention,
paged source discovery and live reference resolution. Only five proposal tools
write. Canonical save, approval, history and permission changes remain native-only.
No tool books, messages, schedules or notifies. Every invocation rechecks access.

Assistant proposals preserve inference labels through native approval. Changed
references demote affected record/action/observation confirmation. Tool annotations
are descriptions, not authorization. The routing guidance follows the official
[OpenAI MCP server guidance](https://developers.openai.com/plugins/build/mcp-server):
focused tools, explicit schemas, stable identifiers and minimized sensitive data.

## Separate record and task consent

All foreign sharing starts empty. A native user with Executive coordination
selects currently entitled record sources and confirms the exact selection.
Existing record permission is unchanged: six allowlisted fields (title, state,
review state where applicable, revision, recorded date and update time).

Migration 29 adds a separate task-capability array, initially empty for every
existing permission, and immutable permission-contract audit data. The v2 native
source API requires task-metadata-v1 and an additional explicit confirmation
for selected tasks. Task scopes must be supported and a subset of selected record
sources. A legacy v1 update can retain existing task grants only for retained
record sources. Removing and re-adding a record never silently restores its tasks.

Task references add an optional item kind/ID to capability, parent kind/ID and
parent revision. Multiple distinct tasks and the parent can be linked together.
A parent edit marks its task link changed; a missing task or unavailable source
returns no metadata. Saves with unavailable links are refused until removed or
current authorized access is restored.

## Fixed task projection

| Scope | Individual task | Additional permitted fields |
| --- | --- | --- |
| Executive coordination/brief/review | Meeting, daily-brief and weekly-review actions | Parent title, owner, next action, priority, date certainty and unfinished-prerequisite count |
| Nonprofit roadmap | Milestones | Same fixed six additions |
| Nonprofit partners | Follow-up, with stable parent-as-task ID | Same fixed six additions |
| Nonprofit meetings | Actions | Same fixed six additions |
| Investor company research | Watchlist entries and market-brief catalysts | Same fixed six additions |
| Investor thesis/filings | Catalysts | Same fixed six additions |

The fixed task envelope has twelve fields in total. Not-applicable fields remain
empty/null/zero, rather than invented. Titles, owners and next actions may be
sensitive; native consent says so. Projection selects named scalar fields from
named arrays, not full-content domain RPCs. Manuscripts, theological profiles,
research findings, sources, excerpts, contact details and task evidence bodies
are excluded. A catalyst's saved date certainty is not independent verification.

Permission withdrawal or source entitlement revocation closes later reads.
Previously read/downloaded text cannot be retroactively withdrawn. Already saved
Executive notes remain the user's work; source labels/details are resolved live.

## Attention and source browsing

The old 13-scope, first-fifty record attention API is preserved. The new v2 API
reports 22 record/task coverage states with exact matching totals and bounded
offset pages. Unshared/unavailable counts are null, never misleading zeroes.
Priority/date/stable ID determine ordering. Every cue explains its saved rule.

Task attention includes unfinished actions in completed/held meetings, but omits
closed/cancelled/paused/archived work and terminal child tasks. It preserves
owners, next steps, stated status and prerequisite counts. Unknown, estimated,
announced and occurred catalyst dates are labeled as saved metadata.

Source discovery is independent of attention: one explicit capability and
record/task level, title-only search, bounded pages and stable identity cursors.
It includes future and completed tasks for linking. A cursor is a traversal
boundary, never permission. Every page rechecks current access; concurrent edits
can change page membership. This is not a frozen complete snapshot.

Native attention has pagination and detailed coverage; the source picker pages
beyond the first fifty cues. Links currently open the parent source workspace,
not an auto-expanded exact child. A parent and its task can both produce a cue;
grouping redundant parent/task cues and exact-child navigation remain pre-shipment
usability refinements.

Brief preparation uses the first current page, marks the draft inferred and
stores up to twenty exact references without copying task labels/owners/next
actions into durable prose. Larger result sets disclose their partial coverage.
Weekly preparation is current attention, not a full-period outcome history.

## Verification and remaining work

See P9c in docs/testing/test-evidence.md and the local proof runbook for final
counts, corrected attempts and execution receipts. Fictional local database,
HTTP/OAuth/MCP and browser acceptance is not installed-host or client-value proof.

Remaining: full-period weekly outcomes; explicit-availability scheduling UI;
approved recurring lifecycle and meaningful-change notifications; exact-child
navigation; crash/autosave recovery; shared search/quick actions/connections/
preferences; representative utility, accessibility and deployed privacy,
retention, commercial and installed-host acceptance.
No hosted migration, deployment, provider/client connection, installed-plugin
change or marketplace submission is included.
