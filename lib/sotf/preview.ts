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
  run({ type: "start_transition", timing: "Six months to explore", question: "Where can I own real decisions while learning a new industry?", weeklyHours: 8,
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
  const candidates = Array.from({ length: 25 }, (_, index) => {
    const number = index + 1;
    const pathway = number === 2 ? "thoughtful_comment" : number === 3 ? "warm_introduction" : number % 7 === 0 ? "research_wait" : "direct_outreach";
    const category = number % 3 === 0 ? "Veteran-friendly operations" : number % 3 === 1 ? "Technical program leadership" : "Mission-driven technology";
    return {
      id: number === 1 ? "morgan" : `network-person-${number}`,
      name: number === 1 ? "Morgan — fictional contact" : `Fictional candidate ${number}`,
      company: number === 1 ? "Northstar" : `Fictional organization ${number}`,
      role: number === 1 ? "Program practitioner" : number % 2 ? "Operations leader" : "Technical program leader",
      source: "Synthetic public-company research for preview only",
      overlap: number === 1 ? "We met at a fictional professional workshop." : number % 4 === 0 ? "A confirmed fictional veteran-community overlap." : "No personal overlap claimed; the work itself is the reason to learn.",
      whyNow: number === 1 ? "Can explain how program decisions are made in this team" : "Recent public work makes this a useful time to understand the role and operating context",
      objective: number === 1 ? "Distinguish ownership from coordination" : "Learn which decisions the role owns and what strong contribution looks like",
      introductionPath: pathway === "warm_introduction" ? "A fictional mutual professional contact" : "",
      opportunityId: number === 1 ? "northstar" : undefined,
      hypothesisIds: [number % 2 ? "program" : "operations"],
      nextTouch: number <= 5 ? "2026-09-15" : undefined,
      networking: {
        weekOf: "2026-09-01",
        sourceUrl: `https://example.com/networking/candidate-${number}`,
        whyPerson: number === 1 ? "Morgan works close enough to the decisions to explain the actual operating model" : "This person has direct public evidence of doing the work being explored",
        lamp: { list: category, alumniAffinity: number % 4 === 0 ? "Fictional veteran community" : "", motivation: "The organization's public work aligns with the transition hypothesis being tested", posting: number % 2 ? "Related public role signal" : "No posting required; practitioner learning path" },
        contributionAngle: "Offer a useful perspective from leading cross-team delivery while staying curious about the civilian context",
        recommendedNextAction: pathway === "thoughtful_comment" ? "Contribute one specific public comment, then follow up privately only if the exchange is genuine" : pathway === "warm_introduction" ? "Ask the mutual contact for a low-pressure introduction" : pathway === "research_wait" ? "Research the person's recent work before deciding whether contact would be useful" : "Send a short curiosity-led connection note",
        pathway,
        status: "identified"
      }
    };
  });
  candidates.forEach((person) => run({ type: "save_person", person }));
  for (const person of candidates.slice(0, 5)) {
    run({ type: "prepare_outreach", personId: person.id, stage: "initial" });
    const action = state.actions.at(-1)!;
    run({ type: "approve_action", actionId: action.id, exactRevision: action.revision });
    run({ type: "record_action_result", actionId: action.id, outcome: "manually_completed", receipt: "Synthetic preview: user manually completed the outreach outside Workspace." });
    if (person.id !== "morgan") run({ type: "save_person", person: { ...person, networking: { ...person.networking, status: "no_response" } } });
  }
  run({ type: "save_person", person: { ...candidates[0], networking: { ...candidates[0].networking, status: "replied" } } });
  run({ type: "save_person", person: { ...candidates[1], networking: { ...candidates[1].networking, status: "replied" } } });
  run({ type: "prepare_outreach", personId: candidates[1].id, stage: "private_follow_up" });
  run({ type: "record_meeting", meeting: { id: "coaching-session", title: "SOTF coaching session", hypothesisIds: ["program"], kind: "coaching", startsAt: "2026-09-05T16:00:00Z", endsAt: "2026-09-05T17:00:00Z", status: "completed", objective: "Test the work before judging the title" } });
  run({ type: "debrief_meeting", meetingId: "coaching-session", said: "Your coach challenged you to test what you would own day to day instead of judging the opportunity by how the role sounds.", inferred: "The next useful evidence is one concrete example of a decision the program lead owns.", unresolved: ["Which decisions does the program lead make without approval?"], introductions: [], nextTouch: undefined, evidence: [], commitments: [{ id: "coaching-next-step", title: "Ask Morgan for one decision the program lead owns", owner: "Fellow", due: "2026-09-07", definitionOfDone: "From your last coaching session: record one concrete example of a decision the program lead owns.", reviewTrigger: "Return to the question if Morgan can only describe coordination, not decision ownership." }] });
  run({ type: "record_meeting", meeting: { id: "conversation", title: "Understand the work with Morgan", personId: "morgan", opportunityId: "northstar", hypothesisIds: ["program"], kind: "networking", startsAt: "2026-09-08T15:00:00Z", endsAt: "2026-09-08T15:30:00Z", status: "accepted", objective: "Learn which decisions this role actually owns" } });
  run({ type: "review_week", learned: "One of five mature fictional attempts progressed to a real conversation; technical program leadership produced the response.", start: "Prioritize the strongest recorded category while preserving comparison cohorts.", stop: "Treating recent silence as a failed conversion.", change: "Use the recorded category and pathway response counts to shape the next 25-person queue.", hypothesisUpdates: [], commitments: [] });
  run({ type: "save_story", story: { id: "delivery-story", title: "Unblocking cross-team delivery", situation: "A fictional project had conflicting priorities across three teams.", contribution: "Facilitated the dependency review and negotiated a shared sequence.", scope: "Three teams; decision approval remained with the accountable leads.", actions: "Mapped dependencies, clarified owners, and tested a revised delivery sequence.", outcome: "The teams agreed on a workable plan; no unverified improvement percentage is claimed.", skills: ["stakeholder alignment", "delivery", "ambiguity"], evidenceIds: ["proof"], approvedLanguage: "Coordinated three teams to resolve delivery dependencies and agree on a shared plan.", uncertainNumbers: ["Time savings have not been verified"], confirmed: true } });
  return state;
}
