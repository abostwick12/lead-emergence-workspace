# Ministry native workspace

Implementation checkpoint, 2026-09-08. This is not client-shipment or hosted-release approval.

## Boundaries and ownership

The reusable Ministry contract is exported from lead-emergence-bundles revision
59031bfd4203c4d1367ccd58311b4d60afe4390e through the host's fourteen-file allowlist.
The host owns native pages, authenticated bridges and database persistence.
No legacy Ministry product runtime, business data, first-client profile or
provider token is imported. The four active portable capabilities are
ministry.profile, ministry.research, ministry.teaching and ministry.archive.

workspace_private.ministry_documents stores three independent record kinds:
client-owned theological profile, source-layered research and historical
teaching. Immutable versions and immutable proposal payloads have separate
private tables. Tables have RLS and no direct anonymous/authenticated grants.
Narrow authenticated RPCs derive the workspace from the verified session and
recheck current entitlement. An identifier from another tenant or domain has
the same unavailable response as a missing identifier.

## Workflow and truthfulness

A profile begins unset. Each position separately records inferred, user-stated,
confirmed or rejected status. Confirming the overall configuration does not
promote an inferred position. Native field changes reset confirmation.
Only direct users may save profiles, view private revision history or approve
research proposals. The connected assistant can read current authorized
preferences, research and archive records; it cannot use hidden RPCs to bypass
these restrictions.

The source consent screen explicitly discloses assigned Writing/Ministry
reading and proposal scope, including theological preferences and position
statuses. It does not imply authority to approve, confirm, publish or connect
external providers. Deployed Entry consent and actual installed-host acceptance
are still separate release gates.

Research separates biblical text, textual/language evidence, academic
interpretation, historical theology, Reformed/Presbyterian sources, PC(USA)
sources, prior writing and AI synthesis. These are available categories, not a
requirement to invent evidence in every category or an assumed denomination.
Each source records an actual location, optional URL and optional dates.
Notes cite only sources in their project. New or changed assistant notes are
normalized to inferred. Historical sermons never confirm current belief.

Only explicit native approval applies a proposal. The base revision must
still match. Stale proposals can be rejected, not silently rebased. Idempotent
proposal retries normalize against their original immutable base. Canonical
saves use an expected revision and request UUID; conflicting or superseded
retries cannot overwrite current work. The original and latest nine revisions
are exposed for review. Loading a past version is not immediate restoration.

The archive supports pasted text and bounded plain-text file import.
Filenames, local paths and file modification dates are not inferred as
provenance. Full-text search includes saved text and recorded sources.
Downloads contain a labelled saved revision, bibliography and unresolved
evidence cautions. They are local text handoffs, not publication, source
verification or a licensed-library connection.

## Experience

Native routes are /workspace/ministry, /profile, /research/new,
/research/:documentId, /archive and /archive/:documentId. Contributions compose
with Writing through the shared registry. The teaching-attention widget uses
saved research dates; overdue work and the next seven days are candidates.
It sends no automatic notification.

Private read state is keyed by subject, workspace, authority revision and
resource path. Capability loss unmounts private content. Requests use bearer
authorization, no-store responses and bounded bodies. Ministry fetches have a
20-second timeout with explicit recovery messages. P15 adds private server draft
recovery, exact retries, explicit restore/discard and atomic official commit.
Ordinary link/unload navigation warns while draft protection is incomplete.

## Remaining acceptance

Actual installed ChatGPT/Codex operation, approved hosted migration, deployed
backup/recovery and retention/export policy, representative-client research quality,
first-use value and responsiveness remain open. Optional Logos access is not
connected or claimed. Rich archive ingestion, large-library ergonomics and a
representative theological/source evaluation set still need shipment proof.
This checkpoint does not complete the other native bundles.

P7 hardening: source URL refinements now fail validation instead of throwing
for a blank, incomplete or malformed URL. The current seventeen-file source
export includes this fix; its exact revision is recorded in source-lock.json.
