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

No provider should become `consumerConnectionReady: true` solely to make a bundle easier to implement.

---

## Immediate implementation posture

Until explicitly changed by a reviewed architecture decision:

### Continue

- Lead Emergence MCP hardening and acceptance;
- tenant-safe identity and authorization;
- Context Graph;
- bundles and bundle manifests;
- skills and workflow definitions;
- host capability checks;
- persistent operational state;
- synthesis/signal interfaces;
- Continuous Optimization Engine;
- subscription/entitlement boundaries;
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
- Composio or equivalent integration-broker adoption.

These may resume only when a documented workflow demonstrates that the host-agent path is insufficient.

---

## Launch acceptance criteria

The individual consumer launch architecture is acceptable when a test user can:

1. install/configure an eligible Lead Emergence bundle in a supported AI host;
2. connect the Lead Emergence MCP securely;
3. use the host's own external apps/connectors required by that bundle;
4. execute a workflow that combines host-connected external information with Lead Emergence state;
5. persist only approved durable state back to Lead Emergence;
6. receive useful synthesis/signals that depend on historical Lead Emergence context;
7. disconnect/reconnect the Lead Emergence MCP safely;
8. experience a predictable degraded workflow when Lead Emergence subscription access is removed; and
9. do all of the above without Lead Emergence taking custody of unnecessary third-party credentials.

---

## Non-goals for the initial consumer launch

The initial Lead Emergence consumer launch is not required to be:

- a universal OAuth broker;
- a replacement for ChatGPT/Claude app ecosystems;
- a full email/calendar/document client;
- an independent automation server for every workflow;
- a mirrored datastore for external providers;
- a universal cross-agent execution fabric.

Those capabilities may be added later when they produce a customer outcome that cannot be achieved through the agent-owned architecture.

---

## Architectural test

When evaluating a proposed feature, ask:

> **Does this make the customer's agent more capable because Lead Emergence supplies durable intelligence, or are we rebuilding something the customer's agent already owns?**

If the second answer is true, do not add it to the Lead Emergence core without an approved exception.
