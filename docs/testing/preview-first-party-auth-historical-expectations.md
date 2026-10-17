# Preview draft: approved historical expectation correction

IN SCOPE — Local validation completed October 14, 2026, America/Chicago.
This resolves the three stale historical expectations recorded in
[the legacy integrity correction](preview-first-party-auth-legacy-integrity-correction.md).
It changes test expectations only; it does not change provisioning behavior.

## Scope and ownership evidence

- Reviewed base: `fd46b77864f9ffb9b72212940ea986d27223b656`.
- Task branch: `codex/p2-5-preview-first-party-auth-local-db`; starting tree clean
  (`git status --porcelain`, `git rev-parse HEAD`).
- `git fetch origin` succeeded. Checked Workspace `origin/main`:
  `cc0965e3f0f3a2d71462918164ef055885437251`.
- `git worktree list --porcelain` listed 82 worktrees. Every other existing
  checkout was inspected with `git status --porcelain --
  supabase/tests/database/workspace_productization.sql` and
  `git log --since=2026-09-20 HEAD -- <fixture>`: no pending fixture edits or newer
  fixture commits were found. Refreshed `origin/main` also has no newer fixture commits.
- The primary checkout's last fixture commit is the September 19 archive snapshot
  `06755d7225e6318bc771fa62dd42f9d295e28e0c`, branch
  `archive/hosted-workflow-canonicalization-20260919`. Its fixture setup/MCP-claims
  divergence is historical content, not evidence of active ownership. It has no
  pending fixture edits. That checkout was neither edited nor restored.
- `gh pr list --repo abostwick12/lead-emergence-workspace --state open --limit 100
  --json number,title,headRefName,headRefOid,url,files` returned 12 open PRs;
  none lists this fixture. No active competing ownership was established.
- Production refresh is not applicable: acceptance is explicitly local-only.
  No Supabase/Vercel hosted access, linked CLI command or hosted credential was used.

## Exact three approved expectation changes

1. Assertion 18 retains its provisioning query and `throws_ok` denial check.
   SQLSTATE remains `42501`; expected message changes from
   `Personal Workspace authorization is not active.` to
   `A verified Lead Emergence identity is required.` Description:
   `sign-in provisioning without a trusted identity denies before membership reactivation`.
2. Assertion 20 retains its provisioning query and changes `lives_ok` to
   `throws_ok`, expecting SQLSTATE `42501` and
   `Personal Workspace integrity requires review.` Description:
   `existing active owner with missing canonical linkage is denied automatic reconciliation`.
3. Assertion 21 retains its canonical-linkage query and changes the expected
   synthetic canonical UUID to `null::uuid`. Description:
   `denied existing-owner provisioning leaves canonical linkage NULL`.

VERIFIED — A mechanical comparison built the expected fixture from the reviewed
base using only these three block substitutions; the result equals the edited
fixture. Fixture setup, the other 67 assertions and all ownership/denial checks
outside those three blocks are unchanged. The historical plan remains 70 tests.
This is the first test-expectation correction attempt; no repair retry was needed.

## Combined disposable database validation

VERIFIED — Unique local project `preview-assertions-20261014` used unused ports
59520–59529, with database port 59522. Local config was changed transiently for
isolation and restored from the reviewed base after teardown.

```text
supabase start --exclude realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
Exit: 0; 39 migrations installed in the fresh disposable database.

supabase test db --local supabase/tests/database/preview_first_party_auth.sql supabase/tests/database/workspace_productization.sql
supabase/tests/database/preview_first_party_auth.sql .. ok
supabase/tests/database/workspace_productization.sql .. ok
All tests successful.
Files=2, Tests=163
Result: PASS
Exit: 0
```

The unchanged affected fixture supplies 93 assertions; the historical fixture
supplies 70: **163/163 PASS**. This is sanitized CLI summary output, not a full
per-assertion TAP transcript. The preceding historical result was 67/70, with only
18, 20 and 21 failing; those stale expectations are now resolved. No new failures.
Application checks were not rerun, as explicitly instructed for expectation-only changes.

## Rollback and teardown proof

VERIFIED — Both fixtures end with `finish()` and `rollback`. After the combined
run, `docker exec supabase_db_preview-assertions-20261014 psql -U postgres -d
postgres -X -At -v ON_ERROR_STOP=1 -c <count queries>` returned:

```text
migration_count|39
auth_users|0
auth_identities|0
auth_clients|0
auth_sessions|0
workspace_count|0
profile_count|0
membership_count|0
plan_count|0
onboarding_count|0
task_count|0
grant_count|0
browser_pin_count|0
```

Counts query the corresponding `auth`, `workspace` and `workspace_private`
tables; the pin query filters `product_settings` on
`setting_key = 'workspace_preview_browser_client_id'`.
`supabase stop --project-id preview-assertions-20261014 --no-backup` exited 0.
`docker ps -a --format '{{.Names}}'` and
`docker volume ls --format '{{.Name}}'` then contained zero matches for this owned
project. Only the owned disposable stack was removed.

## Unchanged runtime and SQL proof

VERIFIED — The only source change from the reviewed base is the three fixture
assertion blocks. All application runtime, dependencies, migrations, access
predicates and the SQL draft remain unchanged. No database object was added.

`git hash-object` equals the reviewed-base `git rev-parse <base>:<path>` for:

| File | Unchanged Git blob |
| --- | --- |
| SQL draft and forward migration | `7f4708d11af6798701f74c921c2473458a83a9b2` |
| `preview_first_party_auth.sql` | `c36751b98312f249a0cd30d2d50a7f66589fa842` |
| Restored `supabase/config.toml` | `93d68edfd52632a9f57c16d64de34d029bee31a0` |

The draft is `docs/runbooks/preview-first-party-auth.sql.draft`; the migration is
`supabase/migrations/20261014101027_preview_first_party_auth_local_validation.sql`.
They remain byte-identical; each working-tree SHA-256 is
`2f1cc3eb76a13bc52fd6e89061be54ecaf544c749902e635ed0ed2b63b507502`.
Strict legacy admission and the missing-pin `coalesce(..., false)` correction are
preserved. Production did not change. No push, PR, merge, deployment, activation,
client registration or real login/consent occurred.

The final local commit and reviewed-base-to-final patch are recorded in the task
handoff. This evidence does not grant hosted-change or release approval.
