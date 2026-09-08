# Writer recovery and discovery — P4 native slice

Date: 2026-09-08. Status: implemented and locally validated, **not client shipment**.

## Client outcome

Resume an unfinished import or revision after a reload; keep a conflicting tab
from silently replacing newer work; find earlier writing by source text; see
why another resource may be related or duplicated; propose that relationship
without merging, deleting or changing canonical content automatically.

## Draft ownership and recovery

Working drafts are a private server-side buffer separate from canonical
resources, immutable proposals and revision history. There is one import slot
per authorized personal workspace and one slot per resource. Native editing
loads existing work before enabling inputs. Incomplete bounded form values
autosave after 1.2 seconds of inactivity. Nothing private is placed in browser
localStorage. This is not offline editing: unsaved changes still require a
working connection, and leaving before a successful save can lose them.

Import drafts require manage access. Revision drafts require metadata + review.
Every read, save and discard also requires a verified direct user session.
OAuth assistant credentials are denied even through direct RPC; no working-draft
tool is advertised. Access changes remove the native editor and its content.

Each draft carries a version, original comparison revision and durable request
UUID. Saves compare versions under the same per-workspace transaction lock as
canonical writes. Identical retries replay; stale tabs cannot overwrite. A
discard creates a content-free incremented tombstone, so an old tab cannot
resurrect the discarded slot. Clearing locks inputs. A fresh edit after discard
gets a fresh request UUID.

The persisted request UUID is also used for final import/proposal submission.
A successful import whose response is lost can therefore be retried after
reload without creating a second resource. The buffer clears only after a
successful canonical import or proposal receipt. If another tab changed the
buffer, version checks keep that newer work intact.

Failed saves retain on-screen text and offer retry, copy and explicit reload.
Navigation warns while dirty. Approving a different proposal waits until the
working draft is saved or explicitly discarded. Saved drafts retain their old
base revision after canonical edits: the user must explicitly compare against
the current revision before submitting, then review the immutable diff before
approval. Re-basing is not approval and does not modify a resource.

## Search and evidence-led connections

A private trigger-maintained index stores separate metadata and source-text
vectors plus normalized labels and text fingerprints. All 22 migrations replay
from a fresh isolated database. Backfill changes no canonical value, revision,
timestamp or source attribution. Approved edits update the index transactionally.

Existing search inputs/outputs remain compatible. Literal metadata matching is
retained; simple-language full-text matching adds quoted phrases, OR and
exclusions. Source-text matches require current review access, including counts;
library-only access cannot probe hidden body text through search results.
The GIN indexes and bounded paging are groundwork, not production-scale proof.

Connections require library + review access. The maximum is 20 candidates.
Each result includes retrieval time, base revision, candidate revision/source,
and exact reasons: same normalized text, normalized title, recorded URL,
shared topic or scripture label. Text equality is checked after fingerprint
matching; a hash alone is not treated as a duplicate. Scripture labels are
case-folded exact labels, not equivalent passages or theological conclusions.
No semantic matching, link fetch, external verification, merging or deletion
is implied. A limited or empty result is not proof that no other relevant work
exists.

Native buttons save an ordinary metadata proposal preserving unchanged values.
Evidence includes both revisions and retrieval time. Users must review the
sources and saved comparison before approval. A candidate can change after
comparison; its historical signals are not a live verification guarantee.

## Implementation boundaries

Migration: 20260909100000_writer_drafts_and_discovery.sql.
Private tables: writing_working_drafts, writing_search_index.
RPCs: writer_get_working_draft, writer_save_working_draft,
writer_clear_working_draft, writer_find_connections; compatible search update.
No direct anonymous/authenticated privileges on the private tables/index.

Native routes: /api/writing/drafts, /api/writing/drafts/clear and
/api/writing/resources/[resourceId]/connections.
MCP adds only writer_find_connections (read-only, bounded, closed-world).
No catalog grants, new bundle capability, provider OAuth, hosted migration,
plugin installation or website mutation is introduced.

Bundle Contract 1.0 and UI Manifest Contract 1.0 are unchanged. The reusable
Writer skill explains optional discovery and private-draft limits. The runtime
export remains pinned because none of its eleven allowlisted files changed.

## Release acceptance

Commands and observed results are in ../testing/test-evidence.md and the
reproduction runbook. All successful operations use fictional accounts and a
real local database. Injected save failures are labeled test conditions.

Still required: confirmed writing profile/taxonomy; source-link evidence;
publication preparation/export; richer source ingestion and revision paging;
representative-library size/performance and usability pilot; deployed recovery,
retention/export/support; installed host and canonical consent proof. Optional
Wix requires explicit authorization before even a read-only client-data proof.
The other five native bundle workflows remain part of the active goal.

References reviewed:
- [OpenAI MCP server guidance](https://developers.openai.com/plugins/build/mcp-server)
- [PostgreSQL text-search controls](https://www.postgresql.org/docs/15/textsearch-controls.html)
- [PostgreSQL text-search indexes](https://www.postgresql.org/docs/15/textsearch-indexes.html)
