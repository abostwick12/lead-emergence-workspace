# Dependency map

| Dependency | Target use | Boundary |
| --- | --- | --- |
| Supabase Auth `auth.users` | Identity only | Temporary shared dependency. |
| `workspace` schema | All Workspace data | Exposed only after RLS/grants test. |
| `workspace_private` | Policy helpers/audit triggers | Never exposed. |
| `workspace-private` bucket | Workspace files | Private Storage RLS path boundary. |
| Ministry tables, functions, files | None | Prohibited runtime dependency. |
| Consulting OS repository/project | None | Denylisted. |
