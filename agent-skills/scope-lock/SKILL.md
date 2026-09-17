---
name: scope-lock
description: "Contain Lead Emergence implementation work to the current roadmap phase and smallest coherent change set. Use when work spans multiple files/layers/repos, touches auth/schema/migrations/architecture, or starts expanding beyond the observable that defines done."
---

# Scope Lock

## Commitment

**One defect. One smallest coherent change set. One production observable.**

A migration is not part of the slogan because migrations are not the default repair mechanism. Use one only when live evidence proves it is required. Multiple migrations require explicit approval.

## Start block

```text
PHASE:
TASK:
PRODUCTION OBSERVABLE THAT PROVES DONE:
BUDGET:
EXPECTED BLAST RADIUS:
  files/routes:
  database objects:
  repositories/products:
```

If implementation is outside the current roadmap phase, add it to `docs/BACKLOG.md` and stop unless Andrew explicitly reprioritizes.

## Capture, do not chase

Adjacent bugs, refactors, naming issues, duplicated logic, missing tests, UI polish, or architecture improvements go to `BACKLOG.md` unless they prevent the current observable.

## Cross-repository expansion

A second repository is not automatically forbidden. Before touching it:

1. stop;
2. declare the added blast radius;
3. prove the first repo alone cannot close the observable;
4. confirm authorization covers the second repo;
5. proceed only as one bounded change set.

## Hard prohibitions without explicit authorization

- agent-initiated refactor;
- new table/function/role/schema/abstraction/service/dependency;
- loosening RLS or shared Auth controls;
- reapplying/rewriting/cleaning an applied migration;
- deleting production data;
- unrelated repository/project work;
- broad suite reruns when a cheaper observation answers the question.

## Budget checkpoint

At half budget:

```text
BUDGET CHECK
  Spent:
  Verified observable so far:
  Still assumed:
  Continue, narrow, or escalate:
```

## Session exit

- Update `PRODUCTION_STATE.md` only when live state was observed or changed.
- Update `DECISIONS.md` only when a durable decision was made.
- List changed files.
- State what is now true in production, or state that production did not change.
