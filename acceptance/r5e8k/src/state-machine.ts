export const HARNESS_STATES = [
  "BOOT",
  "READY_TO_SEND",
  "RECOVERY_SEND_LATCHED",
  "RECOVERY_SENT",
  "CALLBACK_ACCEPTED",
  "EXCHANGE_PREPARE",
  "EXCHANGE_COMMITTED",
  "RECOVERY_VALIDATED",
  "RECOVERY_EVIDENCE_PAUSE",
  "EMAIL_CHANGE_READY",
  "EMAIL_CHANGE_COMMITTED",
  "PENDING_EMAIL_EVIDENCE_PAUSE",
  "PASSWORD_READY",
  "PASSWORD_COMMITTED",
  "COMPLETE",
  "TERMINAL",
  "TERMINAL_UNCERTAIN",
] as const;

export type HarnessState = (typeof HARNESS_STATES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<HarnessState, readonly HarnessState[]>> = {
  BOOT: ["READY_TO_SEND", "CALLBACK_ACCEPTED", "TERMINAL"],
  READY_TO_SEND: ["RECOVERY_SEND_LATCHED", "CALLBACK_ACCEPTED", "TERMINAL"],
  RECOVERY_SEND_LATCHED: ["RECOVERY_SENT", "TERMINAL", "TERMINAL_UNCERTAIN"],
  RECOVERY_SENT: ["CALLBACK_ACCEPTED", "TERMINAL"],
  CALLBACK_ACCEPTED: ["EXCHANGE_PREPARE", "TERMINAL"],
  EXCHANGE_PREPARE: ["EXCHANGE_COMMITTED", "TERMINAL"],
  EXCHANGE_COMMITTED: ["RECOVERY_VALIDATED", "TERMINAL", "TERMINAL_UNCERTAIN"],
  RECOVERY_VALIDATED: ["RECOVERY_EVIDENCE_PAUSE", "TERMINAL"],
  RECOVERY_EVIDENCE_PAUSE: ["EMAIL_CHANGE_READY", "TERMINAL"],
  EMAIL_CHANGE_READY: ["EMAIL_CHANGE_COMMITTED", "TERMINAL"],
  EMAIL_CHANGE_COMMITTED: ["PENDING_EMAIL_EVIDENCE_PAUSE", "TERMINAL", "TERMINAL_UNCERTAIN"],
  PENDING_EMAIL_EVIDENCE_PAUSE: ["PASSWORD_READY", "TERMINAL"],
  PASSWORD_READY: ["PASSWORD_COMMITTED", "TERMINAL"],
  PASSWORD_COMMITTED: ["COMPLETE", "TERMINAL", "TERMINAL_UNCERTAIN"],
  COMPLETE: [],
  TERMINAL: [],
  TERMINAL_UNCERTAIN: [],
};

export class HarnessStateMachine {
  #state: HarnessState;

  constructor(initialState: HarnessState = "BOOT") {
    this.#state = initialState;
  }

  get state(): HarnessState {
    return this.#state;
  }

  get isTerminal(): boolean {
    return this.#state === "COMPLETE" || this.#state === "TERMINAL" || this.#state === "TERMINAL_UNCERTAIN";
  }

  canTransition(next: HarnessState): boolean {
    return ALLOWED_TRANSITIONS[this.#state].includes(next);
  }

  transition(next: HarnessState): void {
    if (!this.canTransition(next)) {
      throw new Error(`invalid state transition: ${this.#state} -> ${next}`);
    }
    this.#state = next;
  }

  terminate(uncertain: boolean): void {
    if (this.isTerminal) return;
    this.#state = uncertain ? "TERMINAL_UNCERTAIN" : "TERMINAL";
  }
}

export function allowedTransitionsFrom(state: HarnessState): readonly HarnessState[] {
  return ALLOWED_TRANSITIONS[state];
}
