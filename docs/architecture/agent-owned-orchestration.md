# Agent-Owned Orchestration Architecture

**Status:** Canonical architecture decision for the consumer/individual Lead Emergence product

**Decision date:** 2026-09-11

**Amended:** 2026-09-11 — portable skills and subscription-backed hosted workflows

## Purpose

Lead Emergence is not intended to replace the user's primary AI environment or duplicate every external integration available there. The default consumer architecture is **agent-owned orchestration**:

- The user's chosen AI environment (initially ChatGPT, with other supported agents where practical) is the primary conversational and orchestration surface.
- Lead Emergence bundles configure that environment with portable skills, host bootstrap/configuration, capability requirements, Lead Emergence MCP setup, and references to subscription-backed hosted workflows.
- External provider accounts such as Gmail, Google Calendar, Google Drive, Slack, GitHub, and similar services should be connected to the user's AI environment whenever the host supports them.
- The Lead Emergence MCP provides secure access to Lead Emergence-owned context, state, synthesis inputs, and durable signals.
- Lead Emergence directly owns a third-party provider credential only when a documented product requirement cannot be satisfied through the host agent or when Lead Emergence must execute independently of the user's active agent session.

This document establishes that boundary so future implementation does not accidentally turn Lead Emergence into a general-purpose integration broker.

---

## Product thesis

The customer should be able to work primarily from the AI interface they already use.

Lead Emergence should make that agent substantially more useful by providing:

1. durable, structured context;
2. persistent operating state;
3. repeatable skills and workflows;
4. cross-workflow synthesis inputs;
5. longitudinal signals and optimization;
6. a secure MCP bridge into Lead Emergence-owned data and actions; and
7. an optional web control/display surface.

The differentiated product is not a collection of OAuth adapters. The differentiated product is the persistent intelligence and operating environment surrounding the user's agent.

A concise product boundary is:

> **The host owns the tools and performs the work. Lead Emergence owns the durable operating method, state, history, and improvement loop.**

---

## Canonical architecture

```text
CHATGPT / CUSTOMER AI HOST
├─ reasoning
├─ customer-owned external connectors/apps
├─ Gmail / Calendar / Drive / Slack / etc.
├─ portable Lead Emergence skills
└─ workflow execution
          │
          │ Lead Emergence MCP
          ▼
LEAD EMERGENCE
├─ hosted workflow library
├─ workflow versions
├─ workflow contracts
├─ durable context
├─ operational state
├─ Context Graph
├─ longitudinal signals
├─ Continuous Optimization
├─ workflow outcome history
└─ approved write-back policy
```

The host retrieves authorized workflow definitions, combines them with separately retrieved Lead Emergence durable state and host-accessible external information, and performs the work using only capabilities already available and authorized in that host.

**The host agent runs the workflow. Lead Emergence does not become a second agent runtime.** The host owns user interaction, reasoning, execution of workflow steps, human approval interactions, portable skill behavior, and host-native scheduling where supported. Lead Emergence may calculate bounded product-specific synthesis from its own state; that does not authorize it to run an agent loop, call host tools, or execute the hosted procedure on the host's behalf.

### Responsibility split

| Concern | Default owner |
| --- | --- |
| Conversation and general reasoning | User's AI environment |
| External app authentication | User's AI environment / provider |
| External app retrieval and supported actions | User's AI environment |
| Bundle installation/configuration | Lead Emergence bundle |
| Portable skills and intentionally delivered methodology | Lead Emergence bundle, installed and executed in the host |
| Hosted workflow library, versions, and contracts | Lead Emergence, retrieved through the Lead Emergence MCP and executed by the host |
| Workflow execution | User's AI environment, except an approved mode C workflow |
| Specialized agent roles | Lead Emergence bundle, executed where the host supports them |
| Lead Emergence identity and entitlement | Lead Emergence |
| Persistent structured context | Lead Emergence |
| Context Graph | Lead Emergence |
| Tasks, opportunities, decisions, priorities, workflow state | Lead Emergence |
| Cross-workflow synthesis inputs and durable signals | Lead Emergence |
| Continuous optimization | Lead Emergence |
| Secure access to LE state/actions | Lead Emergence MCP |
| Human-readable control/display surface | Lead Emergence web application |

### Portable skills and hosted workflows

The architecture distinguishes **portable skills** from **subscription-backed hosted workflows**.

A **portable skill** is reusable knowledge, methodology, or behavior intentionally installed into the customer's AI environment. Examples include:

- the STAR interview method;
- the TIARA networking method;
- an assumption-challenging method;
- editing or style guidance; and
- a general decision framework.

Subject to host-platform rules, portable skills may remain with the customer after Lead Emergence subscription access ends. A portable skill should not contain subscription-critical state or require Lead Emergence merely to exist.

A **hosted workflow** is a versioned Lead Emergence operating procedure that coordinates:

- portable skills;
- host capabilities;
- Lead Emergence MCP capabilities;
- workflow steps;
- allowed durable writes;
- ephemeral data handling;
- degradation behavior; and
- completion and outcome reporting.

Illustrative hosted workflow identifiers include:

```text
transition.daily_brief
transition.weekly_review
networking.prepare
networking.follow_up
interview.prepare
interview.practice
opportunity.review
```

Hosted workflows remain subscription-backed Lead Emergence assets. The host retrieves them at execution time through an authenticated, entitlement- and capability-scoped Lead Emergence MCP read surface.

A Lead Emergence hosted workflow is a **declarative, versioned execution contract**. It is not arbitrary JavaScript, arbitrary Python, shell execution, remotely supplied executable code, unrestricted prompt injection, or a generic tool proxy. The host interprets the contract and invokes only capabilities already available and authorized in that host. A workflow's reference to Gmail, Calendar, Drive, Slack, or another host capability does not grant Lead Emergence access to that provider.

---

## Launch host policy

The architecture is intentionally host-neutral, but the initial consumer launch is **not** a multi-host certification effort.

### Initial certified host

**ChatGPT is the initial supported orchestration host for consumer launch acceptance.**

Other AI environments may remain architecture-compatible and may be explored in parallel, but they are not to be advertised as supported launch hosts until they have their own reviewed capability and acceptance matrix.

A new host must demonstrate, at minimum:

- bundle installation/configuration compatibility;
- required skill or instruction behavior;
- Lead Emergence MCP connectivity;
- required external app/connector behavior;
- supported read/write semantics;
- confirmation behavior for consequential actions;
- graceful degradation behavior;
- subscription-off behavior; and
- end-to-end acceptance for each workflow advertised on that host.

Host-specific differences should be isolated in compatibility/configuration surfaces rather than changing the core Lead Emergence state model.

The consumer launch rule is therefore:

> **Architect for multiple hosts; certify one host at a time. ChatGPT is the initial certified host.**

---

## Bundle contract

A bundle is primarily an **installation, bootstrap, and configuration package for the customer's AI environment**, not a monolithic server-side application and not a permanent installation of every complete operational workflow.

A bundle may contain or declare:

- portable skills and supporting resources;
- host bootstrap and configuration;
- specialized agent roles where the host supports them;
- required and optional host capabilities and connectors/apps;
- Lead Emergence MCP connection requirements;
- setup instructions and capability checks;
- hosted workflow catalog metadata and workflow references/identifiers;
- required Lead Emergence entitlements;
- graceful-degradation and subscription-inactive behavior; and
- compatibility information.

Therefore:

```text
bundle installation
!=
permanent installation of every Lead Emergence workflow
```

The customer installs the operating interface and portable methods. Subscription-backed workflows remain in the Lead Emergence hosted workflow library and are retrieved when needed. The bundle should configure the host to combine its own connected apps with Lead Emergence MCP workflows and durable state rather than routing all external data through Lead Emergence.

### Machine-readable bundle manifest

The bundle contract should be represented in a machine-readable manifest rather than existing only as prose or installation instructions.

At minimum, the manifest should declare the architectural equivalents of:

```text
bundle identity and version
supported host(s)
required host capabilities
optional host capabilities
required external host apps/connectors
required Lead Emergence MCP capabilities
required Lead Emergence entitlements
portable skill declarations
host bootstrap/configuration requirements
hosted workflow catalog metadata and references
graceful-degradation behavior
subscription-inactive behavior
compatibility constraints
```

Exact schema names may evolve, but the manifest must make the bundle's operational assumptions inspectable and testable.

The installer/onboarding path should be able to evaluate:

```text
bundle requirements
+ host capabilities
+ available host apps/connectors
+ Lead Emergence entitlements
+ Lead Emergence MCP capabilities
= supported / degraded / unsupported
```

No bundle or referenced workflow should silently assume a host feature, connector, MCP capability, or entitlement that its inspectable contracts do not declare.

### Hosted workflow retrieval contract

The architecture should support a future read-only operation conceptually equivalent to:

```text
get_workflow("transition.daily_brief")
```

The exact operation name and schema are not fixed by this decision. The architectural contract is that workflow retrieval must be:

- authenticated;
- tenant/workspace bound;
- entitlement scoped;
- capability scoped;
- read-only;
- version aware; and
- auditable.

Retrieving a workflow must not itself mutate user state. Durable mutations occur only through separately reviewed Lead Emergence MCP tools governed by formal write-back contracts.

Content-free access auditing and existing authentication/connection bookkeeping are security control-plane effects, not workflow execution or user-state write-back. Retrieval must not create workflow runs, consume workflow steps, update context, or record completion. Audit records are evidence of access, never permission to reuse an old entitlement.

A hosted workflow definition should be capable of declaring the architectural equivalents of:

```text
workflow identity and version
bundle identity
supported hosts
execution mode
required host capabilities
optional host capabilities
required Lead Emergence MCP capabilities
referenced portable skills
workflow steps
allowed durable writes
ephemeral data classes
completion and outcome contract
degradation behavior
compatibility constraints
```

Exact schema and field names may evolve. The definition must remain declarative, inspectable, versionable, and bounded to reviewed host and Lead Emergence capabilities.

The preferred launch model is:

```text
stable versioned hosted workflow
+ separately retrieved Lead Emergence durable state
+ host-accessible external information
= personalized execution in ChatGPT
```

For example:

```text
hosted interview.prepare workflow
+ Lead Emergence career pipeline
+ Lead Emergence coaching context
+ the user's ChatGPT-connected calendar/email where useful
= personalized interview preparation
```

Server-generated arbitrary personalized prompts are not a launch dependency. Future adaptive workflow composition may be considered through a separate decision, but launch should preserve stable workflow versioning, auditability, and the clean host/Lead Emergence security boundary.

### Example: daily transition brief

Preferred flow:

```text
ChatGPT Calendar app ----+
                         |
ChatGPT Gmail app -------+--> ChatGPT synthesis --> brief
                         |
Lead Emergence MCP ------+
      priorities
      tasks
      career pipeline
      coaching context
      durable signals
```

Avoid this by default:

```text
ChatGPT --> Lead Emergence --> Gmail
                         \--> Calendar
                         \--> Slack
```

The second model is permitted only under the documented exception criteria below.

---

## Lead Emergence MCP role

The MCP is not a generic proxy for every service the user can access. It is the secure boundary around Lead Emergence-owned intelligence and state.

It should expose reviewed, capability-scoped tools for data such as:

- authorized hosted workflow discovery and read-only versioned retrieval;
- onboarding and workspace configuration;
- confirmed professional/personal context permitted by policy;
- tasks and leadership state;
- quick captures and resolved signals;
- career opportunities and pipeline state;
- goals, priorities, decisions, and workflow state;
- Context Graph entities and relationships;
- bundle entitlements and installed capability state;
- optimization observations and recommendations;
- approved Lead Emergence-native actions.

The MCP should preserve the existing principles of tenant isolation, narrow action contracts, explicit confirmation for consequential writes, idempotency, and auditable changes.

Hosted workflow retrieval and durable state mutation are separate contracts. Reading an authorized workflow definition does not authorize a write. Each durable mutation must pass through its separately reviewed MCP tool and write-back contract.

The MCP may report onboarding/capabilities, expose entitled bundle and workflow metadata, retrieve contracts and bounded state, accept governed outcomes, and expose synthesis/signals. It must not evolve into a duplicate agent runtime, generic job executor, provider orchestration service, host-connector proxy, or arbitrary remote-code execution layer. Workflow steps, decision rules, approval gates, success criteria, and stop conditions are declarative instructions for the host, never downloadable executable programs.

It should **not** receive broad external-provider credentials merely because an external provider appears in the Lead Emergence catalog.

---

## Execution modes

Every workflow should be classified into one of three execution modes before implementation. The execution mode determines whether Lead Emergence needs direct provider custody or can rely on the user's AI host.

The location of a workflow definition does not determine its execution mode. Hosting a declarative workflow in Lead Emergence does **not** make the workflow mode C.

For example:

```text
Lead Emergence hosts transition.daily_brief definition
→ ChatGPT retrieves it
→ ChatGPT executes it with host tools and Lead Emergence MCP data
= mode A
```

If ChatGPT itself schedules that execution through a supported host-owned mechanism, it is mode B. It becomes mode C only when Lead Emergence independently executes the workflow.

### A. User-session orchestration

The user's AI host runs the workflow while the user is actively interacting with the host.

Typical shape:

```text
user
→ AI host
→ host apps/connectors + Lead Emergence MCP
→ result
```

This is the default consumer mode.

### B. Host-owned scheduled/background execution

The AI host provides a supported scheduled, event-driven, or background mechanism and continues to own external-provider connectivity.

Typical shape:

```text
host scheduler/background runtime
→ host apps/connectors + Lead Emergence MCP
→ result
```

A scheduled workflow does **not** by itself justify Lead Emergence-owned provider credentials when the host can execute it reliably.

### C. Lead Emergence-native background execution

Lead Emergence runs the workflow independently of an active user or host-agent session.

Typical shape:

```text
Lead Emergence scheduler/event runtime
→ approved direct integration(s)
→ Lead Emergence state/action
```

This mode requires an approved direct-integration exception whenever external provider access is necessary.

Before building provider custody, the workflow must explicitly state why execution mode A or B cannot satisfy the product requirement.

---

## External provider policy

### Default rule

If the user's AI host already provides a secure connection to an external service and can perform the workflow, use that host connection.

Lead Emergence should not duplicate the connection.

A hosted workflow may declare that a host capability is required or optional. That declaration does not authorize Lead Emergence to acquire the corresponding provider credential, proxy the provider, mirror its data, or assume its execution responsibility.

The default remains:

```text
Gmail credential    → ChatGPT/customer AI host
Calendar credential → ChatGPT/customer AI host
Drive credential    → ChatGPT/customer AI host
Slack credential    → ChatGPT/customer AI host
```

not:

```text
Gmail credential → Lead Emergence
```

unless a separately reviewed direct-integration exception applies.

### Direct integration exception

A Lead Emergence-owned provider connection may be justified only when at least one of these is true:

1. **Independent execution:** Lead Emergence must run while no user AI session is active.
2. **Event/webhook execution:** a provider event must trigger a Lead Emergence server-side workflow.
3. **Unsupported host capability:** the user's host cannot access the required provider or action.
4. **Cross-host portability:** a server-side connection is required to provide an explicitly promised workflow consistently across supported agent hosts.
5. **Durable ingestion:** Lead Emergence must ingest provider data independently to maintain a contracted persistent record that cannot depend on an active host session.
6. **Enterprise requirement:** a customer requires centrally managed provider connectivity as part of an approved organizational deployment.

Every exception must document:

- why the host connection is insufficient;
- the minimum provider scopes required;
- tenant-isolation requirements;
- token custody and revocation behavior;
- allowed actions;
- confirmation requirements;
- idempotency and retry behavior;
- audit requirements;
- failure/recovery behavior; and
- acceptance tests.

### Composio and similar integration infrastructure

Composio or another integration broker may be evaluated for approved direct-integration exceptions. It is **not a launch dependency and not part of the default consumer data path**.

If used, Lead Emergence policy and capability checks remain authoritative. A broker must not bypass Lewis/Lead Emergence authorization or expose an unrestricted provider tool surface directly to the client agent when that would circumvent Lead Emergence policy.

---

## Existing provider code and launch scope

Existing provider catalog, release gates, schemas, and UI work are not to be deleted merely because the default architecture changed.

They provide useful future infrastructure for approved direct integrations and preserve an honest representation of planned capabilities.

However:

- providers currently marked `consumerConnectionReady: false` should remain unreleased unless a specific approved requirement satisfies the direct-integration exception;
- provider-specific OAuth adapters, refresh workers, remote-revocation implementations, and external action adapters are **not launch requirements by default**;
- no Codex task should turn an unreleased provider into a production dependency solely because that provider appears in the catalog;
- ChatGPT/Claude/other agent-host connection work should remain separate from third-party provider ownership; and
- the hosted workflow library must not be used to reopen generic provider integration scope.

This is a scope reduction, not a request for a broad destructive refactor.

---

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

## Implementation rule for Codex and future agents

Before implementing any new integration, workflow, connector, or automation, first classify the proposed capability as one of:

1. part of the customer's host/tool environment;
2. a portable skill;
3. a Lead Emergence hosted workflow; or
4. Lead Emergence durable intelligence/state.

Then ask whether it is being placed in the correct layer and answer these questions in order:

1. Can the user's AI host already perform this external action using the user's own app/connector?
2. If yes, can a portable skill or hosted workflow instruct the host to combine that result with Lead Emergence MCP data?
3. If yes, implement the workflow at the host layer and **do not build a duplicate Lead Emergence provider integration**.
4. Would the proposal require Lead Emergence to own a credential, execution responsibility, or dataset that the customer's host already owns?
5. If yes, does the requirement satisfy a direct-integration exception above?
6. If no exception applies, reject the provider work from launch scope.
7. If an exception applies, write and approve a provider-specific architecture/security note before implementation.

Additionally, before implementation:

- classify the workflow as execution mode A, B, or C;
- declare bundle/bootstrap requirements in the machine-readable bundle manifest;
- declare hosted-workflow requirements in its versioned workflow contract; and
- define its write-back contract before allowing durable Lead Emergence persistence.

No provider should become `consumerConnectionReady: true` solely to make a bundle easier to implement.

### Anti-drift rule

Architectural possibility is not implementation authorization. Do not infer an implementation requirement merely because a future capability is described or technically possible. A future capability is not a launch dependency unless this canonical architecture and a concrete accepted workflow require it.

Without another reviewed decision and, where applicable, an approved direct-integration exception, this document does not authorize:

- generic provider OAuth;
- universal provider proxying;
- Composio adoption;
- universal background automation;
- Claude certification;
- a universal Context Graph;
- arbitrary remote workflow code;
- provider data mirroring;
- transcript mirroring; or
- generalized ingestion pipelines.

Hosted workflow retrieval is not authorization for any item in this list.

---

## Immediate implementation posture

Until explicitly changed by a reviewed architecture decision:

### Continue

- Lead Emergence MCP hardening and acceptance;
- tenant-safe identity and authorization;
- workflow-required durable context and Context Graph capabilities without making a universal graph a launch dependency;
- portable skill/bootstrap bundles and machine-readable bundle manifests;
- hosted workflow library contracts, versioning, catalog references, and read-only retrieval;
- portable skills and declarative hosted workflow definitions;
- host capability checks;
- ChatGPT launch-host acceptance;
- workflow execution-mode classification;
- formal write-back contracts;
- persistent operational state;
- synthesis/signal interfaces;
- workflow outcome contracts and bounded Continuous Optimization interfaces;
- subscription/entitlement boundaries;
- cancellation/data-lifecycle behavior;
- dashboard/control-plane improvements;
- graceful degradation and cancellation behavior.

### Freeze as launch dependencies

- LE-owned Gmail OAuth;
- LE-owned Google Calendar OAuth;
- LE-owned Google Drive OAuth;
- LE-owned Slack OAuth;
- LE-owned Notion/provider OAuth;
- LE-owned GitHub provider execution;
- generic provider token-refresh workers;
- generic external-provider action adapters;
- Composio or equivalent integration-broker adoption;
- multi-host consumer certification beyond ChatGPT;
- arbitrary remote workflow code;
- provider or transcript mirroring; and
- generalized provider ingestion pipelines.

Dormant provider work may resume only for an explicitly approved use case that demonstrates why host execution is insufficient, justifies the added security/operational burden, and meets the direct-integration exception policy. Other host certification requires separate approval and its own acceptance matrix. Arbitrary remote code and data mirroring are not enabled by a provider exception; changing those boundaries requires a new canonical decision.

The lists above describe architectural direction and scope boundaries. They do not authorize an implementation task, make every listed future capability a launch dependency, or override the requirement for a concrete accepted workflow and separately approved implementation scope.

### Conformance-audit reconciliation and initial SOTF bundle

The conformance finding that no installable ChatGPT bundle currently exists remains valid, but the required launch artifact is now understood as:

```text
portable skill/bootstrap package
+ host capability declarations
+ Lead Emergence MCP setup
+ hosted workflow catalog metadata and references
```

It is not a package that permanently installs every complete Lead Emergence workflow into ChatGPT.

Accordingly, a first SOTF/transition bundle should install only the portable methods, bootstrap/configuration, host capability declarations, and Lead Emergence MCP connection material intentionally delivered to the customer. It should reference entitled hosted workflow identifiers such as `transition.daily_brief` or `transition.weekly_review`. ChatGPT should retrieve the authorized current workflow definition when the workflow is invoked, then combine it with separately retrieved Lead Emergence state and host-accessible information.

This refinement does not change the conformance conclusions that formal write-back contracts and real ChatGPT acceptance remain required, provider infrastructure should remain dormant, cancellation and degradation must become testable, and neither a universal Context Graph nor generic background automation is a launch dependency.

### Decisions deliberately left open

This architecture does not prematurely choose:

- exact manifest, workflow-schema, catalog, or MCP operation names;
- workflow version-selection, pinning, migration, rollback, or cache semantics;
- the precise inactive-subscription response and host user experience when retrieval is denied;
- the host-platform packaging and retention mechanics for portable skills;
- workflow outcome granularity, review/confirmation thresholds, or privacy classifications;
- durable-data retention periods, export guarantees, deletion timing, or resubscription restoration windows; or
- any mode B or C workflow that has not been separately accepted.

These require product, security, and workflow-specific decisions before implementation. Their architectural possibility must not be treated as launch authorization.

The [SOTF v1 contract specification](sotf-v1-contracts.md) now resolves the minimum identifiers, version selection, retrieval, bounded state/outcome, and degradation behavior for `transition.daily_brief` only. The [canonical review](sotf-v1-canonical-review.md) records source reconciliation, and the [real ChatGPT acceptance specification](../testing/sotf-v1-chatgpt-acceptance.md) defines the required evidence. These documents authorize no application, provider, entitlement, or hosted-state changes in this review pass.

---

## Launch acceptance criteria

The individual consumer launch architecture is acceptable when a test user can:

1. install/configure an eligible portable skill/bootstrap bundle in **ChatGPT**, the initial certified consumer host;
2. have that bundle's machine-readable manifest validate the required host, connector, entitlement, MCP, hosted-workflow references, degradation, and persistence assumptions;
3. connect the Lead Emergence MCP securely;
4. use ChatGPT's own external apps/connectors required by that bundle;
5. discover and retrieve an entitled, compatible, versioned hosted workflow through a read-only Lead Emergence MCP contract;
6. execute that workflow by combining host-connected external information with separately retrieved Lead Emergence state;
7. persist only write-back-contract-approved durable state back to Lead Emergence;
8. record an approved structured completion/outcome without requiring provider-content ingestion;
9. receive useful synthesis/signals that depend on historical Lead Emergence context;
10. disconnect/reconnect the Lead Emergence MCP safely;
11. experience predictable inactive-subscription behavior in which retained portable skills remain usable but hosted workflow and durable-intelligence access is unavailable;
12. observe documented cancellation behavior for portable/customer-owned assets, subscription-backed services, and Lead Emergence durable data; and
13. do all of the above without Lead Emergence taking custody of unnecessary third-party credentials.

Additional AI hosts require their own reviewed capability and acceptance matrix before they are included in consumer launch claims.

---

## Non-goals for the initial consumer launch

The initial Lead Emergence consumer launch is not required to be:

- a universal OAuth broker;
- a replacement for ChatGPT/Claude app ecosystems;
- a full email/calendar/document client;
- an independent automation server for every workflow;
- a mirrored datastore for external providers;
- a universal cross-agent execution fabric;
- a simultaneously certified multi-host product;
- a universal Context Graph;
- a generic background automation platform;
- an arbitrary remote-code workflow runtime;
- a server-generated arbitrary personalized-prompt service;
- a provider or transcript mirror; or
- a generalized ingestion pipeline.

Future capabilities require separately accepted product scope and all applicable architecture/security decisions. The existence of a potential customer outcome does not itself authorize any item above.

---

## Architectural test

When evaluating a proposed feature, ask:

> **Is this capability part of the customer's host/tool environment, a portable skill, a Lead Emergence hosted workflow, or Lead Emergence durable intelligence/state? Are we putting it in the correct layer?**

Then ask:

> **Does this implementation require Lead Emergence to own a credential, execution responsibility, or dataset that the customer's host already owns?**

If the answer is yes, do not add it to the Lead Emergence core without an explicit, reviewed exception.
