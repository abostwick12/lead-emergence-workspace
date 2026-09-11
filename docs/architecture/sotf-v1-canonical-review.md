# Canonical review — hosted workflows and SOTF v1

Review date: 2026-09-11. Repository: `abostwick12/lead-emergence-workspace`.

Exact amendment reviewed: `56680058c076828d0de482fca66cbf75678cd6a1`, parent and refreshed remote main `b38fb978e26564df6ead62db901f150665f07ad1`. Work remained on `docs/hosted-workflow-architecture`. The initial tree was clean and no remote-main divergence was present. The complete committed canonical document was read before editing; source inspection below preceded contract changes.

## Canonical review result

The amended architecture is accepted as the contract-design authority for this narrow slice, with the corrections below. This is a documentation review result, not a claim of production readiness or permission to deploy. [SOTF v1 contracts](sotf-v1-contracts.md) make the first vertical slice concrete without authorizing broad implementation.

| Required property | Exact amendment assessment | Final clarification |
| --- | --- | --- |
| A. Host execution | Present | Added explicit rule: host agent executes; LE is not a second agent runtime. LE domain calculations remain permitted |
| B. MCP boundary | Present but runtime prohibition implicit | Explicitly excludes agent loops, generic jobs, provider orchestration and arbitrary execution; read access audit is distinct from user-state writes |
| C. Portable bundle | Clear | Retained portable skills/bootstrap plus hosted workflow references; no permanent hosted-library copy |
| D. Entitlement | Clear | Retained scoped read-only retrieval; concrete v1 current-authority and version rules now specified |
| E. Degradation | Broad product behavior clear, prior-contract/offline semantics open | Denial/unavailability stops hosted workflow; explicit basic-host fallback; retained text has no service authority |
| F. Provider policy | Clear, but final freeze-resumption paragraph was overbroad | Provider reopening now requires accepted use case, burden justification and approval; it cannot authorize remote code or mirroring |
| G. Write-back governance | Present, inference promotion not explicit enough | AI inference remains inference/candidate; no automatic durable truth; actual confirmation plus bounded operations required |
| H. Context Graph | Clear | Universal Context Graph remains outside launch dependencies; ordinary SOTF projection suffices |
| I. Background automation | Clear | Generic workers and Mode B/C remain outside this slice |
| J. ChatGPT acceptance | Clear | Real host evidence remains mandatory; the new acceptance spec carries no completed PASS claims |

Additional editorial corrections: explicitly name workflow outcome history as subscription-backed, fix two list conjunctions, link this review and concrete contracts, and remove blanket future-capability language that could be read as implementation permission. Existing provider exceptions and Mode A/B/C meanings are preserved.

## Source reconciliation

Paths below are relative to repository root and were read at the reviewed commit. Existing tests establish intended source behavior; reading them is not running them or proving hosted state.

| Source | Finding | v1 resolution |
| --- | --- | --- |
| `lib/workspace/bundle-contract.ts`; `tests/bundle-entitlements.test.ts`; `supabase/migrations/20260902162536_bundle_entitlement_foundation.sql` | Catalog key uses underscores; `sotf_transition` already owns bundle capabilities. Existing bundle contracts describe grants/invites, not portable manifests | Reuse the key and effective capabilities; add document schemas without modifying grants or migrations |
| `workspace.resolve_bundle_entitlement` in that migration | Display resolution can label a future-start entitlement active because its `resolved_state` does not check `starts_at`; it also is not the complete plan/MCP authority predicate | Do not use this result alone as retrieval authority. Explicitly check temporal/current authority; `resolve_sotf_workspace` already checks starts_at. No auth repair is performed here |
| `lib/workspace/capabilities.ts` | Existing keys include `core_workspace`, `workspace_mcp`, `career`, `daily_brief`, `agentic_workflows`; external-connectors upsell remains present | Require existing keys for this slice; introduce no new grant. External-connector purchase is not a host-tool prerequisite |
| `lib/workspace/mcp-server.ts` | Server is `lewis` 1.4.0, uses snake-case Workspace tools and broad output schemas. No hosted contract catalog/retrieval tools exist | Declare one new contract compatibility ID and strict new read/write shapes; do not equate existing server/SDK version with support |
| `app/api/mcp/route.ts`; `tests/sotf-entitlement-gating.test.ts` | Pilot gate and exact DB boolean control SOTF registration; disabled/revoked tools are hidden. Existing auth discovery and control-plane registration exist | Preserve auth owner. New typed denial semantics require scoped handlers, not reliance on tool hiding; transport audit/registration is not workflow execution |
| `lib/sotf/mcp.ts` | `sotf_resume_transition` returns complete `operationalState`; `sotf_prepare_next_move` dispatches several domain calculations, and `sotf_bundle` embeds general guidance. No workflow ID/version contract retrieval | New narrow `sotf_get_daily_brief_state`; legacy resume is not the v1 bounded read. Keep useful LE calculations as synthesis; do not turn dispatch into a host-tool runtime or use old prompt as hosted workflow |
| `lib/sotf/intelligence.ts` (`dailyBrief`) | Deterministic server suggestions from saved state are aligned LE synthesis; UTC slicing and fixed 48-hour horizon do not express user-local daily windows. Output may include action/people content beyond the new projection | Specify local-zone window and projection allowlist. Host composes final brief with its connector data. No generic reasoning agent is added to LE |
| `lib/sotf/contracts.ts`, `engine.ts`, `persistence.ts`; `tests/sotf-workflows.test.ts`, `tests/sotf-channel-continuity.test.ts` | Ordinary SOTF commands use confirmation, source classifications, revision checks, pending evidence and receipts. They cover far more than daily brief and have no dedicated brief outcome | Do not funnel outcome through arbitrary commands, `review_week`, task writes or protected context. Define one closed metadata outcome mutation and separate bounded journal |
| `supabase/migrations/20260906120000_sotf_operational_workflows.sql` | Ordinary log is bounded at 2000 events/2 MB; public append has an explicit command allowlist and JSON envelope checks. Replay is version-sensitive and returns full log internally | Preserve existing log unchanged. New outcome persistence must have strict authoritative validation, scoped uniqueness, current auth and read-back; do not append an unsupported command or assume tool-only validation secures an RPC |
| `lib/sotf/professional-context.ts`; status and schema tests | Protected-context access remains a separate contract and is unavailable through this pilot | No P2/E2/Level Up changes or fallback protected copies. Daily brief reads ordinary approved operational data only |
| `lib/sotf/scheduling.ts`; `tests/sotf-scheduling.test.ts` | Scheduling consumes explicitly supplied availability and leaves provider execution unavailable | This brief makes no external writes. Calendar/email reads occur in ChatGPT; no dormant adapter activation |
| `lib/integrations/providers.ts`; vault/release migrations; integration UI | LE provider infrastructure is catalogued and gated; credential-vault UI can imply an LE-owned provider path | Existing infrastructure remains dormant. Manifest host capabilities are not LE connector entitlements. UI correction is outside this contract pass |
| `docs/status/sotf-product-execution.md`, “Pilot decisions and next build” | Historical roadmap says to implement a Google Calendar/Gmail consumer after pilot | Superseded for this slice by canonical host-provider policy; not implementation authority. Historical file preserved |
| `docs/runbooks/real-client-mcp-acceptance.md` | Historical Preview authorities, both-host instructions, and identity/grant cleanup actions belong to another acceptance scope | New spec requires operator-approved current environment/account and leaves auth acceptance ownership separate. No historical URL, Claude test, production grant, fixture, or cleanup action is adopted automatically |
| No generic Context Graph/optimization workflow interface found in implementation | Graph-like ordinary links and outcome history can support limited longitudinal value | No universal graph or optimization engine requirement. Metadata outcomes alone do not prove friction, savings, or measured business results |

None of these findings requires abandoning the canonical architecture. The future-start resolver discrepancy and broad legacy read/write surfaces are concrete implementation constraints, not permission to repair unrelated areas during this pass.

## Decisions resolved for the first slice

1. Keep `sotf_transition`; use `transition.daily_brief`, version `1.0.0`, Mode A only.
2. One portable prioritization method plus bootstrap; hosted procedure remains retrieved online.
3. Calendar/email are optional for degraded use; actual host connector evidence remains a launch acceptance requirement. No web research or provider writes.
4. Omitted version selects one reviewed current version; exact released pins are allowed, unavailable pins fail; no caches or offline entitlement inference.
5. One existing onboarding tool, four catalog/contract reads, one bounded SOTF state read and one metadata outcome write. No universal state query or write endpoint.
6. State is a capped allowlist of ordinary operational records and derived suggestions; protected context, full event log, transcripts and provider payloads are excluded.
7. Outcome uses explicit approval, immutable UUID retry identity, current authority, source revision validation, content-free provenance, verified receipt, and a bounded independent journal.
8. Revocation/unavailability stops LE service use; retained methods and conversations remain subject to host rules. Offline work never silently writes back later.
9. Domain synthesis is allowed in LE; host reasoning, connector calls, approvals and workflow-step execution stay in ChatGPT.

## Decisions deferred without blocking local implementation

Retention/export/deletion/resubscription promises remain a consumer-release gate. Exact host packaging mechanics and account compatibility are resolved by the real-host acceptance gate; failure is reported, never worked around by duplicating provider custody. Beyond v1, workflow retirement windows, richer version migrations, adaptive composition, more portable skills, more workflows, richer context writes, optimization models and background execution require separate scope. Physical DDL/index choices implement the logical contract under existing migration gates; no hosted DDL is approved here.

## Verification boundary

Contract validation covers JSON Schema shape, referential consistency and deliberate invalid mutations. Product-boundary and existing schema-policy checks are source checks only. Full application tests are not a condition for these documentation/data artifacts; application dependencies are absent in this isolated clone. No changes under app, lib, components, tests, scripts, package files or migrations are made. Real ChatGPT, DB/RLS, authorization races and provider trace evidence are specified as NOT RUN until a separately authorized implementation/acceptance pass supplies them.

Validation performed for this change:

- JSON Schema 2020-12 meta-schema validation and strict compilation passed using locally available AJV 8.18.0 with format validation; no dependency was installed or added to this repository.
- Four valid fixtures passed: bundle, workflow, complete outcome, and a derived degraded outcome.
- Twenty-one invalid mutations were rejected: wrong bundle/entitlement identity, executable-code field, missing MCP tool, unsupported host/mode, broad write permission, LE step execution owner, embedded user context, missing approval declaration, false confirmation, caller workspace, provider body, content-persistence claim, malformed UUID/date, excessive count/references, protected-context reference and unsupported outcome status.
- Eight cross-artifact assertions passed for identity/version, MCP requirements, entitlement, skill references and the exact write allowlist. Fifteen local references and four Markdown fence-balance checks passed.
- `npm run check:boundaries` passed for 83 runtime files; `npm run test:schema` passed all 31 existing source-policy tests. These are not DB/RLS execution.
- `git diff --check` passed. Final scope inspection is restricted to the canonical document, this review, the SOTF contract specification, four JSON contract artifacts, and the ChatGPT acceptance specification.
- Typecheck, lint, unit and build checks were not run: there is no application-code change and `node_modules` is absent. DB/RLS and real ChatGPT acceptance remain NOT RUN. No production-readiness claim follows from the documentation validations.

To reproduce contract validation, use any strict JSON Schema 2020-12 validator with format assertions: validate the schema itself, validate each JSON example against its corresponding `$defs` and the root union, then apply the invalid mutations listed above to independent copies. Reject unknown keys recursively. Also verify the artifact ID/version/skill/tool links and the Markdown references. Semantic authorization, receipt identity, timezone windows and host behavior require the future acceptance tests; structural validation does not prove them.
