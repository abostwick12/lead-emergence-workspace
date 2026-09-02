export type WorkspaceBundleId = "core" | "sotf_transition" | "professional_work";

export type WorkspaceWorkflowKey =
  | "daily_rhythm"
  | "weekly_review"
  | "context_promotion"
  | "self_improvement_review"
  | "meeting_prep"
  | "decision_support"
  | "relationship_follow_up"
  | "transition_roadmap"
  | "coaching_reinforcement"
  | "job_intelligence"
  | "networking_copilot"
  | "interview_lab"
  | "application_quality_gate"
  | "career_hypothesis_review"
  | "project_context"
  | "stakeholder_context"
  | "accomplishment_capture"
  | "performance_review";

export type WorkspaceBundle = {
  id: WorkspaceBundleId;
  label: string;
  description: string;
  inherits: WorkspaceBundleId[];
  workflows: WorkspaceWorkflowKey[];
  memoryFocus: string[];
};

export const WORKSPACE_BUNDLES: Record<WorkspaceBundleId, WorkspaceBundle> = {
  core: {
    id: "core",
    label: "Lead Emergence Core",
    description: "Persistent personal operating context that stays useful across transitions, roles, and projects.",
    inherits: [],
    workflows: [
      "daily_rhythm",
      "weekly_review",
      "context_promotion",
      "self_improvement_review",
      "meeting_prep",
      "decision_support",
      "relationship_follow_up"
    ],
    memoryFocus: ["identity", "goals", "relationships", "decisions", "commitments", "learning", "work_patterns", "preferences"]
  },
  sotf_transition: {
    id: "sotf_transition",
    label: "SOTF Transition",
    description: "Transition-specific workflows that reinforce fellowship coaching and execution without replacing the human fellow.",
    inherits: ["core"],
    workflows: [
      "transition_roadmap",
      "coaching_reinforcement",
      "job_intelligence",
      "networking_copilot",
      "interview_lab",
      "application_quality_gate",
      "career_hypothesis_review"
    ],
    memoryFocus: ["career_direction", "career_hypotheses", "coaching", "opportunities", "network", "story_bank", "interview_learning"]
  },
  professional_work: {
    id: "professional_work",
    label: "Professional Work",
    description: "Workplace operating workflows that continue using the same person-level context after transition.",
    inherits: ["core"],
    workflows: ["project_context", "stakeholder_context", "accomplishment_capture", "performance_review"],
    memoryFocus: ["projects", "stakeholders", "responsibilities", "outcomes", "accomplishments", "feedback", "professional_learning"]
  }
};

export function resolveBundleWorkflowKeys(bundleIds: WorkspaceBundleId[]): WorkspaceWorkflowKey[] {
  const resolved = new Set<WorkspaceWorkflowKey>();
  const visited = new Set<WorkspaceBundleId>();

  const visit = (bundleId: WorkspaceBundleId) => {
    if (visited.has(bundleId)) return;
    visited.add(bundleId);
    const bundle = WORKSPACE_BUNDLES[bundleId];
    bundle.inherits.forEach(visit);
    bundle.workflows.forEach((workflow) => resolved.add(workflow));
  };

  bundleIds.forEach(visit);
  return [...resolved];
}

export function bundleIncludesWorkflow(bundleIds: WorkspaceBundleId[], workflow: WorkspaceWorkflowKey): boolean {
  return resolveBundleWorkflowKeys(bundleIds).includes(workflow);
}
