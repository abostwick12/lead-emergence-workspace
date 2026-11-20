# F09: native capture-to-task proposal checkpoint

Status: proposal only; no product implementation or production mutation. F09 acceptance NOT TESTED.
Date: November 19, 2026, America/Chicago.

## Scope and current evidence

IN SCOPE: the native Make task operation, its recovery message, focused tests, and this evidence packet. Stop here for approval. F06 modal, F10, auth policies, billing, entitlements, other workflows, historical data repair, publication and release are excluded.

VERIFIED: remote Workspace main and the canonical production deployment both identify `896ba4f0b28f0ece7dddd38fea092967f91498af`. `git ls-remote origin refs/heads/main` returned that SHA. The authenticated Vercel CLI 60.1.3 GET `/v13/deployments/workspace.leademergence.com?withGitRepoInfo=true&teamId=team_qEmWEp6Jzhtb2XP5c1jL9FB3` returned READY production deployment `dpl_8WMQeAUbuD1GpQYB7NMtfWE49QPi`, project `prj_ANnBP1Pxceok4uezHzHPjOTs2cCb`, with that Git SHA. Connector requests returned 404; the CLI read succeeded. This proves deployment metadata, not execution acceptance.

VERIFIED: canonical control-plane main is `e126705fae6191fcab94f915e8cdafdca01935fc`, refreshed using its remote and inspected with `git show`. Its roadmap authorizes Phase 2/3 with broader acceptance open. This task is the explicitly selected F09 readiness investigation. Its latest decisions preserve bounded F01/F06 acceptance. Local old roadmap/state copies in the root Workspace checkout are not current authority.

VERIFIED: the current call chain is `app/workspace/capture/page.tsx:17` -> `lib/workspace/repository.ts:108` -> `createTask` at line 52 -> an independent capture update at lines 121-125. The page receives workspace/user from Workspace context, checks the quick_capture capability for display, and supplies capture ID, workspace ID, user ID, raw text and selected domain. The repository uses the browser's normal Supabase session (`lib/supabase/client.ts`), inserts the task with a generated ID, then updates the capture. The update filters only by capture ID and checks errors, not affected-row count. The page catches the exception and leaves the stale entry available; it has no operation identity or pending/recovery state. Separate calls can overlap.

Claim tested: a retry can create another task because creation and linkage are separate operations. Cheapest falsifier: an atomic operation or duplicate guard in current deployed source. Result: neither is present. The isolated reproduction imports this exact unchanged repository. See [reproduction](f09-reproduction.txt) and `tests/f09-investigation.test.ts`. Its file-backed synthetic transport is not PostgreSQL/PostgREST/RLS; it establishes the current caller's behavior under controlled responses, not database integrity.

VERIFIED live metadata: read-only SQL on `cirqqhuvzekbvysiyedg` at 11:28:04Z found `workspace.mcp_resolve_capture` count **0** and no function matching resolve_capture in any schema. The audit's existing path is present in historical/current migration source, not in this live catalog. Do not apply that old migration or label its absence a separately diagnosed defect. The newest returned migration ledger entry was `20261018234519 / networking_week_review_append_allowlist`.

VERIFIED live authorization and constraints at 11:31:15Z and 11:32:08Z are retained in [authorization](f09/live-authorization.json) and [existing paths](f09/live-existing-paths.json). These are catalog/definition reads only. No customer task or capture payload was read. Last real production conversion, prior successful conversions, and retries since release remain unknown; no production fault was induced.

## Existing paths considered

| Path | Evidence and reason it cannot close F09 unchanged |
|---|---|
| Current direct table calls | Two distinct requests and random task IDs; a retry repeats INSERT. A button lock or browser-local mutex does not cover another session or a lost response. |
| `workspace.mcp_resolve_capture(uuid,uuid,text)` | Absent live. Source `20260828000252_lewis_workspace_parity_actions.sql:83-185` supplies a useful receipt/row-lock transaction pattern. Its MCP admission requires MCP client/resource/grant claims; direct browser sessions deliberately lack those. No permission or admission change is proposed. |
| Live `workspace.mcp_create_task(text,uuid,text,text,date,text)` | Requires MCP task authority and client-scoped receipts, creates a task but does not link a capture. It cannot solve the second write or serve native credentials unchanged. |
| Existing task primary key / `(workspace_id,external_source,external_id)` uniqueness | Could constrain a deterministic task identity, but neither atomically sets capture status/link. A split recovery state still needs a defined protocol; existing code does not set provenance fields. More steps and uncertain-state handling than one native transaction. |
| `workspace.sotf_append_operation(jsonb)` | Its source writes SOTF operation heads/events, not native tasks/capture_inbox. Reusing it would change another persistence model and authorization boundary. |
| MCP receipt table | Client-scoped and privileged; using it for native calls would broaden unrelated authority. Capture-once semantics can reuse the existing capture row instead. |

Live function discovery searched names containing capture/task/operation/transaction and bodies mentioning both capture_inbox and tasks. The retained catalog lists no supported native combined operation. This is the basis for requesting one new function, not a preference for a new abstraction.

## Smallest proposed change — approval required

SCOPE CHANGE — PM APPROVAL REQUIRED: add exactly one RPC:

`workspace.resolve_capture_to_task(target_workspace_id uuid, target_capture_id uuid, task_domain text DEFAULT 'general') RETURNS jsonb`

Use PL/pgSQL, `SECURITY INVOKER`, `VOLATILE`, empty search path and qualified object names. Revoke default PUBLIC/anon execution; grant execution only to authenticated. No new table, column, role, schema, dependency, service, shared helper, or policy change. No service-role credential. Existing authenticated table permissions and RLS remain authoritative.

Proposed files:

- `lib/workspace/repository.ts`: replace only native resolveCapture's split writes with this RPC; return a typed result in this file. Leave generic createTask unchanged.
- `app/workspace/capture/page.tsx`: show pending/confirmed/uncertain/recoverable state and a linked-task result; retain the capture ID for recovery. No modal changes.
- `supabase/migrations/<CLI-generated timestamp>_native_capture_to_task.sql`: exactly this function and its execution ACL. Filename is assigned by the existing CLI after approval; no migration has been generated.
- `supabase/tests/database/native_capture_to_task.sql`: authenticated database boundary fixtures, rollback and denial assertions.
- `tests/capture-to-task.test.ts` and `tests/e2e/capture-to-task.spec.ts`: caller/recovery behavior, reload, controlled lost response, two browser sessions. Reuse existing test/runtime dependencies.
- `docs/testing/test-evidence.md`: focused evidence entry only after ownership clearance. This shared file is already touched by open PRs #10, #61 and #74; do not edit it without resolving that ownership. Until then retain the task-specific evidence packet here.

The benefit is that a user can retry an uncertain conversion without creating a second task. Leaving the current calls unchanged retains the reproduced duplicate/unlinked-task behavior.

## Authorization, transaction and retry contract

1. Validate nonnull IDs and require the existing owner predicate and both tasks/quick_capture capabilities, failing closed. Live `is_workspace_owner` includes direct-session authority, effective Personal access and active owner membership. Live `is_direct_session` rejects nonempty client_id and workspace_mcp=true. Do not modify those helpers.
2. Select the capture for the supplied workspace and authenticated creator under existing RLS with `FOR UPDATE`. Missing and unauthorized captures receive the same non-revealing failure. Do not accept userId or rawText as write authority.
3. For an unprocessed capture, validate the selected domain, derive the title from stored raw_text using the current trim behavior, insert one task, and set capture status/link in the **same database transaction**. Require one updated capture row. Any error aborts the whole transaction, including the task and transactional audit effects.
4. Preserve original raw_text unchanged. Preserve native conversion fields: selected domain, trimmed title, medium priority, default todo status, null due date/description and existing tags defaults. This converter does not currently offer priority/date/description inputs. A title over the existing 240-character limit produces an explicit recoverable validation failure with no writes; do not silently truncate content or modify generic task creation.
5. If already processed and its task is readable in the same workspace, return that task and `already_processed=true`, with no writes. If discarded, processed with a null link, or linked task unavailable, return an explicit failure and create nothing. A deleted linked task must not cause automatic replacement.
6. Stable logical identity is **(workspace_id, capture_id)**. It is server-persisted before conversion and shared across reloads, tabs and sessions. The capture-row lock serializes contenders; there is no per-click random request ID. Losing contenders read the committed link. A transient transaction abort can be retried with the same capture ID.
7. **First committed conversion wins.** If a retry requests a different domain after commit, return the existing task and state that the new selection was not applied. Before commit, competing valid inputs may win in either order; the loser gets the canonical result. Do not compare to a mutable task field and pretend it is an immutable original request receipt. Strict original-payload conflict rejection would require a different durable contract and is not included in this proposal.

The proposed request transaction and row lock use existing PostgreSQL/PostgREST behavior; they are not yet tested in this application. References: [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html), [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase function permissions](https://supabase.com/docs/guides/database/functions).

## Uncertain outcomes and reload

Before sending the RPC, retain only the pending capture ID in sessionStorage scoped to signed-in user/workspace; the server row, not this storage, provides integrity. Retain it until a response or readback establishes the result. If storage is unavailable, conversion integrity still holds; reloading the capture list/task list remains the recovery path.

For a timeout, disconnected browser or unreadable acknowledgement, show: “We couldn't confirm whether this became a task. Check its status or retry this capture.” Never present an unknown commit as a definite failure. A read-only refresh can discover the processed link. A retry invokes the same RPC for the same capture. It never falls back to createTask. On reload, inspect the pending capture and its linked task before clearing the recovery message. If the capture remains unprocessed, offer the explicit same-capture retry; if access is unavailable, preserve the uncertainty and ask the user to restore normal access.

A confirmed SQL validation/authorization failure leaves the capture unchanged and exposes a safe message. The UI may disable repeat activation for usability, but the database operation is the integrity boundary.

## Limits that must remain explicit

- This guarantees conversions through the new native operation. An already-open old browser bundle can still execute direct table writes; existing table grants cannot distinguish an old conversion insert from ordinary task creation. Release must establish that the tested native clients loaded the new version. A database-wide guarantee against legacy/direct writers requires a separate design/approval; this proposal does not quietly claim one.
- Existing unprocessed captures may already have unlinked tasks from the old path. No durable attribution exists in that path. Do not match by title, delete, merge or claim to repair them. For a specifically known uncertain legacy conversion, stop and surface the unresolved state rather than asserting a clean retry. The proposal prevents new split-write orphans; it does not certify historical data.
- Existing processed captures use their current linked task as the authoritative result. This does not certify that no older orphan exists.
- An existing Discard request can race with conversion. The new function must fail if it observes discarded first; changing generic discard behavior is outside this proposal. Any demonstrated violation of the requested conversion contract during testing stops implementation for scope adjudication.

## Fault and concurrency matrix after approval

For every test record initial and final task count, capture status/link, exact task ID, and user-visible state. Use real PostgreSQL transactions and the application's ordinary authenticated PostgREST path for boundary tests; synthetic client tests are supporting evidence only.

| Case | Required persistence result | Required user-visible result |
|---|---|---|
| 1 Normal conversion | +1 task; processed; link resolves to that task | Confirmed task link |
| 2 Fail after task INSERT, before capture UPDATE | +0 tasks; unprocessed/null link; clean retry then +1 | Explicit recoverable failure; capture content intact |
| 3 Commit succeeds, response dropped | +1 task; processed/link stable; retry +0 | Initially uncertain; readback/retry confirms same task |
| 4 Sequential same-capture retry | Total 1; identical task ID and link | Already processed; no new task |
| 5 Double activation | Total 1; one canonical link | Both outcomes converge on same task |
| 6 Concurrent separate connections/sessions | Total 1; loser waits or receives recoverable abort, then same result | No second logical conversion |
| 7 Reload after uncertain outcome | Total 1 if committed, otherwise 0 until retry then 1 | Recovery reads same capture ID; no automatic new task |
| 8 Already processed | +0; same link; missing-link variant +0 and explicit failure | Existing task or unavailable result; no replacement |
| 9 Missing/unauthorized/second tenant | +0; both tenants' captures and tasks unchanged | Non-revealing denial; no foreign task details |
| 10 Changed retry inputs | Total 1; first commit's task unchanged | Existing task returned; changed selection not applied |

Also exercise zero-row update detection, revoked capability/direct-session rejection, overlength title, and rollback of any audit trigger effects as directly necessary integrity checks. Do not modify shared access behavior to make fixtures pass.

Local PostgreSQL acceptance is currently NOT TESTED: Docker Desktop's Linux engine pipe is absent, psql is not on PATH, and the standard PostgreSQL installation path is absent. No new dependency, database service or Docker startup was performed. A working isolated local test database is a prerequisite to proving the proposed transaction; do not call synthetic results an integrity pass.

## Future production acceptance and cleanup proposal

This is a plan, not authorization. First complete local real-database tests, focused browser tests, required repository checks, independent review and exact-current-head CodeRabbit review. Publication, merge, migration, deployment and production acceptance each need their explicit release permission. The Ministry repository remains the sole hosted migration authority; no hosted migration is run from Workspace.

At the production-acceptance checkpoint select two existing, explicitly approved test users and their owned workspaces. Verify legitimate access and separate tenant ownership without changing grants/billing. Pin deployed SHA, RPC body/ACL/RLS and browser version. Authorize normal existing-user bootstrap metadata writes separately as part of that exact test journey.

Proposed maximum footprint: seven labeled captures under tenant A (normal/retry; lost acknowledgement; double activation; separate-session concurrency; reload; changed-domain concurrency; rollback/retry) and one labeled capture under tenant B for positive/cross-tenant controls; **at most eight tasks total**. Use one unique run marker plus case label, synthetic text, and exact ID receipts. Existing audit/product-event rows and ordinary bootstrap metadata effects may be created; they remain retained. No customer records are fixtures.

For each capture, record a pre-count, execute the approved case, then read back capture status/link and all task IDs created under its exact synthetic run marker. Assert the required counts, not only that one link exists. Perform two-way cross-tenant read/write denials and legitimate B control. A production dropped-response test discards only that client's response after a confirmed request; no server/database fault. Case 2 database fault injection remains local/hosted-test unless a separate exact production mechanism and rollback are reviewed and approved. No broad trigger/permission change is proposed to simulate it in production.

Stop on a second task, unknown attribution, unauthorized data, changed deployed version or unexpected side effect. Retain evidence and do not start deduplication. An acceptance scope that excludes production fault injection must record that limit; F09 is not silently closed from local results alone.

Proposed cleanup, requiring exact ID/identity approval: through each owning user's ordinary supported path, delete only this run's captures, then only this run's tasks; verify those IDs absent. Preserve audit history, accounts, workspaces, grants and all pre-existing records. If cleanup cannot be bounded to verified created IDs or an unexpected duplicate appears, stop for an exact cleanup decision. No production writes or cleanup occurred in this investigation.

## Ownership and approval boundary

IN SCOPE: isolated branch `codex/f09-investigation-20261119` at the checked main SHA; task worktree `.f09-investigation-20261119`. Other worktrees were not edited. Worktree tracked-diff checks found no modifications to the native repository or capture page. Ten open Workspace PRs were enumerated and their file lists checked; none changes those two files. Missing stale worktree paths were reported and not repaired. Investigation files are new and task-specific.

BLOCKER before implementation: rerun ownership against the exact approved file set, especially shared evidence and database/auth boundaries held by open PRs. No ownership clearance for modifying those shared objects is implied by this read-only investigation.

SCOPE CHANGE — PM APPROVAL REQUIRED: canonical production-state documentation lives in the control-plane repo and was not edited. The live observations are retained here for a bounded canonical append after its ownership/scope is cleared; no existing shared document was overwritten.

Decision requested at this checkpoint: approve preparing the single SECURITY INVOKER RPC and native caller/recovery/tests under the capture-once, first-commit-wins contract, with real database proof required before readiness. This is implementation approval only. It does not authorize publication, merge, hosted migration, deployment, production test identities/data, cleanup, or bypass of ownership/review gates.

## Checkpoint validation

The supervisor independently inspected the synthetic harness and reran its exact focused Vitest command: 6/6 passed at 05:35:43, 313ms. Product tracked diff against HEAD was empty. A final whitespace check removed one trailing blank line from the test, without changing behavior. A separate gpt-6-astra/high auth/transaction review inspected this proposal and the retained live catalog evidence and returned no material blocker for this proposal checkpoint. It is not release review and does not replace actual database tests or CodeRabbit.

Implementation attempts in this assignment: zero. No matching F09/capture-retry fix commit was returned by the bounded all-refs commit-message search; earlier unrecorded attempts remain unknown. New commit/PR: none. Production/data impact: none. Test temporary files were cleaned by the bounded fixture cleanup. No F09 closure is claimed.

## Approved implementation checkpoint (2026-11-19)

The proposal above is the historical initial checkpoint. Andrew subsequently approved the single native function and first-commit-wins behavior for implementation/local testing only. Ownership was cleared for the narrow change set; local real database testing is now complete. See [implementation evidence](f09-implementation.md) for the final contract, checks, failed first draft, and remaining production/release boundaries. The final invoker implementation uses existing RLS row-lock policies instead of explicit private-schema helper calls; no privilege expansion was needed. The original synthetic reproduction harness is preserved as `tests/f09-investigation.characterization.ts`, pinned to the immutable base SHA and excluded from default regression discovery. Earlier command transcripts retain the original filename. No production acceptance or release permission is implied.
