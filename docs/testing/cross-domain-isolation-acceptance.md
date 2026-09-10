# P18 cross-domain isolation acceptance ledger

Milestone: P18, 2026-09-10. Local security checkpoint, not client shipment.
Host branch: `codex2/bundle-experience-integration`; starting HEAD
`955984a639d5142296b2870a8e8b4d2733bf0ad7`. Portable branch:
`codex2/bundle-platform-v1`; final source pin
`c9a3207bd7f66e043af4b517ec0095dd58117186`. All six bundles remain
**NOT READY TO SHIP**.

See [the threat model and oracle design](../architecture/cross-domain-isolation-matrix.md).

## Final local checks

| Check | Outcome |
| --- | --- |
| Independent cross-domain PostgreSQL oracle | PASS: 184 assertions |
| Complete local bundle database suite | PASS: 1,325 assertions across 26 rollback-only suites |
| Portable source type checking and tests | PASS: 189 tests in 19 files |
| Host source export | PASS: 38 allowlisted files pinned to `c9a3207bd7f66e043af4b517ec0095dd58117186` |
| Host type checking and lint | PASS |
| Host unit tests | PASS: 323 tests in 37 files |
| Schema-policy contracts | PASS: 32 |
| Runtime product boundaries | PASS: 275 files; no forbidden cross-product import or service-role client |
| Optimized local-public-config build | PASS: 57 generated pages/routes |
| Browser acceptance | UNCHANGED: no application behavior or UI changed in P18; P17 browser evidence was not relabeled as fresh |
| Fresh database replay | UNCHANGED: no migration changed; P18 ran against the retained isolated P16 stack |
| Hosted, installed-host and representative-client proof | NOT RUN |

## Matrix result

The fictional all-entitlement owner can retrieve each of its five domain records,
but every one of the 20 off-diagonal domain-reader/record-ID combinations fails
through the reader's normal unavailable response. The same 20 combinations fail
through revision history. Five same-domain records from a separate all-entitlement
owner are equally unavailable. Each full-text search finds only its own unique
private marker across all 25 reader/marker combinations.

Direct table CRUD privileges are absent for anonymous and authenticated roles,
RLS remains enabled, and anonymous callers cannot invoke the canonical readers.
An authorized OAuth-shaped database session repeats the five positive controls
and 20 cross-domain denials, cannot call native saved-work search or attention,
and loses all access immediately after its resource grant is revoked. Source
entitlement revocation also closes native reads and invalidates saved Executive
references.

## Explicit Executive result

Four source records are unavailable before a direct user grant. After exact
confirmation, four record-metadata projections and the two supported task-
metadata projections resolve. None contains the private marker pattern. Writer
and Ministry expanded-task queries remain rejected because those contracts do
not exist. OAuth observes only the same bounded, explicitly granted metadata.

## Verification limits

The matrix is a direct PostgreSQL authorization oracle. Existing per-domain suites
continue to own data validation, mutation confirmation, retry, proposal and
revision semantics. This milestone does not claim deployed RLS, hosted migration,
browser-edge authorization, installed assistant behavior, external provider
success, payment enforcement or representative user value.

No client content, provider account, hosted project, production environment,
marketplace listing, payment system or `main` branch was touched.
