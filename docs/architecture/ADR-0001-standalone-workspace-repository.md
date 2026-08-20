# ADR-0001: Standalone Workspace repository

Workspace is a separate application/repository, not a monorepo package. This
prevents runtime imports from ministry or Consulting OS and permits independent
deployment and a future Supabase split.
