# Workspace architecture

`auth.users` is the sole shared identity boundary. Workspace-owned data lives in exposed schema `workspace`; private RLS helpers and trigger functions live in unexposed `workspace_private`. The browser uses the public Supabase key and the authenticated user's JWT only.

The deployed application resolves an approved existing personal Workspace through an active owner membership; login does not provision tenancy data. All domain records include `workspace_id` and `created_by`; tenancy fields are immutable. Active members can read. Current personal owners can write. Future `organization` is reserved but not enabled.

`workspace.user_profiles.timezone` remains the user's primary Workspace timezone. The separate `clock_timezones` preference stores exactly three IANA identifiers for header display only. The browser derives clock values and daylight-saving abbreviations with `Intl.DateTimeFormat`; no external time service is used and no stored timestamp is transformed.

The private `workspace-private` Storage bucket requires a leading Workspace ID in every object path. Integration records retain metadata and an opaque secret reference only; token fields are prohibited.
