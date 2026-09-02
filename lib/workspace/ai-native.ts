export type AiNativeStageId = "assisted" | "context_aware" | "workflow_native" | "proactive" | "self_improving";

export type AiNativeStage = {
  id: AiNativeStageId;
  label: string;
  userGoal: string;
  systemBehavior: string;
  readinessSignals: string[];
};

export const SOTF_AI_NATIVE_PATHWAY: AiNativeStage[] = [
  {
    id: "assisted",
    label: "AI-assisted",
    userGoal: "Delegate useful preparation and drafting without needing advanced prompting.",
    systemBehavior: "Lewis helps with briefs, drafts, research, coaching follow-through, and meeting preparation while the user stays in control.",
    readinessSignals: ["uses daily brief", "uses drafts or research", "completes at least one guided SOTF workflow"]
  },
  {
    id: "context_aware",
    label: "Context-aware",
    userGoal: "Build enough confirmed context that the user no longer has to restate their transition every time.",
    systemBehavior: "Lewis retrieves approved goals, relationships, coaching guidance, stories, opportunities, and preferences before acting.",
    readinessSignals: ["core profile populated", "durable context confirmed", "relationship and opportunity context linked"]
  },
  {
    id: "workflow_native",
    label: "Workflow-native",
    userGoal: "Operate through reusable skills instead of writing one-off prompts.",
    systemBehavior: "Lewis runs repeatable SOTF workflows such as coaching prep, opportunity research, networking prep, interview practice, and weekly review.",
    readinessSignals: ["uses multiple reusable workflows", "repeats at least one workflow", "workflow outputs update shared Workspace state"]
  },
  {
    id: "proactive",
    label: "Proactive",
    userGoal: "Let the Workspace stay current and surface what deserves attention before the user asks from scratch.",
    systemBehavior: "Approved connectors and scheduled rhythms feed email, calendar, Slack, meeting notes, tasks, and opportunities into a daily operating picture.",
    readinessSignals: ["daily rhythm active", "at least one external context source connected", "end-of-day or weekly reconciliation in use"]
  },
  {
    id: "self_improving",
    label: "Self-improving",
    userGoal: "Teach the system how the user works so it gets more useful over time.",
    systemBehavior: "Lewis detects context gaps, repeated edits, workflow friction, and repeated sequences, then proposes evidence-backed improvements for approval.",
    readinessSignals: ["self-improvement review active", "at least one approved improvement proposal", "provenance retained for durable changes"]
  }
];

export function getAiNativeStage(stageId: AiNativeStageId): AiNativeStage {
  return SOTF_AI_NATIVE_PATHWAY.find((stage) => stage.id === stageId) ?? SOTF_AI_NATIVE_PATHWAY[0];
}

export function nextAiNativeStage(stageId: AiNativeStageId): AiNativeStage | null {
  const index = SOTF_AI_NATIVE_PATHWAY.findIndex((stage) => stage.id === stageId);
  if (index < 0 || index === SOTF_AI_NATIVE_PATHWAY.length - 1) return null;
  return SOTF_AI_NATIVE_PATHWAY[index + 1];
}
