import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { commandEnvelopeSchema, emptyPilotState, type PilotState } from "@/lib/sotf/contracts";
import { applyCommand, resumeTransition, RevisionConflict } from "@/lib/sotf/engine";
import { assessOpportunity, compareOffers, prepareInterview, prepareProfessionalChapter, dailyBrief, hypothesisLearning, prepareCoaching, prepareMeeting, recallStories, weeklyReview } from "@/lib/sotf/intelligence";
import { OperationNotApplied, replayEvents, SotfStore, type WorkflowEvent } from "@/lib/sotf/persistence";

// Fictional fellow and employer. These fixtures contain no personal or ministry data.
const workspaceId = "70000000-0000-4000-8000-000000000001";
const now = "2026-09-06T12:00:00.000Z";
const hypothesis = { id: "direction", proposition: "Program leadership may fit", whyPromising: "I have led cross-team delivery", assumptions: ["The work includes real decision ownership"], gaps: [], nextExperiment: "Ask a practitioner about decision authority", reviewTrigger: "After two practitioner conversations", status: "continue", confidenceExplanation: "Provisional until actual work is understood" };
const criterion = { id: "authority", label: "Decision authority", dimension: "environment", desired: "Own decisions as well as coordinate", nonNegotiable: false, importance: 4, confirmed: true };
const role = { id: "role", company: "Fictional Northstar", role: "Technical Program Lead", description: "Lead stakeholder alignment and program delivery", url: "https://example.org/fictional-role", hypothesisIds: ["direction"], requirements: [{ id: "experience", label: "Cross-team delivery experience", category: "experience", mandatory: true }] };
const contact = { id: "person", name: "Fictional Morgan", company: "Fictional Northstar", role: "Program Lead", source: "Synthetic fellow-provided contact", overlap: "We attended the same fictional workshop", whyNow: "Can explain whether this role owns decisions", objective: "Understand actual decision authority", hypothesisIds: ["direction"], opportunityId: "role", nextTouch: "2026-09-08" };
const meeting = { id: "conversation", title: "Learn about program ownership", personId: "person", opportunityId: "role", hypothesisIds: ["direction"], kind: "networking", startsAt: "2026-09-06T09:00:00-05:00", endsAt: "2026-09-06T09:30:00-05:00", status: "accepted", provider: "google_calendar", sourceEventId: "synthetic-event", objective: "Understand actual decision authority" };
const promise = { id: "promise", title: "Share an approved work sample", owner: "Fellow", due: "2026-09-07", definitionOfDone: "Morgan has the reviewed public sample", reviewTrigger: "If the sample is unavailable by Monday", personId: "person", opportunityId: "role" };

function envelope(state: PilotState, command: unknown, requestId = randomUUID()) {
  return commandEnvelopeSchema.parse({ requestId, expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command });
}
function harness() {
  let state = emptyPilotState(); const events: WorkflowEvent[] = [];
  const run = (command: unknown, at = now) => {
    const operation = envelope(state, command);
    state = applyCommand(state, operation, at);
    events.push({ revision: state.revision, envelope: operation, recorded_at: at });
    return state;
  };
  const accept = (id: string, patch: Record<string, unknown> = {}) => {
    run({ type: "record_evidence", evidence: { id, statement: `Synthetic observed evidence: ${id}`, source: { kind: "practitioner", reference: "Fictional practitioner conversation", scope: "This team only", observedAt: "2026-09-05" }, direction: "supporting", reliability: "high", opportunityId: "role", hypothesisIds: ["direction"], ...patch } });
    run({ type: "review_evidence", evidenceId: id, decision: "accept", rationale: "Confirmed as an accurate operational observation" });
  };
  run({ type: "start_transition", timing: "Exploring over the next six months", question: "Which work gives me meaningful ownership?", weeklyHours: 8, criteria: [criterion], hypotheses: [hypothesis] });
  run({ type: "record_opportunity", opportunity: role });
  return { get state() { return state; }, events, run, accept };
}

describe("SOTF opportunity learning and continuity", () => {
  it("keeps unknowns unscored and eligibility separate from fit", () => {
    const h = harness();
    expect(assessOpportunity(h.state, "role")).toMatchObject({ eligibility: "unresolved", recommendation: "MAYBE" });
    expect(assessOpportunity(h.state, "role").vector.every((item) => item.score === null)).toBe(true);
    h.accept("qualification", { dimension: "experience", score: 9 });
    h.accept("work", { dimension: "actual_work", score: 8 });
    h.run({ type: "resolve_requirement", opportunityId: "role", requirementId: "experience", status: "not_met", evidenceIds: ["qualification"] });
    expect(assessOpportunity(h.state, "role")).toMatchObject({ eligibility: "blocked", recommendation: "NO" });
    expect(assessOpportunity(h.state, "role").vector.find((item) => item.dimension === "experience")?.score).toBe(9);
  });

  it("changes a recommendation when a reviewed criterion becomes non-negotiable", () => {
    const h = harness(); h.accept("qualification", { dimension: "experience", score: 9 }); h.accept("work", { dimension: "actual_work", score: 8 });
    h.run({ type: "resolve_requirement", opportunityId: "role", requirementId: "experience", status: "met", evidenceIds: ["qualification"] });
    h.accept("authority-conflict", { dimension: "environment", criterionId: "authority", direction: "conflicting", score: 4, statement: "The practitioner described coordination without final decision authority" });
    expect(assessOpportunity(h.state, "role").recommendation).toBe("MAYBE");
    h.run({ type: "confirm_criteria", criteria: [{ ...criterion, nonNegotiable: true }], reason: "I confirmed that ownership is necessary for my next role" });
    const assessment = assessOpportunity(h.state, "role");
    expect(assessment.recommendation).toBe("NO");
    expect(assessment.eligibility).toBe("eligible");
    expect(assessment.contextImpact.join(" ")).toContain("coordination without final decision authority");
    expect(assessment.blockers.join(" ")).toContain("Non-negotiable");
    h.run({ type: "confirm_criteria", criteria: [{ ...criterion, desired: "Coordination is acceptable while I learn this industry" }], reason: "A deliberate revised transition strategy" });
    expect(assessOpportunity(h.state, "role").vector.find((item) => item.dimension === "environment")?.score).toBeNull();
  });

  it("retains declined opportunities, reviewed contradictory learning, and deliberate reconsideration", () => {
    const h = harness();
    h.run({ type: "record_evidence", evidence: { id: "pending", statement: "The role may lack decision ownership", source: { kind: "community", reference: "Synthetic discussion", observedAt: "2026-09-05", scope: "One unverified account" }, direction: "conflicting", reliability: "low", opportunityId: "role", hypothesisIds: ["direction"] } });
    expect(hypothesisLearning(h.state, "direction").conflicting).toHaveLength(0);
    h.run({ type: "review_evidence", evidenceId: "pending", decision: "accept", rationale: "Retain as a weak signal to test, not company-wide fact" });
    expect(hypothesisLearning(h.state, "direction").conflicting).toHaveLength(1);
    expect(h.state.criteria[0].desired).toBe(criterion.desired);
    h.run({ type: "decide_opportunity", opportunityId: "role", decision: "decline", rationale: "Insufficient ownership for this search", nextAction: "Pause pursuit", revisitWhen: "A practitioner establishes direct decision authority" });
    expect(weeklyReview(h.state, "2026-09-01").declined).toHaveLength(1);
    expect(resumeTransition(h.state).latestDecision?.opportunity.decision?.revisitWhen).toContain("practitioner");
    h.run({ type: "decide_opportunity", opportunityId: "role", decision: "investigate", rationale: "New information may change the answer", nextAction: "Ask the hiring manager", revisitWhen: "After the manager replies", due: "2026-09-08" });
    expect(h.state.commitments.find((item) => item.id === "role:decision-next-step")?.status).toBe("open");
  });

  it("refuses to establish a mandatory qualification from anonymous or inferred evidence", () => {
    const h = harness(); h.accept("anonymous", { source: { kind: "community", reference: "Unverified thread", scope: "Unknown", observedAt: "2026-09-05" } });
    expect(() => h.run({ type: "resolve_requirement", opportunityId: "role", requirementId: "experience", status: "met", evidenceIds: ["anonymous"] })).toThrow("direct or authoritative");
  });
});

describe("SOTF relationships, preparation, follow-through, and recovery", () => {
  it("closes the relationship loop and resumes it from the saved event log", () => {
    const h = harness(); h.run({ type: "save_person", person: contact }); h.run({ type: "prepare_outreach", personId: "person" });
    expect(h.state.actions[0]).toMatchObject({ state: "draft", recipient: "Fictional Morgan" });
    expect(h.state.actions[0].body).toContain(contact.overlap);
    h.run({ type: "record_meeting", meeting });
    const prep = prepareMeeting(h.state, "conversation");
    expect(prep.questions.length).toBeGreaterThanOrEqual(5); expect(prep.questions.length).toBeLessThanOrEqual(8);
    expect(prep.meeting.startsAt).toBe("2026-09-06T14:00:00.000Z");
    h.run({ type: "debrief_meeting", meetingId: "conversation", said: "The team owns delivery decisions", inferred: "This may fit my preference for ownership", unresolved: ["Manager escalation style"], evidence: [{ id: "debrief-evidence", statement: "The practitioner described owning delivery decisions", source: { kind: "practitioner", reference: "Fictional Morgan, meeting notes", observedAt: "2026-09-06", scope: "This team" }, direction: "supporting", dimension: "environment", criterionId: "authority", score: 8, reliability: "high" }], commitments: [promise], introductions: ["Morgan offered a manager introduction; not yet completed"], nextTouch: "2026-09-09" }, "2026-09-06T15:00:00.000Z");
    expect(h.state.evidence[0]).toMatchObject({ review: "pending", meetingId: "conversation", personId: "person", opportunityId: "role", hypothesisIds: ["direction"] });
    expect(h.state.actions.find((item) => item.meetingId === "conversation")?.state).toBe("draft");
    expect(h.state.people[0].nextTouch).toBe("2026-09-09");
    h.run({ type: "review_evidence", evidenceId: "debrief-evidence", decision: "accept", rationale: "Confirmed against my notes" }, "2026-09-06T15:01:00.000Z");
    const recovered = replayEvents({ workspace_id: workspaceId, revision: h.state.revision, events: h.events }).state;
    expect(recovered).toEqual(h.state);
    expect(hypothesisLearning(recovered, "direction").supporting).toHaveLength(1);
    expect(resumeTransition(recovered).nextActions.some((item) => item.id === "promise")).toBe(true);
  });

  it("reconciles provider IDs and cancellations without duplicating meetings", () => {
    const h = harness(); h.run({ type: "save_person", person: contact }); h.run({ type: "record_meeting", meeting });
    h.run({ type: "record_meeting", meeting: { ...meeting, id: "new-import-id", startsAt: "2026-09-08T14:00:00Z", endsAt: "2026-09-08T14:30:00Z" } });
    expect(h.state.meetings).toHaveLength(1); expect(h.state.meetings[0].id).toBe("conversation");
    expect(h.state.commitments.find((item) => item.id === "conversation:prepare")?.due).toBe("2026-09-08");
    h.run({ type: "record_meeting", meeting: { ...meeting, status: "cancelled" } });
    expect(h.state.commitments.find((item) => item.id === "conversation:prepare")?.status).toBe("cancelled");
    expect(() => h.run({ type: "record_meeting", meeting: { ...meeting, sourceEventId: "another-event" } })).toThrow("provider identity");
  });

  it("requires exact current approval and reconciles uncertain results before retrying", () => {
    const h = harness(); h.run({ type: "save_person", person: contact }); h.run({ type: "prepare_outreach", personId: "person" });
    const id = h.state.actions[0].id;
    h.run({ type: "approve_action", actionId: id, exactRevision: 1 });
    h.run({ type: "revise_action", actionId: id, recipient: contact.name, subject: "Revised question", body: "A more precise request about decision authority" });
    expect(() => h.run({ type: "approve_action", actionId: id, exactRevision: 1 })).toThrow("exact current draft");
    h.run({ type: "approve_action", actionId: id, exactRevision: 2 });
    h.run({ type: "record_action_result", actionId: id, outcome: "uncertain", receipt: "Manual send outcome not verified" });
    expect(() => h.run({ type: "revise_action", actionId: id, recipient: contact.name, subject: "Do not resend", body: "Still uncertain" })).toThrow("Reconcile");
    h.run({ type: "retry_action", actionId: id, confirmedNotExecuted: true });
    expect(h.state.actions).toHaveLength(1); expect(h.state.actions[0].state).toBe("draft");
    h.run({ type: "approve_action", actionId: id, exactRevision: 3 });
    h.run({ type: "record_action_result", actionId: id, outcome: "manually_completed", receipt: "Fellow verified the message in Sent" });
    expect(() => h.run({ type: "retry_action", actionId: id, confirmedNotExecuted: true })).toThrow("must not be retried");
  });

  it("prepares coaching from developments and commitments without including unrelated person-less meeting notes", () => {
    const h = harness();
    h.run({ type: "record_meeting", meeting: { ...meeting, id: "coach", personId: undefined, opportunityId: undefined, sourceEventId: "coach-event", kind: "coaching" } });
    h.run({ type: "debrief_meeting", meetingId: "coach", said: "Test decision ownership in the next conversation", inferred: "", unresolved: [], evidence: [], commitments: [{ ...promise, personId: undefined }], introductions: [] }, "2026-09-06T15:00:00Z");
    h.run({ type: "resolve_commitment", commitmentId: "promise", status: "blocked", evidence: "Need a public version of the work sample" }, "2026-09-07T10:00:00Z");
    const packet = prepareCoaching(h.state);
    expect(packet.stuck.map((item) => item.id)).toContain("promise"); expect(packet.agenda.join(" ")).toContain("Unblock");
    h.run({ type: "record_meeting", meeting: { ...meeting, id: "unrelated", personId: undefined, sourceEventId: "unrelated", kind: "mentor" } });
    expect(prepareMeeting(h.state, "unrelated").priorInteractions).toEqual([]);
    expect(prepareMeeting(h.state, "unrelated").commitments.some((item) => item.id === "promise")).toBe(false);
    expect(dailyBrief(h.state, "2026-09-07T12:00:00Z").length).toBeLessThanOrEqual(3);
  });
});

describe("SOTF reusable evidence, applications, and next chapter", () => {
  it("finds an older relevant accomplishment before limiting retrieval results", () => {
    const h = harness(); h.accept("proof");
    const story = { id: "old-story", title: "Stakeholder alignment under ambiguity", situation: "Conflicting partner priorities", contribution: "I facilitated the decision", scope: "Three teams", actions: "Mapped disagreement and established shared criteria", outcome: "Partners agreed an executable plan", skills: ["stakeholder", "ambiguity"], evidenceIds: ["proof"], approvedLanguage: "Aligned three teams around shared decision criteria", confirmed: true };
    h.run({ type: "save_story", story });
    for (let i = 0; i < 70; i++) h.run({ type: "save_story", story: { ...story, id: `new-${i}`, title: "Inventory process", situation: "A stockroom", contribution: "Counted items", scope: "One location", actions: "Counted each shelf", outcome: "Updated inventory", skills: ["inventory"] } });
    expect(recallStories(h.state, "stakeholder ambiguity", 3)[0].story.id).toBe("old-story");
  });

  it("preserves submitted material, interview learning, and deliberate offer-to-work continuity", () => {
    const h = harness(); h.accept("proof");
    h.run({ type: "save_story", story: { id: "story", title: "Program delivery", situation: "A delayed initiative", contribution: "I clarified dependencies", scope: "One program", actions: "Aligned owners on a schedule", outcome: "Delivery resumed", skills: ["delivery"], evidenceIds: ["proof"], approvedLanguage: "Clarified dependencies to restore delivery", confirmed: true } });
    const material = { id: "material-1", opportunityId: "role", kind: "resume", title: "Role-specific resume", content: "Original approved wording", storyIds: ["story"], confirmedTruthful: true };
    h.run({ type: "save_material", material }); expect(h.state.applications).toHaveLength(0);
    h.run({ type: "record_submission", opportunityId: "role", materialIds: ["material-1"], submittedAt: "2026-09-05T12:00:00Z", receipt: "Fellow confirmed actual submission through the employer website", confirmedSubmitted: true });
    h.run({ type: "save_material", material: { ...material, id: "material-2", content: "New wording for future use" } });
    expect(h.state.applications[0].materials[0].content).toBe("Original approved wording");
    h.run({ type: "record_interview", interview: { id: "round-1", opportunityId: "role", round: "Hiring manager", questionsAsked: ["How do you resolve ambiguity?"], storyIds: ["story"], missingExamples: ["A clear disagreement example"], selfAssessment: "My answer needed a more specific decision", nextPreparation: "Practice the disagreement example with a coach", evidence: [] } });
    expect(h.state.commitments.some((item) => item.id === "round-1:prepare-next")).toBe(true);
    h.run({ type: "record_offer", offer: { id: "offer", opportunityId: "role", terms: [{ label: "Role", value: "Program Lead", certainty: "written", source: "Synthetic offer letter" }], tradeoffs: "Strong learning; manager style needs clarification", unresolvedQuestions: ["Escalation expectations"], negotiationPriorities: ["Clarify decision ownership"], recruitingPromises: ["Weekly manager alignment"] } });
    h.run({ type: "accept_offer", offerId: "offer", rationale: "Fellow confirmed acceptance after clarifying authority", confirmedAccepted: true, startDate: "2026-10-01", checkpoints: [30, 60, 90].map((day) => ({ id: `day-${day}`, day, title: `Review learning at ${day} days`, successEvidence: "Manager and fellow agree the next contribution" })) });
    expect(h.state.chapter?.phase).toBe("transitioning"); expect(h.state.checkpoints).toHaveLength(3);
    h.run({ type: "close_chapter", reflection: "Ownership and team learning shaped the decision", carryForward: ["story", "direction"], nextFocus: "Build trust and test an early contribution" });
    expect(h.state.chapter?.phase).toBe("professional_work"); expect(h.state.applications[0].receipt).toContain("actual submission");
  });
});

describe("SOTF persistence integrity", () => {
  it("rejects stale changes, cross-record links, protected envelopes, and incomplete replay", () => {
    const h = harness(); const operation = envelope(h.state, { type: "prepare_outreach", personId: "missing" });
    expect(() => applyCommand(h.state, operation)).toThrow("Person was not found");
    expect(() => applyCommand(h.state, { ...operation, expectedRevision: 0 })).toThrow(RevisionConflict);
    expect(() => commandEnvelopeSchema.parse({ ...operation, dataClass: "sensitive" })).toThrow();
    expect(() => commandEnvelopeSchema.parse({ ...operation, protectedContext: "not allowed" })).toThrow();
    expect(() => replayEvents({ workspace_id: workspaceId, revision: h.state.revision, events: h.events.slice(1) })).toThrow("incomplete or out of order");
    expect(() => replayEvents({ workspace_id: workspaceId, revision: h.state.revision + 1, events: h.events })).toThrow("did not load completely");
  });

  it("recovers an uncertain save with the same operation ID and does not append twice", async () => {
    const h = harness(); const events = [...h.events]; let appends = 0;
    const store = new SotfStore({ read: async () => ({ workspace_id: workspaceId, revision: events.length, events }), append: async (operation) => {
      appends++; events.push({ envelope: operation, revision: events.length + 1, recorded_at: now }); throw new Error("Transport interrupted after persistence");
    } }, () => now);
    const operation = envelope(h.state, { type: "save_person", person: contact });
    await expect(store.execute(operation)).rejects.toThrow("Transport interrupted");
    const result = await store.execute(operation);
    expect(result.replayed).toBe(true); expect(result.state.people).toHaveLength(1); expect(appends).toBe(1);
    await expect(store.execute({ ...operation, command: { type: "save_person", person: { ...contact, name: "Different person" } } })).rejects.toThrow("different operation");
  });
});


describe("SOTF review surfaces preserve consequential workflow behavior", () => {
  it("reopens preparation after a cancelled meeting is restored and presents one daily action", () => {
    const h = harness(); h.run({ type: "save_person", person: contact });
    const upcoming = { ...meeting, startsAt: "2026-09-07T14:00:00Z", endsAt: "2026-09-07T14:30:00Z" };
    h.run({ type: "record_meeting", meeting: upcoming });
    h.run({ type: "record_meeting", meeting: { ...upcoming, status: "cancelled" } });
    h.run({ type: "record_meeting", meeting: upcoming });
    expect(h.state.meetings).toHaveLength(1);
    expect(h.state.commitments.find((item) => item.id === "conversation:prepare")?.status).toBe("open");
    const brief = dailyBrief(h.state, now);
    expect(brief.filter((item) => item.id === "meeting:conversation")).toHaveLength(1);
    expect(brief.some((item) => item.id === "commitment:conversation:prepare")).toBe(false);
  });

  it("distinguishes a rejected change from an unreadable result after persistence", async () => {
    const h = harness(); let appends = 0;
    const notApplied = new SotfStore({ read: async () => ({ workspace_id: workspaceId, revision: h.state.revision, events: h.events }), append: async () => { appends++; } }, () => now);
    await expect(notApplied.execute(envelope(h.state, { type: "prepare_outreach", personId: "absent" }))).rejects.toBeInstanceOf(OperationNotApplied);
    expect(appends).toBe(0);
    const events = [...h.events]; let reads = 0;
    const unreadable = new SotfStore({ read: async () => {
      reads++;
      if (reads === 2) throw new OperationNotApplied("Access unavailable on verification read");
      return { workspace_id: workspaceId, revision: events.length, events };
    }, append: async (operation) => { appends++; events.push({ revision: events.length + 1, envelope: operation, recorded_at: now }); } }, () => now);
    const operation = envelope(h.state, { type: "save_person", person: contact });
    await expect(unreadable.execute(operation)).rejects.toThrow("may have been saved");
    expect((await unreadable.execute(operation)).replayed).toBe(true);
    expect(appends).toBe(1);
  });

  it("uses earlier interview learning and preserves offer uncertainty and recruiting promises", () => {
    const h = harness();
    h.run({ type: "record_interview", interview: { id: "earlier", opportunityId: "role", round: "Practitioner", questionsAsked: ["How did you handle disagreement?"], missingExamples: ["Resolving stakeholder disagreement"], selfAssessment: "I used a vague example", employerFeedback: "Clarify your personal contribution", employerFeedbackSource: "Fictional recruiter email", nextPreparation: "Prepare the decision-ownership example" } });
    const prep = prepareInterview(h.state, "role", { round: "Hiring manager", interviewerContext: "No further verified context" });
    expect(prep.questionsToPractice[0]).toContain("stakeholder disagreement");
    expect(prep.employerFeedback[0].source).toBe("Fictional recruiter email");
    expect(prep.nextPreparation).toContain("decision-ownership");
    h.run({ type: "record_opportunity", opportunity: { ...role, id: "second-role", company: "Fictional second employer" } });
    const terms = { terms: [{ label: "Travel", value: "Occasional", certainty: "reported", source: "Fictional recruiter" }], tradeoffs: "Travel frequency needs clarification", unresolvedQuestions: ["What does occasional mean?"], negotiationPriorities: ["Written travel limit"], recruitingPromises: ["Weekly manager alignment"] };
    h.run({ type: "record_offer", offer: { ...terms, id: "first-offer", opportunityId: "role" } });
    h.run({ type: "record_offer", offer: { ...terms, id: "second-offer", opportunityId: "second-role", terms: [{ label: "Learning budget", value: "Not supplied", certainty: "unknown", source: "Not supplied" }] } });
    const comparison = compareOffers(h.state);
    expect(comparison.terms.find((item) => item.label === "travel")?.values[1].terms).toEqual([]);
    expect(comparison.offers[0].offer.terms[0].certainty).toBe("reported");
    expect(comparison.criteria[0].values[0].unresolved).toBe(true);
    h.run({ type: "accept_offer", offerId: "first-offer", rationale: "Fictional fellow confirmed acceptance", confirmedAccepted: true, startDate: "2026-10-01", checkpoints: [30, 60, 90].map((day) => ({ id: "checkpoint-" + day, day, title: "Day " + day, successEvidence: "Manager and fellow agree the next contribution" })) });
    const chapter = prepareProfessionalChapter(h.state);
    expect(chapter.status).toBe("transitioning");
    expect("recruitingPromises" in chapter && chapter.recruitingPromises).toContain("Weekly manager alignment");
  });
});

// Public employer evidence inspected 2026-09-06. The fellow and all decisions below are fictional.
// This is a scoped eligibility/context test, not a claim that every qualification was reviewed.
it("carries a real public opportunity through evidence, context-sensitive assessment, decision, and next action", () => {
  const h = harness();
  const url = "https://openai.com/careers/technical-program-manager-developer-experience-san-francisco/";
  h.run({ type: "record_opportunity", opportunity: { id: "public-role", company: "OpenAI", role: "Technical Program Manager, Developer Experience", url, description: "Lead improvements to development and release workflows. The posting specifies three office days each week in San Francisco.", actualWork: "Coordinate engineering programs to improve delivery speed and release reliability.", hypothesisIds: ["direction"], requirements: [{ id: "hybrid", label: "San Francisco hybrid attendance", category: "location", mandatory: true }] } });
  const remote = { id: "remote", label: "Working arrangement", dimension: "environment", desired: "Fully remote work", nonNegotiable: false, importance: 5, confirmed: true };
  h.run({ type: "confirm_criteria", criteria: [remote], reason: "Fictional fellow is weighing working arrangements" });
  h.run({ type: "record_evidence", evidence: { id: "public-location", statement: "The employer describes an office-based hybrid arrangement with three on-site days per week.", source: { kind: "job_post", reference: "Employer role page, work-location paragraph", url, observedAt: "2026-09-06", scope: "This advertised role; not a company-wide culture claim" }, opportunityId: "public-role", hypothesisIds: ["direction"], criterionId: "remote", dimension: "environment", direction: "conflicting", reliability: "high", score: 2, explanation: "The published arrangement conflicts with the fictional fellow's stated remote-work preference." } });
  expect(assessOpportunity(h.state, "public-role").vector.find((item) => item.dimension === "environment")?.score).toBeNull();
  h.run({ type: "review_evidence", evidenceId: "public-location", decision: "accept", rationale: "Accept the published arrangement as scoped employer evidence" });
  expect(assessOpportunity(h.state, "public-role").recommendation).toBe("MAYBE");
  h.run({ type: "confirm_criteria", criteria: [{ ...remote, nonNegotiable: true }], reason: "Fictional fellow deliberately confirms remote work as non-negotiable" });
  const assessment = assessOpportunity(h.state, "public-role");
  expect(assessment.recommendation).toBe("NO");
  expect(assessment.eligibility).toBe("unresolved");
  expect(assessment.vector.find((item) => item.dimension === "culture")?.score).toBeNull();
  expect(assessment.contextImpact.join(" ")).toContain("Fully remote work");
  h.run({ type: "decide_opportunity", opportunityId: "public-role", decision: "decline", rationale: "The confirmed working-arrangement constraint makes further pursuit a poor use of time", nextAction: "Find a comparable role with a compatible working arrangement", revisitWhen: "The employer explicitly establishes a compatible arrangement" });
  expect(resumeTransition(h.state).latestDecision?.opportunity.decision?.nextAction).toContain("comparable role");
  expect(hypothesisLearning(h.state, "direction").conflicting.some((item) => item.id === "public-location")).toBe(true);
});
