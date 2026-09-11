# P23 Executive native delivery and grouped attention

Status: implementation in progress on `codex2/bundle-experience-integration`.
Portable source revision will be pinned at the completed checkpoint. Overall
client shipment remains **NOT READY TO SHIP**.

## User outcome

The native Executive page lets the signed-in owner create, edit, pause, resume
and cancel one current daily-brief schedule and one current weekly-review
schedule. Each schedule uses an explicit named zone and local time. Weekly
schedules select ISO weekdays. The user chooses either every occurrence or only
when the bounded attention summary changes, then confirms the exact schedule
and its limitations before it is saved.

Due occurrences produce an in-app review cue linked to the unsaved daily-brief
or weekly-review editor. They never save a record, send a message, deliver
email, book a calendar event or call a provider. Recent ready and unchanged-
skipped evaluations remain visible with exact complete attention totals and
separately labeled first-page inspection counts.

This installed architecture has no background runner. Occurrences are evaluated
when a direct user opens Executive. A missed visit does not produce off-session
delivery, and the next occurrence advances from the later of the due instant and
the visit time so missed periods cannot flood the inbox.

## Grouped attention

`workspace.executive_review_attention` wraps the existing 22-scope evaluator
and adds complete non-zero totals for Executive, Writer & Editor, Ministry,
Nonprofit Founder and Investor source domains. Totals derive from complete
coverage counts, not the bounded page. Items remain priority ordered inside the
page and the native view groups those page items under their source domain with
exact source links.

## Private authority and replay

Migration `20260915180000_executive_delivery_schedules.sql` creates private,
RLS-enabled schedule, event and request-receipt tables with no direct anonymous
or authenticated table grants. Only guarded `authenticated` RPCs are exposed.
Both listing/materialization and lifecycle mutation reject OAuth/client-id
sessions through the existing direct-user check.

Creation, update and resume recheck the review-kind capability. Pause and cancel
remain available to a direct owner with any Executive capability so a retained
schedule can be stopped after its specific capability is withdrawn. Full
Executive revocation closes all schedule history and receipts. An active
schedule with lost capability is retained, labeled unavailable and not
evaluated; it can resume materialization only if access returns.

Mutations serialize per workspace, require the current schedule version, and
bind a request UUID to the complete JSON input and immutable result. Exact
lost-response retries recover the same receipt. Rebinding a request, stale
versions, duplicate current review kinds, another tenant, invalid zones and
ambiguous lifecycle transitions fail closed. Cancellation is final; a new
schedule may later be created without erasing history.

## Meaningful-change and time semantics

The fingerprint removes retrieval time, comparison date and paging controls,
then hashes the complete totals, grouped/coverage state and first 50 ordered
attention items. It is intentionally bounded: calendars, inboxes, live markets,
unshared scopes and underlying private source bodies are excluded. Events label
the complete total and inspected-page counts separately.

PostgreSQL named-zone conversion determines daylight-saving gap and repeated-
hour behavior. The next-occurrence helper chooses the first representable
candidate strictly after the supplied instant, with explicit spring-gap,
repeated-hour and weekly-weekday acceptance cases.

## Assistant and provider boundary

No MCP tool is added for schedule creation, history, lifecycle or triggering.
OAuth consent explicitly states that schedule controls remain native-only.
There are no provider requirements, credentials, background jobs or external
delivery claims in P23.

## Acceptance still required

Before this checkpoint can be published, the new migration must replay from an
empty isolated database, the adversarial PostgreSQL suite and complete database
matrix must pass, desktop/mobile browser acceptance must exercise the real
native API, and full source/host static, unit, optimized-build, boundary and
sensitive-data checks must pass. Representative-client, installed-host, hosted,
backup/privacy/retention/support, provider and payment gates remain outside this
local milestone.
