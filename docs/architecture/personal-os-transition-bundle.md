# Personal OS + SOTF Bundle architecture

Status: source architecture and first additive implementation slice
Branch: `codex/personal-os-transition-bundle`

## Naming contract

`SOTF Bundle` is the required user-facing name for the service-member transition offering. Internal identifiers may use `sotf_transition` where a descriptive implementation key is useful, but UI labels, page titles, product copy, and future marketing surfaces must say `SOTF Bundle`.

## Product thesis

Lead Emergence is one persistent personal operating harness. Transition is a chapter, not a separate product or endpoint. A service member can enter through the SOTF Bundle, build durable professional context during transition, and carry approved context forward into first-90-day and ongoing professional-work workflows.

The SOTF Bundle should reinforce human coaching rather than replace the fellow. The Workspace handles execution between coaching conversations: context gathering, preparation, follow-through, research, relationship management, interview preparation, and daily/weekly operating rhythms.

## Core architecture

### Lead Emergence Core

Persistent capabilities shared across chapters:

- daily rhythm
- weekly review
- context promotion
- self-improvement review
- meeting preparation
- decision support
- relationship follow-up
- persistent person-level context

### SOTF Bundle

Adds:

- transition roadmap
- coaching-session preparation and reinforcement
- job/company intelligence
- networking copilot
- interview lab
- application quality gate
- career-hypothesis review

### Professional Work bundle

Adds:

- project context
- stakeholder context
- accomplishment capture
- performance review

The same person-level context remains underneath every bundle. A user can have multiple active contexts at once; bundle activation should not duplicate identity, preference, relationship, or learning data.

## Daily operating rhythm

### Morning

1. Email triage: identify response/action/waiting/opportunity/networking items and prepare drafts without automatic send.
2. Slack context: surface only messages that change what the user should know or do.
3. Calendar prep: review today and near-term events and prepare context for consequential meetings.
4. Daily brief: synthesize confirmed Workspace context into a small set of priorities and next actions.

### Continuous

1. Meeting/coaching ingestion: extract decisions, commitments, relationships, assumptions, and learning from approved notes/transcripts.
2. Context promotion: distinguish short-lived working context from chapter-level and career-level durable context.
3. Relationship and opportunity updates: connect new information to existing people, companies, opportunities, and commitments.

### End of day

1. Reconcile planned work with what actually changed.
2. Carry forward open commitments.
3. Record meaningful learning and changed assumptions.
4. Do not promote inferred durable memory without user confirmation.

### Weekly

1. Review goals, commitments, relationships, opportunities, and career hypotheses.
2. Set the next week's priorities.
3. Review repeated user corrections, missing context, and workflow friction.
4. Propose skill/workflow/context improvements for user approval. Never silently rewrite core instructions.

## Memory model

### Working context

Short-lived operational information such as upcoming meetings, deadlines, drafts, or temporary blockers. It can expire and should not automatically become durable memory.

### Chapter memory

Confirmed context that is durable for a bounded chapter such as SOTF, military transition, onboarding, or a specific role.

### Core professional memory

Confirmed context expected to remain useful across chapters: professional identity, goals, relationships, work preferences, durable skills, decision patterns, communication preferences, and validated learning.

### Promotion rule

Ingestion is not memory. Email, Slack, meeting notes, and documents may produce memory candidates, but durable promotion requires explicit evidence and confirmation. Sensitive material always requires review.

## Knowledge-store direction

Supabase remains the structured system of record and authorization boundary. A user-owned external store can serve as a portable, human-readable memory mirror and raw-document archive. Notion is a strong candidate for living structured context; Google Drive remains appropriate for source documents and archives. Connector implementation is deferred to a separately reviewed slice.

## Self-optimization loop

1. Observe user work and approved source data.
2. Compare AI drafts/recommendations with user edits, rejections, and corrections.
3. Detect repeated friction or missing context.
4. Generate an improvement proposal with supporting evidence.
5. Require user approval.
6. Apply only the approved context, preference, or workflow change.

This is controlled self-improvement, not autonomous instruction drift.

## Current implementation boundary

This branch intentionally does not:

- change login or MCP OAuth behavior;
- apply or add a hosted migration;
- enable a new external connector;
- send email or Slack messages;
- auto-write durable memory from external content;
- deploy or cut over production.

The first slice defines bundle inheritance, the daily/weekly rhythm model, context-promotion guardrails, a user-facing SOTF Bundle page, and unit tests. Connector execution and durable data-model additions should follow as separate reviewed slices after the current login/MCP work is unstuck.
