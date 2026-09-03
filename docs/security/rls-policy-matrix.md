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
| `context_reviews` | Active Personal owner with `professional_context` capability | No direct client writes; immutable decision/audit records carry their own privacy classification except privacy deletion redaction. |
| `workspace_private.professional_context_confirmation_requests` | No browser/Data API table access | Security-definer request-only MCP RPCs create pending rows; only direct owner-session RPCs may preview, deny, or atomically confirm and execute. RLS has no policies. |
| `workspace_private.professional_context_read_grants` | No browser/Data API table access | Direct owner-session RPCs create/revoke authorization-bound private or sensitive read grants. RLS has no policies. |
| Domain tables | Active member | Active personal owner with matching `created_by`; tenancy immutable. |
| `audit_events` | Active member | Trigger only. |

All `workspace` tables have RLS enabled and explicit grants. The private schema
has no authenticated usage or table access. Bundle operator RPCs require a
direct session and a current Auth app-metadata authorization; invite claims also
bind the verified Auth email to the claimant's active Personal Workspace owner
context. Context MCP functions additionally require a current MCP authorization
epoch and active bundle capability; an MCP bearer cannot traverse the graph
tables directly. Normal retained proposals may autonomously create unconfirmed
candidates. Protected proposals and all governed mutations instead create
private pending requests; only an owning direct Workspace session can execute
them. Private and sensitive reads require separate, short-lived, DB-backed
grants at every top-level, nested, and ID-targeted response path. Grants never
authorize mutations. Protected conflicts are omitted without an existence
indicator. The legacy unguarded mutation, client-attested mutation, and
client-attested protected-read RPC signatures are revoked from API roles.

The P2 capability is defined but its SOTF Bundle mapping remains disabled; P1
entitlement presence alone therefore cannot activate it. Classified, CUI, and operationally
sensitive material must not be submitted. A refused proposal creates no
Professional Context Graph candidate, evidence, confirmed-context, or other
graph content row, although request processing and content-free authentication,
connection, authorization, or observability metadata can still occur.
