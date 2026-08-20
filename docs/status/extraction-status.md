# Extraction status

Phase: 0–6 local foundation
Status: In progress — local, reversible work only
Repository: private `abostwick12/lead-emergence-workspace`; draft PR #1 open from `feature/workspace-extraction-foundation` to `main`
Branch: `feature/workspace-extraction-foundation`
Source commit: ministry `e398b36eb84c5d94073bb5fd06ed31bdd51096fb`
Preflight: source `abostwick12/emergence-ministry-platform`, remote `https://github.com/abostwick12/emergence-ministry-platform.git`, branch `main`, shared ministry ref `cirqqhuvzekbvysiyedg`; Consulting OS denylisted. Source worktree was dirty, so no source build/lint/typecheck/test command was run.
Environment: Node `v24.16.0`, npm `11.13.0`, Supabase CLI `2.115.0`, Docker Desktop Linux engine `29.7.2`; Vercel association discovered only as redacted local project ID `prj_QFKL…`.
Commits created: private `main` initializer and Workspace foundation commit `a511a7e`
PRs opened: #1 (draft)
Files changed: local Workspace application, schema, scripts, tests, and documentation
Migrations created: `20260820000000_workspace_foundation.sql` (local only)
Tests run: schema contract, product-boundary check, TypeScript, lint, unit, production build, and isolated local pgTAP hostile RLS/Storage/cross-product/security-definer suite
Tests passed: schema contract, product-boundary check, typecheck, lint, unit, build, and 25/25 hostile pgTAP assertions
Tests failed: the first local migration and two pgTAP harness/expectation attempts; all were corrected without relaxing RLS or Storage policy. See test evidence.
Security evidence: Membership/RLS, private helper schema, private Storage bucket, explicit grants, and no runtime service role.
Data evidence: No production data inspected, copied, or changed.
Manual actions required: shared-project RLS audit and Gate A approval.
Blockers: Source ministry worktree is dirty and remains read-only. Hosted policy metadata remains intentionally unaudited until Gate A is approved.
Risks: Current source stores Google OAuth tokens in exposed `public.personal_integrations.config`; do not migrate. Ministry cross-product policy behavior remains unproven without database metadata.
Next phase: Local Supabase policy execution and data-migration dry-run design.
Approval gate: Gate A not requested.
