export type WorkspaceDomain = "general" | "military_transition" | "sotf_fellowship" | "job_search" | "life" | "leadership";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type JobApplicationStatus = "researching" | "applied" | "phone_screen" | "interview" | "offer" | "rejected" | "withdrawn";
export type OnboardingState = "setup_method_required" | "ai_setup_selected" | "mcp_connection_required" | "mcp_connected" | "onboarding_in_progress" | "onboarding_complete" | "workspace_ready";
export type SetupMethod = "ai" | "native";
export type AssistantProvider = "chatgpt" | "claude";
export type ConfigurationArea = "responsibilities" | "areas_of_attention" | "priorities" | "commitments" | "value_focus" | "existing_systems" | "assistant_posture" | "review_rhythm" | "starting_capabilities" | "daily_brief" | "integration_recommendations";
export type EpistemicStatus = "user_reported" | "ai_suggested" | "user_confirmed" | "validated_configuration";

export type WorkspaceRecord = {
  id: string;
  name: string;
  workspace_type: "personal" | "organization";
  owner_user_id: string;
};

export type TaskRecord = {
  id: string;
  workspace_id: string;
  domain: WorkspaceDomain;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type CaptureRecord = {
  id: string;
  workspace_id: string;
  raw_text: string;
  status: "unprocessed" | "processed" | "discarded";
  routed_task_id: string | null;
  created_at: string;
};

export type JobApplicationRecord = {
  id: string;
  workspace_id: string;
  company: string;
  role: string;
  status: JobApplicationStatus;
  applied_date: string | null;
  contact_name: string | null;
  contact_notes: string | null;
  next_follow_up_date: string | null;
  compensation_notes: string | null;
  job_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryRecord = {
  id: string;
  workspace_id: string;
  memory_type: "fact" | "preference" | "context" | "relationship";
  content: string;
  domain: WorkspaceDomain | null;
  created_at: string;
};

import type { IntegrationProviderId } from "@/lib/integrations/providers";

export type IntegrationConnection = {
  id: string;
  provider: IntegrationProviderId;
  status: "reconnect_required" | "connected" | "disconnected" | "error";
  connected_account_label: string | null;
  scopes: string[];
  last_success_at: string | null;
  last_error_code: string | null;
};

export type UserProfileRecord = {
  user_id: string;
  timezone: string;
  clock_timezones: string[];
};

export type PersonalPlanRecord = {
  workspace_id: string;
  user_id: string;
  plan_key: string;
  status: "active" | "suspended";
  trial_started_at: string | null;
  trial_ends_at: string | null;
  conversion_state: string | null;
};

export type PlanCapabilityRecord = {
  capability_key: string;
  enabled: boolean;
  limit_value: number | null;
};

export type OnboardingRecord = {
  workspace_id: string;
  user_id: string;
  state: OnboardingState;
  setup_method: SetupMethod | null;
  selected_assistant: AssistantProvider | null;
  completed_areas: ConfigurationArea[];
  started_at: string | null;
  completed_at: string | null;
  last_resumed_at: string | null;
};

export type ConfigurationItem = {
  id: string;
  workspace_id: string;
  area: ConfigurationArea;
  content: { text?: string; values?: string[]; enabled?: boolean; cadence?: string; time?: string; [key: string]: unknown };
  epistemic_status: EpistemicStatus;
  source_interface: AssistantProvider | "native" | "system";
  active: boolean;
  confirmed_at: string | null;
  updated_at: string;
};

export type McpAuthorizationRecord = {
  id: string;
  workspace_id: string;
  client_id: string;
  assistant_provider: AssistantProvider | "other";
  status: "connecting" | "connected" | "reconnect_required" | "error" | "disconnected" | "disabled" | "not_included";
  granted_scopes: string[];
  connected_at: string | null;
  disconnected_at: string | null;
  last_verified_at: string | null;
  last_error_code: string | null;
};

export type DailyBriefingRecord = {
  id: string;
  workspace_id: string;
  briefing_date: string;
  items: unknown;
  generated_at: string;
  created_at: string;
};

export type WorkspaceAuditEvent = {
  id: string;
  workspace_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const DOMAIN_LABELS: Record<WorkspaceDomain, string> = {
  general: "General",
  military_transition: "Military transition",
  sotf_fellowship: "SOTF fellowship",
  job_search: "Job search",
  life: "Life",
  leadership: "Leadership"
};
