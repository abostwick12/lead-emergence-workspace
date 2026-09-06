import { describe, expect, it } from "vitest";
import { allowedTransitionsFrom, HARNESS_STATES, HarnessStateMachine } from "../src/state-machine";

describe("exhaustive state transitions", () => {
  for (const from of HARNESS_STATES) {
    for (const to of HARNESS_STATES) {
      it(`${from} -> ${to} is exactly allowlisted or rejected`, () => {
        const machine = new HarnessStateMachine(from);
        const allowed = allowedTransitionsFrom(from).includes(to);
        expect(machine.canTransition(to)).toBe(allowed);
        if (allowed) {
          machine.transition(to);
          expect(machine.state).toBe(to);
        } else {
          expect(() => machine.transition(to)).toThrow(/invalid state transition/u);
          expect(machine.state).toBe(from);
        }
      });
    }
  }

  it("terminal states cannot be escaped", () => {
    for (const state of ["COMPLETE", "TERMINAL", "TERMINAL_UNCERTAIN"] as const) {
      const machine = new HarnessStateMachine(state);
      expect(machine.isTerminal).toBe(true);
      expect(() => machine.transition("READY_TO_SEND")).toThrow();
    }
  });
});
