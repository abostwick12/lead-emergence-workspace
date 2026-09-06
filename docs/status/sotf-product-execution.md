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

## Final product source handoff — 2026-09-06

The checkpoint's remaining implementation work is now resolved for pilot review: reviewed availability and scheduling drafts, invitation preparation and stale-approval recovery, explicit coach-share recipient/content review, preservation of multiple direction links, native first-session persistence/recovery acceptance, and the separate platform landing/film worktree. The SOTF page now evaluates its environment flag at request time with the installed Next.js connection() API.

Product worktree: C:/Users/awbostwick/Documents/ChatGPT/SOTF Product; branch astra/sotf-indispensable; starting commit f141a359a0124d50c454a2acd4f70516a727d5b3; first published checkpoint c73aa22fea9a22a815c8fded628e15cbc802e132. The final task handoff records the ending commit and matching pushed remote.

Landing worktree: C:/Users/awbostwick/Documents/ChatGPT/Lead Emergence Entry Product; branch astra/lead-emergence-front-door; published-main start ef7fd32a573f2f03c0be24f50007ceed600406f2. Landing implementation and exact auth-owner map are documented there in docs/frontdoor-handoff.md, with the separate canonical film/CREATIVE-BRIEF.md and reproducible film/README.md.

### Closed workflow spine

| Experience | Implemented continuity |
| --- | --- |
| First session | Short timing/question intake → reviewed criteria and two possible directions → real-role screening → decision and next investigation |
| Opportunity intelligence | Hard eligibility separate from seven-dimensional fit; scoped evidence and unknowns; confirmed context can change MAYBE to NO; explicit next action and reconsideration trigger |
| Career learning | Hypotheses retain supporting/conflicting evidence, assumptions, experiments, conversations, roles and explicit direction decisions |
| Relationships | Person's purpose, genuine overlap and introduction path → outreach draft → reviewed scheduling → agreed meeting → preparation → debrief → commitments, thank-you draft and next touch |
| Calendar continuity | Stable provider/event identity; reschedule/cancellation updates one meeting; preparation reopens when appropriate; stale unsent invitation approvals are superseded; uncertain executions still require reconciliation |
| Coaching/weekly | Prior commitments and developments → agenda requiring human judgment → separately reviewed recipient/content share draft → meeting debrief, actions and next weekly change |
| Accomplishments | Truthful individual contribution, scope, evidence, approved wording and uncertain numbers; full-bank retrieval before limiting results |
| Applications/interviews | Positioning evidence → immutable material versions → explicit actual submission → sourced outcomes and interview feedback → reviewed learning and next preparation |
| Offer/professional work | Terms with certainty/source → tradeoffs/questions/negotiation → explicit acceptance rationale → recruiting promises and 30/60/90 commitments → selected continuity beyond transition |
| Native/ChatGPT recovery | Shared canonical event log, CAS and idempotent confirmed commands; new MCP conversation recovers native decisions; uncertain saves reuse the same operation; failed external actions never become a false success |

### Deliberate product and release limits

- SOTF_PILOT_ENABLED defaults OFF. The ordinary operational migration is source/local acceptance only, and hosted application remains with the existing migration authority under the written release gate. No live entitlement grants, hosted mutations, deployment, route cutover or main merge occurred.
- General P2 remains OFF. Protected Professional Context is unavailable through this product slice. Its adapter is an external capability contract, not an alternative protected store. This branch does not change existing protected migrations or auth/session owners.
- Mail and calendar execution are manual. Calendar availability must be checked and entered explicitly; no Google/Outlook credentials are collected by this slice. The provider contract returns unavailable until its existing connection owner releases a real consumer. No real email, invitation, LinkedIn message, application or employer acceptance is performed.
- Job research and conversational proposals use the fellow's authorized ChatGPT/research workflow. Native screening supports manual role descriptions, evidence and review. There is no unrestricted LinkedIn graph, proprietary job crawler, full historical-chat access or opaque probability score.
- Native first-value input is guided; the existing Workspace provisioning/setup remains in place. Validate that existing setup → SOTF first-value path with a real invited pilot account before launch. No shortcut around shared sign-in or chooser was added.
- The local browser harness replaces only the test session/transport around the real connected SOTF component. The API/MCP integration suite separately exercises the real handlers against synthetic RPC transport. SQL authorization and isolation were verified on the isolated local stack. These are not claims of live SSO or deployed MCP acceptance.
- Unsaved form contents and pending browser recovery state are in memory. Closing the tab may require re-entering unsaved input after checking recovered canonical history. The pilot log is bounded to 2,000 events / 2 MB; exceeding it preserves history and refuses further appends. Larger histories, bounded conversational retrieval and richer artifacts should be evaluated before broader use.
- The landing's public CTAs all enter shared /login. Published Entry still preserves specific allowlisted handoff/OAuth continuations. A mandatory chooser for every such continuation is a separately authorized auth-owner capability, not invented here. Live default chooser and all enabled destinations need release verification.
- The cinematic interpretation is ready for creative review. Local LCP was slow under resource contention and mobile throttling; small screens default to the poster and optional film. Clean deployed-preview and physical-phone performance remain release checks.

### Pilot decisions and next build

Five removal-pain experiences now have a concrete source implementation: catching costly bad-fit pursuits; remembering why a person matters and what was promised; recovering older truthful examples; arriving at coaching/conversations with prior work connected; and making later opportunity/interview decisions better through reviewed evidence.

Next: approve and validate the ordinary operational rollout, verify one invited fellow's shared-entry/chooser/Workspace/ChatGPT journey, run a facilitated 14-day pilot, then implement one Google Calendar/Gmail consumer with provider reconciliation through the existing connection owner. Tune retrieval and pacing from actual repeated use.

Deliberately defer bulk outreach, automatic applications, a proprietary resume editor, broad monitoring, a second provider ecosystem, two-way Notion synchronization, and parallel transcript integrations. Keep the pilot centered on closed learning and follow-through loops.

Merge recommendation: ready for source and pilot review on the two dedicated branches. Do not merge to main or deploy from this task. Hosted schema application, live auth/destination verification, invitation/entitlement setup and rollout configuration require the existing owners and recorded written gate; external sends remain separately authorized.
