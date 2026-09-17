# Lead Emergence Backlog

Deferred work and known risks that are real but are not part of the current roadmap phase.

Format:

| Added | Item | Where observed | Why it may matter | Revisit trigger |
|---|---|---|---|---|
| 2026-09-17 | Remove or instrument swallowed exceptions on production-critical OAuth paths. | OAuth resolver/completion diagnosis | Hidden exceptions made distinct failures look identical. | Phase 3 reliability, or earlier only if Phase 1 cannot localize a live failure. |
| 2026-09-17 | Consolidate overlapping OAuth validators only if production evidence shows drift causes a real failure. | Workspace/shared OAuth authority | Duplicate validators can diverge, but refactoring is not part of the pilot/revenue gate. | Concrete production failure attributable to drift, or Phase 3 cleanup. |
| 2026-09-17 | Define cleanup/lifecycle for dynamic OAuth client registrations. | Repeated Lewis connection attempts | Client rows can accumulate across reconnects and tenants. | Before scaling beyond first clients; record decision in `DECISIONS.md`. |

## Rules

- Backlog entries do not authorize implementation.
- Out-of-phase observations go here instead of into the current branch.
- Every item needs a revisit trigger or observable that would justify work.
