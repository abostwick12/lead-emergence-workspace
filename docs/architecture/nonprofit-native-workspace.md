# Nonprofit Founder native workspace

Implementation checkpoint, 2026-09-08. Not client-shipment or hosted-release approval.

## Ownership and isolation

Reusable source contracts, manifests and the skill stay in lead-emergence-bundles.
Workspace imports a seventeen-file SHA-256-checked allowlist; source-lock.json
records the exact source revision. Native persistence lives in independent
workspace_private.nonprofit_documents, nonprofit_versions and nonprofit_proposals
tables, all with RLS and no direct anonymous/authenticated table grants.

Four record kinds map independently to nonprofit.roadmap, nonprofit.partners,
nonprofit.meetings and nonprofit.regulatory_research. Narrow RPCs derive the
workspace from the verified subject, recheck current assignments/capabilities
and never accept model-supplied tenant authority. Foreign and missing record IDs
have the same unavailable response. No legacy product data, clinical system,
provider credentials or client-specific configuration is imported.

## Useful workflows

- Roadmaps preserve mission, jurisdiction, target date and typed milestones
  spanning formation, governance, partnerships, volunteers, funding, policy and
  launch. Milestones have owners, dates, status, next action, priority, evidence
  and same-roadmap, acyclic dependencies. An optional editable starting checklist
  is suggested planning, not verified legal requirements or invented commitments.
- Administrative relationships cover partners, volunteers, donors, grantmakers,
  board contacts and other relationships, with an explicit follow-up and
  recoverable unsent outreach draft.
- Meetings record date, local time, IANA zone, location, administrative participants,
  agenda, notes, decisions and owned actions. This does not book a calendar,
  check availability, resolve ambiguous daylight-saving instants or send invites.
- Research records an exact jurisdiction/question/category, source authority,
  URL/reference, jurisdiction, retrieval/effective/publication dates and findings.
  Interpretation, uncertainty, required action, professional review recommendation
  and evidence state are separate. Reviewed does not mean compliant or eligible.
  Sources are user/assistant-recorded evidence, not independently verified by
  Workspace. Public research uses separately available tools; private operational
  content must not be included in public searches.

The next-moves view reports its server as-of date. It selects unfinished active
milestones, due/undated follow-ups, approaching/past scheduled meetings, open
meeting actions and research review gaps. Each item retains its kind, exact saved
revision, reason, owner, date and evidence. Only currently admitted kinds are
included. It sends no reminders and does not monitor external systems.

## Proposals and recovery

Thirteen focused MCP tools cover four list/read/propose groups and next moves.
Only the four proposal tools mutate state. They cannot save canonical records,
approve proposals, inspect private revision history, send outreach or book a
calendar. New records can be proposed with a null ID and revision zero, allowing
a useful first assistant outcome without inventing an existing record.

Native approval reviews the complete proposal against the latest saved revision.
Stale proposals cannot be approved or silently rebased. Rejection remains
available without affirming the proposal content. Pending, approved and rejected
proposals can all be inspected. Changed assistant research interpretation is
normalized to inferred, and a claimed reviewed state becomes review_required.
Native approval preserves that epistemic distinction.

Canonical saves and proposal requests have stable request IDs and exact base
revisions. The immutable base keeps normalization deterministic on retries.
Concurrent or superseded changes fail rather than overwrite current work.
All versions are retained; native history exposes the original plus latest nine.
Restoring copies a revision into an editable form and requires a fresh
administrative confirmation to save. Downloads are labelled saved text snapshots,
excluding unsaved edits and pending proposals, not publications or legal opinions.

## Clinical and privacy boundary

No patient identifiers, clinical record types, diagnoses, therapy notes, treatment
plans or clinical risk workflows exist. Unknown structured fields are rejected
in both reusable schemas and SQL. Each direct save/approval requires explicit
administrative-only confirmation, reset when the form changes. The skill refuses
to write supplied clinical information and requests a nonclinical version.

These are scope controls, not automatic PHI detection or redaction. Free text
must be reviewed by the user. Downloads retain the selected canonical content;
copies cannot be retroactively revoked. Rejected proposals and history are
retained, not erased. A deployed retention/deletion policy remains a release gate.

## Native experience and current limits

Routes are /workspace/nonprofit and /:kind, /:kind/new, /:kind/:documentId,
and /:kind/proposals, where kind is plan, partner, meeting or research.
Navigation capability metadata is optional and backward compatible in UI Manifest
1.0; registry validation rejects unknown references. Workspace filters it by
current authority, without client-specific conditionals.

Reads are keyed by subject, workspace, authority revision and resource path.
Capability loss removes private state. Requests are private/no-store and have
bounded payloads; the client has a twenty-second timeout, safe identical retries,
visible errors and unsaved-navigation warnings. P15 protects unfinished forms in
private direct-session-only server drafts with explicit restore/discard, conflict
handling and atomic official commit.

Actual installed ChatGPT/Codex operation, approved hosted migration/Entry consent,
representative public-authority/grant research quality, unaided first-use/time
saved, large datasets, physical devices, external outreach/calendar providers,
deployed retention/recovery and payment enforcement remain unproven. The
twelve-minute first-value estimate is a design target, not measured client value.
See the P7 section of docs/testing/test-evidence.md for exact local evidence.
