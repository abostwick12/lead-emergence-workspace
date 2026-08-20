# Extraction manifest

| Source item | Classification | Workspace disposition |
| --- | --- | --- |
| `/command-center`, tasks, capture, job search, memory | WORKSPACE_OWNED | Ported to `/workspace/*` with membership/RLS security. |
| Source personal tables | WORKSPACE_OWNED | Map to tenant-scoped Workspace equivalents. |
| Daily briefing, conversations, weekly feed | WORKSPACE_OWNED | Foundation included; live integrations await reconnection. |
| Google OAuth JSON | ENTANGLED / sensitive | Do not migrate; metadata only, reconnect required. |
| Source meetings | MINISTRY_OWNED / ENTANGLED | Do not migrate; Workspace has independent future table. |
| Ministry data, Camp, EMMA | MINISTRY_OWNED | Excluded. |
| SAGE chat and MCP | UNKNOWN_REQUIRES_DECISION | Not ported pending authenticated Workspace design. |
