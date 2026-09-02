export type ImprovementSignalKind =
  | "context_gap"
  | "user_edit"
  | "workflow_friction"
  | "repeated_sequence"
  | "external_idea";

export type ImprovementSignal = {
  id: string;
  kind: ImprovementSignalKind;
  summary: string;
  occurrences: number;
  evidence: string[];
  sensitive?: boolean;
};

export type ImprovementProposalType =
  | "context_update"
  | "preference_update"
  | "workflow_change"
  | "new_skill"
  | "idea_experiment";

export type ImprovementProposal = {
  type: ImprovementProposalType;
  title: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  sourceSignalIds: string[];
  requiresApproval: true;
};

export function proposeSelfImprovements(signals: ImprovementSignal[]): ImprovementProposal[] {
  return signals.flatMap((signal) => {
    if (signal.sensitive) return [];

    if (signal.kind === "context_gap") {
      return [proposal("context_update", "Fill a recurring context gap", signal, signal.occurrences >= 2 ? "high" : "medium", "Recent work exposed context the system did not know. Save a confirmed definition or fact so the same gap does not recur.")];
    }

    if (signal.kind === "user_edit" && signal.occurrences >= 2) {
      return [proposal("preference_update", "Learn from repeated user edits", signal, signal.occurrences >= 4 ? "high" : "medium", "The user repeatedly changed similar AI output. Compare the edits and propose a durable writing or working preference.")];
    }

    if (signal.kind === "workflow_friction" && signal.occurrences >= 2) {
      return [proposal("workflow_change", "Reduce recurring workflow friction", signal, signal.occurrences >= 4 ? "high" : "medium", "The same workflow required repeated correction or extra steps. Propose a concrete workflow adjustment instead of accepting the friction as normal.")];
    }

    if (signal.kind === "repeated_sequence" && signal.occurrences >= 3) {
      return [proposal("new_skill", "Turn repeated work into a reusable skill", signal, signal.occurrences >= 5 ? "high" : "medium", "The user repeatedly performed the same sequence. Propose packaging it as a reusable skill or workflow.")];
    }

    if (signal.kind === "external_idea") {
      return [proposal("idea_experiment", "Evaluate a new AI idea before adopting it", signal, "low", "Compare the idea with the existing system, identify overlap and expected value, and recommend a small experiment rather than adopting hype by default.")];
    }

    return [];
  });
}

function proposal(type: ImprovementProposalType, title: string, signal: ImprovementSignal, confidence: ImprovementProposal["confidence"], rationale: string): ImprovementProposal {
  return {
    type,
    title,
    rationale,
    confidence,
    sourceSignalIds: [signal.id],
    requiresApproval: true
  };
}
