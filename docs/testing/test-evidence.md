# Test evidence

## P14 native current-condition notifications — 2026-09-09

See [the P14 acceptance ledger](workspace-notifications-acceptance.md) and
[the notification authority boundary](../architecture/workspace-notifications.md).
Eight admitted update types use source-linked current conditions with durable
read/dismiss/snooze choices, type preferences, complete counts and exact retries.
No email, push, background delivery or live source verification is claimed.
All six bundles remain **NOT READY TO SHIP**; the ledger records local proof
separately from representative, installed-host and deployed release gates.

## P13 native connection evidence — 2026-09-09

See [the P13 acceptance ledger](workspace-connections-acceptance.md) and
[the connection authority boundary](../architecture/workspace-connection-center.md).
The native Connections route distinguishes actual grants, unfinished registration,
blocked/revoked access and saved credential metadata. Exact reviewed disconnects
have private retry receipts and explicit shared-family impact. Real local OAuth
and native database boundaries are tested; provider and installed-host readiness
are not inferred from saved labels. All six bundles remain **NOT READY TO SHIP**.


## P12 native shared attention — 2026-09-09

See [the P12 acceptance ledger](workspace-attention-acceptance.md) and
[the native authority boundary](../architecture/workspace-native-attention.md).
Workspace Experience 0.4.0 brings 22 admitted record/task scopes into a source-
linked native attention page and a confirmed user-owned Home widget. Actual
OAuth credentials cannot access the native cross-bundle view. Full counts,
filters, deep pages and exact task navigation have real isolated proof.
All six bundles remain **NOT READY TO SHIP**; the ledger separates local proof
from remaining representative, installed-host and deployed release gates.

## P11a large-library saved-work search — 2026-09-09

See [the P11a scale acceptance ledger](workspace-search-scale-acceptance.md).
A 15,000-record fictional owner library plus 500 other-owner controls preserves
all tested results while page-bound previews reduce broad-search work. Raw
before/after samples and response hashes are packaged with the ledger.
This is controlled local evidence, not measured client value or a production
latency guarantee. All six bundles remain **NOT READY TO SHIP**.

## P11 native saved-work search and quick actions — 2026-09-09

See [the P11 acceptance ledger](workspace-search-acceptance.md) and
[the native search boundary](../architecture/workspace-saved-search.md).
Sixteen saved-work scopes and ten navigation shortcuts are implemented.
Shared search remains native-only, with actual OAuth denial proof.
All six bundles remain **NOT READY TO SHIP**. The detailed ledger separates
verified outcomes, pending checks and remaining release gates.

## P10 user-owned Workspace layout — 2026-09-09

See [Workspace Experience layout acceptance](workspace-layout-acceptance.md)
and [the native layout boundary](../architecture/workspace-layout.md) for
the current sixth-bundle implementation, failure/recovery behavior, actual
HTTP/OAuth tests and final all-bundle browser ledger. Layout preferences are
separate from authority and open editor state. All six bundles remain
**NOT READY TO SHIP**; source publication is not a client release.


## P9f resumable availability and connected catch-up — 2026-09-09

**Implementation checkpoint, not client shipment. All six bundles remain NOT
READY TO SHIP.** Executive 0.5.0 adds user-reviewed availability snapshots and
conservative slot proposals. This checkpoint also executes the previously
pending P9d exact-task navigation and P9e weekly-history work.

### Implemented and boundaries

Private meeting snapshots retain offered/free/busy windows, check/source,
duration/buffer/zone and reviewed participants. Users explicitly apply a
proposed time or keep reviewed availability, then confirm the exact record.
Reopening never refreshes a historical check. Choosing rechecks age, context
and fit, clears reported agreement and marks the unsaved proposal inferred.
Edits invalidate checks/results. Manual-time and planner drafts independently
block save until applied/discarded; closing the planner preserves those edits.
Removing a snapshot requires a save and retains original revision history.

The reusable engine merges adjacent/overlapping windows before buffers and
subtracts conflicts. It handles submillisecond edges conservatively and offers
at most three chronological five-minute-grid alternatives. Each offered window
must work for all required attendees. Native entry handles repeated/gap hours
and preserves untouched saved instant precision. There is no connected calendar,
booking, invitation, independently verified availability or recurring worker.

Authorized Executive meeting reads/proposals and saved downloads include the
private snapshot; OAuth/native disclosures say so. Attention and weekly
projections exclude it. Canonical save, permissions, approval and full history
remain native-only. Skill-creation guidance kept assistant instructions aligned
with explicit checks, resumable context and proposal-only authority.

Connected testing exposed that Investor catalysts were unmounted behind the
Overview section. A matched task-navigation signal now opens Catalysts before
focus. Manual tab choices remain possible; a new hash or repeated same-page
link reopens the requested task. Missing/denied links do not select other work.
Unsaved questions survive these presentation changes; saved revisions do not change.

### Verified results

- PASS: source typecheck and 105 tests across 11 files; all six official plugin
  validations and all six skill validations.
- PASS: Workspace 281 unit tests in 29 files; 32 schema-policy checks; 251 runtime
  boundaries; typecheck; lint; optimized production build with 51 static pages.
- PASS: all 28 allowlisted transformed exports and SHA-256 hashes match pinned
  source f9f4614afb947ada637ba170ceb7890ac91ad495.
- PASS: restored the existing fictional 29-migration local database, then applied
  migrations 30 and 31 without reset. All 16 auth identities were fictional;
  non-fictional count was zero. This is upgrade proof, NOT fresh replay of all
  31 migrations. Docker was already working on a read-only recheck; no engine
  repair/restart, socket removal, factory reset or data reset was performed.
- PASS: 588 real PostgreSQL assertions in 18 rollback-only suites, including
  33 weekly and 13 availability assertions.
- PASS: eight Executive foundation/native groups, seven task-consent/source
  groups and five weekly-history groups. These exercise real schema parity,
  invalid nested inputs, private historical snapshots/removal, retry semantics,
  recorded/reported dates, correction/withdrawal classification, DST windows,
  metadata omission, cross-client denial and live permission revocation.
- PASS: thirteen actual Executive HTTP/OAuth/PKCE/MCP groups, including own
  meeting availability, narrow weekly parity, bounded source discovery, live
  revocation, native-only approval/history and disconnected credentials.
- PASS: other connected regressions — Writer 11, revisions 10, library/recovery 7,
  preparation 6, Ministry 10, Nonprofit 11, Investor 11 groups. With Executive:
  79 groups. No live SEC, provider or personal-account request was made.
- PASS: ten account-free desktop/mobile component-browser cases against actual
  meeting components. There is no fake API or database; in-memory remount is not
  persistence proof. The test runner owns/closes Vite cooperatively on Windows.
  Its existing Vite 8.2.2 is now explicitly declared/locked as a dev dependency;
  no application dependency version changed.
- PASS: corrected exact-task navigation, all 28 desktop/mobile cases, zero retries.
- PASS: all 116 optimized desktop/mobile all-bundle journeys, zero retries,
  completed in 5.7 minutes. Then final mobile task-spacing refinement passed
  all 28 affected navigation cases again in 1.0 minute, including explicit
  clearance below the sticky header. The full 116 were not rerun after that
  isolated spacing-only change. Final account-free component rerun: ten passes
  in 21.4 seconds; its server closed successfully.
- PASS: script syntax, whitespace, lockfile/dependency consistency and narrow
  changed-source credential-pattern checks. This is not a full privacy,
  dependency-vulnerability or all-history secret audit.

### Corrected attempts and evidence limits

Initial component attempt: six passes/four failures from test-clock drift and
default-dismissed manual-time confirmation. Fixed-clock tests and explicit
acceptance exercise the real UI. Initial Windows server cleanup hung; only its
verified owned process was stopped, then the runner was changed to close its
server cooperatively. Final component run: ten passes.

Initial full connected browser run: 106 passes/eight failures in 7.4 minutes.
Two failures used an ambiguous nonprofit summary selector that also matched
nested dependency headings. Six were the real Investor hidden-Catalysts bug.
The selector now targets the direct task heading; the native tab/navigation
fix and additional repeated-link/unsaved-edit tests passed all 28 navigation
cases in 1.2 minutes. The complete 116-case rerun passed in 5.7 minutes.
Visual review then found linked titles partly under the mobile header. Native
shell-aligned 210-pixel task clearance and stronger visibility assertions fixed
this; all 28 affected cases passed again after the final optimized rebuild.

The first Executive connected invocation completed but its terminal output was
lost to context truncation. A read-only process check verified it had ended;
the subsequent complete sequential connected run passed. No overlapping
capability-changing suites were started. Database checks are independent of
the account-free component harness and of synthetic UI response injections.

Four final component screenshots were reviewed. Initial weekly screenshots
exposed a loading-state capture; final browser capture now waits for actual
events and includes a readable event card and retained availability windows.
Images use fictional data only. Final weekly event/retained-window images were
reviewed on both viewports, plus task cards and final mobile task positioning.
A tall element screenshot can include the sticky header inside its capture;
actual viewport images and clearance assertions establish task-title visibility.
No representative user-value claim is made.

Post-test aggregate checks: 16 fictional users, zero non-fictional users, 31
migrations, zero disabled domain capabilities and zero Executive shared scopes.
Four active grants created by older suite runners in this acceptance run were
identified by timestamp, synthetic client name and exact fixture owner, then
disconnected via each owner's native RPC. Four pre-existing fictional grants
were left untouched; no new-run active grant remained. These older suites still
need universal finally-disconnect hygiene. This is a local test-runner limitation,
not evidence of a client connection or a production authorization bypass.
Both owned preview ports were verified closed. The named bundle-experience-p2
stack stopped successfully with backup=true; retained volumes/backups were not
removed. Docker itself was not stopped or repaired.

BundleContract 1.0, UIManifestContract 1.0, task-metadata-v1, attention response
2.0 and weekly response 1.0 remain unchanged. Only the Executive catalog/domain
contract moves to 0.5.0. Twenty scoped tools retain five proposal writes.

### Release status and next work

P9d/P9e environment-blocked notes below are historical, not a current repair
request. No hosted migration, main merge, production deployment, marketplace
submission, installed-host/provider/client connection or paywall activation
occurred. Source publication remains limited to the owned branches.

Next: implement shared
Workspace Experience controls/consumers that improve every bundle: user-owned
pin/hide/order/default choices, capability-scoped search/quick actions and clear
connection/recovery states. Continue Executive's approved recurring/notification
lifecycle and remaining rich ingestion, representative quality/utility,
installed-host, deployed recovery/privacy/retention and commercial release gates.

## P9e recorded weekly outcomes — 2026-09-09

**Source checkpoint only. All six bundles remain NOT READY TO SHIP.**

Executive 0.4.0 adds a bounded recorded-history projection, distinct from current
attention. Completions, corrections, reversals and reopened/removed outcomes
remain distinguishable. Inclusion uses recorded time in one to seven local days,
not a possibly backdated reported date. The native review explains coverage,
current versus historical state, partial pages and uncertainty; preparation is
unsaved/inferred and links current parents without copying private event titles.
Named zones persist. Earlier unzoned reviews remain valid and disclose fallback.
A read-retry button cannot submit an already-confirmed surrounding form.

- PASS: reusable source typecheck; 90 tests in 10 files (19 new weekly cases).
- PASS: all six official plugin validations and all six skill validations.
- PASS: host 275 unit tests in 28 files (8 new bridge cases); 32 schema-policy
  checks; 249 runtime boundary checks; typecheck; lint.
- PASS: optimized production build, with 51 generated static pages.
- PASS: all 28 allowlisted transformed exports and SHA-256 hashes match pinned
  source 9776d8979ab8739b1a9d9ee10dfc981591c7f6e8.
- PASS: syntax checks on both new/extended native and connected scripts;
  whitespace checks; narrow changed-source credential-pattern scan. This is
  not a full privacy assessment or all-history secret audit.
- COLLECTED ONLY: 52 desktop/mobile cases across Executive and task-navigation
  specs. Six new weekly cases cover historical/current state, preparation,
  persisted zones, paging, empty-versus-error states and retry without a save.
  P9d's 26 navigation cases remain unexecuted. Test collection is not proof.
- NOT RUN: migration 30 replay; five new weekly native groups; the new 33-
  assertion rollback-only SQL suite; the extended thirteen-group actual
  HTTP/OAuth/MCP suite; all affected connected/native/browser regressions.
- ENVIRONMENT: read-only engine check still fails after P9d's inaccessible Docker
  startup socket. No repair, restart, socket removal, factory reset, database
  reset, migration application, hosted connection or provider change occurred
  in this checkpoint. Data-preserving Docker repair approval remains separate.
- Corrected during development: malformed SQL JSON dollar quoting; a
  microsecond-parser escape; strict fixture fields; browser required-field
  labels; stale consent assertion/tool counts. Final static checks pass.
  Initial export audit passed all hashes but its second-repository Git lookup
  failed; rerun with a command-local exact safe-directory setting passed.

The new HTTP/MCP read uses current review admission and separately checks all
three Executive capabilities. It returns fixed metadata only, never full audit
bodies or foreign bundle history. Full native history remains denied to OAuth
clients. There are twenty scoped Executive tools and still only five proposal
writes. Tool annotations are descriptive, not permission. The source skill now
requires bounded history reads, explicit dates/zones and honest coverage.

BundleContract 1.0, UIManifestContract 1.0, task-metadata-v1 and attention response
2.0 remain unchanged; weekly response 1.0 is new. SQL schema/rule parity is
static evidence, not database execution. P9c's successful local connected tests
are historical and do not prove P9d/P9e. No installed-host or client-value proof,
main merge, hosted migration, production deployment, paywall activation,
provider/client connection or marketplace submission is implied.

Next: after approved data-preserving engine recovery, replay and verify all 30
migrations on the isolated fictional stack, then run the new native/SQL/HTTP/MCP
and desktop/mobile suites plus affected regressions. Continue the remaining
availability, recurring-work, shared Workspace Experience, recovery, utility,
privacy/retention, commercial and installed-host release gates.


## P9d navigation source checkpoint — 2026-09-09

Exact task-source navigation is implemented in the native host for all ten
Executive, Nonprofit and Investor task mappings. This is **partial source
progress, not a client-ready release**. P9c's connected evidence remains
historical and does not prove the new navigation behavior.

- PASS: 267 unit checks in 27 files (13 new mapping/fragment safeguards).
- PASS: 32 schema-policy checks; 247 runtime boundary checks; typecheck; lint.
- PASS: optimized build, including all 50 static pages.
- COLLECTED ONLY, NOT EXECUTED: 26 desktop/mobile task-navigation cases,
  including a saved source-link click, task focus/opening, hash changes/reload,
  missing/deleted tasks, unchanged saved revisions and denied access.
- NOT RERUN: connected HTTP/MCP, native database, RLS and existing browser
  regression suites. No database/API/permission/contract changes were made.
- ENVIRONMENT FAILURE: the isolated local stack could not start. Docker's
  backend reported an inaccessible local `sailor-ingest.sock` startup socket.
  Docker was started hidden for testing; no factory reset, socket removal,
  database reset, hosted access or provider connection was performed.
  Data-preserving repair approval was requested separately.
- Remaining UX limitations: signed-out return paths deliberately discard
  fragments; exact-task navigation currently targets an already authenticated
  editor. Historical weekly outcomes and grouped attention remain next work,
  not implemented by this checkpoint.

The added fragment is presentation only. The existing server authorization
still controls the source record; the helper validates capability/kind/item
combinations and scopes DOM focus to the loaded editor, never earlier history
or proposals. No automatically saved work or new assistant authority is added.
Reusable exports, BundleContract 1.0, UIManifestContract 1.0, Executive bundle
0.3.0, attention response 2.0 and task-metadata-v1 consent remain unchanged.
All six bundles remain NOT READY TO SHIP.

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

- Immediate shared-target preflight — **PASS**:
  `eligible_for_foundation_package: true` on
  `cirqqhuvzekbvysiyedg` (`emergence-ministry-platform`).
- Exact seven-migration package application — **PASS**:
  `20260827161000_workspace_productization`,
  `20260827161100_workspace_first_capture_event`,
  `20260827161200_workspace_private_rls`,
  `20260827161300_workspace_advisor_performance`,
  `20260827161400_workspace_mcp_oauth_session_client`,
  `20260827161500_workspace_mcp_production_resource`, and
  `20260827161600_workspace_lewis_phase0_task_actions` all applied through
  the Ministry-owned authority package.
- Shared package postflight — **PASS**. Canonical MCP resource, Workspace and
  private schemas, required tables/functions, profile/membership changes,
  private task receipts, provider database configuration, hook grant boundary,
  task-RPC privileges, disabled external-connector capability, and zero
  integration limit all match the reviewed package contract.
- Shared access-control package assertion — **PASS**:
  `workspace_shared_production_foundation_access_controls_verified: true`.
- Shared advisors — **PASS for new actionable Workspace findings**. Security
  reports only four intentional private-table RLS-with-no-policy INFO notices;
  performance reports fresh unused-index INFO notices. No Workspace-scope
  security warning or error was introduced or remediated outside package scope.
- Not run / not claimable: Vercel runtime/environment switch, saved shared Auth
  hook or custom Entry provider, real ChatGPT/Claude OAuth lifecycle, task
  mutation through a real assistant, identity/data continuity or migration,
  and connector OAuth. A public metadata check still advertises
  `nhkugzifuapplwpnfpbt` rather than the shared project, so this database
  success does not yet make Lewis task writes live.
- Shared Auth/OAuth dashboard inspection — **BLOCKED AS CONFIGURED**. The OAuth
  server and dynamic registration are enabled with `/oauth/consent`, but its
  current Site URL is `https://www.leademergence.com`. That host is the
  Ministry app and returns Ministry-owned 404 metadata; the canonical Workspace
  host is the one that serves the consent route. No shared custom Entry
  provider or Auth hook exists yet. No setting was changed during inspection.

## Lewis Phase 0 task actions — 2026-08-27

- `npm run check:boundaries` — **PASS**. Verified 52 runtime files with no
  Ministry/Consulting runtime import or service-role client.
- `npm run test:schema` — **PASS** (17/17). The migration contract covers the
  private idempotency receipt store, task capability guard, task RPCs, and
  least-privilege grants.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run test:unit` — **PASS** (11 files / 59 assertions), including an
  in-memory MCP client contract for task reads/writes, confirmation checks,
  OAuth reauthorization metadata, and exact-origin CORS behavior.
- `npm run test:rls` — **PASS** (107 local pgTAP assertions across four
  files). The Phase 0 task cases verify capability denial, tenant isolation,
  idempotent create/replay protection, owned-task update, permanent deletion,
  and unauthorized-client denial.
- `npm run build` — **PASS** on Next.js 16.3.2. The MCP route compiled as a
  dynamic route.
- `npm run scan:sensitive` — **PASS**. No credential, token, private key, or
  personal-data pattern was introduced by the release.
- `git diff --check` — **PASS**.
- Hosted migration, production Vercel promotion, and real ChatGPT/Claude
  acceptance are **NOT RUN**. Read-only target preflight found a material
  runtime split: shared production `cirqqhuvzekbvysiyedg` lacks the existing
  MCP foundation, while the public endpoint declares the isolated Personal
  sandbox `nhkugzifuapplwpnfpbt` as its OAuth authority. A target-specific
  cutover decision is required before either database can be changed.

### Preview deployment verification

- Vercel Preview `dpl_CxFhaf5fzG7JNi4kpxGY35sHteto` is **READY** at
  `https://lead-emergence-workspace-dej2dhpfy-emergence-projects.vercel.app`
  from the `fix/lewis-phase0-foundation` branch.
- Protected Preview CORS smoke checks — **PASS**: `https://chatgpt.com`
  receives `204` and its exact origin; `https://untrusted.example` receives
  `403 {"error":"origin_not_allowed"}`. No credentials or Workspace data were
  sent.
- Preview error-level Vercel logs — **PASS**: no logs found after the smoke
  checks.
- Authenticated task-tool acceptance is intentionally **NOT RUN** until the
  approved shared-hosted migration has been applied; a Preview app alone must
  not be used to exercise unavailable task RPCs.

## Connection platform candidate — 2026-08-25

- `npm run check:boundaries` — **PASS**. No Ministry/Consulting import or service-role runtime client.
- `npm run test:schema` — **PASS** (11/11), including the private integration credential vault and owner-scoped bridge contract.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run test:unit` — **PASS** (35 assertions), including all 14 catalog entries and AES-GCM credential binding.
- `npm run build` — **PASS**. The connection start, callback, and compact API-key routes compile as dynamic handlers.
- `npm run scan:sensitive` — **PASS**. No credentials or personal fixtures were added.
- Live provider OAuth, GitHub App installation, Logos OAuth 1.0a, YouVersion registration, and hosted migration/RLS verification are **not run**: provider registrations and server-only credentials have not been supplied, and applying the hosted migration remains gate-controlled.

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

- Approved framework/tooling target installed: `next@16.3.2`, `eslint-config-next@16.3.2`, `eslint@9.39.5`; React and React DOM remain `18.3.1`. The Node engine is pinned to the validated Vercel runtime, `24.x`.
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

## Goal C Personal productization candidate — 2026-08-22

This is candidate evidence only. On 2026-08-22 the user separately authorized,
and the designated Supabase authority applied, the two exact sandbox-only advisor
migrations recorded below. The user also authorized the isolated Preview provider,
synthetic acceptance identities, and OAuth consent setup used below. No additional
hosted migration, PR merge, Production deployment, real-user activation, billing,
paid capacity, or cutover is authorized by this evidence.

- Fresh isolated Workspace database rebuild with `supabase db reset --local --no-seed` — **PASS** after final acceptance cleanup. All seven current migrations applied from scratch. The two authorized advisor migration SHA-256 values are `7B72E6B3BE7DCD4EC2C521C8287292EDEAA802B2621E851E2D4C90B82A2D99A6` and `C13031D9C3567E2A7CFE0CEC5BA73BC890A0364C4029717749273700D2ABA4A8`. The Workspace repository was never linked to a hosted project and did not use `db push` or migration repair.
- `npm run check:boundaries` — **PASS**; 43 runtime files contain no Ministry/Consulting import or service-role client.
- `npm run test:schema` — **15/15 PASS** for schemas, RLS/policies, Entry provisioning, shared setup, MCP audience/isolation, plan separation/enforcement, sign-out/return paths, Storage, clocks, and private-table defense in depth.
- `npm run test:unit` — **40/40 PASS** in seven files on `vitest@4.1.11`, including capability state, MCP resource URI, catalog, return-path, domain, time-zone, and final native-setup persistence contracts.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run build` — **PASS** on Next.js `16.3.2`. Static product routes, dynamic Entry/OAuth/MCP routes, protected-resource metadata, and Proxy compiled successfully.
- `npm run test:rls` — **93/93 PASS** across four pgTAP files: the canonical cross-tenant/cross-product/Storage suite (25), clock preferences (7), productization (56), and content-free product events (5). Coverage includes active/suspended/excluded/enabled capabilities, retained data, direct API denial, MCP bypass denial, wrong audience, disconnect/reconnect epoch, cross-user plan/config/MCP isolation, controlled onboarding, canonical Entry reconciliation for an existing owner, client-authored connector-state denial, revoked-membership non-reactivation, private-table RLS, and exactly-once first-capture analytics without private content.
- Local `supabase db lint --schema workspace --schema workspace_private --level warning --fail-on error` — **PASS**, no schema errors.
- Final Playwright acceptance after the final-step repair — **10/10 PASS in 42.5 seconds** with fresh disposable local users: desktop and Pixel-class mobile public login; AI failure fallback; native save/resume/completion; persistence of existing systems, starting capabilities, and Daily Brief from the final step; AI-to-native and native-to-AI switching with confirmed data retained; first value; returning-user bypass; useful no-connection and empty states; and suspended-plan locked states with retained data. Page-error and HTTP 5xx monitors observed none, and teardown confirmed zero fixture users remained. A separate hosted public run passed **4/4** executed desktop/mobile accessibility cases with six authenticated cases intentionally skipped because no credentials were placed in the process environment.
- Focused accessibility acceptance after the targeted refinement — **4/4 PASS** against the production build on desktop and Pixel-class mobile. Browser assertions verify first-entry keyboard order/focus, explicit product alert semantics, 44px primary/rollback touch targets, and measured WCAG 4.5:1 contrast for the primary action and supporting copy. The refinement also raises low-emphasis shell labels and compact workflow controls to the same contrast/touch baseline without changing the approved layout or design system.
- `npm audit --json` — **PASS, 0 findings** across the full production/development tree after upgrading Vitest. The prior five development-only Vitest/Vite findings (three moderate, one high, one critical) were removed.
- `npm run scan:sensitive` — **PASS** across the preserved repository history and the authored working tree, excluding dependency/build output. No credential, token, private key, connection string, email, or Personal-data pattern was found.
- `npm run schema:checksum` — **PASS** for the preserved foundation/Gate A source checksums.
- `git diff --check` — **PASS**; line-ending conversion warnings only.

Entry-side local evidence for the separate Personal SSO change:

- typecheck, lint, and production build on Next.js `16.3.1` — **PASS**;
- unit tests — **15/15 PASS**, including unique client and callback product mapping that fails closed on configuration collision;
- local Entry database lint — **PASS**, no schema errors;
- Entry pgTAP — **44/44 PASS** across entitlement administration, self-only identity read API, and canonical identity RLS;
- `npm audit --json` — **PASS, 0 findings**.
- sensitive-data scan — **PASS** across preserved Entry history and the authored Entry working tree; no secret was found.

PR, Preview, and canonical-domain evidence:

- Workspace PR [#4](https://github.com/abostwick12/lead-emergence-workspace/pull/4), accepted application head `eb13329235bae497d2a7fe90d209d9033ccdfcb9` with runtime fix `bc08ade88f2f3425fbad10f7544cef5c96c12a30` — **OPEN; VERCEL/PREVIEW COMMENTS SUCCESS**. Deployment `dpl_A9FDQpTZR9PRNQ53bqxaxDUu2nDP` is READY at `https://lead-emergence-workspace-hnrs7cpfw-emergence-projects.vercel.app`, built from the exact accepted application head. The exact RLS and performance migrations remain applied and postflight-validated on the Personal sandbox only. No GitHub Actions workflow exists in this repository; required checks were executed locally before push.
- Workspace protected branch Preview `https://lead-emergence-workspace-git-product-498b3c-emergence-projects.vercel.app` — **BUILD/ONE-LOGIN/AUTHENTICATED NATIVE LIFECYCLE/MOBILE/MCP METADATA PASS; REAL-CLIENT MCP ACCEPTANCE REMAINS**. The build uses the isolated Personal sandbox and advertises the exact stable Preview MCP resource plus `https://nhkugzifuapplwpnfpbt.supabase.co/auth/v1`. A synthetic ACTIVE Entry entitlement completed Entry → Workspace SSO with no second password and proved first entry, AI-first setup choice, ChatGPT/Claude instruction and failure-fallback screens, native setup, save/resume, native-to-AI, AI-to-native, first-value Home, returning-user bypass, plan display, downgrade-safe retention, no-connector usefulness, and Quick Capture persistence. The final optional-field ordering defect found during hosted acceptance is repaired in `bc08ade`. A fresh authenticated run on immutable deployment `dpl_A9FDQpTZR9PRNQ53bqxaxDUu2nDP` proved the repaired `Save and begin using Workspace` action, persisted all ten active configuration areas including `existing_systems`, `starting_capabilities`, and `daily_brief`, reached first-value Home, and returned directly to Home on a fresh `/workspace` navigation. The exact temporary immutable callback was removed immediately afterward; the durable branch callback remains the sole Preview redirect. The two disposable direct-login users and their exact synthetic Workspace were then removed, with zero fixture users/Workspaces and zero disabled audit triggers remaining.
- Entry PR [#2](https://github.com/abostwick12/lead-emergence-entry/pull/2), head `7a6124c56eb5d913e993c641937d2313980f5ad5` — **OPEN, CLEAN, ALL CHECKS SUCCESS**. The intentionally paused Production project is disconnected from Git so PR pushes cannot create production-classified builds; the dedicated non-production Preview project now owns the green Vercel status. Workflow run `32575170691`, job/check `97036335300`, passed application verification, isolated Supabase startup, schema lint, 44 pgTAP assertions, browser password-recovery acceptance, evidence upload, and disposable database cleanup. The runtime source pins Node from `>=24` to `24.x`; local typecheck, lint, 15/15 unit tests, production build, lock dry-run, full audit, and diff check also pass.
- Entry branch Preview `https://lead-emergence-entry-sso-preview-git-45c287-emergence-projects.vercel.app` — **BUILD/PUBLIC ENTRY/JWKS/OAUTH/ONE-LOGIN PASS**. Deployment `dpl_3J8etcvZMYcStAyXRVh6MyZHSc9G` is READY at `https://lead-emergence-entry-sso-preview-m3y8fxy9r-emergence-projects.vercel.app`; Next.js `16.3.1` compiled and type/static generation passed on Node `24.x`. Entry OAuth app `Lead Emergence Personal Workspace (preview)` uses the exact Personal Supabase callback; public client ID `80b81602-59c8-4d57-9d7f-6be0faf277f0` is present only in Entry Preview configuration, and its secret is stored only in the Personal provider. A synthetic Entry identity with ACTIVE Personal eligibility completed the product chooser and Workspace SSO without a second credential prompt; the two Goal C Entry identities were removed in final acceptance cleanup.
- Dedicated Entry Vercel authority — **PROJECT/DNS/TLS/BASE CONFIG PASS; PROJECT PAUSED/GIT DISCONNECTED**. Project `lead-emergence-entry` (`prj_Sjv0ZfqFzf7dOOime4bEWZukmaCD`) retains its eventual `main` production-branch setting and Next.js/Node `24.x` configuration, but automatic Git deployment is intentionally disconnected until cutover authorization. Cloudflare Domain Connect installed a DNS-only project-specific CNAME and verification TXT record; Vercel reports `https://entry.leademergence.com` configured correctly and verified, and Cloudflare's public resolver returns the project-specific CNAME. Exact public Production origins plus a new environment-specific RSA handoff keypair/redemption secret are stored in Vercel; Supabase credentials and OAuth client IDs remain absent. The first Git build, deployment `dpl_9Ys7K8fSZHwEnqa5gdpwGgAByzSe`, was classified automatically as Production and assigned the new aliases before the project was paused. The hostname-valid HTTPS probe returns HSTS plus `503 DEPLOYMENT_PAUSED`. Reconnect Git only as part of the explicitly authorized production-cutover procedure.
- Canonical baseline `https://workspace.leademergence.com` — **PASS**. DNS resolves by CNAME to Vercel, TLS 1.3 serves a valid hostname-matching Let's Encrypt certificate, root/login return the correct Workspace application, HSTS/CSP/frame-denial/nosniff headers are present, and browser inspection found no console warning or error.
- Rollback `https://lead-emergence-workspace.vercel.app` — **AVAILABLE/PASS**. Root/login return the correct existing Workspace application with the security headers above and no browser console warning or error. It has not been removed or repointed.
- Vercel environment separation — **PASS for readable non-secret origins**. Workspace Preview `NEXT_PUBLIC_APP_URL` and `WORKSPACE_MCP_RESOURCE_URI` use the branch Preview origin. Workspace Production uses `https://workspace.leademergence.com` and `https://workspace.leademergence.com/api/mcp`. Entry Preview `PERSONAL_PRODUCT_URL` uses the Workspace branch Preview and `APP_ORIGIN` uses its stable branch-only Entry alias. Existing Development/rollback addresses were preserved. Vercel classified the Entry Personal callback setting as sensitive, so its successful API update is recorded without plaintext readback or logging.
- Vercel runtime logs — **PASS for both inspected runtime-bearing Previews**. Authenticated, bounded Workspace logs for the runtime-fix deployment and final PR-head deployment `dpl_A9FDQpTZR9PRNQ53bqxaxDUu2nDP` reported warning `0`, error `0`, fatal `0`, ordinary 200/304/307 responses, and no 5xx after acceptance. Entry's accepted Preview likewise reports zero error-level or 5xx events.
- Runtime pin — **PASS**. `package.json` now declares Node `24.x`, matching the authenticated Vercel project/deployment runtime and avoiding an unreviewed future major auto-upgrade. ESLint remains `9.39.5`: the registry marks it unsupported, but upgrading to `10.9.0` makes the installed Next `16.3.2` lint tree invalid because bundled `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react` peer ranges stop at ESLint 9. The forced upgrade was rejected; `npm ls eslint --all --depth=1` is clean on 9.39.5. A future Next/plugin-compatible ESLint 10 update remains maintenance work, not a readiness bypass.

Hosted Supabase and OAuth readiness evidence:

- Shared production project `cirqqhuvzekbvysiyedg` remains ACTIVE_HEALTHY. Its migration history ends at `20260821191057_legacy_command_center_write_freeze`; the Goal C migration is absent. Read-only counts and inspection show the prior Gate A/Gate D Workspace baseline only. No hosted migration or data mutation was performed.
- Meridian sandbox `lpqgjnuvfvuuashcmlxq` is **INACTIVE/PAUSED WITH DATA PRESERVED**, exactly as authorized. Personal sandbox `nhkugzifuapplwpnfpbt` is **ACTIVE_HEALTHY**. The shared production project `cirqqhuvzekbvysiyedg` and Consulting deployment remain unchanged.
- Personal hosted migrations are **APPLIED/PASS**: `20260822121537_workspace_foundation`, `20260822121608_workspace_clock_preferences`, `20260822121616_workspace_productization`, test-only `20260822122741_enable_pgtap_acceptance`, `20260822123401_expose_workspace_data_api`, `20260822124349_workspace_first_capture_event`, authorized `20260822135401_workspace_private_rls`, and authorized `20260822135407_workspace_advisor_performance`. The latter two exactly match committed files `20260822132000_workspace_private_rls.sql` and `20260822133500_workspace_advisor_performance.sql`; Supabase assigned the hosted ledger versions at application time. The cross-product Gate A hardening package was not applied because its only effect targets a Ministry-owned `public` policy that is absent and inapplicable in this isolated sandbox; the Supabase safety guard rejected that mutation.
- Post-migration hosted transactional pgTAP is **91/91 PASS**: 56 productization/plan/MCP/private-table assertions, 23 Workspace-only hostile cross-user/private-Storage assertions, 7 clock assertions, and 5 content-free first-capture analytics assertions. The hosted-safe hostile variant intentionally omits synthetic Ministry table/bucket creation while retaining every Workspace-owned isolation case. All fixtures rolled back.
- Private-table postflight is **PASS**. `workspace_private.product_settings`, `workspace_private.trusted_identity_providers`, and `workspace_private.plan_assignment_audit` all have RLS enabled; `anon` and `authenticated` have neither schema usage nor table DML privileges. Policy-free RLS is intentional on these server-owned, unexposed, grant-revoked tables, so the three corresponding security-advisor INFO notices require no client policy.
- Personal performance-advisor postflight is **PASS for Workspace actionable findings**. Workspace `auth_rls_initplan` findings fell from 51 to zero, Workspace uncovered-foreign-key findings fell from 40 to zero, and a direct catalog query reports zero uncovered Workspace/private foreign keys. The advisor now reports only unused-index INFO notices for Workspace/private (48) because the 40 new covering indexes and 8 previously unused indexes have no representative workload history on this fresh sandbox; none is removed before real workload evidence. One uncovered foreign key and eleven unused indexes remain in unrelated `public` scope.
- Personal security advisors now report the three expected private-table no-policy INFO notices, two unrelated `public` no-policy INFO notices, one pre-existing `public.current_ministry_id()` warning, and leaked-password protection disabled. No security finding targets exposed `workspace` data or Workspace Storage. Advisor remediation references are [RLS with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [security-definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Hosted log postflight is **PASS for the migration window**. The two migration timestamps contain only PostgreSQL `LOG` entries and no `ERROR`, `FATAL`, or `PANIC`; the latest 100 API and Auth records contain zero 5xx responses, and Storage reports no error-level event. Tokens and Personal content were not printed or copied into evidence.
- Entry Preview `ENTRY_PERSONAL_OAUTH_REDIRECT_ORIGIN` targets `https://nhkugzifuapplwpnfpbt.supabase.co`. Workspace Preview has `ENTRY_OIDC_PROVIDER=custom:lead-emergence-entry-workspace-preview`. The Entry OAuth app, client-ID configuration, Personal custom provider, OAuth server/dynamic registration, access-token hook, and signing authority are complete for the isolated Preview. Personal Auth logs record the successful provider redirect, callback, and session. No secret was printed or committed.
- Entry production identity authority — **BACKEND NOT PROVISIONED**. The intended `Lead emergence sandbox` Free organization actually contains two active projects—`lead-emergence-consulting-dev` and `lead-emergence-entry-dev`—so there is no second Free slot. The Management API creation attempt failed without creating or charging anything. Pausing or repurposing Consulting is not authorized; a different organization, paid slot, or separate approved disposition is required.

Not executed or not claimable at this checkpoint:

- real ChatGPT/Claude connect/use/refresh/disconnect/reconnect/revocation — the Preview OAuth/provider contract and controlled consent screen are proven, but completing a real assistant client's interactive OAuth flow remains required;
- production Entry Supabase authority — partner-backed capacity is not yet verified, and no paid project or Meridian repurpose is authorized;
- productized custom-domain authenticated acceptance — Preview native lifecycle is proven, but the production candidate cannot be exercised before the distinct Entry backend and explicit production-cutover approval;
- external connector connect/use/refresh/disconnect/reconnect — catalog entries have no approved runtime adapter in this release.

## Final Goal C synthetic cleanup — 2026-08-22

- Supabase Auth administration removed exactly the two reserved Goal C Entry
  development identities. Post-delete SQL verification reports zero matching
  Auth users, sessions, refresh tokens, identity profiles, product entitlements,
  product links, handoff nonces, or audit-event subject references.
- Personal sandbox inspection at this checkpoint reported zero rows in every
  user/tenant Workspace table, including Workspaces, memberships, Personal
  onboarding, configuration, plans, MCP authorizations, and product events.
- Personal Supabase Auth retains zero OAuth clients and zero OAuth consents. The
  environment-specific custom Entry provider remains because it is required by
  the accepted Preview and contains no user or grant.
- No earlier Consulting/Goal A fixture, real user, Ministry project, production
  project, plan, credential, or Vercel deployment was changed by this cleanup.
- Current Personal advisors still show no actionable finding against exposed
  Workspace data or Workspace Storage. The three private-schema no-policy INFO
  findings remain intentional deny-all defense in depth; unrelated inherited
  `public` findings and leaked-password protection remain documented.

## Real-client gate refresh — 2026-08-22 local / 2026-08-23 UTC

- The available ChatGPT session reached the signed-out ChatGPT page. The
  available Claude session initially rendered its application shell but then
  resolved to Claude's login page. No connected Chrome or Edge session was
  available. No assistant account was created, no assistant setting changed,
  and no client grant was created.
- To prove the isolated fixture path was ready, one reserved `.test` Entry user
  was created, auto-confirmed, assigned one audited ACTIVE Personal entitlement,
  and independently verified. Because neither real client was signed in, the
  user was deleted immediately. Final SQL verification reports zero matching
  Auth users, sessions, refresh tokens, profiles, entitlements, product links,
  handoff nonces, or audit-subject rows.
- Live Preview protocol checks returned exact protected-resource metadata with
  the branch MCP resource and Personal Auth server; unauthenticated MCP `POST`
  returned `401`, `no-store`, and the matching `WWW-Authenticate` metadata URL;
  ChatGPT and Claude preflights each returned `204` with only their exact
  origin. Personal authorization-server metadata advertises dynamic
  registration, authorization-code and refresh-token grants, PKCE, user-info,
  and JWKS.
- `docs/runbooks/real-client-mcp-acceptance.md` now fixes the operator-assisted
  lifecycle and content-free evidence procedure. Real connect, use, natural
  token refresh, Workspace disconnect, old-bearer denial, reconnect, and
  client-side revocation remain `NOT RUN` until the operator signs in to the
  exact assistant test accounts or explicitly approves a deferral.
- A final broad Personal inventory contradicted the earlier zero-Auth summary
  by surfacing two older deterministic-ID fixtures:
  `personal-sandbox-one@lead-emergence.test` and
  `personal-sandbox-two@lead-emergence.test`. Both were created on 2026-08-12,
  last signed in that day, and have explicit Personal Sandbox profile names.
  Together they retain six stale sessions, six refresh-token rows, and two
  inherited `public.platform_user_profiles` rows whose foreign key is
  `ON DELETE CASCADE`. They have zero Workspace, membership, Personal plan,
  onboarding, MCP authorization, OAuth authorization/consent, journey, or
  private-plan-audit rows. They are synthetic but not yet removed: the signed-in
  Dashboard account exposes only the separate `Lead emergence sandbox`
  organization and redirects away from the `EMERGEnce`-owned Personal project.
  Connector access is read-only. No deletion or configuration mutation was
  attempted through an inappropriate migration path.

## Public landing route refresh — 2026-08-22 local / 2026-08-23 UTC

- Current `https://www.leademergence.com` serves the seven-stage Emergence
  Roadmap redesign. The missing-production issue is no longer the visual design
  itself; the live page still routes Personal to the legacy Ministry
  `/login?space=personal` and `/personal/register` paths and uses the older
  Consulting role query links.
- Ministry PR [#391](https://github.com/abostwick12/emergence-ministry-platform/pull/391)
  is open, clean, and green at head
  `af7be4a64264591a4b7ed38b5351b8818218b8f7`. Its READY Preview preserves the
  redesign and routes Personal to `workspace.leademergence.com/login`, account
  creation to `entry.leademergence.com/signup`, and Consulting to its reviewed
  consultant/client return paths.
- The landing repair remains intentionally unmerged. Entry, then Workspace,
  must be production-ready before the public landing becomes the final routing
  switch; otherwise the repaired calls to action would send users to a paused
  Entry destination or a pre-productization Workspace.

## Entry-dev Workspace/Lewis bootstrap rehearsal — 2026-08-27

- Read-only target preflight on partner-backed Entry development project
  vnjdubrnmxvmsccxmhst returned
  eligible_for_entry_dev_bootstrap: true. The target identity schema existed;
  Workspace schemas, Workspace bucket, provisioning function, and task RPCs
  were absent before the rehearsal.
- Nine reviewed migrations applied through the Ministry-owned package path:
  Workspace foundation, coexistence hardening, clock preferences,
  productization, first-capture event, private RLS, advisor performance, MCP
  session-client handling, and Lewis Phase 0 task actions. The hosted migration
  history confirms all nine exact target names.
- Postflight confirmed Workspace schemas, private Storage, RLS, private task
  receipts, anonymous task-RPC denial by privilege inspection, authenticated
  task-RPC grants, disabled external-connector capability, zero integration
  limit, restricted Auth-hook grant, and preserved Entry identity tables.
- Not run: the direct SET ROLE anon access-control script. The hosted SQL
  executor does not have permission to switch to anon; this is an executor
  limitation, not a failed authorization assertion. The equivalent privilege
  checks passed.
- Not run: workspace_mcp_production_resource and
  workspace_integration_vault. The hosted migration safety control rejected
  the former's development-to-live OAuth-audience alignment and the latter's
  connector credential/OAuth-attempt storage. No workaround was attempted.
  Real ChatGPT/Claude acceptance, Auth hook/provider configuration, Vercel
  routing, connector OAuth, and user/task migration remain out of scope.

## Lewis internal Workspace-parity source verification — 2026-08-28

This is source and local-test evidence only. It does not authorize or record a
hosted migration, Vercel deployment, Auth configuration change, OAuth-provider
activation, connector authorization, or user-data migration.

- Added source migration `20260828000252_lewis_workspace_parity_actions`.
  It adds narrow, tenant-scoped MCP RPCs for Quick Capture resolution/discard,
  Workspace memory, career opportunities, confirmed configuration replacement,
  and read-only integration-connection status. The RPCs require the existing
  MCP bearer/client/plan boundary; destructive operations require an explicit
  tool-level confirmation; create/replace operations use private idempotency
  receipts. It does not expose Workspace tables, connector credentials, or an
  arbitrary database operation.
- Local migration application and `supabase migration list --local` — **PASS**.
  The local ledger contains `20260828000252` with matching source and local
  history. No hosted target was linked or changed.
- Local `supabase db lint --local` — **PASS**, no schema errors in extensions,
  `public`, `workspace`, or `workspace_private`.
- `npm run check:boundaries` — **PASS**; 52 runtime files have no Ministry or
  Consulting import and no service-role client.
- `npm run test:schema` — **18/18 PASS**, including the parity migration's
  controlled function, grant/revoke, capability, private-receipt, and no-secret
  contract checks.
- `npm run test:unit` — **61/61 PASS** in eleven files, including the public
  Lewis tool contract, confirmation requirements, and narrow RPC argument
  mappings.
- `npm run typecheck`, `npm run lint`, and `npm run build` — **PASS**. The
  production build compiled the Workspace OAuth, MCP, and integration-route
  surfaces successfully.
- `npm run test:rls` — **138/138 PASS** across five pgTAP files. The new 31
  assertions verify cross-tenant denial, ordinary-RLS denial for MCP bearers,
  plan-capability denial, client binding, idempotent replay, no existence oracle
  for another user's memory, and connector metadata read-only behavior.

## Lewis consumer-readiness source verification — 2026-08-28

This evidence is local-only. It does not represent a hosted Supabase migration,
Vercel deployment, Auth configuration change, real ChatGPT/Claude acceptance,
or external-provider connection.

- Local migration application — **PASS** for
  `20260828002432_lewis_connector_capability_gates` and
  `20260828004945_lewis_workspace_preference_parity`.
- `supabase migration list --local` — **PASS**; source and local history both
  end at `20260828004945`.
- `supabase db lint --local` — **PASS**, with no schema errors in extensions,
  `public`, `workspace`, or `workspace_private`.
- `npm run test:rls` — **177/177 PASS** across seven pgTAP files. The added
  coverage proves default plan denial, capacity reservation, provider-family
  validation, linked Google behavior, downgrade-safe disconnect, invalidated
  in-flight OAuth completion, private credential removal, MCP-bearer profile
  RLS denial, valid IANA display clocks, assistant self-disconnect, and
  post-disconnect bearer denial.
- `npm run check:boundaries` — **PASS**; 53 runtime files have no Ministry or
  Consulting import and no service-role client.
- `npm run test:schema` — **21/21 PASS**, including the connector capability,
  OAuth completion, display-clock, and assistant self-service source contracts.
- `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build`
  — **PASS**. Unit coverage is **64/64 PASS** and the production build includes
  the new native disconnect route without a route conflict.
- `git diff --check` — **PASS**; Git reported only the repository's existing
  line-ending conversion warnings.

## Assistant connection parity verification — 2026-08-28

This evidence is local-only. It does not authorize or represent a hosted
Supabase migration, runtime deployment, Auth change, external-provider consent,
or consumer release.

- Local migration application and `supabase migration list --local` — **PASS**
  for `20260828100646_lewis_assistant_connection_parity`; source and local
  history both include it as the latest migration.
- `supabase db lint --local` — **PASS**, with no schema errors in extensions,
  `public`, `workspace`, or `workspace_private`.
- `npm run test:rls` — **185/185 PASS** across seven pgTAP files. The new
  coverage proves opaque assistant connection handles, confirmed revocation of
  a separately authorized assistant, current-bearer continuity, and
  cross-Workspace revocation denial.
- `npm run test:schema` — **23/23 PASS**, including the opaque assistant-handle
  and tenant-bound revocation source contract.
- `npm run test:unit` — **66/66 PASS** in eleven files, including confirmation
  and narrow RPC argument mapping for an assistant-connection disconnect.
- `npm run check:boundaries`, `npm run typecheck`, `npm run lint`, and
  `npm run build` — **PASS**. Boundaries verified 53 runtime files with no
  Ministry or Consulting import and no service-role client; the production build
  includes the controlled MCP route and all Workspace surfaces successfully.

## Consumer connector release-control verification — 2026-08-28

This evidence is local-only. It does not authorize or represent a hosted
Supabase migration, runtime deployment, Auth change, external-provider consent,
or consumer release.

- Local migration application — **PASS** for
  `20260828011121_lewis_connector_release_registry`.
- `supabase migration list --local` — **PASS**; source and local history both
  included `20260828011121` through that release-control checkpoint.
- `supabase db lint --local` — **PASS**, with no schema errors in extensions,
  `public`, `workspace`, or `workspace_private`.
- `npm run test:rls` — **179/179 PASS** across seven pgTAP files. The added
  checks prove that an active plan is still denied until the provider is
  explicitly released, while the previous capacity, owner, disconnect, and
  OAuth-race controls remain intact.
- `npm run test:schema` — **22/22 PASS**, including the private release
  registry, no-direct-table-access, application route gate, and least-privilege
  scope contract.
- `npm run test:unit` — **65/65 PASS** in eleven files. The catalog marks
  external providers as planned, preserves ChatGPT/Claude Workspace OAuth, and
  excludes Gmail compose, Slack post, and Microsoft file-write scopes.
- `npm run typecheck` — **PASS**.
- `npm run check:boundaries`, `npm run lint`, and `npm run build` — **PASS**
  after the release-control changes. Boundaries verified 53 runtime files with
  no Ministry or Consulting import and no service-role client; the production
  build includes the planned-connector and native-disconnect routes without a
  route conflict.
- `git diff --check` — **PASS**; Git reported only the repository's existing
  line-ending conversion warnings.

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

## 2026-09-08 — P2 Writer / Workspace Experience local proof

Scope: isolated Codex2 integration branch from published Workspace main
`044382c856ca948c4c032c683446b29989dc30e1`; no production or hosted changes.

### Final results

| Check | Result |
| --- | --- |
| Full migration chain into a fresh isolated Supabase stack | PASS |
| npm run check:boundaries | PASS — 103 runtime files |
| npm run test:schema | PASS — 31 checks |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:unit | PASS — 107 tests in 18 files |
| npm run build | PASS — optimized build and 29 generated static pages |
| npm run scan:sensitive | PASS — working tree and existing release lineage |
| npm run test:writer:local | PASS — 33 PostgreSQL assertions and seven connected acceptance groups |
| Writer Playwright acceptance, desktop + mobile | PASS — 8 scenarios |
| git diff --check | PASS |
| Bundle repository typecheck and unit tests | PASS — 20 tests |
| Official plugin and skill validators | PASS — six plugins and six skills |

The sensitive scan is repeated after documentation/staging before the checkpoint
commit. No fixture credentials or traces are included in the checkpoint.

### Real connected acceptance

The separate `bundle-experience-p2` Docker stack ran Supabase on 58421; the actual
Next.js app ran on localhost:3125. Fictional Writer A has a bundle assignment,
reader B does not, and an additional fictional owner has a separate resource.
An operator fixture uses the real issue/revoke RPCs, not application bypasses.

The API suite obtains real password sessions and performs discovery, dynamic
OAuth registration, authorization, user approval, Workspace grant activation,
and S256 PKCE token exchange for two users. It calls the running HTTP MCP server
through the SDK, including tool/prompt discovery and actual resource reads.

Verified: browser/MCP source equality; A/B entitlement parity; cross-tenant and
unknown-ID denial; missing authentication; rejected tenant override; changed
entitlement revision and removed tools after revocation; denial of cached tool
calls; HTTP rejection after OAuth disconnect. The SQL suite also covers direct
table denial, future/expired grants, disabled catalog/capabilities, plan
suspension, invalid MCP audience, disconnected sessions and revoked grants.
Every SQL test is rolled back. Lifecycle tests restore the fictional Writer grant.

### Browser and visual acceptance

Desktop Chrome and mobile-emulated Chrome each verified:

1. Assigned navigation and accurate Home attention count; library search,
   no-results/clear-filters, publication filter, source-first review, copy notes,
   return navigation, and no page overflow.
2. Unassigned account has no Writer navigation/widget and no direct resource access.
3. Revocation clears an already-open source and navigation without a restart.
4. A deliberately injected temporary authority-check failure hides stale content;
   retry against the real service restores access.

Saved and visually inspected: [desktop library](writer-proof/library-desktop.png),
[desktop review](writer-proof/review-desktop.png),
[mobile library](writer-proof/library-mobile.png), and
[mobile review](writer-proof/review-mobile.png).
These are real local app screenshots with synthetic records, not design mockups.
The Next.js development indicator is visible because browser acceptance used the
development server; the optimized production build was checked separately.

Visual inspection found crowded inherited header columns at laptop widths. A
small responsive-layout correction preserves the shell while preventing mode
and clock overlap. The first cold desktop navigation test matched a library
heading too early; the final test explicitly awaits the resource URL and level-1
heading. A legacy SOTF source-pattern assertion was widened only to allow the
additional Writer options; the SOTF gate remains asserted and its existing tests
pass. No unresolved final test failure remains.

### Explicitly not tested / not implemented

- Installed Writer invocation in ChatGPT or Codex, GitHub marketplace refresh,
  hosted OAuth consent UI, and production Entry sign-in/handoff.
- Hosted migration, preview deployment, production operation, physical devices,
  field performance, or measured time-savings/user-value claims.
- Wix, resource import, editing, automatic source verification, and publishing.
- Persisted layout preferences, full global search/notifications/command palette,
  and the remaining functional bundles.
- The entire pre-existing database test suite was not rerun; the new 33-assertion
  hostile suite and complete migration replay were run on the isolated stack.

The deployed-consent/real-host gate is documented in
[the architecture handoff](../architecture/writer-bundle-experience.md).
The Workspace remote is public. The private-source export is retained in a local
commit pending explicit source-publication approval or a private integration
destination. No public branch push or PR is part of this checkpoint.

### Subsequent source-publication approval — 2026-09-08

After the local checkpoint, the user explicitly approved publishing the source
export to the existing public Workspace repository. Publication is limited to
the Codex2 integration branch, without merging main or deploying production.
The reusable bundle repository remains private. This documentation-only update
changes no tested runtime code. Whitespace and sensitive-data checks are rerun
before publication; the full code-validation results above remain applicable.
Installed-host, consent integration, and preview acceptance remain open.

## P3 native Writer import and approved revisions — 2026-09-08

Status: implemented and locally validated; no hosted migration, production
deployment, installed-host approval, Wix connection, or client-shipment claim.

### Final checks

| Check | Result |
| --- | --- |
| All migrations replayed from scratch on isolated bundle-experience-p2 | PASS, 21 migrations including approved revisions; fictional fixtures recreated |
| npm run check:boundaries | PASS, 114 runtime files |
| npm run test:schema | PASS, 31 |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:unit | PASS, 126 tests / 19 files |
| npm run build | PASS, optimized build / 30 static pages |
| Optimized build with isolated public Supabase configuration | PASS |
| npm run test:writer:local | PASS, 35 PostgreSQL assertions + 8 real API/OAuth/MCP groups |
| npm run test:writer:revisions | PASS, 10 real native API/direct-RPC groups |
| Writer desktop/mobile browser acceptance | PASS, 10 tests; optimized loopback build |
| Reusable bundles: typecheck + tests | PASS, 20 tests |
| Official validators | PASS, all 6 plugins + all 6 skills |

Native revision checks cover immutable original retention, bounded import and
metadata, same-workspace relations, other-tenant denial, protected epistemic and
published states, strict unknown-field rejection, no direct table privileges,
identical-request replay, changed-payload conflict, stale and conflicting
decisions, simultaneous approvals, original availability after 14 revisions,
and the streamed JSON size limit. Cleanup removes only exact synthetic resources
created by each API run.

Actual OAuth/PKCE/MCP acceptance adds a saved assistant proposal, verifies that
no approval/import tool is exposed, and proves direct RPC approval with that
assistant token is denied. Entitlement revocation also denies import/proposal/
approval calls. No fabricated signed token is used in the actual OAuth test;
the SQL hostile tests intentionally simulate claims inside a rolled-back
database transaction and are labeled separately.

Both browser sizes exercised .md text loading, failed-import retry without
losing text, real import, real saved before/after comparison, disabled approval
before confirmation, explicit approval, reload and recovery of the original.
They also repeated the P2 access/removal/search/review cases. Failed-save and
temporary-authority HTTP responses are injected scenarios, not claimed service
outages. Successful operations use the actual local database.

The complete browser suite took 32.6 seconds. The synthetic import/retry/propose/
approve/reload journey took 4.3 seconds desktop and 4.6 seconds mobile in this
run. These are automated test timings, not measured client ROI or production
latency promises.

Visually inspected actual comparison screenshots:
[desktop](writer-proof/comparison-desktop.png) and
[mobile](writer-proof/comparison-mobile.png). Before/proposed content, provenance,
disabled-until-confirmed approval, wrapping and mobile stacking were checked.

### Failures investigated, not concealed

The initial development browser run failed a 30-second navigation assertion
while the cold resource route compiled for 33 seconds. A new textarea assertion
also relied on exact nested-label text that included React's textarea content;
it was changed to the textbox's accessible name. The complete optimized
browser run then passed all ten tests without relaxing assertions or retries.

The optimized local MCP attempt correctly encountered the existing production
canonical-host guard (HTTP 421); Node's fetch surfaced a content-length retry
error. A bounded native HTTP check confirmed 421 rather than a tool execution.
No production guard was weakened. Real loopback OAuth/MCP was rerun successfully
in development mode after the clean database replay. Approved canonical-host
preview acceptance remains required; this is not a deployed MCP proof.

### Still open

Full existing non-Writer PostgreSQL suites were not rerun. All migrations,
all unit/schema/boundary/build checks and the targeted hostile database suite
were run. Installed ChatGPT/Codex tests, hosted Entry/consent integration,
Wix and other external-provider authorization, Word/PDF ingestion, voice-profile
and deeper library automation, durable editor draft recovery, and the other
functional bundles remain open. Intermediate revision paging beyond the latest
nine plus original is not implemented.

See [the P3 architecture note](../architecture/writer-approved-revisions.md)
and the bundle repository's docs/release/client-readiness.md. Source publication
is authorized only on the owned branches; no main merge or production deployment
is included. Final sensitive-data scan and publication receipt are recorded in
the checkpoint.

## P4 Writer private recovery and evidence-led discovery — 2026-09-08

Implemented on codex2/bundle-experience-integration. This is a local native
checkpoint, not a six-bundle shipment or deployed/installed-host acceptance.
See ../architecture/writer-recovery-and-discovery.md.

Passed:

- Clean isolated bundle-experience-p2 replay: all 22 migrations, then fictional
  accounts recreated. No hosted project or another local stack was reset.
- `npm run check:boundaries`: 124 runtime files.
- `npm run test:schema`: 31 contracts.
- `npm run typecheck`, `npm run lint`, `npm run test:unit`: 145 unit tests in
  20 files (19 new draft/discovery cases).
- Optimized local-public-config build: 30 static pages. Native routes exercised
  through the actual optimized loopback app; no production MCP guard bypass.
- Ten local pgTAP files: 312 assertions, including all nine existing local suites
  and the 35 Writer hostile-access assertions.
- `npm run test:writer:local`: nine real API/OAuth/PKCE/MCP groups. Discovery
  equals native results; assistant cannot read/save/discard working drafts via
  direct RPC; proposal-only write, approval denial and revocation still pass.
- `npm run test:writer:revisions`: ten native API/direct-RPC groups, including
  serialized approvals, immutable originals, stale conflicts and idempotency.
- `npm run test:writer:library`: seven new native API/database groups for
  exact candidate signals, tenant isolation, review-gated source-text search,
  incomplete-draft persistence, changed-retry/conflict rejection, tombstones,
  index updates after approval and private-table privilege denial.
- Optimized browser: 16/16 desktop/mobile-emulated Chrome tests in 1.3 minutes.
  New flows include reload, failed autosave, a lost successful import response
  retried without duplication, competing tabs, explicit stale-base comparison,
  source-text search and related metadata proposed before approval. Revocation
  now also checks removal of private working-draft text.
- Reusable bundle repo: typecheck, 20 tests, six official plugin validators and
  six official skill validators. Writer skill explains candidate evidence and
  private-draft limits; no installed plugin was changed or claimed tested.
- Sensitive scan before commit: 85 release-lineage commits, 608 unique blobs and
  the working tree, no findings. Fixture credentials/traces remain ignored.
- Actual synthetic desktop/mobile connection images inspected. Candidate reasons,
  source/revision, wrapping, proposal controls and approval disclaimer are visible.

Investigated failures and limitations:

- First real draft load failed with PostgreSQL 42702: unqualified resource_id
  overlapped the private draft table column. Qualified function parameters fixed
  it; the fresh replay and all draft tests pass.
- Initial UI lint flagged unstable callback/ref render reads. Stable callbacks
  and explicit rendered save-signature state fixed it; lint/typecheck pass.
- Initial lost-response browser test matched Next's empty alert before the
  request completed. It now waits for the real successful receipt and the
  specific failed-fetch alert; desktop/mobile both pass.
- A broad SQL-file invocation also included gate_a_hosted_preflight.sql. That
  explicitly hosted-only, read-only script failed on the absent shared-project
  public.guest_public_page_permissions table. No business table was fabricated.
  The ten actual local pgTAP suites passed 312/312; the hosted preflight remains
  for the approved owner/environment, not this isolated stack.
- The first optimized-build helper invocation lacked local CLI telemetry/Docker
  permission; rerunning through the approved isolated-stack permission path
  succeeded. No elevated credential was injected into application runtime.
- Draft autosave needs a connection; work left before a successful save may be
  lost. This is not offline support. A copied on-screen draft is user-directed.
- Candidate labels are exact recorded signals, not semantic/exegetical proof.
  Candidate evidence can become stale; users review both sources before approval.
- No production-scale library benchmark, physical-device test, representative
  client pilot, measured time-saved study, installed ChatGPT/Codex connection,
  hosted Entry/consent proof, external provider integration or deployment ran.

## P5 Writer confirmed preferences and publication handoff — 2026-09-08

Implemented on codex2/bundle-experience-integration; this is a native source
checkpoint, not a six-bundle shipment. Architecture, authority and limitations:
../architecture/writer-preferences-and-publication.md.

Passed:

- All 23 migrations replayed from scratch on isolated bundle-experience-p2;
  fictional fixtures recreated. No hosted migration or other stack was touched.
- Product boundaries: 137 runtime files. Schema contracts: 31.
- Typecheck, lint and 161 unit tests across 21 files, including 16 new preparation
  cases. Normal and isolated-public-config optimized builds generated 31 static
  pages. The final normal build followed the final runtime edits.
- Ten applicable local PostgreSQL suites: 312 assertions. The explicitly
  hosted-only Gate A preflight was not included or represented as tested.
- Eleven actual API/OAuth/PKCE/MCP groups: current confirmed-profile/native
  parity; assistant confirmation/history denial even via direct RPC;
  publication parity and no canonical mutation; foreign and revoked access;
  existing proposal-only and private-draft boundaries remain passing.
- Ten revision and seven draft/discovery native API/direct-RPC groups rerun.
- Six new preparation groups: user confirmation; revision/request idempotency;
  stale/changed retries; invalid fields, belief and tenant overrides; separate
  users; active-profile clearing and private history; independent profile
  capability removal; canonical-only publication payload; missing/foreign/stale
  revisions; repeated query fields; direct-table and anonymous denial.
- Final optimized Chrome run: 24/24 tests, desktop and mobile emulation, no
  retries. New flows cover actual save failure and lost successful responses,
  recovery-history review requiring confirmation, stale tabs, navigation warning,
  approved preferred topics/themes, real TXT/JSON downloads, copy summary,
  stale packet rejection and removal of the open private profile editor on
  revocation. The runner reads actual download contents; success is not mocked.
- Reusable source: typecheck, 20 tests, six official plugin validators and six
  official skill validators. Workspace's eleven-file source export is pinned
  to f61211a5dfe02a308bb5cca083d51444eb5630b9. No installed plugin changed.
- Actual successful desktop/mobile preference and handoff images inspected.
  Text wraps, explicit confirmation and revision/approval disclaimers remain
  visible. Canonical text is not privacy-redacted; private fields are excluded
  from the packet, not from user-authored source text.

Investigated failures and limits:

- Initial browser assertions matched both a save/error message and another
  status (history loading or the framework route announcer). Selectors now
  identify the specific outcome, without weakening success assertions.
- A decorative back arrow was included in the preferences link's accessible
  name. It is now aria-hidden; the real dirty-navigation warning and reload
  flows pass on desktop/mobile.
- The library acceptance initially assumed an older fixture was on page one.
  It now searches explicitly and separately checks that clearing filters resets
  the search. Pagination and search are not bypassed by fabricated responses.
- Some development and optimized attempts exceeded local loading deadlines,
  including one lost-response import case. A subsequent complete optimized run
  passed without timeout increases or retries. The final run took 9.8 minutes,
  with large local timing variation; this is not a responsiveness benchmark.
  Slow-network/loading-timeout recovery and representative performance remain
  explicit release-hardening work, not a resolved production claim.
- Local screenshot/runner startup occasionally timed out; later read-only image
  inspection succeeded. Only successful synthetic images are retained as proof.
- Profile history is recovery, not permanent erasure; only the latest ten
  snapshots are exposed in the native history. Unconfirmed profile edits are
  on-screen only and can be lost if the user leaves without saving.
- No installed host, hosted Entry/consent/canonical-host proof, external Wix or
  Logos access, physical-device test, representative-client pilot, measured
  user-value study, deployed recovery/retention or payment enforcement ran.
- Final source scan and branch publication receipts are in the P5 checkpoint.

## P6 Ministry native workspace — 2026-09-08

Local implementation evidence only. All six bundles remain NOT READY TO SHIP.
No hosted migration, production deployment, installed-plugin update, external
provider access, client data import or marketplace submission occurred.

Passed:

- Fresh replay of all 24 migrations on the isolated bundle-experience-p2 stack.
- 330 PostgreSQL assertions across eleven local suites, including eighteen new
  private Ministry table/RLS/helper/anonymous-access checks.
- 174 unit tests across 22 files; 32 schema/policy tests; typecheck, lint and
  boundary checks. The boundary scan covers 162 runtime files with no legacy
  Ministry/Consulting imports or service-role application client.
- Standard and isolated optimized builds, each generating 34 static pages.
- Ten actual Ministry API/OAuth/MCP groups: blank client profile, explicit
  confirmation, inferred-state preservation, source/archive text search,
  tenant/kind/Writer-ID denial, invalid citations and dates, private no-store
  APIs, dual-bundle composition, real PKCE/consent/tool parity, proposal-only
  assistant access, direct-user approval, retry safety, stale proposals,
  original-plus-latest-nine history, and current capability revocation.
- Writer regression: eleven real API/OAuth/MCP groups, ten revision groups,
  seven draft/discovery groups and six preference/publication groups.
- Final optimized Chrome: 34/34 desktop/mobile-emulated cases in 3.5 minutes,
  no retries. Ten Ministry cases cover consent disclosure/incomplete-request
  denial, independent theological preferences, failed-save recovery, source
  and note citations, actual bibliography download, proposal comparison and
  approval, historical recovery, plain-text import/search and stale tabs.
  The existing 24 Writer cases also pass. Timing is not a client benchmark.
- Four inspected synthetic success screenshots in docs/testing/ministry-proof.
- Reusable source: 28 tests; all six plugin and all six skill validators pass.
  The host's fourteen-file allowlist is pinned to
  59031bfd4203c4d1367ccd58311b4d60afe4390e.
- Sensitive-data scan and diff checks pass before publication; final branch
  receipts and post-commit scan counts are recorded in the P6 checkpoint.

Investigated failures and honest limits:

- The first fresh replay found a CASE-expression syntax error in proposal
  approval. It was corrected, then the entire migration chain replayed cleanly.
- The first lifecycle test used a nonexistent catalog status column. It now
  disables/restores the real bundle-capability mapping and passes denial checks.
- Initial browser runs exposed helper text folded into field names and fragile
  exact-label/alert selectors. Inputs now have separate labels/descriptions;
  tests select semantic controls and specific outcome messages. A waiting test
  runner was stopped before the corrected rerun. No success was mocked.
- Proposal retry normalization now uses its immutable base, not changing
  canonical content. Stale proposals are not presented as a valid fresh merge.
- The scanner flagged a dummy refresh-token literal in a local test. The test
  now uses the real bearer-bound bridge shape without inventing a refresh token
  or adding a scanner exception. The existing local YAML dependency was used
  to run unmodified official plugin/skill validators.
- The source consent page now explicitly describes assigned Writing/Ministry
  reading and proposal access, including theology and recorded position status.
  This is not deployed Entry consent or installed-host acceptance.
- Unconfirmed Ministry edits remain on screen only; navigation warns before
  discarding them. New Ministry requests have a bounded timeout and preserve
  failed edits, but crash/autosave recovery is not implemented for this domain.
- Handoffs are labelled saved snapshots, not publication or independent source
  verification. User text is not privacy-redacted; review it before sharing.
  Downloaded copies cannot be retroactively revoked. Unsetting a profile is
  not permanent erasure; prior versions remain recoverable.
- Large-library ergonomics, richer ingestion, representative theological/source
  evaluation, unaided first-use value, physical-device testing, actual installed
  ChatGPT/Codex operation, authorized Logos proof, deployed retention/recovery,
  payment enforcement and the remaining native bundles are open release gates.

## P7 Nonprofit Founder native workspace — 2026-09-08

Local implementation evidence only. All six bundles remain NOT READY TO SHIP.
No hosted migration, production deployment, installed-plugin update, provider
access, client data import or marketplace submission occurred.

Passed:

- Fresh replay of all 25 migrations on the isolated bundle-experience-p2 stack.
- 357 PostgreSQL assertions across twelve local suites, including 27 new
  Nonprofit private-table, RLS, helper-privilege and anonymous-access checks.
  The hosted-only Gate A preflight is excluded because its shared legacy tables
  are intentionally absent; this is not deployed migration proof.
- 185 unit tests across 23 files; 32 schema/policy tests; typecheck, lint and
  boundary checks. The boundary scan covers 188 runtime files with no legacy
  business-runtime imports or service-role application client.
- Standard and guarded isolated optimized builds, each generating 37 static pages.
- Eleven actual Nonprofit API/OAuth/MCP groups: all four record kinds and search,
  cross-client/kind/Writer-ID denial, independent multi-bundle composition,
  current capability removal, private no-store APIs, unknown clinical fields,
  malformed dates/URLs/email and dependency-cycle rejection, administrative
  confirmation, exact retries, concurrent/stale writes, retained history,
  noncanonical new/revised proposals, native approval/rejection, stale approval
  denial, capability-filtered attention and disconnect. Real registration,
  consent, grant activation and PKCE exercise all thirteen advertised tools.
  Assistant calls cannot bypass native-only save, decision or history rules.
- Ten Ministry connected groups and the complete Writer regression: eleven
  API/OAuth/MCP, ten revision, seven draft/discovery and six preparation groups.
  All successful operations use fictional accounts and the real isolated backend.
- Final optimized Chrome: 46/46 desktop/mobile-emulated cases in 7.5 minutes,
  no retries: twelve Nonprofit, ten Ministry and 24 Writer. Nonprofit covers
  consent denial, an editable starter roadmap, reset confirmation, failed-save
  recovery, partnership proposals and comparison, explicit approval, original
  recovery, actual saved TXT downloads, meeting zone/decisions/actions, source
  findings separate from interpretation, stale proposal rejection and tenant
  denial. The earlier corrected development run also passed all twelve
  Nonprofit cases. Runtime is not a client responsiveness/value benchmark.
- Four inspected synthetic optimized-preview views in docs/testing/nonprofit-proof.
- Reusable source: 36 tests across six files and typecheck; all six official
  plugin and all six official skill validators. The host's seventeen-file
  SHA-256-checked export is pinned to ead26bb30bf7ccd733e186255e7f0d52163345e9.
  Later source documentation changes do not change that exported contract.
- Working-tree sensitive-data and diff checks pass before publication. Final
  post-commit scan counts and verified branch receipts are in the P7 checkpoint.

Investigated failures and honest limits:

- The first live roadmap save exposed an ambiguous PL/pgSQL variable/CTE name
  despite a successful migration replay. The local variable was renamed; the
  final entire 25-migration replay and real save/concurrency regression pass.
- Adding a blank research source initially threw from URL refinement during
  safeParse. Both reusable Nonprofit and Ministry URL refinements now return
  false for incomplete/malformed input instead of throwing. Regression tests
  include blank values, incomplete URLs and invalid ports; browser flows pass.
- One roadmap browser selector matched hidden dependency labels as well as the
  intended summary. It now selects the actual summary without loosening the
  saved-data assertion. Test-only RPC names were aligned with verified contracts.
- Visual inspection found a floating Nonprofit save bar covering form content.
  It now stays in normal flow; final focused desktop/mobile views were inspected.
- SQL contact-email validation was aligned with the reusable schema and negative
  tests. Rejection no longer requires affirming potentially inappropriate
  proposal content; approval still does. Revoked capabilities independently
  remove navigation, API/MCP access and attention items.
- Clinical-scope schemas, skill instructions and explicit confirmation are not
  PHI detection or redaction. Free text and exported copies require user review.
  No real patient/clinical content was used. History/proposals are retained,
  not permanently erased; downloads cannot be retroactively revoked.
- Saved sources are recorded evidence, not fetched or independently verified
  authorities. Reviewed research does not certify compliance or grant eligibility.
  Meetings do not book calendars, resolve DST instants or send invitations.
  Outreach is an unsent draft; next moves do not send reminders.
- Unsaved Nonprofit forms survive an on-screen failed request and warn before
  navigation, but browser-crash/autosave recovery is not implemented. The native
  history exposes the original plus latest nine versions. Large datasets,
  long-form editing and shared mobile navigation clearance need further UX work.
- No installed ChatGPT/Codex, hosted Entry/consent/canonical-host proof, live
  public-authority research evaluation, physical devices, representative client
  pilot, measured first-value/time savings, external providers, deployed
  retention/recovery or payment enforcement ran. The twelve-minute first-value
  estimate remains a design target. No private fixtures, test traces or credentials
  belong in source publication.
## P8 Investor native research workspace — 2026-09-09

Implementation evidence only. All six bundles remain NOT READY TO SHIP.
No main merge, hosted migration, deployment, marketplace submission, installed
plugin update, personal-account connection or client information was used.

Passed:

- Fresh replay of all 26 migrations on isolated bundle-experience-p2; the applied
  count was rechecked directly. This is not hosted migration proof.
- 421 PostgreSQL assertions across thirteen local suites, including 64 Investor
  private-table, RLS, anonymous/helper and guarded-RPC permission checks. The
  hosted-only Gate A preflight remains intentionally excluded.
- 217 unit tests across 24 files, including 32 Investor cases; 32 schema/policy
  cases; typecheck, lint and boundaries. The boundary scan covers 215 runtime files.
- Exact generated base-schema parity between the reusable Zod contracts and SQL,
  in addition to real database checks for cross-field evidence/scenario rules.
- Standard and guarded isolated optimized builds, each generating 41 static pages.
- Eleven actual Investor API/OAuth/MCP acceptance groups: four research kinds and
  full-text search; cross-client/kind and same-user Writer/Ministry/Nonprofit ID
  denial; independent capability composition; private no-store HTTP; strict
  account/trade/tenant fields, dates, types, sources, citation references and
  scenario constraints; confirmation; exact retries; concurrent/stale writes;
  retained originals; pending/approved/rejected proposals; native-only approval
  and history; dated attention; selective revocation and connection disconnect.
- Actual local registration, consent, PKCE and fourteen MCP tools. Four proposal
  tools write private proposals; thirteen tools are private-domain operations,
  and one read-only open-world tool is the bounded public metadata lookup.
  Assistant edits to sources demote dependent confirmed claims to inferred and
  sources to unverified. Approval preserves that distinction; retries use the
  immutable original base, including after a proposal has been approved.
- The public-source gate denies unassigned callers and enforces its per-workspace
  request budget without needing an external fetch. Unit tests cover fixed SEC
  destinations, safe paths, identity/date/column checks, coverage, size bounds,
  denied access, post-fetch revocation and upstream failures without retries.
- The complete existing connected regression: eleven Nonprofit and ten Ministry
  groups; eleven Writer API/OAuth/MCP, ten revision, seven discovery/recovery and
  six preparation groups. All successful operations use fictional local accounts.
- All 60 optimized browser cases passed in one run with one worker and no retries
  (11.7 minutes): fourteen Investor, twelve Nonprofit, ten Ministry and 24 Writer,
  split equally across desktop and mobile-emulated Chrome. Investor covers first
  watchlist creation, confirmation reset and failed-save retention; a source-linked
  thesis with challenging evidence, invalidation, catalyst and explicit scenarios;
  compared proposal approval, history copy and saved-only download; 13F validation
  and a bounded brief; explicit metadata-only draft import; stale rejection;
  cross-client denial and consent scope. No horizontal overflow was observed.
- Two watchlist recapture cases passed in 1.1 minutes after adding an explicit
  completed-save heading wait. A final fourteen-case Investor-only optimized run
  passed in 4.3 minutes on both projects after the readability refinement. The
  HTML report records fourteen expected, zero failed/flaky/skipped cases; its
  persisted
  `.bundle-local/investor-final-readability/.last-run.json` reports `passed` with
  no failed tests. Confirmation labels are measured at least 15 pixels, and
  collapsed claim summaries expose their review state. Both optimized builds,
  typecheck, lint and all unit/schema/boundary checks were repeated after this
  refinement. Four final synthetic screenshots were visually inspected and are
  documented in [Investor visual proof](investor-proof/README.md).

Honest limitations and corrected attempts:

- A single actual public SEC request for a public company CIK was declined with
  upstream 403. The app returned a descriptive 503, with no findings or save.
  No alternate identity, retry or evasion was attempted. **Live SEC success is
  not proven.** Operator identity/traffic review and successful authorized public
  reads are required before client enablement. The labeled metadata browser
  fixture tests UI behavior only, not SEC availability or filing-text analysis.
- Initial unit verification had one assertion-label mismatch (zero confidence
  was correctly rendered); the assertion was corrected. Initial browser work
  exposed a route-announcer selector collision and a ten-second development-load
  wait, not a false successful save. The selector was narrowed; all sixty final
  optimized cases passed without raising the normal assertion timeout or retries.
- A first watchlist screenshot captured its post-save loading transition even
  though the saved record had been checked through the real database. Capture
  now additionally waits for the completed saved title; only inspected success
  screenshots belong in docs/testing/investor-proof. Traces/videos stay ignored.
- The Windows Supabase CLI could not resolve the spaced SQL path. The durable
  local runner now initializes pgTAP and runs each rolled-back suite through the
  exact isolated container. An initial missing testing extension was corrected;
  no product migration or permission check was waived.
- Source contracts have 47 tests; all six official plugin and six skill validators
  pass. The host's twenty-one-file export is checksum-verified at source revision
  606c9ebcb22704306b77d9afdc76c9f50c2783d3. Later source documentation does not
  change that runtime export. Official authoring guidance supplied the missing
  build-chatgpt-app skill fallback; no app ID or installed integration was invented.
- Finances was inspected for listing/dependency metadata only. Its runtime fields,
  scopes and personal-account integration are unverified and were not accessed.

Open client gates: Investor crash/autosave recovery; representative filing/thesis
quality, source coverage and correction evaluation; measured unaided first value
and time saved; large-library and physical-device/accessibility acceptance;
installed ChatGPT/Codex behavior; live public-provider proof; deployed privacy,
retention, recovery, payment and support. Shared Experience must also audit
secondary sticky controls with the mobile header. Investor compact claim review
states are now exposed; the broader cross-bundle UX audit remains open.
Executive and remaining Experience implementation
are next. See architecture/investor-native-workspace.md and the P8 checkpoint.

## P9a Executive persistence and source-permission foundation — 2026-09-09

Concrete backend/contract progress; Executive itself is not complete. All six
bundles remain NOT READY TO SHIP. No production/main/hosted/provider changes.

Passed:

- Fresh replay of all 27 migrations on bundle-experience-p2, then independent
  verification of the actual applied count. Before reset, every local identity
  was verified to use example.invalid. All fixtures were regenerated afterward.
- Seven real native authenticated RPC groups: all five Executive kinds; exact
  retries; strict schemas, real dates, integer durations and named zones;
  completion/decision evidence; cross-client/kind and absent-entitlement denial;
  concurrent saves with one winner; retained original versions; actual
  pending/approved/rejected proposals and stale-decision refusal.
- Source sharing starts empty, requires exact native confirmation and a current
  source entitlement, detects stale settings and keeps permission revisions.
  Four-domain source records were created through their actual guarded native
  operations. Resolution returns the fixed metadata allowlist only; manuscript,
  theological, operating and research canary text is absent. Other-client IDs,
  wrong domains and future source revisions do not return metadata.
- Removing sharing or revoking the actual local source entitlement immediately
  closes source resolution. The test regrants the fictional source entitlement
  through the operator operation, then leaves source sharing empty. The user's
  own previously saved Executive brief remains accessible.
- 488 PostgreSQL assertions across fourteen suites, including 67 Executive
  table/RLS/helper/RPC privilege checks; every suite rolls back its fixtures.
  Hosted-only Gate A remains excluded, not waived.
- Exact parity of five generated base schemas and ten metadata source definitions
  against the reusable source.
- Reusable source: 64 tests in eight files, including seventeen Executive
  contract/analysis/scheduling cases; typecheck; all six official plugin and
  six skill validations. The meeting-slot test uses explicit instants through
  a daylight-saving repeated hour and never claims a calendar booking.
- Workspace regression: 217 existing unit tests across 24 files; 32 schema/policy
  tests; typecheck, lint and a boundary scan of 215 runtime files; optimized build
  with 41 static pages. No Executive page or connected tool is registered yet.

Corrected attempts:

- Real source resolution exposed a PL/pgSQL variable/column ambiguity. It was
  corrected in source and the isolated helper, then verified by the full fresh
  replay and final seven native RPC groups.
- An early test-only revocation update omitted required audit metadata. The
  test now uses the actual operator revocation/regrant operations. An incorrect
  Nonprofit fixture parameter was also corrected. Final source fixtures are
  created through real guarded operations; the fresh replay removed the earlier
  disposable malformed fixtures.
- Reusable manifest updates initially encountered patch-context formatting
  mismatches; no file was changed by those failed patches. The actual source
  text was used for the successful edits.

Not run or not implemented in this checkpoint:

- Executive attention aggregation/coverage, app HTTP routes, native source
  controls/editors, live source-change UI, MCP registration/actual OAuth tool
  invocation, browser accessibility/first-value flow, scheduling UI, background
  automation and meaningful-change notifications.
- Installed ChatGPT/Codex, live provider, hosted migration/deployment, client data,
  representative unaided/time-saved acceptance, deployed recovery/retention and
  payment/support proof. Prior P8 browser results are not presented as P9a proof.

The active host export remains at P8 source revision
606c9ebcb22704306b77d9afdc76c9f50c2783d3. Executive's declared source navigation is
not active UI. The next step is its scoped attention engine and complete native/
HTTP/MCP flow, followed by the remaining Workspace Experience and shipment gates.

See [Executive foundation](../architecture/executive-native-workspace.md),
[local proof](../runbooks/executive-local-proof.md) and the P9a checkpoint.

## P9b — Executive native experience and connected coordination — 2026-09-09

This is a source-only implementation checkpoint. **All six bundles remain
NOT READY TO SHIP**, and the full goal remains active. Executive's pages, typed
HTTP/MCP bridges, native source controls and record-level attention are now
implemented. This supersedes P9a's unwired-host status, not its historical facts.

Passed on the final source and isolated fictional stack:

- All 28 migrations replayed freshly on bundle-experience-p2; the applied count
  was independently checked. The pre-reset 16 identities were all fictional
  example.invalid accounts. Ordered seeding recreated only synthetic clients.
- Seven Executive native RPC groups and ten actual HTTP/OAuth/PKCE/MCP groups.
  These cover all five records; strict queries, kind/client boundaries and
  no-store output; exact retries; original preservation; default-off sharing;
  thirteen honest coverage entries; more than fifty real records with exact
  totals and a fifty-item page; held-meeting exclusion; seventeen focused tools;
  native-only canonical/permission/history decisions; four-domain private-body
  canaries; source withdrawal; operator source revocation/regrant; selective
  Executive entitlement removal; and assistant disconnection.
- All 495 PostgreSQL assertions in fifteen rolled-back suites, including
  67 Executive foundation and seven Executive attention privilege assertions.
- Full existing connected regression: eleven Writer API/OAuth/MCP groups,
  ten revision groups, seven draft/discovery groups, six profile/publication
  groups, ten Ministry groups, eleven Nonprofit groups and eleven Investor
  groups. Investor tests did not fetch live SEC or personal accounts.
- All 76 optimized Chrome journeys, without retries: sixteen Executive,
  fourteen Investor, twelve Nonprofit, ten Ministry and 24 Writer, split equally
  between desktop and mobile emulation. Executive covers failed-save retention,
  confirmation reset, decision/completion evidence, nonexistent/repeated local
  hours, coverage-aware brief preparation, source withdrawal, proposal conflicts,
  original restoration and saved-only downloads.
- Four final synthetic screenshots visually reviewed and preserved:
  [attention desktop](executive-proof/attention-desktop.png),
  [attention mobile](executive-proof/attention-mobile.png),
  [explicit repeated-hour choice desktop](executive-proof/time-choice-desktop.png),
  [explicit repeated-hour choice mobile](executive-proof/time-choice-mobile.png).
  Readability and bounded controls were checked; these are not a full
  accessibility, real-device or unaided-client acceptance audit.
- Workspace boundary scan: 242 runtime files; 32 schema/policy tests; typecheck;
  lint; 250 unit tests in 25 files, including 33 Executive cases; optimized
  Next.js build with 47 static pages. Final post-build typecheck/lint also pass.
- Source typecheck and 64 tests in eight files; six official plugin validations
  and six official skill validations. No package identity/install changed.
- All 26 export hashes and exact approved source transformations match
  ff7d7c29a1e856818d828f6fa821718642463c20. Trusted base schemas and source
  definitions retain parity. No runtime cross-repo import is used.
- Pre-publication whitespace and narrow sensitive-data checks pass. Working
  source and preserved release-lineage history are scanned; this is not a
  comprehensive privacy/legal audit. Final commit/scan/publication receipts
  are recorded in the P9b checkpoint.

Corrected attempts and findings:

- Initial lint caught JSX apostrophes and a non-hook callback named useTime;
  corrected before final checks.
- Early browser tests exposed ambiguous decision/select labeling. Controls now
  use explicit labels, including the named-zone picker. The repeated-hour radio
  is explicitly sized and asserted; final desktop/mobile tests pass.
- Code review found held meetings could remain pending attention. The final
  fresh migration excludes them, with an actual connected regression.
- Initial optimized localhost MCP acceptance hit the intentional production
  canonical-host guard (421, surfaced by the SDK as a transport error). The
  protection is unchanged. Connected tests use the isolated development preview
  and now fail preflight clearly on the wrong host mode; final browser tests use
  the optimized app.
- One default-sandbox build preflight could not write CLI telemetry. The approved
  local runtime rerun passed without exposing private credentials to the app.
  One package-validation invocation used a nonexistent shortened directory;
  all six actual package paths then passed. A cross-repo hash audit needed a
  command-scoped safe-directory setting; no global Git policy was changed.

Still absent or not claimable:

- Nested roadmap/meeting tasks and Investor catalysts in Executive attention;
  complete linked-source discovery beyond the first attention page; historical
  full-period weekly outcomes; availability scheduling UI; recurring execution
  and meaningful-change notification lifecycle; crash/autosave recovery outside
  Writer; and remaining shared Workspace Experience consumers/preferences.
- Installed ChatGPT/Codex invocation/update/removal/reconnect, representative
  source quality and unaided time-saved acceptance, large-library ergonomics,
  final shared mobile header/toolbar polish, deployed privacy/retention,
  payment/support, hosted migration/deployment and authorized provider proof.
- No external account, client data, calendar booking, outgoing message,
  marketplace submission, main merge or production change occurred.

See [Executive implementation](../architecture/executive-native-workspace.md)
and [the reproducible local proof](../runbooks/executive-local-proof.md).

## P9c — Executive individual-task attention and source discovery — 2026-09-09

**Source-only implementation milestone; all six bundles remain NOT READY TO
SHIP.** No hosted migration, production deployment, installed-host change,
provider connection, client data or marketplace submission is included.

- Fresh local replay: all **29 migrations** applied to bundle-experience-p2.
  Read-only final count confirms 29 and zero non-fictional auth accounts.
- Reusable source: **71 tests in nine files**, typecheck, six official plugin
  validations and six skill validations pass. Executive 0.3.0 keeps both platform
  contracts at 1.0. All **27** exported files exactly match their hashes and
  approved transformations at 28d6b4cb876a37709e899526f7087a596b3aec67.
- Workspace required checks pass: **245 runtime boundaries**, **32 schema/policy
  tests**, typecheck, lint, **254 unit tests in 26 files**, optimized build
  (50 generated pages).
- Existing Executive native foundation: **seven groups** pass unchanged.
  New task native acceptance: **seven groups**, including exact parity between
  all five replayed SQL schemas and the pinned source; old grants never expand;
  explicit versioned task consent; exact retries/concurrency; ten task mappings;
  fixed six/twelve-field envelopes; cross-client/kind/item denial; 22-scope
  attention counts; completed-meeting open actions; prerequisite/catalyst
  certainty; 75-task source pagination; changed/deleted links; task withdrawal
  and live source revocation.
- Database isolation: **542 PostgreSQL assertions in 16 suites** pass, including
  47 new task metadata helper/bridge privilege checks. Suites roll back fixtures.
- Real Executive HTTP/OAuth/PKCE/MCP: **12 groups** pass, including nineteen
  advertised tools with only five proposal writes; native-only expanded consent;
  exact task proposals through native approval; title-only source discovery
  across 52 tasks; current permission/capability enforcement and disconnect.
  Private manuscript, source, research, task-evidence and operation canaries
  do not appear in the new task metadata responses.
- All connected cross-bundle regressions pass: Writer 11, revisions 10,
  discovery 7, preparation 6; Ministry 10; Nonprofit 11; Investor 11 groups.
- Optimized desktop/mobile browser acceptance: **80/80 pass without retries**
  (20 Executive plus the existing 60), terminal completion in 11.1 minutes.
  The two new Executive journeys cover separately confirmed task access, a
  link beyond the fiftieth source, task-only withdrawal, task ownership and
  follow-through after a held meeting. All eight selected spec files ran.
- Four final synthetic task-card images were inspected at desktop and mobile
  sizes: exact task links and held-meeting action attention. They are retained
  alongside, not in place of, the P9b images under docs/testing/executive-proof.

Corrected attempts: initial source/browser fixture literal types were tightened;
old host schema-parity/tool-count expectations were updated to the actual new
contract (with independent live SQL parity, not suppressed assertions). One
preliminary browser run was stopped to correct a test-only Focus label; the
subsequent task run passed both viewports. Early screenshots caught a refreshing
view; final tests wait for live task data and capture the relevant card.
No failed assertion was waived or converted to a skip.

Security/platform: legacy record grants remain six-field; new foreign task
sharing requires a separate native task-metadata-v1 confirmation and current
parent source entitlement. Direct private helper/table access stays denied.
Stable page cursors are not authorization tokens. Canonical references contain
identifiers/revisions, not cached task details. Local scans are narrow
token/private-key detection, not a comprehensive privacy/legal audit.
OpenAI guidance was checked at
[Build an MCP server](https://developers.openai.com/plugins/build/mcp-server);
focused schemas/identifiers and per-request authorization informed the two
read-only tool additions. Local MCP testing is not installed-host acceptance.

Remaining: full-period weekly outcomes, explicit-availability scheduling,
approved recurring/notification lifecycle, exact-child navigation and grouping
redundant parent/task cues, crash/autosave recovery, shared Workspace Experience,
representative client-value/accessibility and deployed release gates.
