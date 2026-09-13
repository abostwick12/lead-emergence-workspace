# SOTF v1 canonical-ordering parity repair

Status: local working-tree repair complete; commit authorization required.

Frozen base and current HEAD: `5b61e5fe8b0927e732aecc3a6085a3cf1f3961e2`. Branch: `codex/sotf-v1-canonical-ordering-parity-repair`. This report records an uncommitted local repair. It does not authorize a commit, push, deployment, hosted migration, entitlement change, or acceptance environment.

## 1. Exact root cause

The SOTF v1 bounded projection filters active hypotheses first, orders the survivors, and keeps three. That ordering therefore decides which IDs are eligible for governed outcome references.

The application used `String.localeCompare`; Node 24 under the observed `en-US` locale ordered `0,1,a_b,a-b`. PostgreSQL used ordinary text `ORDER BY id`; the local database's `lc_collate=en_US.UTF-8` ordered `0,1,a-b,a_b`. Both results were deterministic only inside their own current environments, not across authorities.

The MCP handler validated `selected_le_refs` against its returned projection. The authenticated RPC independently reconstructed eligibility using PostgreSQL ordering. With `0,1,a-b,a_b`, the handler excluded `a-b` but SQL included it, so a direct authenticated RPC caller could persist an outcome the host path denied.

## 2. Before-repair hypothesis trace

| Stage | JavaScript/application | PostgreSQL/authenticated RPC |
| --- | --- | --- |
| Durable input | Replayed ordinary event log into unique hypothesis records | Replayed the same revision-ordered log into a JSON object keyed by ID |
| Eligibility filter | Status `continue` or `refine` | Status `continue` or `refine` |
| Sort | `a.id.localeCompare(b.id)` under Node/OS ICU locale | `ORDER BY entry.value ->> 'id'` under database default collation |
| Bound | Sort, then `slice(0,3)` through `take` | Filter, sort, then `LIMIT 3` |
| Reproduced IDs | `0,1,a_b` | `0,1,a-b` |
| Reference check | Exact membership in returned projection after size enforcement | Exact membership in independently derived eligible refs after size enforcement |
| Authority effect | `a-b` denied | `a-b` accepted and persisted |

There is no timestamp or rank in hypothesis ordering. ID is the complete sort key and the projection limit is three. Filtering happens before sorting and limiting on both paths. The final 64 KiB removal pass can remove additional tail members; both authorities validate only after that pass.

## 3. Chosen canonical ordering rule

All text keys that select or order SOTF v1 bounded projection members use lexicographic order of the unsigned UTF-8 bytes of the decoded, well-formed string. There is no Unicode normalization.

- JavaScript encodes with `TextEncoder` and compares unsigned bytes explicitly.
- PostgreSQL uses private `workspace_private.sotf_v1_order_key(text)`, implemented with `convert_to(value,'UTF8')`, and orders the resulting `bytea`.
- Numeric ranks retain numeric ordering. ISO date/time text retains the documented primary ordering but is passed through the same explicit byte key. Typed timestamps remain typed timestamp comparisons.
- The immutable unique ID, under the same byte rule, is the final tie-breaker.
- Identical IDs identify the same upserted logical record, so two distinct eligible records cannot remain tied after the final key.

UTF-8 byte order was chosen because it is directly reproducible in both runtimes without locale, ICU, operating-system, or database-collation behavior. Persisting a second ordering source was evaluated and rejected for this repair: it would add storage/backfill/reconciliation state while the committed contract already specifies primary fields and immutable ID tie-breakers.

This ordering primitive is separate from the previously frozen text-length primitive. UTF-16 code units remain canonical for truncation, and clipping remains surrogate-safe.

## 4. Exact implementation changes

- Added `compareSotfV1CanonicalText` in `lib/sotf/v1-text.ts`.
- Replaced every SOTF v1 projection `localeCompare` and default truncation-section sort with the canonical helper.
- Added forward migration `20260913110000_sotf_v1_canonical_ordering_parity.sql`.
- Replaced the private SQL projection reconstruction with explicit byte keys for criteria, opportunities, commitments, meetings, hypotheses, suggestions, truncation metadata, recent outcomes, and final eligible refs.
- Replaced the public recent-outcome pre-limit query so membership is canonical before JavaScript receives its maximum-three input.
- Preserved suggestion order after 64 KiB filtering by original ordinality instead of an unordered JSON aggregate.
- Clarified the scoped SOTF v1 contract without modifying the canonical consumer architecture.
- Added one shared 31-case corpus, pgTAP authority tests, TypeScript projection tests, local MCP/PostgREST differential runner, schema-policy enforcement, and test registration.

No public RPC signature, workflow version, projection bound, identifier character set, outcome schema, entitlement, provider integration, runtime, scheduler, or durable table was added.

## 5. Reproduced set before and after

| Authority | Before | After |
| --- | --- | --- |
| JavaScript projection | `0,1,a_b` | `0,1,a-b` |
| PostgreSQL projection | `0,1,a-b` | `0,1,a-b` |
| Outside canonical bound | `a-b` in JS / `a_b` in SQL | `a_b` on both |
| Outcome selecting `a-b` | Handler deny / RPC accept and persist | Handler accept / RPC exact replay |
| Outcome selecting `a_b` | Handler accept / RPC deny | Handler deny / RPC deny; no persistence |

The permanent reproduction invokes the write RPC under `authenticated`. The denial snapshot is unchanged and the valid result adds exactly one outcome before its no-op exact retry.

## 6. Bounded same-class ordering audit

| SOTF v1 path | Bound/order | Classification | Repair/evidence |
| --- | --- | --- | --- |
| Criteria | Filter not needed; importance descending, ID; 20 | Authority-sensitive but same-class vulnerable at ID tie | Canonical numeric rank + byte-ID tie |
| Opportunities | Active and deadline-window filter; deadline, ID; 10 | Authority-sensitive but same-class vulnerable | Canonical date bytes + byte ID |
| Commitments | Open/blocked and due-window filter; due, ID; 10 | Authority-sensitive but same-class vulnerable | Canonical date bytes + byte ID |
| Meetings | Planned/accepted and overlap filter; start, ID; 10 | Authority-sensitive but same-class vulnerable | Canonical timestamp bytes + byte ID |
| Hypotheses | Continue/refine filter; ID; 3 | Confirmed cross-runtime vulnerability | Canonical byte ID; integrated 31-case proof |
| Recent outcomes | Workflow/version filter; recorded timestamp descending, outcome ID descending; 3 | Authority-sensitive pre-limit membership | Typed timestamp + byte-ID tie in SQL read and reconstruction; identical application comparator |
| Suggestions | Explicit reason rank, due/start + ID; 3 | Presentation synthesis, but affects truncation bytes and source visibility | Numeric rank + canonical compound byte key |
| 64 KiB tail removal | Fixed section order; pop already ordered tail | Authority-sensitive because removed refs become ineligible | Existing fixed removal order retained; section metadata canonical; suggestion filter preserves original order |
| Final eligible refs | Projection survivors only; kind then ID | Write-back membership dependency | Both keys canonical; validator runs after count/text/byte truncation |
| `isDailyBriefReferenceEligible` | Exact kind/ID membership | Authority-sensitive and safe once projection agrees | Unchanged exact check |
| Private SQL validator | Exact containment in derived eligible refs | Authority-sensitive | Unchanged containment; derivation repaired |
| `lib/sotf/intelligence.ts` sorts | Older/native analysis presentation and other tools | Not this v1 projection/write authority | Audited, not changed |
| `lib/sotf/engine.ts` latest-decision timestamp sort | State derivation, not bounded governed-reference membership | Not applicable to this ordering defect | Audited, not changed |
| Scheduling numeric time sort | Different feature and numeric epoch comparator | Canonical and equivalent / not applicable | Unchanged |

The audit searched `sort`, `localeCompare`, `ORDER BY`, `LIMIT`, `slice`, `take`, `first`, `rank`, `row_number`, `dense_rank`, `DISTINCT ON`, and ordered JSON/array aggregates. No other confirmed authority-sensitive ordering divergence exists in the SOTF v1 daily-brief state/outcome slice.

## 7. Shared ordering corpus and differential matrix

The JSON corpus lives once inside `supabase/tests/database/sotf_v1_canonical_ordering_parity.sql`. The TypeScript suite and local differential runner parse those exact rows. Explicit expected arrays are checked by an independent Node Buffer UTF-8 oracle, the application helper, SQL byte ordering, reversed inputs, projection bounds, omitted tails, truncation status, eligible refs, and governed write decisions.

| ID | Focus | Canonical full order | Bounded / omitted | Outcome pair |
| --- | --- | --- | --- | --- |
| O01 | Reproduced punctuation | 0, 1, a-b, a_b | 0, 1, a-b / a_b | A/A inside; D/D outside |
| O02 | Numeric-looking | 01, 1, 10, 2 | 01, 1, 10 / 2 | A/A; D/D |
| O03 | ASCII case | A, Z, a, z | A, Z, a / z | A/A; D/D |
| O04 | Common-prefix case | AA, Aa, aA, aa | AA, Aa, aA / aa | A/A; D/D |
| O05 | Prefix length | a, aa, aaa, ab | a, aa, aaa / ab | A/A; D/D |
| O06 | Dash/dot/slash/underscore | a-b, a.b, a/b, a_b | first 3 / a_b | A/A; D/D |
| O07 | Space and symbols | a b, a#b, a+b, a:b, a@b | first 3 / a:b, a@b | A/A; D/D |
| O08 | CJK + ASCII | a, 中, 国, 界 | a, 中, 国 / 界 | A/A; D/D |
| O09 | Accented Latin | e, è, é, ê | e, è, é / ê | A/A; D/D |
| O10 | Composed/decomposed | a◌̊, e◌́, å, é | first 3 / é | A/A; D/D |
| O11 | Supplementary | 𐐀, 🙂, 🩷, 🫠 | first 3 / 🫠 | A/A; D/D |
| O12 | ZWJ sequences | 👩, 👩‍👦, 👩‍👩‍👦, 🙂 | first 3 / 🙂 | A/A; D/D |
| O13 | Variation selectors | ♥, ♥️, ❤, ❤️ | first 3 / ❤️ | A/A; D/D |
| O14 | Mixed suffixes | A🙂, a, a界, a🙂 | first 3 / a🙂 | A/A; D/D |
| O15 | Limit minus one | a, b | both / none | A/A; D/D nonexistent |
| O16 | Exact limit | a, b, c | all / none | A/A; D/D nonexistent |
| O17 | Far above limit | s, t, u, v, w, x, y, z | s, t, u / remaining 5 | A/A; D/D |
| O18 | Reversed reproduction | 0, 1, a-b, a_b | 0, 1, a-b / a_b | A/A; D/D |
| O19 | Interleaved case | A, B, a, b | A, B, a / b | A/A; D/D |
| O20 | Symbols one | a#, a%, a&, a@ | first 3 / a@ | A/A; D/D |
| O21 | Symbols two | a-, a., a/, a: | first 3 / a: | A/A; D/D |
| O22 | Digit prefixes | a, a0, a00, a01 | first 3 / a01 | A/A; D/D |
| O23 | Greek/Cyrillic | A, Ω, ω, Ж, ж | first 3 / Ж, ж | A/A; D/D |
| O24 | BMP/supplementary CJK | a, 一, 丁, 𠀀 | first 3 / 𠀀 | A/A; D/D |
| O25 | Decomposition + punctuation | E, e-, e◌́, é | first 3 / é | A/A; D/D |
| O26 | Leading zeroes | 0, 00, 000, 01 | first 3 / 01 | A/A; D/D |
| O27 | Symbol common prefix | a#b, a+b, a:b, a@b | first 3 / a@b | A/A; D/D |
| O28 | Uppercase + underscore | A, AA, A_, Aa | first 3 / Aa | A/A; D/D |
| O29 | Nordic composed case | Ä, Å, ä, å | first 3 / å | A/A; D/D |
| O30 | Emoji prefixes | 🙂, 🙂A, 🙂a, 🙂🙂 | first 3 / 🙂🙂 | A/A; D/D |
| O31 | Required broad group | 0, 01, 1, 10, A, a, a b, a#b, a+b, a-b, a.b, a/b, a:b, a@b, a_b | first 3 / remaining 12 | A/A; D/D |

Every odd-numbered runner case uses listed source insertion order and every even-numbered case reverses it. The SQL suite separately reverses every source array. O01–O31 are 31 genuinely new ordering attacks beyond the frozen semantic/Unicode corpus.

## 8. Collation-independence evidence

Fresh local facts:

- Node locale: `en-US`.
- PostgreSQL `lc_collate`: `en_US.UTF-8`; server encoding: `UTF8`.
- Default Node `localeCompare`: `0,1,a_b,a-b`.
- Default PostgreSQL text order: `0,1,a-b,a_b`.
- Canonical JavaScript and SQL byte order: `0,1,a-b,a_b`.

All 31 corpus rows passed under explicit `C`, `af-NA-x-icu`, and `af-ZA-x-icu` input collations: 93/93 collation variants. The SQL ordering expression sorts `bytea` emitted by `convert_to`, so changing text collation cannot change bounded membership. No global database setting was modified.

The focused pgTAP file passed 267/267:

- 31 exact full-order checks;
- 31 reversed-source checks;
- 31 exact bounded-membership checks;
- 31 exact omitted-tail checks;
- 31 truncation-classification checks;
- 93 explicit collation variants;
- 4 helper/contract checks;
- 5 fixture operations;
- 5 integrated projection/eligible-ref checks; and
- 5 authenticated write/no-side-effect/idempotency checks.

## 9. Handler ↔ RPC and persistence evidence

The local runner executed 31 inside and 31 outside references through both the real application validator and authenticated PostgREST RPC:

| Result | Count |
| --- | ---: |
| ACCEPT / ACCEPT | 31 |
| DENY / DENY | 31 |
| DENY / ACCEPT | 0 |
| ACCEPT / DENY | 0 |
| Independent application observations | 62: 31 accept, 31 deny |

For the independent application observation, the runner returns a test-only `new` probe and suppresses the eventual write while counting whether the real JavaScript validator reaches it. This prevents SQL's probe from masking an application disagreement. It then runs the ordinary MCP path and the identical payload through real authenticated PostgREST.

Every denied outside/nonexistent reference leaves row counts and digests unchanged for outcomes/receipts, ordinary events, operation heads/revisions, access audits, entitlements, MCP authorizations, and OAuth resource grants. Every valid inside reference adds exactly one outcome and changes no other surface. The identical RPC retry returns the same receipt with `replayed:true` and adds nothing.

The prior comprehensive local runner also passed 212/212 handler/RPC pairs: 90 ACCEPT/ACCEPT, 122 DENY/DENY, zero divergent. It retained 105 independent application observations and cleaned all 11 inspected surfaces.

## 10. Prior repair regression

- Required NULL/type closure: original focused pgTAP 122/122. The comprehensive runner repeated missing, JSON null, SQL-NULL-equivalent, empty, whitespace, numeric, boolean, object, array, and unsupported values for `host`, `execution_mode`, `data_class`, and `provenance.source`. All denied on both paths with no mutation.
- Semantic parity: 47/47 pgTAP. The shared TypeScript parity group passed; forged `state_truncated` metadata, filtered references, current authority loss, stale revision, closed nested structures, and direct-RPC bypass cases remained aligned.
- Unicode truncation: 140/140 pgTAP and the shared TypeScript parity group passed. UTF-16 measurement, supplementary boundaries, surrogate-safe clipping, composed/decomposed distinction, and decoded-equivalent JSON behavior remain unchanged.
- The exact `state_truncated` declaration against an empty authoritative `truncated_sections` projection remains DENY/DENY.
- Exact retries remain current-authority checked and idempotent.

Prior migration blobs remain unchanged:

| Frozen repair | Blob |
| --- | --- |
| Required-field NULL repair in `20260911143000...` | `b20992a75c710bb920ec08825456b24a0fe367ff` |
| Semantic parity `20260912162000...` | `2723af8c36aa2d870a0b06c11e60b88b5bc5d987` |
| Unicode parity `20260912190000...` | `3c06e4b7af463cde16d83149959d09550e1685f9` |

## 11. Fresh validation results

| Check | Fresh result |
| --- | ---: |
| Fresh migrations | 23/23, latest `20260913110000` |
| Original focused SOTF pgTAP | 122/122 pass |
| Semantic-parity pgTAP | 47/47 pass |
| Unicode pgTAP | 140/140 pass |
| New ordering pgTAP | 267/267 pass |
| Combined focused SOTF pgTAP | 576/576 pass |
| Full pgTAP/RLS | 853/853 pass across 13 files |
| Ordering TypeScript projection tests | 33/33 pass |
| Semantic + Unicode + ordering TypeScript parity group | 78/78 pass across 3 files |
| Schema-policy contracts | 37/37 pass |
| Handler/RPC ordering differential | 62/62 pairs; zero divergent |
| Preserved comprehensive differential | 212/212 pairs; zero divergent |
| Product-boundary scan | 87 runtime files pass |
| Typecheck | pass |
| Lint | pass |
| Production build | pass; 27 static pages |
| Database lint | pass; no schema errors |
| Preview browser | 6/6 pass, desktop and mobile |
| Sensitive-data scan | Pass: 94 release-lineage commits, 557 unique Git blobs, and working tree |
| `git diff --check` | Pass |

Repository-wide `npm run test:unit` is **192/195**, with three failures in the unchanged `tests/sotf-v1-mcp.test.ts`. Its fixtures hard-code `brief_date:2026-09-11`; on the current date, 2026-09-13, the intended today/yesterday guard rejects them before their assertions. Running that exact file from a clean frozen-base worktree produces the identical 5/8 result and the same three failures. The file is byte-identical to the frozen base and was not altered because this is an inherited clock-fixture issue, not ordering behavior. The new ordering tests themselves are 33/33.

### NONBLOCKING HARNESS LIMITATION

The inherited temporary-folder connected-browser PostCSS issue remains unchanged and was not repaired. The harness fails before reaching SOTF behavior. Independent production build, 6/6 Preview browser checks, pgTAP, real MCP/PostgREST, and application/RPC differential coverage exercise the relevant repair.

## 12. Files changed

- `docs/architecture/sotf-v1-contracts.md`
- `lib/sotf/v1-text.ts`
- `lib/sotf/daily-brief-v1.ts`
- `supabase/migrations/20260913110000_sotf_v1_canonical_ordering_parity.sql`
- `supabase/tests/database/sotf_v1_canonical_ordering_parity.sql`
- `tests/sotf-v1-canonical-ordering-parity.test.ts`
- `scripts/test-sotf-v1-canonical-ordering-local.mjs`
- `tests/schema-policy-contract.test.mjs`
- `package.json` — test registration only
- `docs/testing/sotf-v1-canonical-ordering-parity-repair.md`

No canonical consumer architecture, workflow catalog, outcome schema, prior repair migration, Cash, E2, Entry, billing, provider, entitlement, or production file changed.

## 13. Cleanup and hosted boundary

All evidence used only the loopback Supabase stack, in-memory MCP transports, authenticated local PostgREST, and a local production server/browser. Synthetic users, workspaces, plans, memberships, entitlements, authorizations, resource grants, outcomes, events, heads, audits, and receipts are zero after cleanup. Local `sotf_v1_daily_brief_enabled` and `mcp_dynamic_admission_enabled` are restored to `false`; the local MCP resource is restored to `http://localhost:3000/api/mcp`.

No commit, staging, push, PR, merge, hosted Supabase operation, Vercel deployment, ChatGPT connection, tunnel, infrastructure purchase, production access, Entry change, Cash change, E2 change, provider activation, or hosted entitlement mutation occurred. The local stack is stopped after final verification.

SOTF V1 CANONICAL-ORDERING PARITY REPAIR COMPLETE — REQUEST COMMIT AUTHORIZATION
