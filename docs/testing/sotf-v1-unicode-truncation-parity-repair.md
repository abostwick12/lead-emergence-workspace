# SOTF v1 Unicode-truncation parity repair

Status: local repair validation complete; uncommitted; request commit authorization. No freeze or real-host acceptance claimed.

Branch: `codex/sotf-v1-unicode-truncation-parity-repair`

Frozen base and unchanged HEAD: `c995c77f9a869f54eb3b7e341b5569f0602641ec`

Repository: `abostwick12/lead-emergence-workspace`

Worktree: `C:/Users/awbostwick/Documents/ChatGPT/architecture check/.sotf-local/unicode-truncation-parity-repair`

## 1. Exact root cause and authority trace

A valid ordinary commitment with 300 supplementary scalars was below the native 5,000-unit source-field limit. It occupied 600 UTF-16 units but only 300 PostgreSQL characters. The application classified its 500-unit projection as truncated; SQL reconstruction did not. An outcome omitting the `state_truncated` degradation reason therefore failed the handler but previously persisted through authenticated RPC.

Trace: confirmed source command → canonical event log → application replay → bounded projection → derived `truncated_sections` → comparison with outcome degradation reasons → authenticated probe/write → current-authority/revision checks and atomic outcome/receipt persistence. PostgreSQL remains the final write authority; application checks remain defense in depth. No new public operation or outcome property is introduced.

## 2. JavaScript measurement before repair

The projection used `value.length > 500` and `value.slice(0,500)`. These count UTF-16 units, not code points, bytes, or user-perceived characters. The slice could emit a lone surrogate when a supplementary scalar crossed the boundary. Zod's string maximums also use UTF-16 units. Four generated commitment-title paths used `.slice(0,240)`.

## 3. PostgreSQL measurement before repair

The independent semantic reconstruction used `char_length(value) > 500` and `left(value,500)`. On the verified UTF8 local database these count scalars/characters. A supplementary scalar occupies one PostgreSQL character and two JavaScript units. The same mismatch existed in 240-unit generated title reconstruction and the 100-unit selected-reference bound.

## 4. Canonical unit

Decoded, well-formed text is measured in UTF-16 code units. No NFC/NFD or other Unicode normalization is performed. BMP scalars consume one unit; supplementary scalars consume two. Combining marks, ZWJ and variation selectors are counted individually.

Clipping returns the longest prefix ending on a whole scalar whose width is within the existing bound. It may return 499 units when the next scalar needs two. It does not promise a whole grapheme cluster. NUL and unpaired surrogates are rejected because PostgreSQL text cannot represent them.

## 5. Why this unit

The committed contract used “characters” without specifying the unit. This is a deliberately narrow compatibility clarification of existing emitted application/Zod bounds, not a new product threshold.

| Candidate | Evaluation |
| --- | --- |
| UTF-16 units | Preserves existing application field budgets, ordinary ASCII results and source/output schema constraints; chosen with explicit surrogate-safe clipping. |
| Unicode scalar values | Coherent, but would broaden existing application/Zod limits for supplementary text and change v1 output sizes and truncation classifications. Not the smallest compatibility repair. |
| UTF-8 bytes | Correct for the separately explicit transport/storage budgets, not the per-field text limit. Would change ordinary international-language text budgets. |
| Grapheme clusters | No committed requirement for user-perceived character limits; adds segmentation/version complexity and a new behavior boundary. Not justified for launch. |

JSON Schema's character maximum is not by itself the additional UTF-16 semantic bound. The scoped SOTF contract document now states this explicitly. The canonical consumer architecture document is unchanged.

## 6. Before/after behavior

| Source | Old application | Old SQL | New common rule |
| --- | --- | --- | --- |
| ASCII 499 / 500 / 501 | Not truncated / not truncated / truncated | Same | Unchanged |
| 300 supplementary scalars | 600 units; truncated | 300 characters; not truncated | 600 units; truncated on both paths |
| 250 supplementary scalars | Exactly 500; not truncated | 250; not truncated | Exactly 500; not truncated |
| 499 ASCII + supplementary scalar | Slice could split the surrogate | 500 characters; no truncation | 501 units; truncated to the safe 499-unit prefix |
| Composed é vs decomposed e + combining acute | Distinct widths | Distinct widths | Distinct widths retained; no normalization |

Native source-input trimming remains unchanged. Boundary tests use internal line breaks/tabs so that the stored canonical text, not discarded trailing whitespace, crosses the boundary.

## 7. Exact implementation changes

- New application helpers: `sotfV1TextUnits`, `clipSotfV1Text`, `sotfV1TextSchema`, and representability check `isSotfV1Text`.
- All eight clipped projection fields use the named 500-unit limit. Short projected strings and selected references retain their existing 240/100 limits.
- Four generated commitment-title paths use the common safe prefix helper at 240.
- One forward migration adds private `sotf_v1_text_units(text)` and `sotf_v1_text_prefix(text,integer)`, replaces independent projection reconstruction and the closed outcome validator, and preserves the existing public RPC signatures, locks, grants and idempotency order.
- Both projection builders include `truncated_sections` in the existing 65,536-byte budget before/during row removal. Previously that metadata was added after measuring the response.
- Permanent shared Unicode corpus, unit/pgTAP tests, real local differential runner, schema enforcement and narrow test registration.
- Prior NULL and semantic-parity migrations are untouched. No new workflow, table, entitlement, provider integration, runtime or scheduler.

## 8. Bounded same-class length audit

| Location / measurement | Classification and action |
| --- | --- |
| Chapter question; criterion desired; opportunity next action; commitment definition of done/review trigger; meeting objective; hypothesis next experiment/review trigger | Confirmed parity vulnerability: original decoded text measured at 500 per field with JS UTF-16 vs SQL character count. All eight now use the common unit and prefix. |
| Generated titles from decision, meeting preparation, application outcome and interview preparation | Confirmed same-class prefix divergence: JS slice 240 vs SQL left 240. Both now use safe UTF-16 prefixes; unrelated email-draft subject clipping is not a daily-brief projection field and is unchanged. |
| Selected-reference ID | Same-class independent validator length difference, 100 UTF-16 vs 100 SQL characters. SQL now uses the common helper; application trimming order is preserved. |
| Projected short display fields / IANA-zone field | Same canonical UTF-16 semantics at existing 240/80 bounds; valid IANA identifiers and UUID/date/version literals are not supplementary-text length budgets. No new limits. |
| Complete projection JSON | Different but relevant resource budget: 65,536 UTF-8 bytes, not text units. Both paths now include truncation metadata during measurement; escaped JSON contributes bytes only here. |
| Outcome JSON | Same SQL authority budget: 8,192 bytes of PostgreSQL JSON text; strict shape and bounded references keep valid metadata far below that cap. No new provider/content field. |
| Array lengths / take / slice | Not text measurement: criteria 20; opportunities/commitments/meetings 10 each; hypotheses/recent outcomes 3 each; suggestions/references/priorities 3. Unchanged. |
| Native source short/text/note schemas | Existing upstream 100/240/5,000 UTF-16 validation and trimming, not alternate 500-unit projection rules. Accepted canonical source is the differential input domain. No general ordinary-command ingestion validator was added or certified. |
| Whole native replay cache versus stored operation journal | Different but irrelevant to this text-unit decision: 1,500,000 serialized JS units for the expanded replay cache; SQL separately bounds an operation to 64,000 bytes and the journal to 2,000,000 bytes / 2,000 events. These measure different objects/resources and remain unchanged. This repair does not claim arbitrary malformed/oversized ordinary-log parity. |
| ISO date substrings | Not applicable to Unicode truncation: fixed-format ASCII date extraction; unchanged meaning. |
| Static workflow catalog/schema prose bounds, unrelated ordinary notes/drafts | Not runtime daily-brief text-classification authority; not expanded into unrelated tools or a repository-wide Unicode refactor. |

Source checks forbid raw `char_length`/`left` in the new reconstructed authority body, require the named application clip rule, and enforce all eight projected fields and four generated-title uses. Raw character iteration/counting remains encapsulated inside the SQL helper, where it implements—not chooses—the canonical unit.

## 9. Unicode differential matrix

The single shared JSON corpus is embedded in the Unicode pgTAP file and parsed by the unit suite and real local runner. Independent expected widths are stored explicitly; the application test oracle uses UTF-16LE encoding rather than the implementation helper.

| ID | Probe | Units → prefix | Expected truncated | Handler / RPC sections | Correct / contradictory metadata; persistence |
| --- | --- | --- | --- | --- | --- |
| U01 | empty | 0 → 0 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U02 | ASCII below | 499 → 499 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U03 | ASCII exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U04 | ASCII above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U05 | ASCII large | 1500 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U06 | Latin-1 below | 499 → 499 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U07 | composed exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U08 | composed above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U09 | decomposed below | 499 → 499 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U10 | decomposed exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U11 | decomposed above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U12 | CJK exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U13 | CJK above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U14 | supplementary below | 499 → 499 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U15 | supplementary exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U16 | supplementary above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U17 | emoji reproduced bypass | 600 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U18 | emoji exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U19 | mixed ASCII surrogate crossing | 501 → 499 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U20 | mixed BMP surrogate crossing | 501 → 499 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U21 | variation selector below | 499 → 499 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U22 | variation selector exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U23 | variation selector above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U24 | ZWJ below | 499 → 499 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U25 | ZWJ exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U26 | ZWJ above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U27 | ZWJ split safe scalar | 503 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U28 | newline crossing | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U29 | CRLF crossing | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U30 | quote escape exact | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U31 | backslash escape above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U32 | tab boundary | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U33 | mixed international | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U34 | mixed international above | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U35 | literal backslash-u text | 504 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U36 | transport escaped emoji | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U37 | transport escaped composed | 501 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U38 | newline plus surrogate | 501 → 499 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |
| U39 | variation selector text emoji | 500 → 500 | false | none / none | A/A once; D/D none; exact retry unchanged |
| U40 | supplementary large | 4000 → 500 | true | commitments / commitments | A/A once; D/D none; exact retry unchanged |

The empty-string helper/pure-projection case measures zero. Ordinary required source text cannot be empty: the real transport case therefore tests an empty eligible section and empty selected-reference list, rather than inventing a valid empty required commitment.

## 10. Serialization and representation probes

Quotes, literal backslashes, internal tabs, CR/LF, newlines and a literal backslash-u sequence are included. U36/U37 submit equivalent escaped Unicode through real PostgREST source-operation JSON and then read it through MCP. Every corpus item additionally round-trips direct versus escaped JSON in the unit suite.

Decoded field text determines the 500-unit classification; serialized bytes determine only the separate complete-response budget. No normalization is used to make cases match.

## 11. Truncation metadata matrix

| Actual projection | Outcome declaration | Result required on both paths |
| --- | --- | --- |
| Not truncated | Reason absent; no caller sections | Accept |
| Not truncated | Literal false boolean | Deny: unknown field; false is represented by absence of the reason |
| Not truncated | Reason present | Deny |
| Truncated | Reason absent | Deny |
| Truncated | Exactly one state_truncated reason, otherwise consistent metadata | Accept/save once |
| Truncated | Caller wrong sections | Deny: caller sections are forbidden |
| Truncated | Caller empty sections | Deny: caller sections are forbidden |
| Any | Null/wrong-type/duplicate reason, redundant boolean, unknown reason | Deny |

The outcome has no boolean property named `state_truncated` and no caller-owned `truncated_sections`. Server-derived section names are compared, not trusted from a payload. This preserves the prior semantic repair.

## 12. Handler ↔ RPC differential corpus

Final run: `2026-09-13T02:52:02.255Z` through `2026-09-13T02:59:46.063Z`.

- 63/63 named checks; **212/212** full MCP/authenticated-RPC pairs agree.
- **90 ACCEPT/ACCEPT; 122 DENY/DENY; zero asymmetric results.**
- 105 independent application-admission observations: 44 reach the suppressed write boundary and 61 deny, exactly as expected.
- Typed RPC denials: 115 × 22023, 2 × 40001, 3 × 42501, 1 × 22P05, 1 × PGRST102. No expired-token or service failure is counted as a semantic denial.

| Extended probe | Final result |
| --- | --- |
| U41 exact Unicode replay / stale new identity | A/A replay unchanged; D/D stale |
| U42 eight contradictory metadata shapes | Eight D/D; no persistence |
| U43 reference widths / unrepresentable encodings | Five D/D; no persistence |
| U44 nested NULLs with Unicode state | Five D/D; no persistence |
| U45 multi-section Unicode | Correct A/A; missing declaration D/D |
| U46 valid 100-unit supplementary reference | A/A save once and exact retry |
| U47 generated title crossing 240 | Safe 239-unit title; A/A |
| U48 Unicode-heavy byte budget | Correct A/A; undeclared D/D; identical eligible references |

U48's complete projection is **63851 bytes**, including metadata. Both paths agree on **31 eligible references** and the sections `commitments, criteria, hypotheses, opportunities, recent_outcomes`. Omitted counts: criteria 0, opportunities 1, commitments 12, meetings 0, hypotheses 1, recent outcomes 3.

For new Unicode cases the runner separately observes application admission: it reads actual authenticated ordinary state, supplies a test-only “new” probe response, and suppresses the eventual write while counting whether the real application validator reaches it. This prevents SQL's pre-check from masking a JavaScript discrepancy. It then runs the unchanged full MCP path and submits the identical outcome to real authenticated PostgREST.

The runner refuses non-loopback endpoints and checks expected SQL/input-rejection classes. Expired tokens or unavailable services are failures, never counted as successful semantic denials. Synthetic bearer credentials are refreshed per local request; no hosted OAuth/configuration is involved. The private read-only observer binds the same synthetic subject/client context, including that user's recent receipts in both projections.

## 13. Persistence and no-side-effect proof

Each denied differential payload compares pre-call, post-handler and post-RPC snapshots. Snapshots include counts and row digests for outcomes/receipts, ordinary events, operation heads (including revision and accumulated size), workflow access audits, entitlements, MCP authorizations and resource grants. There is no designed denial-audit exception in these cases.

A legitimate first save adds exactly one outcome/receipt and changes none of the other surfaces. The same RPC retry returns the identical receipt with replayed true and no additional writes. The dedicated pgTAP reproduction calls the write RPC under authenticated role; only its read-only observation helpers are privileged.

The reproduced N01 bypass leaves its **3 pre-call outcomes at 3**, with identical outcome/receipt, event, head, audit and authority digests after both paths. The complete run records **47 legitimate outcomes**, alongside 75 ordinary fixture events; exact retries add none. Forbidden provider-content marker count is **0**. Cleanup leaves all 11 inspected fixture surfaces at zero.

## 14. Prior NULL regression

The original focused suite is unchanged and passes 122/122. The local differential runner repeats missing, JSON null, SQL-NULL-equivalent, empty, whitespace, numeric, boolean, object, array and unsupported-value cases for host, execution mode, data class and provenance source. Unicode-specific nested null cases cover connector results, provenance content flag and selected-reference fields. Null required values remain fail closed.

## 15. Prior semantic-parity regression

The prior migration/test files are unchanged. Semantic pgTAP passes 47/47; the semantic TS suite passes 2/2 tests encompassing C01–C24. The new runner retains forged true/empty metadata rejection, projection-filtered reference rejection, stale revision rejection, current-authority/cancellation checks and exact replay after ordinary revision advance. The old NULL and projection-semantic validators are not weakened.

## 16. Legitimate international/Unicode success

ASCII, Latin-1, CJK, composed/decomposed accents, supplementary scripts, emoji, variation selectors and ZWJ source text remain usable with the canonical declaration. The repair does not ban non-ASCII. Exact 500-unit supplementary content is untruncated; content above the bound remains usable through a correctly declared truncated projection. U46 specifically tests a valid supplementary reference ID at the 100-unit limit and an exact retry.

## 17. New adversarial coverage

U01–U40 are a permanent text/boundary corpus, not renamed C01–C24 cases. U41 adds stale/new identity versus exact Unicode replay; U42 contradictory metadata; U43 reference widths/unrepresentable JSON text; U44 nested nulls with Unicode state; U45 multiple projected sections; U46 a valid supplementary ID; U47 a generated title crossing 240 units; U48 Unicode-heavy byte-budget/eligible-reference parity. This adds well over 15 distinct Unicode/boundary probes.

## 18. Fresh local regression results and limitations

| Gate | Fresh result |
| --- | --- |
| Fresh local migrations | 22/22 PASS; UTF8; final function definitions match tested fingerprints |
| Original focused SOTF pgTAP | 122/122 PASS |
| Semantic-parity pgTAP | 47/47 PASS |
| Unicode pgTAP | 140/140 PASS |
| Combined focused pgTAP | 309/309 PASS |
| Full pgTAP/RLS | 586/586 PASS, 12 files |
| Unit tests | 162/162 PASS, 22 files |
| Schema contracts | 36/36 PASS |
| Semantic-parity TS | 2/2 PASS, C01–C24 |
| Unicode TS | 43/43 PASS |
| Product boundary scan | PASS, 87 runtime files |
| Typecheck / lint | PASS / PASS |
| Production build | PASS, 27/27 static pages |
| Database lint | PASS, zero issues after removing the completed test-only pgTAP extension |
| Sensitive-data scan | PASS, 92 release-lineage commits, 546 unique Git blobs, and working tree |
| Preview browser | 6/6 PASS, desktop/mobile, local production build |
| Existing connected-component browser | 2/2 PASS from relocated worktree |
| Preserved MCP/PostgREST harness | 34/34 PASS; only module paths rebound in memory to this repair |
| Permanent Unicode local runner | 212/212 pairs, 63/63 named checks, 105 independent application observations |
| Whitespace validation | git diff --check PASS, plus no-index checks of each new file |

Reproduction: `npm run test:sotf:unicode:local`, `npm run test:rls`, `npm run test:unit`, `npm run test:schema`, `npm run check:boundaries`, `npm run typecheck`, `npm run lint`, `npm run build`, `supabase db lint --local --level warning`, and `npm run scan:sensitive`. The runner requires the repository's freshly migrated disposable stack with no existing users and refuses a non-loopback API. Browser checks used the existing Preview and connected-component specifications with local-only base URLs.

These are working-tree repair results from the frozen base plus the listed uncommitted files, not a committed-state freeze. Final migration replay installed definitions matching the four SQL function fingerprints exercised by the differential suite.

The inherited temporary-folder PostCSS issue remains **NONBLOCKING HARNESS LIMITATION** and was not repaired. The worktree was relocated into the workspace's ignored local-worktree area after an automatic edit-approval timeout; from that directory the existing connected-component browser suite passes without changing PostCSS, its dependencies or the browser harness. This does not claim the older failing parent-folder configuration was fixed.

During test development, a generated-runner syntax error and schema-test initialization order were corrected. Trailing-whitespace fixtures were corrected to test stored canonical text. A preliminary long run expired its synthetic token; later authorization denials were invalidated and the runner was hardened to reject those false positives. The private inspection initially omitted subject context and therefore recent receipts; that inspection was corrected without an application change. Final evidence above comes from the complete refreshed-token, context-corrected rerun.

The preserved baseline harness installs pgTAP as a local test artifact. Default database lint then reported pgTAP internals, not application defects. Removing that completed test-only extension without CASCADE restored clean migrated-schema lint; no application or hosted schema was removed.

## 19. Files changed and preserved evidence

Authorized repair files:

- `lib/sotf/v1-text.ts`
- `lib/sotf/daily-brief-v1.ts`
- `lib/sotf/engine.ts`
- `supabase/migrations/20260912190000_sotf_v1_unicode_truncation_parity.sql`
- `supabase/tests/database/sotf_v1_unicode_truncation_parity.sql`
- `tests/sotf-v1-unicode-truncation-parity.test.ts`
- `tests/schema-policy-contract.test.mjs`
- `scripts/test-sotf-v1-unicode-local.mjs`
- `package.json` — test registration only
- `docs/architecture/sotf-v1-contracts.md` — scoped text-unit clarification
- `docs/testing/sotf-v1-unicode-truncation-parity-repair.md`

Preserved hashes:

| File | Base and working-tree blob |
| --- | --- |
| Prior NULL-repaired daily-brief migration | b20992a75c710bb920ec08825456b24a0fe367ff |
| Prior semantic-parity migration | 2723af8c36aa2d870a0b06c11e60b88b5bc5d987 |
| Canonical consumer architecture in the frozen base | dfdcdfcba81d7fbba9b0380c9028556a024b8880 |

Raw synthetic differential evidence is local/ignored at `.sotf-local/unicode-evidence.json`; it contains case inputs/results and snapshots, not real provider data or bearer secrets. It is not a replacement for the permanent executable corpus.

## 20. Zero hosted mutation and handoff boundary

No commit, staging, push, PR, merge, deployment, hosted migration, hosted entitlement change, Supabase project resume, infrastructure purchase, tunnel or ChatGPT connection. Production, Entry, Cash, E2, billing and provider infrastructure are untouched. No service-role credential was added to application runtime.

Only disposable loopback Supabase, synthetic local MCP clients and local browser servers were used. Real ChatGPT acceptance remains a separate gate after an explicitly authorized freeze. This repair does not authorize hosted acceptance or any additional workflow.

Synthetic users `76111111-1111-4111-8111-111111111111` / `76222222-2222-4222-8222-222222222222`, workspaces `76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` / `76bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`, clients `76cccccc-cccc-4ccc-8ccc-cccccccccccc` / `76eeeeee-eeee-4eee-8eee-eeeeeeeeeeee`, and their related fixtures were cleaned. Counts are zero on all 11 inspected surfaces. Local `sotf_v1_daily_brief_enabled` and `mcp_dynamic_admission_enabled` are restored to false; the original resource identifier is restored.

Both browser servers are stopped. Only `lead-emergence-workspace-local` was stopped, with its local backup preserved; no matching containers remain running. Shutdown cleared transient generated startup-secret files; the remaining empty cache directory was moved to a new local temporary folder. Sensitive scanning required no exclusion or scanner change. No user asset was deleted.

The working tree intentionally contains these 11 uncommitted repair files; nothing is staged. HEAD remains the frozen base. **Request separate commit authorization; no freeze or hosted acceptance is implied.**
