# Current-to-target route map

| Current ministry route | Target Workspace route | Decision |
| --- | --- | --- |
| `/command-center` | `/workspace` | Ported overview. |
| `/command-center/tasks` | `/workspace/tasks` | Ported. |
| `/command-center/capture` | `/workspace/capture` | Ported. |
| `/command-center/job-search` | `/workspace/career` | Ported. |
| `/command-center/memory` | `/workspace/memory` | Ported. |
| `/command-center/integrations` | `/workspace/integrations` | Legacy Workspace metadata only; not the client's ChatGPT service connection, health, or reconnection path. |
| `/command-center/chat`, feed, MCP, and any unmapped legacy UI child | `/workspace` | Safe fallback; no legacy query, source, session, or fragment data is forwarded. |
| Ministry meetings routes | None | Remain ministry-owned. |

Gate D uses temporary 307 responses so a rollback can restore the legacy UI without creating permanent browser redirect caches. Every `/api/command-center/**` route returns an intentional no-store 410 before a legacy handler can execute.

For current third-party connection ownership and supported health observations,
see the [canonical connection model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).
