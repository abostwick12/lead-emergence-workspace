# Local development

Prerequisites: Node 20+, Docker, and Supabase CLI. Copy `.env.example` to
`.env.local`; use local public URL/key only. Run `supabase start`, apply the
Workspace migration locally, then `npm run dev`. Run boundary/schema checks,
typecheck, lint, unit tests, and build. Never link this repository to the
hosted shared project.
