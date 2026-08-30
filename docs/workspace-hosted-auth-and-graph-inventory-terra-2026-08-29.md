# Workspace Hosted Auth and Graph Inventory — Terra

**Date:** 2026-08-29  
**Scope:** Read-only target-provenance attempt only. No hosted Auth, provider, hook, database, migration, deployment, OIDC, MCP, or production mutation was performed.

## Executive Classification

**BLOCKED — HOSTED CONFIGURATION CANNOT BE VERIFIED**

The public Workspace origin proves that it currently delegates its OAuth/MCP authorization server to the Entry development project, but it does **not** prove which hosted Supabase project stores the Workspace Auth users and `workspace` schema. The available read-only project inventory has no active project that can be proven to be the Workspace database target. Therefore it would be unsafe to read, classify, or recommend changes to a candidate project’s Auth configuration or user graph.

## Hosted Environment Provenance

| Item | Read-only evidence | Classification |
| --- | --- | --- |
| Workspace application origin | `https://workspace.leademergence.com/login` responds as Lead Emergence Workspace | Proven |
| Expected MCP resource URI | Public OAuth protected-resource metadata returns `https://workspace.leademergence.com/api/mcp` | Proven |
| Public authorization server | Public protected-resource metadata returns `https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1` | Proven as current OAuth authorization-server metadata |
| Current Entry project | Read-only project inventory identifies `vnjdubrnmxvmsccxmhst` as `lead-emergence-entry-dev`, active/healthy | Proven |
| Hosted Workspace Supabase project ref | Not exposed by the public Workspace application or source deployment metadata available to this review | **Not proven** |
| Hosted Workspace Auth issuer | Not safely derivable without the Workspace project ref | **Not proven** |
| Source SHA currently deployed | Not exposed by the public origin in reviewed metadata | Unknown |

The public authorization-server metadata must not be conflated with the Workspace database/Auth project. It identifies the OAuth server used by the application, not the hosted `workspace` schema owner.

## Auth Signup Policy

Not inventoried. Effective hosted Workspace Auth settings cannot be safely queried until the Workspace Supabase target is proven. No assumptions are made about global signup, email/password, phone, anonymous sign-in, email confirmation, or password-change controls.

## Enabled Provider Inventory

Not inventoried because the hosted Workspace Auth target is not proven.

The read-only project inventory includes these account-visible projects:

| Ref | Name | Status | Relevance |
| --- | --- | --- | --- |
| `vnjdubrnmxvmsccxmhst` | `lead-emergence-entry-dev` | Active/healthy | Public Workspace OAuth authorization server |
| `cirqqhuvzekbvysiyedg` | `emergence-ministry-platform` | Active/healthy | Not proven to back Workspace |
| `nhkugzifuapplwpnfpbt` | `lead-emergence-personal-sandbox` | Inactive | Not proven to back Workspace |
| `lpqgjnuvfvuuashcmlxq` | `lead-emergence-meridian-sandbox` | Inactive | Not relevant from available evidence |
| `eudlnlizoioqwqjuxgro` | `lead-emergence-consulting-dev` | Inactive | Not relevant from available evidence |

## Entry OIDC Provider Verification

Not performed against a Workspace Auth project because its target is unproven. The public metadata establishes only the authorization-server base URL above; it does not expose provider identifier, issuer configuration, client presence, PKCE, nonce behavior, callback registration, or redirect allowlist.

## Redirect / Callback Review

Not verifiable safely. The public Workspace login route begins Entry sign-in at `/auth/entry?next=%2Fworkspace`, but the hosted Supabase redirect allowlist and custom-provider callback settings are not publicly available and no project target was proven.

## Auth Hook Inventory

Not verifiable safely. In particular, the presence or absence of a Before User Created hook is unknown. The public metadata cannot establish whether a custom access-token hook exists in a prospective Workspace project.

## Trusted Provider Table Inventory

Not queried. `workspace_private.trusted_identity_providers` belongs to the unproven Workspace database target and should not be queried in a different project by inference.

## Target Policy Comparison

| Required target control | Hosted effective value | Classification |
| --- | --- | --- |
| Global Auth user creation enabled for JIT OIDC | Unknown | UNKNOWN |
| Email self-signup disabled | Unknown | UNKNOWN |
| Phone/SMS signup disabled | Unknown | UNKNOWN |
| Anonymous sign-in disabled | Unknown | UNKNOWN |
| Unwanted standard OAuth providers disabled | Unknown | UNKNOWN |
| Exactly trusted Entry custom OIDC provider enabled | Unknown | UNKNOWN |
| Database trusted-provider row aligned to Auth provider | Unknown | UNKNOWN |

## Personal Graph Integrity Counts

Not run. No Workspace database project could be proven; querying structural graph state from `cirqqhuvzekbvysiyedg`, `nhkugzifuapplwpnfpbt`, or the Entry project would risk inventorying the wrong environment.

| Classification | Count |
| --- | --- |
| TRUSTED_LINKED | Unknown |
| UNLINKED | Unknown |
| CONFLICTING | Unknown |
| INCOMPLETE | Unknown |

## Legacy / Bare Graph Findings

Not run for the same target-provenance reason. The required structural checks remain pending for canonical-link absence, trusted-identity absence, active-owner-without-identity, and plan-on-unlinked-owner counts.

## Auth User vs Product Graph Counts

Not run. The following required aggregate counts remain unknown until the Workspace database/Auth project is proven:

- total Workspace Auth users;
- users with and without trusted Entry identity;
- users with Personal graphs; and
- Auth users with no product graph.

## Acceptance vs Hosted Classification

**CANNOT DETERMINE.** The earlier acceptance 422 may be acceptance-only drift, a contradiction shared by hosted Workspace, or evidence of a different hosted admission mechanism. Current read-only evidence does not identify the hosted Workspace Auth project required to distinguish these cases.

## Remaining Acceptance Actions

**Required before isolated JIT OIDC acceptance:**

1. Establish the exact Supabase project ref/URL used by the deployed Workspace application using an approved read-only deployment/runtime configuration source.
2. Confirm that project is the target for `workspace.leademergence.com`, rather than merely the public OAuth authorization server.
3. Obtain approved read-only access sufficient to inventory effective Auth controls, provider metadata, hook metadata, trusted-provider rows, and structural graph counts.
4. Run the requested aggregate-only Personal graph integrity classification against that proven target.

## Remaining Production Beta Actions

After the target is proven and inventoried, production beta still requires separate review/approval for:

- deployment of the approved source remediation where applicable;
- resolution of any Auth/provider policy mismatch;
- reviewed handling of any UNLINKED, CONFLICTING, or INCOMPLETE graph classifications;
- exact redirect/callback and hook inventory; and
- a separately authorized, controlled JIT acceptance run.

## No-Mutation Attestation

No action in this inventory attempt altered Auth settings, signup controls, providers, hooks, secrets, database rows, migrations, graph state, deployments, production resources, OIDC state, or MCP state. No Entry → Workspace callback was retried.
