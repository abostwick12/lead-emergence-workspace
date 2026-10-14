# First-party Preview Auth: Desktop validation evidence

October 14, 2026, America/Chicago. Scope: local import, one forward local migration,
real transactional database assertions, required application checks, and a local
handoff. This record does not authorize any hosted action.

## Provenance and preflight

- Original archive: `C:/Users/awbostwick/Downloads/preview-first-party-auth-desktop.zip`.
  Archive SHA-256: `dbaafd2d8df546bbfe722a8254b60467eff720c732b7b13f4ddaf032c49d0eda`.
- Extracted patch: `../.preview-first-party-auth-import-20261014/preview-first-party-auth-desktop.patch`.
  `Get-FileHash -Algorithm SHA256` matched `SHA256SUMS.txt` and the originally
  approved checksum: `0f786f583e4d5d330e9ad474ea18ad3ee86b029789f5018e26ea6911da1c9e88`.
- Repository: `abostwick12/lead-emergence-workspace`.
  `git fetch origin`, `git ls-remote origin refs/heads/main` and local `origin/main`
  matched `5523eb62b333a2e60fd033c471fb99354a05a6db`.
- Worktree: `C:/Users/awbostwick/Documents/ChatGPT/architecture check/.preview-first-party-auth-validation`.
  Branch: `codex/p2-5-preview-first-party-auth-local-db`.
  `git apply --check` passed before application; no conflict resolution or newer-main
  force application occurred. The original cloud final commit
  `228449e574b1903f7c57d62a1abcfdc0aee1143b` was not available in Desktop's object
  store; the checksum-verified patch is the import artifact.
- Current private control-plane main: `6618ea33ba6c5997e9478422d433f86fbb231d07`.
  Mandate, roadmap, decisions, production state, backlog and three protocol skills
  were read. Phase 2/3 are authorized; this task covers account/session validation.
  Production refresh is not needed to decide the isolated local test result.
  Hosted definitions/settings remain unverified in this run.
- Parallel preflight inspected status and forward commit paths for 71 existing
  local worktrees, plus exact file/object changes in open Auth-related PRs.
  No pending patch-file ownership collision was found. Shared test-evidence edits
  occupy separate sections. PR #11 changes login presentation; PR #10 changes
  operator admission objects; PR #61 changes MCP resource admission/hook objects,
  while this draft changes the browser predicate and provisioning function. Those
  implementations were preserved. No other worktree was edited or reconfigured.

## Disposable database and exact source

- Docker Desktop/engine connectivity and Supabase CLI `2.115.0` were checked.
  Commands were discovered with `--help`. No CLI upgrade or dependency was added.
- Temporary config used project ID `preview-first-party-auth-validation-20261014`
  and ports 59420/59421/59422/59423/59424/59427/59429 instead of existing stack ports.
  CLI runtime resource names used `preview-first-party-auth-validation-2026`.
  Only database and Auth containers were started; unrelated services were excluded.
  No hosted link, hosted credentials, users or business exports were supplied.
- `supabase start --exclude realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`
  applied all 38 existing migrations and the repository's local-only seed.
  PostgreSQL was 15.8; Auth supplied real `oauth_clients` and `sessions.oauth_client_id`.
  The required existing functions and profile constraint were present; zero users
  existed. No replacement Auth schema or new function/table/role/schema was created.
- `supabase migration new preview_first_party_auth_local_validation` created
  `20261014101027_preview_first_party_auth_local_validation.sql`.
  The initial draft received its missing `$function$;` terminator before application.
- The final migration and SQL review draft are byte-identical, SHA-256
  `fa72e26f625fdbf0f952f7a71439ff1d7cfca5dea679cb833c7bef4a5524358e`.
  Tested fixture SHA-256:
  `99a3a57b99e1359d5c64292c193219d00de1ca69b93a3476548f9348fba7cf63`.
  Final fixture SHA-256:
  `1762ad86a870a11ecbae72be3e4148131169df894fc81cd1fbcc7bf595b1bbd2`.
  Final whitespace review removed exactly one empty line after ROLLBACK; no SQL
  statement or assertion changed, so database execution was not repeated for it.
- Existing migration sources were unchanged. Draft corrections were tested with
  fresh `supabase db reset --local` databases; no hosted ledger repair or historical
  migration rewrite occurred. Final local ledger count: 39.
- The migration replaces only `workspace_private.is_direct_session()` and
  `workspace.ensure_personal_workspace()` and extends the existing
  `workspace_user_profiles_entry_provider_check` constraint. Both function owners
  remain postgres, with EXECUTE restricted to postgres/authenticated as before.

The workflow follows the installed CLI help and current official
[migration guidance](https://supabase.com/docs/guides/local-development/database-migrations)
and [database-testing guidance](https://supabase.com/docs/guides/database/testing).
Hosted execution portions of those guides are outside this task's authorization.

## Database proof

Final command:

```text
supabase test db --local supabase/tests/database/preview_first_party_auth.sql supabase/tests/database/workspace_productization.sql
```

Result: `Files=2, Tests=151`, all successful, `Result: PASS`.
New fixture: 81 assertions. Unchanged legacy fixture: 70 assertions.

| Acceptance | Observed real database result |
| --- | --- |
| Missing pin | Provisioning throws 42501; no new profile; an existing workspace is hidden and writes affect zero rows |
| Exact pin/session/user/issuer/audience | `authenticated`, without RLS bypass, provisions its owned workspace and can write its own task |
| Canonical identity | Both first-party owners store their same-project authenticated user UUID and first-party marker |
| Repeat | Same workspace UUID, one plan and one onboarding record |
| Wrong authority | Wrong client/issuer/audience/role, missing/unknown/other-user/other-client session and user/session mismatch deny provisioning, expose zero workspaces and persist zero task updates |
| MCP marker | Both boolean and text markers deny browser provisioning, reads and writes |
| Active MCP grant on browser client | Provisioning denied, no workspace exposed; the unchanged Auth hook marks the grant as MCP |
| Separate existing MCP client | Supported MCP authority and onboarding RPCs succeed; browser RLS still exposes no workspace |
| Tenant separation | Both directions deny reads, cross-tenant inserts and updates; stored task titles and row count remain unchanged |
| Incompatible graph | Canonical/provider linkage mismatch and broken owner membership are denied; whole profile/workspace/membership/plan/onboarding/task fingerprint matches exactly |
| Legacy behavior | New Custom Provider provisioning/retry retains its canonical provider UUID; unchanged 70-case suite passes |

Fixtures use synthetic UUIDs and `example.invalid` addresses. Admin context creates
only fixture inputs/pins/grants and inspects postconditions. Positive browser/MCP
access uses `authenticated` and existing supported RPCs. No private-schema grants
were added for testing. Every fixture ends with ROLLBACK.

Postflight via `docker exec supabase_db_preview-first-party-auth-validation-2026 psql`
at approximately 10:19 UTC found zero Auth users/clients/sessions, Workspace
workspaces/profiles/tasks, private grants and browser-pin rows. Thus the assertions
rolled back, including the attempted unauthorized writes.

The unchanged MCP functions matched their before/after definition MD5, owner and ACL:

| Function | Definition MD5 | Preserved EXECUTE ACL |
| --- | --- | --- |
| `workspace_private.is_valid_mcp_request()` | `8bc0a52169788fe449ea645fdbdd6961` | postgres only |
| `workspace_private.custom_access_token_hook(jsonb)` | `cd5c09521c3a7e55715a08b4642d630c` | postgres, supabase_auth_admin |

## Application checks and session review

`npm ci --ignore-scripts --no-audit --no-fund` used the unchanged lockfile.
Node 24.16.0; installed Next 16.3.2, Supabase JS 2.112.3, SSR 0.12.4.
Installed Next route-handler and cookies guidance was inspected before corrections.

| Check | Result |
| --- | --- |
| `npm run check:boundaries` | PASS, 96 runtime files |
| `npm run test:schema` | PASS, 32/32 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 31 files / 266 tests |
| `npm run build` | PASS, compiled and generated 30 pages |
| `git diff --check` | PASS with normal filesystem access |

No application runtime change followed those passing checks; subsequent corrections
were confined to SQL/fixtures/evidence. Broad application checks were not repeated.

| Session boundary | Local proof and its limit |
| --- | --- |
| Callback state/PKCE | Unit tests compute S256, bind verifier/state/client/expiry and check callback ordering/rejection/replay through explicit route mocks; real issuer one-use/concurrent behavior is untested |
| Verified token admission | Source calls `getClaims` before `setSession`, checks pinned claims, then compares Auth user ID; tests mock signature verification. DB tests prove SQL authorization contexts, not real token issuance/signature integration |
| Cookie isolation | Source uses the same dedicated Preview session name in browser/server/proxy; transaction cookie is host-only, HttpOnly, SameSite=Lax, callback-scoped and ten-minute expiry, Secure in production builds. Browser Set-Cookie/roundtrip isolation is not exercised |
| Renewal/rotation | Actual installed SDK lifecycle runs with synthetic fetch responses, retains returned rotated refresh token, rejects wrong-client renewal and preserves ordinary Request bodies. Concurrent refresh and hosted rotation semantics remain untested |
| Sign-out | Existing Workspace provider calls SDK `signOut({scope:'local'})` before login navigation; callback failures clear the Preview session. Real cookie removal, server revocation and old-token denial remain untested |

## Attempt history and limitations

1. Original ZIP patch provenance passed; earlier pasted-text transport failures did
   not lead to an import or Auth repair.
2. One SQL terminator correction was identified before execution; no failed syntax
   application was made.
3. Baseline legacy suite passed 70/70. Initial draft then failed assertions 18/20/21:
   it rejected empty-linkage reconciliation and changed the revoked-owner error.
   One bounded legacy-branch correction restored 70/70 without weakening the new
   first-party ownership checks or overwriting incompatible linkage.
4. First new-fixture run stopped after three assertions because it directly called
   a private-schema function. Those unsupported assertions were removed; public
   RPC and RLS assertions remained. No permissions were changed.
5. Next fixture run exposed two real missing-pin failures before stopping at an
   invalid nested data-modifying CTE. SQL three-valued logic returned NULL and the
   PL/pgSQL guard skipped denial. One predicate correction adds explicit false;
   fixture CTEs were moved to the top level. Final 81 new assertions pass.
6. Initial sandbox unit execution imported no tests because Windows denied temp
   cache renames. Normal-access execution passed all 266. Sandbox Git diff reads
   also failed; normal-access inspection passed. Neither required source/config
   changes. No pre-existing application assertion failure was observed.

No product repair class has had two failed repair attempts. Generated raw local
logs, including failed runs, remain under ignored `.local-proof/`; they are not
committed. This sanitized record preserves their results.

`supabase stop --project-id preview-first-party-auth-validation-2026 --no-backup`
completed successfully at 10:20 UTC. Docker container and volume searches for that
task prefix returned no entries. Other local stacks were preserved. Temporary
`supabase/config.toml` changes were restored to the exact approved base.

For reproduction, first use another isolated checkout and configure a unique local
project ID and unused ports there. The restored default config is shared with an
existing local stack and must not be reset for this proof. Do not link or use any
hosted project. Then start the stack and run the exact two-file test command above.

## Changed files

- `.gitignore` (ignore local runtime logs only)
- `app/auth/callback/sign-in/route.ts`
- `app/auth/entry/route.ts`
- `docs/runbooks/preview-first-party-auth-review.md`
- `docs/runbooks/preview-first-party-auth.sql.draft`
- `docs/testing/test-evidence.md`
- `docs/testing/preview-first-party-auth-local-validation.md`
- `lib/auth/preview-oauth.ts`
- `lib/supabase/client.ts`
- `lib/supabase/proxy.ts`
- `lib/supabase/server.ts`
- `supabase/migrations/20261014101027_preview_first_party_auth_local_validation.sql`
- `supabase/tests/database/preview_first_party_auth.sql`
- `tests/preview-oauth-routes.test.ts`
- `tests/preview-oauth.test.ts`

No package manifest/lockfile, historical migration, existing regression fixture,
canonical governance document or other worktree was modified.

## Handoff and next step

Local validation is complete for the stated matrix. Real hosted sign-in, browser
cookies, concurrent renewal/rotation, sign-out, ChatGPT continuation, and deployment
readiness remain NOT TESTED. No hosted mutation/login/consent, client registration,
push, PR, merge or deployment occurred. No PR or CodeRabbit review exists for this
local branch; open review threads are not applicable. Exact-head CodeRabbit review
remains mandatory before any later merge.

Next step: independently review the corrected local Auth/SQL change before preparing
or approving any hosted execution. This review needs a strong security-capable model
and no hosted mutation. Any later hosted package must freshly identify exact live
definitions/settings/ACLs, real public client/callback/pin, deployment, test identity
and an explicitly authorized OAuth attempt. Passing local fixtures does not approve
those actions or establish customer acceptance.
