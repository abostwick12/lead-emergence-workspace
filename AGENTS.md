# Canonical Lead Emergence Control Plane

Before any diagnosis, implementation, branch/worktree creation, or code change in this repository, read the private canonical control plane:

- Repository: `abostwick12/lead-emergence-control-plane` (default branch `main`)
- Shared agent mandate: `AGENTS.md`
- Canonical roadmap: `docs/ROADMAP.md`
- Canonical production state: `docs/status/PRODUCTION_STATE.md`
- Durable decisions: `docs/DECISIONS.md`
- Backlog: `docs/BACKLOG.md`
- Protocols: `agent-skills/`

The control-plane `AGENTS.md` and Software Factory V1 workflow govern shared development behavior. This repository's rules below remain in force unless they directly conflict with that shared workflow; otherwise preserve the stricter rule.

Do **not** create an independent editable copy of `ROADMAP.md` or `PRODUCTION_STATE.md` in this repository. If you cannot access the private control-plane repository, stop and report that access failure to Andrew rather than working from a stale copy or prior handoff.

---

# Lead Emergence Workspace — Repository-Specific Agent Instructions

## Workspace-specific product boundary

This repository owns the private Lead Emergence Workspace product. It may share only Supabase Auth identity (`auth.users`) with the temporary ministry project. It must never import ministry or Consulting OS runtime code, query their business tables, reuse their integration tokens, or add a service-role key to application runtime.

## Workspace database and deployment rules

- Workspace SQL source belongs in `supabase/migrations/` and must be runnable against a fresh local Supabase stack.
- The ministry repository is the temporary sole authority for applying hosted migrations. Never run `supabase link`, `supabase db push`, or migration repair against the shared hosted project from this repository.
- Never apply a hosted migration, migrate live data, deploy against live data, cut over a route, or delete old data without the corresponding written gate approval recorded in `docs/status/extraction-status.md`.
- Do not add `SUPABASE_SERVICE_ROLE_KEY`, OAuth tokens, export files, or real personal/ministry fixtures to this repository.

## Workspace required checks

Run `npm run check:boundaries`, `npm run test:schema`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build` before claiming a code change is ready. Record unavailable checks and the reason in `docs/testing/test-evidence.md`.

## Workspace Git constraints

The Software Factory isolation rules above replace the older instruction to keep all work on `feature/workspace-extraction-foundation`. Use a dedicated task branch/worktree for new implementation work after a PASS preflight.

Inspect `git status` before edits. Do not force-push, reset, clean, or stage unrelated files. Local bounded commits are allowed after a PASS preflight. Publishing/pushing and opening pull requests still require explicit user authorization unless the task itself grants it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
