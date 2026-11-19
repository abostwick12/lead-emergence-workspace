# F09 local implementation checkpoint — 2026-11-19

## Publication approval — supersedes the earlier stop point

Andrew subsequently authorized committing, pushing, opening the F09 PR, completing exact-head CodeRabbit review, and required checks. Merge, deployment, production migration, and production changes remain prohibited. The local checkpoint below is preserved as historical evidence; its base HEAD and earlier publication prohibition describe that earlier checkpoint, not the current authorization.

Publication preflight: remote main remains `896ba4f0b28f0ece7dddd38fea092967f91498af`; 154 other existing worktrees were checked for changes to the native capture boundary with zero failures or overlaps. The same ten open PR file lists still have no overlap with this change set. Parallel-work result: PASS. Shared evidence ownership remains unchanged, so this task-specific record is used.

Current authorized phase: Phase 2/3, with F09 explicitly approved. Current task observable: a bounded published PR with required checks and a completed CodeRabbit review whose reviewed SHA equals the final PR head, with every finding adjudicated. Production refresh is not applicable to this publication-only checkpoint. Cheapest falsifier of readiness is an overlapping owner, changed base, failed check, stale review, or unresolved blocking finding; these are checked before claiming review completion.

Independent publication audit (gpt-6.1-sol/high; the prescribed lower-cost luna model is unavailable) inspected the actual diff and evidence. Readability: PASS. It identified stale checkpoint wording, addressed by this explicit historical/current distinction. No product changes were needed. Required-check results below apply to the unchanged product content; current PR head, remote checks, and CodeRabbit dispositions will be recorded in the PR and final handoff rather than creating a post-review commit that makes the review stale.

Publication validation reran all six required commands: `npm run check:boundaries`, `npm run test:schema` (32), `npm run typecheck`, `npm run lint`, `npm run test:unit` (428 across 46 files), and `npm run build`; every command exited 0. `git diff --check` passed. Local command logs are under ignored `test-results/f09-checks/publish-*.log`. The earlier real persistence/browser evidence remains applicable because product and database code did not change.

## Historical local-only checkpoint

Result: PARTIAL. Production acceptance: NOT TESTED. The approved implementation and local testing are complete; nothing was published, committed, merged, deployed, or applied to production. F09 remains open.

## Authorization and ownership

Andrew approved implementation and local testing of one native transaction function with first-commit-wins retries, after ownership clearance. Workspace branch `codex/f09-investigation-20261119`, worktree `.f09-investigation-20261119`, HEAD and remote main `896ba4f0b28f0ece7dddd38fea092967f91498af`. Final `git ls-remote origin refs/heads/main` returned that SHA. Ten open PR file lists (#110, #74, #70, #62, #61, #60, #58, #44, #11, #10) and active worktree changes were checked before editing. No overlap with the capture page, repository caller, or new function was found. Shared `docs/testing/test-evidence.md` is owned by other PRs and was not edited. No other worktree was edited.

## Production evidence and limit

No production behavior acceptance was performed. Earlier read-only deployment lookup returned READY production `dpl_8WMQeAUbuD1GpQYB7NMtfWE49QPi` at the same base SHA (`GET /v13/deployments/workspace.leademergence.com?withGitRepoInfo=true&teamId=team_qEmWEp6Jzhtb2XP5c1jL9FB3`). The new native function is local only.

A read-only catalog query at `2026-11-19 13:50:21.743522+00` showed authenticated lacks `workspace_private` schema USAGE, has auth schema USAGE, and has EXECUTE on the existing owner/capability helpers. No hosted grants or data changed. The final invoker function relies on the existing capture/task row-lock policies instead of calling inaccessible private-schema names. PostgreSQL [CREATE POLICY documentation](https://www.postgresql.org/docs/15/sql-createpolicy.html) specifies that SELECT FOR UPDATE also applies UPDATE USING policies. Local lock checks and revoked-capability/direct-session tests exercised that boundary. No existing policy, helper, or schema grant was modified.

Canonical control-plane status was not edited: this approval covers Workspace implementation/local testing only. The prior proposal retains the canonical-document follow-up boundary.

## Change

`workspace.resolve_capture_to_task(uuid, uuid, text)` locks the capture, creates the task and links the capture in one transaction. A retry locks and returns the original linked task without changing its fields. Missing or inaccessible links never create replacements. Failed linkage rolls back the task and audit effects. The function is SECURITY INVOKER with empty search_path and authenticated-only EXECUTE.

The native caller makes one RPC. The page distinguishes confirmed, rejected, and uncertain outcomes, retains only the pending capture ID in user/workspace-scoped session storage, and offers explicit status/retry actions. Reload reads the capture and linked task without another write. Confirmation remains visible if inbox refresh fails. Existing quick-capture modal behavior is untouched.

## Local proof

All records below are synthetic and local. Tests are supporting evidence, not production acceptance.

| Case | Evidence and result |
|---|---|
| Normal conversion | pgTAP and REST readback: one task, processed capture, matching link. |
| Failure between insert/link | pgTAP fault trigger and zero-row update: no task or audit residue; capture unchanged; clean retry succeeds. |
| Lost response after commit | Actual browser test used local PostgreSQL/PostgREST, then aborted the browser response after the RPC committed. Retry returned the same persisted task. |
| Sequential retry | REST: same task ID, total one per capture. |
| Double activation | Browser same-tick activations issued one request; independent REST concurrency also created one task. |
| Concurrent sessions | Six concurrent HTTP requests with distinct synthetic session claims: one new task, five already-processed results, one shared task ID. |
| Reload | Real browser dropped a second committed response, then reload recovered the persisted link with zero new RPCs. Two marked captures had exactly two tasks. |
| Already processed | Same original link; deleted/missing linked task fails without replacement. |
| Unauthorized/missing/second tenant | pgTAP plus REST two-way denial and legitimate tenant-B positive control; no foreign task created or returned. |
| Conflicting inputs | Changed-domain retry returns first task unchanged; stale browser-tab selection explicitly reported as unapplied. |

Retained outputs: [57 pgTAP assertions](f09/pgTAP-final.log), [real REST readbacks](f09/rest-results.json), [real-database browser result](f09/browser-real.log), [16 desktop/mobile browser results](f09/browser-final.log), [production build](f09/build.log).

The synthetic browser fixture renders the actual page and repository with a stub provider/client; it is not a complete hosted login journey. Its two-tab case is sequential within one browser context. Independent concurrent database evidence comes from the REST harness, not that two-tab case.

## Validation commands and results

- `npm run test:unit`: 428 passed across 46 files (14 new caller cases included).
- `npm run test:schema`: 32 passed.
- `npm run check:boundaries`: scanner and 5 assertions passed.
- `npm run lint`: passed; final focused ESLint on changed TypeScript and retained CJS harness also passed.
- `npm run typecheck`: passed again after final browser test additions.
- `npm run build`: passed, including static generation of `/workspace/capture`.
- `git diff --check`: passed.
- pgTAP: prepend `set search_path=public,extensions;` to `supabase/tests/database/native_capture_to_task.sql`, pipe into `docker exec -i f09-db-20261119 psql -U postgres -d f09_test -v ON_ERROR_STOP=1`: 57/57, transaction rolled back.
- `node docs/testing/f09/local-rest-check.cjs`: retained portable copy of executed harness; original execution path was the task temporary directory. Six concurrent authenticated HTTP sessions and state counts passed. It requires the specifically labeled disposable containers and a freshly initialized fixture database.
- With `E2E_BASE_URL=http://127.0.0.1:61800`, `npx playwright test tests/e2e/capture-to-task.spec.ts --grep-invert 'real local'`: 16 passed across desktop/mobile. With `F09_LOCAL_DATABASE=1`, `--project=desktop --grep 'real local'`: one actual database/browser test passed. The test title for the two-tab case was subsequently clarified without changing behavior.
- Historical synthetic characterization: six cases passed before the harness was moved outside default test discovery to `tests/f09-investigation.characterization.ts`. It loads the immutable base-SHA caller; it is historical evidence, not an integrity test of the fixed implementation.

Pre-existing failures: `npm run scan:sensitive` failed on secret-like synthetic values in unchanged `tests/calendar-account-credentials.test.ts`, `tests/calendar-account-oauth.test.ts`, `tests/google-calendar-events.test.ts`, `tests/google-calendar-freebusy.test.ts`, `tests/personal-authority-projection.test.ts` and reachable Git history. `git diff HEAD --` for these five paths was empty. No listed finding was in F09 changes. No scanner exception or neighboring fixture was changed.

Environment failures, separate from product defects: the installed Docker engine initially was not running; an initial CLI database startup was unreachable on the isolated network. The cached bare PostgreSQL image lacked current auth/storage bootstrap columns. A schema-only dump from an existing local Supabase instance supplied platform schemas (no data); current repository migrations then applied successfully to a new disposable database. Only local standard auth/extension schema usage needed by that fixture was established; workspace_private usage remained absent. No historical migration source was edited.

## Local environment and cleanup

Docker Desktop was started and dependencies installed in this worktree with `npm ci --ignore-scripts --no-audit --no-fund`; the lockfile did not change. The database used cached PostgreSQL 15.8 and PostgREST v16.1 images on internal network `f09-local-20261119`. Both containers carried label `task=f09-20261119`, had no mounts, and contained only disposable synthetic task data.

After retaining evidence, exact ownership was inspected, then `docker rm -f f09-rest-20261119 f09-db-20261119` and `docker network rm f09-local-20261119` succeeded. A label-filtered `docker ps -a` returned no task containers. The schema-only temporary dump created in the existing local container was removed at its exact path. Other local containers were not changed or stopped. The local dev server stopped; generated `next-env.d.ts` returned to its original content. Docker remains running. No production/data impact.

## Exact file manifest

Modified product files:
- `app/workspace/capture/page.tsx`
- `lib/workspace/repository.ts`

New implementation/tests:
- `supabase/migrations/20261119134404_native_capture_to_task.sql`
- `supabase/tests/database/native_capture_to_task.sql`
- `tests/capture-to-task.test.ts`
- `tests/e2e/capture-to-task.spec.ts`
- `tests/f09-investigation.characterization.ts` (preserved investigation harness, renamed before any commit)

Task evidence:
- `docs/testing/f09-proposal.md`
- `docs/testing/f09-reproduction.txt`
- `docs/testing/f09-implementation.md`
- `docs/testing/f09/live-authorization.json`
- `docs/testing/f09/live-existing-paths.json`
- `docs/testing/f09/pgTAP-final.log`
- `docs/testing/f09/rest-results.json`
- `docs/testing/f09/browser-real.log`
- `docs/testing/f09/browser-final.log`
- `docs/testing/f09/build.log`
- `docs/testing/f09/local-rest-check.cjs`

Outside-scope product changes: none. No F06, F10, deduplication, MCP repair, shared policy/helper or access change.

## Attempts, review, and remaining boundaries

One failed SQL draft explicitly referenced private helpers without schema USAGE. The corrected draft uses existing RLS row-lock authorization and passes. Two variants, one failed attempt; no third variant. Earlier unrecorded attempts remain unknown. Independent gpt-6-astra/high review found no actionable blocker in final SQL/caller/UI or evidence; root inspected the actual diff and independently exercised the local database and browser checks. CodeRabbit exact-head review is NOT RUN because nothing may be published at this checkpoint.

BACKLOG, not fixed: permanently unavailable pending captures can block other conversion buttons until resolved; no abandon/release-pending contract was approved. Historical orphan tasks and stale pre-release clients are not repaired. Sensitive-scanner fixture/history findings remain. Canonical status append remains a separately scoped follow-up.

Next step: PM may authorize publication for required exact-head review. That does not authorize merge, hosted migration, deployment, or production testing. Ordinary implementation model tier is sufficient for preparing publication; stronger review remains appropriate for authorization/database review. Size: small. Stop here pending separate authorization; no PR or new commit exists.
