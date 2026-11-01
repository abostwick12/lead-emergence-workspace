# Orchestration runtime contracts

For the current third-party connection, Workspace authorization, and
subscription-entitlement explanation, follow the [canonical connection
model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).

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

This section describes retained implementation infrastructure, not the default
client setup or a released customer capability. The source catalog, Workspace
provider OAuth, credential storage, and related UI are **historical/legacy
technical references**. Clients manage supported third-party connections in
their own ChatGPT account. Do not present Workspace provider rows as ChatGPT
connection health or enable the legacy path as a shortcut. A direct-integration
exception requires a separate reviewed decision and explicit implementation
authorization.

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
