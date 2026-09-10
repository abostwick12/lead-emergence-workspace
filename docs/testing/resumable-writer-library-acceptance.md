# P20 resumable Writer library acceptance

Date: 2026-09-10. Branch: `codex2/bundle-experience-integration`.
Portable source revision: `f2c942da4bb09638f8f6c55bec8fb8740ebbc6c0`.
All data was fictional and isolated on loopback ports 58520–58527 and 3125.
No hosted system, provider or client account was used.

## Retained evidence

| Gate | Result |
| --- | --- |
| Portable contract | PASS — typecheck plus 205 tests in 20 files |
| P20 server contract | PASS — 6 focused tests |
| Host unit suite | PASS — 342 tests in 40 files |
| Host static checks | PASS — TypeScript, ESLint, 33 schema-policy contracts and 288 runtime boundary files |
| Fresh migration replay | PASS — all 43 migrations applied from an empty synthetic database |
| P20 database suite | PASS — 67 rollback-only PostgreSQL assertions |
| Complete database matrix | PASS — 1,403 assertions across 28 suites |
| Optimized build | PASS — Next.js 16.3.4, 58 pages/routes |
| P20 browser acceptance | PASS — desktop and mobile Chrome, 2 tests, zero retries |
| Complete Writer browser matrix | PASS — 26 desktop/mobile Chrome tests across 5 files, zero retries |
| Source export | PASS — 39 allowlisted files pinned to the source revision above |
| Supply chain / sensitive data | PASS — npm audit reports 0 vulnerabilities; working tree and release lineage scan clean before commit |

Browser acceptance selects a Word file, a Markdown file and an unsupported
file in one action. The unsupported item reports its own failure while both
valid documents enter the staging table. Edited title and type survive reload.
Exact existing/staged title and normalized-text candidates remain visibly
distinguished. Changing an include decision invalidates the review. The final
test excludes one item, confirms one import, intentionally loses the successful
HTTP response, retries, and observes one idempotent resource identity. Desktop
and mobile screenshots also verify no horizontal overflow.

## Adversarial database coverage

The P20 suite proves private-table denial and RLS, native-only RPCs, current
entitlement, canonical UUIDs, bounded numeric parsing, strict empty/aggregate
limits, exact save replay, stale-tab denial, private reload recovery, existing
and staged duplicate signals, other-tenant non-disclosure, required confirmation,
missing-token denial, library-change token invalidation, atomic multi-resource
commit, tombstoning, extracted-body-free commit receipts, exact lost-response replay,
request non-rebinding, anti-resurrection, OAuth denial and immediate revocation.

The complete 28-suite matrix rechecks all six implemented bundles and their
cross-domain isolation after this migration. Every suite rolls back its own
fixtures.

## Corrections found during proof

- The first pgTAP draft used a helper overload not installed in this PostgreSQL
  image; it was replaced with explicit string-position assertions.
- A private-table count was initially attempted while the test role was still
  authenticated; the proof now uses the public tenant-filtered library RPC.
- Direct numeric JSON could overflow an integer cast before a clean validation
  error, so canonical length guards now precede casts.
- Nullable review tokens and case-variant UUID spellings now fail explicitly.
- Receipt schemas now reject ambiguous initial states and duplicate item,
  candidate, signal and resource identities.

## Evidence limits

These results prove the implemented local boundary and browser flow. They do not
prove representative document extraction quality, a real client's complete
library migration, installed-host behavior, hosted backup/privacy/retention,
provider/Wix operation, support response, payment enforcement or measured
client value. Overall shipment remains **NOT READY TO SHIP**.
