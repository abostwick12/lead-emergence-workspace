# ADR-0007: Runtime service-role prohibition

Normal Workspace runtime uses the authenticated user's JWT, grants, and RLS.
No general service-role key is present in the client, server modules, previews,
logs, or environment template.
