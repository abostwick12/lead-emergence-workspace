# Agent-Owned Orchestration Architecture

**Status:** Canonical architecture decision for the consumer/individual Lead Emergence product

**Decision date:** 2026-09-11

## Purpose

Lead Emergence is not intended to replace the user's primary AI environment or duplicate every external integration available there. The default consumer architecture is **agent-owned orchestration**:

- The user's chosen AI environment (initially ChatGPT, with other supported agents where practical) is the primary conversational and orchestration surface.
- Lead Emergence bundles configure that environment with the skills, workflow guidance, agent roles, and connector requirements needed for a use case.
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

> **The user's agent does the work. Lead Emergence gives the agent a durable operating environment that remembers, structures, synthesizes, and improves that work over time.**

---

## Canonical architecture

```text
                    USER'S AI ENVIRONMENT
                 ChatGPT / other supported host
                           |
             +-------------+-------------+
             |             |             |
          Skills        Agent roles    Host apps
             |             |          / connectors
             |             |             |
             |             |      Gmail / Calendar /
             |             |       Drive / Slack / etc.
             |             |             |
             +-------------+-------------+
                           |
                      Workflows
                           |
                           v
                 LEAD EMERGENCE MCP
                           |
             +-------------+-------------+
             |             |             |
        Context Graph   Operational    Durable signals
                        state
             |             |             |
             +-------------+-------------+
                           |
                           v
                 Lead Emergence platform
```

### Responsibility split

| Concern | Default owner |
| --- | --- |
| Conversation and general reasoning | User's AI environment |
| External app authentication | User's AI environment / provider |
| External app retrieval and supported actions | User's AI environment |
| Bundle installation/configuration | Lead Emergence bundle |
| Skills and workflow methods | Lead Emergence bundle, executed by host |
| Specialized agent roles | Lead Emergence bundle, executed where the host supports them |
| Lead Emergence identity and entitlement | Lead Emergence |
| Persistent structured context | Lead Emergence |
| Context Graph | Lead Emergence |
| Tasks, opportunities, decisions, priorities, workflow state | Lead Emergence |
| Cross-workflow synthesis inputs and durable signals | Lead Emergence |
| Continuous optimization | Lead Emergence |
| Secure access to LE state/actions | Lead Emergence MCP |
| Human-readable control/display surface | Lead Emergence web application |

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

A bundle is primarily an **installation and configuration package for the customer's AI environment**, not a monolithic server-side application.

A bundle may define:

- skills and supporting resources;
- specialized agent roles or sub-workflows where the host supports them;
- required and optional host connectors/apps;
- setup instructions and capability checks;
- workflow definitions and triggers supported by the host;
- the Lead Emergence MCP capabilities required by the workflow;
- data that should be persisted to Lead Emergence;
- signals that should be written back to Lead Emergence;
- graceful-degradation behavior when Lead Emergence or an optional app is unavailable; and
- upgrade hooks for capabilities that genuinely require Lead Emergence-native execution.

The bundle should configure the host to combine its own connected apps with Lead Emergence MCP data rather than routing all external data through Lead Emergence.

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
workflow definitions
workflow execution mode
allowed Lead Emergence durable writes
host-ephemeral data expectations
optional provider requirements
graceful-degradation behavior
subscription-inactive behavior
compatibility constraints
upgrade/native-execution hooks
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

No workflow should silently assume a host feature, connector, MCP capability, or entitlement that the manifest does not declare.

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

It should **not** receive broad external-provider credentials merely because an external provider appears in the Lead Emergence catalog.

---

## Execution modes

Every workflow should be classified into one of three execution modes before implementation. The execution mode determines whether Lead Emergence needs direct provider custody or can rely on the user's AI host.

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
- ChatGPT/Claude/other agent-host connection work should remain separate from third-party provider ownership.

This is a scope reduction, not a request for a broad destructive refactor.

---

## Subscription and customer ownership

The architecture should intentionally distinguish between **customer-owned installed capability** and **subscription-backed Lead Emergence intelligence**.

### Customer-owned after installation

Subject to the host platform's own rules and availability, a customer may retain installed/configured assets that were placed in their AI environment, including:

- skills;
- workflow instructions;
- agent-role definitions;
- the customer's own app/connector authorizations; and
- other portable bundle assets intentionally delivered to the customer.

Lead Emergence should not depend on artificial destruction of these assets to create retention.

### Subscription-backed capability

An active Lead Emergence subscription may provide:

- Lead Emergence MCP access;
- persistent structured context;
- Context Graph storage and retrieval;
- durable task/opportunity/decision/workflow state;
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
Calendar + Gmail + LE priorities + LE history + Context Graph
    -> personalized strategic brief

Inactive subscription:
Calendar + Gmail + retained skill/workflow guidance
    -> basic host-generated brief
```

The user keeps the methodology and their own connections. They lose the persistent Lead Emergence intelligence layer and any active subscription-backed services.

### Cancellation and data lifecycle

Cancellation must distinguish three separate things:

1. **Portable installed assets** in the customer's AI environment.
2. **Subscription-backed Lead Emergence services** such as MCP access, optimization, background/native execution, updates, and control-plane features.
3. **Customer Lead Emergence durable data** such as Context Graph records, tasks, decisions, opportunities, workflow state, and historical signals.

The cancellation contract should require explicit product behavior for each category.

At minimum:

- installed portable assets intentionally delivered to the customer are not remotely destroyed merely because a subscription ends;
- subscription-backed Lead Emergence services are disabled or degraded according to entitlement state;
- the user's own host/provider connections remain governed by those hosts/providers;
- Lead Emergence durable data must follow a documented retention/deletion policy;
- resubscription behavior must define whether eligible retained state is restored and under what conditions;
- customers must have a documented path for export where product policy promises exportability;
- explicit account/data deletion must remain distinct from ordinary subscription cancellation; and
- bundle manifests must define predictable subscription-inactive behavior.

This architecture decision does **not** invent a retention duration. The retention period, deletion timing, export guarantees, and resubscription window must be explicitly defined and published before consumer launch rather than inferred from implementation defaults.

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

Before implementing any new integration, workflow, connector, or automation, answer these questions in order:

1. Can the user's AI host already perform this external action using the user's own app/connector?
2. If yes, can the bundle instruct the host to combine that result with Lead Emergence MCP data?
3. If yes, implement the workflow at the bundle/host level and **do not build a duplicate Lead Emergence provider integration**.
4. If no, does the requirement satisfy a direct-integration exception above?
5. If no, reject the provider work from launch scope.
6. If yes, write a provider-specific architecture/security note before implementation.

Additionally, before implementation:

- classify the workflow as execution mode A, B, or C;
- declare its requirements in the machine-readable bundle manifest; and
- define its write-back contract before allowing durable Lead Emergence persistence.

No provider should become `consumerConnectionReady: true` solely to make a bundle easier to implement.

---

## Immediate implementation posture

Until explicitly changed by a reviewed architecture decision:

### Continue

- Lead Emergence MCP hardening and acceptance;
- tenant-safe identity and authorization;
- Context Graph;
- bundles and machine-readable bundle manifests;
- skills and workflow definitions;
- host capability checks;
- ChatGPT launch-host acceptance;
- workflow execution-mode classification;
- formal write-back contracts;
- persistent operational state;
- synthesis/signal interfaces;
- Continuous Optimization Engine;
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
- multi-host consumer certification beyond ChatGPT.

These may resume only when a documented workflow demonstrates that the host-agent path is insufficient or when a separate host has passed its reviewed compatibility/acceptance matrix.

---

## Launch acceptance criteria

The individual consumer launch architecture is acceptable when a test user can:

1. install/configure an eligible Lead Emergence bundle in **ChatGPT**, the initial certified consumer host;
2. have that bundle's machine-readable manifest validate the required host, connector, entitlement, MCP, degradation, and persistence assumptions;
3. connect the Lead Emergence MCP securely;
4. use ChatGPT's own external apps/connectors required by that bundle;
5. execute a workflow that combines host-connected external information with Lead Emergence state;
6. persist only write-back-contract-approved durable state back to Lead Emergence;
7. receive useful synthesis/signals that depend on historical Lead Emergence context;
8. disconnect/reconnect the Lead Emergence MCP safely;
9. experience a predictable degraded workflow when Lead Emergence subscription access is removed;
10. observe documented cancellation behavior for portable assets, subscription-backed services, and Lead Emergence durable data; and
11. do all of the above without Lead Emergence taking custody of unnecessary third-party credentials.

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
- a simultaneously certified multi-host product.

Those capabilities may be added later when they produce a customer outcome that cannot be achieved through the agent-owned architecture.

---

## Architectural test

When evaluating a proposed feature, ask:

> **Does this make the customer's agent more capable because Lead Emergence supplies durable intelligence, or are we rebuilding something the customer's agent already owns?**

If the second answer is true, do not add it to the Lead Emergence core without an approved exception.
