# RLS policy matrix

| Object | Read | Create/update/delete |
| --- | --- | --- |
| `user_profiles` | Self | Self; user ID immutable. Primary `timezone` is independent of the exactly-three `clock_timezones` display preference. |
| `workspaces` | Active member/owner | Owner creates one personal Workspace and edits name only. |
| `workspace_memberships` | Self | Self may create only their owner membership for their new personal Workspace; no direct update/delete grant. |
| `workspace_entitlements` | Active member | No direct user write. |
| `bundle_definitions` | Direct authenticated session | No client write; catalog changes require a migration. |
| `bundle_capabilities` | Direct authenticated session | No client write; mappings are additive catalog data. |
| `bundle_entitlements` | Active beneficiary/Workspace member | No direct client write; bounded operator and invite RPCs only. |
| `workspace_private.bundle_invites` | No browser/Data API access | Hash-only writes through explicitly authorized RPCs; defense-in-depth RLS has no policies. |
| `context_chapters` | Active Personal owner with `professional_context` capability | No direct client writes; bounded context RPCs only. |
| `professional_context_entities` | Active Personal owner with `professional_context` capability | No direct client writes; candidate review/promotion RPCs only. |
| `professional_context_links` | Active Personal owner with `professional_context` capability | No direct client writes; link RPC validates both targets belong to the same Workspace. |
| `context_evidence` | Active Personal owner with `professional_context` capability | No direct client writes; evidence is created only with a validated candidate/source. |
| `context_candidates` | Active Personal owner with `professional_context` capability | No direct client writes; MCP proposal/review RPCs preserve confirmation and conflict state. |
| `context_reviews` | Active Personal owner with `professional_context` capability | No direct client writes; immutable user-decision/audit records except privacy deletion redaction. |
| Domain tables | Active member | Active personal owner with matching `created_by`; tenancy immutable. |
| `audit_events` | Active member | Trigger only. |

All `workspace` tables have RLS enabled and explicit grants. The private schema
has no authenticated usage or table access. Bundle operator RPCs require a
direct session and a current Auth app-metadata authorization; invite claims also
bind the verified Auth email to the claimant's active Personal Workspace owner
context. Context MCP functions additionally require a current MCP authorization
epoch and active bundle capability; an MCP bearer cannot traverse the graph
tables directly. Private context is excluded from default MCP projections, and
do-not-retain or suspected controlled military content is rejected before any
write. Local migration replay, 295 pgTAP assertions, and database advisors
passed on 2026-09-02.
