# Preview draft: restore current legacy integrity checks

October 14, 2026, America/Chicago. This bounded local correction supersedes the
legacy-reconciliation conclusion in the earlier Desktop validation/export.

## Scope, authority and preflight

- Repository: `abostwick12/lead-emergence-workspace`.
- Existing branch: `codex/p2-5-preview-first-party-auth-local-db`.
- Starting commit: `95f28f6a2e7ac527f62a67670f4be20ede5d4847`.
- Starting/exported tree: `02f6ad1dde63715dfa050f30c1c43b17b4f27a6f`.
- Approved original base: `5523eb62b333a2e60fd033c471fb99354a05a6db`.
- `git rev-parse`, branch/status, local refs and 72 other existing worktree statuses
  and forward paths were inspected. The task tree was clean and no material overlap
  was found. Remote metadata was not fetched under the explicit no-hosted-calls
  restriction; no current remote-main claim is made by this correction session.

Authority for the hosted comparison is the director's fresh inspection supplied
in the task: exactly one trusted legacy identity; existing canonical/provider
linkage must match; exactly one active owner membership; missing/incompatible
linkage is rejected. This was not independently rechecked against hosting by the
coding agent. The original imported patch retains those same checks.

The single defect is that the prior Desktop correction used older local-suite
reconciliation expectations to weaken that contract. The current task explicitly
authorizes reversing that relaxation. Existing first-party admission and the
missing-pin NULL fix are preserved. No hosted operation is needed for this proof.

## Exact correction and source comparison

Only `workspace.ensure_personal_workspace()` changes behavior in this iteration:

1. Restore `if trusted_identity_count <> 1 then ... 42501` inside the legacy branch,
   before inspecting/creating the personal workspace. Zero identities are never a
   legacy shortcut, including callers with an existing workspace.
2. For an existing workspace, require all four predicates: `profile_count = 1`,
   `profile_canonical_subject` equals `canonical_subject::uuid`, `profile_provider`
   equals `provider_identifier`, and `owner_membership_count = 1` for an active owner.
   `IS DISTINCT FROM` retains rejection of NULL/missing canonical/provider linkage.
3. Remove the special legacy reconciliation upsert and its permissive zero-identity
   path. Existing missing linkage is not filled or relinked during sign-in.

Local source comparison reconstructed the SQL from the checksum-verified imported
patch and compared the entire provisioner body, normalizing line endings and the
already repaired statement terminator: `ORIGINAL_PROVISIONER_MATCH PASS`.
The entire `workspace_private.is_direct_session()` definition was compared with
commit `95f28f6`: `FIRST_PARTY_AND_COALESCE_UNCHANGED PASS`.

The forward local-validation migration and SQL review draft are byte-identical:

```text
docs/runbooks/preview-first-party-auth.sql.draft
supabase/migrations/20261014101027_preview_first_party_auth_local_validation.sql
tested working-tree SHA-256: 2f1cc3eb76a13bc52fd6e89061be54ecaf544c749902e635ed0ed2b63b507502
```

No historical migration was changed. This is the existing unshipped local review
candidate; it was not applied to a hosted project. No function/table/role/schema,
service, abstraction, dependency or permission was added.

## Local database proof

A new disposable project `preview-auth-integrity-20261014` used unused 594xx ports.
Only database and Auth containers were started with the repository's migration
history and local seed. There was no hosted link, imported hosted user/record or
credential. All 38 historical migrations plus the corrected forward candidate
applied: local ledger count 39.

```text
supabase start --exclude realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
supabase test db --local supabase/tests/database/preview_first_party_auth.sql
```

Affected fixture: **93/93 assertions PASS**, exit 0, one execution after correction.
Its prior 81 assertions remain, including dedicated first-party provisioning,
same-project canonical identity, repeat provisioning, missing-pin denial, wrong
client/issuer/audience/session, MCP separation and two-way tenant read/write denial.
Coherent legacy first provisioning and retry also continue to pass under
`authenticated`, without RLS bypass.

Twelve added assertions exercise six existing legacy workspace cases. Each checks
SQLSTATE/message from the supported provisioning RPC and compares an exact whole
profile/workspace/membership/plan/onboarding/task fingerprint before and after:

| Case | Denial observed | Graph unchanged |
| --- | --- | --- |
| Zero trusted identities | `42501`, verified identity required | PASS |
| NULL canonical/provider linkage | `42501`, integrity review required | PASS |
| Incompatible canonical subject | `42501`, integrity review required | PASS |
| No active owner membership | `42501`, integrity review required | PASS |
| Incompatible provider | `42501`, integrity review required | PASS |
| Missing profile | `42501`, integrity review required | PASS |

The fixture uses synthetic users/UUIDs and `example.invalid` addresses and rolls
back. Tested working-tree fixture SHA-256:
`a4a07de57c5ebf6a2c33b50aaed338d62130e1f19db8825b3607a3e97d1741f9`.
Archive manifests separately identify exact committed LF blob bytes; Windows text
newline normalization can change physical-file hashes without changing SQL.

## Unchanged historical suite: explicit conflicts

```text
supabase test db --local supabase/tests/database/workspace_productization.sql
```

Result: **67/70 pass, 3 fail**, exit 1. The suite is byte-for-byte unchanged at the
Git source level (`git diff --exit-code 95f28f6 -- <fixture>` passed).

| Assertion | Old expectation | Current required result | Disposition |
| --- | --- | --- | --- |
| 18 | A revoked-membership fixture without a trusted identity reaches the later membership error message | Earlier rejection: a verified legacy identity is required | Stale error-order/message expectation; denial remains 42501 |
| 20 | Existing owner with empty canonical/provider linkage is automatically reconciled | Reject missing linkage with integrity-review 42501 | Stale success expectation; no reconciliation is authorized |
| 21 | That call writes the canonical UUID into the empty profile | Profile remains NULL/unchanged after denial | Stale mutation expectation; preserved graph is the required behavior |

These are visible contract conflicts, not an all-green regression result. No test
was weakened or edited, and no product check was relaxed to satisfy them. Across
both runs 163 assertions executed: 160 passed, the three historical expectations
above failed. Updating those historical assertions is not part of this task.

## Preservation and cleanup

Local postflight found zero users/clients/sessions/workspaces/profiles/tasks/grants
and browser pins. Both test transactions rolled back. Existing MCP function body
fingerprints and ACLs matched the earlier baseline:

- `is_valid_mcp_request()`: MD5 `8bc0a52169788fe449ea645fdbdd6961`, postgres only.
- `custom_access_token_hook(jsonb)`: MD5 `cd5c09521c3a7e55715a08b4642d630c`,
  postgres and supabase_auth_admin.
- Provisioner/direct predicate owner remains postgres; EXECUTE remains
  postgres/authenticated. No test grants were added.

`supabase stop --project-id preview-auth-integrity-20261014 --no-backup` removed
only the task-owned disposable local containers/volumes. Prefix searches returned
no remaining entries. Temporary `supabase/config.toml` changes were restored.
No other local stack or worktree was modified.

Current code changes are confined to the SQL draft, matching forward candidate and
database fixture; supporting review/evidence documents are updated. No application
runtime or dependency changed. Earlier boundary/schema/type/lint/unit/build results
are historical supporting evidence and were not rerun for this SQL-only correction.
Current Git whitespace/source checks pass. The historical suite conflict remains
explicitly open rather than hidden by a combined passing status.

## Attempt history and hosted boundary

One bounded integrity-restoration change and one affected-fixture execution passed
on the first run. The prior reconciliation change is reversed because the director
supplied a current hosted authority comparison; this is not another attempt to
force old test expectations to pass. There is no repeated failed repair class in
this correction session.

No hosted CLI call, hosted query, hosted change/cleanup, push, PR, merge or deployment
occurred in this correction session. The owner previously reported that the earlier
CLI credential expired and no active connection using that role was visible. This
is owner-provided evidence, not a new inspection by this agent. The earlier incident
is retained in the historical report and is not erased by this correction.

Real hosted sign-in, cookies, concurrent renewal/rotation, sign-out and ChatGPT
acceptance remain NOT TESTED. At the time of this correction, no PR existed. See
the [current review runbook](../runbooks/preview-first-party-auth-review.md) for
current PR and exact-head review status. CodeRabbit review of the eventual exact
head remains required before a later merge. Next step is director/local security
review of this corrected export; strong security-capable model/high reasoning,
small, with no hosted operation required.
