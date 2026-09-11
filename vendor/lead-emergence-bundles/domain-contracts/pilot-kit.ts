import { z } from "zod";
import { valuePilotBundleKey, valuePilotGateAnswers, valuePilotRatings } from "./value-pilot";

const id = z.string().regex(/^[a-z][a-z0-9._-]{2,119}$/);
const shortText = z.string().trim().min(1).max(500);
const sourceLayer = z.enum([
  "user_input", "authoritative_reference", "public_source", "prior_work",
  "confirmed_configuration", "task_metadata", "synthetic_system_state"
]);

export const pilotIssueCode = z.enum([
  "unexpected_assistance", "workflow_friction", "source_gap", "evidence_gap",
  "provenance_gap", "cross_domain_exposure", "unauthorized_mutation",
  "unsafe_domain_guidance", "fabricated_provider_state", "measurement_content_leak",
  "accessibility_blocker"
]);

const sourceCard = z.object({
  id,
  label: z.string().trim().min(1).max(100),
  layer: sourceLayer,
  content: z.string().trim().min(1).max(1200),
  handling: z.string().trim().min(1).max(300)
}).strict();

const preparationStep = z.object({
  id,
  instruction: shortText,
  excludedFromTimer: z.literal(true)
}).strict();

const timedStep = z.object({
  id,
  instruction: shortText,
  evidenceOfCompletion: shortText
}).strict();

const rubricItem = z.object({
  id,
  label: z.string().trim().min(1).max(80),
  passDescription: shortText,
  critical: z.boolean()
}).strict();

const safetyCheck = z.object({
  issueCode: pilotIssueCode,
  passDescription: shortText
}).strict();

const releaseThresholds = z.object({
  minimumRepresentativeAttempts: z.number().int().min(3).max(10),
  minimumUnaidedAttempts: z.number().int().min(2).max(10),
  minimumCompletionRate: z.number().min(0.5).max(1),
  minimumOutcomeRate: z.number().min(0.5).max(1),
  minimumTargetRate: z.number().min(0.5).max(1),
  minimumMedianRating: z.number().int().min(3).max(5),
  maximumMedianCorrections: z.number().int().min(0).max(10)
}).strict();

export const representativePilotKit = z.object({
  schemaVersion: z.literal("1.0"),
  scenarioId: id,
  bundleKey: valuePilotBundleKey,
  manifestVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().trim().min(1).max(120),
  purpose: shortText,
  syntheticDataNotice: z.string().trim().min(1).max(350),
  participantFit: shortText,
  targetMinutes: z.number().int().min(1).max(60),
  baselinePrompt: shortText,
  sourcePacket: z.array(sourceCard).min(3).max(10),
  preparation: z.array(preparationStep).min(2).max(8),
  timedSteps: z.array(timedStep).min(2).max(8),
  expectedSignalIds: z.array(id).min(1).max(10),
  rubric: z.array(rubricItem).min(3).max(8),
  safetyChecks: z.array(safetyCheck).min(2).max(10),
  thresholds: releaseThresholds
}).strict().superRefine((value, context) => {
  const unique = (values: string[], path: string) => {
    if (new Set(values).size !== values.length)
      context.addIssue({ code: "custom", path: [path], message: `${path} identifiers must be unique.` });
  };
  unique(value.sourcePacket.map(item => item.id), "sourcePacket");
  unique(value.preparation.map(item => item.id), "preparation");
  unique(value.timedSteps.map(item => item.id), "timedSteps");
  unique(value.expectedSignalIds, "expectedSignalIds");
  unique(value.rubric.map(item => item.id), "rubric");
  unique(value.safetyChecks.map(item => item.issueCode), "safetyChecks");
  if (!value.scenarioId.startsWith(`${value.bundleKey}.`))
    context.addIssue({ code: "custom", path: ["scenarioId"], message: "Scenario must be owned by its bundle." });
  if (value.thresholds.minimumUnaidedAttempts > value.thresholds.minimumRepresentativeAttempts)
    context.addIssue({ code: "custom", path: ["thresholds", "minimumUnaidedAttempts"], message: "Unaided attempts cannot exceed required attempts." });
});

const commonThresholds = {
  minimumRepresentativeAttempts: 3,
  minimumUnaidedAttempts: 2,
  minimumCompletionRate: 2 / 3,
  minimumOutcomeRate: 2 / 3,
  minimumTargetRate: 2 / 3,
  minimumMedianRating: 4,
  maximumMedianCorrections: 2
} as const;

export const representativePilotKits = representativePilotKit.array().length(6).parse([
  {
    schemaVersion: "1.0", scenarioId: "executive.pilot.attention_brief", bundleKey: "executive", manifestVersion: "0.6.0",
    title: "Find the three moves that deserve attention", targetMinutes: 8,
    purpose: "Test whether the bundle can turn permitted task-level signals into a defensible brief without opening unrelated domain content.",
    syntheticDataNotice: "This packet describes fictional work. It is safe for rehearsal and must never be reported as client validation.",
    participantFit: "A person coordinating several kinds of work who already has commitments, decisions, meetings, and due items to review.",
    baselinePrompt: "How long would you normally spend checking each work area and assembling a trustworthy next-action list?",
    sourcePacket: [
      { id: "executive.source.commitment", label: "Confirmed commitment", layer: "task_metadata", content: "Send the board-chair briefing by Thursday at 3:00 PM; owner: participant; status: open.", handling: "The brief may use this task metadata and its due time." },
      { id: "executive.source.partner", label: "Partner follow-up", layer: "task_metadata", content: "Community partner reply is overdue by two days; owner: participant; linked domain: nonprofit.", handling: "Show only the follow-up metadata unless the participant deliberately opens its source." },
      { id: "executive.source.teaching", label: "Teaching preparation", layer: "task_metadata", content: "Teaching outline is due in four days; status: draft; linked domain: ministry.", handling: "Do not surface sermon notes or theological profile content in the cross-bundle brief." },
      { id: "executive.source.decision", label: "Decision awaiting review", layer: "task_metadata", content: "Choose the resource-library launch sequence before Friday; evidence link: synthetic decision record.", handling: "Keep the recommendation tied to the decision record rather than inventing urgency." }
    ],
    preparation: [
      { id: "executive.prep.load", instruction: "Load the four fictional records into the appropriate native work areas or an isolated test workspace.", excludedFromTimer: true },
      { id: "executive.prep.baseline", instruction: "Record the participant's usual-process estimate before opening the Executive workspace.", excludedFromTimer: true },
      { id: "executive.prep.observe", instruction: "Ask the observer to withhold navigation or interpretation help unless the participant is blocked; count every intervention.", excludedFromTimer: true }
    ],
    timedSteps: [
      { id: "executive.step.open", instruction: "Open Executive and determine what deserves attention without facilitator directions.", evidenceOfCompletion: "The participant reaches an attention or brief view using visible navigation." },
      { id: "executive.step.choose", instruction: "Identify no more than three next moves and explain why each belongs on the list.", evidenceOfCompletion: "Every chosen move has a source, reason, owner or due information when known, and a direct action." },
      { id: "executive.step.act", instruction: "Open or deliberately dismiss one recommendation; do not change any other record silently.", evidenceOfCompletion: "The action is explicit and the underlying domain content remains isolated until intentionally opened." }
    ],
    expectedSignalIds: ["executive.signal.brief_accepted", "executive.signal.followup_recovered"],
    rubric: [
      { id: "executive.rubric.priority", label: "Priority judgment", passDescription: "The brief is short, ranks consequential work, and explains urgency from supplied evidence.", critical: false },
      { id: "executive.rubric.action", label: "Actionability", passDescription: "At least one recommendation has a clear next move the participant can take immediately.", critical: false },
      { id: "executive.rubric.trace", label: "Traceability", passDescription: "Each recommendation links back to the correct source record and does not invent facts.", critical: true },
      { id: "executive.rubric.isolation", label: "Domain restraint", passDescription: "Cross-bundle coordination exposes task metadata only until the participant deliberately opens a source.", critical: true }
    ],
    safetyChecks: [
      { issueCode: "cross_domain_exposure", passDescription: "No ministry, nonprofit, writing, or investing body content appears in the aggregate brief." },
      { issueCode: "unauthorized_mutation", passDescription: "No commitment, decision, meeting, or source-domain record changes without explicit confirmation." },
      { issueCode: "evidence_gap", passDescription: "Every ranked item retains its source and reason." }
    ], thresholds: commonThresholds
  },
  {
    schemaVersion: "1.0", scenarioId: "writer_editor.pilot.resource_review", bundleKey: "writer_editor", manifestVersion: "0.4.0",
    title: "Turn an unfinished resource into a publishable recommendation", targetMinutes: 10,
    purpose: "Test one source-led review that preserves voice while combining editorial, metadata, related-resource, and publishing checks.",
    syntheticDataNotice: "All titles, prose, links, and library history in this packet are fictional. Use them only for rehearsal, never as client work or measured client value.",
    participantFit: "A writer or editor who maintains reusable resources and normally reviews copy, metadata, relationships, and publishing readiness separately.",
    baselinePrompt: "How long would you normally spend reviewing this draft, preparing metadata, checking related items, and deciding whether it is ready to publish?",
    sourcePacket: [
      { id: "writer.source.draft", label: "Unfinished draft", layer: "user_input", content: "Title: Finding Steady Ground After Change. The two-paragraph draft uses a calm first-person pastoral voice, repeats the phrase 'next small step' three times, and ends without a practical invitation.", handling: "Preserve the calm first-person voice; propose edits rather than overwriting the source." },
      { id: "writer.source.catalog", label: "Existing catalog entry", layer: "prior_work", content: "A 2022 resource titled Small Steps Through Transition covers a related topic for congregational leaders and already uses the slug /resources/small-steps-transition.", handling: "Treat it as a related-resource candidate, not automatically as a duplicate." },
      { id: "writer.source.preferences", label: "Confirmed writing preferences", layer: "confirmed_configuration", content: "Prefer short paragraphs, plain language, invitational conclusions, and no inflated claims. Preserve first-person phrasing when present.", handling: "Apply only these confirmed preferences and identify any inference separately." },
      { id: "writer.source.link", label: "Link check", layer: "synthetic_system_state", content: "The draft's only external link returns a synthetic 404 status. No Wix connection is authorized.", handling: "Flag the broken link and keep all publishing actions at proposal or handoff stage." }
    ],
    preparation: [
      { id: "writer.prep.load", instruction: "Create the fictional resource, related catalog record, confirmed preferences, and broken-link status in an isolated test workspace.", excludedFromTimer: true },
      { id: "writer.prep.baseline", instruction: "Record the usual-process estimate before opening Writing.", excludedFromTimer: true },
      { id: "writer.prep.observe", instruction: "Do not explain where review, comparison, metadata, or publication controls are; count any help as facilitator assistance.", excludedFromTimer: true }
    ],
    timedSteps: [
      { id: "writer.step.review", instruction: "Open the unfinished resource and request or prepare a complete review.", evidenceOfCompletion: "The result distinguishes source text, revision proposal, rationale, and evidence." },
      { id: "writer.step.metadata", instruction: "Evaluate the proposed description, taxonomy, SEO metadata, link warning, and related-resource signal.", evidenceOfCompletion: "Metadata is bounded to the source, the 2022 item is not silently marked duplicate, and the broken link is visible." },
      { id: "writer.step.decide", instruction: "Accept, edit, or reject one proposed change and prepare—but do not execute—the publication handoff.", evidenceOfCompletion: "The source remains recoverable, the decision is explicit, and no Wix mutation occurs." }
    ],
    expectedSignalIds: ["writer.signal.review_completed", "writer.signal.proposal_accepted"],
    rubric: [
      { id: "writer.rubric.voice", label: "Voice preservation", passDescription: "The proposal keeps the source's calm first-person voice and avoids adding unsupported certainty.", critical: true },
      { id: "writer.rubric.coverage", label: "Review coverage", passDescription: "Editorial, metadata, relationship, link, and publishing-readiness checks appear in one understandable review.", critical: false },
      { id: "writer.rubric.evidence", label: "Evidence", passDescription: "Every material recommendation points to source text, confirmed preferences, or catalog state.", critical: true },
      { id: "writer.rubric.control", label: "Publication control", passDescription: "The participant reviews a revision-bound handoff and no provider mutation occurs.", critical: true }
    ],
    safetyChecks: [
      { issueCode: "unauthorized_mutation", passDescription: "Neither the canonical resource nor Wix changes without explicit approval." },
      { issueCode: "fabricated_provider_state", passDescription: "The experience states that Wix is not connected and does not fabricate a provider result." },
      { issueCode: "provenance_gap", passDescription: "Source, preference, and system-state claims remain distinguishable." }
    ], thresholds: commonThresholds
  },
  {
    schemaVersion: "1.0", scenarioId: "ministry.pilot.source_layered_brief", bundleKey: "ministry", manifestVersion: "0.2.0",
    title: "Build a source-layered teaching brief", targetMinutes: 12,
    purpose: "Test whether a participant can reach a teachable brief while keeping text, interpretation, tradition, prior work, confirmed preferences, and synthesis visibly separate.",
    syntheticDataNotice: "This is a fictional source packet with placeholder citations. It tests organization and epistemic restraint, not theological accuracy or client belief.",
    participantFit: "A preacher, teacher, or ministry researcher who needs to combine several source layers without flattening them into one voice.",
    baselinePrompt: "How long would you normally spend organizing these source layers into a usable teaching brief and checking what came from where?",
    sourcePacket: [
      { id: "ministry.source.text", label: "Biblical text reference", layer: "authoritative_reference", content: "Luke 10:25–37. The packet supplies the reference only; the participant uses an authorized translation available to them.", handling: "Do not invent or attribute a translation quotation that was not supplied." },
      { id: "ministry.source.academic", label: "Synthetic academic note", layer: "public_source", content: "Pilot Source A argues that the narrative shifts the question from defining a neighbor to acting as one. Citation: Pilot Source A, p. 14 (fictional).", handling: "Keep the placeholder citation visible and never represent it as a real publication." },
      { id: "ministry.source.tradition", label: "Synthetic tradition note", layer: "public_source", content: "Pilot Tradition Note B emphasizes mercy as enacted covenant responsibility. Reference: Pilot Note B (fictional).", handling: "Label the tradition layer and avoid turning it into the participant's personal position." },
      { id: "ministry.source.prior", label: "Prior teaching archive", layer: "prior_work", content: "A 2018 outline titled Who Crossed the Road? focused on attention to the wounded traveler. Its current-belief status is unknown.", handling: "Surface it as prior work only; do not infer present belief." },
      { id: "ministry.source.profile", label: "Confirmed preferences", layer: "confirmed_configuration", content: "Use the participant's authorized Bible translation, distinguish PC(USA) context from broader Reformed tradition, and flag uncertain attribution.", handling: "Treat only this card as confirmed configuration." }
    ],
    preparation: [
      { id: "ministry.prep.load", instruction: "Load the fictional research project, placeholder source cards, archive item, and confirmed preferences in an isolated workspace.", excludedFromTimer: true },
      { id: "ministry.prep.translation", instruction: "Make one authorized biblical translation available without copying it into the measurement record.", excludedFromTimer: true },
      { id: "ministry.prep.baseline", instruction: "Record the usual-process estimate and tell the observer not to coach source-layer navigation.", excludedFromTimer: true }
    ],
    timedSteps: [
      { id: "ministry.step.open", instruction: "Open the research project and prepare a brief for a short teaching discussion.", evidenceOfCompletion: "The participant reaches a source-layered research or teaching view without facilitator directions." },
      { id: "ministry.step.compare", instruction: "Compare the biblical reference, two synthetic source notes, and prior outline.", evidenceOfCompletion: "The result labels every layer and exposes the fictional citation status." },
      { id: "ministry.step.synthesize", instruction: "Draft or refine one teachable claim and one question for further study.", evidenceOfCompletion: "AI synthesis is labeled, the prior outline is not treated as current belief, and the participant can edit or reject it." }
    ],
    expectedSignalIds: ["ministry.signal.research_brief_used", "ministry.signal.prior_work_recovered"],
    rubric: [
      { id: "ministry.rubric.layers", label: "Source layers", passDescription: "Biblical reference, academic interpretation, tradition, prior work, confirmed configuration, and synthesis remain visibly distinct.", critical: true },
      { id: "ministry.rubric.citations", label: "Citation honesty", passDescription: "Placeholder citations are clearly fictional and missing source text is not fabricated.", critical: true },
      { id: "ministry.rubric.usability", label: "Teaching usefulness", passDescription: "The participant can use or refine at least one bounded teaching claim or discussion question.", critical: false },
      { id: "ministry.rubric.belief", label: "Belief restraint", passDescription: "No inference or prior writing silently becomes the participant's theological belief.", critical: true }
    ],
    safetyChecks: [
      { issueCode: "unsafe_domain_guidance", passDescription: "The experience does not assign beliefs or obscure interpretive uncertainty." },
      { issueCode: "provenance_gap", passDescription: "Every research claim retains its layer and source status." },
      { issueCode: "fabricated_provider_state", passDescription: "No Logos content or connection is claimed unless separately authorized and verified." }
    ], thresholds: commonThresholds
  },
  {
    schemaVersion: "1.0", scenarioId: "nonprofit_founder.pilot.next_moves", bundleKey: "nonprofit_founder", manifestVersion: "0.2.0",
    title: "Turn a founder idea into owned next moves", targetMinutes: 12,
    purpose: "Test whether a founder can sequence launch work, advance a partner follow-up, and isolate questions that require authoritative research or professional review.",
    syntheticDataNotice: "The organization, people, dates, and status facts are fictional and contain no patient or client information. This rehearsal is not legal, tax, fundraising, or clinical advice.",
    participantFit: "An early nonprofit founder coordinating formation, governance, partnerships, volunteers, funding, and administrative launch work.",
    baselinePrompt: "How long would you normally spend reviewing the project, deciding the next milestones, and locating the evidence needed for unresolved formation questions?",
    sourcePacket: [
      { id: "nonprofit.source.idea", label: "Founder objective", layer: "user_input", content: "Harbor Bridge Community Network is a fictional Florida charitable initiative preparing a small administrative pilot; no clinical services or records are in scope.", handling: "Keep the roadmap generic and administrative; do not create clinical guidance or records." },
      { id: "nonprofit.source.board", label: "Governance status", layer: "task_metadata", content: "Two prospective directors have expressed interest; conflict-of-interest review and role confirmation are not complete.", handling: "Treat interest as pipeline status, not board appointment." },
      { id: "nonprofit.source.partner", label: "Partner follow-up", layer: "task_metadata", content: "A community organization requested a one-page pilot description seven days ago; owner is unassigned.", handling: "Create an administrative follow-up with an explicit owner and review step." },
      { id: "nonprofit.source.formation", label: "Formation question", layer: "authoritative_reference", content: "Question: which current Florida filing and solicitation requirements apply before launch? Candidate authorities: Florida Division of Corporations, FDACS, and IRS. No conclusion is supplied.", handling: "Preserve jurisdiction, retrieval/effective dates, uncertainty, and professional-review recommendation." },
      { id: "nonprofit.source.funding", label: "Funding constraint", layer: "user_input", content: "The fictional pilot has no approved budget and has not authorized donor outreach.", handling: "Do not send outreach, promise eligibility, or represent funding as committed." }
    ],
    preparation: [
      { id: "nonprofit.prep.load", instruction: "Load the fictional roadmap, partner, governance, and research-question records in an isolated workspace.", excludedFromTimer: true },
      { id: "nonprofit.prep.sources", instruction: "Keep live research disabled for rehearsal unless authoritative sources are intentionally supplied and their retrieval dates are recorded.", excludedFromTimer: true },
      { id: "nonprofit.prep.baseline", instruction: "Record the usual-process estimate and withhold facilitator coaching during the timed work.", excludedFromTimer: true }
    ],
    timedSteps: [
      { id: "nonprofit.step.review", instruction: "Open the founder workspace and identify the three most consequential immediate moves.", evidenceOfCompletion: "The moves are sequenced, bounded, and tied to supplied project state." },
      { id: "nonprofit.step.assign", instruction: "Advance the overdue partner follow-up by assigning an owner and drafting a reviewable next action.", evidenceOfCompletion: "The action remains a proposal until the participant confirms it; no message is sent." },
      { id: "nonprofit.step.research", instruction: "Frame the Florida formation question for source-first research.", evidenceOfCompletion: "The record preserves jurisdiction, candidate authority, uncertainty, retrieval/effective-date needs, and professional review." }
    ],
    expectedSignalIds: ["nonprofit.signal.roadmap_adopted", "nonprofit.signal.followup_advanced"],
    rubric: [
      { id: "nonprofit.rubric.sequence", label: "Consequential sequence", passDescription: "The roadmap distinguishes immediate dependencies from later work and names owners where available.", critical: false },
      { id: "nonprofit.rubric.authority", label: "Source-first research", passDescription: "Regulatory questions point to appropriate authorities and never collapse into an unsupported compliance conclusion.", critical: true },
      { id: "nonprofit.rubric.control", label: "Outreach control", passDescription: "Partner or donor communication remains reviewable and unsent until explicitly authorized.", critical: true },
      { id: "nonprofit.rubric.boundary", label: "Clinical boundary", passDescription: "The workflow stores no substantive health information and produces no diagnosis, treatment, or clinical-risk guidance.", critical: true }
    ],
    safetyChecks: [
      { issueCode: "unsafe_domain_guidance", passDescription: "No legal-compliance conclusion, clinical guidance, or treatment record is produced." },
      { issueCode: "unauthorized_mutation", passDescription: "No outreach, scheduling, appointment, or provider action occurs without confirmation." },
      { issueCode: "evidence_gap", passDescription: "Every regulatory finding is source-bound with uncertainty and review needs." }
    ], thresholds: commonThresholds
  },
  {
    schemaVersion: "1.0", scenarioId: "investor.pilot.thesis_review", bundleKey: "investor", manifestVersion: "0.2.0",
    title: "Decide whether new evidence changes a thesis", targetMinutes: 12,
    purpose: "Test an evidence-balanced review that separates facts, interpretation, thesis, scenarios, and predictions and makes invalidation observable.",
    syntheticDataNotice: "The company, ticker, prices, filings, dates, and claims are fictional. The packet tests research structure only and must not inform an investment or trade.",
    participantFit: "A self-directed investor or analyst who reviews public filings and wants a repeatable, challenge-seeking thesis process without connecting a brokerage account.",
    baselinePrompt: "How long would you normally spend comparing these disclosures with the current thesis and writing a support, challenge, or no-change conclusion?",
    sourcePacket: [
      { id: "investor.source.thesis", label: "Current thesis", layer: "user_input", content: "Fictional Northstar Components (NSTX) can expand gross margin above 31% by year end while keeping net leverage below 2.5x. Confidence: medium.", handling: "Treat this as the participant's thesis, not an observed fact or recommendation." },
      { id: "investor.source.quarterly", label: "Synthetic quarterly filing", layer: "public_source", content: "Pilot 10-Q dated 2026-08-01 reports gross margin of 29.4%, prior period 28.8%, and net leverage of 2.3x. This is not a real SEC filing.", handling: "Label the figures as fictional observed facts tied to this card." },
      { id: "investor.source.current", label: "Synthetic current report", layer: "public_source", content: "Pilot 8-K dated 2026-08-19 reports a six-week delay in a high-margin product line. Management impact estimate is not supplied.", handling: "Do not invent financial impact; treat timing significance as interpretation." },
      { id: "investor.source.form4", label: "Synthetic Form 4", layer: "public_source", content: "Pilot Form 4 dated 2026-08-22 records a pre-planned sale by one officer under a fictional 10b5-1 plan.", handling: "Do not label this material nonpublic information or infer motive from the transaction." },
      { id: "investor.source.invalidation", label: "Existing invalidation rule", layer: "user_input", content: "Revisit the thesis if net leverage exceeds 2.5x or if the margin-improvement schedule slips by more than one quarter.", handling: "Compare evidence against the stated rule without turning the result into trading advice." }
    ],
    preparation: [
      { id: "investor.prep.load", instruction: "Load the fictional company, thesis, invalidation rule, and three synthetic disclosure cards in an isolated workspace.", excludedFromTimer: true },
      { id: "investor.prep.network", instruction: "Do not fetch live market or SEC data during rehearsal; the packet is deliberately self-contained.", excludedFromTimer: true },
      { id: "investor.prep.baseline", instruction: "Record the usual-process estimate and do not coach the participant through the thesis workflow.", excludedFromTimer: true }
    ],
    timedSteps: [
      { id: "investor.step.review", instruction: "Open the thesis and determine what changed using only the supplied packet.", evidenceOfCompletion: "Each cited figure or event points to the correct fictional disclosure card and date." },
      { id: "investor.step.challenge", instruction: "Record at least one supporting point, one challenging point, and the strongest uncertainty.", evidenceOfCompletion: "Facts, interpretation, thesis, scenario, and prediction labels remain distinct." },
      { id: "investor.step.decide", instruction: "Choose a supported update or explicit no-change conclusion and review the invalidation conditions.", evidenceOfCompletion: "The conclusion is evidence-bound, includes a countercase, and performs no trade or portfolio action." }
    ],
    expectedSignalIds: ["investor.signal.thesis_updated", "investor.signal.challenge_found"],
    rubric: [
      { id: "investor.rubric.separation", label: "Epistemic separation", passDescription: "Fact, interpretation, thesis, scenario, and prediction are visibly and consistently distinguished.", critical: true },
      { id: "investor.rubric.balance", label: "Challenge seeking", passDescription: "The review gives material supporting and challenging evidence plus a bounded uncertainty or countercase.", critical: false },
      { id: "investor.rubric.freshness", label: "Source freshness", passDescription: "Every disclosure retains its synthetic status and date; no live or missing provider state is invented.", critical: true },
      { id: "investor.rubric.invalidation", label: "Observable invalidation", passDescription: "The conclusion evaluates the stated invalidation rules without becoming a recommendation or trade.", critical: true }
    ],
    safetyChecks: [
      { issueCode: "unsafe_domain_guidance", passDescription: "The experience provides research support, not personalized trading instruction or execution." },
      { issueCode: "fabricated_provider_state", passDescription: "It does not claim live SEC, market, brokerage, or portfolio access." },
      { issueCode: "provenance_gap", passDescription: "Every material claim retains the correct fictional card and date." }
    ], thresholds: commonThresholds
  },
  {
    schemaVersion: "1.0", scenarioId: "workspace_experience.pilot.attention_workspace", bundleKey: "workspace_experience", manifestVersion: "0.5.0",
    title: "Open once and know where to begin", targetMinutes: 5,
    purpose: "Test whether entitlement-derived navigation and prioritized attention help a participant begin useful work without exposing or inventing unavailable bundle content.",
    syntheticDataNotice: "The assigned bundles, attention items, and preferences are fictional. They test composition and navigation only and are not customer usage evidence.",
    participantFit: "A participant assigned several bundles who needs one dependable starting point rather than an equal-card catalog.",
    baselinePrompt: "How long would you normally spend opening separate tools or lists before deciding which item deserves attention first?",
    sourcePacket: [
      { id: "workspace.source.entitlements", label: "Assigned bundles", layer: "synthetic_system_state", content: "Assigned: Executive, Writer & Editor, Ministry, and Workspace Experience. Not assigned: Nonprofit Founder and Investor.", handling: "Navigation and actions must derive from this assignment; unavailable bundles stay non-navigable." },
      { id: "workspace.source.writing", label: "Writing attention", layer: "task_metadata", content: "Two resources await explicit publication review; highest due item is tomorrow.", handling: "Expose count, reason, and exact source link without showing document body text." },
      { id: "workspace.source.ministry", label: "Ministry attention", layer: "task_metadata", content: "One teaching outline is due in four days and remains a draft.", handling: "Expose bounded task metadata only." },
      { id: "workspace.source.executive", label: "Executive attention", layer: "task_metadata", content: "One confirmed commitment is overdue by one day.", handling: "Rank from supplied urgency and preserve the underlying source link." },
      { id: "workspace.source.preference", label: "Layout preference", layer: "confirmed_configuration", content: "No default workspace has been chosen. No persistent layout change has been approved.", handling: "AI may recommend a start view but cannot persist it without explicit confirmation." }
    ],
    preparation: [
      { id: "workspace.prep.load", instruction: "Create the fictional assignment, task metadata, and empty preference state in an isolated workspace.", excludedFromTimer: true },
      { id: "workspace.prep.reset", instruction: "Start from Home with no open bundle page and no previously confirmed default workspace.", excludedFromTimer: true },
      { id: "workspace.prep.baseline", instruction: "Record the usual-process estimate and provide no navigation hints during the timed attempt.", excludedFromTimer: true }
    ],
    timedSteps: [
      { id: "workspace.step.orient", instruction: "Open Home and decide which item deserves attention first.", evidenceOfCompletion: "The participant identifies the overdue commitment from a prioritized view rather than an equal bundle-card grid." },
      { id: "workspace.step.navigate", instruction: "Open the exact source for one attention item and return to Home.", evidenceOfCompletion: "The link lands on the correct authorized source; unassigned bundle navigation is absent or disabled." },
      { id: "workspace.step.confirm", instruction: "Review a starting-workspace or layout recommendation and explicitly accept or reject it.", evidenceOfCompletion: "No persistent change occurs before confirmation and the participant can explain what changed." }
    ],
    expectedSignalIds: ["workspace.signal.attention_actioned", "workspace.signal.layout_confirmed"],
    rubric: [
      { id: "workspace.rubric.orientation", label: "Immediate orientation", passDescription: "The participant understands what deserves attention without opening every bundle.", critical: false },
      { id: "workspace.rubric.entitlement", label: "Entitlement fidelity", passDescription: "Assigned capabilities compose deterministically and unassigned bundles expose no navigable private surface.", critical: true },
      { id: "workspace.rubric.source", label: "Exact source", passDescription: "Attention and search actions preserve the right bundle, reason, and destination.", critical: true },
      { id: "workspace.rubric.control", label: "Layout control", passDescription: "Recommendations are previewed and persistent layout changes require explicit confirmation.", critical: true }
    ],
    safetyChecks: [
      { issueCode: "cross_domain_exposure", passDescription: "Home shows bounded task metadata rather than underlying domain content." },
      { issueCode: "unauthorized_mutation", passDescription: "No layout, default, dismissal, or domain record changes without a clear user action." },
      { issueCode: "accessibility_blocker", passDescription: "The complete journey remains keyboard-usable and understandable without relying on color alone." }
    ], thresholds: commonThresholds
  }
]);

const commonRun = z.object({
  schemaVersion: z.literal("1.0"),
  scenarioId: id,
  bundleKey: valuePilotBundleKey,
  pilotId: z.string().uuid(),
  mode: z.enum(["synthetic_rehearsal", "authorized_representative"]),
  attemptedAt: z.iso.datetime({ offset: true }),
  facilitatorActions: z.number().int().min(0).max(20),
  issueCodes: z.array(pilotIssueCode).max(11).refine(items => new Set(items).size === items.length, "Issue codes must be unique.")
});

const completedRun = commonRun.extend({
  status: z.literal("completed"),
  elapsedSeconds: z.number().int().min(0).max(604800),
  baselineMinutes: z.number().int().min(1).max(480),
  outcomeAchieved: z.boolean(),
  successSignalIds: z.array(id).max(10).refine(items => new Set(items).size === items.length, "Signals must be unique."),
  ratings: valuePilotRatings,
  gates: valuePilotGateAnswers,
  correctionCount: z.number().int().min(0).max(100)
}).strict().superRefine((value, context) => {
  if (value.outcomeAchieved !== (value.successSignalIds.length > 0))
    context.addIssue({ code: "custom", path: ["successSignalIds"], message: "Outcome and signals must agree." });
});

const abandonedRun = commonRun.extend({
  status: z.literal("abandoned"),
  elapsedSeconds: z.number().int().min(0).max(604800),
  reason: z.enum(["interrupted", "outcome_unclear", "source_gap", "workflow_friction", "other"])
}).strict();

export const representativePilotRun = z.discriminatedUnion("status", [completedRun, abandonedRun]);
export type RepresentativePilotKit = z.infer<typeof representativePilotKit>;
export type RepresentativePilotRun = z.infer<typeof representativePilotRun>;

const criticalIssues = new Set([
  "evidence_gap", "provenance_gap", "cross_domain_exposure", "unauthorized_mutation",
  "unsafe_domain_guidance", "fabricated_provider_state", "measurement_content_leak", "accessibility_blocker"
]);

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function assessRepresentativePilot(kitInput: RepresentativePilotKit, runInputs: RepresentativePilotRun[]) {
  const kit = representativePilotKit.parse(kitInput);
  const runs = runInputs.map(run => representativePilotRun.parse(run));
  if (new Set(runs.map(run => run.pilotId)).size !== runs.length) throw new Error("Pilot runs must be unique.");
  if (runs.some(run => run.bundleKey !== kit.bundleKey || run.scenarioId !== kit.scenarioId))
    throw new Error("Every run must match the assessed pilot kit.");
  if (runs.some(run => run.status === "completed" && run.successSignalIds.some(signal => !kit.expectedSignalIds.includes(signal))))
    throw new Error("A completed run contains a signal outside the pilot kit.");

  const representative = runs.filter(run => run.mode === "authorized_representative");
  const completed = representative.filter((run): run is z.infer<typeof completedRun> => run.status === "completed");
  const rate = (count: number) => representative.length ? count / representative.length : 0;
  const metrics = {
    representativeAttempts: representative.length,
    rehearsalAttemptsExcluded: runs.length - representative.length,
    completedAttempts: completed.length,
    unaidedAttempts: representative.filter(run => run.facilitatorActions === 0).length,
    completionRate: rate(completed.length),
    outcomeRate: rate(completed.filter(run => run.outcomeAchieved).length),
    targetRate: rate(completed.filter(run => run.elapsedSeconds <= kit.targetMinutes * 60).length),
    medianElapsedSeconds: median(completed.map(run => run.elapsedSeconds)),
    medianMinutesSaved: median(completed.map(run => Math.max(0, run.baselineMinutes - Math.ceil(run.elapsedSeconds / 60)))),
    medianCorrections: median(completed.map(run => run.correctionCount)),
    medianUsefulness: median(completed.map(run => run.ratings.usefulness)),
    medianTrust: median(completed.map(run => run.ratings.trust)),
    medianActionability: median(completed.map(run => run.ratings.actionability)),
    allTrustGatesMet: completed.length > 0 && completed.every(run => run.gates.evidenceVisible && run.gates.provenanceVisible && run.gates.mutationControlPreserved),
    criticalIssueCount: representative.reduce((count, run) => count + run.issueCodes.filter(issue => criticalIssues.has(issue)).length, 0)
  };
  const reasons: string[] = [];
  const t = kit.thresholds;
  if (metrics.representativeAttempts < t.minimumRepresentativeAttempts) reasons.push("representative_attempts_missing");
  if (metrics.unaidedAttempts < t.minimumUnaidedAttempts) reasons.push("unaided_attempts_missing");
  if (metrics.completionRate < t.minimumCompletionRate) reasons.push("completion_rate_below_threshold");
  if (metrics.outcomeRate < t.minimumOutcomeRate) reasons.push("outcome_rate_below_threshold");
  if (metrics.targetRate < t.minimumTargetRate) reasons.push("target_rate_below_threshold");
  if ([metrics.medianUsefulness, metrics.medianTrust, metrics.medianActionability].some(value => value === null || value < t.minimumMedianRating))
    reasons.push("median_rating_below_threshold");
  if (metrics.medianCorrections === null || metrics.medianCorrections > t.maximumMedianCorrections) reasons.push("corrections_above_threshold");
  if (!metrics.allTrustGatesMet) reasons.push("trust_gate_failure");
  if (metrics.criticalIssueCount) reasons.push("critical_issue_observed");
  const decision = metrics.representativeAttempts < t.minimumRepresentativeAttempts
    ? "insufficient_evidence" : reasons.length ? "iterate_and_repeat" : "advance_to_controlled_beta";
  return { schemaVersion: "1.0" as const, scenarioId: kit.scenarioId, bundleKey: kit.bundleKey,
    decision: decision as "insufficient_evidence" | "iterate_and_repeat" | "advance_to_controlled_beta", metrics, reasons };
}

export const representativePilotKitByBundle = Object.fromEntries(
  representativePilotKits.map(kit => [kit.bundleKey, kit])
) as Record<z.infer<typeof valuePilotBundleKey>, RepresentativePilotKit>;
