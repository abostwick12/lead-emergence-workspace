# Orchestration data and security

## Subscription and customer ownership

The architecture should intentionally distinguish between **portable skills and customer-owned host assets** and **subscription-backed Lead Emergence hosted workflows, services, and durable intelligence**.

### Customer-owned after installation

Subject to the host platform's own rules and availability, a customer may retain installed/configured assets that were placed in their AI environment, including:

- portable skills;
- intentionally delivered methodology and guidance;
- portable agent-role definitions where intentionally delivered;
- the customer's own app/connector authorizations;
- the customer's conversations;
- customer-owned exported artifacts; and
- other portable bundle assets intentionally delivered to the customer.

Portable assets should not contain subscription-critical state or silently embed the complete current hosted workflow library. Lead Emergence should not depend on artificial destruction of customer assets to create retention.

Subscription value comes from the continuously maintained operating environment: current hosted workflows, durable context and history, workflow improvements, optimization, and supported Lead Emergence services.

### Subscription-backed capability

An active Lead Emergence subscription may provide:

- Lead Emergence MCP access;
- the hosted workflow library;
- current workflow versions, contracts, and updates;
- persistent structured context;
- Context Graph storage and retrieval;
- durable task/opportunity/decision/workflow state;
- workflow outcome history;
- cross-workflow synthesis inputs;
- longitudinal signal detection;
- continuous optimization;
- bundle updates and new capabilities;
- Lead Emergence-native/background automation;
- dashboard/control-plane access;
- support and premium service entitlements.

### Graceful degradation

Bundles should degrade gracefully when the Lead Emergence subscription is inactive.

Example:

```text
Active subscription:
ChatGPT tools/connectors
+ portable skills
+ Lead Emergence hosted workflows
+ Lead Emergence durable context and history
+ Lead Emergence optimization
→ full Lead Emergence experience

Inactive subscription:
ChatGPT tools/connectors
+ retained portable skills
→ basic host-directed use

No active access to:
hosted Lead Emergence workflow library
current workflow versions or updates
Lead Emergence durable intelligence
Lead Emergence Context Graph
Lead Emergence optimization
Lead Emergence-native services
```

The user keeps portable methodology, their conversations and exported artifacts, and their own host connections subject to host-platform behavior. Lead Emergence disables or degrades access to subscription-backed workflow definitions, durable intelligence, and services according to entitlement state. Lead Emergence does not revoke customer-owned host/provider connections.

Every invocation must obtain current authorized workflow/state access. If authorization is denied or Lead Emergence cannot be reached, stop the hosted workflow and explain that its LE services are unavailable. The user may explicitly choose basic host-directed work with retained portable methods; do not label that work as an active LE workflow, assume stale entitlement, or queue its results for automatic later write-back. Previously retrieved text may remain in host conversations; this architecture neither promises remote erasure nor treats possession of that text as continuing service authorization.

### Cancellation and data lifecycle

Cancellation must distinguish three separate things:

1. **Portable installed assets and customer-owned host assets** in the customer's AI environment.
2. **Subscription-backed Lead Emergence services and assets** such as MCP access, the hosted workflow library, current workflow versions, optimization, background/native execution, updates, and control-plane features.
3. **Customer Lead Emergence durable data** such as Context Graph records, tasks, decisions, opportunities, workflow state, and historical signals.

The cancellation contract should require explicit product behavior for each category.

At minimum:

- installed portable assets intentionally delivered to the customer are not remotely destroyed merely because a subscription ends;
- subscription-backed Lead Emergence workflow retrieval, services, and updates are disabled or degraded according to entitlement state;
- the user's own host/provider connections remain governed by those hosts/providers;
- Lead Emergence durable data must follow a documented retention/deletion policy;
- resubscription behavior must define whether eligible retained state is restored and under what conditions;
- customers must have a documented path for export where product policy promises exportability;
- explicit account/data deletion must remain distinct from ordinary subscription cancellation; and
- bundle manifests must define predictable subscription-inactive behavior.

This architecture decision does **not** invent a retention duration. Data retention, deletion timing, export guarantees, and resubscription behavior remain a separate product-policy requirement. They must be explicitly defined and published before consumer launch rather than inferred from implementation defaults or conflated with subscription access to hosted workflows.

---

## Data ownership and persistence

A bundle should explicitly classify outputs into three categories:

### 1. Ephemeral host context

Information needed only for the current task should remain in the host conversation when persistence adds no value.

### 2. Customer-owned external data

Provider data accessed through host apps should remain governed by the host/provider connection unless a Lead Emergence persistence requirement has been explicitly approved.

### 3. Lead Emergence durable state

Only information that creates ongoing user value should be intentionally written to Lead Emergence, such as:

- confirmed goals and priorities;
- important decisions;
- approved professional context;
- workflow outcomes;
- task and opportunity state;
- provenance-aware Context Graph relationships;
- meaningful longitudinal signals;
- optimization measurements and recommendations.

Do not mirror entire inboxes, drives, Slack histories, or provider datasets into Lead Emergence merely because they are available to the host agent.

### Formal write-back contract

Every workflow that may persist information to Lead Emergence must declare a write-back contract in its bundle/workflow definition.

The contract should identify the architectural equivalents of:

```text
source workflow
source/host provenance
input data classification
ephemeral-only fields
allowed durable output type(s)
allowed Lead Emergence destination(s)
required user confirmation or review
privacy scope
provenance requirements
idempotency/deduplication identity
retention classification
failure/degradation behavior
```

The preferred flow is:

```text
external provider data via host
→ host reasoning/workflow
→ minimal approved durable result
→ Lead Emergence MCP write
```

not:

```text
external provider dataset
→ wholesale copy into Lead Emergence
```

Illustrative classification:

| Information | Default persistence posture |
| --- | --- |
| Full email body used for one workflow | Ephemeral host context |
| Full calendar payload used for one brief | Ephemeral unless a durable requirement is approved |
| Confirmed interview date relevant to career workflow | Eligible durable state |
| Confirmed priority or decision | Eligible durable state |
| Workflow completion/outcome signal | Eligible durable structured signal |
| Longitudinal optimization measurement | Eligible durable derived state with provenance |
| Entire inbox, drive, or Slack history | Not a default Lead Emergence persistence target |

Persistence must be intentional, provenance-aware, and bounded to the durable value being created.

AI inference is not canonical truth. It remains labeled inference or a review candidate until a separately authorized, bounded operation with appropriate provenance and explicit review permits a defined promotion. A confirmation flag is an assertion of an actual user interaction, not permission for an agent to fabricate approval. Workflow completion cannot silently change criteria, preferences, evidence status, or protected context.

### Workflow outcomes and the optimization flywheel

Hosted workflows should define a completion/outcome contract for approved structured results and operational metadata. The optimization path is:

```text
hosted workflow
      ↓
ChatGPT executes with host tools
      ↓
approved structured outcome
      ↓
Lead Emergence durable state
      ↓
Continuous Optimization
      ↓
patterns / friction / opportunity / measured results
      ↓
future workflow improvement
```

The governing rule is **metadata over content surveillance**. Workflow outcome contracts should prefer structured completion state, approved durable results, measured outcomes, user corrections, degradation reasons, and provenance over raw emails, prompts, Slack content, transcripts, calendar payloads, or other provider data.

Lead Emergence does not need to ingest the underlying provider data merely to optimize a workflow. Continuous Optimization should consume the minimum approved, provenance-aware outcome and operational signals required to improve future workflow versions.

---

## Capability and host-compatibility rule

Host capabilities vary by product, plan, workspace policy, region, and release state. Architecture must not silently assume that every user receives the same skill, plugin, connector, custom MCP, or write capability.

Therefore:

- bundle manifests must declare required and optional capabilities;
- onboarding must detect or ask for missing required capabilities;
- workflows must define fallback behavior where practical;
- launch claims must be backed by real acceptance tests on each supported host/plan combination;
- a working acceptance path is authoritative over an outdated generalized assumption;
- changes in host-platform availability should be isolated to compatibility/configuration code rather than forcing a redesign of Lead Emergence core state.

For initial consumer launch, these requirements are certified against ChatGPT first. Other hosts require separate acceptance before being represented as supported.

The product should preserve the architecture even as individual host capabilities evolve.

---

## Security boundary

The agent-owned orchestration model reduces credential custody but does not remove Lead Emergence security requirements.

Lead Emergence remains responsible for:

- correct user/workspace binding;
- MCP authentication and authorization;
- tenant isolation;
- capability/entitlement enforcement;
- confirmation for consequential LE writes;
- idempotency;
- provenance for durable context;
- privacy-scope enforcement;
- safe disconnect/revocation of Lead Emergence access;
- auditability and incident response for Lead Emergence-owned actions.

The host/provider remains responsible for the user's separate external account authorization unless an approved direct-integration exception transfers that responsibility to Lead Emergence or an integration broker.

---
