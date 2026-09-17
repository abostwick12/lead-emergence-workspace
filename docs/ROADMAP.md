# Lead Emergence Roadmap: Path to First Paid Client

## Objective

A person who is not Andrew can sign up, safely receive the Individual product, connect Lewis, get real value, pay, and continue using the product without Andrew manually editing the database or Supabase dashboard.

Everything that does not move that sentence closer to true is out of implementation scope until it is true.

## How to read this file

- **Implementation phases are sequential.** Do not start later implementation work while the current phase has an open acceptance gate.
- Andrew may make pricing, positioning, sales, customer-discovery, legal/commercial, and owner decisions in parallel.
- Every acceptance criterion is a **production observable**: a row, session, charge, authenticated denial, measured revocation, or a real person completing a task.
- Tests remain mandatory safety gates where relevant, but tests are not production acceptance evidence.
- Every task gets a budget. At half the budget without a verified observable, stop and narrow or escalate.
- `DECISION` items require Andrew’s input. Agents do not decide them.

---

# Phase 0 — Ground truth

**Budget:** one working session.

**Purpose:** eliminate stale-premise debugging before more implementation work.

### Tasks

1. Run the Refresh Procedure in `docs/status/PRODUCTION_STATE.md` and correct every disagreement with live state.
2. Mark every other current-state/handoff/status document with:
   `HISTORICAL. Do not use for current diagnosis. See docs/status/PRODUCTION_STATE.md.`
3. Run a quick repository-reference scan before moving historical files to `docs/status/archive/`; do not break scripts or links simply to tidy the tree.
4. Create `docs/DECISIONS.md` and `docs/BACKLOG.md` if absent.
5. Place the canonical `AGENTS.md` at repository root/default branch.
6. Resolve the two current unknowns that gate Lewis diagnosis:
   - which access-token hook is registered;
   - whether the deployed Workspace consent route calls `workspace.complete_mcp_oauth_authorization(authorization_id)` after approval.

### Acceptance criteria

- `PRODUCTION_STATE.md` has section-level verification timestamps/sources for the state used in diagnosis.
- No non-archived document is treated as current production authority besides `PRODUCTION_STATE.md`.
- The active access-token hook is named in `PRODUCTION_STATE.md`.
- The deployed consent route behavior is named and tied to a deployed SHA/source path.
- `AGENTS.md` exists at repository root on the default branch.

### Scope limits

No feature work. No migrations. No auth redesign. Documentation and verification only.

---

# Phase 1 — Prove Andrew’s Lewis pilot end to end

**Budget:** one working session for the first retry; if it fails, the next session is instrumentation only.

Lewis is the delivery mechanism for the Individual product. The goal is not merely “OAuth works”; the goal is that ChatGPT can use Lewis against Andrew’s Personal Workspace through the supported path.

### Tasks — execute in order

1. Confirm the active access-token hook from Phase 0.
2. Confirm the deployed Workspace consent route calls `workspace.complete_mcp_oauth_authorization(authorization_id)` after approval and before returning to ChatGPT.
3. Run **one fresh end-to-end Lewis connection attempt** using the current canonical replacement client listed in `PRODUCTION_STATE.md`.
4. Immediately inspect the current production observables:
   - Workspace MCP grant row;
   - product-client binding row;
   - binding audit event;
   - OAuth session row for the current canonical client.
5. If those exist but ChatGPT still fails, inspect the issued token claims and current server admission predicates.
6. If the attempt fails without a concrete predicate, stop. The next session may add the smallest instrumentation necessary to surface the real exception/predicate. Do not repair an invisible failure.

### Acceptance criteria

**Pass:** for the current canonical replacement Lewis client:

- a current Workspace MCP grant exists;
- a current product binding exists if the deployed completion contract requires one;
- a live OAuth session exists;
- one real read-only MCP tool call from ChatGPT reaches the canonical Workspace MCP and returns the expected Andrew-owned result;
- no unrelated tenant data is returned.

**Not closed:** if the above is not true by the session budget, the next task is instrumentation/localization only. No new architecture or migration without a falsifying observable proving the current supported path cannot work.

### Scope limits

- Zero speculative migrations.
- Zero new tables, functions, roles, schemas, validators, or dispatch layers unless the current supported path is proven insufficient and Andrew approves.
- No new ChatGPT client unless the current canonical client is proven unusable for a reason that cannot be repaired in place.

---

# Phase 2 — Prove a stranger can safely receive value, then charge

Each slice ships independently. Build work may proceed only in this order; owner/commercial decisions can happen in parallel.

## 2.1 Account provisioning

A person other than Andrew signs up and lands on a functional first screen as owner of their own workspace, without Andrew touching the database or Supabase dashboard.

**Acceptance:** from a clean browser, a non-Andrew test user creates an account and reaches a working first screen. Production shows their user, their workspace, and their owner membership.

## 2.2 Tenant isolation proof

Create two real test accounts.

**Acceptance:** authenticated account A attempts to read account B’s data through the real production path and is denied. Record the sanitized request/response evidence in `PRODUCTION_STATE.md` or a linked evidence artifact.

No external paid client is onboarded before this passes.

## 2.3 Non-Andrew Lewis value proof

A person other than Andrew connects their own ChatGPT to their own Lead Emergence workspace without Andrew manually editing production state.

**DECISION:** state in one sentence the recurring outcome Lead Emergence makes sufficiently better, easier, faster, more reliable, or more valuable that the client is willing to pay rather than assemble the pieces manually.

**Acceptance:** the non-Andrew user completes one real piece of work through Lewis and says the result would be worth paying for. Production evidence shows the connection/session belongs to that user and the result uses only their workspace authority.

## 2.4 Minimum launch safety and commercial gate

Do not turn this into enterprise compliance. Establish the minimum conditions required to responsibly take money from an external client.

### Required commercial decisions

- payment provider;
- initial plan/price;
- trial or no trial;
- cancellation behavior;
- refund policy;
- support contact/channel;
- basic privacy/data-use disclosure;
- basic terms/customer agreement appropriate to the initial pilot.

### Required launch-safety observables

- current recoverable backup/recovery path is known and recorded;
- production errors for signup/billing/Lewis can be surfaced to Andrew without code archaeology;
- one-page incident/contact procedure exists;
- customer data/secrets are not committed to repo evidence.

Mature alerting and restore rehearsal remain Phase 3 work.

## 2.5 Billing and first paid charge

Payment captures successfully, entitlement changes from payment state, cancellation behaves as stated, and failed payment behaves as stated.

**Acceptance:**

- one real charge is processed end to end;
- one deliberate cancellation produces the promised access change within the stated window;
- one deliberate failed payment produces the promised behavior;
- production entitlement state reflects each event.

**First external paid customer charge is permitted only after 2.1–2.4 pass.**

## 2.6 Connection lifecycle

Connect, see, revoke, reconnect, offboard.

**Acceptance against a non-Andrew account:**

1. connect from a clean ChatGPT account;
2. see the connection and its authority in Workspace UI;
3. disconnect and observe the grant become inactive;
4. reconnect without orphaning conflicting state;
5. offboard the account and measure how long MCP access remains possible.

Document the token-expiration/revocation window and decide whether it is acceptable for a cancelled/offboarded account.

## 2.7 Operator basics

Andrew can:

- see who signed up;
- reset/recover access through the supported operator path;
- issue a refund;
- offboard an account;
- export a client’s data.

**Acceptance:** each is performed once against a real test account without ad hoc SQL unless the product explicitly defines SQL as the supported operator path.

### Architecture questions that must be decided before scaling beyond first clients

Record answers in `docs/DECISIONS.md`:

- whether global MCP dynamic admission plus per-grant authority is sufficient or a per-account gate is required;
- expected lifecycle/cleanup for dynamic OAuth client registrations;
- which single access-token hook is canonical;
- support boundary for client-owned ChatGPT connectors;
- whether delivery through another MCP-capable platform is required for resilience, and if so when.

### Phase 2 scope limits

- no UI redesign unless a Phase 2 acceptance gate cannot be completed without it;
- no unrelated integration;
- no differentiator feature not required to prove the paid core loop;
- “while we are here” items go to `BACKLOG.md`.

---

# Phase 3 — Reliability and operability

Begins only after Phase 2 acceptance is complete and a paid-client path exists.

### Tasks

1. Structured error visibility for remaining swallowed exceptions on production-critical paths.
2. Uptime/error alerting that reaches Andrew.
3. Backup/restore rehearsal against a non-production target.
4. One-page incident runbook exercised once.
5. Cleanup/operability work proven necessary by actual pilot usage.

### Acceptance criteria

- an injected failure produces an alert Andrew receives within a measured time;
- one restore rehearsal succeeds and elapsed time is recorded;
- critical swallowed-error paths have structured logging/error codes;
- operator runbook has been used once in rehearsal.

---

# Phase 4 — Differentiators

Nothing here starts before a paying client exists unless a Phase 2 customer-value test proves one is required to make the product worth paying for.

Examples:

- agent teams / agentic workflows;
- journaling signals / sanitized-signal pipeline;
- Meridian reasoning layer;
- Consulting OS cross-client dashboard.

Every item lives in `BACKLOG.md` with the observable that would justify building it.

---

# Global implementation limits

1. One defect, one smallest coherent change set, one production observable.
2. A migration is used only when live evidence proves a migration is required; multiple migrations require explicit approval.
3. No new table, function, role, schema, abstraction, service, subscription, or dependency without a falsifiable need and Andrew’s approval where required.
4. No agent-initiated refactor.
5. Tests are required safety gates where relevant; production observables determine acceptance.
6. Work outside the current implementation phase goes to `BACKLOG.md`.
7. If the same class of fix has been attempted twice for one symptom, stop and escalate.
8. Cross-repo work must declare and confirm blast radius before touching the second repository.
9. Never use a stale handoff as current production authority.

---

# Deliberately out of scope until justified

- Ministry account track unless a current business need reactivates it;
- faith-specific versus leadership-general positioning as an engineering task;
- Phase 4 differentiators before a paying client/value test justifies them;
- EMERGE, Etsy, or unrelated projects/repositories.
