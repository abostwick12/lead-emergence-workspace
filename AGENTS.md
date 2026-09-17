# Lead Emergence Agent Operating Mandate

**Canonical, platform-agnostic instruction source for every coding agent, model, IDE assistant, CI agent, and automation that touches Lead Emergence.**

Codex, Claude, Copilot, Cursor, Windsurf, Grok, Gemini, Roo, VS Code agents, and future tools must follow this file. Platform-specific instruction files may point here, but they must not duplicate or override these rules.

## 1. Authority order

When sources disagree, use this order:

1. **Live production state** observed in the current session.
2. `docs/status/PRODUCTION_STATE.md` after refresh.
3. `docs/ROADMAP.md` for current implementation phase and acceptance gates.
4. `docs/DECISIONS.md` for durable owner decisions.
5. `docs/BACKLOG.md` for deferred work and known risks.
6. Repository source at the **currently deployed SHA** when behavior depends on deployed application code.
7. Historical handoffs, archived status files, prior agent summaries, and chat transcripts.

A document never overrides a contradictory live observation.

## 2. Mandatory preflight when live state matters

Run the preflight before any task involving diagnosis, debugging, auth/security, migrations, schema, production behavior, deployments, entitlement, billing, tenant isolation, or any recommendation that depends on what is live now.

For local-only documentation, formatting, isolated refactors already approved, or source inspection that does not depend on production state, do not query production merely to satisfy ceremony.

### Live-state preflight

1. Run the relevant Refresh Procedure in `docs/status/PRODUCTION_STATE.md`.
2. Correct stale state in that file immediately.
3. Read `docs/ROADMAP.md` and name the current implementation phase.
4. State the claim you are testing and the cheapest observation that would falsify it.
5. Read the relevant protocol skill:
   - `agent-skills/state-refresh/SKILL.md`
   - `agent-skills/assumption-challenge/SKILL.md`
   - `agent-skills/scope-lock/SKILL.md`

If the refresh contradicts the assigned task, stop and report the contradiction before changing anything.

## 3. Evidence discipline

Tag **decision-critical diagnostic claims** as:

- `VERIFIED` — include the exact query, command, live source, or deployed-SHA file path.
- `INFERRED` — state which verified facts support the inference.
- `ASSUMED` — unchecked. A production recommendation may not depend on an assumed item.

Do not force tags onto mundane facts or routine prose. The purpose is to expose assumptions that can change a production decision, not to inflate every response.

Before proposing a production change, provide one compact evidence block:

```text
CLAIM:
FALSIFIER:
FALSIFIER RESULT:
VERIFIED EVIDENCE:
EXISTING PATH CONSIDERED:
SMALLEST COHERENT CHANGE:
PRODUCTION OBSERVABLE THAT PROVES DONE:
```

## 4. Scope rules

- **One defect, one smallest coherent change set, one production observable.**
- A migration is allowed only when a falsifying observation proves a migration is required.
- Multiple migrations for one task require explicit Andrew approval.
- No new table, function, role, schema, abstraction layer, external dependency, or service unless existing supported paths are proven insufficient and Andrew approves the expansion.
- No agent-initiated refactor. Propose it; do not perform it.
- No “while we are here” work. Put it in `docs/BACKLOG.md`.
- Tests are mandatory safety gates when relevant, but **tests are not business or production acceptance evidence**.
- Never reapply, rewrite, reorder, or “clean up” an already-applied migration.

### Cross-repository work

If the smallest coherent fix genuinely spans another Lead Emergence repository or product:

1. stop before changing the second repository;
2. declare the expanded blast radius;
3. explain why the first repository alone cannot close the observable;
4. confirm the existing authorization covers both repositories, or obtain Andrew’s approval;
5. then proceed as one bounded change set.

Do not treat “second repo” as automatically forbidden; treat undeclared scope expansion as forbidden.

## 5. Current-phase rule

Implementation work follows `docs/ROADMAP.md` sequentially. Do not begin a later implementation phase while the current phase has an open acceptance gate.

This does **not** block Andrew from making owner decisions, doing customer discovery, pricing work, sales conversations, positioning, or commercial preparation in parallel. Engineering agents do not use the roadmap to prevent non-engineering progress.

## 6. Two-strike rule

If the same class of fix has already been attempted twice for the same symptom, do not make a third attempt on that layer.

Write a conflict report containing:

- each prior attempt;
- the premise each depended on;
- which premises are now verified or stale;
- the evidence conflict;
- the smallest new instrumentation or observation that would settle it.

## 7. Production-change authorization

Do not infer permission for a production mutation from a broad goal.

Before a production mutation, confirm that Andrew’s authorization covers the exact action and blast radius. For sensitive actions—auth, schema, migrations, entitlement, tenant access, billing, deletion, or security controls—action-time confirmation may be required by repository policy.

Never bypass a repository safety gate, privileged role, RLS policy, or interactive credential requirement simply to complete a task.

## 8. Cost discipline

- Check the cheapest disproving observable first. A `SELECT` beats a test suite; a targeted log line beats a rebuild.
- Do not rerun broad suites when committed evidence already proves the unchanged path and the current question can be answered more cheaply.
- Use lower-cost models for deterministic inspection, focused tests, formatting, evidence updates, and narrow mechanical fixes.
- Escalate to stronger reasoning for ambiguous architecture, auth/security, production migrations, rollback decisions, or unclear cross-system failures.
- At the halfway point of a stated task budget, report what has actually been verified. If nothing meaningful is verified, narrow or escalate instead of continuing by inertia.

## 9. Security and evidence hygiene

Repository evidence may record IDs, timestamps, deployment SHAs, sanitized request IDs, row counts, and non-secret configuration needed for diagnosis.

Do **not** commit:

- access or refresh tokens;
- OAuth authorization codes;
- PKCE secrets/verifiers;
- cookies or session secrets;
- passwords;
- API/service-role keys;
- customer payloads or unnecessary PII;
- unsanitized screenshots containing sensitive information.

## 10. Session exit

When live production state was observed or changed:

1. update `docs/status/PRODUCTION_STATE.md` with the observation time and source;
2. record any production change in its change log.

When a durable decision was actually made:

3. append it to `docs/DECISIONS.md` with date, decision, reason, and what would reverse it.

For every coding session:

4. list files changed;
5. state the production observable that is now true, or state plainly that production did not change.

Do not add “no decision” noise to `DECISIONS.md`.

## 11. Known stale guidance

Treat older instructions that conflict with this file as historical. In particular:

- migration-first debugging is not the default;
- old Ministry-first product framing does not define Workspace or Consulting priorities;
- prior handoffs are not production authority.

If a platform-specific instruction file conflicts with this mandate, this mandate wins unless Andrew explicitly supersedes it.
