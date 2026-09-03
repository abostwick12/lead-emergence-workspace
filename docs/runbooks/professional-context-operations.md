# Professional Context Graph operations

This runbook covers the P2/S2a Pilot graph only. It does not authorize a hosted
migration, deployment, connector release, plugin package, or later SOTF goal.

## Lifecycle

1. Lewis calls `propose_context_candidate` with one bounded observation,
   provenance, confidence, intended tier, privacy classification, and a UUID
   reused on retry.
2. Workspace creates only a candidate and bounded evidence. It does not create
   confirmed professional context.
3. Lewis presents the candidate through `list_context_candidates`.
4. After an authorized assistant records the user's decision, Lewis calls
   `review_context_candidate`. This phase accepts the assistant's attestation;
   the server-verifiable confirmation receipt is not implemented yet.
5. Approved context becomes Working, Chapter, or Core. Working expires after 30
   days. Chapter requires a chapter key. Core promotion is explicit.
6. Later `manage_professional_context` actions can promote, archive, or delete a
   retained item. Deletion redacts retained content while preserving a minimal
   audit tombstone.

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
Private and sensitive context are excluded unless both protected inclusion and
explicit protected-context access are true. The rule applies independently to
entities, candidates, evidence, source references, review notes, conflicts,
links, ID-targeted operations, and mutation responses. Protected conflicts are
omitted completely when access is absent, without counts or existence markers.
Existing `memory_entries` are returned separately as `legacy_memory` and are not
copied or changed.

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
migration or release action. P2 remains release-blocked until server-verifiable
confirmation receipts are implemented and reviewed.

## Local verification

Start the repository-local Supabase stack and run:

```text
supabase db reset --local
supabase test db --local supabase/tests/database/professional_context_graph.sql
npm run test:rls
supabase db advisors --local
```

Never link this repository to or run this acceptance against hosted production.
