# Workspace Trusted OIDC Remediation — Terra Candidate Verification

**Date:** 2026-08-29  
**Scope:** Candidate-source and isolated-local verification only. No hosted Supabase project, production resource, Vercel deployment, Auth provider, Auth signup setting, OIDC acceptance flow, MCP connection, or external Entry stack was changed.

## Immutable Candidate Provenance

### Git

- Repository: `https://github.com/abostwick12/lead-emergence-workspace.git`
- Review branch: `review/workspace-trusted-oidc-remediation-20260829`
- Security remediation commit: `5ef5f140dd16b9d9e1a2ad6a5c60d0170e45e1f0`
- Security parent: `dcf4b37664d6dd6fbb031881c1ab74dd1283d22c`
- Optional Entry-only beta-policy commit: `a56a706799da1b67a64d976db5480c11e474543f`

### Migration

- Filename: `supabase/migrations/20260829120000_workspace_trusted_oidc_provisioning_boundary.sql`
- SHA-256: `97189800E3349C4855FB3CCE7F9384AA5207E22EAEF2340E86B62F2A115E2F41`

### pgTAP

- Filename: `supabase/tests/database/workspace_trusted_oidc_provisioning_boundary.sql`
- SHA-256: `29EC92D11118DC6BC81616D60FED55AF59F45E1D1972A2D8F3C607AB16A1C426`

### Identity mapping regression

- Filename: `tests/entry-identity.test.ts`
- SHA-256: `623E0E313BEF6C2089414E67D29805C0F7DA622CD8B9455A949303E19199DD9D`

### Local database identity

- Local Supabase project: `lead-emergence-workspace-local`
- Local DB container: `supabase_db_lead-emergence-workspace-local`
- Isolated/local only: yes; `linked_project: null`.

### Deployed migration proof

The local `supabase_migrations.schema_migrations` record contains `20260829120000`.

### Deployed function proof

`pg_get_functiondef('workspace.ensure_personal_workspace()')` contained safe
markers for an enabled trusted-provider join, `provider_id = sub`, exactly one
trusted identity, trust-before-workspace branching, and exact canonical-link
resume validation.

### Runtime results

- RLS: **11 files / 247 assertions / 0 failures**
- Concurrency: **PASS**
- Schema policy: **25/25 PASS**
- Unit: **14 files / 74 tests PASS**
- Boundaries, typecheck, lint, build, and diff check: **PASS**

## Candidate inventory

- Worktree: `access-convergence-worktrees/workspace-remediation-beta`
- Candidate source commit: `5ef5f140dd16b9d9e1a2ad6a5c60d0170e45e1f0`
- Base SHA: `c9356efb03328464a7f12bb032dc6dfc2773e1e7`
- Candidate migration: `20260829120000_workspace_trusted_oidc_provisioning_boundary.sql`
- Migration SHA-256: `97189800E3349C4855FB3CCE7F9384AA5207E22EAEF2340E86B62F2A115E2F41`
- Corrected boundary pgTAP SHA-256: `29EC92D11118DC6BC81616D60FED55AF59F45E1D1972A2D8F3C607AB16A1C426`

Uncommitted candidate files at verification completion:

- `app/login/page.tsx`
- `docs/testing/test-evidence.md`
- `lib/workspace/repository.ts`
- `package.json`
- `supabase/migrations/20260829120000_workspace_trusted_oidc_provisioning_boundary.sql`
- `supabase/tests/database/workspace_productization.sql`
- `supabase/tests/database/workspace_trusted_oidc_provisioning_boundary.sql`
- `tests/entry-identity.test.ts`
- `tests/schema-policy-contract.test.mjs`

## Identity Mapping Regression

The focused `tests/entry-identity.test.ts` regression documents Supabase Auth's counterintuitive API aliases:

| Database `auth.identities` | API `UserIdentity` | Meaning |
| --- | --- | --- |
| `provider` | `provider` | Trusted provider identifier, such as `custom:lead-emergence-entry-workspace-acceptance` |
| `provider_id` | `id` | External provider subject / canonical Entry UUID |
| `id` | `identity_id` | Generated Supabase identity-row UUID |
| `user_id` | `user_id` | Workspace Auth principal |
| `identity_data->>'sub'` | `identity_data.sub` | OIDC canonical Entry UUID |

The regression proves `identity.id === identity_data.sub` is the correct API-level check, `identity.identity_id` may differ, and the provider identifier is never compared to the UUID subject. It passed **3/3**.

## Corrected pgTAP Fixtures

`workspace_trusted_oidc_provisioning_boundary.sql` now explicitly sets every trusted fixture's:

- generated `auth.identities.id` identity-row UUID;
- `provider_id` canonical Entry subject;
- `identity_data.sub` equal canonical subject;
- trusted `provider` identifier; and
- Workspace Auth `user_id`.

The valid fixture asserts that its row UUID differs from its provider subject. The runtime cases cover valid provision/retry, provider-id/sub mismatch, wrong provider, disabled provider, multiple trusted identities, conflicting canonical link, direct profile/workspace/membership seeding, no plan/onboarding/MCP-capability gain, and an administrative bare skeleton with no trusted identity.

## Local Stack Restoration

The isolated project is `lead-emergence-workspace-local`; `supabase status` reported `linked_project: null` throughout.

The initial stack had lost its expected Docker network. The safe recovery was:

1. `supabase stop --no-backup`
2. `supabase start`

This recreated `supabase_network_lead-emergence-workspace-local` and the local DB/Auth/REST containers. The standard local start rebuilt the complete migration chain; no hosted command, link, push, or remote target was used.

## Candidate Migration Deployment Proof

The rebuilt local database proves:

- `supabase_migrations.schema_migrations` contains `20260829120000`;
- `workspace.ensure_personal_workspace()` contains the trusted provider join, `provider_id = identity_data.sub`, strict exactly-one count, predicate-before-workspace lookup, and exact-profile-link resume markers;
- authenticated `INSERT` is false for `user_profiles`, `workspaces`, and `workspace_memberships`;
- authenticated update is true only for `user_profiles.clock_timezones`, and false for `canonical_user_id`;
- old direct profile/workspace/membership admission policies are absent.

## Deployed Function Predicate

The deployed function performs the following before checking for a Personal Workspace:

1. Requires a direct authenticated Workspace session.
2. Counts qualifying `auth.identities` joined to currently enabled trusted provider rows.
3. Requires exactly one qualifying identity.
4. Requires a UUID-shaped OIDC `sub` and `provider_id = sub`.
5. Only then counts Personal Workspaces and chooses creation or exact-integrity resume.

The existing-workspace path additionally requires one exact profile canonical ID/provider link and exactly one active owner membership. A self-owned workspace and owner membership alone cannot allocate plan/onboarding state.

## RLS Runtime Results

`npm run test:rls` — **PASS**.

- Files: **11**
- Assertions: **247**
- Failed: **0**
- Skipped: **0**

The new trusted OIDC boundary file executed in the registered suite and passed **31** assertions.

## Original Exploit Regression

An authenticated subject with no trusted identity attempted the original sequence:

1. Insert own profile — denied by table privilege.
2. Insert Personal Workspace — denied by table privilege.
3. Insert active owner membership — denied by table privilege.
4. Call `ensure_personal_workspace()` — denied `42501` because no verified Entry identity exists.
5. Obtain plan/onboarding — both remain absent.
6. Satisfy MCP capability prerequisite — false because no admitted graph/plan exists.

The earliest break is the revoked direct profile `INSERT`; table privilege, RLS-policy removal, and the RPC's independent strict trusted-identity predicate provide separate controls.

## Bare Skeleton Regression

The test creates a profile, Personal Workspace, and active owner membership under administrative fixture setup, deliberately omits a trusted identity, then calls `ensure_personal_workspace()` as that user. The function returns `42501`; no plan, onboarding row, or identity link is created. The existing-workspace branch is therefore independently fail-closed.

## Trusted First Provisioning

The faithful valid Entry fixture has an enabled trusted provider, `provider_id = sub`, and a distinct generated identity-row UUID. It creates exactly one profile, Personal Workspace, active owner membership, plan, and onboarding row. A repeat call keeps all graph counts at one.

## Concurrency Against Candidate Migration

The local migration presence was verified before runtime testing. `npm run test:provisioning-concurrency` then passed against `supabase_db_lead-emergence-workspace-local`, yielding exactly one Personal Workspace, active owner membership, plan, and onboarding row from simultaneous trusted first provisioning. This supersedes the pre-migration concurrency evidence.

## Legitimate Workflow Validation

| Workflow | Classification | Evidence |
| --- | --- | --- |
| Profile display-name update | Not currently used | No Workspace browser write path found. |
| Display-clock preference update | Works | Direct `clock_timezones` column update retained; focused and aggregate pgTAP pass. |
| Primary timezone update | Intentionally disabled | UI describes display clocks as independent of primary timezone. |
| Workspace rename | Not currently used / intentionally disabled | No current client workflow; direct workspace update removed. |
| Onboarding transition | Works | Existing controlled RPC tests pass. |
| Member invite | Not currently used / intentionally disabled | Personal beta has no Workspace member-management UI. |
| Member role change/removal | Not currently used / intentionally disabled | No current client workflow; direct membership write remains removed. |

No current legitimate Workspace workflow is broken by the candidate. Future workspace/member administration requires a separately reviewed narrow RPC, not broad table privileges.

## Legacy Login Classification

Removing password login, `?legacy=1`, and rollback wording is **BETA PRODUCT POLICY with security relevance**, not a required property of the database forged-skeleton fix itself. It is aligned with the separately reviewed Entry-only private-beta admission policy; it should remain in this candidate only if that policy scope is approved for the same change. It is not treated as a reason to re-enable any direct admission write.

## Full Validation Matrix

| Check | Result |
| --- | --- |
| `git diff --check` | PASS |
| `npm run check:boundaries` | PASS — 55 runtime files |
| `npm run test:schema` | PASS — 25/25 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS — 14 files / 74 tests |
| `npm run build` | PASS — Next.js 16.3.2 |
| `npm run test:rls` | PASS — 11 files / 247 assertions |
| `npm run test:provisioning-concurrency` | PASS |

No hosted test or live Entry → Workspace acceptance was run.

## Disposition

The candidate source and isolated-local runtime evidence are ready for independent review. This report does not authorize a hosted migration, Auth signup change, OIDC retry, MCP operation, or production deployment.
