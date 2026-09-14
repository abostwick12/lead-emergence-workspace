# SOTF v1 migration line-ending portability repair

Status: local repair evidence.

Frozen base: `c2e29c2e77d20c2f4e40038b7d70af264e1101a7`

## Defect and repair

`20260914010000_sotf_v1_temporal_authority_consolidation.sql` reads the prior `sotf_v1_daily_brief_projection_semantics` function source and replaces its former return expression. The migration normalized the captured `prosrc` body from CRLF to LF before performing its strict source-shape comparison, but left the multiline dollar-quoted `old_return` literal in checkout-native line endings. A Windows CRLF checkout therefore compared an LF body with a CRLF literal and correctly raised `sotf_v1:unexpected_projection_authority_source` (`SQLSTATE 55000`) on a fresh migration replay.

The repair keeps both source-shape guards intact and makes the comparison line-ending invariant:

```sql
body := replace(body,E'\r\n',E'\n');
old_return := replace(old_return,E'\r\n',E'\n');
new_return := replace(new_return,E'\r\n',E'\n');
```

The migration still fails closed when the normalized prior source does not contain the exact expected `old_return`, and still fails closed if replacement leaves `old_return` behind or fails to introduce `new_return`. The temporal trigger, exact timestamp contract, authority projection, fingerprint, token, and MCP transport architecture were not changed.

`tests/schema-policy-contract.test.mjs` now locks all three normalizations plus the retained `unexpected_projection_authority_source` guard.

## Same-class migration-chain audit

Searched every SOTF migration and database test for `prosrc`, `pg_get_functiondef`, raw source/replacement literals, `position(... in body)`, `replace(...body...)`, and source-shape exception guards. The only confirmed line-ending-sensitive raw function-body comparison is the repaired `old_return` comparison in `20260914010000_sotf_v1_temporal_authority_consolidation.sql`.

Other `pg_get_functiondef` uses are assertions about semantic contents such as Unicode normalization or ordering helpers; none reads a prior function body and rewrites it by raw multiline substring. No other migration was changed.

## Independent fresh checkout proof

Both checkouts began as new detached worktrees at the frozen base, received the identical uncommitted two-line migration repair and regression assertion, and used local disposable Supabase services only.

| Property | Fresh CRLF checkout | Fresh LF checkout |
| --- | --- | --- |
| Worktree | `.sotf-local/migration-line-ending-portability-repair` | `.sotf-local/migration-line-ending-portability-lf` |
| Migration worktree EOL | `i/lf w/crlf` | `i/lf w/lf` |
| Normalized repaired migration SHA-256 | `072adbd29b5ba5adc3737d9674c53623223f47468a29d54f02a7bf609a98458a` | same |
| Fresh migrations through `20260914010000` | pass | pass |
| Full DB/RLS | 1154/1154 | 1154/1154 |
| Focused SOTF pgTAP | 911/911 | 911/911 |
| Units | 236/236 | 236/236 |
| Schema contracts | 41/41 | 41/41 |
| Typecheck, lint, build | pass | pass |
| Database lint, boundary scan | pass | pass |
| Sensitive scan, whitespace | pass | pass |

The CRLF and LF runs produced the same normalized PostgreSQL function definitions:

| Function | CRLF normalized MD5 | LF normalized MD5 |
| --- | --- | --- |
| `workspace_private.sotf_v1_daily_brief_projection_semantics(uuid,date,text)` | `dbf2b061d968422e947ab49c3d37d9da` | `dbf2b061d968422e947ab49c3d37d9da` |
| `workspace_private.sotf_v1_daily_brief_boundary_authority(uuid,date,text)` | `4c76f72459a6de7a8c239a2b5ca4cae5` | `4c76f72459a6de7a8c239a2b5ca4cae5` |

PostgreSQL retained CRLF bytes in the raw boundary-authority definition in the CRLF run (`25f71b06df15aba8bcbd503dcf417c37`) and LF bytes in the LF run (`4c76f72459a6de7a8c239a2b5ca4cae5`). Normalizing `pg_get_functiondef` proves the resulting definitions are semantically identical; the matching authority behavior below independently confirms it.

## Temporal authority and precision proof

The local temporal runner passed in both checkouts with 47 time-zone cases, 17 matching handler/RPC accepts, 33 matching denials, and zero residual users, workspaces, outcomes, events, or audits.

Both runs reproduced the 499 microsecond regression successfully:

- PostgreSQL retained `2026-09-14T00:00:00.000001Z` and `2026-09-14T00:00:00.000500Z`.
- The database accepted the positive 499µs interval and returned eligible bounded membership.
- PostgREST and JavaScript retained the exact six-digit timestamp strings.
- Canonical replay was exact; MCP bounded-state read succeeded; handler and RPC accepted.
- Persistence recorded one outcome and the exact retry returned an identical receipt without duplication.
- Zero and negative microsecond intervals were denied without mutation.

The runner also preserved the `America/Asuncion` Node/PostgreSQL window disagreement: Node/ICU produced `2026-09-15T03:00:00.000Z`, PostgreSQL produced `2026-09-15T04:00:00.000Z`, and the MCP projection used the PostgreSQL authority result in both checkouts.

The CRLF replay additionally reran the frozen cross-runtime non-temporal differentials: Unicode 212/212 decisions, canonical ordering 31 accepts and 31 denials on both boundaries, and exact decoded-reference matching 1 accept/29 denials on both boundaries. All synthetic fixture cleanup counts were zero.

## Cleanup and scope

Each disposable local stack was stopped with `supabase stop --no-backup`; final filtered Docker container and volume listings for `lead-emergence-workspace-local` were empty. No hosted Supabase action, deployment, push, merge, pull request, or production access occurred. The LF worktree exists only as isolated proof material. This repair worktree contains only the migration change, its schema-policy regression assertion, and this report.

**SOTF V1 MIGRATION LINE-ENDING PORTABILITY REPAIR COMPLETE — REQUEST COMMIT AUTHORIZATION**
