# Orchestration implementation and launch

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
