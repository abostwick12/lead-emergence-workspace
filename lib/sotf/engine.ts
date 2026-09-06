import { commandEnvelopeSchema, type CommandEnvelope, type Commitment, type Evidence, type OutboundAction, type PilotState } from "./contracts";
import { assessOpportunity, requireRecord } from "./intelligence";

export class RevisionConflict extends Error { constructor() { super("Your SOTF Bundle changed in another session. Refresh and review the current state before retrying."); } }
function upsert<T extends { id: string }>(records: T[], item: T) { const index = records.findIndex((record) => record.id === item.id); if (index < 0) records.push(item); else records[index] = item; }
function uniqueIds(records: { id: string }[]) { if (new Set(records.map((item) => item.id)).size !== records.length) throw new Error("Each record needs a distinct ID."); }

/** Only ordinary, explicitly confirmed operational data enters this engine. Protected context has no persistence fallback. */
export function applyCommand(previous: PilotState, input: CommandEnvelope, now = new Date().toISOString()): PilotState {
  const envelope = commandEnvelopeSchema.parse(input);
  const serialized = JSON.stringify(envelope.command);
  const receipt = previous.receipts.find((item) => item.requestId === envelope.requestId);
  if (receipt) {
    if (receipt.command !== serialized) throw new Error("This request ID belongs to a different operation. Review the intended change and use a new request ID.");
    return previous;
  }
  if (envelope.expectedRevision !== previous.revision) throw new RevisionConflict();
  const state = structuredClone(previous);
  const command = envelope.command;
  now = new Date(now).toISOString();
  const opportunity = (id: string) => requireRecord(state.opportunities, id, "Opportunity");
  const person = (id: string) => requireRecord(state.people, id, "Person");
  const meeting = (id: string) => requireRecord(state.meetings, id, "Meeting");
  const hypotheses = (ids: string[]) => ids.forEach((id) => requireRecord(state.hypotheses, id, "Hypothesis"));
  const links = (value: { personId?: string; meetingId?: string; opportunityId?: string; hypothesisId?: string; hypothesisIds?: string[] }) => {
    if (value.personId) person(value.personId); if (value.meetingId) meeting(value.meetingId); if (value.opportunityId) opportunity(value.opportunityId);
    hypotheses(value.hypothesisIds ?? (value.hypothesisId ? [value.hypothesisId] : []));
  };
  const requireEvidence = (ids: string[], opportunityId?: string) => ids.map((id) => {
    const item = requireRecord(state.evidence, id, "Evidence");
    if (item.review !== "accepted" || (opportunityId && item.opportunityId !== opportunityId)) throw new Error("Use reviewed evidence belonging to this opportunity.");
    return item;
  });
  const addEvidence = (value: Omit<Evidence, "createdAt" | "review">) => {
    links(value); if (value.criterionId) requireRecord(state.criteria, value.criterionId, "Criterion");
    if (value.source.observedAt > now.slice(0, 10)) throw new Error("Evidence cannot have a future observation date.");
    if (state.evidence.some((item) => item.id === value.id)) throw new Error("Evidence is append-only. Add a new evidence record rather than overwriting a prior observation.");
    if (value.score !== undefined && !value.dimension) throw new Error("A score must name the dimension it assesses.");
    if (value.criterionId && state.criteria.find((item) => item.id === value.criterionId)?.dimension !== value.dimension) throw new Error("Evidence must use the criterion's dimension.");
    state.evidence.push({ ...value, criterionDesired: state.criteria.find((item) => item.id === value.criterionId)?.desired, review: "pending", createdAt: now });
  };
  const saveCommitment = (value: Omit<Commitment, "status" | "createdAt" | "updatedAt">, reopen = false) => {
    links(value); const current = state.commitments.find((item) => item.id === value.id);
    upsert(state.commitments, { ...value, status: reopen ? "open" : current?.status ?? "open", result: reopen ? undefined : current?.result, createdAt: current?.createdAt ?? now, updatedAt: now });
  };
  const meetingStamp = (id: string) => { const item = meeting(id); return JSON.stringify([item.startsAt, item.endsAt, item.status, item.personId, item.objective]); };
  const draft = (value: Omit<OutboundAction, "id" | "revision" | "state" | "updatedAt">, suffix = "action") => {
    links(value); const id = `${envelope.requestId}:${suffix}`;
    state.actions.push({ ...value, ...(value.kind === "calendar_invite" && value.meetingId ? { meetingStamp: meetingStamp(value.meetingId) } : {}), id, revision: 1, state: "draft", updatedAt: now });
  };
  let summary: string = command.type.replaceAll("_", " ");
  switch (command.type) {
    case "start_transition": {
      if (state.chapter) throw new Error("Your transition is already started. Resume it rather than replacing existing progress.");
      uniqueIds(command.criteria); uniqueIds(command.hypotheses);
      state.chapter = { timing: command.timing, question: command.question, weeklyHours: command.weeklyHours, phase: "exploring", startedAt: now };
      state.criteria = command.criteria; state.hypotheses = command.hypotheses.map((item) => ({ ...item, updatedAt: now }));
      summary = `Started from the decision: ${command.question}`; break;
    }
    case "confirm_criteria": {
      uniqueIds(command.criteria); state.criteria = command.criteria; summary = `Criteria deliberately revised: ${command.reason}`; break;
    }
    case "save_hypothesis": upsert(state.hypotheses, { ...command.hypothesis, updatedAt: now }); summary = `Direction reviewed: ${command.hypothesis.proposition} — ${command.hypothesis.status}`; break;
    case "record_opportunity": {
      hypotheses(command.opportunity.hypothesisIds); uniqueIds(command.opportunity.requirements);
      if (command.opportunity.requirements.some((item) => item.status !== "unknown")) throw new Error("New requirements begin unresolved. Resolve them with reviewed evidence after recording the opportunity.");
      const current = state.opportunities.find((item) => item.id === command.opportunity.id);
      if (current) throw new Error("This opportunity already exists. Resume its evidence and decision workflow instead of replacing it.");
      state.opportunities.push({ ...command.opportunity, createdAt: now, status: "exploring" });
      summary = `Investigating ${command.opportunity.company} — ${command.opportunity.role}`; break;
    }
    case "record_evidence": addEvidence(command.evidence); summary = "Evidence proposed for review; confirmed criteria have not changed."; break;
    case "review_evidence": {
      const item = requireRecord(state.evidence, command.evidenceId, "Evidence");
      if (item.review !== "pending") throw new Error("This evidence has already been reviewed. Add a new observation to challenge it.");
      item.review = command.decision === "accept" ? "accepted" : "rejected"; item.reviewedAt = now; item.reviewRationale = command.rationale;
      summary = `Evidence ${item.review}: ${item.statement}`; break;
    }
    case "resolve_requirement": {
      const requirement = requireRecord(opportunity(command.opportunityId).requirements, command.requirementId, "Requirement");
      const evidence = requireEvidence(command.evidenceIds, command.opportunityId);
      if (command.status !== "unknown" && !evidence.some((item) => !["inference", "community"].includes(item.source.kind))) throw new Error("A requirement needs reviewed direct or authoritative evidence. An inference or anonymous discussion is insufficient.");
      requirement.status = command.status; requirement.evidenceIds = command.evidenceIds;
      summary = `Requirement ${command.status}: ${requirement.label}`; break;
    }
    case "decide_opportunity": {
      const item = opportunity(command.opportunityId);
      item.status = command.decision; item.decision = { rationale: command.rationale, nextAction: command.nextAction, revisitWhen: command.revisitWhen, at: now, due: command.due, assessmentRevision: state.revision };
      saveCommitment({ id: `${item.id}:decision-next-step`, title: command.nextAction.slice(0, 240), owner: "Fellow", due: command.due, definitionOfDone: command.nextAction, reviewTrigger: command.revisitWhen, opportunityId: item.id });
      const next = requireRecord(state.commitments, `${item.id}:decision-next-step`, "Commitment");
      next.status = "open"; next.result = undefined;
      if (["pause", "decline"].includes(command.decision)) {
        const next = requireRecord(state.commitments, `${item.id}:decision-next-step`, "Commitment"); next.status = "cancelled"; next.result = `Deliberate ${command.decision}: ${command.rationale}. Revisit when ${command.revisitWhen}`;
      }
      summary = `${item.company}: ${command.decision} — ${command.rationale}`; break;
    }
    case "save_person": {
      links(command.person); const current = state.people.find((item) => item.id === command.person.id);
      upsert(state.people, { ...command.person, firstContact: current?.firstContact, lastInteraction: current?.lastInteraction });
      summary = `${command.person.name} matters now: ${command.person.whyNow}`; break;
    }
    case "prepare_outreach": {
      const contact = person(command.personId);
      draft({ kind: "email", recipient: contact.email ?? contact.name, subject: `A question about ${contact.role || "your work"}`, body: `Hi ${contact.name},\n\n${contact.overlap ? `${contact.overlap}\n\n` : ""}I'm exploring my next professional chapter. ${contact.whyNow}\n\nI'd value a brief conversation to learn: ${contact.objective}\n\nWould you be open to a short conversation? Thank you for considering it.`, personId: contact.id });
      summary = `Outreach prepared for ${contact.name}; nothing sent.`; break;
    }
    case "record_meeting": {
      const value = command.meeting; links(value);
      if (value.endsAt <= value.startsAt) throw new Error("The meeting must end after it starts.");
      if (value.provider !== "manual" && !value.sourceEventId) throw new Error("Provider meetings need their canonical event ID for reconciliation.");
      const canonical = value.sourceEventId ? state.meetings.find((item) => item.provider === value.provider && item.sourceEventId === value.sourceEventId) : undefined;
      if (canonical && canonical.id !== value.id && state.meetings.some((item) => item.id === value.id)) throw new Error("This event conflicts with another meeting. Reconcile the existing meeting IDs before continuing.");
      const current = canonical ?? state.meetings.find((item) => item.id === value.id);
      if (current && (current.provider !== value.provider || current.sourceEventId !== value.sourceEventId)) throw new Error("A meeting's provider identity cannot change. Reconcile the existing event instead.");
      if (current?.debrief && (value.status !== "completed" || value.startsAt !== current.startsAt || value.endsAt !== current.endsAt || value.personId !== current.personId || value.opportunityId !== current.opportunityId)) throw new Error("A completed meeting's occurrence and learning links cannot be rewritten by a calendar refresh.");
      const targetId = current?.id ?? value.id;
      upsert(state.meetings, { ...value, id: targetId, debrief: current?.debrief });
      state.actions.filter((item) => item.kind === "calendar_invite" && item.meetingId === targetId && ["draft", "approved_for_manual_execution", "failed"].includes(item.state) && item.meetingStamp !== meetingStamp(targetId)).forEach((item) => { item.state = "superseded"; item.approvedAt = undefined; item.updatedAt = now; });
      if (value.status === "cancelled") state.commitments.filter((item) => item.meetingId === targetId && item.id.endsWith(":prepare")).forEach((item) => { item.status = "cancelled"; item.updatedAt = now; });
      else if (["planned", "accepted"].includes(value.status)) saveCommitment({ id: `${targetId}:prepare`, title: `Prepare: ${value.title}`.slice(0, 240), owner: "Fellow", due: value.startsAt.slice(0, 10), definitionOfDone: `Review the person, prior interactions, and questions needed to resolve: ${value.objective}`, reviewTrigger: "Meeting time, purpose, or participant changes", meetingId: targetId, personId: value.personId, opportunityId: value.opportunityId }, current?.status === "cancelled" || Boolean(current && (current.startsAt !== value.startsAt || current.objective !== value.objective)));
      summary = `${value.status === "cancelled" ? "Cancelled" : current ? "Reconciled" : "Recorded"} meeting: ${value.title}`; break;
    }
    case "debrief_meeting": {
      const item = meeting(command.meetingId);
      if (item.status === "cancelled") throw new Error("A cancelled meeting cannot be debriefed. Correct the meeting state if it actually occurred.");
      if (item.debrief) throw new Error("This meeting has already been debriefed. Add new evidence rather than importing it again.");
      item.status = "completed"; item.debrief = { said: command.said, inferred: command.inferred, unresolved: command.unresolved, introductions: command.introductions, at: now };
      command.evidence.forEach((value) => addEvidence({ ...value, meetingId: item.id, opportunityId: value.opportunityId ?? item.opportunityId, personId: value.personId ?? item.personId, hypothesisIds: [...new Set([...value.hypothesisIds, ...item.hypothesisIds])] }));
      command.commitments.forEach((value) => saveCommitment({ ...value, meetingId: item.id, personId: value.personId ?? item.personId, opportunityId: value.opportunityId ?? item.opportunityId }));
      state.commitments.filter((value) => value.id === `${item.id}:prepare`).forEach((value) => { value.status = "done"; value.result = "Meeting completed and debrief recorded."; value.updatedAt = now; });
      if (item.personId) {
        const contact = person(item.personId); contact.lastInteraction = item.startsAt; contact.firstContact ??= item.startsAt; if (command.nextTouch) contact.nextTouch = command.nextTouch;
        draft({ kind: "email", recipient: contact.email ?? contact.name, subject: `Thank you — ${item.title}`.slice(0, 240), body: `Hi ${contact.name},\n\nThank you for the conversation. What I took from it: ${command.said}\n\n${command.commitments.length ? `My next step is ${command.commitments[0].title}.` : "I appreciate your perspective as I consider my next step."}`, personId: contact.id, meetingId: item.id }, "thank-you");
      }
      summary = `${item.title}: debrief recorded, ${command.evidence.length} evidence item(s) awaiting review, follow-through prepared.`; break;
    }
    case "save_commitment": saveCommitment(command.commitment); summary = `Promise recorded: ${command.commitment.title}`; break;
    case "resolve_commitment": {
      const item = requireRecord(state.commitments, command.commitmentId, "Commitment"); item.status = command.status; item.result = command.evidence; item.updatedAt = now; summary = `${item.title}: ${command.status} — ${command.evidence}`; break;
    }
    case "save_story": {
      requireEvidence(command.story.evidenceIds); const current = state.stories.find((item) => item.id === command.story.id);
      upsert(state.stories, { ...command.story, createdAt: current?.createdAt ?? now, updatedAt: now }); summary = `Reusable evidence confirmed: ${command.story.title}`; break;
    }
    case "save_material": {
      opportunity(command.material.opportunityId); command.material.storyIds.forEach((id) => requireRecord(state.stories, id, "Story"));
      if (state.materials.some((item) => item.id === command.material.id)) throw new Error("Materials are versioned and immutable. Use a new version ID.");
      const version = state.materials.filter((item) => item.opportunityId === command.material.opportunityId && item.kind === command.material.kind).length + 1;
      state.materials.push({ ...command.material, version, createdAt: now }); summary = `Prepared ${command.material.kind} version ${version}; not submitted.`; break;
    }
    case "record_submission": {
      opportunity(command.opportunityId);
      if (state.applications.some((item) => item.opportunityId === command.opportunityId)) throw new Error("Submission is already recorded. Resume its application workflow.");
      const materials = command.materialIds.map((id) => requireRecord(state.materials, id, "Submitted material"));
      if (materials.some((item) => item.opportunityId !== command.opportunityId)) throw new Error("Submitted materials must belong to this opportunity.");
      if (command.submittedAt > now) throw new Error("A future submission cannot be marked applied.");
      state.applications.push({ opportunityId: command.opportunityId, submittedAt: command.submittedAt, receipt: command.receipt, materials: structuredClone(materials), status: "applied" });
      summary = `Actual submission confirmed: ${opportunity(command.opportunityId).company}`; break;
    }
    case "record_application_outcome": {
      const item = state.applications.find((item) => item.opportunityId === command.opportunityId);
      if (!item) throw new Error("Record the actual submission before updating its outcome.");
      item.status = command.outcome; item.outcome = { reason: command.reason, source: command.source, nextAction: command.nextAction, at: now };
      saveCommitment({ id: command.opportunityId + ":application-next-step", title: command.nextAction.slice(0, 240), owner: "Fellow", definitionOfDone: command.nextAction, reviewTrigger: "New employer feedback or the next preparation decision", opportunityId: command.opportunityId }, true);
      summary = `Application ${command.outcome}: ${command.reason}. Next: ${command.nextAction}`; break;
    }
    case "record_interview": {
      const value = command.interview; opportunity(value.opportunityId); if (value.meetingId) meeting(value.meetingId); value.storyIds.forEach((id) => requireRecord(state.stories, id, "Story"));
      if (value.employerFeedback && !value.employerFeedbackSource) throw new Error("Employer feedback needs its actual source; keep self-assessment separate.");
      if (state.interviews.some((item) => item.id === value.id)) throw new Error("This interview debrief is already recorded.");
      value.evidence.forEach((item) => addEvidence({ ...item, opportunityId: value.opportunityId }));
      state.interviews.push({ ...value, recordedAt: now });
      saveCommitment({ id: `${value.id}:prepare-next`, title: value.nextPreparation.slice(0, 240), owner: "Fellow", definitionOfDone: value.nextPreparation, reviewTrigger: "Before the next interview round", opportunityId: value.opportunityId });
      summary = `Interview learning recorded: ${value.round}. ${value.nextPreparation}`; break;
    }
    case "record_offer": {
      opportunity(command.offer.opportunityId); const current = state.offers.find((item) => item.id === command.offer.id);
      if (current?.accepted) throw new Error("Accepted terms are retained. Record new information separately rather than rewriting the accepted offer.");
      upsert(state.offers, command.offer); summary = "Offer terms recorded for comparison; no acceptance or negotiation sent."; break;
    }
    case "accept_offer": {
      const item = requireRecord(state.offers, command.offerId, "Offer"); if (!state.chapter) throw new Error("Start the transition chapter first.");
      if (state.offers.some((offer) => offer.accepted)) throw new Error("An acceptance is already recorded. Do not replace it silently.");
      uniqueIds(command.checkpoints); item.accepted = { rationale: command.rationale, startDate: command.startDate, at: now }; state.checkpoints = command.checkpoints; state.chapter.phase = "transitioning";
      command.checkpoints.forEach((checkpoint) => saveCommitment({ id: checkpoint.id, title: checkpoint.title, owner: checkpoint.owner, due: new Date(new Date(`${command.startDate}T12:00:00Z`).valueOf() + checkpoint.day * 86400000).toISOString().slice(0, 10), definitionOfDone: checkpoint.successEvidence, reviewTrigger: `First ${checkpoint.day} days: revisit with your manager`, opportunityId: item.opportunityId }));
      summary = "Fellow-confirmed acceptance recorded with rationale and first-90-days checkpoints. No external acceptance sent."; break;
    }
    case "review_week": {
      uniqueIds(command.hypothesisUpdates); uniqueIds(command.commitments);
      command.hypothesisUpdates.forEach((value) => upsert(state.hypotheses, { ...value, updatedAt: now })); command.commitments.forEach((value) => saveCommitment(value));
      state.weeklyReviews.push({ id: envelope.requestId, at: now, learned: command.learned, start: command.start, stop: command.stop, change: command.change });
      summary = `Weekly change: ${command.change}`; break;
    }
    case "prepare_action": {
      const { type: _type, ...value } = command; void _type;
      if (value.kind === "calendar_invite" && value.meetingId && meeting(value.meetingId).status !== "accepted") throw new Error("Confirm the agreed meeting time before preparing its invitation.");
      draft(value); summary = `${command.kind} prepared for review; nothing sent.`; break;
    }
    case "revise_action": {
      const item = requireRecord(state.actions, command.actionId, "Action");
      if (!["draft", "approved_for_manual_execution"].includes(item.state)) throw new Error("Reconcile an attempted action before editing it. Completed messages remain unchanged.");
      item.recipient = command.recipient; item.subject = command.subject; item.body = command.body;
      item.revision += 1; item.state = "draft"; item.approvedAt = undefined; item.updatedAt = now;
      summary = "Draft revised; previous approval no longer applies."; break;
    }
    case "approve_action": {
      const item = requireRecord(state.actions, command.actionId, "Action");
      if (item.revision !== command.exactRevision || item.state !== "draft") throw new Error("Review the exact current draft before approving it.");
      item.state = "approved_for_manual_execution"; item.approvedAt = now; item.updatedAt = now;
      summary = "Exact draft approved. External execution is manual; approval is not evidence of sending."; break;
    }
    case "record_action_result": {
      const item = requireRecord(state.actions, command.actionId, "Action");
      if (item.state !== "approved_for_manual_execution" && !(item.state === "uncertain" && command.outcome === "manually_completed")) throw new Error("Only an approved action can receive an execution result.");
      item.state = command.outcome; item.receipt = command.receipt; item.updatedAt = now;
      if (command.outcome === "manually_completed" && item.personId) { const contact = person(item.personId); contact.firstContact ??= now; contact.lastInteraction = now; }
      summary = `Action ${command.outcome}: ${command.receipt}`; break;
    }
    case "retry_action": {
      const item = requireRecord(state.actions, command.actionId, "Action");
      if (!["failed", "uncertain"].includes(item.state)) throw new Error("Completed and pending actions must not be retried.");
      item.state = item.kind === "calendar_invite" && item.meetingId && item.meetingStamp !== meetingStamp(item.meetingId) ? "superseded" : "draft"; item.revision += 1; item.approvedAt = undefined; item.updatedAt = now;
      if (item.state === "superseded") { summary = "Non-execution confirmed. Meeting details changed; prepare a new invitation from the current agreement."; break; }
      summary = "Non-execution confirmed; the same action is ready for a fresh exact-draft review. No duplicate action created."; break;
    }
    case "close_chapter": {
      if (!state.chapter) throw new Error("No transition chapter exists.");
      const allowed = new Set([...state.stories, ...state.people, ...state.hypotheses, ...state.commitments].map((item) => item.id));
      if (command.carryForward.some((id) => !allowed.has(id))) throw new Error("Choose existing operational records to carry forward.");
      state.chapter.phase = "professional_work"; state.chapter.reflection = command.reflection; state.chapter.carryForward = command.carryForward; state.chapter.nextFocus = command.nextFocus;
      summary = `Continuity reviewed: ${command.nextFocus}. Transition history remains retained.`; break;
    }
  }
  state.revision += 1;
  state.changes.push({ id: envelope.requestId, at: now, kind: command.type, summary });
  state.receipts.push({ requestId: envelope.requestId, command: serialized, revision: state.revision });
  if (JSON.stringify(state).length > 1_500_000) throw new Error("This pilot chapter has reached its safe size limit. Export and review the chapter before adding more records; existing work is unchanged.");
  return state;
}

export function resumeTransition(state: PilotState, now = new Date().toISOString()) {
  const latestDecision = state.opportunities.filter((item) => item.decision).sort((a, b) => b.decision!.at.localeCompare(a.decision!.at))[0];
  return { revision: state.revision, chapter: state.chapter, criteria: state.criteria, hypotheses: state.hypotheses, latestDecision: latestDecision ? { opportunity: latestDecision, currentAssessment: assessOpportunity(state, latestDecision.id) } : null, pendingEvidence: state.evidence.filter((item) => item.review === "pending"), nextActions: state.commitments.filter((item) => ["open", "blocked"].includes(item.status)), unfinishedExternalActions: state.actions.filter((item) => !["manually_completed", "superseded"].includes(item.state)), recentChanges: state.changes.slice(-12), protectedContext: { status: "unavailable", instruction: "Do not persist private/sensitive professional context in operational records. Use ordinary transition inputs explicitly confirmed for this workflow; the approved protected capability remains separate." }, generatedAt: now };
}
