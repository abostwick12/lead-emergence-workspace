# SOTF v1 required-host NULL-validation repair

Status: **COMPLETE — REQUEST COMMIT AUTHORIZATION**.

This is local source and acceptance evidence for the mutable repair based on exact commit `e0277b742569ddcb69d9c7c7fdcd6973a265f992`. It is not hosted acceptance, deployment evidence, or authorization to commit, push, merge, migrate a hosted database, change an entitlement, connect ChatGPT, or modify production.

## 1. Exact implementation and scope

- Branch: `codex/sotf-v1-required-host-null-repair`.
- Isolated worktree: `C:\Users\awbostwick\AppData\Local\Temp\sotf-v1-required-host-null-repair`.
- HEAD remains exactly `e0277b742569ddcb69d9c7c7fdcd6973a265f992`; the reviewed commit was not rewritten.
- The repair changes only the pending SOTF v1 daily-brief database validator, its database/schema tests, and this evidence report.
- The source migration remains release-gated and defaults `sotf_v1_daily_brief_enabled` to `false`.

## 2. Root cause and SQL three-valued logic

The authenticated write authority is `workspace.sotf_v1_record_daily_brief_outcome(outcome jsonb)`. It derives the workspace and user from current MCP authorization, locks and rechecks current authority, calls `workspace_private.validate_sotf_v1_daily_brief_outcome(outcome)`, and only then casts fields and inserts into `workspace_private.sotf_daily_brief_outcomes`.

The payload parser uses PostgreSQL JSON operators. `outcome -> 'host'` returns JSON, while `outcome ->> 'host'` returns SQL text. For either a missing key or JSON `null`, `outcome ->> 'host'` is SQL `NULL`.

The failed predicate was:

```sql
outcome ->> 'host' <> 'chatgpt'
```

SQL comparisons with `NULL` evaluate to `UNKNOWN`, not `TRUE`. PL/pgSQL executes an `IF` body only when its condition is `TRUE`. If every other disjunct was `FALSE`, `FALSE OR UNKNOWN` remained `UNKNOWN`, so the rejection branch did not run. `host` was retained only inside the JSON payload, so a table-column `NOT NULL` constraint did not provide a later backstop. The RPC returned `saved:true` and persisted the malformed payload.

The bounded audit confirmed the same class in `execution_mode`, `data_class`, and `provenance.source`. Workflow retrieval/list parameters also used ordinary `<>`; SQL `NULL` could reach a late constraint error or produce an empty successful read rather than the declared typed denial.

## 3. Authority-boundary repair

The database validator now independently requires the JSON type of every scalar required field before comparing or casting it. Fixed identities use NULL-safe comparisons such as:

```sql
jsonb_typeof(outcome -> 'host') is distinct from 'string'
or outcome ->> 'host' is distinct from 'chatgpt'
```

The same structure protects `schema_version`, workflow identity/version, execution mode, data class, status, usefulness, UUID identities, dates, time zone, connector states, reference identity, and provenance source. Revision and UUID/date casts occur only after type and lexical validation. Required JSON booleans continue to use JSONB `IS DISTINCT FROM` comparisons. Array/object shapes retain exact key-count and allowlist enforcement.

The workflow retrieval and outcome-list RPCs now use `IS DISTINCT FROM` for their required SQL parameters. The internal access-state comparison is also NULL-safe. The repair does not rely on the frontend, TypeScript, MCP Zod validation, client normalization, or table insertion failure.

## 4. Required-field NULL-safety audit

| Authority input | Classification after repair | Enforcement |
| --- | --- | --- |
| Workspace, subject, MCP client | Not applicable as payload fields; explicit NULL-safe authority derivation | Derived from authenticated JWT, membership, grant and current connection; caller cannot supply a workspace selector |
| `schema_version` | Explicit NULL-safe | JSON string plus exact `1` |
| `request_id`, `run_id` | Explicit NULL-safe | JSON strings, UUID lexical checks, guarded casts, scoped uniqueness |
| `workflow_id`, `workflow_version` | Explicit NULL-safe | JSON strings plus fixed identities; retrieval/list SQL parameters use `IS DISTINCT FROM` |
| `expected_state_revision` | Explicit NULL-safe | JSON number, integer lexical/range checks, then current locked revision comparison |
| `brief_date`, `time_zone` | Explicit NULL-safe | JSON strings, guarded date cast, IANA zone existence and local-day policy |
| `host` | Explicit NULL-safe | JSON string plus exact supported host `chatgpt` |
| `execution_mode`, `data_class` | Explicit NULL-safe | JSON strings plus exact `A` and `ordinary_transition_operations` |
| `user_confirmed` | Explicit NULL-safe | Exact JSON boolean `true` |
| `status`, `usefulness` | Explicit NULL-safe | JSON strings plus closed allowlists |
| `connector_results` and both read states | Explicit NULL-safe | Exact object keys; each nested value is a JSON string in its closed allowlist |
| `degradation_reasons` | Explicit NULL-safe | JSON array, bounded size, explicit NULL rejection, allowlist and uniqueness |
| `selected_le_refs`, `entity_type`, `entity_id` | Explicit NULL-safe | JSON array; exact nested keys/types; closed entity allowlist; current-tenant existence |
| `priority_count` | Explicit NULL-safe | JSON number plus integer allowlist `0` through `3` |
| `provenance`, `source`, `provider_content_persisted` | Explicit NULL-safe | Exact object; source string and fixed identity; exact JSON boolean `false` |
| Retry intent | Explicit NULL-safe | Complete validated payload equality plus request/run uniqueness; changed retry is a conflict |

No required caller-controlled field in this RPC remains dependent only on a later table constraint. Optional fields were not converted into requirements.

## 5. Host validation matrix

| Case | Fresh authoritative result |
| --- | --- |
| Field absent | `22023 sotf_v1:invalid_input`; no side effect |
| JSON `null` | `22023 sotf_v1:invalid_input`; no side effect |
| JSON value whose `->>` extraction is SQL `NULL` | `22023 sotf_v1:invalid_input`; no side effect |
| Empty string | `22023 sotf_v1:invalid_input`; no side effect |
| Whitespace-only string | `22023 sotf_v1:invalid_input`; no side effect |
| Number | `22023 sotf_v1:invalid_input`; no side effect |
| Boolean | `22023 sotf_v1:invalid_input`; no side effect |
| Object | `22023 sotf_v1:invalid_input`; no side effect |
| Array | `22023 sotf_v1:invalid_input`; no side effect |
| Unsupported string `claude` | `22023 sotf_v1:invalid_input`; no side effect |
| Supported string `chatgpt` | Eligible to continue; valid write returned `saved:true`, `replayed:false` |
| Exact valid retry | Same receipt returned with `saved:true`, `replayed:true`; one durable row |

A separate SQL `NULL` outcome parameter was also rejected as `22023 sotf_v1:invalid_input` with no side effect.

## 6. Persistence and no-side-effect assertions

Each denied missing/NULL/type-confusion case captures state before and after the authenticated RPC and requires all of the following in one pgTAP assertion:

- no response with `saved:true`;
- exact `22023 sotf_v1:invalid_input` denial;
- unchanged total outcome rows;
- unchanged ordinary SOTF head revision;
- unchanged ordinary event count;
- unchanged workflow-access audit count;
- no partial durable insert.

The matrix covers all 19 required top-level fields and the six required nested fields (`calendar_read`, `email_read`, provenance source/persistence declaration, and selected-reference type/ID). Missing, JSON-null, and wrong-JSON-type forms are exercised for each. The direct PostgREST probe independently verifies the same invariants for NULL workflow version, host, execution mode, data class, and provenance source.

## 7. Fresh regression results

| Check | Fresh result |
| --- | --- |
| Clean local migration replay | **20/20 PASS** |
| Focused SOTF v1 pgTAP | **122/122 PASS** |
| Full RLS/pgTAP, ten SQL files | **399/399 PASS** |
| Unit suite | **117/117 PASS**, 20 files |
| Schema contracts | **34/34 PASS** |
| Product boundaries | **PASS**, 86 runtime files |
| TypeScript | **PASS** |
| ESLint | **PASS** |
| Production build | **PASS**, 27/27 static pages |
| Local database lint | **PASS**, no errors in `workspace`, `workspace_private`, or `public` |
| Sensitive-data scan | **PASS**, 88 release-lineage commits and 536 unique Git blobs plus worktree |
| `git diff --check` | **PASS** |
| Preview browser | **6/6 PASS**, desktop and mobile |
| Database-backed MCP/PostgREST integration | **3/3 PASS** |
| Supplemental adversarial groups | **31/31 PASS** |

The focused database suite grew from 36 to 122 assertions. Its 86 new assertions comprise three NULL-safe retrieval/list checks, eleven host/SQL-NULL denials, 54 top-level required-field cases, and 18 nested required-field cases.

## 8. Prior and new adversarial probes

The local integration apparatus loaded the actual `registerSotfV1Tools`, used an MCP client/server pair over in-memory transport, called loopback PostgREST through the real Supabase client, and relied on the freshly migrated database. RPC results were not mocked.

- I01-I03 passed: discovery/exact retrieval, bounded state, and governed write/read-back/exact retry.
- X01-X14 passed: tenant isolation, cross-workspace injection, version/path denial, both idempotency conflicts, stale revision, content smuggling/size limits, refusal/changed intent, duplicate references/status, database gate, entitlement revocation, capability removal, and DST/local-day behavior.
- Y01-Y12 passed: workflow-version type confusion, user injection, numeric request ID, string revision, nested workspace injection, connector/provenance content smuggling, invalid completion, app gate, negative priority, string confirmation, and forbidden provider-persistence declaration.
- X15-X16 now pass with typed errors and unchanged durable state: NULL workflow version and the formerly failing NULL host.
- X17-X19 pass the confirmed same-class direct-RPC cases: NULL execution mode, data class, and provenance source.

The integration run ended with 34 total passing groups: three integration groups and 31 adversarial groups. It observed one valid metadata outcome, zero forbidden synthetic-content payloads, and no malformed NULL-field persistence.

## 9. Nonblocking environment/harness issue

**NONBLOCKING ENVIRONMENT/HARNESS ISSUE** — the connected synthetic component browser suite again completed 0/2 scenarios because Vite inherited `C:\Users\awbostwick\AppData\Local\Temp\postcss.config.mjs`, which requires unavailable `@tailwindcss/postcss`. Both desktop and mobile stopped at the first input because the Vite error overlay replaced the page. This occurs before SOTF interaction, matches the previously reported environment/configuration failure, and is not evidence against the database repair. The unrelated PostCSS configuration was not changed on this security branch.

The production-mode preview suite is independent of that inherited Vite configuration and passed 6/6.

## 10. Files changed

- `supabase/migrations/20260911143000_sotf_v1_daily_brief_slice.sql`
- `supabase/tests/database/sotf_v1_daily_brief_slice.sql`
- `tests/schema-policy-contract.test.mjs`
- `docs/testing/sotf-v1-required-host-null-repair.md`

No Entry, Cash, E2, Professional Context, canonical architecture, provider adapter, deployment, or hosted-control file changed.

## 11. Cleanup and hosted boundary

The test apparatus used only `http://127.0.0.1:56421` and local database port `56422`. `supabase status` reported `linked_project:null`. No `supabase link`, `db push`, migration repair, hosted API, tunnel, purchase, Vercel deployment, ChatGPT connection, real provider connector, production entitlement, or live data mutation occurred.

Synthetic cleanup was verified after integration: Auth users `0`, workspaces `0`, daily-brief outcomes `0`, workflow audits `0`, and MCP resource grants `0`. Settings were restored to `sotf_v1_daily_brief_enabled=false`, `mcp_dynamic_admission_enabled=false`, and `mcp_resource_uri=http://localhost:3000/api/mcp`. The tenant-B sentinel remained unchanged while tenant A was removed. All local application and harness servers were stopped. The local Supabase stack remains running and empty for other local work.

Nothing was committed, pushed, merged, deployed, or applied to a hosted system.

SOTF V1 NULL-VALIDATION REPAIR COMPLETE — REQUEST COMMIT AUTHORIZATION
