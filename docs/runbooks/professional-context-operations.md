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
4. After explicit user confirmation, Lewis calls `review_context_candidate` to
   approve, correct, reject, or supersede a conflict.
5. Approved context becomes Working, Chapter, or Core. Working expires after 30
   days. Chapter requires a chapter key. Core promotion is explicit.
6. Later `manage_professional_context` actions can promote, archive, or delete a
   retained item. Deletion redacts retained content while preserving a minimal
   audit tombstone.

Rejected candidates remain dedupe history. The same observation and evidence do
not silently reappear; materially new evidence can create a new candidate.
Conflicting evidence must identify the active context it challenges and can only
replace it through the explicit `supersede` decision.

## Retrieval and links

`list_professional_context` retrieves confirmed context by purpose and tier.
Private context is excluded unless both private inclusion and explicit private
access are true. Existing `memory_entries` are returned separately as
`legacy_memory` and are not copied or changed.

`link_professional_context` relates confirmed context to another context item or
an existing Workspace task, commitment, meeting, decision, capture, job
application, or legacy memory record. Both ends must belong to the caller's
Workspace. Reusing a request UUID with different link data fails closed.

`get_context_provenance` returns bounded evidence, review history, and conflict
records for one context item. It never returns raw source bodies or another
Workspace's data.

## Privacy refusal

Set retention to `do_not_retain` for material usable only in the immediate
request. Set the military-sensitivity classification when content may be
classified, CUI, or operationally sensitive. Both paths return `retained:false`
before any graph, evidence, cache, or workflow record is created.

## Local verification

Start the repository-local Supabase stack and run:

```text
supabase db reset --local
supabase test db --local supabase/tests/database/professional_context_graph.sql
npm run test:rls
supabase db advisors --local
```

Never link this repository to or run this acceptance against hosted production.
