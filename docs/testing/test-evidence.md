# Test evidence

## Executed locally

- `npm run scan:sensitive` — passed before the first push; full authored working tree scanned (including ignored local files, excluding dependency/build output) and the one preserved private `main` initializer commit scanned. No credential, token, private key, connection string, email address, or application personal-data pattern was found in file content.
- `node scripts/check-workspace-schema.mjs` — passed; SHA-256 `a3fadfb19e5754c7ac937fd92102cc9ec904c2710b677190a4f892dbc7f544f6` at execution.
- `npm run test:schema` — 4/4 passed.
- `npm run check:boundaries` — passed; no ministry/Consulting imports or service-role runtime client.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test:unit` — passed; 1/1 unit test.
- `npm run build` — passed.
- `npm run test:rls` — passed; 25/25 live pgTAP hostile assertions against the isolated local Docker/Supabase stack. Coverage includes authenticated tenant isolation, non-member denial, immutable tenancy, audit-trigger integrity, private Storage object and foreign-bucket denial, a denied ministry-product fixture, anonymous denial, and security-definer privileges/search path/private-schema visibility.

## Not executed, with reason

- E2E authenticated flows: requires local Supabase fixtures and local stack.
- Production migration/deployment/cutover: intentionally blocked by Gates A–D.

No unavailable test is treated as passing or as approval to onboard external users.

## Hosted Gate A evidence — committed, security-validated

- Gate A transaction — **PASS**. Executed only the approved hash-locked package (`6649b094b7a0f3d21906d08b5f564289f041b336fe61218a71e64f9bb3f33190`) from Workspace commit `120884e697b5ef69ff786912629ff2a6c3592704`; no migration-history entry was written.
- Postflight structure/security — **20/20 PASS**. Workspace schemas, 22 tables, five private functions, RLS, grants, immutable-tenancy and audit controls, Leader Mode entitlement/default, private bucket/policies, guest-page hardening, and database-specific Data API exposure `public,workspace` all validated. `workspace_private` is not exposed.
- Original hostile suite — **25/25 PASS**. The hosted PostgreSQL-only replacement preserves the locally passing pgTAP assertions and runs under synthetic authenticated/anonymous claims inside a rolled-back transaction.
- Supplemental hosted hostile suite — **30/31**: 30 pass; one is **not testable through direct SQL**. Supabase correctly rejects direct deletion from `storage.objects` with `42501` and requires the Storage API. The deployed delete policy was separately validated and was not weakened or changed.
- Rollback verification — **PASS**. No synthetic users, Workspace rows, Storage objects/bucket, or Ministry fixture from the transactional hosted harness persisted.

### Outstanding pre-deployment integration test

The remaining test is the authenticated Storage API owner/non-owner/anonymous delete path using only synthetic users and a synthetic object. The project public Auth API rejected reserved synthetic signup addresses before creating any user. A subsequent narrowly scoped attempt to provision only fixed synthetic Auth/Workspace fixtures through privileged hosted SQL was rejected before execution; no user, Workspace row, or object was created.

This test is therefore recorded as a **pre-deployment integration test**, not as passing. It must run in an isolated Supabase test project (or through an already-approved synthetic-user lifecycle) using the official Storage API: owner upload and delete succeed, non-owner and anonymous deletion fail, and the synthetic object is absent afterward. No production schema, policy, bucket, configuration, or Storage delete policy change is authorized to enable it.

## Failures encountered and resolved locally

- The first local migration attempt failed because the local Storage image represents `storage.objects.owner_id` as `text`; all four owner predicates now compare to `auth.uid()::text`, retaining the same owner-only restriction.
- The first pgTAP attempt used an unavailable assertion helper; the test now uses `ok()` around the SQL predicate.
- One immutable-tenancy assertion expected an obsolete message; the trigger correctly rejected the mutation and the assertion now matches its current message.

## Command-center remediation — restored local validation (not a deployment approval)

- Docker Desktop v4.87.0 and the isolated `lead-emergence-workspace-local` Supabase stack were restored locally. No hosted Supabase project was linked, queried, or changed.
- `npm run check:boundaries` — passed; 19 runtime files verified with no Ministry/Consulting import or service-role client.
- `npm run test:schema` — passed; 6/6 schema and security-contract assertions.
- `npm run typecheck` — passed.
- `npm run lint` — passed with no warnings/errors.
- `npm run test:unit` — passed; 1/1.
- `npm run build` — passed with the local Supabase configuration; all Workspace routes generated.
- `supabase test db --local supabase/tests/database/hostile_workspace_access.sql` — **25/25 PASS**. This is the canonical pgTAP RLS, cross-tenant, cross-product, anonymous, immutable-tenancy, audit-trigger, Storage, and security-definer suite.
- Supplemental transactional SQL hostile harness — **30 PASS, 1 not applicable via direct SQL**. The direct `storage.objects` delete case correctly receives Supabase `42501`; the approved owner/non-owner/anonymous lifecycle was tested through the official Storage API instead.
- Supplemental harness rollback verification — passed; zero harness synthetic users persisted.
- Official local Storage API lifecycle — **5/5 PASS** using two synthetic local Auth users: owner upload; non-owner delete denied with the object retained; anonymous delete denied with the object retained; owner delete; and zero synthetic objects after cleanup.
- Authenticated visual QA used the local Auth-issued synthetic user and a local Personal Workspace/membership fixture only. It created a task, a career opportunity, and inbox captures through the authenticated UI, exercised header Quick Capture, and never used a production session, credential, or bypass. See `design-qa.md` for screenshot evidence and the remaining reference-capture limitation.
