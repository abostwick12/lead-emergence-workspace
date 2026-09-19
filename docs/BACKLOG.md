# Lead Emergence Backlog

Deferred work and known risks that are real but are not part of the current roadmap phase.

Format:

| Added | Item | Where observed | Why it may matter | Revisit trigger |
|---|---|---|---|---|
| 2026-09-18 | Diagnose expired or ineffective Entry signup-confirmation links. | First Phase 2.1 production signup | The persisted Entry user remained unconfirmed after the recipient clicked the delivered confirmation email. This is separate from the current false `unable_to_create` signup result. | Revisit only after the next clean, PM-approved signup shows confirmation still blocks the supported customer path, or under a separate PM-authorized diagnostic task. |
| 2026-09-18 | ChatGPT JIT safety blocks `list_assistant_connections` | Phase 1 Developer Mode Lewis validation | ChatGPT's runtime safety layer blocked this read-only tool before a Workspace request was observed. | Separate PM-authorized investigation only. |
| 2026-09-17 | P1 — Review and remove SECURITY DEFINER from private.custom_access_token_hook if explicit least-privilege execution can replace it safely. | P0 production Auth-hook recovery | The existing hook remains `SECURITY DEFINER`; changing its execution model during recovery would broaden the production change. | Keep visible until resolved or formally dispositioned after a least-privilege replacement is proven safe. |
| 2026-09-17 | Remove or instrument swallowed exceptions on production-critical OAuth paths. | OAuth resolver/completion diagnosis | Hidden exceptions made distinct failures look identical. | Phase 3 reliability, or earlier only if Phase 1 cannot localize a live failure. |
| 2026-09-17 | Consolidate overlapping OAuth validators only if production evidence shows drift causes a real failure. | Workspace/shared OAuth authority | Duplicate validators can diverge, but refactoring is not part of the pilot/revenue gate. | Concrete production failure attributable to drift, or Phase 3 cleanup. |
| 2026-09-17 | Define cleanup/lifecycle for dynamic OAuth client registrations. | Repeated Lewis connection attempts | Client rows can accumulate across reconnects and tenants. | Before scaling beyond first clients; record decision in `DECISIONS.md`. |

## Rules

- Backlog entries do not authorize implementation.
- Out-of-phase observations go here instead of into the current branch.
- Every item needs a revisit trigger or observable that would justify work.
