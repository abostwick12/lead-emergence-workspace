# MCP Memory reader validation

## Change scope

Restore only `workspace.mcp_list_memory(text,integer)` in one additive migration. Preserve the existing reader contract from `20260828000252_lewis_workspace_parity_actions.sql`, the current capability guard, workspace and creator filters, bounded inputs, and authenticated-only execution. Notify PostgREST to reload the schema using the established migration convention.

No application handler, existing migration, capability guard, Auth, RLS, table, role, configuration, or provider-classification change is included. The historical multi-object migration is not replayed. The separate integration reader is outside this change.

Production observations and operator-specific diagnostics are retained privately and excluded from this public source change. The repair is prepared through review only; this document does not authorize merge, hosted migration application, deployment, or production acceptance.

## Supporting validation

`npm ci --ignore-scripts --offline` installed existing lockfile dependencies without manifest/lockfile changes. No new dependency was added.

With `MCP_MEMORY_TEST_DATABASE_URL` set to an existing loopback test database, `node --test tests/mcp-memory-reader.integration.test.mjs` passed seven tests. It temporarily drops only this function, applies the migration inside a transaction, invokes the SQL reader under authenticated/anonymous roles, and checks:

- recovery from a missing function, deterministic owned records, and preserved response fields;
- exclusion of another workspace and another creator in the same workspace;
- page bounds, domain filtering, and empty results;
- denial for anonymous, ordinary browser, wrong audience, disabled Memory capability, disconnected connection, and revoked grant;
- unchanged Memory rows, rollback of the function change, and removal of synthetic test users.

The test refuses remote database hosts and skips without the explicit loopback database variable. Fixtures contain only synthetic `.invalid` accounts and synthetic Memory records. All changes roll back. It uses the existing local guards; it does not certify the latest hosted OAuth contract, billing lifecycle, schema cache, or customer acceptance. Fresh-stack/full-migration replay was not run.

Passing checks:

- `npm run check:boundaries`: 95 runtime files.
- `npm run typecheck`, `npm run lint`, and `npm run build`.
- `npm run test:unit`: 207 tests across 26 files.
- Focused PostgreSQL test: 7/7; final changed-test ESLint check and `git diff --check`.

## Unchanged validation failures

`npm run test:schema` passed 31/32. The existing `gates native and MCP SOTF presentation with the same fail-closed entitlement` assertion expects inline `SOTF_PILOT_ENABLED` in `app/workspace/sotf/page.tsx`, which delegates to `connectedSotfExperience()`. The test and page are unchanged from the base. No adjacent repair was made; this remains an unmet required check.

`npm run scan:sensitive` flags an existing synthetic assigned secret-like value in `tests/personal-authority-projection.test.ts` and historical versions of that file. This change edits neither that file nor history and adds no credentials or customer payloads. The scanner identified no newly added repair file. No scanner exemption was introduced.

During test development, the synthetic audience was corrected to the local configured resource and the synthetic revoked grant was supplied with the existing required `revoked_at` field. Neither correction changed the reader body or access guard.

## Review and acceptance limits

CodeRabbit must review the exact current PR head; unresolved blocking findings prevent merge. This document does not claim review passed. The existing failed required check also prevents declaring the change merge-ready.

A separately approved hosted application must be followed by an authorized intended-host Memory read and confirmation that unauthorized identities remain denied. Local tests are supporting evidence, not production acceptance. Hosted application must use the established migration authority; this task does not run `supabase db push`, migration repair, or deployment.

Validation is recorded in this separate file to avoid changing another active task's shared `docs/testing/test-evidence.md`.
