# Workspace GoTrue LinkAccount Integration — Terra

**Date:** 2026-08-30  
**Scope:** Local source-integration only. No Workspace source, hosted Supabase project, production service, hosted Auth configuration, client, provider, user, callback, JIT login, or MCP state was modified.

## Pinned GoTrue Version

| Item | Value |
| --- | --- |
| GoTrue tag | `v2.195.0` |
| Source commit | `0522e7bcf7135a476d258b1603134b97846179fc` |
| Local source checkout | `C:\Users\awbostwick\AppData\Local\Temp\supabase-auth-v2.195.0` |
| Inspected local Workspace Auth container image | `public.ecr.aws/supabase/gotrue:v2.195.0` |
| Container-reported version | `v2.195.0` |
| Go toolchain required by pinned source | `go1.25.12` |

The tested source tag and the inspected local Workspace Auth runtime both report GoTrue `v2.195.0`.

## Exact Account-Linking Code Paths

Pinned source paths:

- External callback: `internal/api/external.go:internalExternalProviderCallback`
- Resolution and action helper: `internal/api/external.go:createAccountFromExternalIdentity`
- Decision engine: `internal/models/linking.go:DetermineAccountLinking`
- Identity creation: `internal/api/external.go:createNewIdentity`
- Identity persistence model: `internal/models/identity.go:NewIdentity`
- Linking-domain derivation: `internal/models/linking.go:GetAccountLinkingDomain`

The real callback helper selects `LinkAccount`, `CreateAccount`, `AccountExists`, or fails closed for `MultipleAccounts`. `LinkAccount` calls the real identity-creation operation on the selected existing user; `CreateAccount` creates a new user then identity.

## Harness Design

A focused test was added only to the isolated pinned GoTrue source checkout:

`internal/api/external_linkaccount_integration_test.go`

It uses GoTrue's own `setupAPIForTest`, test PostgreSQL setup, `models`, transaction wrapper, `DetermineAccountLinking`, and `createAccountFromExternalIdentity`. It does not touch a Lead Emergence repository and does not seed the final custom identity directly.

The disposable test database was the pinned GoTrue repository's local Postgres service. GoTrue migrations were applied from the same pinned source before the focused test run.

## LinkAccount Test

The production-semantic case creates one confirmed regular canonical user with its normal email identity, then presents incoming provider data with:

- provider: `custom:lead-emergence-entry-workspace-prod`;
- provider subject equal to the canonical user UUID;
- matching verified primary email;
- default linking domain; and
- no preexisting custom identity.

The test executes the real `createAccountFromExternalIdentity` helper. Result:

- decision: `LinkAccount`;
- Auth user count before and after: `1` / `1`;
- canonical user UUID: retained;
- new custom identity count: exactly `1`;
- new identity `user_id`: canonical user UUID;
- identity provider: expected custom provider;
- `provider_id`: canonical subject UUID;
- `identity_data.sub`: canonical subject UUID;
- internal identity-row UUID: distinct from the canonical user UUID; and
- original email identity: retained.

## AccountExists Control

The same incoming provider identifier and subject after successful linking produces:

- decision: `AccountExists`;
- same canonical user;
- no extra identity; and
- no extra `auth.users` row.

## CreateAccount Control

A verified external email with no matching existing regular user produces:

- decision: `CreateAccount`;
- one created Auth user; and
- one resulting provider identity.

This proves the harness distinguishes account-resolution branches rather than always returning `LinkAccount`.

## MultipleAccounts Control

Two eligible identities from separate existing users were placed in the same configured linking domain. The real `DetermineAccountLinking` implementation returned:

- decision: `MultipleAccounts`.

No candidate user was selected. The ambiguity control does not execute user creation; it asserts GoTrue's exact fail-closed decision prior to the callback helper's error handling.

## Verified Email Behavior

- Matching **verified** email: `LinkAccount`.
- Matching **unverified** email: `CreateAccount` decision, not `LinkAccount`.

When the real callback helper processes the unverified case under the pinned test configuration, it returns GoTrue's provider-email-verification error. The canonical user retains only its original identity; it does not receive the custom identity. This confirms unverified email is not equivalent to the production LinkAccount precondition.

## Linking Domain Behavior

The expected custom provider has no configured experimental provider-linking-domain override, so it uses GoTrue's `default` linking domain.

A control maps the custom provider to an isolated domain. In that state, a matching verified email does not link the existing default-domain canonical user; GoTrue selects `CreateAccount`. Therefore production configuration must leave the custom Workspace provider in the default linking domain for the approved automatic LinkAccount semantics.

## Identity Semantics

The pinned GoTrue `models.NewIdentity` behavior and executable test confirm:

| Field | Meaning |
| --- | --- |
| `provider` | trusted custom provider identifier |
| `provider_id` | external provider subject / canonical UUID |
| `identity_data.sub` | same canonical UUID |
| `user_id` | retained canonical Auth user UUID |
| internal identity `id` | independent generated identity-row UUID |

The internal row UUID is not account-resolution authority and must not equal `sub`.

## Test Results

Focused command boundary:

```text
go test ./internal/api -run "TestExternalAccountLinkingIntegration|TestExternalAccountLinkingControls" -count=1
```

Result:

```text
ok github.com/supabase/auth/internal/api 0.148s
```

The focused boundary was chosen because it executes the real external account-resolution helper, transaction, model persistence, and all requested decision controls while avoiding unrelated providers, transport fixtures, and repository-wide infrastructure.

## Composition With Workspace Security Evidence

This proof establishes:

```text
Pinned GoTrue default-domain, verified-email resolution
  -> existing canonical Auth user gains one custom provider identity
  -> no second Auth user
```

The independently approved Workspace proof establishes:

```text
one valid trusted identity
  -> exactly one profile / Personal Workspace / active owner / plan / onboarding
```

Workspace references remain:

- security commit: `5ef5f140dd16b9d9e1a2ad6a5c60d0170e45e1f0`;
- follow-up: `2dff26edf986fe2011fe4360e9bfc8c8750c7fdc`;
- full Workspace RLS suite: `247/247 PASS`;
- provisioning concurrency: `1 profile / 1 workspace / 1 active owner / 1 plan / 1 onboarding`.

Together, the evidence supports canonical-user continuity before trusted Workspace provisioning. It does not alter either system.

## Remaining Hosted OIDC Evidence

This pinned integration proof does **not** prove hosted configuration of:

- issuer/discovery endpoints;
- exact client ID/audience;
- PKCE protocol exchange;
- nonce verification;
- JWKS/signature validation;
- callback/redirect registration;
- provider settings; or
- hosted user/graph integrity.

Those remain separate hosted-security-deployment gate checks. No hosted mutation is authorized by this local proof.
