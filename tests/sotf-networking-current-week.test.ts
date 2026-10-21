import { expect, test } from "vitest";
import { latestNetworkingWeek, networkingStrategy } from "../lib/sotf/intelligence";
import { createPreviewState } from "../lib/sotf/preview";

test("the owner's current week begins Monday in Chicago, including the DST boundary", () => {
  const state = createPreviewState();
  expect(latestNetworkingWeek(state, "2026-10-12T04:30:00Z")).toBe("2026-10-05");
  expect(latestNetworkingWeek(state, "2026-10-12T05:30:00Z")).toBe("2026-10-12");
  expect(latestNetworkingWeek(state, "2026-11-02T05:30:00Z")).toBe("2026-10-26");
  expect(latestNetworkingWeek(state, "2026-11-02T06:30:00Z")).toBe("2026-11-02");
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
