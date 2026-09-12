# SOTF v1 outcome semantic-parity repair

Date: 2026-09-12

Branch: `codex/sotf-v1-outcome-semantic-parity-repair`

Frozen base and current uncommitted HEAD: `65e448766218b1e716ab10c0afff4dd8a31dd42a`

This is a local, uncommitted repair of the SOTF v1 governed daily-brief outcome authority boundary. It preserves the frozen NULL-validation repair. It does not authorize or implement another workflow, provider integration, runtime, scheduler, Context Graph, or hosted mutation.

## 1. Exact root cause

The public outcome does not contain caller fields literally named `state_truncated` or `truncated_sections`. In the committed contract:

- `truncated_sections` belongs to the server-produced bounded state projection.
- The outcome declares the corresponding condition by including or omitting the enum member `state_truncated` in `degradation_reasons`.

The MCP handler parsed the closed outcome schema, rebuilt the bounded projection, and enforced:

```text
(projection.truncated_sections.length > 0)
=== outcome.degradation_reasons.includes("state_truncated")
```

The authenticated RPC validator checked that `state_truncated` was a supported, unique degradation reason and excluded it from the connector-companion calculation. It never derived actual projection truncation. Therefore a direct authenticated RPC caller could submit `degradation_reasons:["state_truncated"]` when the authoritative projection had `truncated_sections:[]`; the handler denied it, while the RPC returned `saved:true` and persisted it.

The same trace found a second same-path weakness. The handler required every `selected_le_refs` entry to exist in the exact returned-eligible projection. The RPC required only historical existence anywhere in the ordinary event log. A future, resolved, replaced, paused, rejected, outside-window, or count/size-omitted record could therefore pass the former RPC rule even though the host never received it in the current projection.

## 2. Canonical truncation semantics

The canonical source is `docs/architecture/sotf-v1-contracts.md`, especially its bounded projection and write-back sections. `truncated_sections` names every bounded array with omitted rows or clipped text, plus `chapter` when its question is clipped. The 64 KiB projection limit removes tail rows in the documented order and adds the affected section names. Empty arrays are valid and are not unavailable state.

The outcome continues to declare `state_truncated` through `degradation_reasons`; the repair does not add or remove public fields and does not silently rewrite caller input. The database derives the authoritative fact and compares it with the declaration. This retains public semantics while removing trust in contradictory redundant metadata.

## 3. Contract-to-persistence trace

1. `lib/sotf/daily-brief-v1.ts` defines the strict outcome schema and the canonical projection algorithm.
2. `lib/sotf/v1-mcp.ts` parses the schema, retrieves/replays ordinary state, builds the projection, validates exact returned-reference eligibility, and compares actual truncation with the declaration.
3. The MCP handler calls `workspace.sotf_v1_probe_daily_brief_outcome(jsonb)` and then `workspace.sotf_v1_record_daily_brief_outcome(jsonb)`.
4. `20260911143000_sotf_v1_daily_brief_slice.sql`, including the prior NULL repair frozen in the base, validates the closed shape, types, fixed identities, connector/reason/status relationships, provenance, idempotency, current authority, date, and revision.
5. Before this repair, the SQL write path checked selected references with historical `sotf_v1_reference_exists` and did not derive projection truncation.
6. `20260912162000_sotf_v1_outcome_semantic_parity.sql` now derives both projection-dependent facts before any first persistence.

## 4. Handler semantic rule inventory

| Rule | Pre-repair RPC classification | Repair result |
|---|---|---|
| Closed top-level and nested shape | Enforced identically after prior NULL repair | Unchanged |
| Required string/number/boolean types and ranges | Enforced identically after prior NULL repair | Unchanged; `host:null` regression retained |
| Fixed workflow/version/host/execution mode/data class | Enforced identically | Unchanged |
| User confirmation and metadata-only provenance | Enforced identically | Unchanged |
| Connector enum and exact companion degradation reasons | Enforced identically | Unchanged |
| `completed` only with both connectors used and no degradation | Enforced identically | Unchanged |
| Unique references, maximum three, no more than priority count | Enforced identically | Unchanged |
| Reference exists in exact current returned projection | Missing; RPC used historical existence | Fixed by authoritative projection-derived eligible IDs |
| Actual truncation exactly matches `state_truncated` declaration | Missing | Fixed by authoritative projection-derived truncation |
| Current ordinary state revision | Enforced differently but equivalently | Unchanged; write RPC remains authoritative |
| IANA zone and today/yesterday local-day bound | Enforced differently but equivalently | Unchanged |
| Exact request/run idempotent replay | Database-authoritative; handler delegates to probe | Preserved before projection-dependent revalidation |
| Outcome-type-specific alternative structures | Not applicable | Only the single closed daily-brief outcome exists |
| Entitlement, capability, tenant, client, and release authority | Database-authoritative and rechecked by handler | Unchanged |

## 5. Confirmed parity gaps

Two gaps were in scope and repaired:

1. Contradictory `state_truncated` outcome metadata was persistable through direct authenticated RPC.
2. A historically existing but currently ineligible `selected_le_refs` record was persistable through direct authenticated RPC.

No other weaker same-path semantic rule was found. All other handler rules are already enforced identically, enforced differently but equivalently at the database authority, or are not applicable to this single outcome type.

## 6. Authoritative-boundary repair

The forward migration adds private helpers that replay only ordinary SOTF fields needed for the daily-brief projection. It applies the canonical filters, ordering, count limits, text clipping, recent outcome bounds, suggestion filtering, and 64 KiB removal order. It returns only:

- derived `truncated_sections`; and
- derived current `eligible_refs`.

Both the authenticated probe and write RPC call the private semantic validator for a new outcome. The write RPC still locks and rechecks current authority, validates the closed payload, checks the current head revision and local-day bound, validates projection semantics, enforces capacity, and then inserts. The private helpers are not executable by `public`, `anon`, or `authenticated`.

Exact stored retries are resolved before projection-dependent validation. This preserves idempotency when ordinary state changes after a successful outcome; a caller must still present the exact original IDs and payload, and current entitlement remains required.

## 7. Truncation and related parity matrix

Here, “true” means `state_truncated` is present in `degradation_reasons`; “false” means it is absent. `truncated_sections` is always server-derived.

| ID | Corpus case | Expected | Handler | Authenticated RPC |
|---|---|---:|---:|---:|
| C01 | false + empty projection | Accept | Accept | Accept/save + exact replay |
| C02 | true + non-empty valid sections | Accept | Accept | Accept/save + exact replay |
| C03 | true + empty projection | Deny | Deny | Deny/no side effect |
| C04 | false + non-empty projection | Deny | Deny | Deny/no side effect |
| C05 | missing redundant boolean | Accept as false | Accept | Accept/replay |
| C06 | missing caller sections | Accept; server derives | Accept | Accept/replay |
| C07 | JSON-null declaration | Deny | Deny | Deny/no side effect |
| C08 | wrong-type declaration | Deny | Deny | Deny/no side effect |
| C09 | duplicate `state_truncated` | Deny | Deny | Deny/no side effect |
| C10 | unsupported section name used as reason | Deny | Deny | Deny/no side effect |
| C11 | empty-string reason | Deny | Deny | Deny/no side effect |
| C12 | whitespace-only reason | Deny | Deny | Deny/no side effect |
| C13 | malformed nested reason | Deny | Deny | Deny/no side effect |
| C14 | caller supplies `truncated_sections` | Deny; closed outcome | Deny | Deny/no side effect |
| C15 | caller supplies top-level `state_truncated` | Deny; closed outcome | Deny | Deny/no side effect |
| C16 | future-filtered commitment ref | Deny | Deny | Deny/no side effect |
| C17 | resolved commitment ref | Deny | Deny | Deny/no side effect |
| C18 | replaced criterion ref | Deny | Deny | Deny/no side effect |
| C19 | rejected hypothesis ref | Deny | Deny | Deny/no side effect |
| C20 | paused opportunity ref | Deny | Deny | Deny/no side effect |
| C21 | outside-window meeting ref | Deny | Deny | Deny/no side effect |
| C22 | exact stored replay after projection change | Accept replay | Accept | Accept/replay; no duplicate |
| C23 | old true declaration after projection becomes untruncated | Deny as new intent | Deny | Deny/no side effect |
| C24 | stale revision with otherwise valid semantics | Deny | Deny | Deny/no side effect |

The handler and database test sources contain the same C01-C24 identifiers. `tests/schema-policy-contract.test.mjs` fails if either side omits a case or their sets diverge.

## 8. Differential handler/RPC results

- New isolated handler file: `tests/sotf-v1-outcome-semantic-parity.test.ts`.
- Why necessary: a mocked handler-only test could prove application behavior but not RPC authority, while pgTAP alone could prove authority but not prevent later handler/RPC drift. The paired corpus and schema-policy set equality prove both acceptance surfaces remain aligned.
- Handler path: C01-C24 all matched expected accept/deny behavior; 2/2 Vitest tests passed. Every invalid case reached the persistence RPC zero times.
- RPC path: C01-C24 all matched expected accept/deny behavior within 47/47 pgTAP assertions.
- Schema-policy: 35/35 passed and enforces the private helper, both call sites, revoked helper privileges, and exact corpus-set equality.

## 9. Persistence and no-side-effect proof

For every denied RPC payload, the pgTAP helper captures before/after state for:

- daily-brief outcomes;
- ordinary operation events;
- complete operation heads, including revision;
- workflow access audits;
- bundle entitlements;
- MCP authorizations; and
- OAuth resource grants.

It also requires SQLSTATE `22023` or the deliberate stale-revision `40001`, requires that no response claimed `saved:true`, and compares the complete snapshot after the rejected call. All denial assertions passed. At corpus completion, only the two deliberate valid outcomes existed, exactly 12 deliberate fixture operations existed, the head was revision 12, and workflow access audit count remained zero. Exact retries produced no duplicate row or state mutation.

## 10. Direct-RPC bypass proof

The authenticated SQL corpus invokes `workspace.sotf_v1_record_daily_brief_outcome` directly, without the MCP handler. C03 reproduces the original contradiction against an untruncated authoritative projection and is now denied. C04 proves the inverse contradiction is denied. C16-C21 prove historical existence no longer substitutes for returned eligibility. No denied case returns a success receipt or persists any partial state.

The preserved local MCP/PostgREST harness also passed 34/34 transport-level checks against the freshly migrated stack, including discovery, bounded state, valid save/read-back/replay, tenant isolation, cancellation/degradation, provider-content rejection, and direct authenticated RPC calls.

## 11. Prior NULL-repair regression

The original focused SOTF pgTAP suite remains unchanged and passed 122/122. The preserved transport harness reran the direct authenticated NULL probes for:

- `workflow_version:null`;
- `host:null`;
- `execution_mode:null`;
- `data_class:null`; and
- `provenance.source:null`.

All returned typed denials and no side effects. In particular, the original `host:null` reproduction no longer persists.

## 12. New adversarial semantic cases

The parity corpus contains 19 invalid semantic attacks, exceeding the required ten. It covers contradictory redundant metadata in both directions, alternate JSON shapes, duplicate and malformed declarations, closed-schema field injection, five categories of historically present but currently filtered reference, a stale declaration after state evolution, and stale revision combined with otherwise valid metadata. These are not renamed NULL/type cases.

## 13. Fresh regression evidence

| Check | Fresh result |
|---|---:|
| Fresh local migrations | 21/21 applied |
| Original focused SOTF pgTAP | 122/122 pass |
| Semantic-parity pgTAP | 47/47 pass |
| Combined focused SOTF pgTAP | 169/169 pass |
| Full pgTAP/RLS | 446/446 pass across 11 files |
| Unit tests | 119/119 pass across 21 files |
| Semantic handler file | 2/2 pass; C01-C24 matched |
| Schema-policy contracts | 35/35 pass |
| Product-boundary scan | 86 runtime files pass |
| TypeScript | Pass |
| ESLint | Pass |
| Production build | Pass; 27 static pages generated |
| Database lint | Pass; no schema errors |
| Sensitive-data scan | Pass; 90 lineage commits, 540 blobs, working tree |
| `git diff --check` | Pass |
| Preview browser suite | 6/6 pass, desktop and mobile |
| Local MCP/PostgREST harness | 34/34 pass; cleanup zeroed fixtures |

The local database was cleaned after evidence collection: zero users, workspaces, outcomes, operation events, and access audits. Both release gates are false, the local MCP resource is restored, migration ledger count is 21 with `20260912162000` latest, and `authenticated` cannot execute the projection helper.

### Nonblocking harness limitation

The inherited connected-component browser harness remains **NONBLOCKING HARNESS LIMITATION**. Its 0/2 scenarios time out before reaching the first SOTF field because Vite searches from the temporary worktree and discovers `C:\Users\awbostwick\AppData\Local\Temp\postcss.config.mjs`, whose `@tailwindcss/postcss` module is unavailable from that parent directory. This was reproduced and not repaired. The production build, preview browser suite, handler corpus, and local MCP/PostgREST integration all pass independently.

## 14. Files changed

- `supabase/migrations/20260912162000_sotf_v1_outcome_semantic_parity.sql`
- `supabase/tests/database/sotf_v1_outcome_semantic_parity.sql`
- `tests/sotf-v1-outcome-semantic-parity.test.ts`
- `tests/schema-policy-contract.test.mjs`
- `package.json`
- `docs/testing/sotf-v1-outcome-semantic-parity-repair.md`

No prior migration, SOTF handler, canonical architecture document, Cash/E2/Entry/provider/billing code, or hosted configuration changed.

## 15. Hosted-state confirmation

No branch was committed or pushed. No project was resumed, transferred, linked, migrated, or deployed. No Vercel deployment, tunnel, ChatGPT connection, infrastructure purchase, hosted entitlement change, production access, or other hosted mutation occurred. All database and HTTP evidence used only the named local Supabase stack and disposable synthetic fixtures.
