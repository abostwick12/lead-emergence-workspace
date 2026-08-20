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
| `personal_knowledge_*` / weekly feed | Workspace feed tables | Confirm actual hosted migration status first. |
