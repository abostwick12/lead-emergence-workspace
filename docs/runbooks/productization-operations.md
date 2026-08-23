# Personal production-readiness operations

This runbook prepares a release; it does not grant permission to change Production. The ministry repository remains the sole migration authority for the shared hosted Supabase project.

## Environment separation

Maintain separate Development, Preview, and Production values for the application origin, Auth redirects, Entry OAuth client/provider, and MCP resource. Never use a Preview URL as the Production canonical origin and never remove `https://lead-emergence-workspace.vercel.app` from rollback availability.

Before a hosted change, record written gate approval in `docs/status/extraction-status.md`. From this repository do not run `supabase link`, `supabase db push`, migration repair, or direct live-data migration.

## Release sequence

1. Review both Workspace and Entry PRs, migrations, secrets scan, CI, and Preview evidence.
2. Record approval for the exact Workspace migration bytes and have the ministry migration authority apply them in a reviewed window.
3. Configure hosted Workspace Supabase Auth with the canonical Site URL, exact sign-in/consent redirects, OAuth server, dynamic registration, custom access-token hook, and an asymmetric signing key appropriate for the environment. Confirm exactly the Production trusted Entry provider is enabled and the private MCP resource setting is the canonical custom-domain endpoint. The local seed enables only the Development provider and loopback resource; it must never be applied to the hosted project.
4. Register the environment-specific Entry-to-Workspace OAuth client and Workspace custom OIDC provider. Enter client secrets only in the relevant provider/dashboard secret store.
5. Configure Vercel environment values by scope. Production `NEXT_PUBLIC_APP_URL` and Entry `PERSONAL_PRODUCT_URL` use `https://workspace.leademergence.com`; Preview and Development retain their own origins.
6. Deploy Preview first. Prove Entry entitlement, first/repeat SSO, AI and native onboarding, switching, resume, first value, plan display/enforcement, direct API denial, MCP disconnect/reconnect, RLS/Storage isolation, mobile, desktop, console, network, and logs.
7. Run Supabase security advisors and disposition relevant findings. Do not buy a plan upgrade without approval.
8. Stop at a green, mergeable, Preview-accepted release. A merge that deploys the custom domain requires explicit production-cutover authorization.

## Interactive provider steps

ChatGPT and Claude require the user to paste the Workspace MCP address into their product's connector settings and explicitly approve Lead Emergence authorization. If consent is denied or connection fails, use Try again or Continue setup without AI. Never mark the connection `connected` until an authorized MCP request successfully registers the client.

Run `real-client-mcp-acceptance.md` for the complete connect, use, natural token
refresh, disconnect, old-bearer denial, reconnect, client-side revoke, and
fixture-cleanup matrix. A client UI refresh is not evidence of a refresh-token
exchange.

External connectors in the catalog do not yet have approved runtime adapters. Do not solicit OAuth consent for them or reuse legacy tokens. Implement each later with connect, callback, encrypted server-side persistence, use, refresh, disconnect, revoke, reconnect, error handling, least-privilege scopes, capability enforcement, and cross-user tests.

## Plan administration

Normal users cannot mutate plans. An approved admin may call the private `assign_personal_plan` command through the migration authority's audited service/admin channel. Record the reason, verify the affected Workspace/user, and test the resolved capabilities. Do not place a service-role key in Workspace runtime.

For a downgrade, verify privileged behavior is denied and retained data remains present. For an upgrade, verify only the newly included capability becomes available; membership and record ownership must be unchanged. Billing remains inactive.

## New-user and support procedure

- Confirm the canonical Entry identity has an active Personal entitlement.
- Confirm one-login reaches setup without a second password prompt.
- Let the user choose ChatGPT, Claude, or native setup.
- If AI connection is unavailable, move to native setup without clearing progress.
- Completion requires at least three confirmed setup areas and produces a useful Home state.
- For recovery, use Entry's account recovery. Workspace does not own a second canonical password lifecycle.
- For an existing Workspace owner, preserve the same Workspace and reconcile the canonical identity by the approved identity-link process; do not match or merge by email alone.

## Failure and containment

- Entry SSO failure: retain the explicit Workspace password login as rollback, disable only the faulty custom provider/client, and preserve sessions/evidence.
- MCP incident: disconnect the client in Settings, revoke its OAuth grant, and if necessary disable the `workspace_mcp` capability. Confirm old bearers receive denial.
- Connector incident: disable the individual adapter/capability, revoke the provider token, retain safe metadata, and provide reconnect guidance.
- Plan incident: suspend or restore the affected assignment through the audited admin command; never change membership to simulate a plan change.
- Onboarding incident: retain confirmed configuration, repair the state through a reviewed forward migration or approved admin path, and resume at the first incomplete area.
- Schema incident: stop traffic-changing work and use reviewed forward repair. Do not rewrite hosted migration history or delete Personal data.

See `rollback.md` for release rollback and `integration-reconnection.md` for the external-credential boundary.

## Production acceptance record

Record exact deployment IDs, commit SHAs, migration checksums, CI results, browser matrix, Vercel log findings, security headers, Supabase advisor output, secret-scan disposition, callback configuration, and rollback rehearsal. Use `PASS` only for executed evidence; use `NOT RUN`, `DEFERRED`, or `BLOCKED` otherwise.
