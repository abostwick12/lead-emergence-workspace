# SOTF Bundle product execution

Status: implementation in progress; no hosted deployment or protected context activation.

## Isolation

- Repository: https://github.com/abostwick12/lead-emergence-workspace
- Product worktree: `C:/Users/awbostwick/Documents/ChatGPT/SOTF Product`
- Product branch: `astra/sotf-indispensable`
- Starting commit: `f141a359a0124d50c454a2acd4f70516a727d5b3`
- Separately registered security worktree: `C:/Users/awbostwick/.codex/worktrees/d48d/SOTF Bundle`, branch `codex/r5e8k-ca-read-diagnosis` at isolation preflight.
- The existing checkout and security worktree are not product write targets.

## Delivery contract

Conversation → decision → action → evidence → learning → better next decision.

Implement career hypotheses, transparent opportunity intelligence, relationship/meeting follow-through, coaching continuity, evidence reuse, applications/interview learning, and offer-to-transition continuity. Native UI supports review and correction; MCP supports the conversational operating experience. Operational records cannot become an alternative protected Professional Context store. General P2 remains off.

Preserve the supplied cinematic Lead Emergence direction: continuous near-black environment, photographic hero, editorial typography, cyan journey thread, restrained gold, and SEE REALITY → REFRAME REALITY → ALIGN WITH REALITY → BUILD CAPABILITY → PRODUCE VALUE → NEW REALITY → SEE AGAIN. The broader platform remains leader-centered; SOTF Bundle is a concrete pathway.

No production actions, real outbound communication, live invitations, protected-context changes, or merge to main are authorized.

## Platform entry constraint — confirmed by user, 2026-09-06

One public Lead Emergence landing page → shared sign-in → canonical identity/session experience → entitlement-aware destination chooser → selected authorized product. No SOTF login, second Workspace login, new Entry architecture, or landing CTA that bypasses the chooser.

Read-only ownership trace:

- Existing Entry repository: `https://github.com/abostwick12/lead-emergence-entry.git`; inspected checkout `C:/Users/awbostwick/Documents/ChatGPT/consulting and entry goal/entry-operational-readiness`, branch `fix/password-recovery-redirect-v2`, commit `a8caa42038309f1d082fcf520ef556743c7c7109` (clean). It owns `app/landing-experience.tsx`, shared `/login`, canonical identity, `/workspaces`, and product handoffs.
- Entry `app/login/actions.ts` authenticates through the existing Supabase server client. `lib/navigation.ts` defaults ordinary sign-in to `/workspaces`.
- Entry `app/workspaces/page.tsx` calls `requireCanonicalIdentity` and `get_my_active_entry_products`, then displays only active products. `/handoff/[product]` rechecks access before the existing product OAuth/handoff.
- Workspace consumes Entry SSO through `/auth/entry` and `/auth/callback/sign-in`, verifies the configured identity, and resolves local Workspace access. Its existing rollback login and callbacks must remain untouched by product work.
- Existing implementation provides one canonical identity/login experience with product-local host-only sessions, not a newly shared cross-domain cookie. Preserve that existing boundary; no session consolidation is authorized.
- Discrepancy: the inspected Entry landing also has direct product login/Workspace CTAs. The redesigned shared front door must route authentication CTAs to existing Entry `/login` without a product-specific destination override.
- The Workspace repository must not replace its `/` with a second public platform landing. Landing implementation belongs in an isolated worktree of the existing Entry owner. No Entry source was changed during this ownership inspection.
- Source supports the shared chooser path. Current live deployment/chooser availability was not tested or changed. Existing status documentation describes unresolved production routing/cutover; do not infer launch readiness from local source.

The security writer's worktree and all existing auth, callback, identity, session, entitlement, and handoff code remain outside product edits unless separately authorized.

## Completion evidence to collect

- Changed confirmed criteria change the pursuit recommendation.
- Relevant older accomplishments remain retrievable.
- Opportunity input reaches assessment, decision, next action, and later learning.
- Relationship reaches outreach, meeting preparation, debrief, follow-up, and next touch.
- Coaching and new assistant sessions resume operational state.
- Failed external actions remain accurate and recover without duplicates.
- Reviewed evidence updates hypotheses and assessments; declined opportunities remain available.
- Landing preserves reference direction, works responsively and without motion, and accurately represents implemented capabilities.
- Required repository checks, targeted workflow tests, local persistence checks, and browser verification.
- Coherent commits and pushed dedicated branch; no production mutations.

## Product workflow checkpoint — 2026-09-06

Implemented in the isolated product branch:

- One shared operational engine and canonical event history for native review and the existing Workspace MCP connection. A new conversation can recover the current decision, criteria, hypotheses, evidence, commitments, and unfinished actions.
- Explicit criteria and hypotheses; opportunity eligibility separated from a seven-dimension fit vector; supporting/conflicting evidence, scoped sources, unknowns, next investigation, and deliberate pursue/investigate/decline/pause decisions.
- Relationship purpose, outreach drafts, canonical meeting identity, preparation, debrief, linked evidence review, commitments, thank-you drafts, and next-touch dates.
- Daily priorities with meeting/preparation deduplication, coaching preparation from earlier commitments, a separate share draft, weekly learning, and searchable older accomplishment evidence.
- Immutable submitted material versions; explicit actual submission; application results with follow-through; interview preparation that reuses prior feedback and examples; interview debriefs; offer comparison; acceptance rationale and 30/60/90-day commitments; deliberate selection of operational records to carry forward.
- Exact-revision manual outbound approval and verified result recording. Failed/uncertain execution requires provider verification before returning the same action to draft. No mail or invitations are sent by this product slice.
- Save verification distinguishes a rejected operation from an uncertain result after persistence. Recovery reuses the same operation ID and reads back the canonical result.
- The existing descriptive SOTF page is replaced by a gated executable experience. `/sotf/preview` is an entirely fictional, in-memory preview; `/sotf/connect` explains use of the existing shared sign-in and Workspace assistant connection.

Source readiness is separate from release readiness. `SOTF_PILOT_ENABLED` defaults to false. The additive migration is local source only; it was tested against the isolated `sotf-product-acceptance` stack. No hosted migration, production deployment, real message, real invitation, entitlement grant, or Professional Context activation occurred.

Still required before the overall level-up is complete:

- Availability/offered-time scheduling and provider contracts; production mail/calendar execution remains separately approved and unwired.
- Finish the conversational onboarding/connection handoff and exercise the enabled native experience against local synthetic persistence.
- Implement the public platform landing in an isolated worktree of the existing Entry repository, preserve the canonical seven-stage film brief, and complete the responsive/reduced-motion/performance evidence.
- Keep the existing auth/chooser/session/callback ownership intact, address only the identified public CTA discrepancy, and report any production routing gap without cutting over routes.
- Complete final product review, source-control checkpoints, and the end-to-end pilot handoff. This checkpoint is not a soft-launch approval.

The public-opportunity acceptance case uses a fictional fellow with scoped evidence from [OpenAI's Technical Program Manager, Developer Experience posting](https://openai.com/careers/technical-program-manager-developer-experience-san-francisco/), inspected 2026-09-06. The case proves that a deliberately confirmed working-arrangement constraint changes the pursuit decision while other qualifications and culture remain unknown. It is not a recommendation for a real applicant.

### History compatibility

The pilot log uses schema version 1. Once any environment begins retaining pilot history, release changes must preserve the version-1 reducer's meaning, including generated draft contents and approval revisions. Do not reinterpret saved approvals or regenerate past submitted materials under a changed reducer. A semantic change requires a separately versioned event contract and compatibility tests; do not mutate retained events in place.
