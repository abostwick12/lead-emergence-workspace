import { describe, expect, it } from "vitest";
import { SOTF_AI_NATIVE_PATHWAY, nextAiNativeStage } from "@/lib/workspace/ai-native";
import { WORKSPACE_BUNDLES, bundleIncludesWorkflow, resolveBundleWorkflowKeys } from "@/lib/workspace/bundles";
import { buildDailyRhythmPlan, evaluateContextCandidate } from "@/lib/workspace/rhythm";
import { proposeSelfImprovements } from "@/lib/workspace/self-improvement";

describe("Personal OS bundles", () => {
  it("keeps the required SOTF Bundle user-facing label", () => {
    expect(WORKSPACE_BUNDLES.sotf_transition.label).toBe("SOTF Bundle");
  });

  it("lets the internal SOTF bundle inherit the persistent core workflows", () => {
    const workflows = resolveBundleWorkflowKeys(["sotf_transition"]);
    expect(workflows).toContain("daily_rhythm");
    expect(workflows).toContain("weekly_review");
    expect(workflows).toContain("coaching_reinforcement");
    expect(workflows).toContain("interview_lab");
    expect(workflows).toContain("context_gap_learning");
    expect(workflows).toContain("edit_learning");
    expect(workflows).toContain("friction_review");
    expect(workflows).toContain("skill_discovery");
    expect(workflows).toContain("improve_filter");
    expect(workflows).toContain("ai_native_progression");
  });

  it("keeps professional work on the same core harness instead of creating a separate product", () => {
    expect(bundleIncludesWorkflow(["professional_work"], "self_improvement_review")).toBe(true);
    expect(bundleIncludesWorkflow(["professional_work"], "stakeholder_context")).toBe(true);
    expect(bundleIncludesWorkflow(["professional_work"], "interview_lab")).toBe(false);
  });
});

describe("SOTF Bundle AI-native pathway", () => {
  it("walks from assisted use to a controlled self-improving operating system", () => {
    expect(SOTF_AI_NATIVE_PATHWAY.map((stage) => stage.id)).toEqual([
      "assisted",
      "context_aware",
      "workflow_native",
      "proactive",
      "self_improving"
    ]);
    expect(nextAiNativeStage("assisted")?.id).toBe("context_aware");
    expect(nextAiNativeStage("proactive")?.id).toBe("self_improving");
    expect(nextAiNativeStage("self_improving")).toBeNull();
  });

  it("keeps every progression stage focused on user capability, not AI novelty", () => {
    for (const stage of SOTF_AI_NATIVE_PATHWAY) {
      expect(stage.userGoal.length).toBeGreaterThan(20);
      expect(stage.readinessSignals.length).toBeGreaterThan(0);
    }
  });
});

describe("Context promotion guardrails", () => {
  it("never silently promotes durable inferred context", () => {
    expect(evaluateContextCandidate({
      content: "The user appears to prefer concise networking messages.",
      scope: "career",
      durable: true,
      userConfirmed: false,
      sensitive: false,
      sourceType: "assistant"
    })).toEqual({
      action: "review_required",
      tier: null,
      reason: "Durable memory is proposed, not silently inferred; user confirmation is required before promotion."
    });
  });

  it("keeps temporary context in working memory", () => {
    const decision = evaluateContextCandidate({
      content: "Interview is Wednesday afternoon.",
      scope: "temporary",
      durable: false,
      userConfirmed: true,
      sensitive: false,
      sourceType: "calendar"
    });
    expect(decision.action).toBe("keep_working");
    expect(decision.tier).toBe("working");
  });

  it("requires review before sensitive context can enter durable memory", () => {
    const decision = evaluateContextCandidate({
      content: "Sensitive private context",
      scope: "career",
      durable: true,
      userConfirmed: true,
      sensitive: true,
      sourceType: "user"
    });
    expect(decision.action).toBe("review_required");
    expect(decision.tier).toBeNull();
  });

  it("promotes confirmed career-level context to core memory", () => {
    const decision = evaluateContextCandidate({
      content: "Prefer three prioritized actions in the morning brief.",
      scope: "career",
      durable: true,
      userConfirmed: true,
      sensitive: false,
      sourceType: "user"
    });
    expect(decision.action).toBe("promote");
    expect(decision.tier).toBe("core");
  });

  it("refuses durable retention for do-not-retain and suspected controlled military context", () => {
    const transient = evaluateContextCandidate({
      content: "Use this only to answer the immediate question.",
      scope: "temporary",
      durable: false,
      userConfirmed: true,
      sensitive: false,
      retention: "do_not_retain",
      sourceType: "user"
    });
    const controlled = evaluateContextCandidate({
      content: "Potentially controlled operational detail.",
      scope: "career",
      durable: true,
      userConfirmed: true,
      sensitive: true,
      militarySensitivity: "suspected_cui",
      sourceType: "user"
    });

    expect(transient).toMatchObject({ action: "do_not_retain", tier: null });
    expect(controlled).toMatchObject({ action: "do_not_retain", tier: null });
  });
});

describe("Daily rhythm planning", () => {
  it("marks connected sources ready while preserving connection requirements for unavailable sources", () => {
    const plan = buildDailyRhythmPlan(["gmail", "google_calendar"]);
    expect(plan.morning.find((step) => step.id === "email-triage")?.status).toBe("ready");
    expect(plan.morning.find((step) => step.id === "calendar-prep")?.status).toBe("ready");
    expect(plan.morning.find((step) => step.id === "slack-context")?.status).toBe("connection_required");
  });

  it("keeps self-improvement changes in review instead of autonomous instruction mutation", () => {
    const plan = buildDailyRhythmPlan([]);
    expect(plan.continuous.find((step) => step.id === "context-gap-learning")?.status).toBe("review");
    expect(plan.weekly.find((step) => step.id === "edit-learning")?.status).toBe("review");
    expect(plan.weekly.find((step) => step.id === "friction-review")?.status).toBe("review");
    expect(plan.weekly.find((step) => step.id === "skill-discovery")?.status).toBe("review");
    expect(plan.weekly.find((step) => step.id === "improve-filter")?.status).toBe("review");
    expect(plan.weekly.find((step) => step.id === "self-improvement")?.status).toBe("review");
  });
});

describe("Self-improvement proposals", () => {
  it("learns from repeated edits without changing instructions automatically", () => {
    const proposals = proposeSelfImprovements([{ id: "edit-1", kind: "user_edit", summary: "User repeatedly shortens networking drafts.", occurrences: 3, evidence: ["draft-a", "draft-b"] }]);
    expect(proposals[0]?.type).toBe("preference_update");
    expect(proposals[0]?.requiresApproval).toBe(true);
  });

  it("suggests a new skill only after repeated work", () => {
    expect(proposeSelfImprovements([{ id: "sequence-1", kind: "repeated_sequence", summary: "Research role then prepare contact outreach.", occurrences: 2, evidence: [] }])).toHaveLength(0);
    expect(proposeSelfImprovements([{ id: "sequence-1", kind: "repeated_sequence", summary: "Research role then prepare contact outreach.", occurrences: 3, evidence: [] }])[0]?.type).toBe("new_skill");
  });

  it("does not turn sensitive evidence into an automatic improvement proposal", () => {
    expect(proposeSelfImprovements([{ id: "sensitive-1", kind: "context_gap", summary: "Sensitive context", occurrences: 2, evidence: [], sensitive: true }])).toEqual([]);
  });
});
