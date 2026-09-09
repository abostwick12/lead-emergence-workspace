# P12 — Native shared saved-work attention

2026-09-09. Implementation checkpoint, not client shipment.
**All six bundles remain NOT READY TO SHIP.**

## Milestone, repositories and integration

Workspace Experience 0.4.0 implements the native Attention page and Home
widget across thirteen record and nine task scopes. Complete counts,
source/priority filters, 25-cue pages, current-access checks and exact
source/task links make the user's own saved work reviewable in one place.
Existing confirmed layout controls own the widget's visibility and order.
Connection/notification consumers are the next slice, not completed here.

Host: abostwick12/lead-emergence-workspace, owned branch
codex2/bundle-experience-integration.
Starting HEAD: 4ccc92c935f709e567ba93e0c1964f391570c6e9.
Source: abostwick12/lead-emergence-bundles, owned branch
codex2/bundle-platform-v1.
Starting HEAD: 4f40fa72bfe03b513d049de817b12e70471a6d10.
Portable feature pin: b7c52e1f9f2a75beb3e701c5b303d95c7b7bc8fa.

Bundle Contract 1.0 and UI Manifest Contract 1.0 are unchanged. The host now
imports 33 pinned portable files, including the attention contract. Plugin
package versions remain 0.1.0; no app ID, connection or model tool is invented.
Only the owned branches may be published. Neither main, repository visibility,
hosted database nor production deployment is changed.

See [architecture and authority](../architecture/workspace-native-attention.md).

## Files and responsibility

- Portable source: attention contract/test; Experience version and implemented
  Attention navigation; native attention, platform and readiness documentation.
- Host runtime: attention HTTP route and native page, full/compact component
  and styles, Home registry, navigation, pinned catalog/contract/lock.
- Persistence: migration 35 native guard, projections, catalog/query RPCs and
  capability; migration 36 implemented widget admission. No new data table.
- Verification: native and actual OAuth runners, database suite/runner,
  static boundary tests, desktop/mobile attention journeys, and existing
  layout expectations updated for the implemented widget.
- Evidence: this ledger, architecture, test-evidence index and synthetic
  screenshots. Local credentials and complete private fixtures are excluded.

## Test ledger

- PASS: portable typecheck and 147 tests in fourteen files; all six official
  plugin validators and all six skill validators.
- PASS: host typecheck, lint without warnings, 303 unit tests in 33 files,
  32 schema-policy checks and 264 runtime boundary checks.
- PASS: optimized production build, 55 static pages.
- PASS: retained isolated fictional database upgraded to 36 migrations;
  664 rollback-only assertions across 21 suites.
- PASS: brand-new named bundle-search-fresh-p12 database replayed all 36
  final migrations and the same 664 assertions; zero users retained.
- PASS: nine real native HTTP/RPC groups. Twenty-two scopes, complete
  18,062-cue result, distinct pages, actual offsets 10,025 and 15,000,
  all five bundle and three priority filters, count reconciliation,
  malformed/oversized/stale requests, per-domain revocation, no-Executive
  native use, two independently entitled owners and confirmed layout restore.
- PASS: three actual loopback OAuth/PKCE/MCP groups. The existing five domain
  toolsets still compose. An all-six-assigned OAuth bearer cannot call either
  native attention RPC or the HTTP endpoint; no attention MCP tool appears.
  The temporary fictional grant is disconnected in cleanup.
- PASS: twelve existing native layout HTTP/RPC groups with the new widget.
- PASS: 26 focused optimized desktop/mobile-emulated Chrome journeys in
  1.7 minutes, zero retries: twelve attention and fourteen layout cases.
- PASS: all 162 optimized whole-bundle desktop/mobile journeys in 9.8 minutes,
  zero retries. This run precedes final manifest wording, card spacing and the
  compact Home presentation;
  no query/ranking logic, HTTP handler, database function or editor changed afterward.
- PASS: final 26 focused attention/layout journeys in 1.7 minutes after all
  presentation corrections, zero retries. Two further Home journeys passed in
  14.7 seconds to capture unobstructed viewport evidence; no app code changed.
- PASS: six final synthetic screenshots individually inspected and packaged in
  [attention-proof](attention-proof/README.md).
- PASS: all 33 transformed portable exports and SHA-256 hashes match the
  feature pin. Final packaged-file credential scan is recorded below.

The focused attention journeys exercise actual current counts, filter/page
changes, original links, precise task visibility/focus, failed-load clearing
and retry, rejected late responses, unavailable versus assigned-empty access,
and preview/confirmation-backed Home hiding/restoration. Deliberately injected
HTTP failures are labelled synthetic, not misrepresented as provider outages.

## Reproduction and corrected attempts

The native runners require the explicitly isolated bundle-experience-p2 stack
on ports 58520–58527, the optimized app at http://localhost:3125, and retained
fictional fixtures with the P11a scale corpus. They are not safe instructions
to point at hosted or client data. Test fixtures contain 15,000 scale records
for one owner and 500 Writing controls for another, plus preserved earlier
fixtures. Attention counts are cues, not unique source records.

Run the repository's test:attention:local, test:attention:connected,
test:layout:local and test:bundles:rls:local commands with that local environment.
The attention browser spec additionally requires ATTENTION_LOCAL_ACCEPTANCE.
The whole-bundle run enables the established Writer, Ministry, Nonprofit,
Investor, Executive, layout and search fixture flags plus
SEARCH_SCALE_LOCAL_ACCEPTANCE. Both configured Chrome viewports use zero
retries. A fresh replay uses a new explicit suffix in the existing
scripts/test-search-fresh-local.mjs runner; never overwrite an earlier backup.

Final packaging review also corrected the widget's stale planned-connection
attention type and false all-clear empty-state copy. Its declaration now names
saved-work cues; a new portable regression covers that claim. The host export
was repinned. Visual review then found insufficient cue-card padding; explicit
card spacing and coverage separation were added, with a browser padding
assertion. The first Home capture also exposed excessive repeated detail, so
its three-cue summary now puts reasons/next moves in expandable explanations
and omits the full overview panel. A browser test checks that compact behavior
and retained next-step detail. Final focused browser/visual acceptance follows
these corrections.

During development the initial attention offset cap inherited search's 10,000
limit. Review caught that it would strand a large queue. The source and native
function now permit pages through offset 2,147,483,000; tests include 10,025 and
15,000. The corrected function was reapplied only to the named local development
database, without migration-history repair or reset. The subsequent fresh
36-migration replay proves the final checked-in SQL.

An initial test fixture required a literal type annotation. The database
binding test was corrected to use runtime_capability_id before execution.
The owner-control test initially split on literal backslash-n, which did not
form individual IDs. Review corrected it to a newline and added a >12,000-ID
control-set assertion; all nine native groups passed again. Only the corrected
run is counted as owner-isolation evidence.

## Security and OpenAI findings

Native session identity, Workspace Experience assignment, current per-source
capabilities and authority revision are independently enforced at the database.
Executive assignment and assistant source-sharing consent are not needed for
the user's own view; no model permission is granted by it. Full bodies,
profiles, recovery drafts, proposals, availability and providers are excluded.
There are no source writes, outgoing actions, reminders or stored query history.

The OpenAI Docs skill reinforced this separation. Rechecked
[official authentication guidance](https://developers.openai.com/plugins/build/auth)
on 2026-09-09: token verification is enforced by the server, and declared
metadata is not authority. No OpenAI protocol or installed-host behavior changed.
Local OAuth proof does not substitute for installed ChatGPT/Codex acceptance.

## Final environment and publication

Aggregate audit after the whole-bundle run: 36 migrations, 19 fictional users,
zero non-fictional users, sixteen search and twenty-two native attention scopes,
zero Executive record/task shares, four preserved pre-existing MCP grants,
zero new active MCP grants, and zero active temporary other-owner Writer
assignments. The same aggregate audit passed again after final visual tests.

The optimized preview and named main fictional stack are stopped. The fresh
P12 stack was already stopped; both data backups are preserved. No material
saved data was deleted. All 33 transformed exports/hashes match the feature
pin. A narrow changed-file credential scan passed for all 41 files across both
repositories, including packaged evidence; this is not a historical secret
or comprehensive privacy audit. Only the owned branches are published.
Final immutable repository heads belong in the accompanying checkpoint.

## Remaining gates

NOT RUN: representative human-written source-quality/cue-utility evaluation,
unaided first useful outcome or measured client time saved, concurrent-client
load, deployed recovery/privacy/retention and rollback, installed ChatGPT/Codex
lifecycle, authorized provider success, payment enforcement, hosted migration,
production deployment or marketplace submission.

No new provider or client configuration is required for this native slice.
Before shipment, finish the connection/notification center, approved recurring
lifecycle, grounded approval-only AI layout proposals, remaining ingestion and
crash-recovery work, then representative and authorized installed/deployed
release acceptance. Persistent snooze/dismiss choices and redundant cue
grouping are not implemented. Optional providers do not block native work.
