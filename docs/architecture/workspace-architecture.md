# Workspace architecture

`auth.users` is the sole shared identity boundary. Workspace-owned data lives in exposed schema `workspace`; private RLS helpers and trigger functions live in unexposed `workspace_private`. The browser uses the public Supabase key and the authenticated user's JWT only.

The verified Entry sign-in callback calls `workspace.ensure_personal_workspace()` to resolve or provision the caller's Personal Workspace and associated ownership and setup records. Direct password login does not provision tenancy data; it can access an existing owner Workspace for rollback. All domain records include `workspace_id` and `created_by`; tenancy fields are immutable. Active members can read. Current personal owners can write. Future `organization` is reserved but not enabled.

`workspace.user_profiles.timezone` remains the user's primary Workspace timezone. The separate `clock_timezones` preference stores exactly three IANA identifiers for header display only. The browser derives clock values and daylight-saving abbreviations with `Intl.DateTimeFormat`; no external time service is used and no stored timestamp is transformed.

The private `workspace-private` Storage bucket requires a leading Workspace ID in every object path. Integration records retain metadata and an opaque secret reference only; token fields are prohibited.

Personal product lifecycle, onboarding, plan/capability, MCP, connector, callback,
privacy, and UI-scope contracts are defined in `personal-productization.md`.
