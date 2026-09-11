# P21 Writer publication readiness

Status: implemented and locally verified on `codex2/bundle-experience-integration`.
Portable source export: `8cbbeea5a32a2c4ebce5d1f1c5b3433982cdce9f`.
Overall client shipment remains **NOT READY TO SHIP**.

## User outcome

`/workspace/writing/publication` gives a Writer one dependable place to carry
an exact saved revision from publication preparation to a recorded handoff. The
page shows active, ready, blocked and handed-off counts; exposes every current
blocker; and keeps plan details, human review, destination evidence and the
current decision together. Resource-library and saved-packet shortcuts avoid a
separate tracking document.

The workflow deliberately stops at handoff. Workspace never fetches the saved
URL, opens a provider from the server, publishes, verifies Wix state or labels a
handoff as publication. The user opens the public destination and records what
they personally observed.

## Authority and private storage

Migration `20260915160000_writer_publication_readiness.sql` creates private queue,
queue-revision, link-evidence and request-receipt tables. All use RLS, expose no
direct anonymous/authenticated table privileges and retain workspace ownership.
Actor identifiers become null if the actor is removed without erasing the audit
record.

Every public function derives the personal workspace from the bearer, requires
current `writer.publication.queue` entitlement and applies the existing direct-
native-session gate. OAuth-shaped assistants cannot list a user's plans, change
them, attest that a destination was inspected or replay a direct user's request.
Anonymous, other-tenant and revoked sessions fail closed.

The authenticated, bearer-only, no-store host surface is:

- `GET|POST /api/writing/publication` — list or save an exact queue revision;
- `POST /api/writing/publication/evidence` — record one confirmed observation;
- `GET /api/writing/publication/[resourceId]` — recover current/tombstoned state.

Request UUIDs are bound to an exact signature. Retrying a successful request
recovers the original receipt; changing its meaning is rejected. Current
authorization is rechecked before replay, so a receipt is not durable authority.

## Derived readiness

Ready state is recomputed from canonical data inside the write transaction. It
requires the same saved revision to remain current, no unresolved proposal,
usable source evidence, the required author/audience/website/SEO/topic fields,
all three human confirmations, a valid public HTTPS destination and current
working/redirect evidence for that destination. A caller cannot set the derived
result independently.

The destination validator accepts public-looking HTTPS DNS names only. It
rejects credentials, custom ports, IP literals, single-label names and reserved
local/private suffixes without contacting the address. Evidence distinguishes
working, redirected, broken and access-limited observations. It becomes stale
after 30 days or after revision/destination drift. Broken or access-limited
evidence blocks readiness.

Only an item that is currently ready can enter `ready_for_handoff`; only that
stage can become `handed_off`. Rebase binds the current resource revision and
resets all human confirmations. Removal hides the item from the active list but
preserves a content-bounded tombstone and audit history.

## Release boundary

This is a generic native workflow proven with fictional local data. It does not
prove a real client destination, representative editorial quality, Wix access,
installed ChatGPT/Codex behavior, hosted backup/privacy/retention, support,
payment enforcement or measured client value. Those remain release gates.
