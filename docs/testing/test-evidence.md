# Test evidence

## SOTF message-review append gate — 2026-10-09 (local only)

- Worktree `codex/networking-db-review-gate` at `ab2e33604d0139bca74ca765f03ca579c9ab0c8d` adds one forward migration and rollback-only synthetic pgTAP cases. No hosted migration or data write was performed.
- `npm run check:boundaries` — **PASS** (95 runtime files); `npm run test:schema` — **PASS** (32/32); `npm run typecheck` and `npm run lint` — **PASS**.
- `npm run test:unit -- --maxWorkers=1` with a task-local `TEMP`/`TMP` — **PASS** (29 files, 232 tests). The first run failed before loading any test because the sandbox denied Vitest temp-file renames.
- `supabase test db --workdir <isolated-validation-root> --local supabase/tests/database/sotf_operational_workflows.sql` — **PASS** (48/48) after `20261009031000_sotf_message_review_append_gate.sql` applied in a separate local project on port 56622. A read-only query found the gate in that project, not in the pre-existing shared local project; the synthetic review workspace retained zero events after pgTAP rollback. Initial sandbox attempts were blocked by CLI temp-file access and Docker isolation; the test ran with approved local escalation.
- `npm run build` — **NOT PASSED**: Next/Turbopack could not canonicalize this isolated worktree path (`Access is denied`); the one webpack retry could not create a `.next/server` directory (`EPERM`). Neither failure reported a source compile diagnostic.
- The unpublished scheduling migration `20261009032000_sotf_scheduling_reply_allowlist.sql` replaces the same function after this `20261009031000` gate. It must incorporate the gate before that branch is released; the scheduling branch was not changed here.

## Lewis Entry incremental-package tooling — 2026-08-28

This is source and read-only-target evidence only. It does not authorize or
represent a hosted migration, runtime deployment, Auth configuration change,
OAuth-provider activation, or external-provider connection.

- Active Entry read-only inventory — **PASS**. The intended project
  `lead-emergence-entry-dev` (`vnjdubrnmxvmsccxmhst`) has the identity and
  Workspace stack through the Phase 0 task RPC, a canonical MCP resource URI,
  and zero Workspace/private user records. It does not yet have the integration
  vault, capture-parity, or assistant-parity objects. No paused project or
  Consulting project was queried or changed.
- The deterministic incremental package selection — **PASS**. It contains the
  integration-vault prerequisite followed by the five reviewed Lewis parity and
  control migrations; it deliberately excludes the already-present foundation,
  Phase 0 task migration, and MCP-resource URI migration.
- `npm run test:schema` — **24/24 PASS**. The added contract checks the exact
  migration list, baseline function/absence checks, and schema-cache reload.
- `npm run check:boundaries`, `npm run typecheck`, `npm run lint`,
  `npm run test:unit`, and `npm run build` — **PASS**. Boundaries verified 53
  runtime files; unit tests are **66/66 PASS**; the production build compiled
  the Workspace OAuth, MCP, and controlled integration surfaces.
- `npm run test:rls` — **not rerun for package-only tooling**. The local
  Supabase database was stopped (`ECONNREFUSED` on local port 56422); no schema
  migration changed in this tooling-only update. The latest source migration
  evidence remains **185/185 PASS** above. Restart the local Supabase stack and
  rerun the suite before any source migration is modified further.
- `git diff --check` — **PASS**; Git reported only the repository's existing
  line-ending conversion warnings.

## Lewis shared-production foundation package — 2026-08-27

Historical evidence: [Lewis shared-production foundation package — 2026-08-27](test-evidence-history-2026-august.md#lewis-shared-production-foundation-package--2026-08-27).

## Lewis Phase 0 task actions — 2026-08-27

Historical evidence: [Lewis Phase 0 task actions — 2026-08-27](test-evidence-history-2026-august.md#lewis-phase-0-task-actions--2026-08-27).

### Preview deployment verification

Historical evidence: [Preview deployment verification](test-evidence-history-2026-august.md#preview-deployment-verification).

## Connection platform candidate — 2026-08-25

Historical evidence: [Connection platform candidate — 2026-08-25](test-evidence-history-2026-august.md#connection-platform-candidate--2026-08-25).

## Executed locally

Historical evidence: [Executed locally](test-evidence-history-2026-august.md#executed-locally).

## Not executed, with reason

Historical evidence: [Not executed, with reason](test-evidence-history-2026-august.md#not-executed-with-reason).

## Hosted Gate A evidence — committed, security-validated

Historical evidence: [Hosted Gate A evidence — committed, security-validated](test-evidence-history-2026-august.md#hosted-gate-a-evidence--committed-security-validated).

### Outstanding pre-deployment integration test

Historical evidence: [Outstanding pre-deployment integration test](test-evidence-history-2026-august.md#outstanding-pre-deployment-integration-test).

## Failures encountered and resolved locally

Historical evidence: [Failures encountered and resolved locally](test-evidence-history-2026-august.md#failures-encountered-and-resolved-locally).

## Command-center remediation — restored local validation (not a deployment approval)

Historical evidence: [Command-center remediation — restored local validation (not a deployment approval)](test-evidence-history-2026-august.md#command-center-remediation--restored-local-validation-not-a-deployment-approval).

## Gate C remediation deployment — automated acceptance

Historical evidence: [Gate C remediation deployment — automated acceptance](test-evidence-history-2026-august.md#gate-c-remediation-deployment--automated-acceptance).

## Next.js 16 security remediation — local candidate validation

Historical evidence: [Next.js 16 security remediation — local candidate validation](test-evidence-history-2026-august.md#nextjs-16-security-remediation--local-candidate-validation).

## Preview logout remediation — local validation

Historical evidence: [Preview logout remediation — local validation](test-evidence-history-2026-august.md#preview-logout-remediation--local-validation).

## Gate D clock candidate and production preflight — 2026-08-21

Historical evidence: [Gate D clock candidate and production preflight — 2026-08-21](test-evidence-history-2026-august.md#gate-d-clock-candidate-and-production-preflight--2026-08-21).

## Gate D production cutover — 2026-08-21

Historical evidence: [Gate D production cutover — 2026-08-21](test-evidence-history-2026-august.md#gate-d-production-cutover--2026-08-21).

## Goal C Personal productization candidate — 2026-08-22

Historical evidence: [Goal C Personal productization candidate — 2026-08-22](test-evidence-history-2026-august.md#goal-c-personal-productization-candidate--2026-08-22).

## Final Goal C synthetic cleanup — 2026-08-22

Historical evidence: [Final Goal C synthetic cleanup — 2026-08-22](test-evidence-history-2026-august.md#final-goal-c-synthetic-cleanup--2026-08-22).

## Real-client gate refresh — 2026-08-22 local / 2026-08-23 UTC

Historical evidence: [Real-client gate refresh — 2026-08-22 local / 2026-08-23 UTC](test-evidence-history-2026-august.md#real-client-gate-refresh--2026-08-22-local--2026-08-23-utc).

## Public landing route refresh — 2026-08-22 local / 2026-08-23 UTC

Historical evidence: [Public landing route refresh — 2026-08-22 local / 2026-08-23 UTC](test-evidence-history-2026-august.md#public-landing-route-refresh--2026-08-22-local--2026-08-23-utc).

## Entry-dev Workspace/Lewis bootstrap rehearsal — 2026-08-27

Historical evidence: [Entry-dev Workspace/Lewis bootstrap rehearsal — 2026-08-27](test-evidence-history-2026-august.md#entry-dev-workspacelewis-bootstrap-rehearsal--2026-08-27).

## Lewis internal Workspace-parity source verification — 2026-08-28

Historical evidence: [Lewis internal Workspace-parity source verification — 2026-08-28](test-evidence-history-2026-august.md#lewis-internal-workspace-parity-source-verification--2026-08-28).

## Lewis consumer-readiness source verification — 2026-08-28

Historical evidence: [Lewis consumer-readiness source verification — 2026-08-28](test-evidence-history-2026-august.md#lewis-consumer-readiness-source-verification--2026-08-28).

## Assistant connection parity verification — 2026-08-28

Historical evidence: [Assistant connection parity verification — 2026-08-28](test-evidence-history-2026-august.md#assistant-connection-parity-verification--2026-08-28).

## Consumer connector release-control verification — 2026-08-28

Historical evidence: [Consumer connector release-control verification — 2026-08-28](test-evidence-history-2026-august.md#consumer-connector-release-control-verification--2026-08-28).

## Resource-bound dynamic MCP admission source verification — 2026-09-01

This evidence is local-only. Dynamic MCP admission remains default-disabled in
the migration. It does not authorize a hosted migration, an Auth configuration
change, a Vercel deployment, or a real assistant connection.

- `npm run test:schema` — **26/26 PASS**. The added contracts require an exact
  Workspace MCP resource, public dynamic client with `none` token
  authentication, authorization-code plus refresh-token grants, S256 PKCE,
  `openid`, exact registered redirect URI, explicit private grant, and every
  disconnect-path revocation. They also reject Auth-catalog writes and raw
  subject/client values in the admission audit table.
- `npm run check:boundaries` — **PASS**; 53 runtime files have no Ministry or
  Consulting runtime import and no service-role client.
- `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build`
  — **PASS**. Unit coverage is **66/66 PASS**.
- `supabase db lint --local` and the local pgTAP command — **UNAVAILABLE**:
  this workstation has no Docker executable and no local Postgres listener at
  the configured local Supabase port. Neither command connected to the hosted
  project.
- `git diff --check` — **PASS**, apart from the repository's existing
  line-ending conversion warnings.

### Runtime-observability follow-up — 2026-09-01

- The stateless Streamable HTTP route now records only allowlisted, content-free
  lifecycle events after bearer admission: token admitted, connection
  registered, transport initialized, and tools-list completed. It inspects only
  JSON-RPC method names `initialize` and `tools/list`; it neither logs nor
  persists tool arguments or Workspace content.
- `npm run test:schema` — **26/26 PASS**; `npm run check:boundaries` —
  **PASS**; `npm run typecheck`, `npm run lint`, `npm run test:unit`, and
  `npm run build` — **PASS**. Unit coverage is **68/68 PASS**.
- Local database lint and pgTAP remain **UNAVAILABLE** for the previously
  recorded Docker/local-listener reason. No hosted action was performed.

### Provider-grant revocation follow-up — 2026-09-01

- Every Workspace-native disconnect already revokes the official user OAuth
  grant after the database disconnect. MCP self-disconnect and opaque
  assistant-connection disconnect now make the same supported Supabase OAuth
  revocation attempt after their database RPC has atomically revoked the
  Workspace authorization and private resource grant.
- A provider-revocation failure cannot restore access: the private grant is
  inactive and the access-token hook remains fail-closed. The MCP tool reports
  only the boolean `provider_grant_revoked`; it never returns a client ID,
  token, code, or callback value.
- `npm run test:schema` — **26/26 PASS**; `npm run check:boundaries`,
  `npm run typecheck`, `npm run lint`, and `npm run build` — **PASS**;
  `npm run test:unit` — **69/69 PASS**.

## SOTF invited-pilot clean release candidate — 2026-09-07

This evidence belongs to Workspace branch `release/sotf-pilot-rc`, created
directly from published `origin/main` at
`c4cfc1beb8b10cbecdc7c72bea447655928b4086`. The reviewed
`astra/sotf-indispensable` branch was used only as a file-level source; its
unpublished PC, auth-test, R5, and experimental foundation history is not RC
ancestry. No hosted migration, production deployment, live entitlement, real
invite, external send, auth configuration, or route cutover was performed.

- Final fresh `npm ci` — **PASS**, 464 packages installed from the lockfile and
  **zero vulnerabilities**. The first install exposed a high-severity
  `fast-uri` and moderate `qs` advisory through the pinned MCP SDK. npm's dry
  run established compatible lockfile-only updates; commit `73247e62` resolves
  them to `3.1.7` and `6.16.0`. Direct dependency ranges and application APIs
  did not change. `npm audit --omit=dev` is now **0 vulnerabilities**.
- Local `supabase db reset --local` — **PASS** after the final synthetic-fixture
  cleanup. The clean replay applies
  `20260902162536_bundle_entitlement_foundation.sql` followed by
  `20260906120000_sotf_operational_workflows.sql`, after published main.
- `supabase db lint --local --schema workspace,workspace_private,public
  --level warning --fail-on error` — **PASS**, no schema errors.
- `npm run test:rls` — **277/277 PASS** across nine pgTAP files. SOTF coverage
  includes active, absent, revoked, expired, wrong-Workspace, malformed MCP,
  unavailable-catalog, disconnected-client, plan, membership, and ordinary-RLS
  denial states. Revocation preserves ordinary Workspace access.
- `npm run test:bundle:local` — **PASS** against loopback Next.js and local
  Supabase: synthetic founder assignment, email-bound single-use invite,
  claim, idempotent retries, ordinary-user denial, invalid claim, entitlement
  revocation, and canonical resolution. The final database reset removed its
  fixed `.invalid` Auth fixtures.
- Final post-remediation `npm run check:boundaries` — **PASS**, 83 runtime files contain no Ministry or
  Consulting runtime import and no service-role client.
- Final post-remediation `npm run test:schema` — **31/31 PASS**, including entitlement-aware native/MCP
  presentation and explicit absence of protected PC and General P2.
- Final post-remediation `npm run test:unit` — **100/100 PASS** in 17 files. This includes exact-true
  MCP catalog admission, native/MCP bidirectional continuity, fresh-conversation
  recovery, duplicate/replay handling, uncertain-save identity, reviewed
  scheduling, and the sequential synthetic first-fellow golden path.
- Final post-remediation `npm run typecheck`, `npm run lint`, and `npm run build` — **PASS**. The
  production build includes SOTF native/API routes and the existing Entry SSO,
  callback, OAuth, and MCP routes without a route conflict.
- SOTF browser acceptance — **8/8 PASS** across desktop and mobile: six public
  preview cases plus two connected synthetic-session cases. It proves a
  criterion changes the recommendation, evidence/debrief/next-touch behavior,
  scheduling and manual invitation draft, no account API use in preview,
  reload continuity, and lost-save recovery. No external message or calendar
  invitation was sent.
- Initial browser launch with `127.0.0.1` against a `localhost` Next dev origin
  was rejected by Next's development cross-origin protection. The corrected
  same-origin rerun passed; no product code was changed to bypass the check.
- `git diff --check` — **PASS** after final documentation and source review.
- `npm run scan:sensitive` — **PASS** for the final RC working tree, 82
  release-lineage commits, and 511 unique reachable Git blobs;
  dependency/build/browser output is excluded by the scanner. Three exact,
  source-visible synthetic fixture sets are allowlisted. Real key, token,
  credential, connection-string, personal-identifier, and secret-like
  assignment patterns remain hard failures.

### Separate Entry landing acceptance

- Entry branch `astra/lead-emergence-front-door` was freshly fetched and remains
  based directly on published Entry `origin/main`
  `ef7fd32a573f2f03c0be24f50007ceed600406f2`. The branch diff against that base
  contains no login, callback, session, identity, chooser, handoff, OAuth,
  proxy, or database-owner file change.
- Fresh `npm ci` — **PASS**, 460 packages and zero audit vulnerabilities.
- `npm run test:unit` — **18/18 PASS**; `npm run typecheck`, `npm run lint`, and
  `npm run build` — **PASS**.
- Dedicated production browser acceptance — **10/10 PASS** across desktop and
  mobile. Every public sign-in CTA uses `/login`; the canonical Entry login has
  one credential form and defaults to `/workspaces`. The suite also passes
  decision-example behavior, optional playback, keyboard dismissal, media
  failure, reduced motion, data saving, mobile static hero, and overflow.
- Clean production measurement identifies the hero heading as LCP at **0.532 s
  desktop** and **1.024 s throttled mobile** (4× CPU slowdown, 1.6 Mbps, 100 ms
  RTT). Initial video requests are zero and mobile scroll requests no hero
  video. This resolves the reproducible local concern but is not a field or
  physical-device result; deployed-preview and physical-phone checks remain a
  production gate.

## 2026-10-04 — exact existing ChatGPT owner declaration (local implementation only)

- Scope: Workspace `ef17ae83-747b-4470-8dc5-08eeec86989f`, OAuth client
  `61940a73-fafe-4b96-ab8e-1de7d4cafbac`, connection
  `ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3` only; `other` to `chatgpt` plus
  guarded withdrawal. Owner declaration is the approved classification
  authority, not cryptographic host attestation. Claude and other connections
  are unchanged. No migration applied, deployment, production correction,
  new authorization grant, or business-tool invocation.
- Base: fresh Workspace origin/main `f0df1f0886614f959934eb00a3213c9c7d168d8f`.
  Runtime/SQL source matches last recorded deployed
  `e1409e634eaeeb3a25965c719cdf00871d41b429`; their difference is documentation.
  Current production deployment refresh is **UNAVAILABLE**: verified project/team
  metadata did not yield the deployment through the connected Vercel account;
  no installed Vercel CLI. Last recorded deployment is
  `dpl_9FPKE5tFhvP8B4aQeu6e8MJzgYYQ`, not freshly verified here.
- One authorized read-only target binding observation at
  `2026-10-04T11:52:55.064714+00:00`, `transaction_read_only=on`, using the
  existing scoped Supabase CLI against project `cirqqhuvzekbvysiyedg`.
  Query: `SELECT now(), current_setting('transaction_read_only'), contract_key,
  product_key, resource_uri, audience_uri, status, revoked_at IS NOT NULL
  FROM private.oauth_product_client_bindings WHERE client_id =
  '61940a73-fafe-4b96-ab8e-1de7d4cafbac'::uuid` inside `BEGIN READ ONLY` / `ROLLBACK`.
  Result: one row; contract/product `workspace`; resource/audience
  `https://workspace.leademergence.com/api/mcp`; `ACTIVE`; unrevoked. No customer
  payload or token fields read. These authority fields do not attest the host.
- Design refinement: owner-writable `product_events` cannot establish prior RPC
  execution. Use existing protected `audit_events` provenance with existing
  columns/permissions unchanged; no general audit writer accepts owner-supplied
  declaration metadata. Generic mutation audit only writes trigger event types.
  Withdrawal requires this RPC's latest confirmation for the exact actor/row/
  client, unchanged connection/revocation time boundaries, and currently active
  authority. Routine last-verification updates do not invalidate withdrawal.
- Direct-owner enforcement is server-side: non-null `auth.uid`, authenticated
  role claim, and existing `is_direct_session()` rejecting `client_id` or
  `workspace_mcp=true`; owner membership/capabilities and exact target identity
  are then checked. Absence from MCP discovery is not the authorization guard.
- Focused native UI/adapter tests — **11/11 PASS**. Full unit suite —
  **218/218 PASS**; typecheck, lint, boundaries and production build — **PASS**.
- Required schema contracts — **31/32 PASS**, one **PRE-EXISTING FAILURE**:
  `tests/schema-policy-contract.test.mjs:415` expects an inline
  `SOTF_PILOT_ENABLED` guard in `app/workspace/bundles/sotf/page.tsx`, which now
  delegates to `connected-experience`. Both files are unchanged from the base;
  the failure is unrelated to this patch and was not repaired.
- SQL behavior — **NOT TESTED**. Local-only rollback fixture:
  `supabase/tests/database/assistant_host_confirmation.sql`, with synthetic
  owners/content and a local shared-binding contract fixture. Docker/PostgreSQL
  engine unavailable and no existing `.github/workflows` isolated database CI.
  No database installed, new dependency/workflow added, or hosted substitute used.
  Required future command on an existing fresh isolated stack:
  `supabase test db --local supabase/tests/database/assistant_host_confirmation.sql`.
  The fixture covers direct/MCP denial, owner/target/transition restriction,
  audit forgery, inactive authority, invariance, idempotency and withdrawal.
- Integration risk: unmerged PR #10 changes distinct admission lifecycle
  functions on `mcp_authorizations`. This patch changes no PR #10 function/file
  implementation and never resumes status or grants. The shared validation
  document may require append-only reconciliation; independent security review
  and isolated SQL proof are still required before release readiness.
- Phase 1.3 remains **OPEN / NOT TESTED**. After separately approved release,
  production acceptance requires the designated host's `list_entitled_bundles({})`
  status `ok` plus entitled SOTF metadata, followed by the intended business read
  (`get_workspace_setup({})` with the exact Workspace and an items array).
  Local tests and metadata alone cannot close acceptance.
- Additional `npm run scan:sensitive` — **PRE-EXISTING FAILURE**, the unchanged
  synthetic `slice-d-local-test-secret-with-32-characters` assignment in
  `tests/personal-authority-projection.test.ts` and two historical blobs.
  Base inspection confirms the same assignment; no current patch finding.
- Isolated SQL runtime feasibility: a native PostgreSQL 15 runtime can run this
  SQL without Docker in principle (the repository config pins major version 15).
  It also needs pgcrypto, pgTAP, synthetic Supabase Auth/storage catalogs and
  auth.uid/auth.jwt helpers/roles, followed by the Workspace migration chain.
  The test supplies its own local-only shared binding catalog. No such prepared
  runtime is available here; this is source-based feasibility, not executed proof.

## 2026-10-04 — official isolated SQL run and fixture creator correction

- Official Supabase-stack [run 37203057687](https://github.com/abostwick12/lead-emergence-workspace/actions/runs/37203057687), verification commit `7f4734c9843b87e5899468a68584ccbb1a1ca25d`, copied frozen application source `e208fb7e87abfeb731fea9b15b40c1d894408eb6` without byte changes. PostgreSQL 15.19 started and all 36 Workspace migrations applied, including `20261004123000`; pgTAP creation succeeded.
- Fixture setup failed at `supabase/tests/database/assistant_host_confirmation.sql:33`: required `personal_onboarding.created_by` was omitted, causing NOT NULL violation and psql exit 3. **Zero security assertions executed; SQL behavior remains NOT TESTED.** Disposable-stack cleanup succeeded at `2026-10-04T12:45:11Z`; run failed closed. Retained evidence: `actions-proof-report.md`, `actions-test-output.txt`, `actions-applied-migrations.txt`, `actions-fixture.tap`, and `actions-run-37203057687.log` in the session's `phase1-pg-proof` evidence directory. Earlier manual native bootstrap stopped after two failures before Workspace SQL; that is separate from this fixture defect.
- First bounded correction for this fixture defect: add only synthetic `created_by=64111111-1111-4111-8111-111111111111`, matching the seeded owner, to the onboarding INSERT. Existing productization migration requires this creator. Application SQL, constraints, authorization functions and assertion meanings are unchanged. Remaining seed INSERTs were inspected against repository DDL; this inspection does not prove runtime behavior. No rerun was performed by the correction worker.
- Existing application evidence retained: focused tests **11/11 PASS**, full units **218/218 PASS**, typecheck/lint/boundaries/build **PASS**. Unchanged schema result **31/32** and pre-existing sensitive-scanner warnings/failure remain separately recorded above; no broad checks repeated for this seed-only correction.
- Independent source review at exact `e208fb7e87abfeb731fea9b15b40c1d894408eb6` found no concrete source defect; SQL behavior was not proved and concurrency evidence was source locks only. CodeRabbit completed that head with no actionable comments; its default docstring advisory is not an auth finding. Any new head requires fresh exact-head review.
- Draft PR #38 remains unmerged. No CI run, workflow edit, deployment, hosted database action or production mutation in this correction. Phase 1.3 remains OPEN; the corrected fixture awaits one separately assigned official-stack run.

## 2026-10-04 — official isolated SQL proof: 34/34 PASS

- [Run 37203639450](https://github.com/abostwick12/lead-emergence-workspace/actions/runs/37203639450) tested frozen application source `8d5c745e4262e943a40931c45b24602808b719ae` using verification workflow commit `9e42e8ab5f837cb28b5a6e67a94025fd9a8ec207`. PostgreSQL 15.19 started; all 36 actual Workspace migrations applied, including `20261004123000`. The unchanged fixture executed 34 assertions: final plan `1..34`, pass 34, fail 0, followed by transaction `ROLLBACK`. Disposable-stack cleanup succeeded at `2026-10-04T12:54:50Z`.
- Exact run evidence retained in session `phase1-pg-proof`: `actions-proof-report-37203639450.md`, `actions-run-37203639450.log`, `actions-test-output-37203639450.txt`, `actions-applied-migrations-37203639450.txt`, `actions-fixture-37203639450.tap`, and `phase1-db-proof-37203639450.yml`. Reviewed migrations/fixture were copied without byte changes. This proves sequential local SQL behavior only; concurrency remains source-reviewed locks, and production acceptance remains NOT TESTED.
- Attempt history remains: two stopped native bootstrap failures before Workspace SQL, one official-stack fixture setup failure for missing synthetic `created_by` (zero assertions), one bounded fixture correction, then this single passing official run. Earlier failure records above are retained.
- Existing application checks remain 218/218 units, 11/11 focused tests, typecheck/lint/boundaries/build PASS. Pre-existing schema 31/32 failure and sensitive-scanner issues remain unchanged; no broad checks rerun. This evidence-only update changes no application SQL, fixture, assertions or workflow. Draft PR #38 requires fresh exact-head review; no merge, deployment, hosted database action or production provider correction is authorized or performed. Phase 1.3 remains OPEN.

## 2026-10-13 — local Networking direct-entry check

- Isolated `codex/networking-direct-entry` worktree at Workspace main `aa69cb58031842b60b2eb1efe70bf102c54d207a`, with the local plain-copy branch merged. The new section uses the existing SOTF sign-in and entitlement gate. No production route or data changed.
- `npm run typecheck`, `npm run lint`, `npm run check:boundaries` (95 runtime files), `npm run test:schema` (32/32), and `npm run test:unit` (29 files, 239/239) passed. The focused route/access test passed 15/15 outside the Windows sandbox. Its first sandboxed invocation failed before collecting tests because Vitest could not rename a temporary transform-cache file (`EPERM`); that was an environment failure, not a source assertion failure.
- `npm run build` was attempted once outside the sandbox and failed before compiling application code: Turbopack could not resolve `next/package.json` from this nested isolated worktree. The package exists in the parent checkout's `node_modules`, but not under this worktree's own root. This is an isolated-worktree dependency-resolution limit, not proof of a route defect. No third build-path workaround was attempted.
- Production acceptance remains NOT TESTED. The observable is an eligible signed-in owner opening `/workspace/sotf/networking` and seeing the weekly metric cards near the top without changing the base SOTF Today route. A staged build and owner browser check still require separate publication/release decisions.
