# Personal OS + SOTF Bundle architecture

Status: P1 generic bundle entitlement foundation complete locally; P2 Professional Context Graph Phase A hardened locally and release-blocked
Branch: `codex/personal-os-transition-bundle`

## Naming contract

`SOTF Bundle` is the required user-facing name for the service-member transition offering. Internal identifiers may use `sotf_transition` where a descriptive implementation key is useful, but UI labels, page titles, product copy, and future marketing surfaces must say `SOTF Bundle`.

## Product thesis

Lead Emergence is one persistent personal operating harness. Transition is a chapter, not a separate product or endpoint. A service member can enter through the SOTF Bundle, build durable professional context during transition, and carry approved context forward into first-90-day and ongoing professional-work workflows.

The SOTF Bundle should reinforce human coaching rather than replace the fellow. The Workspace handles execution between coaching conversations: context gathering, preparation, follow-through, research, relationship management, interview preparation, and daily/weekly operating rhythms.

## AI-native design objective

The SOTF Bundle is an AI-native apprenticeship as well as a transition execution layer. A member should be able to begin with no advanced prompting, connector knowledge, MCP knowledge, or workflow-design experience and progressively learn to operate through a persistent, connected, self-improving professional AI system.

The user should not have to understand the infrastructure. Lewis and the SOTF Bundle should expose the value and teach the operating habits while keeping OAuth consent, data access, durable memory promotion, and improvement approval explicit.

The progression is:

1. **AI-assisted** — delegate useful preparation, drafting, research, and follow-through.
2. **Context-aware** — build enough confirmed professional context that the user no longer has to restate their transition repeatedly.
3. **Workflow-native** — operate through reusable skills and workflows rather than one-off prompts.
4. **Proactive** — let approved connectors and daily/weekly rhythms keep the Workspace current and surface what deserves attention.
5. **Self-improving** — learn from context gaps, edits, friction, and repeated work, then propose evidence-backed improvements for approval.

Progression should be based on readiness signals and demonstrated use, not gamified novelty or forced feature unlocks. The system should never block core transition support because a user has not connected every optional source or reached a later stage.

## Plugin packaging target

The SOTF Bundle should be distributable as a plugin-style bundle over the Lead Emergence harness. The package contains the operating instructions, skills, workflow definitions, onboarding progression, connector recommendations, and self-improvement behaviors; Lead Emergence remains the persistent authorization, state, relationship, decision, and memory system underneath it.

Target installation experience:

> "Lewis, set up my SOTF Bundle."

Lewis should then:

1. install or resume the idempotent bundle state;
2. inspect which required and optional capabilities already exist;
3. present only the OAuth or consent steps the user must personally authorize;
4. configure the bundle after authorization without exposing MCP URLs, client IDs, callback URLs, database settings, or infrastructure details;
5. harvest only approved sources for initial context candidates;
6. ask the user to confirm uncertain or durable context before promotion;
7. leave the bundle in a resumable `ready`, `partial`, or `needs_authorization` state rather than failing as an all-or-nothing setup.

The bundle may later be packaged for multiple AI clients, but the professional context must remain portable in Lead Emergence rather than being trapped in a single assistant's project or folder limits.

## Core architecture

### Lead Emergence Core

Persistent capabilities shared across chapters:

- daily rhythm
- weekly review
- context promotion
- self-improvement review
- context-gap learning
- learning from repeated edits
- workflow-friction review
- repeated-work skill discovery
- Improve filter for evaluating new AI ideas
- meeting preparation
- decision support
- relationship follow-up
- persistent person-level context

### SOTF Bundle

Adds:

- AI-native progression
- transition roadmap
- coaching-session preparation and reinforcement
- job/company intelligence
- networking copilot
- interview lab
- application quality gate
- career-hypothesis review

The SOTF Bundle inherits the Core self-improvement capabilities so learning accumulated during transition continues into later professional work.

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
2. Context-gap learning: notice unfamiliar terms, people, projects, organizations, or transition concepts; ask for clarification when needed and propose confirmed definitions for context.
3. Context promotion: distinguish short-lived working context from chapter-level and career-level durable context.
4. Relationship and opportunity updates: connect new information to existing people, companies, opportunities, and commitments.

### End of day

1. Reconcile planned work with what actually changed.
2. Carry forward open commitments.
3. Record meaningful learning and changed assumptions.
4. Do not promote inferred durable memory without user confirmation.

### Weekly

1. Review goals, commitments, relationships, opportunities, and career hypotheses.
2. Set the next week's priorities.
3. Learn from edits by comparing recurring changes between AI drafts/recommendations and what the user actually used.
4. Review workflow friction and propose fixes where correction, extra steps, or cleanup repeatedly occur.
5. Detect repeated work sequences that may deserve a reusable skill.
6. Run the Improve filter on new AI tactics, tools, prompts, or workflows and distinguish likely value from hype before suggesting adoption.
7. Combine these signals into a self-improvement review and present evidence-backed proposals for user approval.

## Daniel-style controlled self-improvement

The system follows the useful mechanisms demonstrated in Daniel Blum's self-improving PM workflow while preserving Lead Emergence's stronger approval and memory guardrails.

### Context-gap learning

When the system repeatedly encounters a term or concept it does not understand, it should ask rather than guess. Once the user confirms the meaning, that definition can become a durable context candidate.

### Learn from edits

When an AI-generated message, recommendation, brief, or artifact is materially edited before use, retain a privacy-safe comparison signal. Repeated similar edits can produce a proposed communication or working preference. A single edit should not rewrite a durable preference.

### Friction review

Skills and workflows should emit friction signals when they repeatedly require correction, manual cleanup, redundant steps, or abandonment. The weekly loop should rank recurring friction and propose a concrete change with supporting evidence.

### Skill discovery

Repeated multi-step sequences can be candidates for a new reusable skill. The system should propose the skill only after sufficient repetition and should show the sequence and expected value before the user approves it.

### Improve filter

The user can give Lewis an article, podcast, post, prompt, workflow, or tool idea and ask whether it should be incorporated. The Improve filter should compare the idea against existing capabilities, overlap, expected value, integration cost, risks, and evidence. The default outcome can be reject, retain for later, or run a bounded experiment; novelty alone is not sufficient evidence to change the system.

### Approval contract

Every durable self-improvement proposal records evidence and requires explicit user approval. The system may observe and propose autonomously, but it must not silently rewrite its core instructions, durable preferences, or skill definitions. Sensitive evidence is excluded from automatic improvement proposals.

## Memory model

### Working context

Short-lived operational information such as upcoming meetings, deadlines, drafts, or temporary blockers. It can expire and should not automatically become durable memory.

### Chapter memory

Confirmed context that is durable for a bounded chapter such as SOTF, military transition, onboarding, or a specific role.

### Core professional memory

Confirmed context expected to remain useful across chapters: professional identity, goals, relationships, work preferences, durable skills, decision patterns, communication preferences, and validated learning.

### Promotion rule

Ingestion is not memory. Email, Slack, meeting notes, and documents may produce memory candidates, but durable promotion requires explicit evidence and confirmation. Sensitive material always requires review.

### Professional Context Graph implementation

The Pilot graph uses six generic, Workspace-scoped records:

- `context_chapters` identifies bounded chapters without turning SOTF into a separate account or memory system.
- `professional_context_entities` contains only reviewed context across Working, Chapter, and Core tiers.
- `professional_context_links` relates context to other context or existing tasks, commitments, meetings, decisions, captures, job applications, and legacy memory records without copying them.
- `context_evidence` records bounded source references, timestamps, confidence, and supporting or contradicting excerpts rather than raw source bodies.
- `context_candidates` is the ingestion and conflict-review queue.
- `context_reviews` preserves explicit approve, correct, reject, supersede, promote, archive, and delete decisions.

Working context expires after 30 days unless explicitly promoted. Chapter context
is attached to a named professional chapter; Core context has no chapter binding.
Exact repeats are deterministically reconciled, while ambiguous matches remain
candidates. Conflicting evidence points to the active context it challenges and
cannot replace that context without an explicit supersession review.

Candidate decisions have distinct meanings. `approve` accepts the candidate
exactly, `correct` requires an actual normalized content change, `reject` creates
no confirmed entity, and `supersede` accepts the conflicting candidate exactly.
Normal retained candidates remain autonomous, visibly unconfirmed proposals.
Private and sensitive proposals persist no graph content until first-party
confirmation. Every MCP-initiated review, link, promotion, archive, and delete
operation is request-only; a direct Workspace owner session revalidates and
executes the exact pending operation atomically. No confirmed or consumed token
is transferable back to the assistant.

Existing `memory_entries` remain intact. Lewis returns them as a separate
`legacy_memory` compatibility collection and can link graph context to a legacy
memory record. P2 performs no destructive backfill.

Private and sensitive context are omitted from ordinary Lewis retrieval. A
server-side grant bound to the owner, Workspace, MCP authorization, client, and
authorization epoch is required in addition to requesting the exact privacy
scope. Private grants last 10 minutes and sensitive grants last 5 minutes;
neither implies the other and both authorize reads only. Nested entities,
candidates, evidence, source references, review notes, links, and conflicts are
filtered by their own classification. Without access, protected conflicts are
omitted without an existence indicator.

Classified, CUI, and operationally sensitive material must not be submitted.
When the proposal refusal path is used, it creates no Professional Context Graph
candidate, evidence, confirmed-context, or other graph content row. The request
is still processed by the connected assistant, application runtime, and request
infrastructure; content-free authentication, connection, authorization, or
observability metadata may still be written.

## Knowledge-store direction

Supabase remains the structured system of record and authorization boundary. A user-owned external store can serve as a portable, human-readable memory mirror and raw-document archive. Notion is a strong candidate for living structured context; Google Drive remains appropriate for source documents and archives. Connector implementation is deferred to a separately reviewed slice.

## Self-optimization loop

1. Observe user work and approved source data.
2. Detect context gaps while refusing to invent missing definitions.
3. Compare AI drafts/recommendations with user edits, rejections, and corrections.
4. Capture recurring workflow friction and repeated work sequences.
5. Evaluate external AI ideas through the Improve filter.
6. Generate evidence-backed context, preference, workflow, skill, or experiment proposals.
7. Require user approval.
8. Apply only the approved change and retain enough provenance to reverse it later.

This is controlled self-improvement, not autonomous instruction drift.

## P1 entitlement foundation

The Workspace now stores generic `bundle_definitions`, `bundle_capabilities`,
and canonical `bundle_entitlements`. `sotf_transition` is an ordinary catalog
row. Active entitlements can originate from operator assignment, invite,
subscription, promotion, or organization license; Pilot V1 implements the first
two end to end.

Operator assignment and invite issuance run through bounded product routes with
normal authenticated sessions. Hash-only invitations live outside the exposed
schema, claims bind the verified Auth email to the user's active Personal
Workspace, and assignment/issuance/claim retries reconcile without duplicate
entitlement state. Entitlement resolution is source-neutral and returns
available, active, unavailable, expired, or revoked state plus additive bundle
capabilities.

P1 entitlement infrastructure does not activate P2. The
`professional_context` capability definition exists, but its SOTF Bundle mapping
is disabled in this phase. A later, separately reviewed activation migration or
release action is required before existing SOTF entitlements receive the
capability. This branch does not perform hosted activation.

## Current implementation boundary

This branch intentionally does not:

- change login or MCP OAuth behavior;
- apply a hosted migration or contact hosted infrastructure;
- enable a new external connector;
- send email or Slack messages;
- auto-write durable memory from external content;
- deploy or cut over production.

The current branch contains the P1 bundle foundation and a locally hardened P2
Professional Context Graph with direct-session confirmation authority and
short-lived protected-read grants. P2 is not activated for SOTF entitlements and
is not release-ready. A reviewed fresh migration replay, operational cleanup
scheduling, hosted release approval, deployment and acceptance, connector
execution, one-command bundle installation, persistent progression state, and
later self-improvement capabilities remain separate reviewed slices.
