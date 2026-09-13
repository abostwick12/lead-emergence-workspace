# SOTF v1 timestamp precision authority repair

## Scope and frozen base

- Workstream: OG2
- Frozen base and current uncommitted HEAD: `382e26fbd08ac16686ca1ae0961509ee6d2a585a`
- Branch: `codex/sotf-v1-timestamp-precision-authority`
- Environment: isolated repository worktree and disposable loopback Supabase only
- Hosted Supabase, deployment, ChatGPT connection, push, merge, and commit: not performed

The failed Astra acceptance worktree was not modified. This repair changes no migration and no hosted schema; it consumes the PostgreSQL projection authority already present at the frozen base.

## 1. Exact root cause and end-to-end trace

The meeting instants are not stored in a PostgreSQL timestamp column. They are exact strings inside `workspace_private.sotf_operation_events.envelope jsonb`. The event row's separate `recorded_at` field is `timestamptz`.

The failing value followed this path:

1. The operation envelope persisted `endsAt = 2026-09-13T00:00:00.000500Z` byte-for-byte in JSONB.
2. `workspace.sotf_read_operations()` aggregated and returned the envelope as JSONB. The authenticated PostgREST/RPC response still contained all six fractional digits: `.000500Z`.
3. `eventBatchSchema` decoded the event through `commandEnvelopeSchema` and `meetingSchema`.
4. The shared timestamp transform in `lib/sotf/contracts.ts` executed `new Date(value).toISOString()`.
5. ECMAScript `Date` represents integral milliseconds. Its parse/TimeClip path discarded the 500 microseconds below one millisecond, and `toISOString()` emitted exactly three fractional digits:

   ```
   2026-09-13T00:00:00.000500Z
   -> JavaScript Date value at 0 milliseconds
   -> 2026-09-13T00:00:00.000Z
   ```

6. Before this repair, `projectDailyBriefState` recomputed overlap from the replayed value using `item.endsAt > window.window_start`. Both strings were now `2026-09-13T00:00:00.000Z`, so the application returned false.
7. PostgreSQL independently cast the exact JSON string to `timestamptz` in `workspace_private.sotf_v1_daily_brief_projection_semantics`. PostgreSQL 15 retains microseconds, so `.000500Z > .000000Z` was true and the database returned the meeting in `eligible_refs`.
8. The projection/authority consistency assertion observed different reference sets and threw. The MCP boundary mapped that internal divergence to `service_unavailable`.
9. The authenticated outcome RPC would have accepted the reference because its locked final validation recomputed the PostgreSQL authority. The application-side state read prevented the user from reaching that valid governed write.

No persisted timestamp was changed, rounded, or truncated by PostgreSQL or PostgREST. Precision loss occurred only while TypeScript replay transformed the exact string into the application state. That millisecond representation remains visible in the bounded response, but it no longer controls live v1 membership.

## 2. Canonical timestamp precision contract

The selected contract is:

```
exact JSON event timestamp
-> PostgreSQL timestamptz comparison at native microsecond precision
-> database eligible_refs and window boundaries
-> application assembles only those authorized references
-> application may display its millisecond-normalized timestamp
-> locked outcome RPC recomputes current PostgreSQL authority before insert
```

PostgreSQL is the sole authority for current local day, UTC window boundaries, meeting-window inclusion, bounded eligible-reference membership, and the final selected-reference decision. The application must not promote its lossy `Date` representation into an accept/deny decision after PostgreSQL has established authority.

The application still validates that the authority belongs to the same workspace, workflow, version, brief date, time zone, and state revision. It also compares the final projected reference set and truncation set back to the authority before returning the MCP response.

## 3. Design evaluation

### Chosen: database-computed eligibility and reference membership

The existing boundary-authority RPC already returns current `eligible_refs`, `window_start`, `window_end`, revision, local day, and truncation state. The repair makes that membership operative: when authority is present, each reference-bearing bounded collection is assembled by exact `entity_type:entity_id` membership from the database result. The existing application filters remain only as the non-authority fallback and for projection display metadata; they cannot add or remove a live governed reference.

This is the smallest single-authority repair. It does not expose a second timestamp parser and does not duplicate PostgreSQL comparison semantics.

### Rejected: normalize before either runtime evaluates

Normalizing stored timestamps to milliseconds would erase a distinction the existing contract and data already preserve. It would make `.000000Z` and `.000500Z` semantically identical and would reverse the already-established PostgreSQL result. Adopting that rule would require an explicit product/data migration, not an incidental repair.

### Rejected: application microsecond parser or integer epoch

An exact ISO parser or integer-microsecond representation could let JavaScript reproduce this comparison, but it would preserve two authorities for the same governed rule. It is more complex than consuming the membership PostgreSQL already computes and would require a much broader timestamp canonicalization contract for offsets and serialization.

### Exact timestamps returned where needed

Raw event reads continue to carry the six-digit source string, which is useful for audit and differential testing. The host does not need that exact value to recompute membership, so the bounded MCP response is permitted to carry the application display form.

## 4. Bounded-state changes

`projectDailyBriefState` now:

- initializes truncation from the database authority;
- builds one exact set from `authority.eligible_refs`;
- uses that set for criteria, opportunities, commitments, meetings, and hypotheses whenever authority is present;
- retains the prior filters for test/fallback projection when no database authority exists;
- preserves bounded sorting, clipping, omitted-item accounting, byte-budget enforcement, and suggestion cleanup;
- verifies the final reference and truncation sets against PostgreSQL before returning.

The only production call site, `lib/sotf/v1-mcp.ts`, always retrieves and supplies database authority. A locally plausible reference omitted by PostgreSQL cannot be added, and a PostgreSQL-authorized reference cannot be removed by the lossy timestamp representation.

## 5. Precision corpus

The permanent database corpus passed 41/41 assertions.

| Boundary value | Raw DB/RPC precision | Application representation | PostgreSQL result |
| --- | --- | --- | --- |
| one microsecond before midnight | six digits retained | not used for authority | ineligible |
| `.000000Z` | six digits retained | `.000Z` | ineligible at the exact end boundary |
| `.000001Z` | six digits retained | `.000Z` | eligible |
| `.000499Z` | six digits retained | `.000Z` | eligible |
| `.000500Z` | six digits retained | `.000Z` | eligible |
| `.000999Z` | six digits retained | `.000Z` | eligible |
| `.001000Z` | six digits retained | `.001Z` | eligible |
| `.001001Z` | six digits retained | `.001Z` | eligible |

The corpus covers immediately before, exactly at, and immediately after midnight. It also proves one-microsecond ordering around the America/Chicago spring-forward and fall-back dates, Australia/Lord_Howe's half-hour DST transition, and Pacific/Chatham's quarter-hour DST transition.

The TypeScript projection corpus separately supplies the lossy JavaScript representations and database membership, proving that `.000001Z` through `.000999Z` remain included even though they all display as `.000Z`. A negative test proves that the application cannot add a locally plausible meeting excluded by database authority.

## 6. Exact differential reproduction after repair

The real local MCP/PostgREST differential recorded:

```
raw database timestamp       2026-09-13T00:00:00.000500Z
RPC serialized timestamp     2026-09-13T00:00:00.000500Z
application representation  2026-09-13T00:00:00.000Z
database eligibility         ELIGIBLE
application projection       ELIGIBLE_FROM_DB_AUTHORITY
MCP handler decision         ACCEPT
authenticated RPC decision   ACCEPT
persistence                  ONE_OUTCOME_EXACT_REPLAY
receipt                      IDENTICAL
```

The bounded-state read returned `status: ok`; no application-side precision-loss `service_unavailable` occurred. The first selected outcome persisted once, the exact retry returned the same receipt, and users, workspaces, outcomes, events, and audits all returned to zero.

The same run retained the exact 47-case time-zone corpus: application and RPC each produced 16 accepts and 33 denials. It also re-demonstrated that Node 24.16/ICU 78.3/tzdb 2026b and PostgreSQL 15.8/tzdb 2025b disagree about the Asuncion window, while both application and write behavior follow the PostgreSQL authority.

## 7. Stale and current-authority results

The fresh database suites and 63-check comprehensive differential reconfirmed fail-closed behavior for:

| Authority change | Result |
| --- | --- |
| source revision change | stale token/reference denied; no partial persistence |
| workflow ID or version change | not available/version not available |
| entitlement removal | state read/write denied |
| capability removal | state read/write denied |
| release-gate change | state read/write denied |
| workspace membership removal | state read/write denied |
| local-day transition | prior authority cannot authorize a new local day |
| civil-time boundary/rule change | token and membership are recomputed by PostgreSQL |
| timestamp precision mismatch | DB membership preserved in read; locked RPC independently agrees |

Application acceptance never substitutes for the final RPC. The write function locks current authority, checks the current revision and token, recomputes projection semantics, validates selected references, and only then inserts.

## 8. Same-class precision review

| Value/path | Classification | Finding |
| --- | --- | --- |
| meeting `startsAt`/`endsAt` in operation JSON | confirmed precision-loss defect, now database-authoritative for v1 membership | JSONB and RPC retain six digits; replay normalizes to milliseconds; DB `eligible_refs` now exclusively controls live membership |
| authority `window_start`/`window_end` | database-authoritative | PostgreSQL computes civil-time bounds; MCP consumes returned values and does not recreate them with Node/ICU |
| authority `as_of` | presentation-only clock value | parsed to construct a stable response time; it does not decide eligible membership |
| operation-event `recorded_at timestamptz` | database ordering, presentation in application | database orders the event log by revision; replay uses recorded time for state metadata, not daily-brief reference authorization |
| outcome `recorded_at timestamptz` | database ordering/presentation | PostgreSQL orders recent receipts; it is not a selectable-reference rule |
| opportunity deadline and commitment due date | precision-safe date-only values | ISO local dates have no fractional-time boundary |
| revision, priority, counts, and weekly hours | precision-safe bounded integers | no decimal or floating authority crosses runtimes |
| scheduling duration and slot epochs | application-only advisory path | explicit integer-minute/5-minute behavior; not part of the SOTF v1 governed outcome authority |
| `dailyBriefWindow` and local meeting filter without authority | non-production fallback/test oracle | the live v1 MCP call always supplies PostgreSQL authority; this path cannot override a database result |

No additional SOTF v1 governed decimal, fractional duration, or numeric-epoch comparison crosses a PostgreSQL/JavaScript authority boundary. No speculative repair was made outside the confirmed bounded-state membership class.

## 9. Prior-contract regression

All frozen invariants remain green:

1. required-field NULL and type validation fails closed;
2. cross-field and semantic truncation validation agrees across layers;
3. UTF-16 code-unit measurement is unchanged;
4. clipping remains surrogate-safe;
5. canonical ordering remains unsigned UTF-8 byte order;
6. authority references remain exact decoded strings with no trimming, case folding, or normalization;
7. the exact 418-name time-zone identifier contract remains shared;
8. PostgreSQL remains the civil-time boundary authority;
9. tenant/workspace isolation and current entitlement, capability, membership, revision, and release-gate checks remain enforced.

The completed comprehensive differential passed 63/63 named checks and 212/212 application/RPC decision pairs. The ordering differential passed 31 accepts plus 31 denials in each layer. The exact-reference differential passed one accept plus 29 denials in each layer. Every final runner reported zero synthetic users, workspaces, outcomes, events, and audits and restored all three local settings.

## 10. Fresh local validation

| Check | Result |
| --- | --- |
| Fresh migrations | PASS — 26/26 applied from scratch |
| Combined SOTF pgTAP | PASS — 879/879 across 9 files |
| Time-zone identifier pgTAP | PASS — 99/99 |
| Time-zone boundary-authority pgTAP | PASS — 65/65 |
| Timestamp-precision pgTAP | PASS — 41/41 |
| Full pgTAP/RLS | PASS — 1,122/1,122 across 17 files |
| Comprehensive MCP/PostgREST differential | PASS — 63/63 checks; 212/212 decisions |
| Time-zone/precision MCP/PostgREST differential | PASS — 47 identifier cases; 16 accepts/33 denials in each layer; exact precision write/replay |
| Canonical-ordering differential | PASS — 62/62 decisions in each layer |
| Exact-reference differential | PASS — 30/30 decisions in each layer |
| Focused projection/MCP/Unicode/ordering units | PASS — 94/94 |
| Full unit suite | PASS — 235/235 across 25 files |
| Schema-policy contracts | PASS — 41/41 |
| Product boundaries | PASS — 88 runtime files |
| Typecheck | PASS |
| Lint | PASS |
| Production build | PASS — 27/27 static pages; dynamic routes compiled |
| Database lint | PASS — zero findings |
| Sensitive-data scan | PASS — 102 release-lineage commits, 616 unique blobs, and working tree |
| `git diff --check` | PASS — line-ending notices only |

The three previously time-sensitive September 11 unit fixtures passed in this run. The inherited temporary-folder PostCSS issue did not occur because dependencies remained in the isolated worktree.

## 11. Files changed

1. `lib/sotf/daily-brief-v1.ts` — consumes exact DB eligible-reference membership for every live reference-bearing section.
2. `tests/sotf-v1-daily-brief.test.ts` — application representation/membership corpus and DB-exclusion regression.
3. `tests/sotf-v1-mcp.test.ts` — exact MCP replay reproduction with DB-authorized `.000500Z`.
4. `supabase/tests/database/sotf_v1_timestamp_precision_authority.sql` — 41-assertion PostgreSQL precision, boundary, DST, persistence, replay, and rejection suite.
5. `scripts/test-sotf-v1-time-zone-local.mjs` — real raw DB, RPC serialization, application representation, decision, persistence, receipt, and cleanup evidence.
6. `tests/schema-policy-contract.test.mjs` — static lock for the authority design and minimum corpus.
7. `package.json` — includes the new pgTAP file and precision runner.
8. `docs/architecture/sotf-v1-contracts.md` — canonical precision and authority/presentation split.
9. `docs/testing/sotf-v1-timestamp-precision-authority.md` — this acceptance record.

All changes are uncommitted. No file is staged.

## 12. Hosted-mutation confirmation

All database endpoints were loopback-only at `127.0.0.1:56421/56422`, and the local runner asserted that no hosted project was linked. The disposable stack was stopped with no backup after testing. No hosted migration, production data access, deployment, ChatGPT connection, push, merge, billing action, or change to Supa, Entry, Cash, E2, or another workstream occurred.

SOTF V1 TIMESTAMP PRECISION AUTHORITY REPAIR COMPLETE — REQUEST COMMIT AUTHORIZATION
