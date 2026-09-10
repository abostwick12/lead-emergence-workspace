# P15 private native editor recovery acceptance ledger

Milestone: P15, 2026-09-10. Implementation checkpoint, not client shipment.
Host branch: `codex2/bundle-experience-integration`; starting HEAD
`dd5ed334174b67851eaa9fbb8aca1ad8eef9404b`. Portable branch:
`codex2/bundle-platform-v1`; recovery contract pinned at
`39f25d39525f5bcecab536df186f791aa64539db`, including the final
evidence-only follow-up.
All six bundles remain **NOT READY TO SHIP**.

See [the recovery authority and UX contract](../architecture/native-editor-recovery.md).

## Final checks and evidence

| Check | Outcome |
| --- | --- |
| Portable type checking and tests | PASS: 180 tests in 17 files |
| Installed OpenAI plugin / skill validators | PASS: six plugins and six skills; validation is not installed-host proof |
| Host type checking / lint / optimized build | PASS; final build exposes 56 generated routes/pages |
| Host unit / schema / boundary checks | PASS: 318 unit tests in 36 files, 32 schema-policy contracts, 272 runtime files |
| Local database authorization and recovery | PASS: 1,061 assertions in 24 rollback-isolated suites, including 265 recovery assertions |
| Fresh named local replay | PASS during P15: all 41 migrations, all 1,061 assertions and zero retained users; no migration changed afterward |
| Recovery-specific optimized browser workflows | PASS: 12; eight domain restore cases, two desktop-only conflict/lost-response cases and two Executive availability cases; two intentional mobile skips |
| Interrupted atomic canonical commits | PASS: four desktop domain cases; the same private draft safely retries after the injected interruption |
| Final connected desktop/mobile regression | PASS: 202 of 206 collected tests in 41.1 minutes, zero retries; four intentional skips described below |
| Ministry regression found during acceptance | PASS: research/save/export/proposal/history and stale-profile two-tab flows pass on desktop and mobile, including the final full run |
| Layout/editor regression found during acceptance | PASS: unsaved Executive work survives a layout save in another tab on desktop and mobile, including the final full run |
| Representative client usefulness, installed host, deployed acceptance | NOT RUN; not inferred from local fictional tests |

The four final skipped cases are two desktop/mobile SOTF cases that require the
separate SOTF component harness, plus the recovery suite’s mobile duplicates of
its desktop-only two-tab and lost-response injections. They are skips, not
passes. All other collected connected checks passed in one uninterrupted run.

Local tests use fictional accounts and records. Database suites roll back their
own fixtures. New-record draft cleanup is scoped to the exact fictional domain,
kind and test account; it never deletes canonical records. The fresh P15 stack
was separately named and stopped with its backup preserved.

## What the checks prove

- All 16 Ministry, Nonprofit, Investor and Executive editor kinds accept bounded
  incomplete drafts without treating them as canonically valid records.
- Direct native owner sessions can read and change only their admitted private
  drafts; anonymous, OAuth/client, cross-owner, cross-workspace, cross-domain and
  wrong-kind access is denied.
- Save, discard and commit enforce exact request hashes, expected versions,
  source revisions and per-target serialization.
- Lost responses replay once without a duplicate version; stale tabs preserve
  their own edits and cannot replace newer server state.
- Commit dispatches the exact canonical domain save and tombstones the draft in
  one transaction. Injected failures preserve the private draft and leave the
  canonical record unchanged.
- Explicit restore, discard, copy, latest-revision and rebase decisions are
  visible and accessible. No restore happens merely because an editor opens.
- Background autosave does not disable the fieldset or swallow an official-save
  click; the official commit queues behind an in-flight private save.
- Ministry research/archive never send profile-only state. Older research can be
  loaded as a copy and saved as a new revision after proposal approval.
- Executive repeated-hour input and availability planning remain unapplied draft
  state until explicitly chosen; pending values cannot become an official save.
- Capability/sign-in changes, failed recovery checks and late responses fail
  closed without exposing stale private content.
- The complete Writer, Executive, Investor, Ministry, Nonprofit and Workspace
  Experience connected regressions remain green on desktop and mobile.

## Issues found and corrected

The first broad run found that Ministry research was sending a profile-only
`unsetProfile: false` value. The same leak existed when a prior research revision
was loaded for review. Both non-profile paths now omit the field; the portable
contract continues to reject both true and false profile state outside the
profile editor.

Rapid user input exposed two interaction races. Fieldsets no longer disable for
background autosave, and the official-save action now has its own `committing`
state. A user’s save request waits for the private draft flight instead of being
dropped during a transient autosave state.

Proposal approval visibly advanced the Ministry revision but did not announce
that change. The persistent revision line is now an accessible status, and tests
wait for the exact revision transition rather than any prior status.

One layout/editor test inherited an intentional unfinished draft from an earlier
run. Exact before/after cleanup was added for its fictional account. The recovery
prompt itself was correct and remained unchanged. The stale-profile test also
followed obsolete wording and skipped the current “Check server draft” decision;
it now exercises the actual two-step safe flow.

These intermediate failures are not acceptance evidence. Only the final passing
runs above qualify.

The local Docker Desktop engine stopped unexpectedly during an earlier attempt.
Only its stale zero-byte runtime socket was removed after verifying the exact
path/type and shutting down WSL; no images, volumes, databases or backups were
deleted. The engine recovered and the complete final run passed. This was a test
harness interruption, not a product defect.

## Delivery limits and next release gates

No main merge, hosted migration, production deployment, paid infrastructure,
public plugin listing, provider authorization or client account access is part
of P15. Publishing owned source branches does not activate a product or paywall.

Remaining gates include richer ingestion, grounded approval-only layout
proposals, representative source-quality and unaided time-saved trials for all
six bundles, actual installed-host invocation/update/removal/reconnect, approved
hosted migration and deployed backup/restore/privacy/retention/support checks,
provider proof for anything enabled, and real entitlement/payment enforcement.
