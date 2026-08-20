# Workspace architecture

`auth.users` is the sole shared identity boundary. Workspace-owned data lives in exposed schema `workspace`; private RLS helpers and trigger functions live in unexposed `workspace_private`. The browser uses the public Supabase key and the authenticated user's JWT only.

Every user creates one personal workspace and active owner membership through RLS-restricted inserts. All domain records include `workspace_id` and `created_by`; tenancy fields are immutable. Active members can read. Current personal owners can write. Future `organization` is reserved but not enabled.

The private `workspace-private` Storage bucket requires a leading Workspace ID in every object path. Integration records retain metadata and an opaque secret reference only; token fields are prohibited.
