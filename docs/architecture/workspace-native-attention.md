# Native shared saved-work attention — P12

Workspace Experience 0.4.0 implements a native attention page and a user-owned
Home widget. Bundle Contract 1.0 and UI Manifest Contract 1.0 remain unchanged.
This is not a notification service, assistant permission grant or client release.

## User outcome

One native view brings admitted saved-work cues together with priority, the
recorded date, a reason, source revision and a link to the original record or
exact nested task. A compact Home widget shows three cues; the full page shows
25 per page with source and priority filters. Complete cue and coverage counts
are computed before pagination. Existing confirmed layout controls can hide or
reorder the widget without changing domain authority or saved source records.

The comparison date defaults to the user's local calendar date. Selecting a
different date changes date rules against current saved records; it does not
retrieve a historical snapshot. The retrieved timestamp makes that distinction
visible. Every subsequent page rechecks current work and access; concurrent
saves can move cues between pages.

## Portable contract and host boundary

The portable `bundles/workspace-experience/attention.ts` declares thirteen
record scopes and nine task scopes, strict metadata-only references, validated
source routes, request and result schemas, groups and complete coverage.
Each scope derives from a known domain capability. Writing admits library
metadata without granting body review.

The host imports this as its thirty-third pinned allowlist file, transforming
only the discovery import path. It implements:

- `GET /api/bundles/attention`: currently admitted source catalog.
- `POST /api/bundles/attention`: strict bounded comparison/filter/page request.
- `/workspace/attention`: source-linked native review.
- `workspace.widget.attention`: the same query's first three cues on Home.
- Migration 35: capability binding, native projections and guarded RPCs.
- Migration 36: implemented widget admission to the existing layout catalog.

There is no new shared content table, duplicated private corpus, query history,
provider connection, saved notification, canonical write or MCP tool.
The host's existing Executive metadata definitions supply immutable routing
and cue rules only; native attention does not call the Executive sharing path.

## Authority and privacy

Both RPCs require a direct native session, derived Workspace identity and
current `workspace.attention` entitlement. JWTs containing an OAuth client
identifier are rejected independently of the HTTP layer. Each admitted domain
source must retain its own capability. Native attention does not require the
Executive bundle and never grants an assistant cross-domain source permission.

All nine underlying domain query branches repeat owner filtering. Private
projection helpers are not callable by anonymous or authenticated clients.
The public response contains bounded scalar metadata, not full resource text,
private profiles, recovery drafts, pending proposals, meeting availability,
provider identifiers or external source bodies. User-entered titles, owners
and next actions are still private content; native access is not public access.

The HTTP boundary rejects supplied identity, unknown fields, query strings,
invalid date/filter/page inputs and bodies exceeding 4,000 bytes. It validates
the result before returning private/no-store responses. Missing authentication,
denied authority, stale authority and unavailable service remain distinct.
The browser verifies owner, authority, coverage, comparison date and filters;
changing filters clears old results and invalidates late requests. Leaving the
tab clears displayed data and requires an explicit refresh on return.

## Honest cue semantics

Rules use saved blocks, recorded dates, high priorities, draft/stale/open
states and open prerequisites. High priority is not independently verified
urgency. Catalyst date certainty is preserved. A parent record and its tasks
can each produce cues, so counts are not unique projects or completed work.
Coverage discloses exactly which record/task scopes were checked.

Counts include all admitted cues. Page offsets are multiples of 25 through
2,147,483,000, with a maximum of 25 returned items; the native attention queue
does not inherit search's 10,000-offset cutoff. Result validators reconcile
scope, bundle, priority and filtered totals. Ordering is priority, recorded
date, then deterministic source identity. Deep paging is accessible but still
does database work; this is not a constant-time or production latency claim.

No matching cues is not an all-clear. Profiles, drafts, proposals, full source
bodies, calendars, inboxes and live markets are not examined here. The view
does not send reminders, complete tasks or verify research evidence.

## Verification and remaining work

See [the P12 acceptance ledger](../testing/workspace-attention-acceptance.md).
Connection/notification consumers, recurring lifecycle, persistent snooze or
dismiss decisions, redundancy grouping, approval-only AI layout proposals,
representative usefulness and installed/deployed acceptance remain separate.
No hosted migration, production cutover or marketplace publication is approved.
