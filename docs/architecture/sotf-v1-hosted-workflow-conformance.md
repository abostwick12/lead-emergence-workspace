# SOTF v1 hosted-workflow conformance review

Review date: 2026-09-11. Repository: `abostwick12/lead-emergence-workspace`.

This is a read-only delta architecture review of the exact implementation commit. It does not authorize implementation changes, deployment, migration, entitlement changes, provider activation, production changes, or hosted acceptance mutations. The later local evidence-only commit `e89cbb253000447819a58da25e7bb2196af34818` was excluded from the implementation review.

## Gate result

The implementation at `e0277b742569ddcb69d9c7c7fdcd6973a265f992` is substantively conformant with the intended hosted-workflow architecture carried in its parent documentation lineage. It does not permanently install the complete subscription-backed daily-brief workflow into ChatGPT, introduce a second workflow runtime, proxy provider tools, or broaden durable write authority.

The requested canonical prerequisite is not satisfied, however. After `git fetch origin main`, current `origin/main` is `b38fb978e26564df6ead62db901f150665f07ad1`. Hosted-workflow amendment `56680058c076828d0de482fca66cbf75678cd6a1` and its reviewed SOTF contract follow-up `f8183b21379485d8a6866e8f4d4d37cb6a158cfc` are not ancestors of that main commit. The canonical file on `origin/main` has blob `cdf0335711a14dc2669b18cc46a8f6bdf2fd9538`; the amended file has blob `81c40004e2a5b4b78edfd86997522c58c9caab31`. The amendment is therefore present in the SOTF branch lineage, but it has not been merged into current main.

Because the acceptance hold explicitly requires the newly updated architecture to be canonical on main, hosted acceptance remains blocked by documentation lineage, not by an identified implementation correction.

## 1. Exact reviewed implementation SHA

`e0277b742569ddcb69d9c7c7fdcd6973a265f992` (`feat: implement SOTF v1 daily brief slice`). Its direct parent is the reviewed contract commit `f8183b21379485d8a6866e8f4d4d37cb6a158cfc`. Review used the commit tree directly and the implementation delta from that parent; no conclusion depends on the later evidence-only commit.

## 2. Exact canonical main SHA

Fetched `origin/main`: `b38fb978e26564df6ead62db901f150665f07ad1` (`Merge pull request #16 from abostwick12/docs/agent-owned-orchestration-architecture`).

This main commit contains the earlier agent-owned orchestration document, not the later portable-skills/hosted-workflows amendment. Consequently, it cannot yet serve as the canonical hosted-workflow authority requested by this review.

## 3. Bundle and bootstrap finding

The implementation exposes a logical SOTF v1 bundle through Lead Emergence MCP rather than permanently installing the complete workflow in the host:

- `sotf-transition.bundle.v1.json` declares one portable method, host capability requirements, MCP requirements, one hosted workflow reference (`transition.daily_brief`, version selection `current`), compatibility metadata, and degradation policy.
- `list_entitled_bundles`, `get_bundle_manifest`, and `list_workflows` expose bounded catalog and bootstrap metadata.
- `sotf_daily_brief_bootstrap` is a short MCP prompt that directs ChatGPT to retrieve the current hosted contract. It contains no workflow steps or decision-rule body.
- The complete procedure remains the server-side deployment asset `transition.daily_brief.v1.json`, loaded by `lib/sotf/workflow-catalog.ts` and returned only through `get_workflow` after current authorization.

No ChatGPT-native installer, `.codex-plugin` package, or independently installable skill artifact is added by `e0277b7`. That is no longer evidence that complete workflows must be bundled locally. It is instead a still-open packaging/real-host proof obligation: the portable `sotf.daily_prioritization` method is defined in the contract documentation and referenced by the manifest, while actual installation and post-cancellation retention must be demonstrated in acceptance case A02/A13. This is a nonblocking packaging gap for the bounded pilot if the approved acceptance setup can install/configure that documented portable method without changing the implementation.

## 4. Hosted-workflow retrieval finding

`get_workflow({workflow_id, workflow_version?})` is the required bounded read surface:

- **Authenticated:** each tool advertises the existing OAuth scheme, and the MCP route admits a bearer-bound Supabase client before any handler runs.
- **Workspace bound:** the caller supplies no workspace or user selector; `sotf_v1_access_state` and `require_mcp_workspace` derive the current personal workspace from admitted identity and MCP authority.
- **Entitlement and capability scoped:** current active plan, connected ChatGPT MCP authorization, active unexpired/unrevoked `sotf_transition` entitlement, product release gate, and the five required capabilities are checked. Retrieval rechecks authority under lock before delivery.
- **Version aware:** omitted version resolves the single server-owned current version `1.0.0`; exact `1.0.0` is supported; other versions fail with `version_not_available`.
- **Read-only in user-state semantics:** retrieval does not change ordinary SOTF state, outcome history, workflow body, or provider data. It writes one content-free authorized-access audit receipt, which is required for auditability and is explicitly separated from user state.
- **Auditable:** the receipt records only workspace, subject, client, operation, bundle/workflow/version, authorized result, and timestamp; it stores no contract body, prompt, conversation, or provider content.

The shared pre-existing MCP request path also refreshes connection/observability records through `mcp_register_connection` and `mcp_record_observability_event`; connection registration may update onboarding connection status/timestamps. Those are authentication/transport lifecycle effects rather than SOTF workflow writes, but they mean `readOnlyHint:true` should not be interpreted as literally zero database writes end to end. Acceptance A05 correctly requires the ordinary SOTF revision and outcome count to remain unchanged while allowing the access audit. If product intends a stricter zero-non-audit-side-effect meaning, that interpretation needs a separate MCP lifecycle decision; it is not introduced by this slice.

## 5. Declarative workflow finding

The hosted workflow is strict, versioned JSON validated by closed Zod and JSON schemas. It declares host-owned steps, capabilities, state reads, decision rules, approval gates, one allowed write-back, ephemeral classes, stop conditions, success criteria, output behavior, degradation, and compatibility.

The implementation downloads no JavaScript, Python, shell, or executable module. It contains no evaluator, dynamic function construction, generic job runner, generic tool proxy, or remotely selected arbitrary tool/argument surface. ChatGPT interprets the bounded instructions and may invoke only capabilities already exposed and authorized in the host or through named LE MCP contracts. This is declarative guidance/data, not remote executable code.

## 6. Host-owned connector finding

Calendar and email are optional host capabilities in the manifest and workflow. Every workflow step has `owner: "host"`; the host-context step directs ChatGPT to use its own authorized, bounded Calendar/Email reads and explicitly forbids sending provider content to Lead Emergence. The bootstrap repeats that boundary.

The SOTF v1 implementation imports no provider adapter, obtains no Gmail/Calendar/Drive/Slack credential, and makes no provider network call. It does not activate the dormant provider infrastructure or Composio. Source conformance is positive; real correlated host/LE traces remain required by acceptance A07/A08 before claiming runtime proof.

## 7. Execution-mode finding

The workflow schema, workflow asset, outcome schema, and database validation all require execution mode `A`. All seven workflow steps are host-owned. Lead Emergence supplies the versioned procedure, bounded state/suggestions, and governed outcome storage; it does not run an agent loop or execute the procedure.

No scheduler, worker, Mode B host schedule, or Mode C LE-native runner is introduced or required. Hosting the definition in Lead Emergence does not change this user-session ChatGPT execution from Mode A.

## 8. Write-back and mutation inventory

The workflow contract permits exactly one product write: `sotf_record_daily_brief_outcome` after an exact metadata preview and explicit confirmation. The operation performs current-authority recheck, state-revision validation, eligible-reference validation, bounded capacity enforcement, dual request/run idempotency, append, and verified receipt return. It does not modify criteria, opportunities, commitments, meetings, hypotheses, tasks, protected context, the SOTF operation log, or its revision.

The complete mutation inventory encountered by an accepted run is:

1. Pre-existing MCP connection/observability lifecycle writes on authenticated transport use (`mcp_register_connection`, fingerprinted observability events).
2. A content-free access-audit insert when `get_workflow` successfully delivers the contract.
3. At most one user-confirmed metadata-outcome insert, plus exact-id replay reads; refusal or definitive rejection produces no outcome write.

There is no generic write endpoint and no authority derived from the workflow body itself. Uncertain write results return `result_unknown`/`saved:null` and require an exact-identity retry rather than a fresh duplicate.

## 9. Persistence and privacy finding

The durable outcome is a closed metadata envelope: workflow/version, run/request IDs, source state revision, local date/zone, Mode A host, completion/degradation state, connector result enums, degradation reason enums, up to three references to already-authorized LE entities, priority count, optional usefulness enum, and content-free provenance. The database stores the same validated envelope as a bounded payload for exact replay comparison; its schema cannot accept arbitrary text, prompts, provider identifiers, message bodies, transcripts, or provider payloads.

The full brief, provider citations, host conversation, provider payloads, and unconfirmed inference are explicitly ephemeral, and `persist_brief_text` is false. The bounded LE state projection is capped by record count, field length, and 64 KiB JSON size and excludes the full event log and protected context. No provider-data, transcript, or generalized ingestion pipeline is added.

## 10. Outcome and optimization compatibility

The outcome envelope is suitable as a conservative future Continuous Optimization input: it records versioned workflow execution status, connector availability, degradation, selected existing LE references, priority count, a user-supplied usefulness enum, provenance, and verified timestamps without ingesting source content.

It does not infer friction, opportunity, savings, automation suitability, or measured results from frequency. It neither imports Cash nor requires a universal optimizer, Context Graph, generalized signals pipeline, or background service. Any later optimization use remains a separately accepted capability.

## 11. Subscription and degradation finding

Current release, plan, connection, entitlement, and capability checks fail closed for contract, state, outcome, and replay access. An inactive/future/expired/revoked grant or missing required capability cannot obtain the hosted workflow or durable LE intelligence through this surface. Optional host-connector absence yields a labeled degraded authorized workflow; LE service denial stops hosted-workflow execution.

The implementation is compatible with the intended cancellation boundary, but the complete behavior is not yet runtime-proven. The portable skill/bootstrap and customer-owned connector retention side are host configuration facts, not server facts; A02, A12, A13, N01, N03, and N17 remain required. Data export/retention/deletion policy is separate and does not block this bounded architecture review.

## 12. MCP and capability-boundary finding

Workflow retrieval is not an authorization token, lease, or permission expansion. Each v1 catalog/state/write operation resolves current authority independently. The workflow contract names the one permitted SOTF write and exact required reads; it has no generic tool name, user/workspace selector, provider proxy, arbitrary state path, or executable argument channel.

The broader Workspace MCP still exposes separately governed non-workflow tools under their existing contracts. Receiving the hosted workflow does not alter those tools' authorization and does not grant the workflow permission to call them. Real ChatGPT acceptance must verify that the host follows the declared allowed-tool boundary; production MCP security acceptance remains separate.

## 13. Exact blockers and nonblocking follow-up

### Blocking before hosted acceptance

1. Merge the reviewed hosted-workflow architecture through the normal canonical review path so `docs/architecture/agent-owned-orchestration.md` on `origin/main` contains the portable-skill/hosted-workflow amendment. Verify the resulting main SHA and canonical file content before lifting the architecture hold.

This is a documentation/source-of-truth correction. No correction to implementation commit `e0277b7` was identified by this delta review.

### Nonblocking but required for acceptance evidence

1. Install/configure the documented portable method and bootstrap in the actual ChatGPT test environment and prove the host inventory contains references, not a permanent complete workflow copy.
2. Prove current contract retrieval, host execution, host-owned connector calls, metadata preview/confirmation, write/read-back/idempotency, revocation, retained portable assets, and basic fallback with the canonical acceptance matrix.
3. Record the shared MCP connection/audit lifecycle effects distinctly from ordinary SOTF user-state mutation so `readOnly` is not overclaimed as zero operational telemetry.

## 14. May hosted acceptance proceed without modifying implementation?

Not yet, because the canonical-main prerequisite is false. After the hosted-workflow amendment is actually merged and its resulting main SHA is verified, this review finds no SOTF implementation change required before the already-approved isolated real-ChatGPT acceptance run. The remaining implementation-adjacent items are host packaging/configuration and runtime evidence obligations, not permission to add a second runtime, provider integration, generic automation, broad write surface, or generalized optimization dependency.

SOTF V1 HOSTED-WORKFLOW CORRECTION REQUIRED — ACCEPTANCE REMAINS BLOCKED
