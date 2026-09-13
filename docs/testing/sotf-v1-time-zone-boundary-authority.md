# SOTF v1 time-zone boundary authority repair

## Verdict

PASS — the governed SOTF daily-brief boundary now has one civil-time authority: PostgreSQL. The MCP application consumes PostgreSQL-owned UTC boundaries and current eligible-reference/truncation authority, while the final authenticated write recomputes the same authority under the existing lock. No client-supplied UTC boundary is trusted.

Work remained local and uncommitted on `codex/sotf-v1-time-zone-boundary-authority`, based exactly on frozen HEAD `c7c3dd483971ba58aa0caf90605c0de76a68bcf3`.

## Preserved reproduction and explicit root cause

The pre-repair acceptance case was preserved unchanged:

- Identifier: `America/Asuncion` (valid in the frozen 418-identifier set)
- Brief date: `2026-09-13`; governed window end is local midnight starting `2026-09-15`
- Meeting: `2026-09-15T03:15:00Z`–`2026-09-15T03:45:00Z`
- Node/ICU boundary: `2026-09-15T03:00:00Z`
- PostgreSQL boundary: `2026-09-15T04:00:00Z`
- Frozen behavior: application deny, authenticated RPC accept, durable persistence, success receipt

The discrepancy is differing time-zone rule data, not identifier parsing:

| Runtime | Actual source | Observed version | Conversion |
| --- | --- | --- | --- |
| Node.js | `Intl.DateTimeFormat`, ICU | Node `v24.16.0`; ICU `78.3`; `process.versions.tz = 2026b` | `2026-09-15 00:00 America/Asuncion` → `03:00Z` |
| PostgreSQL | PostgreSQL `AT TIME ZONE`, container zoneinfo | PostgreSQL `15.8`; `/usr/share/zoneinfo/tzdata.zi` reports `# version 2025b`, rearguard | Same local midnight → `04:00Z` |

The version-controlled 418-name list remains an identifier contract only. `lib/sotf/v1-canonical-time-zones.json` is unchanged. It answers “is this exact decoded identifier allowed?” and does not answer “which offset applies on this date?”

## Authority trace

Before repair, civil-time authority was duplicated:

1. `dailyBriefWindow`, `localDateAt`, `zonedMidnight`, and `Intl.DateTimeFormat` calculated UTC boundaries in TypeScript.
2. `projectDailyBriefState` used those JavaScript boundaries to decide meeting eligibility.
3. `workspace_private.sotf_v1_daily_brief_projection_semantics` independently used PostgreSQL `AT TIME ZONE` for the direct-RPC/final-write decision.
4. `sotf_record_daily_brief_outcome` rebuilt the JavaScript projection before calling the database write, allowing different tzdb releases to disagree.

After repair:

1. `workspace_private.sotf_v1_daily_brief_utc_window(date,text)` is the reusable private PostgreSQL civil-time conversion primitive.
2. `workspace_private.sotf_v1_daily_brief_boundary_authority(uuid,date,text)` combines the current database local day, revision, UTC bounds, eligible references, and truncation result.
3. `workspace.sotf_v1_get_daily_brief_authority(...)` exposes only that bounded result after current access, workflow version, identifier, and local-day validation.
4. `sotf_get_daily_brief_state` uses the returned `window_start`/`window_end`; it never calls the JavaScript window calculator on the live governed path. It also fails closed unless the application projection’s exact eligible refs and truncation sections match the database authority.
5. The state response is `{projection, authority}`. The authority envelope returned to the host contains `authority_version`, `authority_token`, and `authority_local_day`.
6. The outcome MCP input carries `expected_authority_token`. The application strips it before probing or persistence, so the durable outcome remains the prior closed 19-field metadata object.
7. `workspace.sotf_v1_record_daily_brief_outcome(jsonb,text)` locks current authority, revalidates the durable payload, recomputes database authority, compares the token, rechecks projection semantics, and only then inserts.
8. Authenticated execute privilege on the legacy one-argument write overload is revoked. Direct authenticated callers must use the authority-bound overload, and the database independently decides current eligibility.

The token is a non-secret optimistic drift fingerprint, not authorization. Its material binds authority version, workspace, workflow/version, current revision, database local day, requested date/zone, PostgreSQL-derived boundaries, exact eligible refs, and exact truncation sections. The client never supplies a UTC boundary.

## Read/write drift behavior

| Change after read | Final behavior |
| --- | --- |
| Ordinary SOTF state revision changes | Token/revision mismatch → `state_changed`; no insert |
| Eligible membership or truncation changes | Token mismatch and final semantic validation → no insert |
| Database local day crosses | Local-day/date validation and token recomputation require a fresh read |
| PostgreSQL time-zone rules alter the governed boundaries | Token changes → `state_changed` |
| Entitlement, capability, MCP binding, subject/workspace, or release gate changes | Existing current-access checks deny before new persistence; exact receipt access is also gated |
| Workflow ID/version changes | Exact workflow/version validation denies; changing released semantics without a version change remains prohibited by the frozen workflow contract |
| Exact already-saved retry | Current access is still required; matching durable intent returns the verified original receipt without duplication, even after unrelated later state changes |

## Post-repair Asuncion result

The local loopback runner reused the exact date and meeting. The state read returned PostgreSQL’s `2026-09-15T04:00:00.000Z` end boundary, and the application projection included `asuncion-exact-boundary`. The outcome then produced:

```text
application → ACCEPT
authenticated RPC exact retry → ACCEPT / replayed:true
durable outcome → exactly one row
success receipt → identical across application and RPC
cleanup → users/workspaces/outcomes/events/audits all zero
```

No durable write occurred on any application/database disagreement or stale-authority case.

## Defensive regression coverage

The permanent PostgreSQL boundary corpus covers:

- `America/Asuncion`, `America/Chicago`, `America/Santiago`, `Africa/Casablanca`, `Australia/Lord_Howe`, `Pacific/Chatham`, `Asia/Kolkata`, `Europe/Kyiv`, and `UTC`;
- ordinary UTC midnight rollover and a two-local-day window;
- Chicago spring-forward (47-hour window) and fall-back (49-hour window);
- skipped-hour and repeated-hour PostgreSQL conversion behavior;
- PostgreSQL-local today and today/yesterday admission;
- exact authority-token stability, stale revision/token rejection, exact retry, one-row persistence, and no partial state;
- direct authenticated RPC eligibility and legacy-overload revocation;
- exact identifier negatives for POSIX namespace, whitespace padding, case changes, legacy alias, and Unicode lookalike.

The identifier corpus expanded from 43 to 47 cases only by adding canonical irregular-rule positives (`America/Asuncion`, `America/Santiago`, `Pacific/Chatham`, and `Africa/Casablanca`). The frozen allowlist remains exactly 418 identifiers. Required confirmations remain:

```text
America/Chicago       accepted
America/Asuncion      accepted
Asia/Kolkata          accepted
Europe/Kyiv           accepted
UTC                   accepted
posix/America/Chicago rejected
padded names          rejected
case variants         rejected
legacy aliases        rejected
Unicode lookalikes    rejected
```

## Preserved invariants

All prior defensive suites were updated only to carry the ephemeral authority token and call the new RPC overload. Results preserve:

1. required-field SQL NULL/type fail-closed behavior;
2. contradictory truncation rejection and cross-field semantic parity;
3. UTF-16 code-unit measurement;
4. surrogate-safe clipping;
5. unsigned UTF-8 byte ordering;
6. exact decoded-string reference matching;
7. exact canonical time-zone identifier matching;
8. tenant/workspace isolation;
9. entitlement, capability, release-gate, current-revision, idempotency, and current-access enforcement.

## Fresh local validation

The local Supabase database was recreated from every migration, including `20260913213000_sotf_v1_time_zone_boundary_authority.sql`, before the final database and loopback runs. `supabase status` remained loopback-only at `127.0.0.1:56421/56422`, and the runners asserted `linked_project` was null.

| Check | Result |
| --- | --- |
| `npm run check:boundaries` | PASS — 88 runtime files; no ministry/Consulting imports or service-role client |
| `npm run test:schema` | PASS — 40/40 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS — 25 files, 232/232 tests |
| `npm run build` | PASS — 27 static pages generated; dynamic routes compiled |
| Focused boundary pgTAP | PASS — 65/65 |
| `npm run test:rls` | PASS — 16 files, 1,081/1,081 tests |
| Time-zone application/RPC loopback | PASS — 47 identifier cases plus exact Asuncion case; both layers 15 accept / 33 deny; all cleanup zero |
| Exact-reference loopback | PASS — both layers 1 accept / 29 deny; all cleanup zero |
| Canonical-ordering loopback | PASS — 31 application accept + 31 deny; 31 RPC accept + 31 deny; all cleanup zero |
| Unicode/truncation loopback | PASS — 63 named checks; 212/212 application/RPC decision pairs; 40 shared Unicode cases; zero forbidden-content rows; all cleanup zero |
| `git diff --check` | PASS |

The previously noted September 11 time-sensitive unit fixtures did not fail on this run. The inherited temporary-folder PostCSS condition was not encountered because dependencies were kept inside this isolated worktree.

## Files changed

- `docs/architecture/contracts/daily-brief-outcome.example.json`
- `docs/architecture/contracts/sotf-v1.schema.json`
- `docs/architecture/contracts/transition.daily_brief.v1.json`
- `docs/architecture/sotf-v1-contracts.md`
- `docs/testing/sotf-v1-time-zone-boundary-authority.md`
- `lib/sotf/daily-brief-v1.ts`
- `lib/sotf/v1-mcp.ts`
- `package.json`
- `scripts/test-sotf-v1-canonical-ordering-local.mjs`
- `scripts/test-sotf-v1-reference-parsing-local.mjs`
- `scripts/test-sotf-v1-time-zone-local.mjs`
- `scripts/test-sotf-v1-unicode-local.mjs`
- `supabase/migrations/20260913213000_sotf_v1_time_zone_boundary_authority.sql`
- `supabase/tests/database/sotf_v1_canonical_ordering_parity.sql`
- `supabase/tests/database/sotf_v1_daily_brief_slice.sql`
- `supabase/tests/database/sotf_v1_outcome_semantic_parity.sql`
- `supabase/tests/database/sotf_v1_reference_parsing_parity.sql`
- `supabase/tests/database/sotf_v1_time_zone_boundary_authority.sql`
- `supabase/tests/database/sotf_v1_time_zone_identifier_contract.sql`
- `supabase/tests/database/sotf_v1_unicode_truncation_parity.sql`
- `tests/schema-policy-contract.test.mjs`
- `tests/sotf-v1-daily-brief.test.ts`
- `tests/sotf-v1-mcp.test.ts`
- `tests/sotf-v1-outcome-semantic-parity.test.ts`
- `tests/sotf-v1-reference-parsing-parity.test.ts`
- `tests/sotf-v1-time-zone-identifier-contract.test.ts`

Generated evidence remains untracked under `.sotf-local/` and is excluded from the change list.

## Scope and mutation confirmation

- No commit, push, deploy, hosted migration, `supabase link`, hosted `db push`, or migration repair occurred.
- No production or hosted Supabase endpoint was contacted.
- The Astra acceptance worktree was not modified.
- `lib/sotf/v1-canonical-time-zones.json` and its exact 418 identifiers were not modified.
- Supa, Cash, E2, Entry, billing, ministry, Consulting OS, and all other workstreams were untouched.
- All fixtures were synthetic and local; all persistent fixture rows were removed and product settings restored after each loopback run.
