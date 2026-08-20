# RLS policy matrix

| Object | Read | Create/update/delete |
| --- | --- | --- |
| `user_profiles` | Self | Self; user ID immutable. |
| `workspaces` | Active member/owner | Owner creates one personal Workspace and edits name only. |
| `workspace_memberships` | Self | Self may create only their owner membership for their new personal Workspace; no direct update/delete grant. |
| `workspace_entitlements` | Active member | No direct user write. |
| Domain tables | Active member | Active personal owner with matching `created_by`; tenancy immutable. |
| `audit_events` | Active member | Trigger only. |

All `workspace` tables have RLS enabled and explicit grants. SQL execution tests remain blocked until Docker/Supabase CLI are available.
