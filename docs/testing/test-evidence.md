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
- At the original foundation-validation checkpoint, production migration/deployment/cutover was intentionally blocked. This historical disposition is superseded by the Gate D production evidence below.

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

## Gate C remediation deployment — automated acceptance

- Deployment `dpl_FqY1oLR1DXwyMpH9sseiheMAUwba` — **READY** at the protected production Workspace URL. It was built from the 31-file source lock for commit `dd8e64479a33e7668dc87e734de53a6da32f9514` with bundle SHA-256 `358141d01bdb27132420dfbdb3a658cd8869a7539b2195976c895223e5db3b5d`.
- Deployment protection, authenticated owner Workspace resolution, session reload, migrated dashboard data, seven reconnect-required integrations, empty domain states, upload UI absence, and browser-console inspection — **PASS**.
- `NEXT_PUBLIC_WORKSPACE_UPLOADS_ENABLED` — **provenance/runtime verified disabled**. The approved configuration set it to `false`; no subsequent Vercel environment update occurred; the locked source has no Workspace Storage runtime call; and the authenticated production UI exposes no upload control. Vercel masks the local readback as `[SENSITIVE]`; plaintext readback is not a release requirement.
- Exact transactional CRUD/audit artifact SHA-256 `c955085109ede4d5874037a3a351e355f9dce7e7f6d2b07ce779aea1fd18bb40` — **PASS**. Create, update, delete, and all three audit assertions passed under the authenticated role, then rolled back.
- Hosted cross-product hostile artifact SHA-256 `240731b7eba03ee161ae74de3b878dbc59c5a4c33ed84082afcefa5522684ab4` — **30 PASS, 1 not applicable through direct SQL**. The only non-passing case is the accepted Supabase restriction on direct `storage.objects` deletion (`42501`); it is covered by the official Storage API lifecycle disposition.
- Sign-out — **PASS**. The authenticated automated session returned to the private login route without changing Workspace data.
- Runtime logs — **PASS**. No error-level logs exist for the remediation deployment.
- Post-test persistence check — **PASS**. No CRUD or hostile-suite synthetic task, audit row, user, Workspace, bucket, Storage object, or Ministry fixture persisted.
- Final authenticated visual/product acceptance — **PASS**. The owner accepted the protected production Workspace experience against the real Personal Workspace data.
- Gate C — **COMPLETE**. The current deployment is preserved; no routing, integration, uploads, legacy command-center, Ministry, Consulting OS, or Gate D change is authorized by this acceptance.

## Next.js 16 security remediation — local candidate validation

- Approved framework/tooling target installed: `next@16.3.2`, `eslint-config-next@16.3.2`, `eslint@9.39.5`; React and React DOM remain `18.3.1`. The Node engine is declared as `>=20.9.0`.
- `npm run scan:sensitive`, `npm run check:boundaries`, `npm run test:schema` (6/6), `npm run typecheck`, `npm run lint`, `npm run test:unit` (1/1), and `npm run build` — **PASS**.
- Canonical local Supabase hostile suite `supabase test db --local supabase/tests/database/hostile_workspace_access.sql` — **25/25 PASS**. The broad directory invocation also discovers preserved hosted-only Gate A preflight/postflight artifacts, which intentionally require Ministry relations absent from the isolated local Workspace project; it is not used as evidence for the local suite.
- `npm audit --omit=dev --json` — **PASS, 0 production findings**. No `next` or `postcss` finding remains.
- Full audit — **5 development-only findings**: Vitest `2.1.9` (critical) and its Vite/Vite-node/esbuild/@vitest/mocker chain (one high, three moderate). The audited fix is the separate major `vitest@4.1.11` upgrade; it is deliberately outside this framework-remediation scope.
- Manifest comparison: the exact deployed-source commit `dd8e64479a33e7668dc87e734de53a6da32f9514` was built in an isolated temporary directory with Next `14.2.35`, then compared with the Next `16.3.2` build. All 11 product routes remain static; dynamic route count remains zero; the CSP and all five additional headers are identical; no rewrite is introduced. Next 16 adds only internal `/_global-error` manifest metadata and changes generated chunks from Webpack to Turbopack.
- No preview or production deployment has been created from this candidate.

## Preview logout remediation — local validation

- Scope: a focused client logout correction only. The app remains a browser-client Supabase application; it does not add SSR auth, cookies, middleware, route changes, or hosted configuration changes.
- Root cause: the desktop sidebar expanded with the dashboard document, leaving Sign out outside the viewport. The prior browser automation did not invoke the control. The logout action also used Supabase's cross-device default scope and had no explicit completion navigation or visible failure state.
- Remediation: keep the sidebar within the viewport, call `auth.signOut({ scope: "local" })`, report a failure in-place, and use a same-origin navigation to `/login` only after successful client-session invalidation.
- Isolated local production-mode browser test — **PASS** using a newly created local synthetic owner and Personal Workspace fixture: sign-in succeeded; Sign out reached `/login`; direct `/workspace` navigation remained unauthenticated; and a subsequent sign-in succeeded. No production session, credentials, database rows, or hosted configuration were used.
- Local Supabase client session check — **PASS**: current-session sign-out returned no error, cleared the client auth storage, and returned no session afterward.
- `npm run scan:sensitive`, `npm run check:boundaries`, `npm run test:schema` (7/7), `npm run typecheck`, `npm run lint`, `npm run test:unit` (1/1), and `npm run build` — **PASS**.
- Canonical local RLS/cross-tenant/cross-product suite — **25/25 PASS**. `npm audit --omit=dev --json` remains clean with zero production findings.

## Gate D clock candidate and production preflight — 2026-08-21

- Three-clock implementation — defaults are `America/New_York`, `America/Chicago`, and `America/Los_Angeles`; all three are independently configurable and persisted in the separate `clock_timezones` profile preference. Primary `timezone` and stored timestamps are not updated.
- DST/local derivation — unit coverage verifies EST/EDT, CST/CDT, and PST/PDT across fixed winter/summer instants. No external time API or network call exists in the clock component.
- Responsive treatment — the header uses a three-column `minmax(0, 1fr)` clock grid, wraps it below header controls at narrower widths, and removes nonessential mobile header controls before they can cause horizontal overflow.
- `npm run check:boundaries` — **PASS**; 23 runtime files, with no Ministry/Consulting import or service-role client.
- `npm run test:schema` — **10/10 PASS**.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run test:unit` — **29/29 PASS**, including four clock-preference/DST tests and the canonical 24 hostile return-path cases.
- `npm run build` — **PASS** on Next.js 16.3.2; all 11 product routes plus `_not-found` remained static.
- Local `npm run test:rls` aggregate — **expected non-green** because it discovers preserved hosted-only Gate A preflight/postflight files that require the Ministry `guest_public_page_permissions` relation absent from the isolated Workspace stack. The aggregate still ran the unchanged canonical hostile file successfully at 25/25.
- Direct canonical `hostile_workspace_access.sql` — **25/25 PASS** after the clock schema was present. Focused `workspace_clock_preferences.sql` — **7/7 PASS** for defaults, self update, primary-timezone preservation, cross-user read/update denial, and hostile-update integrity.
- Local schema execution — the current CLI rejected the multi-statement migration file as one prepared statement, so the additive column and constraint were executed individually against the isolated local stack and both verified present/validated. No hosted project was linked or changed by this local validation.
- Shared production project verification — **PASS**. Project `cirqqhuvzekbvysiyedg` resolved to healthy `emergence-ministry-platform` on Postgres 17; no alternate project was used.
- Clock schema read-only preflight — **5/5 PASS**. `workspace.user_profiles`, primary `timezone`, RLS, and self-update policy are present; `clock_timezones` is absent before the additive migration.
- Legacy table read-only preflight — exactly seven tables exist and still grant authenticated writes: `personal_tasks` (0), `daily_briefing_cache` (1), `ai_conversations` (18), `personal_integrations` (7), `sage_memory` (0), `capture_inbox` (0), and `job_applications` (0). The five personal knowledge/feed candidates are absent and excluded from the planned freeze.

## Gate D production cutover — 2026-08-21

- Ministry D1 — **DEPLOYED**. Source `e41b10aa75f974e2a1acd10a8cf70c7e514ca5c5` merged as `ba61a28f297d72ee359d097fda805032d155f801`; the exact production deployment succeeded. Hosted migration `20260821181638_ministry_gmail_boundary` passed preflight/postflight. The private Ministry token table is service-role-only and empty, and the deployed meeting Gmail adapter never reads or writes `personal_integrations`.
- Ministry Gate D — **DEPLOYED**. Source `10f3edd5170709f292719520a2565c07896e3edc` merged through PR #390 as `713ef4342601f38ddca867e70a0708266da616a0`; CI and Vercel review passed and the exact production deployment succeeded.
- Ministry regression — **PASS**. `design-check`, typecheck, lint, 1,487 unit assertions in 227 files, production build (196 routes), and the full Playwright suite passed with 150 scenarios, one intentional skip, and zero failures. Focused Gate D unit coverage passed 27/27 and focused browser coverage passed 16/16.
- Production legacy route smoke — **PASS**. The root, mapped task/capture/career/memory/integrations children, deep links, and unmapped fallback all returned 307 to their fixed Workspace targets. Supplied query values were absent from every Location header.
- Production legacy API smoke — **PASS**. Exact API root plus GET, POST, PUT, PATCH, DELETE, OPTIONS, and HEAD returned 410 with `Cache-Control: no-store`, `Pragma: no-cache`, and `X-Robots-Tag: noindex`.
- Clock hosted package — **APPLIED/PASS**. The committed migration bytes match SHA-256 `05e100e3f5f2c7b041ba9bc1373912d9f26f4d8fbe125831f45ab7304dde85d2`; hosted migration `20260821191020_workspace_clock_preferences` created the non-null array, three defaults, and exactly-three constraint without changing the primary timezone column.
- Clock hosted persistence — **PASS**. A production authenticated-role transaction inserted and updated three independent selections, retained primary timezone `America/Chicago`, rejected an invalid two-clock array, and rolled back. Postflight confirmed the profile table returned to its original zero-row state.
- Legacy freeze — **APPLIED/PASS**. Hosted migration `20260821191057_legacy_command_center_write_freeze` created exactly seven statement-level INSERT/UPDATE/DELETE triggers. A no-row write-statement probe received SQLSTATE `55000` from every table. RLS and authenticated SELECT remained enabled, and all seven row counts remained unchanged.
- Workspace D2/clocks — **DEPLOYED**. Source `176557902e5f2096fb81135d636ec1b4c7f28b45` merged through PR #2 as `6b6f8867e3a3bca05207339b249857aa7dea5715`; the exact production deployment succeeded. All six stable Workspace routes returned 200 with the approved CSP and `nosniff` header.
- Workspace validation — **PASS**. Boundaries, 10/10 schema checks, typecheck, lint, 29/29 unit tests, build, sensitive scan, canonical RLS 25/25, and focused clock RLS 7/7 passed. The authenticated local visual/persistence coverage plus the hosted authenticated-role persistence transaction verify the deployed feature contract without modifying production preferences.
- Supabase advisors — **PASS for Gate D scope**. No new security advisory targets the clock preference, freeze function, Ministry Gmail token table, or frozen tables. Existing unrelated shared-project performance notices remain outside this cutover.
- Runtime error API — **UNAVAILABLE**. The Vercel runtime-error connector returned 403 for both team projects. Exact deployment status, public HTTP smoke, and database/log-independent invariants passed; the access limitation is carried into stabilization monitoring rather than treated as passing.
- Data/rollback — **PASS**. No legacy row, Workspace migrated row, upload, integration token, or production clock preference was changed by validation. The Ministry Gmail token count remains zero. The application rollback sources and seven-trigger database rollback are documented and viable.
- Stabilization — **ACTIVE**. Heartbeat `lead-emergence-stabilization-monitor` runs daily for 14 checks through the approved window and may perform only read-only deployment, HTTP-contract, database-invariant, Gmail-boundary, and available runtime-error checks. Cleanup remains separately approval-gated.
