# Lead Emergence Workspace

Private, standalone personal Workspace extracted from Lead Emergence's former
Personal Command Center. It manages personal tasks, capture inbox entries,
career applications, memory, projects, notes, meetings, decisions,
commitments, files, and future leadership entitlements.

## Boundary

The application shares only `auth.users` with the temporary ministry Supabase
project. Runtime queries target the exposed `workspace` schema using an
authenticated user's JWT and Postgres RLS. It has no ministry or Consulting OS
runtime imports and never uses a Supabase service-role key.

## Local development

1. Copy `.env.example` to `.env.local` and supply only the public Supabase URL
   and anon key for a local stack.
2. Start a local Supabase stack, apply `supabase/migrations/`, then run
   `npm run dev`.
3. Run `npm run check:boundaries`, `npm run test:schema`, `npm run typecheck`,
   `npm run lint`, `npm run test:unit`, `npm run test:rls`, and `npm run build`.

See `docs/runbooks/local-development.md`. Hosted database changes, live-data
migration, deployment, route cutover, and cleanup are approval-gated.
