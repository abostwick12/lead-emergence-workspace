# SOTF v1 contracts — transition.daily_brief

Status: implementation-ready contract design; no runtime implementation or real-host acceptance claimed.

Reviewed base: `b38fb978e26564df6ead62db901f150665f07ad1`. Reviewed architecture amendment: `56680058c076828d0de482fca66cbf75678cd6a1`. The [canonical architecture](agent-owned-orchestration.md) controls. This specification resolves only the first Mode A daily-brief slice. Physical storage and code changes require a separately scoped implementation task; no rollout, hosted migration, provider activation, or cross-workstream authority is granted here.

## Contract artifacts and identifiers

| Artifact | Definition |
| --- | --- |
| Bundle | [sotf-transition.bundle.v1.json](contracts/sotf-transition.bundle.v1.json) |
| Hosted workflow | [transition.daily_brief.v1.json](contracts/transition.daily_brief.v1.json) |
| Strict machine schemas | [sotf-v1.schema.json](contracts/sotf-v1.schema.json), `$defs/bundle`, `$defs/workflow`, `$defs/outcome` |
| Synthetic outcome example | [daily-brief-outcome.example.json](contracts/daily-brief-outcome.example.json) |
| Review and source conflicts | [Canonical review](sotf-v1-canonical-review.md) |
| Real-host acceptance | [ChatGPT acceptance specification](../testing/sotf-v1-chatgpt-acceptance.md) |

These JSON files are design fixtures, not installed assets, an endpoint registration, or permission to ship an executable workflow. Unknown JSON properties are rejected. JSON Schema validates structure, not instruction safety or authorization. The semantic requirements below are equally normative.

Use the existing `bundle_key: sotf_transition`, including for the entitlement lookup. Do not introduce `sotf.transition`, `bundle.sotf`, a new subscription system, or a new capability grant. Workflow identity is `transition.daily_brief`; both bundle and workflow versions start at `1.0.0`; schema version is the string `1`. Snake-case new tool fields follow Workspace MCP conventions; existing camel-case SOTF commands remain unchanged. A workflow version and a bundle version have independent lifecycles.

`sotf_daily_brief_v1` is a new advertised MCP contract compatibility identifier, not a new entitlement or an assertion that current server `lewis` version `1.4.0` already supports it. Compatibility requires that identifier plus all seven named tools and schema version `1`. Do not satisfy it by comparing the MCP SDK package version or arbitrarily bumping a server number.

## Portable method and bootstrap

The single initial portable skill is `sotf.daily_prioritization` version `1.0.0`. Its delivered method is: identify time-sensitive commitments, distinguish observations from assumptions, choose at most three useful priorities with reasons, and permit a deliberate pause. It contains no user state, provider tokens, catalog entitlement assertions, or copy of the hosted daily-brief steps. STAR, TIARA, interview, networking, and research methods can be later portable assets; they are not required to prove this slice.

The bootstrap teaches the host how to discover eligible bundles, retrieve a workflow by ID, read its declared bounded state, apply source/approval boundaries, and offer an honest basic-host fallback. It references the MCP connection configured through the reviewed deployment and host setup; no speculative production URL is embedded here. The manifest's local Markdown reference defines packaging content requirements and is not an already installed ChatGPT skill. Packaging must be proven in the real host.

On each user invocation, bootstrap checks compatibility/onboarding, obtains the authorized workflow, and follows its allowed tools. It never interprets catalog metadata, a prior successful run, or a retained transcript as a current entitlement. A subscription outage does not remove the portable skill or the user's ChatGPT connectors.

## Host and workflow requirements

Required host capabilities are MCP access, user interaction, reasoning, and an explicit approval interaction. Calendar read and email read are optional. Their absence yields a visibly degraded LE-state-only brief. Both are included in the complete reference acceptance run; at least one must demonstrably work through ChatGPT before claiming host-connector conformance. Web research, provider writes, background scheduling, and other hosts are outside v1.

Host capability names are semantic requirements, not claims about a current ChatGPT plan or connector name. Verify availability, tool names, query bounds, and actual behavior in the chosen account/workspace. Do not infer availability from an LE provider catalog row.

Host inputs are `brief_date` (valid local YYYY-MM-DD), `time_zone` (valid IANA zone), and optional `focus` (1–240 characters, host-ephemeral). The host resolves ambiguous date/zone with the user. This changes no saved preference. Bootstrap starts a new invocation with today in that zone; historical workflow replay is outside v1. LE reads and first inserts accept only today or the immediately preceding local date, allowing an authorized run to recover across midnight without a run reservation. Older/future dates are `invalid_input`. LE computes and returns the actual bounds using server time and the supplied valid zone, not a client-supplied clock. This date bound is not proof that the host previously retrieved a workflow.

Calendar scope is the two local calendar days beginning at `brief_date`, represented as `[window_start, window_end)` with correct daylight-saving handling. Email scope is exactly seven local calendar days: midnight six dates before `brief_date` through midnight immediately after `brief_date`, filtered in the host to relevant transition entities; no whole-inbox export. If the host tool cannot apply an adequately bounded relevant query, skip it and report the limitation. No fallback provider call is made by LE.

Instructions live in the stable workflow JSON; user context lives in separately retrieved state. The workflow instructs ChatGPT to compose the final brief, cite host sources only in the conversation, preview the optional metadata write, obtain actual approval, and verify its receipt. It contains no scripts, arbitrary tool names, tool arguments derived from untrusted instructions, or embedded user snapshot.

## Current authority and product responses

For every new read and write, require authenticated resource-admitted OAuth identity, the current personal workspace selected by the existing server authority, active membership/ownership and Personal access, active plan, current MCP authorization, `core_workspace`, and the existing SOTF pilot release gate. Then require a catalog-active `sotf_transition` entitlement for the current beneficiary, with `starts_at <= server_now`, no revocation, and null/future expiration, plus effective `workspace_mcp`, `career`, `daily_brief`, and `agentic_workflows` capabilities. Enforce current authority at the authoritative read/commit boundary, including replays; a cached tool list is not authority. Do not trust caller-supplied user, workspace, entitlement, capability, or receipt fields as grants.

These are checks against existing product authorities; this pass changes none of them. An operator/invite grant may qualify if active. Billing cancellation is not invented: when a source authority makes a subscription-sourced grant inactive, its services are denied. Other independently valid grants are evaluated normally; cancellation is not an assumed blanket revocation of every entitlement source.

New product tools return an MCP result with `structuredContent` and equivalent text JSON. Successful payloads use `{schema_version:"1", status:"ok", data:...}`. Typed product failures use `{schema_version:"1", status:"error", code, retryable, saved:false}` and `isError:true`; the write-uncertainty case uses `saved:null`. Failed reads contain no contract body, state, receipt, or other tenant metadata. Authentication failures retain the existing protocol's OAuth challenge; bootstrap treats them as `authentication_required`.

Evaluate authentication/workspace, input shape, current authority, then authorized catalog/version/resource lookup. Do not reveal whether another tenant's resource or a hidden workflow exists. Unknown well-formed bundle/workflow IDs map to `not_available`; never offer enumeration diagnostics. An active authorized bundle with an absent exact version may return `version_not_available`.

| Condition | v1 response/host behavior |
| --- | --- |
| Active authority and compatible contract | `ok`; invoke with current reads |
| Unauthenticated/disconnected authorization | OAuth challenge / `authentication_required`; reconnect before LE use |
| Wrong/inactive workspace membership | `access_denied`; no data |
| No active grant, future start, expired or revoked grant, suspended plan | `entitlement_required`; no hosted contract/state/outcome access |
| Known required LE capability unavailable | `capability_unavailable`; no partial bypass |
| Release gate off or entitlement authority unavailable | `service_unavailable`; do not interpret uncertainty as active entitlement |
| Unknown authorized ID | `not_available` |
| Exact version absent or retired | `version_not_available`; never silently substitute |
| Unsupported schema/contract identifier | `incompatible_contract`; stop |
| Transition chapter absent | `transition_not_started`; direct to existing intake separately |
| Invalid fields/unknown keys/date/zone/size | `invalid_input`; no write |
| Current state differs on first outcome write | `state_changed`; reread, regenerate and review |
| Same request/run identity with different payload | `idempotency_conflict`; no overwrite |
| Record limit reached | `capacity_reached`; preserve prior data, no new write |
| Read timeout, missing tool, or unreachable LE | Host normalizes to `service_unavailable`; cannot expect an unreachable server to return a payload |
| Write reply lost or commit/read-back uncertain | `result_unknown`, `saved:null`; preserve exact IDs/payload, do not announce success |

`retryable:true` applies only to temporary service unavailability and uncertain result recovery; it grants no automatic background retry. All other errors require user action, fresh state/review, or a compatible release. Transport failure during a write is always uncertain unless there is affirmative evidence that nothing was committed. Typed responses do not replace server-side enforcement.

## Minimal version policy

The host requests `get_workflow({workflow_id:"transition.daily_brief"})`. Omitted `workflow_version` resolves a server-owned release catalog's single `current` pointer, initially `1.0.0`. A host may instead request exact `workflow_version:"1.0.0"`. No ranges, `latest` strings, migration engine, or offline licensing are supported.

Released bytes are immutable within a workflow version. Changes require a new version and validation; moving the current pointer is a reviewed release action. Initially only `1.0.0` is released. An exact pin succeeds only while that version remains explicitly released, compatible, and entitled. A retired/missing version fails without fallback. A changed current pointer never upgrades a pinned request silently. Returned data includes schema version, workflow version, and the release contract identifier. Write-back must use the executed version and that version must still be released at the write boundary.

Every invocation retrieves online. No client/offline cache, entitlement cache, result cache, CDN cache, or distributed cache is part of v1; use `Cache-Control: no-store`. Immutable release definitions may be ordinary deployment assets, but every delivery is freshly authorized. Host conversation history may still retain returned text; LE cannot retract that text or prevent all independent imitation. Continued access to LE contracts, data, synthesis, outcomes, or services remains enforced online. Bootstrap must not execute remembered text as a current entitled workflow. If an outage or revocation is observed mid-run, stop LE execution and ask whether the user wants basic host-directed help; never silently continue the branded workflow or queue write-back for restoration.

No retrieval lease, execution token, durable run reservation, or personalized prompt generator is needed. A `run_id` is a correlation/idempotency identifier, never proof of permission. Server checks secure LE services; acceptance evidence proves the host followed the invocation policy.

## MCP v1 read operations

New read tools advertise `readOnlyHint:true`, `destructiveHint:false`, `openWorldHint:false`, `idempotentHint:true`, strict input/output schemas, and the existing reviewed OAuth requirements. Calls read LE data only; access auditing must exclude workflow/provider content. The existing `get_onboarding_state` keeps its established return shape and behavior; it is not retrofitted to the new envelope here.

| Tool | Strict input | Returned data / bound |
| --- | --- | --- |
| `get_onboarding_state` (existing) | `{}` | Existing readiness response; incomplete onboarding stops this slice; intake writes remain separate |
| `list_entitled_bundles` (new) | `{}` | At most the one eligible v1 bundle: `bundle_key`, `bundle_version`, `display_name`, required capability keys, LE contract identifier; empty list on healthy authority with no grant, unavailable error on failed resolution |
| `get_bundle_manifest` (new) | `{bundle_key:"sotf_transition"}` | Exactly the validated v1 bundle artifact; freshly scoped to current authority |
| `list_workflows` (new) | `{bundle_key:"sotf_transition"}` | At most one row: workflow ID, current version, title, description, execution mode; no procedure or user state |
| `get_workflow` (new) | `{workflow_id:"transition.daily_brief", workflow_version?:"1.0.0"}` | Exactly the authorized workflow artifact; no user context or write effects |
| `sotf_get_daily_brief_state` (new) | `{workflow_id:"transition.daily_brief", workflow_version:"1.0.0", brief_date, time_zone}` | Projection version `1` below; no arbitrary selectors/query/SQL |

`get_onboarding_state` plus entitlement/catalog responses supply the minimal readiness and capability surface. A separate generic capability API is unnecessary. Do not expand catalog pagination or implement other bundle catalogs for this slice. Workflow/tool discovery describes static interfaces without returning entitled workflow bodies. New typed gated handlers must remain invocable for denial semantics; simply hiding all SOTF tools on revocation is insufficient to implement the documented response. Existing unrelated tools are not broadened.

### Bounded daily-brief state projection

The `data` object is a closed allowlist: `projection_version:"1"`, `workspace_id` (server UUID), `workflow_id`, `workflow_version`, `state_revision` (ordinary SOTF integer revision 0–2000), `as_of` (server UTC timestamp), `brief_date`, `time_zone`, `window_start`, `window_end`, `chapter`, `criteria`, `opportunities`, `commitments`, `meetings`, `hypotheses`, `suggestions`, `recent_outcomes`, `truncated_sections`, and `omitted_counts`. Unknown fields are rejected. All reads belong to the same authorized workspace; the operational projection uses one consistent revision. Empty arrays are valid and distinct from unavailable state.

| Field | Allowed members and selection |
| --- | --- |
| `chapter` | `question` (max 500 chars), `phase` (existing enum), `weekly_hours` (1–80); a null chapter returns `transition_not_started` |
| `criteria` | Up to 20 confirmed ordinary criteria: `id`, `label`, `dimension`, `desired` (500), `non_negotiable`, `importance` (1–5), `confirmed:true` |
| `opportunities` | Up to 10 non-declined/non-paused opportunities with a deadline before window end; `id`, `company`, `role`, `status`, `deadline`, `next_action` (500 or null). Exclude descriptions, materials, offers, email, raw evidence, and attachments |
| `commitments` | Up to 10 open/blocked commitments with a due date before window end: `id`, `title`, `due`, `status`, `definition_of_done` (500), `review_trigger` (500) |
| `meetings` | Up to 10 planned/accepted meetings overlapping the window: `id`, `title`, `starts_at`, `ends_at`, `status`, `objective` (500); no attendee emails, provider payloads, or debrief transcripts |
| `hypotheses` | Up to 3 continue/refine hypotheses: `id`, `proposition`, `next_experiment` (500), `review_trigger` (500), `status`; always marked provisional in host reporting |
| `suggestions` | At most 3 deterministic derived suggestions from the projected entities only: `source_ref` (typed ID), `reason_code` (`overdue`, `due_soon`, `meeting_soon`, `deadline_soon`, `learning_step`), `epistemic_status:"derived"`; no remote agent reasoning or provider calls |
| `recent_outcomes` | Up to 3 verified outcome receipts for this workflow, requested released version and user, newest `recorded_at` then outcome ID; metadata only, using the write receipt shape below |
| `truncated_sections`, `omitted_counts` | Names/counts of omitted or text-truncated data for each bounded section; never silently present truncated output as exhaustive |

IDs are existing SOTF IDs, 1–100 characters; short display fields are at most 240 characters; dates use ISO dates/timestamps and explicit null for absent optional scalar values. Arrays default to empty. Sort criteria by importance descending then ID; opportunities by deadline then ID; commitments by due date then ID; meetings by start then ID; hypotheses by ID. Select suggestions by overdue commitments, meetings, deadlines, remaining due commitments, then hypotheses, breaking ties by due/start then ID. Suggestions are advisory product synthesis, not a second workflow runtime. Local date comparisons use the requested IANA zone; do not reuse UTC slicing in the current `dailyBrief` without reconciliation.

Top-level `omitted_counts` has one nonnegative integer for each bounded array; `truncated_sections` names any array with omitted rows or trimmed text. JSON response limit is 64 KiB UTF-8: remove tail rows in the order recent_outcomes, hypotheses, meetings, commitments, opportunities, criteria, updating counts until it fits; never return a partial JSON body. Remove suggestions whose sources were dropped. Keep one consistent projection and use its IDs for outcome validation. Server retrieval/replay may use the existing bounded ordinary event log internally, but must not send it to the host.

Protected Professional Context, general memory, full `operationalState`, broad Workspace job applications, provider content, raw coaching notes, stories, and transcripts are excluded. No duplicate career source is introduced: ordinary SOTF opportunities are the v1 career pipeline. No universal Context Graph or protected-context activation is needed. The state read may show prior outcome facts and counts; counts alone never imply friction, opportunity, savings, or an optimization recommendation.

## One bounded MCP write-back

`sotf_record_daily_brief_outcome` is the only mutation permitted by this workflow. Its exact input is `$defs/outcome` in the machine schema. It accepts no arbitrary text, arbitrary state paths, workspace selector, task changes, contact data, provider URLs, evidence promotions, protected context, or uploaded brief. No `record_workflow_run`, `record_signal`, `submit_context_candidate`, generic upsert, or task mutation is needed for this proving slice.

| Requirement | v1 contract |
| --- | --- |
| Authorization | Recheck all current authority and release/version requirements at the commit boundary; also before returning an idempotent receipt |
| Tenant boundary | Derive subject/workspace/client from admitted auth and current DB authority; never accept them in input |
| Expected input | Strict outcome schema, maximum 8 KiB UTF-8; semantic checks below; reject unknown properties |
| Provenance | Server supplies subject, workspace, client ID, server `recorded_at`, outcome ID, and authority-checked version; caller supplies host/version/state revision. Label data `host_reported_user_confirmed`, never independently verified provider execution |
| Approval | Host previews exact persisted fields and obtains explicit confirmation; server requires literal true but does not pretend that flag proves a human interaction. Host acceptance must prove the interaction |
| Privacy | `ordinary_transition_operations`; exact enum/boolean/count/LE-reference metadata only; no raw text/provider identifiers or prompts |
| Permitted effect | Append one daily-brief outcome record and its receipt. Do not mutate operational criteria/commitments/opportunities, increment the SOTF operation revision, create jobs, run synthesis agents, or append an unsupported legacy SOTF command |
| Evidence | Read back the committed record; return `saved:true`, `replayed`, and closed receipt shape below; do not claim successful save from attempted append alone |
| Failure | Definitive rejection has no write; uncertain commit/read-back uses `saved:null`; no background queue, partial multi-step save, or blind new-ID retry |

Semantic validation requires a real IANA zone, a brief date within the today/yesterday bound above, the released version, and `expected_state_revision` matching the ordinary state snapshot for a first insert. The host retains the original date/bounds for an invocation resumed across midnight. This bound is not an entitlement lease. Recompute projection eligibility against the submitted date and authoritative revision. `selected_le_refs` must be unique, exist in the returned-eligible projection for that workspace/revision, and number no more than `priority_count` (0–3). The workflow may prioritize host-only information, so refs may be fewer than priorities. No refs can point to protected records.

`status:completed` requires both connector results `used` and no state truncation; all other combinations are `degraded`. Degradation reasons must exactly reflect `not_available`/`failed` connector states and actual state truncation. `not_requested` is preserved in connector results, implies degraded, and needs no invented unavailable reason. A zero-priority deliberate pause is valid. `usefulness` is `not_rated` unless the user supplied the rating; neither frequency nor successful storage establishes benefit. `provider_content_persisted:false` is enforced by the closed metadata schema, not trusted as permission to accept hidden content.

For retry identity use `(workspace, authenticated subject, workflow_id, request_id)` and an additional uniqueness constraint on `(workspace, authenticated subject, workflow_id, run_id)`. The host generates UUIDs once per invocation. Canonicalize the full accepted payload, including version, revision, date, approval, and provenance, before comparing retries. Same identity and exact payload returns the same verified receipt with `replayed:true`; different payload under either identity returns `idempotency_conflict`. An identical already-committed retry is resolved after current authorization but before the first-insert revision/date checks, so later unrelated state changes do not create duplicates. If entitlement or version was revoked/retired, even an old successful receipt is inaccessible through this workflow surface.

Receipt data is `{outcome_id, request_id, run_id, workflow_id, workflow_version, state_revision, recorded_at, brief_date, time_zone, status, connector_results, degradation_reasons, selected_le_refs, priority_count, usefulness, provenance}`. IDs are UUIDs where defined above; state_revision is the source ordinary revision, not a new event revision. `provenance` additionally includes the server-bound workspace, subject and client ID; these are returned only inside the authorized workspace. A success is `{schema_version:"1",status:"ok",data:{saved:true,replayed,receipt}}`. `recent_outcomes` exposes these same receipts to the authorized user so the host can display the last result and derive count-based summaries without provider ingestion.

Store outcomes as a bounded ordinary metadata journal separate from the existing SOTF command-event stream; adding an unsupported command to the current replay log is prohibited. Initial cap: 100 outcomes per workspace, then `capacity_reached` with no eviction. This is a pilot capacity limit, not a retention/deletion policy. Storage must enforce tenant isolation, both uniqueness keys, atomic current-authority/revision check plus insertion, and verified read-back. Physical table/index/RPC definitions are a focused implementation detail to review under existing migration gates. A disconnect/revocation transaction and an outcome insert must have an explicit serialization boundary: whichever commits first defines the result; a queued insert cannot rely only on earlier admission. The test suite must prove both orderings without modifying E2/Level Up ownership.

After `state_changed`, read current state and regenerate the brief/preview. Use new IDs only after definitive rejection and renewed approval. After uncertainty, retain exact input and IDs and offer an explicit retry while currently authorized; if still unavailable, show unresolved save status. Do not automatically post a cached offline outcome after access returns. Lost-ID recovery can display recent receipts but cannot justify a new duplicate insertion.

## Degradation and subscription behavior

An active grant enables fresh retrieval. A healthy list with no eligible grant is empty; direct gated retrieval fails with `entitlement_required`. Future-start, expired, revoked, or suspended access never serves a contract from previous entitlement state. Service/authority failure is distinguishable from a known missing grant and fails closed.

When optional host connectors are missing, the authorized workflow may deliver an explicitly degraded brief from current LE state. When LE itself is missing, unavailable, or denied, the hosted workflow stops. The user may choose basic use of their portable skill and host tools; this must be described as basic host-directed help, with no LE-state claims or LE write-back. Restore access only through a new online invocation. Do not revoke or cripple the user's host connectors or delete portable assets.

Cancellation policy controls service access; user conversations and prior exported artifacts may remain subject to host behavior. There is no assertion of impossible remote DRM. Retained text does not grant future LE retrieval or state/write access. Product retention duration, deletion, export, and resubscription restoration remain separate decisions before consumer release. This review grants no permission to change real entitlements for testing.

## Slice boundary and next implementation

The next scoped implementation may load the static contract assets, expose the five new catalog/state reads alongside existing onboarding (four catalog/contract reads plus one state read), and implement the single metadata outcome write with isolated local persistence tests. Include minimal host bootstrap/portable-method packaging for acceptance; do not build a full installer. The outcome read-back is the state-display/synthesis proof; no dashboard rebuild or optimization engine is required.

Keep the current provider vault and adapters dormant, P2 protected context off, and Cash, E2/Level Up, Ministry, Consulting, and other workstreams untouched. No universal graph, generic job system, Mode B/C execution, broad write endpoints, workflow code downloads, transcript/provider mirrors, Composio, or second-host certification is authorized. Real ChatGPT execution in an approved environment remains a separate acceptance gate. This contract review itself implements none of those operations.
