# P14 notification acceptance ledger

Milestone: P14, 2026-09-09. Implementation checkpoint, not client shipment.
Host branch: codex2/bundle-experience-integration; starting HEAD
e25fd73733fc384e01fb1107323a823cebc540f8.
Portable branch: codex2/bundle-platform-v1; pinned implementation
e9f666768c9794ea7b9a55f975ae907c6e77353c, 35 allowlisted export files.
All six bundles remain **NOT READY TO SHIP**.

See [the authority and UX contract](../architecture/workspace-notifications.md)
and [the four unedited desktop/mobile screenshots](notifications-proof/README.md).

## Checks and evidence

| Check | Outcome |
| --- | --- |
| Portable type checking and tests | PASS: 157 tests in 16 files |
| Installed local plugin / skill validators | PASS: six plugins and six skills; not installed-host proof |
| Host type checking / lint / optimized build | PASS; final build has 56 generated pages |
| Host unit / schema / boundary checks | PASS: 313 unit tests, 32 schema contracts, 269 runtime files |
| Local database security | PASS: 796 assertions in 23 suites, including 93 notification assertions |
| Fresh named local replay | PASS: all 40 migrations, all 796 assertions, zero retained users; stopped with backup preserved |
| Final notification desktop/mobile workflows including keyboard focus | PASS: 14 tests in 1.3 minutes against the final optimized build, zero retries |
| Cross-bundle desktop/mobile regression | PASS: 190 tests in 10.9 minutes, zero retries; two unrelated SOTF component-harness cases intentionally skipped. This precedes the isolated keyboard-focus follow-up below. |
| Actual local OAuth native-only notification boundary | PASS: four groups using actual local OAuth/PKCE/MCP; temporary fictional grant revoked |
| Export hashes and narrow changed-source credential scan | PASS: 35 transformed exports and SHA-256 hashes; changed-source scan rerun before publication. This is not a full historical secret/privacy audit. |
| Representative client usefulness, installed host, deployed acceptance | NOT RUN; not inferred from local synthetic tests |

Local tests use fictional example.invalid accounts. The existing large-library
corpus remains intact. Database suites roll back their own fixtures. The fresh
p14 database is separately named and does not reset any previous backup.

## What the notification checks prove

- Native owner, core plan, Experience capability and per-source admission checks.
- No direct anon/authenticated table grants; RLS on all four private personal-choice tables.
- No body/credential/foreign-source leakage in returned metadata.
- Eight current type contributions; independent Executive capability admission.
- Saved account time zone, full counts, bounded pages and exact type filtering.
- Read/dismiss/restore, 24-hour snooze, expiry-on-next-check, mute/unmute persistence.
- Source-date changes reopen unread; routine title edits preserve acknowledgement
  fingerprints; resolution/revocation removes current items and rejects old writes.
- Exact receipt retries, conflicting request rejection, stale-tab rejection,
  distinct bounded bulk items and no source-record mutation.
- Browser page-read applies to only the visible reviewed set, including a test
  where a new source arrives after the page is loaded.
- Lost responses reuse the same request and do not extend snooze.
- Failed refresh and leaving the tab clear data; late responses stay ignored.
- Reload persistence, accessible controls, native source navigation and
  Experience-only other-owner isolation.

Preference controls wait for saved state instead of showing optimistic success.
A stronger follow-up found that focus could be attempted before refreshed
controls mounted. The follow-up moves focus after the verified data renders;
its final focused desktop/mobile acceptance is recorded below.
They retain the open preference panel and focus after changes. The initial test
used a synchronous checkbox-state expectation; it was corrected to click and
then assert the verified saved result. No server assertion or timeout was weakened.

## Issues found during implementation

An early shell edit accidentally removed the workspace stage. Browser acceptance
caught it; the stage was restored and a shell-content regression assertion added.
The first rerun found an interrupted fictional fixture, which was removed only
after checking that no saved notification choices existed. An explicit HTML
label was added to the update-type control after exact label lookup exposed the
implicit wrapper's ambiguity. Final visual review refined card spacing and
removed the clipped mobile greeting while preserving action controls and clocks.

A local migration helper initially lacked three previously applied P13 migration
copies. The local copies were synchronized; no history repair/reset or hosted
operation was used. The unpublished mutation function was corrected for an
ambiguous variable and verified from a fresh installation. An audit wrapper
initially substituted digits inside a historical hash; the wrapper was corrected
and rerun, without modifying any repository data.

The final keyboard-focus assertion passes on desktop and mobile after refreshed
controls mount. All 14 notification workflows were rerun on the final optimized
build. The 190-test broad run preceded only this isolated focus-timing correction;
it was not repeated afterward. Its two skipped tests require a different SOTF
component harness and are not counted as passes.

These intermediate failures are not passing acceptance evidence. Only completed
final runs qualify.

## Delivery limits and remaining release work

This is an in-app current-condition inbox, not email/push, background monitoring,
scheduled reminders, full event history or a live provider/market check.
Connection cues link to the connection center with a short source reference.
Saved work remains unchanged by all notification choices.

No main merge, hosted migration, production deployment, paid infrastructure,
public plugin listing, external provider authorization or client account access
is part of this milestone. Source branch publication is not a client release.

Remaining gates include shared editor crash recovery, richer resource ingestion,
grounded approval-only layout proposals, representative source/value testing,
installed-host invocation/update/removal/reconnect, and approved deployed
recovery/privacy/retention/entitlement/payment operations.
