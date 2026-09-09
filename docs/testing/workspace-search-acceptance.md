# P11 — Native shared search and quick actions

Date: 2026-09-09. Implementation checkpoint.
**All six bundles remain NOT READY TO SHIP.**

## Milestone and architecture

Sixteen current saved-work scopes now have a native-user-only search consumer.
Ten honest navigation shortcuts span the six assigned bundles, with a keyboard
action palette that preserves Quick Capture's existing shortcut. Original
records remain the source of truth; shared search neither creates a combined
private corpus nor grants cross-domain assistant access.

See [architecture and user journey](../architecture/workspace-saved-search.md).

Bundle Contract 1.0; UI Manifest Contract 1.0; Workspace Experience 0.3.0.
Source feature revision: afb0e0386c446f51e3e8a70b641e2c5c69b9240b.
Published source branch: codex2/bundle-platform-v1 at
c016b2d34ee7817909049d6305190dade1ca7d1e (documentation follows the feature pin).
The host imports 32 explicit, hashed portable files. No client configuration,
identity fixture, credential or provider account is included in that export.

## Implemented files

- Portable discovery contracts/provider registry and source Ministry/Investor
  provider declarations; source contract and capability tests.
- Migration 20260912120000_workspace_saved_search.sql; registered private
  providers, current-capability native catalog/search RPCs, no direct grants.
- app/api/bundles/search/route.ts; bounded input, strict private responses.
- app/workspace/search and components/bundles/workspace-search.tsx.
- lib/bundles/quick-actions.ts, components/bundles/quick-actions.tsx and shell
  navigation/shortcut integration; responsive scoped search styles.
- Local fictional seed, real HTTP/SQL/OAuth tests, clean-database verifier,
  unit tests, optimized desktop/mobile journeys and this evidence.
- Mechanical local-port changes in existing isolated runners/browser tests;
  Windows reserved the prior range. Existing data and backups were preserved.

## Test ledger

- PASS: portable source typecheck and 134 tests in 13 files.
- PASS: six official plugin validations and six skill validations.
- PASS: Workspace 295 unit tests in 31 files, typecheck and lint.
- PASS: 32 schema-policy assertions and 261 runtime boundary checks.
- PASS: optimized production build, 54 static pages.
- PASS: existing named local database upgraded from 32 to 33 migrations.
- PASS: 650 real PostgreSQL assertions in 20 rollback-only suites.
- PASS: new named local Supabase database replayed all 33 migrations; all
  650 assertions passed there too. Zero auth users retained; backup preserved.
- PASS: eight actual native HTTP/RPC groups, rerun after port configuration:
  16-scope catalog, Experience-only empty state, missing-access denial,
  complete two-page retrieval of 47 saved fictional records, exact-title rank,
  each provider independently, body matching, other-owner exclusion, truthful
  counts, strict malformed/oversized/forged inputs, direct SQL validation,
  stale authority, mid-pagination revocation, restoration and anonymous denial.
- PASS: three actual OAuth/MCP groups; existing five domain toolsets compose,
  while both direct RPC and HTTP deny native catalog/search to a real
  all-six-assigned OAuth bearer. Temporary fictional grant disconnected.
- PASS: all 146 optimized desktop/mobile journeys across eleven specs, 9.5
  minutes, zero retries. Includes all existing six-bundle regression and sixteen
  new discovery journeys. The final keyboard fix also passed a separate two-case
  desktop/mobile check before the full rerun.
- PASS: all 32 transformed exports match source and their SHA-256 hashes.
- PASS: final narrow changed-file credential scan (52 files), including
  packaged evidence. Not a full historical secret or private-content audit.
- PASS: four final success screenshots individually inspected on desktop/mobile.
- PUBLICATION TARGET: existing owned integration branch, verified separately
  after commit; no merge to main or deployment is authorized.

Final aggregate audit: 33 migrations; 19 fictional auth users; zero
non-fictional users; 16 admitted search scopes; zero Executive record/task
shares; four pre-existing active MCP grants preserved; zero new active grants.
The optimized preview and both named local databases were stopped with backups
retained. No material data was deleted.

The 47 searchable records and one other-owner record are explicit local
fictional acceptance fixtures, not client data or a measured value pilot.

## Corrected test attempts

The first local resume failed because Windows had reserved 58368–58467.
Read-only port checks identified an unused replacement range. Only the named
test configuration moved; no system reservation or other project changed.

The first fictional seeder tried to copy a database-generated search vector.
PostgreSQL rejected the first insert; no partial data was written. The seeder
was corrected to insert only ordinary saved-record fields. Seeding then passed.

Initial browser run: ten passes and six failures across desktop/mobile.
One real palette-focus issue was corrected by explicitly focusing the input
after opening the native dialog and restoring the previous focus on close.
Two test assumptions were corrected: Ministry's original title is a field,
not its static page heading; asynchronous action loading must be awaited.
A subsequent full run exposed Chrome consuming Escape to clear a nonempty
search field before closing its dialog. The palette now handles Escape at the
dialog boundary. That in-progress run was stopped for a corrected full rerun.
Scope controls were compacted and header/card responsiveness improved before
the final optimized build. No failed run is counted as final acceptance.

## Security and operating boundaries

Native session AND owner workspace AND active Experience search AND each
selected domain capability are required on every page. Writer body discovery
requires both library and review. Private profiles are never searchable.
Unknown or revoked scopes fail, not silently disappear inside a partial result.
No query history, cross-domain model tool, sharing permission, save, send,
publish or provider request is created by search/shortcuts.

The mobile keyboard journey took 31 seconds in the full run versus 2.2 seconds
in its focused check. This is functional acceptance, not a client latency claim.
Large-library latency, database query memory and realistic record-size/load
behavior are not measured by these 47-record fixtures. Search responsiveness
and retrieval quality on a representative library remain explicit release gates.

This is not a comprehensive penetration test, historical secret scan, private
text classifier or deployed logging/retention audit. Free text still requires
human review before external sharing.

## Platform, integration and remaining gates

No OpenAI API, MCP protocol version, plugin distribution or installed-host
behavior changed. Native shared search is deliberately absent from the model
tool catalog, with actual OAuth denial proof. Source/plugin validation is not
installed ChatGPT/Codex proof.

No production merge, hosted migration, deployment, provider account access,
paid infrastructure, marketplace publication or visibility change occurred.
The public Workspace branch contains the allowlisted portable implementation;
the source repository retains its existing private visibility. Source
publication does not enforce a paywall; backend entitlements must do that.

Next: shared attention and connection/notification consumers, grounded advisory
layout proposals, remaining domain recovery/ingestion workflows, representative
source-quality/unaided-value pilots, installed-host acceptance and approved
deployed recovery/privacy/payment/operational gates. Optional providers are
not prerequisites for finishing the remaining native work.
