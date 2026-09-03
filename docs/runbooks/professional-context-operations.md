# Professional Context Graph operations

This runbook covers the P2/S2a Pilot graph only. It does not authorize a hosted
migration, deployment, connector release, plugin package, or later SOTF goal.

## Lifecycle

1. Lewis calls `propose_context_candidate` with one bounded observation,
   provenance, confidence, intended tier, privacy classification, and a UUID
   reused on retry.
2. A normal, retained proposal creates only an unconfirmed candidate and bounded
   evidence. It does not require first-party confirmation and cannot create
   confirmed professional context.
3. A private or sensitive proposal creates a private pending confirmation
   request. It creates no graph candidate or evidence until the owner reviews
   the exact request in a direct Workspace session.
4. Lewis presents candidates through `list_context_candidates`. Approve,
   correct, reject, supersede, link, promote, archive, and delete tools create
   request-only confirmation records and cannot execute their mutations.
5. The owner opens the exact Workspace review URL and confirms or denies the
   operation. The server revalidates the owning session, assistant authorization
   epoch, capability, expiry, payload fingerprint, and target-state fingerprint,
   then executes the mutation atomically. Only correction label/summary fields
   may be edited during review.
6. Approved context becomes Working, Chapter, or Core. Working expires after 30
   days. Chapter requires a chapter key. Core promotion is explicit. Deletion
   redacts retained content while preserving a minimal audit tombstone.

Rejected candidates remain dedupe history. The same observation and evidence do
not silently reappear; materially new evidence can create a new candidate.
Conflicting evidence must identify the active context it challenges and can only
replace it through the explicit `supersede` decision.

Review decisions are not interchangeable:

- `approve` accepts the candidate exactly and rejects label, summary, tier, or
  chapter mutations;
- `correct` requires an actual normalized label or summary change and preserves
  the proposed and accepted values in the audit trail;
- `reject` accepts no candidate mutation fields and creates no confirmed entity;
- `supersede` accepts the conflicting candidate exactly and accepts no edits.

## Retrieval and links

`list_professional_context` retrieves confirmed context by purpose and tier.
Private and sensitive context are excluded unless the MCP connection requests
that exact privacy scope and has an active server-side read grant. Private and
sensitive are separate controls: a private grant lasts 10 minutes, a sensitive
grant lasts 5 minutes, and neither implies the other. The owner may revoke a
grant immediately. Expiry, disconnect, authorization-epoch change, ownership
loss, or entitlement/capability loss makes it unusable. Grants authorize reads
only. The rule applies independently to
entities, candidates, evidence, source references, review notes, conflicts,
links, ID-targeted operations, and mutation responses. Protected conflicts are
omitted completely when access is absent, without counts or existence markers.
Existing `memory_entries` are returned separately as `legacy_memory` and are not
copied or changed.

The owner manages these grants at
`/workspace/professional-context/access`. The page identifies each connection
from its canonical Workspace MCP authorization, obtains current grant state
through `list_professional_context_read_grants()`, and uses separate Private and
Sensitive controls. Mutations require the cookie-backed first-party session,
exact trusted Origin, same-origin fetch metadata, JSON content, and the scoped
HttpOnly-cookie CSRF token. Bearer requests cannot load, create, renew, or
revoke grants. After every mutation and when the displayed expiration is
reached, the page reloads authoritative server/database state rather than
promoting a client timer to authority.

`link_professional_context` relates confirmed context to another context item or
an existing Workspace task, commitment, meeting, decision, capture, job
application, or legacy memory record. Both ends must belong to the caller's
Workspace. Reusing a request UUID with different link data fails closed.

`get_context_provenance` returns bounded evidence, review history, and conflict
records for one context item. Nested records are filtered by their own privacy
classification; access to a parent does not grant access to protected related
records. It never returns raw source bodies or another Workspace's data.

## Privacy refusal

Set retention to `do_not_retain` for material usable only in the immediate
request. Set the military-sensitivity classification when content may be
classified, CUI, or operationally sensitive. Classified, CUI, and operationally
sensitive material must not be submitted. Both refusal paths return
`retained:false` and create no Professional Context Graph candidate, evidence,
confirmed-context, or other graph content row. The connected assistant,
application runtime, and request infrastructure still process the request, and
content-free authentication, connection, authorization, or observability
metadata may still be written.

## Activation and release status

P1 bundle entitlements do not activate Professional Context. Phase A leaves the
SOTF Bundle capability mapping disabled; activation requires a later explicit
migration or release action. Phase B2 implements direct-session
confirm-and-execute authority, and B2.2 adds first-party protected-read grant
controls without enabling the capability. P2 remains release-blocked pending a
reviewed fresh migration replay, production cleanup scheduling, hosted release
approval, deployment, and acceptance evidence.

## Confirmation retention

Pending requests expire logically after 30 minutes. Preview, status, denial, and
execution paths materialize detected expiry, stale target state, authorization
change, capability loss, or ownership loss as a terminal row and synchronously
clear the normalized payload and protected target snapshot. Once `expires_at`
is reached, content is inaccessible and cannot be executed even if physical
cleanup has not run yet. Retained target snapshots are limited to 64 KiB and 128
decision-relevant related rows; delete/redaction stores counts plus a
deterministic aggregate fingerprint and refuses larger fanout before creating a
request. Completed results retain only an action-level allowlist and never
retain candidate, context, supersession, conflict, or link identifiers.

The cleanup function is safe to invoke directly and expires pending rows,
removes content-free terminal metadata after the server-configurable 30-day
default, and removes stale grants. When `pg_cron` is installed, the migration
reconciles one active `workspace-professional-context-confirmation-cleanup` job
at `*/15 * * * *`. A missing scheduler does not break ordinary local
development, but it is not proof of the physical-cleanup SLA and makes a target
environment release-NOT-READY. Before release, execute the read-only
`supabase/preflight/professional_context_cleanup_scheduler.sql` against the
intended target; it fails closed for a missing, duplicate, inactive,
misconfigured, or slower-than-contracted job. Record actual target execution
separately from implementation and scheduling evidence. A stale request is
terminal: Lewis must submit a new logical request with a new UUID.

## Local verification

Start the repository-local Supabase stack and run:

```text
supabase test db --local supabase/tests/database/professional_context_graph.sql
supabase test db --local supabase/tests/database/professional_context_confirmation.sql
npm run test:rls
supabase db advisors --local
```

The focused confirmation pgTAP installs `pg_cron` only inside its rolled-back
test transaction to verify deterministic, idempotent scheduling and negative
preflight cases. It does not establish target-environment scheduler readiness.

Run a fresh local migration replay only when that destructive local action has
been separately authorized. Never link this repository to or run this
acceptance against hosted production.
