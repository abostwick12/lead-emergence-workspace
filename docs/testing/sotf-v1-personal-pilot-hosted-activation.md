# SOTF V1 personal-pilot hosted activation evidence

Date: 2026-09-14

## Accepted checkpoints and scope

- Accepted software: `88dedf0b12f491daae088c78a0c15be340493d10`
- Acceptance documentation: `182b7e10cc4219df75d7705e5f9b4379cabb31ae`
- Authorized target: `cirqqhuvzekbvysiyedg`
- Authorized operator: the existing Ministry repository migration authority
- Scope: Andrew's personal pilot only

The owner authorization permits the exact accepted migration delta, deployment
of the accepted Workspace runtime, Andrew-only bootstrap and entitlement,
feature activation, and a narrow authenticated Workspace/Lewis smoke test. It
does not permit Consulting changes, unrelated Entry or Ministry changes, a new
production stack, other-user activation, Professional Context/P2, unrelated
connectors, or unrelated hardening.

## Read-only live-state verification

| Boundary | Result |
| --- | --- |
| Workspace public origin | `https://workspace.leademergence.com` responds and redirects to the existing Workspace experience |
| MCP resource | `https://workspace.leademergence.com/api/mcp` returns the expected unauthenticated Bearer challenge |
| MCP authorization server | Live protected-resource metadata identifies `https://cirqqhuvzekbvysiyedg.supabase.co/auth/v1` |
| Ministry repository link | Existing `supabase/.temp/project-ref` is `cirqqhuvzekbvysiyedg`; it was not changed |
| Current Workspace production deployment | GitHub deployment `6401832979` succeeded from `e37d1e81d25a05f0fe2f7171ca437cbcb0d84513` on 2026-09-11 |
| Accepted runtime deployment status | `88dedf0b12f491daae088c78a0c15be340493d10` is not in the deployed commit's history and is not on a remote branch |
| Identity topology | Live Workspace MCP metadata confirms the authorized Ministry-backed topology; no redirect to Entry Supabase was observed or attempted |

The deployed `main` line and accepted SOTF line share
`56680058c076828d0de482fca66cbf75678cd6a1` as their merge base. The accepted
line was not merged with later production code during this run.

## Authoritative migration ledger and delta

The already-linked Ministry authority ran a read-only remote migration-list
operation. These accepted SOTF foundations are already recorded remotely and
must not be reapplied:

- `20260902162536_bundle_entitlement_foundation.sql`
- `20260906120000_sotf_operational_workflows.sql`

The exact missing accepted delta is:

| Migration | SHA-256 |
| --- | --- |
| `20260911143000_sotf_v1_daily_brief_slice.sql` | `89cd445fcad860209390b99ef910355305b998e88917048049e66e83d1b6d9fa` |
| `20260912162000_sotf_v1_outcome_semantic_parity.sql` | `6ccc13f81bb420c56a85ce1e373d0865f5715fe6a495636b44e57a339cda3c78` |
| `20260912190000_sotf_v1_unicode_truncation_parity.sql` | `751d2890370d8bc96a983229263855e625d03375c197c216de7c819ab9fe8350` |
| `20260913110000_sotf_v1_canonical_ordering_parity.sql` | `66ac0c10e4650e8131f0082b60dd39519aff9cebcba9f84c0fdd1b4da2cf5bdd` |
| `20260913150000_sotf_v1_reference_parsing_parity.sql` | `e5fd9e02389ed29867c59f910943f4b51a0e8ed71978159240640f944da1fedf` |
| `20260913200000_sotf_v1_time_zone_identifier_contract.sql` | `b3b2b247c7c1cf829ab0fc8dfeed7154f14eb3de4379c188229ca9d2405ea3cf` |
| `20260913213000_sotf_v1_time_zone_boundary_authority.sql` | `2e360569b345feb853d74012d36da8c3645af64398e390e926ae3132a548c520` |
| `20260914010000_sotf_v1_temporal_authority_consolidation.sql` | `3ac7360743af3d15e57327e3cfa4156e83f2ba4892d51be8cc0f5efb54dd9847` |

Immediately before mutation, the live ledger was re-read and the delta was
unchanged. An isolated clean Ministry `main` checkout at
`c96537b49a46bab50efeded1ae5c4aa2ad5632a4` supplied the migration-operator
boundary. Its dedicated temporary operator directory contained version-only
comment placeholders for already-applied remote history and the eight accepted
SQL files above. No file in the active dirty Ministry worktree was changed.

The operator dry run listed exactly the eight migrations above, with no roles,
seeds, vault changes, or other migrations. The production push then applied all
eight successfully in order. A postflight ledger read confirmed local/remote
parity for every version through `20260914010000`. No migration outside this
set was selected or applied.

## Backup and rollback gate

The read-only Supabase backup inventory for `cirqqhuvzekbvysiyedg` returned:

- `backups: null`
- `physical_backup_data: {}`
- `pitr_enabled: false`
- `walg_enabled: true`

Therefore no provider-managed recovery identifier was available. Andrew then
explicitly authorized one logical export to
`C:\Users\awbostwick\Documents\Lead Emergence Backups\SOTF V1\` and authorized
the sensitive shared-production contents required for recovery.

Before writing, the destination was verified as the direct Windows Documents
known folder rather than a reparse point or redirected OneDrive location.
Google Drive's root-preference database contained no configured mirror roots,
and the destination is outside the OneDrive and iCloud Drive roots. The sync
coverage gate passed.

Recovery identifier:
`sotf-v1-preactivation-cirqqhuvzekbvysiyedg-20260914T140354Z`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `roles.sql` | 506 | `088c1773b83a9729e74b30611675c4fd95d39a629360934ec97ac09645876e29` |
| `schema.sql` | 1,638,162 | `47aa204107c788d1510a6c915687c3593d17c01210c4e50032f896185ee238c0` |
| `data.sql` | 2,488,641 | `ce601c8cf201baad232a07f211c239e6405c50b12b66d773ad12b96c6f23d316` |
| `migration-history-schema.sql` | 1,116 | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| `migration-history-data.sql` | 1,208,805 | `d63fea84f22c27ec5f10c08406bdaefdf0d85dc1d67fb263584f602f1db272fc` |
| `manifest.json` | 3,082 | `c260fa15aa7fd77093bacb30201bdf31b4bf848b29ad2dac321437c8aa5d93ed` |

All expected artifacts exist and are non-empty. Non-mutating validation found
the expected Supabase/PostgreSQL SQL structures, COPY terminators where
applicable, no NUL bytes, and the preflight migration state: `20260902162536`
and `20260906120000` present, with all eight pending versions absent. Production
rows were not printed into this evidence.

The data dump reported circular foreign-key dependencies in existing non-SOTF
tables. The manifest therefore requires a reviewed constraint-safe restore
sequence on an isolated recovery target. This warning does not affect dump
readability or completeness; it prevents treating a naive ordered replay as a
validated restore procedure.

Inherited ACL access was removed recursively. Full control is limited to
`SENSENET\awbostwick` and `NT AUTHORITY\SYSTEM`; seven files/directories were
processed with zero ACL failures. The backup was not uploaded, synchronized,
published, committed, or transmitted.

Once established, rollback remains: disable the feature flag, revoke only
Andrew's SOTF entitlement, restore the prior immutable Workspace deployment,
leave additive database structures locked in place, and use a reviewed forward
migration for any schema correction. The backup is the recovery checkpoint for
unexpected data loss or corruption, not authorization for a destructive
down-migration.

## Mutation and cleanup state

- Hosted database mutations: the exact eight-migration SOTF V1 delta applied
- Hosted Auth/entitlement mutations: zero
- Hosted environment changes: zero
- Deployments: zero
- Pushes, PRs, and merges: zero at this evidence checkpoint
- Entry, Consulting, and unrelated Ministry changes: zero
- Backup/export files created: one authorized local recovery set; no remote copy

## Activation resume point

The backup/recovery and migration gates are satisfied. Proceed with direct
publication and deployment of the accepted Workspace runtime, then Andrew-only
bootstrap, feature activation, and the authorized narrow authenticated smoke
test. A proposed local merge with current `main` was rejected by the execution
safety layer and was not attempted again; no merge state was created. The
runtime deployment must therefore use the accepted branch directly rather than
altering `main`.
