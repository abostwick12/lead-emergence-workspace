# Lead Emergence Decisions

Durable owner decisions only. Do not use this file for live production state; use `docs/status/PRODUCTION_STATE.md`.

Format:

| Date | Decision | Reason | What would reverse it |
|---|---|---|---|
| 2026-09-17 | Lead Emergence coding agents use one canonical authority chain: live production → refreshed `PRODUCTION_STATE.md` → `ROADMAP.md` → `DECISIONS.md` → `BACKLOG.md` → source at deployed SHA → historical handoffs. | Prevent stale handoffs and platform-specific agent instructions from driving production changes. | Andrew explicitly adopts a replacement governance model. |
| 2026-09-17 | First external paid charge waits until non-Andrew signup, production tenant-isolation proof, non-Andrew Lewis value proof, and the minimum commercial/launch-safety gate pass. | Revenue should follow proof that a stranger can safely receive the product and value. | Andrew explicitly changes the launch gate after reviewing the associated risk. |

## Rules

- Add an entry only when a durable decision was actually made.
- Do not add “no decision” entries.
- Do not store secrets, customer payloads, tokens, authorization codes, cookies, or unnecessary PII.
