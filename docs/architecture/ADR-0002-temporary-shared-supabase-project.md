# ADR-0002: Temporary shared Supabase project

Workspace temporarily shares only Auth and a hosted project with ministry. Its
data is isolated in dedicated schemas, RLS policies, grants, and Storage paths;
the ministry repository remains remote-migration authority.
