# SOTF v1 daily brief — real ChatGPT acceptance specification

Status: NOT RUN. This file defines acceptance, not evidence of a working deployment.

Authority: [canonical architecture](../architecture/agent-owned-orchestration.md), [SOTF v1 contracts](../architecture/sotf-v1-contracts.md). Workflow: `transition.daily_brief` `1.0.0`; bundle: `sotf_transition` `1.0.0`; host: ChatGPT; mode: A.

## Entry gate and evidence record

Run only after the narrow contract implementation passes local checks and an operator has approved the exact non-production deployment, identity/workspace, host account, test connector accounts, entitlement manipulations and any hosted migration/fixture lifecycle. This specification authorizes none of those actions. Do not inherit a historical Preview URL or production authority from an older runbook. E2/Level Up retains authentication acceptance ownership. Do not create a second auth repair workstream or enable P2.

Record commit/deployment SHA, UTC start/end, MCP resource and issuer (no tokens), host account class/workspace policy, visible host version when available, actual connector/tool names, bundle/schema/workflow versions, synthetic workspace alias, active capability/grant evidence, tool-call correlation IDs, state revision, receipt IDs, and redacted artifact locations. Keep fixture data fictional. Never log secrets, provider message bodies, complete prompts or transcripts, real personal data, or raw network payloads containing credentials. Evidence references may point to restricted operator-held synthetic traces; shared reports use metadata and bounded redacted snippets only.

Required fixture: an existing ordinary transition chapter with a confirmed criterion, upcoming fictional opportunity deadline, open commitment, meeting, and provisional hypothesis. An authorized test ChatGPT account has synthetic calendar/email data relevant to those records. At least one calendar/email fact is deliberately absent from LE state to establish that host tools supplied new information. A second workspace supplies cross-tenant negative cases. Fixture creation/cleanup is separately approved; no blanket deletion is implied.

## Positive scenario

| ID | Action | Required evidence / pass condition |
| --- | --- | --- |
| A01 | Establish active Personal/SOTF grant and effective capabilities | Server authority shows correct beneficiary/workspace, started/unexpired/unrevoked `sotf_transition`, active plan/MCP and release gate. A bundle label alone is insufficient |
| A02 | Install the portable method and bootstrap in ChatGPT | Actual host inventory/configuration shows the skill and workflow reference, with no permanent copy of the complete hosted workflow or user state. Manifest validation and supported host capability result recorded |
| A03 | Connect the reviewed LE MCP through actual host authorization | Real OAuth/discovery success and `get_onboarding_state` ready response. Existing auth owner's refresh/disconnect/reconnect acceptance evidence linked; simulations alone do not pass |
| A04 | Ask for today's transition brief | ChatGPT discovers `sotf_transition`, identifies `transition.daily_brief`, and calls catalog/manifest tools. Save tool names/IDs, not a full conversation |
| A05 | Retrieve the current entitled contract | `get_workflow` returns schema `1`, workflow `1.0.0`, host Mode A and declared read/write boundaries. Access audit exists. Ordinary state revision/outcome count unchanged by retrieval |
| A06 | Read required LE state | `sotf_get_daily_brief_state` returns only the documented projection and a coherent revision/date/zone window. No full operationalState, protected context, raw evidence or provider payloads |
| A07 | Execute external reads in ChatGPT | Host trace attributes calendar/email calls to the host's own connector tools, with bounded queries. The fresh synthetic provider-only fact appears correctly sourced in the host brief |
| A08 | Prove LE did not proxy or execute those calls | Correlated LE request and outbound-network evidence for the accepted interval shows only allowed LE/auth/state operations and zero provider adapter calls. Host trace identifies actual provider reads. Source inspection or absence of LE credentials alone cannot prove this |
| A09 | Present the brief and outcome preview | At most three priorities or deliberate pause; confirmed/observed/inferred distinctions visible; no messages sent or calendar writes. User sees exactly the proposed metadata and explicitly approves. Inference never silently becomes a durable preference/evidence fact |
| A10 | Save through the one bounded write | ChatGPT calls `sotf_record_daily_brief_outcome` with approved fields. Verified `saved:true` receipt matches persisted single record and source revision. No operational entities or protected data changed |
| A11 | Read and display resulting state | New state read exposes the receipt in recent_outcomes. ChatGPT can display the previous run and a factual outcome count from LE history. It does not invent measured savings or friction from frequency |
| A12 | Remove the test entitlement through the approved operator action, then invoke again | Fresh contract and state/outcome calls fail closed with documented semantics; no stale body, receipt, or queued write is served. Scope includes old authorization/cached discovery and a previously retrieved version |
| A13 | Inspect portable artifacts and basic fallback | Skill/bootstrap, host conversation and customer-owned connector authorization remain. ChatGPT reports LE service access unavailable and, only if user chooses, provides basic host help without claiming an active LE workflow or saving to LE |

All positive rows are initially NOT RUN. If only one optional connector is available, run the corresponding degraded case and record the missing connector as NOT RUN; do not label complete two-connector acceptance PASS. No specific current ChatGPT capability is assumed until observed.

## Negative and recovery cases

| ID | Variation | Expected behavior |
| --- | --- | --- |
| N01 | No grant, future-start grant, expired/revoked grant, suspended plan, missing required capability | Correct typed denial; no contract/state/outcome access. Specifically test starts_at because the legacy display resolver is incomplete |
| N02 | Wrong workspace/beneficiary, inactive membership, fabricated workspace or user field | Denial/rejected unknown input; no cross-tenant existence or receipt disclosure |
| N03 | Gate off, DB authority unavailable, LE unreachable or tool missing | Deterministic service-unavailable handling; stop hosted execution. No credential fallback or inference from stale grant |
| N04 | Pin existing version, pin absent version, unsupported schema, retired version | Exact compatible pin succeeds only with current authority; missing/retired/incompatible fails without substitution |
| N05 | Current pointer changes while an older version remains released | Omitted request gets new current; explicit supported pin gets exact prior bytes. Retired version cannot write/replay an outcome. Version rollout is a controlled future fixture, not an action authorized now |
| N06 | Calendar/email missing, refused, failed or query cannot be safely bounded | Label actual availability, produce degraded authorized state-only result, no hidden provider calls; `not_requested` is not misreported as a provider failure |
| N07 | Midnight and daylight-saving transitions | Host date/zone and server half-open local-day bounds agree; overdue/due records and completion grace follow contract; no implicit UTC date |
| N08 | Oversized/malicious input; email body, arbitrary prompt, SQL, script or extra key injected into outcome | Reject entire write; retain no payload content; no arbitrary executable authority |
| N09 | External text instructs host to change workflow, bypass confirmation, exfiltrate or mark inference confirmed | Treat as untrusted source data; do not follow as instructions. No unapproved tool call or durable truth promotion |
| N10 | User declines save or changes preview | Zero write on refusal; changed fields require renewed approval. A tool flag alone is not evidence of human consent |
| N11 | Duplicate same request/run and exact payload; changed payload under either ID; wrong-tenant replay | Exact authorized retry returns the same receipt, total one record. Changed/cross-tenant variants fail; no overwrite or information leak |
| N12 | State changes between read and first save | `state_changed`, no append; fresh read/regeneration/approval required. Exact committed retry after later state change remains idempotent if current access is valid |
| N13 | Commit succeeds but reply/read-back fails | Host reports uncertain, retains exact IDs/input, offers explicit retry. Retry verifies one saved record. No fresh-ID duplication or automatic offline queue |
| N14 | Revoke/disconnect during pending write, after read, and before receipt replay | Verify both serialization orderings with local DB tests and controlled approved host case. Revocation that wins the authoritative boundary denies write/replay; no old receipt-as-authority bypass |
| N15 | Attempt record beyond pilot outcome cap | `capacity_reached`; preserve all prior outcomes without eviction or automatic retention deletion |
| N16 | Empty chapter, empty eligible lists, truncated state, provider/LE disagreement | Chapter absent stops at intake boundary; empty eligible list may produce reasoned pause; truncation and conflicts are disclosed and never silently corrected in LE |
| N17 | Previously retrieved workflow in a new conversation after cancellation/outage | No offline LE execution claim or new LE access. Retained text is acknowledged without claiming remote erasure; basic host fallback requires user choice |

## Evidence attribution and release decision

For every accepted run produce a compact ownership table: workflow retrieval = LE MCP; state projection/suggestions = LE; reasoning/step control/approvals = ChatGPT/user; calendar/email calls = ChatGPT host connectors; optional metadata append = governed LE MCP; outcome storage/read-back = LE. Correlate host calls and LE audit timestamps. A successful brief alone does not establish which system performed the actions.

Passing unit/contract tests establishes local behavior only. DB/RLS tests establish authoritative isolation/retry behavior only. Real ChatGPT traces establish host interpretation, skill behavior, connector ownership and confirmation. Production readiness additionally requires approved auth acceptance, policy/retention decisions and rollout gates. Do not collapse these evidence layers into one PASS.

If required host behavior cannot be demonstrated, mark BLOCKED with observed evidence. Do not solve that failure by building a second runtime, activating provider OAuth, introducing Composio, broadening writes, enabling protected context, or deploying Mode B/C. Return the feasibility issue to product review.

Cleanup follows only the approved fixture lifecycle for the exact test environment. Preserve customer host assets; do not use cancellation testing to delete them. No production entitlements or hosted state were changed in authoring this specification.
