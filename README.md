# Lead Emergence Workspace

Private, standalone personal Workspace extracted from Lead Emergence's former
Personal Command Center. It manages personal tasks, capture inbox entries,
career applications, memory, projects, notes, meetings, decisions,
commitments, files, and future leadership entitlements.

## Release status authority

Current launch gates and production observations live in the [canonical control plane](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/ROADMAP.md). Local status files and older runbooks retain historical evidence; they do not establish current acceptance or authorize replaying migrations and setup. Production remains shared; no database separation is implied by this documentation.

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
