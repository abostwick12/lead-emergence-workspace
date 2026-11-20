# F09 review repairs — 2026-11-20 UTC

IN SCOPE: Andrew approved all eight findings from CodeRabbit review `5976926901` on PR #124, including conditional native Discard and the one-line `package.json` overlap with PR #74. No merge, deployment, hosted migration, or production changes are authorized. This record supersedes the pending repair/scope stop in the earlier checkpoint; historical observations remain historical.

## Ownership and contract

Preflight refreshed Workspace and control-plane main. Workspace main remains `896ba4f0b28f0ece7dddd38fea092967f91498af`; repair base is `661f36b7d1417427b37f72a2d981d626f384c3dd`. Canonical instructions remain at `e126705fae6191fcab94f915e8cdafdca01935fc`. Current phase: authorized Phase 2/3, F09. Other worktree changes and current open PR file lists were checked; only the explicitly approved package overlap was found. PASS. Production refresh is not applicable to this local repair/review checkpoint.

The invariant remains one task per capture through the native transaction. Conditional native Discard changes only an unprocessed capture; a losing request reports the readable current state rather than claiming it discarded a processed capture. Existing authorization, schema, transaction function, policies and grants are unchanged. Legacy/direct clients remain outside the previously approved native-path guarantee.

## Eight accepted findings addressed

| Original finding | Repair and proof |
|---|---|
| `4630164544` — bounded-list recovery | Existing list methods accept optional exact-ID filters while retaining workspace filters. Pending capture and linked task reads use those filters. Caller assertions and browser capped-list recovery pass. |
| `4630164563` — rejected pending capture cannot exit | A rejected validation retry followed by successful unprocessed readback offers explicit, read-only **Return to inbox**. Other errors and unavailable readback retain pending identity. Browser positive and unavailable-readback controls pass; reload remains read-only. |
| `4630164572` — confirmed capture reappears | Confirmation immediately removes the capture and records its ID within the user/workspace scope. Later list responses filter those IDs independently of the current banner. Browser A-to-B failed/stale refresh test passes. Scope tokens prevent old workspace completions from changing the current view or busy state; workspace-switch regression passes. |
| `4630164581` — misleading task link | Confirmed title is separate text; navigation is labeled **Open task board**, matching `/workspace/tasks`. Browser assertions pass. |
| `4630164591` — subprocess output race | Local REST harness resolves on `close`, retaining spawn-error handling. Focused lint and actual HTTP race verification using the same close-based helper passed. |
| `4630164604` — fixture collisions | Each real browser fixture creates new capture UUIDs and a unique title marker. Both projects and a second execution on the same database passed with exact per-run counts. |
| `928e8341eaf6360d95bd7a73` — stale Discard | Native update filters workspace, capture ID, and unprocessed status, returns affected rows, and reads current state by ID after zero rows. Caller tests cover processed/discarded/missing/denied results. Actual-page stale-tab test passes against real local PostgreSQL/PostgREST on desktop and mobile. Direct authenticated HTTP tests prove conversion-first, discard-first, and simultaneous request behavior. |
| `3740d508f42058e1239294ff` — suite registration | One-line `test:rls` append registers `supabase/tests/database/native_capture_to_task.sql`, preserving every existing entry. The unchanged native SQL suite passes 57 assertions locally. The full unrelated RLS suite was not rerun. |

These are implementation results for the already accepted VALID — FIX dispositions, not new dispositions or approved deferrals. Fresh CodeRabbit review must cover the pushed repair head before the review gate passes.

## Validation

All six required repository commands exited 0: `npm run check:boundaries`, `npm run test:schema` (32), `npm run typecheck`, `npm run lint`, `npm run test:unit` (436 across 46 files, including 22 caller cases), and `npm run build`. `git diff --check` passed. Readability and scope: PASS in independent gpt-6-astra/high review of the actual completed diff; supervisor also inspected the diff.

With `E2E_BASE_URL=http://127.0.0.1:61800` and `F09_LOCAL_DATABASE=1`:

- `npx playwright test tests/e2e/capture-to-task.spec.ts`: [32 passed](f09/repair-browser-all.log), both projects, including four real-database cases.
- `npx playwright test tests/e2e/capture-to-task.spec.ts --grep 'real local'`: [4 passed again](f09/repair-browser-repeat.log) on the same database, proving fixture isolation across projects and repeats.

The fixture renders actual page/repository/React code with a synthetic account provider and a local PostgREST bridge; it is not a production login journey. Initial navigation and reads are intercepted locally, so no development web server or hosted app was used.

Actual HTTP race [readback evidence](f09/repair-discard-race.json):

- Conversion first: one task, capture processed with matching link; conditional Discard and repeated Discard each affected zero rows; retry returned the original task.
- Discard first: zero tasks, capture discarded with null link; conversion/retry rejected; repeated Discard affected zero rows.
- Concurrent requests: this execution committed conversion first, leaving one task and the original link; Discard affected zero rows; retry returned the same task. The two ordered controls establish both permitted outcomes.

The temporary race runner used the retained REST harness's `close`-based subprocess helper and sent an authenticated PATCH with the exact workspace/ID/unprocessed predicates asserted in caller tests. Browser stale-tab coverage separately exercises the actual native repository method. It recorded exact capture IDs, task counts, links and response outcomes. The first temporary runner invocation expected JSON from a default minimal insert response; adding `Prefer: return=representation` corrected only that test setup. No product failure was hidden or repaired under that error.

## Environment, attempts, and cleanup

The disposable database used cached PostgreSQL 15.8 and PostgREST v16.1 on internal network `f09-local-20261119`. The schema-only platform restore omits ACLs: initial fixture setup failed with auth-schema permissions. Read-only comparison against the existing local Supabase instance established the missing standard platform grants, including the Auth table owner's schema access. Those platform prerequisites were restored only in the disposable database; application authorization was not relaxed. The 57-assertion test then passed under authenticated test operations and rolled back. Synthetic HTTP/browser fixture data was created only in that disposable database.

Worker real-browser attempts were blocked at Docker pipe access before inserting data; supervisor reruns with local Docker access passed. These environment failures are separate from product validation. Existing optional sensitive-scanner fixture/history findings remain outside this repair; no scanner exceptions were added.

One review-repair implementation pass. A render-time ref pattern flagged by lint was corrected to scoped effect/memo handling before final checks. The SQL transaction was not rewritten; earlier SQL attempt history is unchanged.

Both containers were inspected for label `task=f09-20261119` and empty mounts, then removed by exact name (`f09-rest-20261119`, `f09-db-20261119`). The task's internal network was removed. A label-filtered container listing returned no task containers. Other local containers were not changed or stopped. Production/data impact: none.

## Exact changed files in this repair

- `app/workspace/capture/page.tsx`
- `lib/workspace/repository.ts`
- `tests/capture-to-task.test.ts`
- `tests/e2e/capture-to-task.spec.ts`
- `docs/testing/f09/local-rest-check.cjs`
- `package.json` (the approved one-line registration only)
- `docs/testing/f09-review-repairs.md`
- `docs/testing/f09-implementation.md` (pointer to this superseding checkpoint)
- `docs/testing/f09/repair-browser-all.log`
- `docs/testing/f09/repair-browser-repeat.log`
- `docs/testing/f09/repair-discard-race.json`

Outside-scope changes: none. BACKLOG — NOT PART OF CURRENT TASK: permanently inaccessible pending records still require restored access; historical duplicates/orphans, legacy direct writers, and existing scanner findings remain unmodified. Production acceptance is NOT TESTED, and F09 remains open. Final exact-head review/check evidence belongs in PR #124 and the handoff, avoiding an evidence-only commit after review.
