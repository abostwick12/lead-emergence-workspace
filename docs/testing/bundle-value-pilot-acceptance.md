# P16 private bundle value-pilot acceptance ledger

Milestone: P16, 2026-09-10. Implementation checkpoint, not client shipment.
Host branch: `codex2/bundle-experience-integration`; starting HEAD
`9617e260385df7c589cc4add86375791fd7b633f`. Portable branch:
`codex2/bundle-platform-v1`; final source pin
`1078b4e3ff6201160a1efdbe724e2577dd7ef925`. All six bundles remain
**NOT READY TO SHIP**.

See [the value measurement and authority design](../architecture/bundle-value-pilots.md).

## Final checks and evidence

| Check | Outcome |
| --- | --- |
| Portable type checking and tests | PASS: 183 tests in 18 files |
| Host type checking and lint | PASS |
| Host unit tests | PASS: 322 tests in 37 files, including four P16 boundary/parity tests |
| Schema-policy contracts | PASS: 32 |
| Runtime product boundaries | PASS: 275 files; no forbidden cross-product import or service-role client |
| Optimized build | PASS: 57 generated pages/routes, including `/workspace/value` and `/api/bundles/value-pilots` |
| Fresh isolated database replay | PASS: all 42 migrations from zero |
| Local database authorization | PASS: 1,141 assertions in 25 rollback-isolated suites |
| P16 hostile database cases | PASS: 80 assertions |
| Optimized desktop/mobile browser flow | PASS: five cases; one mobile duplicate of desktop-only lost-response injection intentionally skipped |
| Visual review | PASS: result-first hierarchy, readable two-column desktop layout, single-column mobile layout and no horizontal overflow |
| Representative client outcome | NOT RUN; no claim inferred from fictional fixtures |
| Installed ChatGPT/Codex and deployed environment | NOT RUN |

## Browser behaviors proven

- Exactly six manifest-derived definitions appear for the all-bundle fixture.
- Baseline entry is required before start and is restored from the server after
  navigation/reload as part of the active session.
- The real bundle route is available from the running measurement.
- Completion requires an outcome answer, matching declared signal, ratings,
  trust answers and correction count.
- The completed result distinguishes server-measured elapsed time from the
  user-reported baseline and ratings, and warns that one session is not
  representative evidence.
- A server-committed start whose response is replaced with a synthetic 503
  retries the exact request and retains one session.
- An Experience-only user sees the other five bundles as not currently assigned
  with disabled controls; Workspace Experience remains startable.
- Settings links to the value page for an entitled native workspace.
- A request without an explicit bearer token receives 401.

## Database denial matrix

The P16 suite verifies no direct table CRUD for `anon` or `authenticated`, RLS
on all three private tables, no access to private helper functions, and no public
execution by `anon`. It also verifies cross-owner isolation; direct-session-only
access; OAuth/client denial; current bundle entitlement; revocation behavior;
unknown bundles; extra prose; invalid/fractional baselines; contradictory,
unknown and duplicate signals; stale versions; one-active-session enforcement;
exact start/finish/stop replay; changed-request denial; and preservation of
negative/finished history without rejected prose in rows or receipts.

## Verification limits

The prior P15 uninterrupted connected regression remains 202 passes, four
documented skips and zero retries. P16 adds isolated code, one migration, one
native route and one native page; the full static/unit/database/build gates plus
the optimized P16 browser flow were rerun. The prior 206-case browser collection
was not repeated in full, and is not described as fresh P16 evidence.

No client content, provider, external account, hosted project, payment system,
marketplace listing, main merge or production deployment was touched. The next
release gate is an authorized representative pilot, not another synthetic score.
