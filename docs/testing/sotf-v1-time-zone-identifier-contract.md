# SOTF v1 canonical time-zone identifier contract evidence

## 1. Scope and frozen base

Branch: `codex/sotf-v1-time-zone-identifier-contract`.

Frozen base: `8fb330571f06089df9d022a79751d164d7499f12`.

Implementation freeze commit: `ee841d9` (`fix(sotf): canonicalize time-zone identifiers across runtimes`). This evidence report is frozen separately as the only file in the authorized documentation commit.

## 2. Reproduced root cause

The application used `Intl.DateTimeFormat`, while PostgreSQL accepted exact membership in `pg_timezone_names`. PostgreSQL 15 exposed 1,194 names, including 597 `posix/` compatibility entries. Thus `posix/America/Chicago` was rejected by the application but accepted by the authenticated database authority and could be persisted.

The same ambient-runtime approach also left the contract open to legacy links. Examples include `US/Central`, `CST6CDT`, `Etc/UTC`, `Asia/Calcutta`, `Europe/Kiev`, and `America/Godthab`. Some are accepted or canonicalized differently by JavaScript and PostgreSQL. Prefix-only rejection would not close those classes.

## 3. Canonical contract

SOTF v1 accepts the exact intersection of:

1. IANA 2025b `zone.tab` primary identifiers plus the special identifier `UTC`;
2. identifiers executable by the pinned Node 24 JavaScript runtime; and
3. identifiers present in the pinned PostgreSQL 15 time-zone catalog.

The resulting version-controlled set contains 418 identifiers. `America/Coyhaique` is the one IANA 2025b `zone.tab` primary excluded because the pinned PostgreSQL catalog cannot execute it. Compatibility links, POSIX rule names, implementation entries, fixed-offset `Etc` names, case changes, padding, path variations, and Unicode lookalikes are invalid.

Both boundaries perform exact decoded-string membership. Neither trims, folds case, normalizes Unicode, calls runtime alias canonicalization, or rewrites the submitted identifier. A future set change requires an explicit contract update and database migration.

## 4. Repair

- `lib/sotf/v1-canonical-time-zones.json` stores the versioned 418-name contract and records the unavailable primary.
- `lib/sotf/v1-time-zones.ts` exposes the exact membership predicate and Zod schema.
- Daily-brief state input, outcome input, stored receipt, generated projection, and local-day window validation use that one schema/predicate.
- `supabase/migrations/20260913200000_sotf_v1_time_zone_identifier_contract.sql` creates a private, RLS-enabled canonical-name table with no public/anon/authenticated access, verifies PostgreSQL can execute every member, adds a private exact predicate, replaces the final outcome authority check, and adds a durable table constraint.
- The prior outcome validator is otherwise unchanged, and prior migrations were not modified.

## 5. Shared defensive corpus

The same 43 decoded strings are consumed by TypeScript, pgTAP, and the loopback MCP/PostgREST differential runner.

| Decision | Cases |
| --- | ---: |
| Canonical accept | 10 |
| Alias/namespace/malformed deny | 33 |
| Application/database divergence | 0 |

Accepted representatives include `America/Chicago`, `UTC`, `Asia/Kolkata`, `Europe/Kyiv`, `America/Nuuk`, `Africa/Asmara`, `Pacific/Chuuk`, `Pacific/Kanton`, `America/Argentina/Buenos_Aires`, and `Australia/Lord_Howe`.

Denied representatives include the reported `posix/America/Chicago`, legacy and superseded links, POSIX rules, fixed-offset `Etc/GMT+6`, empty/case/padded/path variants, and the division-slash lookalike `America∕Chicago`.

## 6. Authority and persistence proof

Every canonical case was accepted by the MCP handler, accepted by the authenticated RPC, persisted once, and returned exact replay without a duplicate. Every invalid case was denied by both boundaries with SQLSTATE `22023`; before/after row counts and digests were unchanged for outcome rows, operation events, operation heads/revisions, and workflow access audit.

The clean-state runner produced 43/43 aligned cases: handler 10 accept and 33 deny; RPC 10 accept and 33 deny. Cleanup left synthetic users, workspaces, outcomes, events, and audits at zero and restored all local release/resource settings.

## 7. Frozen invariant fingerprints

| Frozen artifact | Blob | Match `8fb3305` |
| --- | --- | --- |
| Required NULL/type migration | `b20992a75c710bb920ec08825456b24a0fe367ff` | Yes |
| Cross-field semantic migration | `2723af8c36aa2d870a0b06c11e60b88b5bc5d987` | Yes |
| Unicode truncation migration | `3c06e4b7af463cde16d83149959d09550e1685f9` | Yes |
| Canonical ordering migration | `d6352a07d899c8d99720248430062cfe91c3e0e0` | Yes |
| Exact reference migration | `80828bdedcb77236a5cbbb9bec1d887837a28d9f` | Yes |

The comprehensive differential independently reconfirmed 212/212 aligned decisions and 63 higher-level checks, including authority loss, tenant isolation, NULL/type closure, semantic contradictions, today/yesterday and DST bounds, UTF-16 measurement, surrogate-safe clipping, byte budgets, unsigned UTF-8 ordering, exact reference membership, replay, and cleanup. The separate ordering differential remained 62/62 aligned, and the reference differential remained 30/30 aligned.

## 8. Fresh local validation

| Check | Result |
| --- | ---: |
| Fresh local migrations | 25/25 applied |
| Focused time-zone pgTAP | 91/91 PASS |
| Full pgTAP/RLS | 1006/1006 PASS across 15 files |
| Time-zone MCP/PostgREST differential | 43/43 aligned |
| Reference MCP/PostgREST differential | 30/30 aligned |
| Ordering MCP/PostgREST differential | 62/62 aligned |
| Comprehensive MCP/PostgREST differential | 212/212 aligned; 63/63 checks |
| Repository unit tests | 227/230; only the known three September 11 fixtures fail |
| New and prior focused TypeScript parity suites | PASS |
| Schema-policy contracts | 39/39 PASS |
| Product-boundary scan | PASS; 88 runtime files |
| Typecheck | PASS |
| Lint | PASS |
| Production build | PASS; 27/27 static pages |
| Database lint | PASS; zero findings |
| Sensitive-data scan | PASS; 98 release-lineage commits, 578 unique blobs, and working tree |
| `git diff --check` | PASS |

The full unit suite is not called PASS. Its only failures are the inherited three hard-coded September 11 cases in `tests/sotf-v1-mcp.test.ts`; they are outside the today/yesterday window on September 13. The focused and comprehensive time-zone tests use current local dates and pass. The inherited temporary-folder PostCSS issue did not occur in this in-repository worktree; the production build passed.

## 9. Files changed

1. `lib/sotf/v1-canonical-time-zones.json` — fixed canonical set.
2. `lib/sotf/v1-time-zones.ts` — shared application predicate/schema.
3. `lib/sotf/daily-brief-v1.ts` — canonical schema at every v1 time-zone surface.
4. `supabase/migrations/20260913200000_sotf_v1_time_zone_identifier_contract.sql` — private database contract and final authority enforcement.
5. `supabase/tests/database/sotf_v1_time_zone_identifier_contract.sql` — shared corpus and 91 database assertions.
6. `tests/sotf-v1-time-zone-identifier-contract.test.ts` — exhaustive application/runtime validation.
7. `scripts/test-sotf-v1-time-zone-local.mjs` — loopback dual-boundary differential.
8. `tests/schema-policy-contract.test.mjs` — cross-copy and authority wiring locks.
9. `tests/sotf-v1-reference-parsing-parity.test.ts` — updates the prior padded-zone expectation to the new canonical denial.
10. `package.json` — registers the database test and local differential.
11. `docs/architecture/sotf-v1-contracts.md` — canonical identifier contract.
12. This document — local evidence and limitations.

No Cash, E2, Entry, Supa, billing, provider, hosted Supabase, entitlement, deployment, ChatGPT connection, or other workstream file/state changed.

## 10. Hosted boundary and stop point

All tests used local source, an unlinked loopback Supabase stack, synthetic fixtures, in-memory MCP, and local PostgREST. The disposable stack was stopped without backup after cleanup. No hosted migration, production connection, deployment, external send, push, PR, merge, amendment, or history rewrite occurred.

The repair implementation and this evidence inventory are the only authorized local commits in the base-to-HEAD range.
