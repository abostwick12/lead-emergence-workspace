# Current-to-target data map

| Source | Target | Migration posture |
| --- | --- | --- |
| `public.personal_tasks` | `workspace.tasks` | Copy only after Gate B; set Workspace ID and creator. |
| `public.capture_inbox` | `workspace.capture_inbox` | Copy after task-ID mapping. |
| `public.job_applications` | `workspace.job_applications` | Copy after owner mapping. |
| `public.sage_memory` | `workspace.memory_entries` | Copy after owner mapping. |
| `public.ai_conversations` | `workspace.ai_conversations` | Copy only if Andrew confirms retention. |
| `public.daily_briefing_cache` | `workspace.daily_briefings` | Copy cache metadata/content after classification. |
| `public.personal_integrations.config` | `workspace.integration_connections` | Metadata only; never copy token fields. |
| `personal_knowledge_sources`, `personal_knowledge_items`, `personal_weekly_feeds`, `personal_weekly_feed_items`, `personal_feed_run_logs` | Workspace feed tables | Fresh Gate D production preflight on 2026-08-21 confirmed these source tables do not exist; exclude them from the freeze. |

Gate D retains every confirmed source record and preserves read access. The hosted freeze adds statement-level write-rejection triggers only to the seven confirmed tables; it does not revoke privileges, change RLS, drop tables, alter migrated Workspace data, or delete source evidence.
