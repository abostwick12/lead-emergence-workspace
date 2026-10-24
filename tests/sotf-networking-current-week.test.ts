import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { commandEnvelopeSchema, emptyPilotState } from "../lib/sotf/contracts";
import { applyCommand } from "../lib/sotf/engine";
import { latestNetworkingWeek, networkingPlanMemberships, networkingStrategy } from "../lib/sotf/intelligence";
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
  expect(networkingStrategy(state, "2026-10-05").queued).toBe(0);
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

test("the preview uses the Monday of its latest dated person without changing that date", () => {
  const state = createPreviewState();
  state.people[0].networking!.weekOf = "2026-10-21";

  expect(latestNetworkingWeek(state)).toBe("2026-10-19");
  expect(state.people[0].networking!.weekOf).toBe("2026-10-21");
});

test("a new week shows zero without carrying the previous plan forward", () => {
  const state = createPreviewState();
  for (const person of state.people.slice(0, 10)) person.networking!.weekOf = "2026-10-06";
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
  const state = createPreviewState();
  state.people[0].networking!.weekOf = "2026-10-12";
  state.people[1].networking!.weekOf = "2026-10-18";
  state.people[2].networking!.weekOf = "2026-10-19";

  expect(networkingStrategy(state, "2026-10-12").candidates.map(({ person }) => person.id)).toEqual([state.people[0].id, state.people[1].id]);
  expect(networkingStrategy(state, "2026-10-19").candidates.map(({ person }) => person.id)).toEqual([state.people[2].id]);
});
