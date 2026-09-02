import type { IntegrationProviderId } from "@/lib/integrations/providers";

export type MemoryTier = "working" | "chapter" | "core";
export type ContextScope = "temporary" | "chapter" | "career";
export type PromotionAction = "keep_working" | "promote" | "review_required" | "archive_only";

export type ContextCandidate = {
  content: string;
  scope: ContextScope;
  durable: boolean;
  userConfirmed: boolean;
  sensitive: boolean;
  sourceType: "user" | "email" | "slack" | "calendar" | "meeting" | "document" | "assistant";
};

export type PromotionDecision = {
  action: PromotionAction;
  tier: MemoryTier | null;
  reason: string;
};

export type RhythmStepStatus = "ready" | "connection_required" | "review";

export type RhythmStep = {
  id: string;
  label: string;
  purpose: string;
  status: RhythmStepStatus;
  provider?: IntegrationProviderId;
};

export type DailyRhythmPlan = {
  morning: RhythmStep[];
  continuous: RhythmStep[];
  evening: RhythmStep[];
  weekly: RhythmStep[];
};

export function evaluateContextCandidate(candidate: ContextCandidate): PromotionDecision {
  if (candidate.sensitive) {
    return {
      action: "review_required",
      tier: null,
      reason: "Sensitive context must be explicitly reviewed before it can enter durable Workspace memory."
    };
  }

  if (!candidate.durable || candidate.scope === "temporary") {
    return {
      action: "keep_working",
      tier: "working",
      reason: "Temporary or short-lived context should remain in working context instead of durable memory."
    };
  }

  if (!candidate.userConfirmed) {
    return {
      action: "review_required",
      tier: null,
      reason: "Durable memory is proposed, not silently inferred; user confirmation is required before promotion."
    };
  }

  if (candidate.scope === "chapter") {
    return {
      action: "promote",
      tier: "chapter",
      reason: "Confirmed context is durable for the current chapter, such as transition, onboarding, or a major role."
    };
  }

  return {
    action: "promote",
    tier: "core",
    reason: "Confirmed career-level context can persist across transitions and professional roles."
  };
}

export function buildDailyRhythmPlan(connectedProviders: IntegrationProviderId[]): DailyRhythmPlan {
  const connected = new Set<IntegrationProviderId>(connectedProviders);
  const providerStep = (id: string, label: string, purpose: string, provider: IntegrationProviderId): RhythmStep => ({
    id,
    label,
    purpose,
    provider,
    status: connected.has(provider) ? "ready" : "connection_required"
  });

  return {
    morning: [
      providerStep("email-triage", "Email triage", "Identify messages requiring attention and prepare drafts without sending them automatically.", "gmail"),
      providerStep("slack-context", "Slack context", "Surface relevant messages, opportunities, commitments, and relationship changes without summarizing noise.", "slack"),
      providerStep("calendar-prep", "Calendar prep", "Review today and the near-term calendar and prepare context for consequential meetings.", "google_calendar"),
      {
        id: "daily-brief",
        label: "Daily brief",
        purpose: "Synthesize confirmed Workspace context into the few things that deserve attention today.",
        status: "ready"
      }
    ],
    continuous: [
      {
        id: "meeting-ingestion",
        label: "Meeting and coaching ingestion",
        purpose: "Extract decisions, commitments, relationships, assumptions, and learning from approved notes or transcripts.",
        status: "review"
      },
      {
        id: "context-gap-learning",
        label: "Context gap learning",
        purpose: "Notice unfamiliar terms, people, projects, or transition concepts and ask for confirmation before adding useful definitions to context.",
        status: "review"
      },
      {
        id: "context-promotion",
        label: "Context promotion",
        purpose: "Keep temporary information temporary and propose only durable, confirmed context for longer-term memory.",
        status: "review"
      }
    ],
    evening: [
      {
        id: "end-of-day",
        label: "End-of-day reconciliation",
        purpose: "Compare planned work with what actually changed, carry forward open commitments, and record meaningful learning.",
        status: "ready"
      }
    ],
    weekly: [
      {
        id: "weekly-review",
        label: "Weekly review",
        purpose: "Review goals, relationships, opportunities, commitments, and current hypotheses before setting the next week’s priorities.",
        status: "ready"
      },
      {
        id: "edit-learning",
        label: "Learn from your edits",
        purpose: "Compare repeated changes to drafts and recommendations, then propose durable voice, tone, or working preferences for approval.",
        status: "review"
      },
      {
        id: "friction-review",
        label: "Friction review",
        purpose: "Surface workflows that repeatedly require correction, extra steps, or manual cleanup and propose a specific fix.",
        status: "review"
      },
      {
        id: "skill-discovery",
        label: "Skill discovery",
        purpose: "Detect repeated sequences of work that may deserve a reusable skill or workflow and propose one instead of creating it silently.",
        status: "review"
      },
      {
        id: "improve-filter",
        label: "Improve filter",
        purpose: "Evaluate new AI tactics or tools against the current system, separate likely value from hype, and recommend a bounded experiment when warranted.",
        status: "review"
      },
      {
        id: "self-improvement",
        label: "Self-improvement review",
        purpose: "Combine context gaps, edits, friction, repeated work, and experiments into proposed system changes that always require user approval.",
        status: "review"
      }
    ]
  };
}
