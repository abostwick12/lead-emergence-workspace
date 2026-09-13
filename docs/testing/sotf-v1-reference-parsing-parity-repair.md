# SOTF v1 reference-parsing parity repair evidence

## 1. Scope and frozen base

Branch: codex/sotf-v1-reference-parsing-parity-repair.

Frozen base and current uncommitted HEAD: e6b6bc7a923705196e95696e7df6ac4336b6e180. This repair is local-only and stops before commit.

## 2. Root cause

The selected-reference schema used Zod trim. For raw JSON " a-b ", Zod returned "a-b"; the handler compared and sent that rewritten value. PostgreSQL never normalized the raw direct-RPC value and used literal JSONB membership. The handler therefore accepted and persisted while direct RPC denied.

No contract promised forgiving reference entry. These references are machine identities copied from a bounded projection, not natural-language input. Retaining trim would create aliases. Mirroring JavaScript trim in SQL would require a separately specified character set because JavaScript and PostgreSQL trim semantics differ for Unicode whitespace.

## 3. Canonical rule

Authority-sensitive SOTF v1 identifiers use the exact decoded string. Neither boundary trims, folds case, normalizes Unicode, substitutes lookalikes, parses numbers, nor maps aliases. JSON source spelling may differ only when it decodes to the same string.

Thus "a-b" is eligible, while " a-b " is INVALID for projection ["0","1","a-b"]. The application preserves the string; exact membership classifies it invalid. PostgreSQL performs the same exact JSON-string membership test. This cannot collapse distinct projected IDs.

## 4. Complete selected-reference trace

- Projected ID: durable command ingress has already produced the stored ID; v1 copies it without normalization and bounds membership using unsigned UTF-8 byte ordering.
- MCP schema: sotfV1AuthorityIdentifierSchema validates well-formed, non-NUL bounded text and performs no transform.
- Application parse: " a-b " remains " a-b ".
- Handler membership: strict JavaScript string equality against the bounded projection.
- RPC payload: the handler sends the same unmodified reference.
- SQL parse: JSONB preserves the decoded string; there is no trim, case conversion, normalization, or replacement.
- RPC membership: private sotf_v1_reference_is_eligible performs exact JSONB containment.
- Persistence: only an exact eligible reference reaches the existing authoritative write.

## 5. Runtime parsing audit

| Occurrence | Classification | Result |
| --- | --- | --- |
| Former selected-reference Zod trim | Confirmed handler/RPC divergence | Replaced with exact bounded authority schema |
| Former workflow ID/version trim | Confirmed same-class catalog divergence | Exact decoded values; padded values do not reach retrieval authorization |
| Former daily-brief time-zone trim | Confirmed same-class authority/input divergence | Exact decoded IANA identifier |
| contracts.ts ID/text trim | Canonical source-command parsing | Unchanged; upstream human-authored ingestion, not the v1 dual authority |
| scheduling.ts source trim | Natural-language/presentation only | Unchanged |
| intelligence.ts trim/lower/localeCompare | Presentation, natural-language matching, or legacy ranking | Unchanged; outside v1 authority projection |
| daily-brief-v1 Number calls | Date/time presentation parsing | Unchanged |
| preview.ts String(sequence) | Synthetic preview construction | Not applicable |
| SOTF v1 SQL trim/btrim/lower/upper/regexp_replace | Authority-sensitive search | No such normalization exists or was added |
| SOTF v1 localeCompare | Authority-sensitive search | None; frozen byte comparator retained |
| Workspace IDs | Authority-derived UUID | No caller normalization |
| Request/run IDs | Strict UUID at application and SQL boundary | No trim/case/Unicode semantic normalization; padded UUID denies both paths |
| Host/mode/data class/provenance/type identifiers | Exact literals or enums | Frozen fail-closed behavior retained |

Workflow IDs and versions are system-defined catalog identities. Workspace identity is derived from current authority. Request/run IDs are correlation UUIDs. Ordinary record IDs may originate in human-authored commands, but projected v1 references are already canonical machine identities. User convenience was never documented or intended at this boundary.

## 6. Repair

The application now uses one exact, non-transforming authority-identifier schema for projected references, IANA time zones, workflow IDs, and workflow versions. PostgreSQL adds one private exact-membership predicate and routes probe/write semantic validation through it. The public API, workflow version, outcome shape, entitlement model, and durable tables are unchanged.

The SQL helper is private: public, anon, and authenticated have no execute privilege. PostgreSQL remains the final write authority; application checks remain defense in depth.

## 7. New parsing attacks

Every row used the identical decoded raw JSON through live MCP and authenticated PostgREST. INVALID means exact projection authority rejects the preserved value.

| ID | Raw input | Parsed/authority result | Handler | RPC | Persistence |
| --- | --- | --- | --- | --- | --- |
| P01 | "a-b" | "a-b" | ACCEPT | ACCEPT | One outcome; exact replay adds none |
| P02 | leading ASCII space | INVALID | DENY | DENY | None |
| P03 | trailing ASCII space | INVALID | DENY | DENY | None |
| P04 | surrounding ASCII spaces | INVALID | DENY | DENY | None |
| P05 | leading tab | INVALID | DENY | DENY | None |
| P06 | trailing tab | INVALID | DENY | DENY | None |
| P07 | leading newline | INVALID | DENY | DENY | None |
| P08 | trailing newline | INVALID | DENY | DENY | None |
| P09 | surrounding CRLF | INVALID | DENY | DENY | None |
| P10 | surrounding U+00A0 NBSP | INVALID | DENY | DENY | None |
| P11 | surrounding U+2002 EN SPACE | INVALID | DENY | DENY | None |
| P12 | surrounding U+2003 EM SPACE | INVALID | DENY | DENY | None |
| P13 | surrounding U+202F NARROW NBSP | INVALID | DENY | DENY | None |
| P14 | surrounding U+3000 IDEOGRAPHIC SPACE | INVALID | DENY | DENY | None |
| P15 | surrounding U+FEFF BOM | INVALID | DENY | DENY | None |
| P16 | surrounding U+200B ZERO WIDTH SPACE | INVALID | DENY | DENY | None |
| P17 | U+2010 hyphen lookalike | INVALID | DENY | DENY | None |
| P18 | U+2011 nonbreaking hyphen | INVALID | DENY | DENY | None |
| P19 | U+2212 minus sign | INVALID | DENY | DENY | None |
| P20 | U+FF0D fullwidth hyphen | INVALID | DENY | DENY | None |
| P21 | "A-B" | INVALID | DENY | DENY | None |
| P22 | ".a-b" | INVALID | DENY | DENY | None |
| P23 | "a-b." | INVALID | DENY | DENY | None |
| P24 | combining-mark insertion | INVALID | DENY | DENY | None |
| P25 | leading U+001F control | INVALID | DENY | DENY | None |
| P26 | trailing carriage return | INVALID | DENY | DENY | None |

The 26 cases include every required ASCII whitespace attack, JavaScript-trim Unicode whitespace, a separately classified zero-width character, controls, case change, combining mark, and byte-distinct lookalikes.

## 8. Handler/RPC parity matrix

| Decision pair | Corpus |
| --- | ---: |
| ACCEPT / ACCEPT | 1 |
| DENY / DENY | 25 |
| ACCEPT / DENY | 0 |
| DENY / ACCEPT | 0 |

The live runner also reattacked padded time zone, NULL host, contradictory truncation metadata, and padded request UUID. All four were DENY/DENY. Total runner observations: 30/30 aligned; each boundary produced 1 accept and 29 denies.

## 9. Exact reproduced defect

With projection ["0","1","a-b"] and raw selected reference " a-b ", the MCP handler now denies, authenticated RPC denies, and persistence remains unchanged. The handler no longer sends a normalized alias because no normalization occurs.

## 10. Persistence and no-side-effect proof

Every live denial compares before/after counts and row digests for the private outcome journal, operation events, operation heads/revisions, and workflow access audit. All remain identical. The exact accepted case adds one outcome, changes no other surface, and its identical RPC retry returns replayed:true without a second row.

Ignored local reproduction evidence is in .sotf-local/reference-parsing-evidence.json. It is not committed or treated as hosted proof.

## 11. Prior four defect regressions

- Required NULL/type closure: host:null is DENY/DENY with no mutation; original focused pgTAP remains 122/122.
- Semantic parity: contradictory state_truncated metadata is DENY/DENY; semantic pgTAP remains 47/47.
- Unicode truncation: Unicode pgTAP remains 140/140; comprehensive differential repeats supplementary-boundary and surrogate-safe clipping attacks.
- Ordering: ordering pgTAP remains 267/267; live ordering differential remains 62/62 with exact projection ["0","1","a-b"].

The freshly rerun comprehensive differential produced 212/212 aligned pairs: 90 ACCEPT/ACCEPT, 122 DENY/DENY, zero divergence, plus 105 independent application observations. It rechecks authority loss, direct-RPC bypass, Unicode representation, truncation, ordering, replay, and cleanup.

## 12. Frozen invariant fingerprints

| Frozen artifact | Blob | Match base |
| --- | --- | --- |
| NULL/type migration 20260911143000 | b20992a75c710bb920ec08825456b24a0fe367ff | Yes |
| Semantic migration 20260912162000 | 2723af8c36aa2d870a0b06c11e60b88b5bc5d987 | Yes |
| Unicode migration 20260912190000 | 3c06e4b7af463cde16d83149959d09550e1685f9 | Yes |
| Ordering migration 20260913110000 | d6352a07d899c8d99720248430062cfe91c3e0e0 | Yes |
| Canonical consumer architecture | dfdcdfcba81d7fbba9b0380c9028556a024b8880 | Yes |

UTF-16 units, surrogate-safe clipping, unsigned UTF-8 byte ordering, no Unicode normalization, and deterministic bounded membership remain unchanged.

## 13. Fresh local regression counts

| Check | Result |
| --- | ---: |
| Fresh migrations | 24/24; latest 20260913150000 |
| Original focused pgTAP | 122/122 PASS |
| Semantic pgTAP | 47/47 PASS |
| Unicode pgTAP | 140/140 PASS |
| Ordering pgTAP | 267/267 PASS |
| Reference pgTAP | 62/62 PASS |
| Combined focused SOTF pgTAP | 638/638 PASS |
| Full pgTAP/RLS | 915/915 PASS across 14 files |
| New TypeScript tests | 30/30 PASS |
| Four TypeScript parity suites | 108/108 PASS |
| Schema-policy contracts | 38/38 PASS |
| New MCP/PostgREST differential | 30/30 aligned |
| Comprehensive MCP/PostgREST differential | 212/212 aligned |
| Ordering MCP/PostgREST differential | 62/62 aligned |
| Product-boundary scan | PASS; 87 runtime files |
| Typecheck | PASS |
| Lint | PASS |
| Production build | PASS; 27/27 static pages |
| Database lint | PASS; zero findings |
| Sensitive-data scan | PASS; 96 release-lineage commits, 567 unique blobs, and working tree |
| Preview browser | 6/6 PASS, desktop and mobile against local production build |
| git diff --check | PASS |

Repository-wide unit tests are 222/225. The only failures are the same three in unchanged tests/sotf-v1-mcp.test.ts: hard-coded September 11 dates are outside the today/yesterday window on September 13. The file matches frozen-base blob 26d6e32f22c0a1b1c3c231d305181a73cea1ab6f. Classification: PRE-EXISTING TIME-DEPENDENT TEST-HARNESS DEFECT — NONBLOCKING FOR THIS REPAIR. The full unit suite is not called PASS.

## 14. Files changed

1. docs/architecture/sotf-v1-contracts.md — exact identifier contract.
2. lib/sotf/v1-text.ts — shared exact authority-identifier schema.
3. lib/sotf/daily-brief-v1.ts — remove reference/time-zone trimming.
4. lib/sotf/v1-mcp.ts — remove workflow ID/version trimming.
5. supabase/migrations/20260913150000_sotf_v1_reference_parsing_parity.sql — private exact RPC membership helper.
6. supabase/tests/database/sotf_v1_reference_parsing_parity.sql — 62 permanent assertions.
7. tests/sotf-v1-reference-parsing-parity.test.ts — application/MCP corpus.
8. scripts/test-sotf-v1-reference-parsing-local.mjs — loopback authenticated differential runner.
9. tests/schema-policy-contract.test.mjs — contract enforcement.
10. package.json — test registration only.
11. docs/testing/sotf-v1-reference-parsing-parity-repair.md — this evidence.

No Cash, E2, Entry, billing, provider, entitlement, hosted workflow catalog, canonical consumer architecture, or unrelated implementation file changed.

## 15. Known limitations

The inherited temporary-folder connected-component PostCSS failure remains NONBLOCKING HARNESS LIMITATION. It occurs before SOTF behavior and was not modified or repaired. Production build, Preview browser, pgTAP, in-memory MCP, and authenticated local PostgREST independently cover this repair.

The separate time-dependent unit defect is classified above and was not modified.

## 16. Cleanup and hosted boundary

The reference runner ended with synthetic users, workspaces, outcomes, events, and audits all zero. Comprehensive and ordering runners likewise zeroed every inspected synthetic surface. Local sotf_v1_daily_brief_enabled and mcp_dynamic_admission_enabled were restored to false; the MCP resource returned to http://localhost:3000/api/mcp.

All testing used loopback Supabase/PostgREST, in-memory MCP, and a local production browser server. No commit, staging, push, PR, merge, hosted Supabase mutation, Vercel deployment, ChatGPT connection, production access, Entry/Cash/E2 change, provider activation, or hosted entitlement mutation occurred. Local services are stopped after final verification.
