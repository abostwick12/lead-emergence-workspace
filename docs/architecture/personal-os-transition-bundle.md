# Personal OS + SOTF Bundle architecture

Status: source architecture and first additive implementation slice
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

## Current implementation boundary

This branch intentionally does not:

- change login or MCP OAuth behavior;
- apply or add a hosted migration;
- enable a new external connector;
- send email or Slack messages;
- auto-write durable memory from external content;
- deploy or cut over production.

The first slice defines bundle inheritance, the daily/weekly rhythm model, context-promotion guardrails, self-improvement proposal primitives, an explicit five-stage AI-native pathway, a user-facing SOTF Bundle page, and unit tests. Connector execution, one-command bundle installation, persistent progression state, persistent improvement-signal storage, approval history, and durable data-model additions should follow as separate reviewed slices after the current login/MCP work is unstuck.
