# P2 — Workspace Experience and Writer integration

Date: 2026-09-08. Status: implemented and locally integrated; host acceptance remains open.
No production deployment, hosted migration, live client data, or provider mutation is authorized by this checkpoint.

## What the first slice delivers

An assigned Writer user gets a Writing navigation entry and an attention row on Home,
then a searchable resource library and a source-first review. The review keeps the
original text visible beside recorded publication status, provenance, missing
metadata, and one useful next step. Copying review notes changes no resource.
Unassigned users receive neither entry nor widget. Revocation clears access without
an application deployment.

This is a working read-only slice, not the finished Writer product. There is no
import UI, editor, revision comparison, live link verification, Wix connection,
publishing action, or measured claim about time saved. Those require subsequent work.

## Reuse and contracts

- Workspace remains the application; the private bundle repository remains the
  reusable contract, skill, workflow, and manifest source.
- Bundle Contract and UI Manifest remain version `1.0`.
- `scripts/sync-bundle-platform.mjs` exports only eleven allowlisted source files
  into `vendor/lead-emergence-bundles`. It records the source commit and individual
  SHA-256 hashes, and rejects modified export sources. It does not copy client
  settings, credentials, the entire plugin catalog, or a second web application.
- The native host registers implemented workspaces and their entry capabilities.
  This is product-level configuration, not a client-specific conditional.
- The existing underscore database capability identifiers map to portable dotted
  identifiers through a private binding table.
- Assigning an already-implemented Writer bundle is backend data, requiring no
  deployment. Implementing a genuinely new workspace/tool still requires code.
- Only navigation and the attention-widget registry are rendered in this slice.
  Quick actions, search providers, settings, notifications, and layout preferences
  remain contract contributions, not claims that their full global UX is implemented.

## One authority, two surfaces

`workspace.get_bundle_experience()` derives the personal workspace from the
authenticated identity. Browser sessions and admitted MCP tokens use the same
bundle assignments, active capability bindings, catalog state, and entitlement
time-window checks. The web composer intersects that result with the pinned
registry. It never accepts a browser-provided or model-provided tenant identity.

The browser fetches an uncached composition on route changes, focus, visibility,
and every 30 seconds while visible; scheduled expiry also triggers clearing and
revalidation. Resource state is keyed by workspace and entitlement revision.
A failed authority check hides stale content and offers a retry. Previously seen
or copied information cannot be recalled, but subsequent reads fail closed.

The stateless MCP endpoint recomposes tools for every authenticated request.
Every resource RPC independently checks identity, workspace plan, bundle grant,
and its exact capability. An old tools/list result is never authorization.

### Read interfaces

| Surface | Operation | Permission |
| --- | --- | --- |
| Web | GET /api/bundles/experience | Active personal workspace |
| Web / MCP | Resource library / writer_list_resources | writer.resource.library |
| Web / MCP | Source-first review / writer_review_resource | writer.resource.review |
| MCP | writer_resource_review prompt | Both Writer read capabilities |

The plugin skill locates a record with the list tool and reviews the selected ID.
It explicitly handles missing tools, revoked access, ambiguous matches, and
untrusted source instructions. The plugin remains skills-only: no fabricated app
dependency identifier or undeployed MCP endpoint was added to its manifest.
Installing that skill does not grant backend access.

## Security boundaries

Writing records live in `workspace_private.writing_resources`, with row-level
security enabled and no direct authenticated/anonymous table privileges.
Security-definer functions have an empty search path, revoked public execution,
and narrowly granted public wrappers. Lists are bounded and omit full body text.
A missing record and a different user's record receive the same unavailable result.

The new resolver rejects future-start, expired, revoked, disabled-catalog and
disabled-capability cases. It does not reuse the older bundle resolver's
future-start interpretation. Workspace plan suspension also denies access.
MCP additionally requires the existing resource audience, approved client grant,
active connection, and current owner membership. No service-role credential was
added to application runtime. Local fixture creation uses an admin credential
only inside the isolated test setup script.

Source text is rendered as text, never HTML. The web UI only opens HTTP(S) source
links without embedded credentials. Metadata findings are explicitly not AI
editorial judgment, theology verification, external-link verification, rights
clearance, or publication approval. Cross-domain private tables are not queried.

## Local proof and its limits

The acceptance stack is `bundle-experience-p2`, with Supabase on loopback port
58421 and Next.js on localhost port 3125. All accounts, manuscripts, assignments,
and operator actions are fictional. The full migration chain was replayed into
this separate stack; existing local stacks were not reset.

The HTTP test performs real local OAuth discovery, dynamic client registration,
authorization, user approval, product grant activation, and S256 PKCE exchange.
It then exercises the running MCP endpoint with the SDK HTTP client. It does not
forge a token or replace a connected service with a mock. Browser tests sign in
through the existing legacy form using precreated synthetic Workspace accounts.
They do not certify the production Entry login/handoff or hosted consent screen.

A separate browser recovery check deliberately injects a temporary 503; this is
an error-state test, not evidence of a backend outage. Actual successful resource
reads, entitlement changes, and revocation tests use the running local services.
See [test evidence](../testing/test-evidence.md) for exact results.

## Integration gate before a real pilot

Published Workspace main at inspection was `044382c856ca948c4c032c683446b29989dc30e1`.
The isolated Codex2 branch is `codex2/bundle-experience-integration`.
Other active branches and PRs were inspected but not modified.

The published consent page approves OAuth but does not yet call the newer
Workspace grant-resolution and activation flow. That work exists on another
active branch. The test calls those already-existing product RPCs after real
local approval; it does not change or bypass the production authentication flow.
The approved integration owner must reconcile that consent work before a real
host connection is claimed. Do not merge another owner's branch automatically.

Next acceptance requires an authorized non-production preview, appropriate OAuth
redirects/resource metadata, deployment of the reviewed migration by the proper
migration owner, and an actual ChatGPT/Codex connection. Repeat A/B visibility,
read parity, revocation, and cross-tenant checks in that host. Reinstall/update the
private plugin through the approved marketplace flow only when that connection
is available. No hosted migration or public plugin submission is part of P2 local validation.

The user explicitly authorized publishing this platform export in the existing
public Workspace repository on 2026-09-08, after the local proof checkpoint.
Only the Codex2 integration branch is in scope; main, production, and hosted
migrations remain unchanged. The reusable bundle repository retains its private
visibility. Making a repository private later cannot retract copies of already
published code. Future paid access must be enforced by backend authentication,
entitlements, and authorization; a paywall is not source-code protection.

## Quality gate for the next slice

Before broadening the bundle catalog, test Writer with a small, authorized,
representative library. Measure time to find a resource, prepare a usable review,
and produce accepted metadata against the user's current process. Record source
coverage, corrections, abandonment, and what users reuse. Proposed pilot target:
one useful, source-backed editorial decision in the first session, with no
unexplained setup, invented verification, or hidden mutation. This target is not
yet a measured outcome.

## Current official sources

Retrieved 2026-09-08:

- [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth):
  preserve OAuth discovery and authorization-code/PKCE authentication.
- [OpenAI MCP server guidance](https://developers.openai.com/plugins/build/mcp-server):
  expose explicit tool schemas and truthful read-only annotations.
- [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication):
  reuse the user's identity and explicit consent; do not rebuild provider auth.
- [Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows):
  discover endpoints and perform a real authorization-code exchange.
