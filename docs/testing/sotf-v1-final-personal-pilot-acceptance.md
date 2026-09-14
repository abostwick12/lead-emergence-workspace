# SOTF v1 final personal-pilot acceptance

Result: **A — ACCEPTED FOR PERSONAL PILOT**

Frozen checkpoint: `88dedf0b12f491daae088c78a0c15be340493d10`

Acceptance date: 2026-09-14 (America/Chicago).

Fresh detached checkout: `C:\Users\awbostwick\Documents\ChatGPT\architecture check\.sotf-local\final-personal-pilot-acceptance-88dedf0`.

This is a local software-readiness decision for Andrew's personal-use pilot. It does not claim that a hosted migration, deployment, production identity/configuration check, entitlement grant, or live ChatGPT connection occurred. Those remain separately authorized operational activation steps, not unresolved SOTF v1 correctness defects.

## Evidence boundary

The migration line-ending portability defect is closed and was not reopened or refactored. The exact committed portability range remains:

- `9491004e2b2a945187e6f3c257cac59da7761c2c` — implementation and permanent regression.
- `88dedf0b12f491daae088c78a0c15be340493d10` — canonical portability evidence.

The following results are carried forward only from `docs/testing/sotf-v1-migration-line-ending-portability.md`; they were not rerun merely for repetition:

| Frozen result | Status |
| --- | --- |
| Fresh CRLF and LF migrations | PASS / PASS |
| DB/RLS | 1154/1154 |
| SOTF pgTAP | 911/911 |
| Units | 236/236 |
| Schema contracts | 41/41 |
| Temporal, timestamp precision, America/Asuncion, and 499us | PASS |
| Typecheck, lint, build, database lint, boundaries, sensitive, whitespace | PASS |
| Unicode, unsigned UTF-8 ordering, exact decoded references, 418-zone contract | PASS |
| CRLF/LF normalized definitions | IDENTICAL |
| Frozen synthetic residue | ZERO |

The new work below resolves the criteria that the interrupted Astra pass explicitly left unobserved. It does not convert prior evidence into a claim that it was freshly rerun.

## Independent P/D/S/A audit

The complete governed path was traced from `lib/workspace/mcp-server.ts` registration through `lib/sotf/v1-mcp.ts`, `lib/sotf/daily-brief-v1.ts`, the authenticated RPCs, and the private database authority functions.

| Class | Current responsibility | Finding |
| --- | --- | --- |
| P | Formatting already-authorized values for people | Presentation only; no accept/deny influence. |
| D | Exact timestamp transport, local/civil boundaries, bounded projection, eligible references, revision/token identity, current access, and final write | PostgreSQL result is consumed or exact strings/identities are compared. |
| S | New-input preparation, application clock proposal, scheduling suggestions, and legacy/unit preview projection | Does not issue v1 authority or authorize the governed outcome write. |
| A | Application recomputes a governed temporal validity or membership fact | **Zero remaining paths.** |

Specific source proof:

- `sotf_get_daily_brief_state` calls `sotf_v1_get_daily_brief_authority` and passes its closed projection to `consumeDailyBriefProjectionAuthority`.
- `sotf_record_daily_brief_outcome` rechecks current access, exact workflow identity, current database authority, revision/token equality, database-issued eligible references, and truncation identity before the final RPC.
- The handler imports `consumeDailyBriefProjectionAuthority`; it does not import or call `projectDailyBriefState`, `dailyBriefWindow`, the broad event reader, or replay to reconstruct v1 authority.
- The fallback `projectDailyBriefState` and `dailyBriefWindow` temporal computations remain reachable only from unit/differential runners in the repository-wide call-site search. They do not occur on the registered v1 MCP read/write path.
- Canonical event replay preserves exact timestamp strings. The database trigger alone parses and orders persisted governed timestamps.

Independent conclusion: the completed P/D/S/A inventory still contains **zero A-class temporal paths** in the SOTF v1 governed read/write path.

## New 33-case interaction run

Machine-readable local evidence: `.sotf-local/final-personal-pilot-acceptance.json`  
SHA-256: `0a0e1a0b6818c0e0b1d0b062ca4c2f9c89d77163895f7edcb173545e4a2c1193`

Final clean run: `2026-09-14T13:07:35.455Z` through `2026-09-14T13:08:48.448Z`.

All cases used synthetic users and workspaces against `http://127.0.0.1:56421`. For each case, database authority, application decision, direct authenticated RPC decision, persistence, and replay/receipt behavior were observed rather than inferred.

| ID | Interaction | Database authority | Application | RPC | Persistence | Replay / receipt |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Positive 1us inside one JS millisecond | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T02 | Positive 2us inside one JS millisecond | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T03 | Positive 10us inside one JS millisecond | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T04 | Positive 499us canonical replay | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T05 | Positive 999us boundary | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T06 | Positive sub-ms interval across UTC midnight | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T07 | Positive sub-ms interval across Chicago midnight | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T08 | Spring-forward transition | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T09 | Repeated fall-back hour with decreasing wall time | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T10 | Positive sub-ms half-hour offset | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T11 | Positive sub-ms quarter-hour offset | accept exact positive interval | accept | accept exact replay | exactly once | identical state; exact strings |
| T12 | Zero microsecond interval | deny non-positive interval | deny | deny | unchanged | none |
| T13 | Negative 1us interval | deny non-positive interval | deny | deny | unchanged | none |
| T14 | Negative 499us interval | deny non-positive interval | deny | deny | unchanged | none |
| T15 | Timestamp precision beyond six digits | deny invalid temporal operation | deny | deny | unchanged | none |
| A01 | Complete retrieval, bounded state, save, and replay | current and bounded | accept | accept exact replay | exactly once | application/RPC receipt identical |
| A02 | Source revision changes after read | deny stale revision/token | deny `state_changed` | deny `state_changed` | unchanged | none |
| A03 | Previously eligible meeting becomes ineligible | deny stale membership | deny `invalid_input` | deny `invalid_input` | unchanged | none |
| A04 | Entitlement revoked before write | deny current authority | deny `entitlement_required` | same | unchanged | none |
| A05 | Required capability revoked before write | deny current authority | deny `capability_unavailable` | same | unchanged | none |
| A06 | Database release gate revoked before write | deny current authority | deny `service_unavailable` | same | unchanged | none |
| A07 | Workspace membership revoked before write | deny current authority | deny `access_denied` | same | unchanged | none |
| A08 | MCP client authorization disconnected before write | deny current authority | deny `access_denied` | same | unchanged | none |
| A09 | OAuth resource grant removed before write | deny current authority | deny `access_denied` | same | unchanged | none |
| A10 | Personal plan suspended before write | deny current authority | deny `entitlement_required` | same | unchanged | none |
| A11 | Exact replay after entitlement revocation | deny replay under revoked authority | deny `entitlement_required` | same | unchanged | no cached receipt bypass |
| A12 | Exact replay after membership revocation | deny replay under revoked authority | deny `access_denied` | same | unchanged | no cached receipt bypass |
| A13 | Changed selected reference with reused request/run IDs | deny changed intent | deny `idempotency_conflict` | same | unchanged | original receipt not reused |
| A14 | Added/tampered `window_start` projection field | deny extra temporal field | deny `invalid_input` | same | unchanged | none |
| A15 | Added/tampered `as_of` projection field | deny extra temporal field | deny `invalid_input` | same | unchanged | none |
| A16 | Well-shaped but false authority token | deny token mismatch | deny `state_changed` | same | unchanged | none |
| A17 | Primary selects reference existing only in second workspace | deny cross-workspace reference | deny `invalid_input` | same | unchanged | none |
| A18 | Second tenant selects primary tenant reference | deny cross-tenant reference | deny `invalid_input` | same | unchanged | none |

The T04 stored values were exactly `...000001Z` and `...000500Z`. Canonical application replay returned those same six-digit strings even though JavaScript renders the instants in one millisecond. The direct exact RPC and application retry did not add another event.

## Complete local flow

The final run exercised:

`bundle discovery -> manifest -> workflow discovery -> authorized workflow retrieval -> database-authoritative bounded state -> synthetic host result -> governed write -> current-authority revalidation -> exactly-once persistence -> exact application replay -> exact RPC replay`

Results:

- Discovery, manifest, and workflow retrieval: PASS.
- One content-free workflow-retrieval audit receipt: PASS.
- Database-authoritative bounded projection: PASS.
- Governed outcome save: PASS.
- Current authority revalidation: PASS.
- Persistence: exactly one outcome.
- Application and direct RPC replay: identical receipt, no duplicate.

## Frozen non-temporal invariants

No new contradictory evidence was produced. The following remain established by the frozen committed DB/RLS, SOTF pgTAP, unit, schema, and differential results and are additionally exercised where applicable by the new cross-boundary run:

- required-field NULL/type fail closed;
- semantic truncation and contradictory-metadata rejection;
- UTF-16 and surrogate-safe clipping;
- unsigned UTF-8 projection ordering;
- exact decoded-string reference matching;
- exact 418-zone identifier contract;
- tenant/workspace isolation;
- current authority and revision enforcement;
- canonical idempotent recovery without duplicate persistence.

## Harness notes

Two non-product harness corrections occurred before the final clean run: synthetic entitlement references initially collided with a fixture uniqueness constraint, and a setup-only commitment included an unsupported `status` field. Both failed before the affected acceptance segment, were removed, and left zero residue. A diagnostic run also corrected the expected label for a disconnected MCP client from `incompatible_contract` to the actually observed earlier `access_denied` boundary. No product source, migration, schema, or frozen evidence was changed to obtain the pass.

## Classification and operational boundary

No reproducible correctness defect remains that blocks Andrew's personal-use pilot. The tested V1 software preserves tenant isolation, data integrity, current authentication/authorization, migration safety, governed workflow correctness, exactly-once recovery, and fail-closed temporal semantics.

The result is therefore **A — ACCEPTED FOR PERSONAL PILOT**. This means the frozen SOTF V1 software is ready to enter the separately approved personal-pilot activation sequence. It does not authorize or claim a merge, push, PR, hosted migration, deployment, production configuration change, real entitlement, or live provider action.

## Cleanup and scope

- Synthetic users: 0.
- Synthetic workspaces: 0.
- Synthetic outcomes: 0.
- Synthetic operation events: 0.
- Synthetic workflow audits: 0.
- Product settings restored to their pre-run values.
- No hosted action, production read/write, deployment, push, merge, or pull request occurred.
- The portability implementation and evidence commits are unchanged.
- The only tracked change in this acceptance checkout is this evidence report; it is not staged or committed.

**A — ACCEPTED FOR PERSONAL PILOT**
