# Supa Stage 1 OAuth binding evidence

Date: 2026-09-13. Verdict: **B — STAGE 1 IMPLEMENTATION PASSED WITH BOUNDED FOLLOW-UP**.

The local binding/classification contract passed **739/739 fresh transactional
assertions**, including the unchanged 631-assertion regression baseline.
No reproducible Stage 1 authority defect was found in the authored or subsequent
adversarial pass. One unrelated byte-preservation unit test fails because this
Windows checkout uses CRLF. Current HTTP endpoints and actual Auth-hook operation
are deliberately not claimed hardened or production-ready.

Authority: the already-approved
[bounded hardening plan](<C:/Users/awbostwick/Documents/ChatGPT/architecture check/docs/architecture/shared-production-bounded-hardening-plan.md>).
Stage 1 only. The shared-production pilot topology is unchanged; no separate
Personal production project is required or created.

## 1. Exact starting state and isolation

| Item | Evidence |
|---|---|
| Ministry source repository | C:/Users/awbostwick/Documents/Codex/emergence-ministry-platform-repo |
| Fetched current Ministry main / starting and final HEAD | c96537b49a46bab50efeded1ae5c4aa2ad5632a4 |
| New branch | codex/supa-stage1-oauth-binding |
| Isolated Ministry worktree | C:/Users/awbostwick/Documents/ChatGPT/architecture check/.supa-ministry |
| Starting worktree/index | Clean; existing Ministry checkout and dirty work preserved |
| Outer Supa evidence workspace | C:/Users/awbostwick/Documents/ChatGPT/architecture check |
| Outer branch / HEAD | codex/hosted-workflow-canonicalization / cbdb066931799d8f5b631021ce14621099221693 |
| Consulting regression source | Read-only committed ref 0dfa14d9a339897f6a1ada83a3faf3240f519223 |
| Workspace regression source | The unchanged outer workspace's 19 migrations and eight suites |

No commits, staging, push, merge or PR. An initial long-path worktree creation
failed on Windows filename limits and left no registered worktree at that path;
the shorter path above succeeded. The new branch remains at the original HEAD.
The original Ministry checkout was not switched or edited. Existing outer
planning/proof and SOTF conformance documents were preserved.

## 2. Current pre-repair OAuth behavior

The [pre-repair trace](<C:/Users/awbostwick/Documents/ChatGPT/architecture check/.supa-ministry/docs/architecture/supa-stage1-pre-repair-trace.md>)
was written before implementation.

The shared Supabase issuer handles ordinary sessions and OAuth sessions.
Workspace source configuration selects its Workspace-private hook; this task
does not assert what hook is currently configured in hosted Auth.

| Source path / point | Observed source behavior |
|---|---|
| Workspace migration 20260822044610_workspace_productization.sql:331 | Present client_id classified as Workspace OAuth |
| Workspace migration 20260823153000_workspace_mcp_oauth_session_client.sql:4 | Adds client recovery from auth.sessions.oauth_client_id |
| Workspace migration 20260901150529_workspace_mcp_resource_admission.sql:454 | Latest hook adds active user/client/Workspace resource grant and dynamic-admission checks, but not exclusive product ownership or token-time live-client validation; rewrites audience without validating incoming resource |
| Latest Workspace consent resolver | Validates approved authorization, live client, exact resource, PKCE, scopes and registered redirect; this per-user grant is not exclusive project-wide client ownership |
| Workspace lib/workspace/mcp-auth.ts:57 and DB is_valid_mcp_request | Audience/client/Workspace marker plus durable user grant; no new shared product contract |
| Ministry lib/meridian/mcp/auth.ts | Valid non-guest account bearer; resource/client optional; missing scopes default; later product grants still apply |
| Consulting lib/mcp/auth.ts at frozen ref | client_id required, resource optional, no exact audience/product ownership check; assignments still apply downstream |

Thus the latest Workspace implementation is more restrictive than simply
“client exists,” but still cannot prove that a client belongs only to Workspace.
The older hook definitions remain historical source, not three simultaneously
active hooks. None was replaced in this stage.

## 3. Durable binding schema and contract

New Ministry source migration:
[20260913150000_shared_oauth_product_binding.sql](<C:/Users/awbostwick/Documents/ChatGPT/architecture check/.supa-ministry/supabase/migrations/20260913150000_shared_oauth_product_binding.sql>).

Four RLS-enabled private tables hold the fixed catalog, singleton enable/issuer
control, exclusive client binding and append-style activation/revocation audit.
No runtime role receives direct table or sequence privileges. The control is
default OFF; zero client bindings are installed; a directly inserted binding
defaults DISABLED.

| Contract | Product | Exact resource and audience |
|---|---|---|
| workspace | workspace | https://workspace.leademergence.com/api/mcp |
| ministry | ministry | https://www.leademergence.com/mcp |
| consulting | consulting | https://consulting.leademergence.com/mcp |
| consulting_client | consulting | https://consulting.leademergence.com/mcp/client |

Ministry uses its current source resource, not an invented domain cutover.
The catalog CHECK constraint restricts these four tuples, and a composite foreign
key enforces the entire product/resource/audience tuple on each binding.
One client UUID primary key makes simultaneous conflicting durable rows
impossible. Binding identity, approving user, source authorization, creation time
and version are immutable. REVOKED is terminal; deletion is rejected so Auth
client deletion does not erase a binding tombstone. No cascading Auth FK is used;
every resolution checks the live Auth client instead.

Activation takes only an authorization ID. It obtains the current authenticated
ordinary user's own approved, unexpired Auth authorization and live dynamic public
client; checks S256 PKCE, registered exact redirect, allowed scopes including
openid, authorization-code/refresh grants, issuer and enable control; then
resolves the exact Auth authorization resource in the fixed catalog.
No product/resource/user argument is accepted. Auth rows are share-locked;
a client-keyed transaction advisory lock serializes first-binding attempts.
An existing row cannot be reassigned or revived. Exact same-source activation
can return true without creating a second row.

Revocation takes a canonical client identifier, derives the caller from auth.jwt,
requires the original approving ordinary user, and writes a terminal revocation
and audit event. Revocation remains possible when the enable switch is OFF.
Administrative DISABLED state is supported; no general runtime state-edit or
disable/re-enable RPC is introduced. Owner-level SQL lifecycle procedures and
their operational audit discipline remain later packaging/runbook work.

## 4. New token hook

The migration creates private.custom_access_token_hook(jsonb), but does not
configure it in Auth or replace the existing Workspace hook. Only
supabase_auth_admin receives execute permission.

The internal resolver requires canonical lowercase non-nil UUID client/subject/
session identifiers, an authenticated role, the exact configured shared issuer,
an enabled control, a live matching Auth session/user/client relationship, and an
ACTIVE catalog-valid binding with a live dynamic public OAuth client.
Workspace additionally requires the existing active subject/client/exact-resource
grant and existing dynamic-admission switch. If those Workspace objects are
absent, resolution fails closed.

The hook strips reserved le_session_class, le_product, le_binding_version,
resource and workspace_mcp fields before classification. Missing/NULL client_id
does not trigger recovery from an OAuth session. Event user_id must match sub.
Incoming audience must be a string equal to authenticated or the exact canonical
binding audience. Missing resource is allowed; a present resource must be the
exact canonical JSON string. Mismatched audience is preserved, not rewritten
into success; no product classification is added.

Recognized clients receive only le_session_class=mcp_oauth, the bound le_product,
version 1, exact aud/resource, and Workspace-only workspace_mcp=true.
No Ministry/Consulting membership, tenant, capability or entitlement is invented.

This follows the approved plan's specific preserve-mismatch rule. An unknown
client's pre-existing audience is not treated as authority by the new assertion:
all exact classification fields and current binding must also pass.

Supabase's current documentation describes the hook as a pre-issuance claims
transform and client_id as the OAuth client discriminator; resource ownership
is supplied here by the durable registry, not inferred from caller metadata.
[Custom access-token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
and [OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security).

## 5. Ordinary-session noninterference

AUTH-09 through AUTH-11 run the real new hook as supabase_auth_admin and compare
the entire before/after JSONB claims object for three synthetic subjects labeled
Ministry, Consulting and Workspace web users. All three are exactly equal.
Claims include sub, iss, aud, role, session_id, email, phone, aal, is_anonymous,
iat, exp, amr, app_metadata and user_metadata. No client, MCP audience, resource
or product identity is added.

These prove semantic equality of every claim, not serialized JWT byte equality:
no token was signed and JSONB does not preserve textual key order.
ATK-27 separately proves that deliberately forged stale reserved MCP claims are
removed from an otherwise ordinary session; this is the plan's explicit
sanitization exception, not an ordinary session regression.

## 6. Valid Workspace path

Synthetic approved authorization -> narrow activation -> exclusive Workspace row
and audit -> matching live Auth session/client -> existing Workspace user grant
and dynamic switch -> Workspace-only hook claims -> true Workspace classification
assertion. AUTH-12 compares the complete expected claim object independently.

ISO-12 through ISO-16 then use the classified claims as authenticated: base
Workspace task reads return zero, direct workspace_private and Consulting-private
reads fail, and a Workspace-only user acquires no Ministry profile.
A true classifier result does not itself grant data or bypass RLS.

## 7. Ministry and Consulting behavior

AUTH-13/14 verify exact Ministry and consultant claim objects. AUTH-21/22/23
verify allowed matching classification for Ministry, consultant and client
contracts. AUTH-24 denies the Consulting client contract at the consultant
resource. ATK-25/26 remove forged Workspace markers from Ministry/Consulting
clients. No workspace_mcp marker survives for either product.

Existing product membership/capability/engagement checks remain separate and
unchanged. Classification is not proof that the subject is authorized to use a
product's tools.

## 8. Required case ledger: unknown, revoked and malformed clients

“MCP result” below means the new database classification assertion, not an HTTP
endpoint or complete tool authorization. Clean test input has no reserved fields;
on hostile input those fields are removed even when no new claims are added.

| Case | Recognized active binding? / resolved product | Token claims changed? / added | MCP result and evidence |
|---|---|---|---|
| Valid Workspace | Yes / workspace | Yes / Workspace-only set from section 4 | Matching classification allow; AUTH-12/16 |
| Ministry-bound | Yes / ministry | Yes / Ministry set, no Workspace marker | Ministry allow, Workspace deny; AUTH-13/19/21 |
| Consulting-bound | Yes / consulting | Yes / exact consultant set, no Workspace marker | Consulting allow, Workspace deny; AUTH-14/20/22 |
| Unknown registered client | No / none | Clean input unchanged / none | All three products deny; AUTH-15/25–27 |
| Revoked binding | No active row / none | No added claims; stale reserved fields removed | Deny; AUTH-35, ATK-39–41 |
| Soft-deleted Auth client with stale grant | No eligible binding / none | No added claims | Deny classification; ATK-32 |
| DISABLED binding | No active row / none | Clean input unchanged / none | Deny classification; AUTH-33 |
| Global enable OFF | Not admitted / none | Clean input unchanged / none | Deny classification; AUTH-01–03 |
| Malformed client_id | No / none | Clean input unchanged / none | Deny classification; AUTH-30, ATK-05–12 |
| NULL client_id | Ordinary branch / none | No added claims | No product classification; AUTH-31 |
| Missing client_id | Ordinary branch / none | Full ordinary object unchanged | No product classification; AUTH-09–11 |
| Duplicate/conflicting bind | Existing identity only | No second token identity | PK/immutable guard denies; AUTH-38, ATK-02–04 |
| Wrong expected product | Existing Workspace / workspace | Valid Workspace set only | Assertion denies wrong product; AUTH-32 |
| Wrong expected resource | Existing Consulting-client / consulting | Exact client-resource set only | Consultant-resource assertion denies; AUTH-24 |
| Wrong incoming/expected audience | Binding exists; classification withheld | No added set; mismatched audience not rewritten | Deny new classification; AUTH-28, ATK-20/21 |
| Wrong incoming resource | Binding exists; classification withheld | No added set; reserved resource removed | Deny new classification; AUTH-29, ATK-19/22–24 |

## 9. Cross-product denial matrix

Directly exercised cells are listed rather than implying unexecuted HTTP tests.

| Issued classification | Workspace assertion | Ministry assertion | Consulting /mcp assertion | Consulting /mcp/client assertion |
|---|---|---|---|---|
| Workspace | Allow AUTH-16 | Deny AUTH-17 | Deny AUTH-18 | Exact-resource mismatch by source; not separately exercised |
| Ministry | Deny AUTH-19 | Allow AUTH-21 | Different-product mismatch by source; not separately exercised | Different-product mismatch by source; not separately exercised |
| Consulting consultant | Deny AUTH-20 | Different-product mismatch by source; not separately exercised | Allow AUTH-22 | Exact-resource mismatch by source; not separately exercised |
| Consulting client | Different-product mismatch by source; not separately exercised | Different-product mismatch by source; not separately exercised | Deny AUTH-24 | Allow AUTH-23 |
| Unknown | Deny AUTH-25 | Deny AUTH-26 | Deny AUTH-27 | Missing-binding denial by source; not separately exercised |

The requested Workspace/Ministry/Consulting cross-denials are executed.
The assertion re-resolves the current registry: ATK-41 proves a previously
classified Workspace claim object fails after revocation. No current HTTP
endpoint has been wired to this assertion in Stage 1.

## 10. RLS and isolation regression

A newly created disposable database replayed 21 Consulting migrations from the
immutable ref, 19 unchanged Workspace migrations, then the additive Stage 1
migration. It started with a schema-only managed Auth/storage shell from the
existing local stack, no copied data, plus pgcrypto, uuid-ossp and pgTAP.
Storage policies from the shell were omitted so product source could restore
them after dependent tables existed. Existing local supabase_admin restored the
managed shell; postgres applied product migrations. No cluster roles were
created or granted new bypass authority.

Workspace: hostile access 25; productization 70; product events 5; Lewis parity 31;
connector capabilities 27; preference parity 20; bundle entitlements 58; SOTF
operational workflows 34. **270/270**.

Consulting: assessment participation 12; client MCP workspace 11; Entry identity
linking 14; mission assessments 11; OAuth MCP 14; operational AI 22; foundation 32;
Meridian core 27; Consulting core 45; meetings/coaching 48; alignment 29; outcomes
27; grounded AI 22; signals 22; pilot remediation 6; prospect security 10;
access handoff 9. **361/361**. These are read-only source replays and local tests,
not changes to Entry or other excluded workstreams.

The independent representative Ministry/Workspace isolation shell added
**18/18** checks, including the exact current_ministry_id function body and the
Gate A tenant-existence policy pattern. It is not a full Ministry migration/RLS
replay. Existing product schemas and all four new private tables retained RLS.
No existing policy, entitlement, membership or capability implementation changed.

## 11. No service-role or new generic elevated runtime path

No service-role key, secret key, OAuth token, real fixture, elevated SDK client,
new database role or BYPASSRLS grant was added. Runtime table access and direct
internal resolver/hook execution are denied in AUTH-39–46 and ATK-15–18/31.
New table/sequence/function privileges explicitly revoke service_role access.

The migration does contain narrowly scoped SECURITY DEFINER functions, as the
approved Stage 1 plan requires. Their database-owner authority is limited to
fixed catalog/binding/session/authorization checks and audit writes; empty
search_path and qualified object names are used. Authenticated callers receive
only activation/revocation booleans and a claims-derived assertion boolean.
The internal composite resolver is not callable by authenticated/anon/service_role.
This is not a general Auth lookup or a runtime bypass credential.
Existing Consulting elevated callers are untouched Stage 3 work.

## 12. Post-authored adversarial pass

The 46 authored assertions passed before this separate attack file was written.
No independent agent was used; independence here means separately authored
adversarial cases and literal expected outcomes rather than expectations
calculated by the resolver. **44/44 passed**, including **42 attack scenarios**
and two final durable-state/audit invariants:

| IDs | Attack |
|---|---|
| 01 | Unknown client forging Workspace product/session/resource/marker |
| 02–04 | Direct reassignment, duplicate row, approved changed-resource rebind |
| 05–12 | Uppercase, leading/trailing whitespace, UUID braces, numeric/array/empty/nil identifiers |
| 13–14 | Missing or unknown durable binding status |
| 15–18 | Direct registry read, enable write, hook call, internal Auth resolver call |
| 19–24 | Cross-product resource/audience, audience array, NULL/suffix/fragment resource |
| 25–27 | Ministry/Consulting Workspace-marker inheritance; stale ordinary-session markers |
| 28–31 | Cross-client session, cross-user session, wrong issuer, elevated-role classification |
| 32–33 | Deleted Auth client with stale grant; revoked Workspace resource grant |
| 34–36 | Other user's consent/revocation; MCP bearer attempting activation |
| 37–38 | Missing PKCE; uncatalogued caller-chosen resource |
| 39–42 | Consent replay after revocation; next issuance; old token assertion; tombstone deletion |
| 43–44 | No extra binding and exact four-activation/one-revocation audit count |

No repair was made in response to a reproducible authority defect: none was
found. Setup/fixture compatibility errors were corrected before the successful
authored pass. Multi-connection race stress, real OAuth exchange/refresh timing,
signed-JWT verification and hosted operation were not tested.

## 13. Fresh validation counts and reproduction

| Check | Fresh result |
|---|---|
| Stage 1 authored DB | 46/46 PASS |
| New attack DB | 44/44 PASS |
| Representative additional isolation DB | 18/18 PASS |
| Unchanged Workspace + Consulting DB baseline | 631/631 PASS |
| Total distinct scoped transactional assertions | **739/739 PASS** |
| Harness JavaScript syntax | PASS |
| Ministry design-check | PASS |
| Ministry typecheck | PASS |
| Ministry lint | PASS |
| Ministry build | PASS; Next 14.2.35, 196/196 generated pages |
| Ministry full unit run | **1486 passed, 1 failed**, 227 files (226 passed, 1 failed) |
| Scoped Ministry browser run | Initial 3/4; unchanged rerun **4/4 PASS** |
| Full browser suite | Not run; selected OAuth/settings suites only |
| npm ci | Skipped: unchanged lockfile and existing dependency tree reused via node_modules junction |
| check:boundaries / test:schema | Not defined in the Ministry package; no Workspace implementation change made |
| Full Ministry clean-source replay | Not established by this scoped mixed-schema fixture |
| Actual configured Auth hook / signed OAuth exchange / production | Not performed |

All three new DB suites and the entire 631 baseline passed again in the final
verification. Repeated runs are not added to the distinct count.

The single unit failure is
lib/command-center/cutover-schema.test.ts:32, the byte-for-byte frozen Workspace
clock migration hash. Evidence:

- Committed HEAD bytes SHA256: 05e100e3f5f2c7b041ba9bc1373912d9f26f4d8fbe125831f45ab7304dde85d2.
- CRLF checkout bytes SHA256: 64de3a8a707007391e7e9b37e4eb0ad0c8a2c674efbfd5d42e43e28abbb2b226.
- Checkout with CRLF normalized to LF: exactly the committed/expected SHA256.
- Neither that migration nor its test was changed. No unrelated line-ending
  repair was attempted. A byte-preserving clean checkout is the bounded
  follow-up before claiming a fully green repository suite.

The initial browser failure was a 10-second login navigation timeout during cold
compilation; the same four tests passed on rerun without source edits.
Mock Auth was explicit, local port 3197, provider/Supabase credentials cleared.
These are browser regression checks, not live OAuth integration evidence.

The identical source/isolated package-lock SHA256 is
F954CD2A8D44499C9A82F7C307737833A744D6F33BF38DD4D01070723177C016.
Dependency reuse and a schema shell make this a scoped local proof, not a wholly
independent dependency installation or a committed-state release reproduction.

Run from the isolated Ministry worktree, with the documented existing local
Docker stack and immutable source repositories available:

~~~text
node scripts/test-supa-stage1.mjs setup
node scripts/test-supa-stage1.mjs authored
node scripts/test-supa-stage1.mjs attacks
node scripts/test-supa-stage1.mjs isolation
node scripts/test-supa-stage1.mjs regression
node scripts/test-supa-stage1.mjs cleanup
~~~

The harness locks its container to supabase_db_consulting-os-phase1 and database
to supa_stage1_20260913, refuses to overwrite an existing database, checks TAP
plans/counts, and accepts no hosted database target. This is an intentionally
local reproduction harness, not a deployable production test runner.

## 14. Files changed

All implementation additions are in the isolated Ministry worktree; no tracked
pre-existing Ministry file changed:

- supabase/migrations/20260913150000_shared_oauth_product_binding.sql
- scripts/test-supa-stage1.mjs
- supabase/tests/supa-stage1/fixture.sql
- supabase/tests/supa-stage1/authored.sql
- supabase/tests/supa-stage1/attacks.sql
- supabase/tests/supa-stage1/isolation.sql
- docs/architecture/supa-stage1-pre-repair-trace.md
- docs/architecture/shared-production-stage1-oauth-binding-evidence.md
- docs/testing/test-evidence.md

The outer Supa workspace receives an identical report at the requested
docs/architecture/shared-production-stage1-oauth-binding-evidence.md path.
It sees the nested isolated worktree as untracked; that directory must not be
staged as a Workspace product change. Existing untracked reports were preserved.
Build/test outputs are ignored and are not proposed source changes.

## 15. Zero hosted mutation and cleanup confirmation

No hosted Supabase access/migration, Auth configuration, production client
registration, secret change, data migration, Vercel deployment, cutover,
infrastructure purchase, manifest/package addition, commit, push, merge or PR.
No Personal sandbox was resumed. No OG/current SOTF repair, Cash, E2/Level Up,
Paul Blart/P2, billing or Entry implementation was edited.

Only the fresh local supa_stage1_20260913 database was created, populated with
synthetic transactional fixtures, tested and then removed successfully.
Its synthetic contents are discarded and reproducible from the harness.
The existing local container and original postgres database were left in place.
No test fixtures or control enablement remain in the disposable database because
the database no longer exists. Source defaults remain OFF and empty.
The isolated worktree remains available for review; no cleanup of user work.

## 16. Stage 2 dependencies and bounded follow-up

1. **CROSS-WORKSTREAM DEPENDENCY — Workspace/OG ownership.** Later approved Stage 2
   must integrate consent activation and the shared assertion with the Workspace
   verifier/DB guard and align its hook delegation. Do not patch OG here.
2. Ministry and Consulting endpoint families must require exact product,
   session class, audience, resource and binding version plus current binding,
   then preserve current membership/capability checks before creating tools.
   The new boolean assertion is not itself wired into any HTTP route.
3. Keep the new shared hook unconfigured until reviewed packaging, current Auth
   schema/hook preflight and signed exchange/refresh testing establish actual
   invocation timing, including availability of the session row. The strict
   resolver fails closed if the session is unavailable; liveness is not yet proven.
4. Confirm later application's narrow calling path to the private assertion and
   activation without exposing the private registry/schema as a general API.
   No PostgREST exposure or endpoint wrapper was added in Stage 1.
5. Review the isolated source and reproduce the byte-sensitive unit test from a
   byte-preserving checkout before a fully-green repository readiness claim.
   No new authority-defect repair is pending; this is validation follow-up.
6. Packaging/manifests, existing Consulting secret-runtime removal and all hosted
   gates remain their separately authorized later stages. The 739 assertions do
   not authorize enabling the hook or a production binding.

**SUPA STAGE 1 OAUTH BINDING COMPLETE WITH BOUNDED FOLLOW-UP — REQUEST REVIEW**

