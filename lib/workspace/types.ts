export type WorkspaceDomain = "general" | "military_transition" | "sotf_fellowship" | "job_search" | "life" | "leadership";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type JobApplicationStatus = "researching" | "applied" | "phone_screen" | "interview" | "offer" | "rejected" | "withdrawn";

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

export type IntegrationConnection = {
  id: string;
  provider: "google_calendar" | "gmail" | "google_drive" | "slack" | "firecrawl" | "monday" | "linkedin";
  status: "reconnect_required" | "connected" | "disconnected" | "error";
  connected_account_label: string | null;
  scopes: string[];
  last_success_at: string | null;
  last_error_code: string | null;
};

export const DOMAIN_LABELS: Record<WorkspaceDomain, string> = {
  general: "General",
  military_transition: "Military transition",
  sotf_fellowship: "SOTF fellowship",
  job_search: "Job search",
  life: "Life",
  leadership: "Leadership"
};
