# P21 Writer publication-readiness acceptance

Date: 2026-09-10. Branch: `codex2/bundle-experience-integration`.
Portable source revision: `8cbbeea5a32a2c4ebce5d1f1c5b3433982cdce9f`.
All data was fictional and isolated on loopback ports 58520–58527 and 3125.
No URL was fetched by the server and no hosted system, provider or client account
was used.

## Retained evidence

| Gate | Result |
| --- | --- |
| Portable contract | PASS — typecheck plus 217 tests in 21 files |
| P21 server contract | PASS — 15 focused unit assertions |
| Host unit suite | PASS — 350 tests in 41 files |
| Host static checks | PASS — TypeScript, ESLint, 33 schema-policy contracts and 295 runtime boundary files |
| Fresh migration replay | PASS — all 44 migrations applied from an empty synthetic database |
| P21 database suite | PASS — 87 rollback-only PostgreSQL assertions |
| Complete database matrix | PASS — 1,490 assertions across 29 suites |
| Optimized build | PASS — Next.js 16.3.4, 59 pages/routes |
| P21 browser acceptance | PASS — desktop and mobile Chrome, 2 tests, zero retries |
| Complete Writer browser matrix | PASS — 28 desktop/mobile Chrome tests across 6 files, zero retries |
| Source export | PASS — 40 allowlisted files pinned to the source revision above |
| Supply chain / sensitive data | PASS — npm audit reports 0 vulnerabilities; working tree and release lineage scans clean before commit |

Browser acceptance creates a unique fictional reviewed resource and adds its
exact revision to the queue. It intentionally loses the successful queue-create
response, retries the exact request and recovers one identity. The user saves a
public-looking destination, records three human confirmations, opens the link
client-side, confirms the observation and deliberately loses that response too.
The exact retry recovers one evidence record.

The flow then reaches derived readiness, records an exact-revision handoff and
continues to say “not published.” A newer resource revision makes the prior plan
stale. Rebase binds the new revision and proves that every human confirmation
resets. The item is removed after each case so repeated acceptance runs do not
pollute the queue. Desktop and mobile screenshots verify the complete handoff
state, readable long-title wrapping and no horizontal overflow.

## Adversarial database coverage

The P21 suite proves direct-table denial/RLS, native-only authority, current
entitlement, tenant isolation, strict payload keys, destination validation,
canonical identities, exact retry recovery, request non-rebinding, stale-version
denial, removal recovery, audit-history retention, revision and destination
staleness, newest-evidence ordering, 30-day expiry, broken/access-limited blockers,
rebase confirmation reset, derived-ready enforcement, handoff sequencing, OAuth
denial and immediate revocation.

The complete 29-suite matrix rechecks all six implemented bundles and their
cross-domain isolation after the migration. Every suite rolls back its own
fixtures.

## Corrections found during proof

- PostgreSQL in the isolated image lacked `jsonb_object_length`; a strict local
  helper now performs the portable object-key count.
- Ambiguous procedure parameters were qualified so database checks cannot bind
  the wrong identifier.
- Transaction timestamps can tie across observations, so newest evidence is
  selected by monotonic queue version rather than wall-clock time.
- Existing manifest-count assertions were updated for the sixth Writer
  capability; the dashboard test now verifies the queue's truthful clean state.
- Visual review found an unbroken fictional identifier overflowing a mobile
  heading; the card now permits safe wrapping without changing the content.

## Evidence limits

These results prove the implemented local boundary and browser flow. They do not
prove a real destination, real-client content, Wix behavior, installed-host
behavior, hosted backup/privacy/retention, support response, payment enforcement
or measured representative value. Overall shipment remains **NOT READY TO SHIP**.
