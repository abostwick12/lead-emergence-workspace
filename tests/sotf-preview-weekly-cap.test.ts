import { expect, test } from "vitest";
import { networkingStrategy } from "../lib/sotf/intelligence";
import { createPreviewState } from "../lib/sotf/preview";

test("fictional preview keeps every planned week within the ten-person target", () => {
  const state = createPreviewState();
  const weeks = new Set(state.people.flatMap((person) => person.networking?.weekOf ? [person.networking.weekOf] : []));
  const plans = [...weeks].map((week) => networkingStrategy(state, week));

  expect(plans.reduce((total, plan) => total + plan.queued, 0)).toBe(25);
  expect(plans.map((plan) => plan.queued).sort((a, b) => b - a)).toEqual([10, 10, 5]);
  expect(plans.every((plan) => plan.queued <= plan.target)).toBe(true);
});
