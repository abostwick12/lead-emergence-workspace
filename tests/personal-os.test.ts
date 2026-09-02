import { describe, expect, it } from "vitest";
import { bundleIncludesWorkflow, resolveBundleWorkflowKeys } from "@/lib/workspace/bundles";
import { buildDailyRhythmPlan, evaluateContextCandidate } from "@/lib/workspace/rhythm";

describe("Personal OS bundles", () => {
  it("lets the SOTF transition bundle inherit the persistent core workflows", () => {
    const workflows = resolveBundleWorkflowKeys(["sotf_transition"]);
    expect(workflows).toContain("daily_rhythm");
    expect(workflows).toContain("weekly_review");
    expect(workflows).toContain("coaching_reinforcement");
    expect(workflows).toContain("interview_lab");
  });

  it("keeps professional work on the same core harness instead of creating a separate product", () => {
    expect(bundleIncludesWorkflow(["professional_work"], "self_improvement_review")).toBe(true);
    expect(bundleIncludesWorkflow(["professional_work"], "stakeholder_context")).toBe(true);
    expect(bundleIncludesWorkflow(["professional_work"], "interview_lab")).toBe(false);
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
    expect(plan.weekly.find((step) => step.id === "self-improvement")?.status).toBe("review");
  });
});
