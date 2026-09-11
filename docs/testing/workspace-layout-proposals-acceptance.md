# P22 Workspace layout proposal acceptance

Date: 2026-09-10. Branch: `codex2/bundle-experience-integration`.
Portable source revision: `8678d1e552bfcde404229f17c69fd78d3ed7e878`.
All identities and content were fictional and isolated on loopback ports
58520–58527 and 3125. No hosted system, provider or client account was used.

## Retained evidence

| Gate | Result |
| --- | --- |
| Portable contract | PASS — typecheck plus 227 tests in 22 files |
| Host unit suite | PASS — 353 tests in 42 files |
| Host static checks | PASS — TypeScript, ESLint, 33 schema-policy contracts and 298 runtime boundary files |
| Fresh migration replay | PASS — all 45 migrations applied from an empty synthetic database |
| P22 database suite | PASS — 79 rollback-only PostgreSQL assertions |
| Complete database matrix | PASS — 1,569 assertions across 30 suites |
| Optimized build | PASS — Next.js 16.3.4, 59 pages/routes |
| Actual OAuth/MCP boundary | PASS — 4 connected groups; temporary fictional grant disconnected |
| P22 browser acceptance | PASS — 4 desktop/mobile Chrome cases, zero retries |
| Existing native layout matrix | PASS — 14 optimized desktop/mobile Chrome cases, zero retries |
| Source export | PASS — 41 allowlisted files pinned to the source revision above |
| Supply chain / sensitive data | PASS — npm audit reports 0 vulnerabilities; working tree and release-lineage scans clean before commit |

The connected acceptance performs real local dynamic client registration,
OAuth authorization with PKCE, grant activation, token exchange and MCP
transport. It confirms the all-six account receives the filtered context and
proposal tools but no layout approval/save tool. Context omits native preference
arrays and unavailable identities. Proposal creation is exact-retry safe and the
saved layout remains byte-for-byte unchanged until native acceptance. OAuth
attempts to invoke native layout RPCs and HTTP surfaces fail closed.

Browser acceptance creates the recommendation through that actual MCP path,
then signs the same fictional person into the native Workspace. Desktop and
mobile cases verify readable grounding, exact preview and disabled confirmation
until review. The test intentionally replaces a successful acceptance response
with an error, retries the same request and proves one layout revision and one
accepted proposal. A separate native layout change makes a second proposal
stale; acceptance disappears, rejection succeeds and the intervening layout is
unchanged. Focused element screenshots passed visual and horizontal-overflow
review.

## Adversarial database coverage

The P22 suite covers RLS/direct-table denial, assistant context and proposal
authority, native-only list/decision authority, dormant-ID non-disclosure,
inference-only rejection, inactive-target rejection, no-op rejection, exact
retry/non-rebinding, tenant isolation, deterministic newest ordering, dormant
preference preservation, atomic acceptance, stale blocking and stale rejection.
It also proves immediate denial after MCP grant revocation or bundle entitlement
revocation.

Every suite in the complete 30-suite matrix rolls back its fixtures. The fresh
replay starts from an empty synthetic database and applies every migration in
order before feature acceptance.

## Corrections found during proof

- A database local named `next` conflicted with PL/pgSQL syntax and was renamed.
- Decision-note references were qualified to remove parameter ambiguity.
- Same-transaction timestamps could tie, so list order now uses a monotonic
  identity.
- The source-to-host export rewrites the portable layout sibling import to the
  host's vendored filename.
- The optimized build caught a client import of a server-only decision schema;
  the schema now lives in the portable contract.
- Browser regression caught normal layout saves being parsed as proposal-list
  responses; GET and POST response contracts are now separate.
- Completed decisions moved into a collapsed history section, and focused mobile
  screenshots exclude fixed application chrome from covering the artifact.

## Evidence limits

These results prove the implemented local boundary and browser flow. They do not
prove representative recommendation quality or time saved, installed-host
behavior, hosted recovery/privacy/retention, support response, provider accounts
or payment enforcement. Overall shipment remains **NOT READY TO SHIP**.
