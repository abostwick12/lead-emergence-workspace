# Workspace Dual-Topology OIDC Acceptance — Terra

**Date:** 2026-08-30  
**Scope:** Local GoTrue runtime compatibility and supported-configuration assessment only. No local OIDC issuer/client/provider was configured, no Auth user was created, and no hosted or production resource was changed.

## Executive Result

**BLOCKED — LOCAL CUSTOM OIDC SELF-ISSUER HARNESS UNSUPPORTED**

The requested shared-Auth LinkAccount acceptance cannot be executed faithfully on the isolated local runtime. This is a local custom-provider safety restriction, not a failure of the approved Workspace admission migration or of GoTrue automatic account-linking support.

## Execution Candidate

No new execution-candidate commit was created because Phase 2 and Phase 3 cannot be truthfully executed with the available harnesses.

The requested source ancestry is available on the review branch:

- Security remediation: `5ef5f140dd16b9d9e1a2ad6a5c60d0170e45e1f0`
- Profile-cardinality follow-up: `2dff26edf986fe2011fe4360e9bfc8c8750c7fdc`

The current candidate local admission evidence remains source/database-RLS evidence; it is not an end-to-end OIDC topology proof.

## GoTrue Runtime Compatibility

The isolated Workspace Auth container runs:

```text
public.ecr.aws/supabase/gotrue:v2.195.0
```

`gotrue version` reported `v2.195.0`. The corresponding exact open-source tag was inspected at commit `0522e7bcf7135a476d258b1603134b97846179fc`.

That release contains automatic account resolution in its external-provider callback:

```text
DetermineAccountLinking(...)
  -> LinkAccount | CreateAccount | AccountExists | MultipleAccounts
```

For `LinkAccount`, the runtime calls `createNewIdentity` against the selected existing user. For `CreateAccount`, it creates a new Auth user and then creates the identity. Therefore the local GoTrue version can model the account-resolution behavior in principle; it is not too old or missing `LinkAccount`.

The locally visible public Entry authorization server did not expose safe version/build metadata, so hosted version equivalence remains unproven and is not inferred.

## Supported Local Configuration Path

GoTrue v2.195.0 supports real custom OIDC provider configuration through its Auth Admin custom-provider API. Its supported provider record includes:

- `provider_type: oidc`;
- `custom:` identifier;
- client ID and encrypted client secret;
- issuer/discovery URL;
- scopes;
- PKCE setting;
- nonce skip/check setting; and
- enabled/email-optional settings.

The same runtime also exposes OAuth-server client registration and token routes. This is the supported configuration mechanism; direct insertion of a final identity row would not test the runtime callback and was not used.

## Local Self-Issuer Blocker

The v2.195.0 custom-provider administration path validates an OIDC issuer/discovery URL with `ValidateOAuthURL`. The validator requires HTTPS and rejects:

- `localhost` and all `*.localhost` names;
- loopback addresses;
- private/reserved resolved addresses; and
- unresolved hosts.

The isolated local Workspace Auth instance is reachable only through local API addresses such as `http://localhost:56421` / `http://127.0.0.1:56421`. Those addresses are intentionally rejected before a custom OIDC provider can be persisted. A private-IP alias or a localhost TLS alias does not bypass the check because the validator resolves and rejects the resulting private/loopback address.

Consequently, one local GoTrue instance cannot be configured as its own custom OIDC issuer/consumer using only local-only origins on this runtime. Forcing provider rows directly into Auth tables would bypass supported runtime configuration and is expressly excluded from this acceptance.

## Existing Separate-Auth Evidence

The historical Goal C evidence records a hosted Preview two-authority test:

```text
Entry Supabase/Auth authority
  -> Workspace custom OIDC provider
  -> Workspace Supabase/Auth authority
  -> Workspace product provisioning
```

It is historical contract evidence only. The current repository contains no reusable isolated local Entry-stack → Workspace-stack browser OIDC harness that can re-run the required issuer/client boundary, authorization code, consent, PKCE, nonce, callback, and Auth-account creation behavior.

The current Workspace local concurrency script seeds `auth.users` and `auth.identities` directly and invokes `workspace.ensure_personal_workspace()`. It does not create or exchange an OIDC authorization code, configure a custom provider, or prove CreateAccount behavior.

Accordingly, a current result labelled `SEPARATE-AUTH / CREATEACCOUNT FALLBACK` cannot be produced without inventing a new local custom-provider/OIDC integration harness and secret-backed provider configuration. That would be a material test-topology implementation, not a re-run of an existing test.

## Shared-Auth LinkAccount Assessment

The requested single-Supabase topology requires one GoTrue project to act simultaneously as:

1. Entry's canonical user store and OAuth/OIDC issuer; and
2. Workspace's custom external OIDC client/provider destination that links the returned identity to the already-existing canonical Auth user.

No application-level implementation is required or was added. GoTrue itself owns automatic `LinkAccount` behavior, as established above. The remaining blocker is the runtime's refusal to accept a local-only custom OIDC issuer.

The reviewed application source has no manual linking mechanism, which is correct for this harness:

- no `LinkAccount`, `linkAccount`, `link_account`, or `linkIdentity()` integration exists;
- `workspace.ensure_personal_workspace()` provisions product rows only after an Auth session and identity already exist; it does not control `auth.users` creation or identity linking;
- the current callbacks use `exchangeCodeForSession()` against Workspace's own Auth client, which matches the separate-authority model;
- the checked-in local Supabase configurations enable OAuth servers but do not provide a local cross-provider client/issuer configuration for Workspace Auth;
- the historical Entry client callback targets Workspace's **separate** Supabase Auth `/auth/v1/callback` endpoint.

A custom OIDC provider normally authenticates an existing user in the provider's authority and creates/links an identity in the relying Auth authority. The runtime includes the required CreateAccount-versus-LinkAccount decision logic, but no supported local-only issuer URL can reach that decision in the requested self-issuer topology.

## Why Direct Database Seeding Is Insufficient

Directly adding a custom identity to the same local `auth.identities` table could prove only the already-covered Workspace database invariant:

```text
valid trusted identity -> exactly one Personal product graph
```

It cannot prove any of the requested Auth/OIDC properties:

- OIDC issuer/audience validation;
- authorization code handling and replay prevention;
- PKCE verifier validation;
- nonce validation;
- JWKS/signature validation;
- callback redirect processing;
- GoTrue account selection; or
- LinkAccount rather than CreateAccount.

Representing seeded data as a LinkAccount acceptance result would therefore be misleading.

## Required Negatives

The approved local pgTAP suite already validates database-layer negatives including untrusted direct DML, forged skeleton non-upgrade, disabled/wrong/ambiguous provider identities, provider-id/sub mismatch, immutable canonical links, and no plan/onboarding/MCP-capability manufacturing.

However, wrong issuer, wrong audience at OIDC token validation, nonce failure, and signature/JWKS failure require an actual configured issuer/client/provider exchange. No such isolated harness exists.

## Entry Regression

The Entry local project has ordinary email/password and recovery coverage, but no current local Entry → Workspace OIDC acceptance harness. Adding a Workspace custom provider cannot be assessed without first implementing the missing provider/client topology.

## Required Next Decision

Before this acceptance can proceed, select one reviewed approach:

1. **Isolated HTTPS sandbox acceptance:** provision a non-production sandbox with a publicly resolvable HTTPS issuer that is isolated from production, then configure the runtime-supported custom OIDC provider via the Auth Admin API and execute the real LinkAccount flow.
2. **Local test-runtime capability:** use a separately approved GoTrue test build/configuration that supports an HTTPS, non-loopback issuer reachable by custom-provider discovery without weakening `ValidateOAuthURL` in the production-equivalent runtime.

Neither option authorizes hosted production mutation. No custom identity may be seeded to substitute for the external-provider callback.

## No-Mutation Attestation

No signup setting, local provider, OAuth client, callback, Auth user, entitlement, database row, migration, hosted environment, production setting, OIDC flow, or MCP state was modified during this assessment.
