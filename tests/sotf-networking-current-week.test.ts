import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { commandEnvelopeSchema, emptyPilotState, persistedCommandEnvelopeSchema } from "../lib/sotf/contracts";
import { applyCommand } from "../lib/sotf/engine";
import { latestNetworkingWeek, networkingPlanMemberships, networkingReplyOccurrences, networkingStrategy } from "../lib/sotf/intelligence";
import { createPreviewState } from "../lib/sotf/preview";

test("the owner's current week begins Monday in Chicago, including the DST boundary", () => {
  const state = createPreviewState();
  expect(latestNetworkingWeek(state, "2026-10-12T04:30:00Z")).toBe("2026-10-05");
  expect(latestNetworkingWeek(state, "2026-10-12T05:30:00Z")).toBe("2026-10-12");
  expect(latestNetworkingWeek(state, "2026-11-02T05:30:00Z")).toBe("2026-10-26");
  expect(latestNetworkingWeek(state, "2026-11-02T06:30:00Z")).toBe("2026-11-02");
});

test("saved plans retain two weeks and deduplicate edits by person and Chicago Monday", () => {
  let state = emptyPilotState();
  const person = createPreviewState().people.find((person) => person.networking && !person.testRecord)!;
  const savedPerson = Object.fromEntries(Object.entries(person).filter(([key]) => !["firstContact", "lastInteraction"].includes(key)));
  const networking = Object.fromEntries(Object.entries(person.networking!).filter(([key]) => key !== "statusUpdatedAt"));
  const save = (weekOf: string, at: string) => {
    state = applyCommand(state, commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command: { type: "save_person", person: { ...savedPerson, hypothesisIds: [], opportunityId: undefined, networking: { ...networking, weekOf } } } }), at);
  };
  save("2026-10-06", "2026-10-07T02:00:00Z");
  save("2026-10-11", "2026-10-08T02:00:00Z");
  save("2026-10-12", "2026-10-12T04:30:00Z");
  const before = structuredClone(state);
  expect(networkingPlanMemberships(state)).toEqual([
    { personId: person.id, weekOf: "2026-10-05", plannedAt: "2026-10-07T02:00:00.000Z" },
    { personId: person.id, weekOf: "2026-10-12", plannedAt: "2026-10-12T04:30:00.000Z" }
  ]);
  expect(state).toEqual(before);
  expect(state.people[0].networking!.weekOf).toBe("2026-10-12");
  expect(networkingStrategy(state, "2026-10-05").queued).toBe(1);
  expect(networkingStrategy(state, "2026-10-12").queued).toBe(1);
});

test.each([true, false])("historical test flags are inherited until explicitly cleared (initial networking: %s)", (initialNetworking) => {
  let state = emptyPilotState();
  const person = createPreviewState().people.find((person) => person.networking && !person.testRecord)!;
  const savedPerson = Object.fromEntries(Object.entries(person).filter(([key]) => !["firstContact", "lastInteraction", "networking", "testRecord"].includes(key)));
  const networking = Object.fromEntries(Object.entries(person.networking!).filter(([key]) => key !== "statusUpdatedAt"));
  const save = (patch: Record<string, unknown>, at: string) => {
    state = applyCommand(state, commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command: { type: "save_person", person: { ...savedPerson, hypothesisIds: [], opportunityId: undefined, ...patch } } }), at);
  };
  save({ testRecord: true, ...(initialNetworking ? { networking: { ...networking, weekOf: "2026-10-05" } } : {}) }, "2026-10-05T12:00:00Z");
  save({ networking: { ...networking, weekOf: "2026-10-12" } }, "2026-10-12T12:00:00Z");
  expect(state.people[0].testRecord).toBe(true);
  expect(networkingPlanMemberships(state)).toEqual([]);
  save({ testRecord: false, networking: { ...networking, weekOf: "2026-10-19" } }, "2026-10-19T12:00:00Z");
  const before = structuredClone(state);
  expect(networkingPlanMemberships(state)).toEqual([{ personId: person.id, weekOf: "2026-10-19", plannedAt: "2026-10-19T12:00:00.000Z" }]);
  expect(state.people[0].testRecord).toBe(false);
  expect(state).toEqual(before);
});

test("dated replies retain each actual day and exclude activity entered while marked test", () => {
  let state = emptyPilotState();
  const person = createPreviewState().people.find((item) => item.networking && !item.testRecord)!;
  const savedPerson = Object.fromEntries(Object.entries(person).filter(([key]) => !["firstContact", "lastInteraction"].includes(key)));
  const networking = Object.fromEntries(Object.entries(person.networking!).filter(([key]) => key !== "statusUpdatedAt"));
  const save = (testRecord: boolean | undefined, replyOccurredOn: string, at: string) => {
    const command = { type: "save_person", person: { ...savedPerson, hypothesisIds: [], opportunityId: undefined, networking, ...(testRecord === undefined ? {} : { testRecord }) }, replyOccurredOn };
    const operation = persistedCommandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command });
    state = applyCommand(state, operation, at, "persisted_event");
    return operation.requestId;
  };
  const first = save(false, "2026-10-11", "2026-10-12T12:00:00Z");
  save(true, "2026-10-12", "2026-10-12T13:00:00Z");
  expect(networkingReplyOccurrences(state)).toEqual([]);
  const third = save(false, "2026-10-13", "2026-10-14T12:00:00Z");
  expect(networkingReplyOccurrences(state)).toEqual([
    { personId: person.id, requestId: first, replyOccurredOn: "2026-10-11", recordedAt: "2026-10-12T12:00:00.000Z" },
    { personId: person.id, requestId: third, replyOccurredOn: "2026-10-13", recordedAt: "2026-10-14T12:00:00.000Z" }
  ]);
  expect(state.people[0].testRecord).toBe(false);
  expect(networkingStrategy(state, "2026-10-05").weeklyCounts.replies).toBe(1);
  expect(networkingStrategy(state, "2026-10-12").weeklyCounts.replies).toBe(1);
  save(false, "2026-10-14", "2026-10-20T12:00:00Z");
  expect(networkingStrategy(state, "2026-10-12").weeklyCounts.replies).toBe(1);
  expect(networkingStrategy(state, "2026-10-19").weeklyCounts.replies).toBe(0);
});

test("September activity stays in its occurrence weeks after an October plan", () => {
  let state = createPreviewState();
  state.meetings.find((item) => item.id === "conversation")!.status = "completed";
  const before = structuredClone(state);
  for (const person of state.people.filter((item) => item.networking)) {
    const { firstContact: _firstContact, lastInteraction: _lastInteraction, ...savedPerson } = person; void _firstContact; void _lastInteraction;
    const { statusUpdatedAt: _statusUpdatedAt, ...networking } = person.networking!; void _statusUpdatedAt;
    state = applyCommand(state, commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command: { type: "save_person", person: { ...savedPerson, networking: { ...networking, weekOf: "2026-10-19" } } } }), "2026-10-19T12:00:00Z");
  }
  const october = networkingStrategy(state, "2026-10-19");
  expect(october.weeklyCounts).toEqual({ planned: 25, attempts: 0, replies: 0, meetings: 0 });
  expect(networkingStrategy(state, "2026-08-31").weeklyCounts).toEqual({ planned: networkingStrategy(before, "2026-08-31").weeklyCounts.planned, attempts: 5, replies: 0, meetings: 0 });
  expect(networkingStrategy(state, "2026-09-07").weeklyCounts).toEqual({ planned: networkingStrategy(before, "2026-09-07").weeklyCounts.planned, attempts: 0, replies: 0, meetings: 1 });
  expect(october.activityWeeks).toEqual(["2026-09-07", "2026-08-31"]);
  expect(october.undatedReplyPeople).toBe(2);
  expect(state.actions).toEqual(before.actions);
  expect(state.meetings).toEqual(before.meetings);
  // Existing cohort analysis remains lifetime-based and separate from weekly counts.
  expect(october.attemptsMade).toBe(5);
  expect(october.conversationsGenerated).toBe(1);
});

test.each([
  ["2026-10-12T04:59:59Z", "2026-10-05"],
  ["2026-10-12T05:00:00Z", "2026-10-12"],
  ["2026-11-02T05:59:59Z", "2026-10-26"],
  ["2026-11-02T06:00:00Z", "2026-11-02"],
  ["2026-03-09T04:59:59Z", "2026-03-02"],
  ["2026-03-09T05:00:00Z", "2026-03-09"]
])("completed activity at %s belongs to Chicago week %s once per person", (at, weekOf) => {
  const state = createPreviewState();
  const person = state.people.find((item) => item.id === "morgan")!;
  person.networking!.weekOf = "2026-01-05";
  const action = state.actions.find((item) => item.personId === person.id && item.state === "manually_completed")!;
  state.actions = [ { ...action, updatedAt: at }, { ...action, id: "duplicate-completed", updatedAt: at }, { ...action, id: "draft", state: "draft", updatedAt: at } ];
  const meeting = state.meetings.find((item) => item.personId === person.id)!;
  state.meetings = [ { ...meeting, startsAt: at, status: "completed" }, { ...meeting, id: "duplicate-meeting", startsAt: at, status: "completed" }, { ...meeting, id: "accepted", startsAt: at, status: "accepted" }, { ...meeting, id: "coaching", startsAt: at, kind: "coaching", status: "completed" } ];
  expect(networkingStrategy(state, weekOf).weeklyCounts).toEqual({ planned: 0, attempts: 1, replies: 0, meetings: 1 });
  state.meetings = state.meetings.filter((item) => item.status !== "completed" || item.kind !== "networking");
  expect(networkingStrategy(state, weekOf).weeklyCounts.meetings).toBe(0);
  person.testRecord = true;
  expect(networkingStrategy(state, weekOf).weeklyCounts).toEqual({ planned: 0, attempts: 0, replies: 0, meetings: 0 });
});

test("the preview uses the Monday of its latest dated person without changing that date", () => {
  const state = createPreviewState();
  state.people[0].networking!.weekOf = "2026-10-21";

  expect(latestNetworkingWeek(state)).toBe("2026-10-19");
  expect(state.people[0].networking!.weekOf).toBe("2026-10-21");
});

test("a new week shows zero without carrying the previous plan forward", () => {
  const state = plannedState(Array(10).fill("2026-10-06"));
  const now = "2026-10-14T15:00:00Z";
  const currentWeek = latestNetworkingWeek(state, now);

  expect(currentWeek).toBe("2026-10-12");
  const current = networkingStrategy(state, currentWeek, now);
  expect(current.queued).toBe(0);
  expect(current.target).toBe(10);
  expect(current.adjustments).toEqual(["No one is planned this week. Add 10 people to start."]);
  const historical = networkingStrategy(state, "2026-09-28", now);
  expect(historical.queued).toBe(0);
  expect(historical.adjustments).toEqual(["No one is planned for the selected week."]);
  expect(networkingStrategy(state, "2026-10-05").queued).toBe(10);
  expect(state.people.slice(0, 10).every((person) => person.networking!.weekOf === "2026-10-06")).toBe(true);
});

test("dates from Monday through Sunday count once in the same plan", () => {
  const state = plannedState(["2026-10-12", "2026-10-18", "2026-10-19"]);

  expect(networkingStrategy(state, "2026-10-12").candidates.map(({ person }) => person.id)).toEqual([state.people[0].id, state.people[1].id]);
  expect(networkingStrategy(state, "2026-10-19").candidates.map(({ person }) => person.id)).toEqual([state.people[2].id]);
});

function plannedState(weeks: string[]) {
  let state = emptyPilotState();
  createPreviewState().people.slice(0, weeks.length).forEach((person, index) => {
    const { firstContact: _firstContact, lastInteraction: _lastInteraction, networking, ...saved } = person; void _firstContact; void _lastInteraction;
    const { statusUpdatedAt: _statusUpdatedAt, ...plan } = networking!; void _statusUpdatedAt;
    state = applyCommand(state, commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command: { type: "save_person", person: { ...saved, hypothesisIds: [], opportunityId: undefined, networking: { ...plan, weekOf: weeks[index] } } } }), "2026-10-07T12:00:00Z");
  });
  return state;
}
