# Agent-Owned Orchestration Architecture

**Status:** Canonical architecture decision for the consumer/individual Lead Emergence product

**Decision date:** 2026-09-11

**Amended:** 2026-09-11 — portable skills and subscription-backed hosted workflows

For the current product explanation of client-owned third-party connections,
separate Workspace authorization, applicable subscription entitlement, and
connection-health evidence, see the [canonical connection
model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).

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

See [Bundle contract](orchestration-runtime-contracts.md#bundle-contract) for the complete section.

### Machine-readable bundle manifest

See [Machine-readable bundle manifest](orchestration-runtime-contracts.md#machine-readable-bundle-manifest).

### Hosted workflow retrieval contract

See [Hosted workflow retrieval contract](orchestration-runtime-contracts.md#hosted-workflow-retrieval-contract).

### Example: daily transition brief

See [Example: daily transition brief](orchestration-runtime-contracts.md#example-daily-transition-brief).

## Lead Emergence MCP role

See [Lead Emergence MCP role](orchestration-runtime-contracts.md#lead-emergence-mcp-role) for the complete section.

## Execution modes

See [Execution modes](orchestration-runtime-contracts.md#execution-modes) for the complete section.

### A. User-session orchestration

See [A. User-session orchestration](orchestration-runtime-contracts.md#a-user-session-orchestration).

### B. Host-owned scheduled/background execution

See [B. Host-owned scheduled/background execution](orchestration-runtime-contracts.md#b-host-owned-scheduledbackground-execution).

### C. Lead Emergence-native background execution

See [C. Lead Emergence-native background execution](orchestration-runtime-contracts.md#c-lead-emergence-native-background-execution).

## External provider policy

See [External provider policy](orchestration-runtime-contracts.md#external-provider-policy) for the complete section.

### Default rule

See [Default rule](orchestration-runtime-contracts.md#default-rule).

### Direct integration exception

See [Direct integration exception](orchestration-runtime-contracts.md#direct-integration-exception).

### Composio and similar integration infrastructure

See [Composio and similar integration infrastructure](orchestration-runtime-contracts.md#composio-and-similar-integration-infrastructure).

## Existing provider code and launch scope

See [Existing provider code and launch scope](orchestration-runtime-contracts.md#existing-provider-code-and-launch-scope) for the complete section.

## Subscription and customer ownership

See [Subscription and customer ownership](orchestration-data-and-security.md#subscription-and-customer-ownership) for the complete section.

### Customer-owned after installation

See [Customer-owned after installation](orchestration-data-and-security.md#customer-owned-after-installation).

### Subscription-backed capability

See [Subscription-backed capability](orchestration-data-and-security.md#subscription-backed-capability).

### Graceful degradation

See [Graceful degradation](orchestration-data-and-security.md#graceful-degradation).

### Cancellation and data lifecycle

See [Cancellation and data lifecycle](orchestration-data-and-security.md#cancellation-and-data-lifecycle).

## Data ownership and persistence

See [Data ownership and persistence](orchestration-data-and-security.md#data-ownership-and-persistence) for the complete section.

### 1. Ephemeral host context

See [1. Ephemeral host context](orchestration-data-and-security.md#1-ephemeral-host-context).

### 2. Customer-owned external data

See [2. Customer-owned external data](orchestration-data-and-security.md#2-customer-owned-external-data).

### 3. Lead Emergence durable state

See [3. Lead Emergence durable state](orchestration-data-and-security.md#3-lead-emergence-durable-state).

### Formal write-back contract

See [Formal write-back contract](orchestration-data-and-security.md#formal-write-back-contract).

### Workflow outcomes and the optimization flywheel

See [Workflow outcomes and the optimization flywheel](orchestration-data-and-security.md#workflow-outcomes-and-the-optimization-flywheel).

## Capability and host-compatibility rule

See [Capability and host-compatibility rule](orchestration-data-and-security.md#capability-and-host-compatibility-rule) for the complete section.

## Security boundary

See [Security boundary](orchestration-data-and-security.md#security-boundary) for the complete section.

## Implementation rule for Codex and future agents

See [Implementation rule for Codex and future agents](orchestration-implementation-and-launch.md#implementation-rule-for-codex-and-future-agents) for the complete section.

### Anti-drift rule

See [Anti-drift rule](orchestration-implementation-and-launch.md#anti-drift-rule).

## Immediate implementation posture

See [Immediate implementation posture](orchestration-implementation-and-launch.md#immediate-implementation-posture) for the complete section.

### Continue

See [Continue](orchestration-implementation-and-launch.md#continue).

### Freeze as launch dependencies

See [Freeze as launch dependencies](orchestration-implementation-and-launch.md#freeze-as-launch-dependencies).

### Conformance-audit reconciliation and initial SOTF bundle

See [Conformance-audit reconciliation and initial SOTF bundle](orchestration-implementation-and-launch.md#conformance-audit-reconciliation-and-initial-sotf-bundle).

### Decisions deliberately left open

See [Decisions deliberately left open](orchestration-implementation-and-launch.md#decisions-deliberately-left-open).

## Launch acceptance criteria

See [Launch acceptance criteria](orchestration-implementation-and-launch.md#launch-acceptance-criteria) for the complete section.

## Non-goals for the initial consumer launch

See [Non-goals for the initial consumer launch](orchestration-implementation-and-launch.md#non-goals-for-the-initial-consumer-launch) for the complete section.

## Architectural test

See [Architectural test](orchestration-implementation-and-launch.md#architectural-test) for the complete section.
