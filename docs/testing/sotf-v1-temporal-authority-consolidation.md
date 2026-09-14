# SOTF v1 temporal authority consolidation

Status: frozen local acceptance evidence.

Frozen base: `772b463d13c2f98cbfc9f369fb83bbbba01b0a45`

Branch: `codex/sotf-v1-temporal-authority-consolidation`

## 1. Exact 499 microsecond root cause

The database stored `2026-09-14T00:00:00.000001Z` and `2026-09-14T00:00:00.000500Z`, proved the interval was positive, and included the meeting in its bounded-reference authority. Canonical application replay then passed both strings through `new Date(...).toISOString()`. JavaScript reduced both values to `2026-09-14T00:00:00.000Z`; the replay engine's `endsAt <= startsAt` check consequently rejected a valid persisted event and the MCP bounded-state read returned `service_unavailable`.

The defect was a second, lower-precision temporal authority in canonical replay. It was not a PostgreSQL membership error and was not limited to one 499 microsecond value.

## 2. Complete temporal-authority inventory

The pre-edit audit searched SOTF source, UI, MCP, persistence, tests, and SQL for `new Date`, `Date.parse`, `getTime`, `valueOf`, `toISOString`, epoch arithmetic, timestamp sorting, start/end comparisons, duration calculations, local-date conversion, today/tomorrow calculations, temporal equality, and replay comparisons.

| Location or operation | Class | Disposition |
| --- | --- | --- |
| `lib/sotf/contracts.ts` timestamp transform | A -> D | Removed millisecond canonicalization. The closed schema now accepts an exact ISO offset timestamp with at most six fractional digits and returns the identical string. |
| `lib/sotf/persistence.ts` replay of `recorded_at` and operation payload | D | Exact database strings are passed to the engine without instant conversion. |
| `lib/sotf/engine.ts` meeting positive-interval check | A -> D | Removed from replay. A private-table trigger now parses and compares exact PostgreSQL `timestamptz` values before an event can persist. |
| `lib/sotf/engine.ts` future submission and future evidence checks | A -> D | Removed from replay. PostgreSQL compares them with the authoritative database event time/date at the insert/update boundary. |
| `lib/sotf/engine.ts` completed-meeting equality and `meetingStamp` | D | Retained exact-string structural identity. No instant parsing, ordering, or duration inference occurs. |
| `lib/sotf/engine.ts` preparation due-date prefix and offer-checkpoint date arithmetic | S | Deterministic application-state derivation. It does not authorize SOTF v1 projection membership or a final write; the database reconstructs and validates the governed projection independently. |
| `lib/sotf/persistence.ts` pre-write clock | S | Supplies a proposed event time to an uncommitted application transition. The database supplies the persisted event time and validates temporal semantics. |
| `lib/sotf/daily-brief-v1.ts` governed candidate filters, timestamp/date ordering, suggestions, truncation, and byte limiting | A -> D | The authorized path now consumes the complete database projection. These calculations remain only in the explicit fallback used by unit/preview code. |
| `lib/sotf/daily-brief-v1.ts` `dailyBriefWindow`, `localDateAt`, `addLocalDays`, `zonedMidnight` | A -> S | Removed from the authorized MCP path. They remain deterministic fallback/preview helpers and cannot produce an authority token or authorize an outcome. |
| `lib/sotf/v1-mcp.ts` event-log read, replay, and reprojection before bounded state | A -> D | Removed. The handler reads one current database authority response, validates its closed structure and identities, and transports its projection. |
| `lib/sotf/intelligence.ts` 48-hour horizon and lexical date/timestamp prioritization | S | Legacy/native advisory prioritization outside the governed v1 projection and outcome authorization path. |
| `lib/sotf/mcp.ts` local now/seven-day defaults | S | Legacy/native read preparation only; it does not issue v1 projection authority. |
| `lib/sotf/scheduling.ts` window parsing, epoch arithmetic, conflict sorting, and slot formatting | S/P | Produces five-minute, user-reviewable proposals and display text. It neither persists a meeting nor authorizes a v1 reference. |
| `components/sotf/workflow-editor.tsx` and `schedule-conversation.tsx` local input conversion | S | Converts new user-entered `datetime-local` values before database authority exists. Final persistence is database validated. |
| `components/sotf/workflow-editor.tsx` `localTime` and `components/sotf/sotf-experience.tsx` `displayDate` | P | Human-readable presentation only. |
| UI current-time/export timestamps | S/P | UI defaults and archive metadata only; never reference or write authority. |

No A-class path remains after the repair.

## 3. Frozen P/D/S/A responsibility matrix

Classes: **P** presentation only; **D** database-authoritative result transported or exact structural identity; **S** deterministic application-only behavior with no governed authority; **A** application independently recomputes an authority-sensitive temporal fact.

| Fact or operation | Class | Owner and permitted application behavior |
| --- | --- | --- |
| Canonical time-zone identifier membership | D | Both runtimes admit only the exact versioned 418-name contract; PostgreSQL owns civil-time interpretation. |
| Local day and UTC daily-brief boundaries | D | PostgreSQL computes and returns them. |
| Persisted exact timestamps and positive/non-positive interval validity | D | PostgreSQL validates at the private event-table boundary and preserves exact envelope strings. |
| Submission/evidence temporal validity | D | PostgreSQL compares against the database-recorded event time. |
| Bounded membership, ordering, row and byte limits, suggestions, omitted counts, and truncation | D | PostgreSQL emits the complete projection. |
| Revision, projection fingerprint, workflow, entitlement, capability, release gate, tenant, and final write | D | PostgreSQL rechecks under its current write boundary. |
| Exact replay payload and reconciliation identity | D | JavaScript compares opaque strings/objects exactly and never substitutes millisecond instant equality. |
| Formatting already-authorized instants | P | JavaScript may format for people; display equality has no governed meaning. |
| Scheduling proposals and legacy/native advice | S | JavaScript may calculate non-authoritative, user-reviewable suggestions. |
| Governed-authority recomputation in JavaScript | A | Forbidden; none remains. |

## 4. Canonical temporal authority contract

PostgreSQL owns canonical time-zone interpretation, local-day and UTC window boundaries, exact temporal parsing for persisted operations, governed interval ordering, positive/non-positive validity, bounded reference membership, current temporal eligibility, exact authoritative timestamp values, projection identity, and final write validation.

JavaScript owns display formatting, new-input preparation, non-authoritative scheduling/advice, opaque transport of exact database timestamps and identifiers, closed structural validation, and selection among already-authorized references. It must not turn a database timestamp into a JavaScript epoch to make a governed accept/deny decision.

## 5. Canonical replay redesign

Operation timestamps no longer use a Zod transform that calls `Date`. Canonical replay preserves the exact stored offset string and replays structural state only. Meeting validity, future submissions, and future evidence are enforced before insert or update by `workspace_private.validate_sotf_temporal_operation_event()`.

The existing database projection reconstruction already computed the full bounded projection and then returned only its semantic metadata. The new migration promotes that already-bounded projection to the authority response, adds a SHA-256 fingerprint over the projection excluding volatile `as_of`, and incorporates that fingerprint into the database authority token. The MCP state handler no longer reads or replays the broad event batch; it consumes this current closed projection directly.

This is the smallest combination evaluated: exact database strings plus the actual database-projected facts plus a revision/fingerprint identity. No custom JavaScript microsecond engine was added.

## 6. Structural versus temporal validation boundary

The application still requires exact workflow/version/date/zone/workspace identities, UUID/reference shapes, exact timestamp syntax with no more than six fractional digits, projection schema fields, matching revision/as-of/window metadata, matching eligible references, and matching truncation metadata.

It does not decide interval ordering, duration, local-day membership, window inclusion, or current eligibility. A client cannot fabricate authority by changing the projection: clients never supply the projection to the write RPC, and PostgreSQL recomputes current authority before saving. The displayed authority token remains consistency evidence, not a client-granted authorization capability.

## 7. Precision corpus

The permanent PostgreSQL corpus proves positive durations of 1, 2, 10, 99, 100, 499, 500, 501, and 999 microseconds, exactly 1 millisecond, and 1.001 milliseconds. It separately rejects exactly zero, negative 1 microsecond, negative 499 microseconds, and input with precision beyond PostgreSQL's six fractional digits. All denials preserve revision and event count.

The end-to-end local runner records the exact 499 microsecond reproduction:

| Evidence | Result |
| --- | --- |
| Exact database start | `2026-09-14T00:00:00.000001Z` |
| Exact database end | `2026-09-14T00:00:00.000500Z` |
| PostgreSQL interval validity | true; 499 microseconds |
| PostgreSQL membership | eligible |
| Application representation | identical exact strings; no `Date` conversion |
| MCP bounded-state read | success |
| Authenticated RPC | accept |
| Persistence | one outcome |
| Exact retry | identical receipt; no duplicate |

JavaScript may render both instants at the same millisecond. That visual equality has no governed effect.

## 8. Boundary interaction tests

Permanent SQL coverage includes a positive sub-millisecond interval at UTC window start, a local-midnight rollover, the America/Chicago spring-forward instant, the repeated fall-back hour with distinct offsets, half-hour and quarter-hour zone representations, and a positive interval immediately before the authoritative UTC window end. The earlier civil-time suite continues to cover PostgreSQL/ICU rule drift, local today/yesterday admission, DST-shortened and DST-lengthened windows, and exact start/end inclusion/exclusion. In every case PostgreSQL supplies the authoritative boundary and membership result.

## 9. Replay, idempotency, and current-authority proof

- Exact retry returns the same receipt and does not add a second outcome.
- Reusing a request or run ID with a changed selected reference or changed governed payload returns `idempotency_conflict`.
- A new write with a stale revision or stale projection token returns `state_changed` with no mutation.
- Saving an outcome changes the bounded projection's recent-outcome content and therefore changes its fingerprint/token; negative fixtures now deliberately refresh authority before testing membership errors.
- Current reference membership is recomputed by PostgreSQL at final write.
- Current workflow, entitlement, capability, release gate, MCP client, tenant/workspace, and resource grant remain fail-closed.
- Exact replay is still located before changed-state comparison only after current access is established; revocation therefore follows the frozen current-authority contract and does not become a cached authorization bypass.

## 10. Same-class Date-use audit

The audit explicitly checked database timestamp to JavaScript `Date` followed by equality, sort, duration, boundary inclusion, canonicalization, or replay fingerprint. None remains on the authorized v1 bounded-state or outcome-write path. `lib/sotf/v1-mcp.ts` contains no temporal reconstruction and no event-log replay. `consumeDailyBriefProjectionAuthority` validates closed identity/shape only.

Remaining Date uses are P or S as classified in section 2. The authorized path cannot call the fallback `projectDailyBriefState` computations. Exact string equality retained for completed-meeting reconciliation is structural identity, not instant equivalence.

## 11. Prior-regression results

- Required NULL/type failure: full SOTF and comprehensive differential suites pass with no denied-case mutation.
- Contradictory truncation metadata: application and RPC deny; current projection metadata is database-issued.
- UTF-16/surrogate-safe clipping: 212 cross-runtime decisions pass, including supplementary characters, combining marks, emoji, variation selectors, ZWJ, CRLF/tab, and 64 KiB limiting.
- Unsigned UTF-8 ordering: 31 accepted and 31 denied application/RPC decisions pass across insertion reversals, prefix/case/symbol, multilingual, and supplementary-plane cases.
- Exact decoded-string references: 1 accepted and 29 denied decisions pass on both application and RPC boundaries; padding, controls, Unicode whitespace/lookalikes, case changes, and normalization variants stay distinct.
- Exact 418-zone contract: all 47 identifier cases pass; 14 canonical identifiers accept and 33 aliases/invalid identifiers deny.
- PostgreSQL civil-time boundary authority: drift, DST, local-day, start/end, and stale-authority cases pass.
- Sub-millisecond membership: the legacy precision suite and new 499 microsecond MCP/PostgREST reproduction pass.
- Tenant/workspace isolation: full RLS, cross-tenant, current MCP connection, and cleanup assertions pass.
- Current authority/revision: stale tokens/revisions deny and exact replay/current-access behavior remains intact.

## 12. Static and behavioral regression controls

The schema-policy contract now fails if operation timestamps regain `new Date(value).toISOString()`, if replay regains the known interval/submission/evidence comparisons, if the migration ceases to own those checks, if the database stops returning projection/fingerprint authority, or if the MCP path resumes broad event-log replay/reprojection. It also requires every precision string and duration label in the permanent SQL corpus.

Behavioral coverage is stronger than a global Date ban: exact 499 microsecond replay must preserve both strings, obtain database membership, return bounded state, persist once, and replay identically, while zero and negative intervals must be denied without mutation.

## 13. Full fresh counts and checks

| Check | Fresh result |
| --- | --- |
| Fresh local migrations through `20260914010000` | pass |
| Full database/RLS | 1154/1154 |
| SOTF-only pgTAP | 911/911 |
| New temporal-authority pgTAP | 32/32 |
| Full unit suite | 236/236 across 25 files |
| Schema-policy contracts | 41/41 |
| Focused workflow/daily-brief/MCP | 36/36 |
| Focused outcome/reference mocked-boundary suites | 32/32 |
| Time-zone + boundary + precision + temporal MCP/PostgREST runner | 47 identifier cases plus all three positive end-to-end authorities; 17 accepts and 33 denies; zero residual fixtures |
| Unicode differential | 212/212 decisions; zero residual fixtures |
| Canonical ordering differential | 31/31 accepts and 31/31 denies on both boundaries; zero residual fixtures |
| Exact reference differential | 1/1 accepts and 29/29 denies on both boundaries; zero residual fixtures |
| Product boundary scan | pass; 88 runtime files |
| TypeScript | pass |
| ESLint | pass |
| Production build | pass; 27 static pages generated |
| Database lint at warning level | pass |
| Sensitive-data scan | pass; 104 commits, 625 unique Git blobs, and working tree |
| Whitespace (`git diff --check`) | pass |

The three previously noted September 11 fixtures passed. The inherited temporary-folder PostCSS problem did not occur because dependencies remained inside the isolated worktree.

Non-final development attempts were distinguished from acceptance evidence: the new migration initially failed closed because PostgreSQL stored CRLF source while the source-shape guard used LF; normalization fixed it and the final fresh replay passed. Two legacy negative fixtures initially reached the new stale-token check before their intended membership check; refreshing database authority restored the exact assertions. A wildcard SOTF command ran zero tests due the spaced Windows path; the explicit ten-file invocation passed 911/911. The sensitive scan initially detected only the disposable CLI `supabase/.temp/start-secrets`; after stopping and deleting the local stack, the authored-tree scan passed.

## 14. Exact files changed

- `docs/architecture/sotf-v1-contracts.md`
- `docs/testing/sotf-v1-temporal-authority-consolidation.md`
- `lib/sotf/contracts.ts`
- `lib/sotf/daily-brief-v1.ts`
- `lib/sotf/engine.ts`
- `lib/sotf/v1-mcp.ts`
- `package.json`
- `scripts/test-sotf-v1-canonical-ordering-local.mjs`
- `scripts/test-sotf-v1-reference-parsing-local.mjs`
- `scripts/test-sotf-v1-time-zone-local.mjs`
- `supabase/migrations/20260914010000_sotf_v1_temporal_authority_consolidation.sql`
- `supabase/tests/database/sotf_v1_daily_brief_slice.sql`
- `supabase/tests/database/sotf_v1_temporal_authority_consolidation.sql`
- `supabase/tests/database/sotf_v1_timestamp_precision_authority.sql`
- `tests/schema-policy-contract.test.mjs`
- `tests/sotf-v1-daily-brief.test.ts`
- `tests/sotf-v1-mcp.test.ts`
- `tests/sotf-v1-outcome-semantic-parity.test.ts`
- `tests/sotf-v1-reference-parsing-parity.test.ts`
- `tests/sotf-workflows.test.ts`

## 15. Zero hosted mutation confirmation

All work and all synthetic fixtures stayed in the isolated local worktree and disposable loopback Supabase stack. No hosted Supabase link, push, migration, repair, or data access occurred. No deployment, ChatGPT connection, push, merge, pull request, Supa, Entry, Cash, or E2 action occurred. The local stack was stopped without backup after validation and all runner cleanup counts were zero.
