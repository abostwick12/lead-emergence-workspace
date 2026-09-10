# P13 — connection center acceptance ledger

Date: 2026-09-09 (America/Chicago). Local-only implementation milestone.
Overall bundle release decision: **NOT READY TO SHIP**.

Repository/branch: abostwick12/lead-emergence-workspace /
codex2/bundle-experience-integration.
Starting HEAD: ec61dd4f18d911d5c3ff0527755449af84eb9557.
Portable contract HEAD: 107e106661bf7f3b90e0e69a65333900bb26bca0.
Portable documentation HEAD: 85bf41eae9d8ebb6acb67c592c6ef7166be28978.
The local P13 checkpoint records the final published host HEAD.

## Implemented and checked

| Gate | Result |
| --- | --- |
| Portable typecheck and tests | PASS: 152 tests / 15 files |
| Existing plugin/skill validation | PASS: all six plugins and all six skills |
| Host boundary check | PASS: 266 runtime files |
| Schema-policy contracts | PASS: 32 |
| Host typecheck and lint | PASS |
| Host unit suite | PASS: 308 tests / 34 files; final isolated run with maxWorkers=1 |
| Optimized build | PASS: 55 generated pages and native connection API |
| Upgraded isolated PostgreSQL | PASS: 703 assertions / 22 rollback suites |
| Fresh isolated PostgreSQL | PASS: all 39 migrations, 703 assertions, zero retained users |
| Actual local OAuth/PKCE/MCP | PASS: five acceptance groups, temporary test grants revoked |
| Desktop/mobile connection flow | PASS: 14 / 14 on the final optimized app and 39-migration database, 1.3 minutes, zero retries |
| Export and narrow credential review | PASS: 34 transformed source files and SHA-256 hashes; no detected changed-source credential pattern |
| Real provider/installed-host/client trial | NOT RUN; no authorization or release claim |
| Hosted migrations, main merge or deployment | NOT RUN; outside this milestone's authority |

The final unit run keeps the same assertions and default test timeout. A concurrent
build/parallel run timed out in five MCP-registration tests. The isolated one-worker
rerun passed all 308 tests in 37.57 seconds; the final Settings-integrated run passed all 308 again in 50.40 seconds. No product assertion was removed or
timeout increased. Earlier full unit runs also passed.

## Database coverage

The new 39-assertion suite uses rollback-only fictional owners and OAuth clients.
It checks metadata-only false positives, orphan consent, 31 assistant records
across complete 25/6 pages, active/blocked grants, expired/missing credentials,
private projections, owner isolation, OAuth rejection, malformed pages and review
inputs, suspension-safe privacy controls, all three Google consumers, unchanged
other families, stale credential reviews, receipt identity conflicts, a new
credential surviving an old request retry, and orphan grant revocation.

Migration 38 serializes first consent and native revocation using the same
user-bound database lock; host contracts verify both paths participate. Actual
OAuth activation and revocation succeed. A controlled concurrent provider-consent
load test is not claimed. Migration 39 makes reviews stable across routine assistant/provider activity while preserving invalidation for new consent, scopes, registration-state changes and credential replacement. Three additional SQL assertions and repeated real MCP requests verify this behavior. SQL scripts never run against a hosted database.

## Actual local protocol evidence

A real local dynamic client, explicit consent, PKCE exchange and HTTP MCP
registration were used with the fictional all-bundle account. The center first
reported unfinished consent, then authorized registration. All five functional
bundle toolsets remained available. No connection-center tool was added.

The actual OAuth bearer was rejected by both native connection RPCs and HTTP
routes. Native inputs rejected foreign ownership, malformed pages, missing
confirmation, oversized bodies and caller-supplied workspace identity. A confirmed
native disconnect returned an exact retry receipt and blocked registration with
the previously valid bearer.

An initial test was deliberately not accepted: the optimized localhost app
correctly enforced the production MCP hostname check (421). The unfinished
fictional consent was identified and revoked through the center. The protocol test
then passed using the development preview; no production hostname check was
disabled and no production hostname was forged.

## Browser, presentation and failure recovery

The seven scenarios run in desktop Chrome and Pixel 7-emulated Chrome with one
worker and zero configured retries:

1. Actual saved-label evidence, optional Wix/Finances guidance, no credential
   collection, responsive layout, review/cancel focus and unchanged metadata.
2. Confirmed disconnect with a deliberately lost successful response; retry
   carries the identical request and produces one receipt.
3. A changed connection rejects the stale review without being overwritten.
4. Failed refresh clears rows/counts and an explicit retry obtains current data.
5. A delayed response cannot repopulate status after the page clears while away.
6. Opening assistant setup leaves the onboarding row byte-for-byte unchanged.
7. Settings reaches this same center without reading raw authorization labels or offering a separate direct disconnect button.

The development run passed all 12 scenarios in 2.9 minutes. A prior 10-scenario
optimized run passed before the late-response scenario and final presentation
refinements. An intermediate optimized run was interrupted to rebuild the final
receipt wording and is not release proof. Initial test-only errors (fixture ID
field and a selector also matching Next's route announcer) were corrected.

Presentation review corrected missing theme variables and tightened panel/paragraph
spacing. Receipt wording does not imply a grant or credential previously existed.
Screenshots are actual fictional-data browser captures, not design mocks.
The final combined run passed all 14 scenarios in 1.3 minutes against the optimized
app and migration 39. Settings delegates to the same center; no raw assistant-status
read occurs on that entry path.

Proof captures: [desktop overview](connections-proof/connections-desktop.png),
[mobile overview](connections-proof/connections-mobile.png),
[desktop review](connections-proof/connections-review-desktop.png),
[mobile review](connections-proof/connections-review-mobile.png).

## Security and local cleanup

Only the existing 19 fictional accounts are used. No real user or provider account
is connected. The four older local active MCP grants are preserved; no new active
test grant remains. Record/task model-sharing settings remain zero. Search retains
16 scopes and attention 22 scopes. Temporary browser metadata and its receipts
are removed by fixture-specific cleanup; no saved bundle work is removed.
Fresh replay stops with its named backup preserved.

The preview and main fixture database are stopped after final proof, preserving
the local backup. Exact cleanup and final repository states are recorded in the
P13 checkpoint.

## Scope of confidence and next step

This milestone proves a native connection evidence/confirmation flow and private
authority boundaries locally. It does not prove human usefulness, live provider
health, installed ChatGPT/Codex behavior, release-host availability, notification
delivery, crash recovery or client deployment. P12's separate 162-scenario
all-bundle browser regression remains prior evidence; that whole suite was not
rerun for P13. Native notification read/dismiss/preferences is the next build
step, followed by the remaining shared client-readiness gates.

Architecture and external-configuration boundaries:
[Native connection center](../architecture/workspace-connection-center.md).
