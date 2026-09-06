import { commandEnvelopeSchema, emptyPilotState, type PilotState } from "./contracts";
import { applyCommand } from "./engine";

/** Public, entirely fictional demonstration. Never reads or saves an account's data. */
export function createPreviewState(): PilotState {
  let state = emptyPilotState(); let sequence = 0;
  const now = "2026-09-06T12:00:00.000Z";
  const run = (command: unknown) => {
    sequence += 1;
    state = applyCommand(state, commandEnvelopeSchema.parse({ requestId: `90000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`, expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command }), now);
  };
  run({ type: "start_transition", timing: "Six months to explore", question: "Where can I own meaningful decisions while learning a new industry?", weeklyHours: 8,
    criteria: [{ id: "ownership", label: "Decision ownership", dimension: "environment", desired: "Own decisions as well as coordinate delivery", nonNegotiable: false, importance: 5, confirmed: true }, { id: "work", label: "Actual contribution", dimension: "actual_work", desired: "Solve cross-team delivery problems", importance: 4, confirmed: true }],
    hypotheses: [{ id: "program", proposition: "Program leadership in a growing organization", whyPromising: "A possibility to test against cross-team delivery experience", assumptions: ["Program leaders own consequential decisions"], gaps: ["Understand civilian product-development cadence"], nextExperiment: "Ask a practitioner which decisions this role owns", reviewTrigger: "After the practitioner conversation", confidenceExplanation: "Promising, but the operating environment is still uncertain" }, { id: "operations", proposition: "Operations improvement in an established business", whyPromising: "A different route to solve practical delivery problems", assumptions: ["Improvement work includes authority to change the process"], nextExperiment: "Compare two operations-improvement roles", reviewTrigger: "After reviewing two real role descriptions", confidenceExplanation: "Early hypothesis; needs evidence" }] });
  run({ type: "record_opportunity", opportunity: { id: "northstar", company: "Northstar — fictional employer", role: "Technical Program Lead", description: "Coordinate delivery across engineering and customer teams. Escalate major decisions to functional leaders.", actualWork: "Cross-team coordination and delivery planning; final authority is unresolved.", hypothesisIds: ["program"], requirements: [{ id: "delivery", label: "Demonstrated cross-team delivery", category: "experience", mandatory: true }] } });
  for (const evidence of [
    { id: "proof", statement: "The fictional fellow has led a cross-team delivery project with documented outcomes.", dimension: "experience", score: 8, direction: "supporting", source: { kind: "fellow_report", reference: "Fictional reviewed work example", scope: "This example only" } },
    { id: "work-proof", statement: "The role's core work is resolving cross-team delivery dependencies.", dimension: "actual_work", criterionId: "work", score: 8, direction: "supporting", source: { kind: "job_post", reference: "Fictional role description", scope: "This role" } },
    { id: "ownership-risk", statement: "A practitioner describes coordination responsibility while functional leaders keep final decision authority.", dimension: "environment", criterionId: "ownership", score: 4, direction: "conflicting", source: { kind: "practitioner", reference: "Fictional practitioner account", scope: "This team only" } }
  ]) {
    run({ type: "record_evidence", evidence: { ...evidence, reliability: "high", opportunityId: "northstar", hypothesisIds: ["program"], source: { ...evidence.source, observedAt: "2026-09-05" } } });
    run({ type: "review_evidence", evidenceId: evidence.id, decision: "accept", rationale: "Accepted as accurate within this fictional demonstration" });
  }
  run({ type: "resolve_requirement", opportunityId: "northstar", requirementId: "delivery", status: "met", evidenceIds: ["proof"] });
  run({ type: "decide_opportunity", opportunityId: "northstar", decision: "investigate", rationale: "Strong delivery fit; decision authority still needs testing", nextAction: "Ask Morgan which decisions the role owns", revisitWhen: "A practitioner clarifies actual decision authority" });
  run({ type: "save_person", person: { id: "morgan", name: "Morgan — fictional contact", company: "Northstar", role: "Program practitioner", source: "Fictional fellow-provided introduction", overlap: "We met at a fictional professional workshop.", whyNow: "Can explain how program decisions are made in this team", objective: "Distinguish ownership from coordination", introductionPath: "An existing workshop conversation", opportunityId: "northstar", hypothesisIds: ["program"], nextTouch: "2026-09-08" } });
  run({ type: "prepare_outreach", personId: "morgan" });
  run({ type: "record_meeting", meeting: { id: "conversation", title: "Understand the work with Morgan", personId: "morgan", opportunityId: "northstar", hypothesisIds: ["program"], kind: "networking", startsAt: "2026-09-08T15:00:00Z", endsAt: "2026-09-08T15:30:00Z", status: "accepted", objective: "Learn which decisions this role actually owns" } });
  run({ type: "save_story", story: { id: "delivery-story", title: "Unblocking cross-team delivery", situation: "A fictional project had conflicting priorities across three teams.", contribution: "Facilitated the dependency review and negotiated a shared sequence.", scope: "Three teams; decision approval remained with the accountable leads.", actions: "Mapped dependencies, clarified owners, and tested a revised delivery sequence.", outcome: "The teams agreed on a workable plan; no unverified improvement percentage is claimed.", skills: ["stakeholder alignment", "delivery", "ambiguity"], evidenceIds: ["proof"], approvedLanguage: "Coordinated three teams to resolve delivery dependencies and agree on a shared plan.", uncertainNumbers: ["Time savings have not been verified"], confirmed: true } });
  return state;
}
