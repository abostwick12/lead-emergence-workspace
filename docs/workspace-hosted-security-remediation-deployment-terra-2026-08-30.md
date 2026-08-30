# Workspace Hosted Security Remediation Deployment — Terra

**Date:** 2026-08-30  
**Scope requested:** Deploy the reviewed Workspace admission remediation and verify its hosted structural controls without changing Auth, OAuth, providers, callbacks, JIT admission, or MCP.

## Status

**BLOCKED — HOSTED SECURITY DEPLOYMENT MISMATCH**

No hosted mutation was performed.

## Execution Candidate

The reviewed source lineage is available on the published review branch:

- security remediation: `5ef5f140dd16b9d9e1a2ad6a5c60d0170e45e1f0`;
- profile-cardinality follow-up: `2dff26edf986fe2011fe4360e9bfc8c8750c7fdc`.

The candidate migration is:

- `supabase/migrations/20260829120000_workspace_trusted_oidc_provisioning_boundary.sql`
- SHA-256: `97189800E3349C4855FB3CCE7F9384AA5207E22EAEF2340E86B62F2A115E2F41`

The repository's evidence manifest records the current local validation baseline, including 247/247 RLS assertions and 1/1/1/1/1 concurrent graph cardinality.

## Deployment Authority Review

The repository’s controlling `AGENTS.md` explicitly states that the Ministry repository is the sole authority for applying hosted Workspace migrations and prohibits this Workspace repository from running `supabase link`, `supabase db push`, or migration repair against the shared hosted project.

`docs/status/extraction-status.md` additionally identifies a material target split:

- shared hosted Workspace foundation: `cirqqhuvzekbvysiyedg` (`emergence-ministry-platform`);
- previously active Personal sandbox / public OAuth authority: `nhkugzifuapplwpnfpbt`;
- Entry development authority: `vnjdubrnmxvmsccxmhst`.

The public Workspace origin and available account inventory did not prove that a single currently deployed Workspace application, database migration ledger, and Auth authority form one authorized target for this remediation. The separate hosted inventory on 2026-08-29 therefore stopped before reading a supposed Workspace Auth/database target.

## Why Deployment Did Not Proceed

The requested Phase 3 baseline and Phase 5 verification require an unambiguous hosted target and authorized migration process. Neither condition is satisfied from this Workspace worktree:

1. The actual deployed Workspace Supabase database/Auth target is not proven.
2. The documented authority requires the Ministry repository/operator to package and apply hosted Workspace SQL.
3. Existing records show different Workspace/MCP/Auth states across shared foundation and the Personal sandbox.
4. Applying the forward-only security migration to an inferred target could change unrelated production or sandbox data and would violate the repository instructions.

Creating an execution commit, rerunning local tests, or deploying a Vercel application cannot resolve the missing database target/authority distinction.

## Pre/Post Structural Verification

Not run against hosted infrastructure because no target was safely authorized or proven. The following remain required after the Ministry authority establishes the exact target:

- migration ledger baseline and exact migration checksum;
- deployed function/grant/policy baseline;
- trusted-provider registry structural snapshot;
- non-content Personal graph classification;
- reviewed migration package application;
- postflight function/policy/grant verification; and
- approved, rollback-safe structural adversarial checks.

## Validation Totals

No new execution-candidate validation was run because deployment was blocked before candidate freeze. Previously recorded local evidence remains reference-only and is not represented as hosted deployment evidence.

## No-Mutation Attestation

No hosted migration, Vercel deployment, Auth setting, OAuth client/provider, callback, user, graph row, entitlement, MCP state, or production resource was changed during this task.

## Required Resolution

Before retrying this deployment gate, the authorized Ministry migration authority must provide a written, target-specific deployment instruction identifying:

1. the exact Supabase project ref/database that backs the intended Workspace deployment;
2. the exact deployed Workspace application/environment to release;
3. the approved packaging mechanism for migration `20260829120000`; and
4. authorization for the requested pre/post structural verification query set.

No Auth/OIDC configuration is authorized as part of that resolution.
