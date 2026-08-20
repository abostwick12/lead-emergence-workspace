# Lead Emergence Workspace — Agent Instructions

## Product boundary

This repository owns the private Lead Emergence Workspace product. It may share only Supabase Auth identity (`auth.users`) with the temporary ministry project. It must never import ministry or Consulting OS runtime code, query their business tables, reuse their integration tokens, or add a service-role key to application runtime.

## Database and deployment rules

- Workspace SQL source belongs in `supabase/migrations/` and must be runnable against a fresh local Supabase stack.
- The ministry repository is the temporary sole authority for applying hosted migrations. Never run `supabase link`, `supabase db push`, or migration repair against the shared hosted project from this repository.
- Never apply a hosted migration, migrate live data, deploy against live data, cut over a route, or delete old data without the corresponding written gate approval recorded in `docs/status/extraction-status.md`.
- Do not add `SUPABASE_SERVICE_ROLE_KEY`, OAuth tokens, export files, or real personal/ministry fixtures to this repository.

## Required checks

Run `npm run check:boundaries`, `npm run test:schema`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build` before claiming a code change is ready. Record unavailable checks and the reason in `docs/testing/test-evidence.md`.

## Git workflow

Work on `feature/workspace-extraction-foundation` until a focused follow-up branch is warranted. Inspect `git status` before edits. Do not force-push, reset, clean, or stage unrelated files. Publishing, committing, pushing, and opening pull requests require explicit user authorization.
