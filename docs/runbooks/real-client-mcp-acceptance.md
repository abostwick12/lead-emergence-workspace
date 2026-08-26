# Real ChatGPT and Claude MCP acceptance

This is the operator-assisted Preview acceptance procedure for the Workspace
MCP. It does not authorize Production configuration, a real-user grant, a paid
plan change, or retention of a synthetic identity. Use `PASS` only for a client
whose complete lifecycle was actually executed.

## Fixed Preview authorities

- Workspace application and MCP resource:
  `https://lead-emergence-workspace-git-product-498b3c-emergence-projects.vercel.app/api/mcp`
- Personal Supabase Auth/OAuth server: `nhkugzifuapplwpnfpbt`
- Entry development identity authority: `vnjdubrnmxvmsccxmhst`

Never substitute `workspace.leademergence.com`, the shared Ministry project, a
real user, or a retained acceptance fixture. The operator must already be
signed in to the exact ChatGPT or Claude test account before starting that
client's section.

## Protocol preflight

Record the UTC timestamp and require all of the following before creating a
fixture:

1. Protected-resource metadata returns the exact Preview resource and Personal
   authorization server.
2. An unauthenticated MCP `POST` returns `401`, `Cache-Control: no-store`, and a
   `WWW-Authenticate` challenge whose `resource_metadata` is the matching
   Preview well-known URL.
3. `OPTIONS` from both `https://chatgpt.com` and `https://claude.ai` returns
   `204` and only the exact requesting origin.
4. OAuth authorization-server metadata advertises authorization, token,
   dynamic-registration, user-info, and JWKS endpoints; authorization-code and
   refresh-token grants; PKCE; and the expected scopes.

Do not dynamically register a probe client merely to prove metadata. A real
assistant client must perform registration as part of its controlled flow.

## Disposable identity

1. Create one auto-confirmed Entry Auth user with a reserved `.test` email and
   a generated password that is kept only in the active browser session.
2. Call `public.set_entry_product_entitlement` through the audited service/admin
   channel with product `PERSONAL`, status `ACTIVE`, and a concise acceptance
   source. Verify the Auth user, profile, entitlement, and one audit event by
   read-only SQL.
3. Verify the Personal project has no user or Workspace graph for that Entry
   subject before first authorization. The Entry provider, plan definition, and
   private environment settings are configuration and must remain in place.

## Execute separately for ChatGPT and Claude

For ChatGPT, use Apps & Connectors in developer mode. For Claude, use Connectors
and Add custom connector. In each client:

1. Paste the exact Preview MCP resource. Record the assistant account class,
   client name/version when visible, browser, start time, and generated OAuth
   client ID. Never record a client secret, authorization code, access token, or
   refresh token.
2. Confirm the client discovers the exact metadata above and redirects to the
   isolated Entry login. Sign in as the disposable Entry identity, confirm
   there is no second Workspace password, and explicitly approve the Lead
   Emergence Workspace consent screen.
3. Invoke `get_onboarding_state`; require a successful structured response and
   one `connected` `workspace.mcp_authorizations` row for the exact client.
4. Invoke `save_user_reported_setup` with concise synthetic text, then
   `get_workspace_setup`; require the text to remain `reported`, not
   AI-confirmed. Do not use real personal content.
5. Prove refresh without exposing tokens: record only the matching
   `auth.sessions.oauth_client_id`, `refreshed_at`, and scopes; after the access
   token naturally expires, invoke `get_onboarding_state` again. Require a
   successful call plus an advanced `refreshed_at` value or privacy-safe Auth
   log evidence of the refresh grant. Do not shorten the project JWT lifetime
   without separate approval. If this wait is deferred, mark refresh `NOT RUN`.
6. In Workspace Settings, disconnect the exact client. This must set the local
   row to `disconnected`, advance `authorization_valid_after`, and revoke the
   Supabase OAuth grant. A subsequent call with the old client authorization
   must be denied without returning Workspace data.
7. Reconnect the same assistant through a fresh authorization and consent. The
   newly issued token must be later than the disconnect boundary, the row must
   return to `connected`, and `get_onboarding_state` must work again.
8. Remove/revoke the connector from the assistant client, then disconnect it in
   Workspace if still present. Verify the consent is revoked, no usable client
   session remains, the local row is not connected, and a further tool call
   requires authorization.

Client UI refresh, metadata reload, or the Workspace `Refresh status` button is
not evidence of an OAuth refresh-token exchange.

## Evidence and cleanup

Record content-free counts and timestamps only:

- Entry Auth user/profile/entitlement/audit presence before the flow;
- Personal Auth user, Workspace, membership, MCP authorization, OAuth client,
  consent, session, and refresh-token counts for the exact fixture/client;
- the read/write/read tool results with synthetic content redacted from logs;
- disconnect boundary, old-bearer denial, reconnect issuance time, and final
  client-side revocation result;
- console errors, failed network requests, Preview 5xx/runtime events, and the
  exact deployment and commit.

After both clients pass—or immediately after any aborted run—remove the
assistant connectors, revoke grants, disconnect MCP rows, delete the synthetic
Personal Workspace graph and Personal Auth user, then delete the Entry user.
Verify zero remaining sessions, refresh tokens, profiles, entitlements, links,
nonces, fixture audit subjects, Workspace tenant rows, OAuth clients, and OAuth
consents. Preserve provider configuration, migrations, earlier Goal A fixtures,
Ministry, Production deployments, and rollback routes.
