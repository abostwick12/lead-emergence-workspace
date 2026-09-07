import { DIMENSIONS, type Dimension, type Evidence, type PilotState, type Story } from "./contracts";

export function requireRecord<T extends { id: string }>(records: T[], id: string, label: string): T {
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error(`${label} was not found. Refresh the SOTF Bundle state before continuing.`);
  return record;
}
const tokens = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !["the", "and", "for", "with", "this", "that", "from", "into"].includes(word));
const synonyms: Record<string, string[]> = { stakeholder: ["alignment", "coordination", "partners"], leadership: ["team", "led", "people"], delivery: ["delivered", "execution", "program"], ambiguity: ["uncertainty", "uncertain"], technical: ["engineering", "technology"], transformation: ["change", "improvement"] };

/** Search the full approved operational bank before applying a result limit. No recency window. */
export function recallStories(state: PilotState, query: string, limit = 5): Array<{ story: Story; relevance: number; matchedTerms: string[] }> {
  const queryTerms = [...new Set(tokens(query).flatMap((term) => [term, ...(synonyms[term] ?? [])]))];
  return state.stories.map((story) => {
    const words = new Set(tokens([story.title, story.situation, story.contribution, story.scope, story.actions, story.outcome, ...story.skills].join(" ")));
    const matchedTerms = queryTerms.filter((term) => words.has(term));
    const strong = tokens(`${story.title} ${story.skills.join(" ")}`);
    return { story, matchedTerms, relevance: matchedTerms.reduce((score, term) => score + (strong.includes(term) ? 3 : 1), 0) };
  }).filter((item) => item.relevance > 0).sort((a, b) => b.relevance - a.relevance || a.story.id.localeCompare(b.story.id)).slice(0, limit);
}

export type VectorRow = { dimension: Dimension; label: string; score: number | null; confidence: "unknown" | "low" | "medium" | "high"; coverage: { known: number; expected: number }; supporting: Evidence[]; conflicting: Evidence[]; unknowns: string[] };
export type Assessment = { opportunityId: string; eligibility: "eligible" | "unresolved" | "blocked"; recommendation: "GO" | "MAYBE" | "NO"; confidence: "low" | "medium" | "high"; vector: VectorRow[]; blockers: string[]; unknowns: string[]; reasons: string[]; contextImpact: string[]; nextInvestigation: string; questions: string[]; positioning: ReturnType<typeof recallStories>; gaps: string[]; revisitWhen: string; computedAtRevision: number };
const dimensionQuestions: Record<Dimension, string> = {
  experience: "Which accomplishments would demonstrate success in the first six months, and what proof is missing?",
  actual_work: "What decisions would this role own, and what did a typical week look like for its current or previous holder?",
  culture: "Can a practitioner describe a recent disagreement, decision, and escalation in this specific team?",
  values: "What happens when the team's stated values conflict with a delivery or commercial deadline?",
  environment: "How do the manager, team structure, pace, and working arrangements affect day-to-day autonomy?",
  trajectory: "What did people in this role go on to do, and which capabilities became more portable?",
  lifestyle: "Which travel, location, schedule, benefits, and compensation terms are established rather than estimated?"
};
function credible(evidence: Evidence): boolean { return evidence.review === "accepted" && !["inference", "community"].includes(evidence.source.kind); }

export function assessOpportunity(state: PilotState, opportunityId: string): Assessment {
  const opportunity = requireRecord(state.opportunities, opportunityId, "Opportunity");
  const all = state.evidence.filter((item) => item.opportunityId === opportunityId && item.review === "accepted");
  const relevant = all.filter((item) => !item.criterionId || state.criteria.some((criterion) => criterion.id === item.criterionId && (item as Evidence & { criterionDesired?: string }).criterionDesired === criterion.desired));
  const mandatory = opportunity.requirements.filter((item) => item.mandatory);
  const established = (requirement: typeof mandatory[number]) => requirement.evidenceIds.some((id) => relevant.some((evidence) => evidence.id === id && credible(evidence)));
  const blockers = mandatory.filter((item) => item.status === "not_met" && established(item)).map((item) => `Mandatory requirement not met: ${item.label}`);
  const requirementUnknowns = mandatory.filter((item) => item.status === "unknown" || !established(item)).map((item) => `Verify ${item.label}`);
  if (!mandatory.length) requirementUnknowns.unshift("Establish the mandatory requirements from the actual job description.");
  const eligibility = blockers.length ? "blocked" : requirementUnknowns.length ? "unresolved" : "eligible";
  const contextImpact: string[] = [];
  const criterionUnknowns: string[] = [];
  for (const criterion of state.criteria) {
    const evidence = relevant.filter((item) => item.criterionId === criterion.id);
    const conflict = evidence.find((item) => item.direction === "conflicting");
    const support = evidence.find((item) => item.direction === "supporting");
    if (conflict) {
      contextImpact.push(`Your confirmed criterion “${criterion.label}: ${criterion.desired}” changes this assessment: ${conflict.statement}${support ? ` Conflicting support also exists: ${support.statement}` : ""}`);
      if (criterion.nonNegotiable && credible(conflict) && conflict.reliability === "high" && !support) blockers.push(`Non-negotiable conflict — ${criterion.label}: ${conflict.statement}`);
    } else if (support) contextImpact.push(`Your confirmed criterion “${criterion.label}: ${criterion.desired}” is supported by: ${support.statement}`);
    else if (criterion.nonNegotiable) criterionUnknowns.push(`Resolve your non-negotiable criterion: ${criterion.label} — ${criterion.desired}`);
  }
  if (!state.criteria.length) contextImpact.push("No operational criteria have been confirmed. This assessment cannot yet explain personal fit. Protected Professional Context is unavailable in this pilot slice.");
  const vector = (Object.keys(DIMENSIONS) as Dimension[]).map((dimension): VectorRow => {
    const evidence = relevant.filter((item) => item.dimension === dimension);
    const criteria = state.criteria.filter((item) => item.dimension === dimension);
    // Multiple publications of the same source are not independent votes.
    const unique = [...new Map(evidence.filter((item) => item.score !== undefined && item.source.kind !== "inference").map((item) => [`${item.criterionId ?? "dimension"}:${item.source.url ?? item.source.reference}:${item.source.scope}`, item])).values()];
    const weight = (item: Evidence) => (state.criteria.find((criterion) => criterion.id === item.criterionId)?.importance ?? 1) * ({ low: 1, medium: 2, high: 3 }[item.reliability]);
    const totalWeight = unique.reduce((sum, item) => sum + weight(item), 0);
    const known = criteria.length ? criteria.filter((criterion) => unique.some((item) => item.criterionId === criterion.id)).length : unique.length ? 1 : 0;
    const expected = Math.max(1, criteria.length);
    const independentSources = new Set(unique.filter(credible).map((item) => item.source.url ?? item.source.reference));
    const conflicting = evidence.filter((item) => item.direction === "conflicting");
    return { dimension, label: DIMENSIONS[dimension], score: totalWeight ? Math.round(unique.reduce((sum, item) => sum + item.score! * weight(item), 0) / totalWeight * 10) / 10 : null,
      confidence: !unique.length ? "unknown" : independentSources.size >= 2 && known === expected && !conflicting.length ? "high" : unique.some((item) => credible(item) && item.reliability !== "low") ? "medium" : "low",
      coverage: { known, expected }, supporting: evidence.filter((item) => item.direction === "supporting"), conflicting,
      unknowns: criteria.length ? criteria.filter((criterion) => !unique.some((item) => item.criterionId === criterion.id)).map((item) => `${item.label}: ${item.desired}`) : unique.length ? [] : [dimensionQuestions[dimension]] };
  });
  const unanswered = [...requirementUnknowns, ...criterionUnknowns];
  const fitUnknowns = vector.flatMap((row) => row.unknowns);
  const weak = vector.filter((row) => row.score !== null && row.score < 5);
  const enoughFit = ["experience", "actual_work"].every((dimension) => vector.some((row) => row.dimension === dimension && row.score !== null && row.score >= 5 && row.confidence !== "low"));
  const recommendation = blockers.length ? "NO" : eligibility === "eligible" && state.criteria.length > 0 && !unanswered.length && !weak.length && enoughFit ? "GO" : "MAYBE";
  const unknowns = [...new Set([...unanswered, ...fitUnknowns])];
  const nextInvestigation = blockers[0] ? `Resolve whether this condition can change before further investment: ${blockers[0]}` : unknowns[0] ?? "Validate remaining team-specific assumptions with a practitioner before committing more time.";
  const reasons = recommendation === "NO" ? ["A verified requirement or confirmed non-negotiable conflicts with this opportunity. Strong scores cannot offset it.", ...blockers]
    : recommendation === "GO" ? ["Eligibility is established and reviewed evidence supports experience and actual work. Continue proportionate investigation of the remaining unknowns."]
      : ["This opportunity needs a targeted investigation before a confident pursuit decision.", ...unanswered.slice(0, 2), ...weak.map((row) => `${row.label} has material conflicting evidence.`)];
  return { opportunityId, eligibility, recommendation, confidence: blockers.length || vector.filter((row) => row.confidence === "high").length >= 4 ? "high" : enoughFit ? "medium" : "low", vector, blockers, unknowns, reasons, contextImpact, nextInvestigation,
    questions: [...new Set([nextInvestigation, ...vector.filter((row) => row.score === null || row.conflicting.length).map((row) => dimensionQuestions[row.dimension])])].slice(0, 8),
    positioning: recallStories(state, `${opportunity.role} ${opportunity.description} ${opportunity.actualWork}`),
    gaps: [...opportunity.requirements.filter((item) => item.status !== "met").map((item) => `${item.mandatory ? "Required" : "Preferred"}: ${item.label}`), ...opportunity.hypothesisIds.flatMap((id) => state.hypotheses.find((item) => item.id === id)?.gaps ?? [])],
    revisitWhen: opportunity.decision?.revisitWhen ?? "New requirement evidence, practitioner feedback, or a reviewed change in your criteria arrives.", computedAtRevision: state.revision };
}

export function hypothesisLearning(state: PilotState, hypothesisId: string) {
  const hypothesis = requireRecord(state.hypotheses, hypothesisId, "Hypothesis");
  const evidence = state.evidence.filter((item) => item.hypothesisIds.includes(hypothesisId) && item.review === "accepted");
  return { hypothesis, supporting: evidence.filter((item) => item.direction === "supporting"), conflicting: evidence.filter((item) => item.direction === "conflicting"), pending: state.evidence.filter((item) => item.hypothesisIds.includes(hypothesisId) && item.review === "pending"), jobsReviewed: state.opportunities.filter((item) => item.hypothesisIds.includes(hypothesisId)), conversations: state.meetings.filter((item) => item.hypothesisIds.includes(hypothesisId)), people: state.people.filter((item) => item.hypothesisIds.includes(hypothesisId)), nextExperiment: hypothesis.nextExperiment, reviewTrigger: hypothesis.reviewTrigger };
}

export function prepareMeeting(state: PilotState, meetingId: string) {
  const meeting = requireRecord(state.meetings, meetingId, "Meeting");
  const person = state.people.find((item) => item.id === meeting.personId);
  const opportunity = state.opportunities.find((item) => item.id === meeting.opportunityId);
  const prior = state.meetings.filter((item) => item.id !== meetingId && Boolean(meeting.personId) && item.personId === meeting.personId && item.debrief && item.startsAt < meeting.startsAt);
  const questions = [...new Set([`What would help us resolve: ${meeting.objective}`, ...(opportunity ? assessOpportunity(state, opportunity.id).questions : []), "What changes are most affecting the work your team does?", "What surprised you about the actual day-to-day work?", "Which decisions can someone in this role make independently?", "What would you suggest I test or demonstrate next?", "Which work samples, resources, or practitioner conversations would help me learn more?"])].slice(0, 8);
  return { meeting, person: person ?? null, company: opportunity?.company ?? person?.company ?? "Company context not supplied", functionContext: opportunity?.actualWork || person?.role || "Ask for function context", priorInteractions: prior.map((item) => ({ title: item.title, at: item.startsAt, said: item.debrief!.said })), hypotheses: meeting.hypothesisIds.map((id) => hypothesisLearning(state, id)), objective: meeting.objective, alreadyKnown: state.evidence.filter((item) => item.review === "accepted" && ((meeting.opportunityId && item.opportunityId === meeting.opportunityId) || (meeting.personId && item.personId === meeting.personId))), questions,
    introduction: `I'm exploring ${meeting.hypothesisIds.map((id) => state.hypotheses.find((item) => item.id === id)?.proposition).filter(Boolean).join(" and ") || "my next professional chapter"}. I'd value your perspective on ${meeting.objective.toLowerCase()}.`,
    avoid: ["Do not ask for confidential employer information.", "Do not assume an introduction or referral has been agreed.", "Avoid asking questions already answered in the prior interaction notes."], commitments: state.commitments.filter((item) => (item.meetingId === meetingId || (meeting.personId && item.personId === meeting.personId)) && item.status !== "cancelled") };
}

export function prepareCoaching(state: PilotState, since?: string) {
  const last = since ?? state.meetings.filter((item) => item.kind === "coaching" && item.debrief).sort((a, b) => b.debrief!.at.localeCompare(a.debrief!.at))[0]?.debrief?.at ?? state.chapter?.startedAt ?? "1970-01-01";
  const changed = state.changes.filter((item) => item.at > last);
  const commitments = state.commitments.filter((item) => item.updatedAt >= last || item.status === "open" || item.status === "blocked");
  const developments = state.evidence.filter((item) => item.review === "accepted" && (item.reviewedAt ?? item.createdAt) > last);
  const decisions = state.opportunities.filter((item) => ["exploring", "investigate", "pause"].includes(item.status)).map((item) => ({ opportunity: item, assessment: assessOpportunity(state, item.id) }));
  return { since: last, changed, completed: commitments.filter((item) => item.status === "done"), stuck: commitments.filter((item) => item.status === "blocked"), openCommitments: commitments.filter((item) => item.status === "open"), developments, hypotheses: state.hypotheses.map((item) => hypothesisLearning(state, item.id)), decisions,
    agenda: [...decisions.slice(0, 2).map((item) => `${item.opportunity.company}: ${item.assessment.nextInvestigation}`), ...commitments.filter((item) => item.status === "blocked").slice(0, 2).map((item) => `Unblock ${item.title}`), "Which hypothesis should I test next, and what should I stop doing?"],
    shareable: { generatedFrom: "Selected ordinary transition operations only; review before sharing", summary: state.chapter?.question ?? "Set the next transition question", completed: commitments.filter((item) => item.status === "done").map((item) => item.title), decisions: decisions.map((item) => `${item.opportunity.company} — ${item.opportunity.role}`), nextExperiments: state.hypotheses.filter((item) => item.status === "continue" || item.status === "refine").map((item) => item.nextExperiment) } };
}

export type BriefItem = { id: string; title: string; whyNow: string; context: string; action: string; ifWait: string; urgency: number };
export function dailyBrief(state: PilotState, now: string): BriefItem[] {
  const today = now.slice(0, 10); const horizon = new Date(new Date(now).valueOf() + 48 * 3600000).toISOString();
  const items: BriefItem[] = [];
  state.meetings.filter((item) => ["planned", "accepted"].includes(item.status) && item.startsAt >= now && item.startsAt <= horizon).forEach((meeting) => items.push({ id: `meeting:${meeting.id}`, title: meeting.title, whyNow: `Meeting at ${meeting.startsAt}`, context: meeting.objective, action: "Prepare the conversation", ifWait: "Less time to resolve preparation gaps.", urgency: 100 }));
  state.commitments.filter((item) => ["open", "blocked"].includes(item.status) && item.due && item.due <= horizon.slice(0, 10)).forEach((item) => items.push({ id: `commitment:${item.id}`, title: item.title, whyNow: `${item.status === "blocked" ? "Blocked; " : ""}due ${item.due}`, context: item.definitionOfDone, action: item.status === "blocked" ? "Resolve the blocker or deliberately renegotiate" : "Complete the promise and record the result", ifWait: item.reviewTrigger, urgency: item.due! < today ? 110 : 90 }));
  state.opportunities.filter((item) => !["decline", "pause"].includes(item.status) && item.deadline && item.deadline <= horizon.slice(0, 10) && !state.applications.some((application) => application.opportunityId === item.id)).forEach((item) => items.push({ id: `deadline:${item.id}`, title: `${item.company}: application decision`, whyNow: `Deadline ${item.deadline}`, context: assessOpportunity(state, item.id).reasons[0], action: item.decision?.nextAction ?? "Make a deliberate pursuit decision", ifWait: "The opportunity may close before you decide.", urgency: 95 }));
  state.people.filter((item) => item.nextTouch && item.nextTouch <= today).forEach((item) => items.push({ id: `person:${item.id}`, title: `Follow through with ${item.name}`, whyNow: `Agreed next touch ${item.nextTouch}`, context: item.whyNow, action: item.objective, ifWait: "A useful relationship or agreed follow-up may lose momentum.", urgency: 75 }));
  state.actions.filter((item) => ["failed", "uncertain"].includes(item.state)).forEach((item) => items.push({ id: `action:${item.id}`, title: item.subject, whyNow: `Action ${item.state}`, context: item.receipt ?? "Execution needs reconciliation", action: "Check the provider before retrying", ifWait: "The intended follow-through remains unresolved.", urgency: 105 }));
  if (items.length < 3) state.hypotheses.filter((item) => ["continue", "refine"].includes(item.status)).forEach((item) => items.push({ id: `hypothesis:${item.id}`, title: item.nextExperiment, whyNow: "The next experiment can reduce uncertainty", context: item.proposition, action: item.nextExperiment, ifWait: item.reviewTrigger, urgency: 40 }));
  const meetingActions = new Set(items.filter((item) => item.id.startsWith("meeting:")).map((item) => item.id.slice(8)));
  return items.filter((item) => ![...meetingActions].some((meetingId) => item.id === "commitment:" + meetingId + ":prepare")).sort((a, b) => b.urgency - a.urgency || a.id.localeCompare(b.id)).slice(0, 3);
}

export function weeklyReview(state: PilotState, since: string) {
  return { questions: ["What did I learn about the work and environment I want?", "Which hypotheses strengthened or weakened, and which conversations changed my thinking?", "Which opportunities were strongest, and why did I decline others?", "Where did relationships deepen; who needs follow-through?", "What did application and interview feedback reveal about evidence or skills?", "What should I start, stop, or change next week?"], ...prepareCoaching(state, since), declined: state.opportunities.filter((item) => item.status === "decline"), applicationOutcomes: state.applications.filter((item) => item.outcome && item.outcome.at >= since), interviewLearning: state.interviews.filter((item) => item.recordedAt >= since), priorReviews: state.weeklyReviews.slice(-3) };
}

/** Preparation uses supplied round/context and real prior feedback; it invents no interviewer facts. */
export function prepareInterview(state: PilotState, opportunityId: string, context: { round?: string; interviewerContext?: string } = {}) {
  const opportunity = requireRecord(state.opportunities, opportunityId, "Opportunity");
  const assessment = assessOpportunity(state, opportunityId);
  const prior = state.interviews.filter((item) => item.opportunityId === opportunityId);
  const missingExamples = [...new Set(prior.flatMap((item) => item.missingExamples))];
  const round = context.round?.trim() || "Round not supplied";
  const interviewerContext = context.interviewerContext?.trim() || "Interviewer context not supplied";
  const stories = recallStories(state, [opportunity.role, opportunity.actualWork, opportunity.description, interviewerContext, ...missingExamples, ...prior.map((item) => item.nextPreparation)].join(" "), 5);
  return { opportunity, round, interviewerContext, assessment, stories, missingExamples,
    employerFeedback: prior.filter((item) => item.employerFeedback && item.employerFeedbackSource).map((item) => ({ feedback: item.employerFeedback, source: item.employerFeedbackSource!, round: item.round })),
    selfAssessment: prior.map((item) => ({ round: item.round, assessment: item.selfAssessment, nextPreparation: item.nextPreparation })),
    questionsToPractice: [...new Set([...missingExamples.map((item) => "Show a specific example of: " + item), ...opportunity.requirements.slice(0, 3).map((item) => "What evidence demonstrates: " + item.label), "Describe your own contribution to a consequential delivery decision. What did you own, and what did others own?", "Tell me about a disagreement. What changed because of your actions?", "What did you learn from a result that fell short?"])].slice(0, 7),
    questionsForInterviewer: assessment.questions.slice(0, 5),
    practiceInstructions: "Practice one question at a time in ChatGPT. Give an unscripted answer; compare it with the approved story evidence. Separate clarity, specificity, personal contribution, and missing proof. Never invent metrics or employer feedback.",
    nextPreparation: prior.at(-1)?.nextPreparation ?? "Choose two relevant stories, establish your contribution, and resolve the most consequential unknown about the work." };
}

/** Compare the same criteria and term labels without inventing numerical equivalence or a winning offer. */
export function compareOffers(state: PilotState) {
  const offers = state.offers.map((offer) => ({ offer, opportunity: requireRecord(state.opportunities, offer.opportunityId, "Opportunity"), assessment: assessOpportunity(state, offer.opportunityId) }));
  const termLabels = [...new Set(state.offers.flatMap((offer) => offer.terms.map((term) => term.label.trim().toLowerCase())))];
  return { offers, terms: termLabels.map((label) => ({ label, values: offers.map(({ offer }) => ({ offerId: offer.id, terms: offer.terms.filter((term) => term.label.trim().toLowerCase() === label) })) })),
    criteria: state.criteria.map((criterion) => ({ criterion, values: offers.map(({ offer, assessment }) => {
      const row = assessment.vector.find((item) => item.dimension === criterion.dimension)!;
      return { offerId: offer.id, supporting: row.supporting.filter((item) => item.criterionId === criterion.id), conflicting: row.conflicting.filter((item) => item.criterionId === criterion.id), unresolved: row.unknowns.includes(criterion.label + ": " + criterion.desired) };
    }) })),
    decisionQuestions: ["Which tradeoffs are acceptable under your confirmed criteria?", "Which reported promises need written confirmation?", "What would make you regret accepting, and what can you resolve before the deadline?"],
    negotiationPreparation: offers.map(({ offer, opportunity, assessment }) => ({ offerId: offer.id, company: opportunity.company, deadline: offer.deadline ?? "Not supplied", priorities: offer.negotiationPriorities, unresolved: [...new Set([...offer.unresolvedQuestions, ...assessment.blockers])], promisesToClarify: offer.recruitingPromises })) };
}

export function prepareProfessionalChapter(state: PilotState) {
  const accepted = state.offers.find((item) => item.accepted);
  if (!accepted) return { status: "awaiting_deliberate_acceptance", nextAction: "Compare the offer against your criteria and record your actual acceptance before planning the new role." };
  const opportunity = requireRecord(state.opportunities, accepted.opportunityId, "Opportunity");
  return { status: state.chapter?.phase, opportunity, acceptance: accepted.accepted, recruitingPromises: accepted.recruitingPromises,
    managerAlignment: ["What would good evidence of contribution look like at 30, 60, and 90 days?", "Which decisions do I own, and when should I seek alignment?", ...accepted.recruitingPromises.map((promise) => "Confirm how this recruiting commitment will work: " + promise)],
    stakeholderLearning: "Identify your manager, key partners, customers, and people who understand prior attempts. Listen before prescribing changes; link agreed conversations and commitments to this role.",
    earlyContribution: "Use the role's actual work and your approved examples to propose a small contribution with your manager. Treat it as a hypothesis until success criteria are agreed.",
    gaps: assessOpportunity(state, opportunity.id).gaps, checkpoints: state.checkpoints.map((checkpoint) => ({ ...checkpoint, commitment: state.commitments.find((item) => item.id === checkpoint.id) })),
    carryForward: state.chapter?.carryForward ?? [], nextFocus: state.chapter?.nextFocus ?? "Align with your manager and learn the operating context." };
}
