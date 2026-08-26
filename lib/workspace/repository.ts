"use client";

import { getWorkspaceClient } from "@/lib/supabase/client";
import type {
  CaptureRecord,
  DailyBriefingRecord,
  IntegrationConnection,
  JobApplicationRecord,
  JobApplicationStatus,
  MemoryRecord,
  McpAuthorizationRecord,
  OnboardingRecord,
  PersonalPlanRecord,
  PlanCapabilityRecord,
  ConfigurationArea,
  ConfigurationItem,
  AssistantProvider,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkspaceAuditEvent,
  WorkspaceDomain,
  UserProfileRecord
} from "@/lib/workspace/types";
import { normalizeClockTimeZones, type ClockTimeZones } from "@/lib/workspace/timezones";

function required<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workspace record was not returned.");
  return data;
}

export async function listTasks(workspaceId: string): Promise<TaskRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("tasks")
    .select("id, workspace_id, domain, title, description, status, priority, due_date, tags, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRecord[];
}

export async function createTask(input: {
  workspaceId: string;
  userId: string;
  title: string;
  domain: WorkspaceDomain;
  priority?: TaskPriority;
  dueDate?: string | null;
  description?: string | null;
}): Promise<TaskRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("tasks")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title: input.title.trim(),
      domain: input.domain,
      priority: input.priority ?? "medium",
      due_date: input.dueDate || null,
      description: input.description?.trim() || null
    })
    .select("id, workspace_id, domain, title, description, status, priority, due_date, tags, created_at, updated_at")
    .single();
  return required(data as TaskRecord | null, error);
}

export async function updateTask(id: string, patch: { status?: TaskStatus; priority?: TaskPriority; due_date?: string | null }): Promise<TaskRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("id, workspace_id, domain, title, description, status, priority, due_date, tags, created_at, updated_at")
    .single();
  return required(data as TaskRecord | null, error);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getWorkspaceClient().from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCaptures(workspaceId: string): Promise<CaptureRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("capture_inbox")
    .select("id, workspace_id, raw_text, status, routed_task_id, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CaptureRecord[];
}

export async function createCapture(workspaceId: string, userId: string, rawText: string): Promise<CaptureRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("capture_inbox")
    .insert({ workspace_id: workspaceId, created_by: userId, raw_text: rawText.trim() })
    .select("id, workspace_id, raw_text, status, routed_task_id, created_at")
    .single();
  return required(data as CaptureRecord | null, error);
}

export async function resolveCapture(input: {
  captureId: string;
  workspaceId: string;
  userId: string;
  rawText: string;
  domain: WorkspaceDomain;
}): Promise<void> {
  const task = await createTask({
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: input.rawText,
    domain: input.domain
  });
  const { error } = await getWorkspaceClient()
    .from("capture_inbox")
    .update({ status: "processed", routed_task_id: task.id })
    .eq("id", input.captureId);
  if (error) throw new Error(error.message);
}

export async function dismissCapture(captureId: string): Promise<void> {
  const { error } = await getWorkspaceClient().from("capture_inbox").update({ status: "discarded" }).eq("id", captureId);
  if (error) throw new Error(error.message);
}

export async function listJobApplications(workspaceId: string): Promise<JobApplicationRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("job_applications")
    .select("id, workspace_id, company, role, status, applied_date, contact_name, contact_notes, next_follow_up_date, compensation_notes, job_url, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobApplicationRecord[];
}

export async function createJobApplication(input: {
  workspaceId: string;
  userId: string;
  company: string;
  role: string;
  status?: JobApplicationStatus;
  nextFollowUpDate?: string | null;
}): Promise<JobApplicationRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("job_applications")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      company: input.company.trim(),
      role: input.role.trim(),
      status: input.status ?? "researching",
      next_follow_up_date: input.nextFollowUpDate || null
    })
    .select("id, workspace_id, company, role, status, applied_date, contact_name, contact_notes, next_follow_up_date, compensation_notes, job_url, created_at, updated_at")
    .single();
  return required(data as JobApplicationRecord | null, error);
}

export async function updateJobApplication(id: string, status: JobApplicationStatus): Promise<JobApplicationRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("job_applications")
    .update({ status })
    .eq("id", id)
    .select("id, workspace_id, company, role, status, applied_date, contact_name, contact_notes, next_follow_up_date, compensation_notes, job_url, created_at, updated_at")
    .single();
  return required(data as JobApplicationRecord | null, error);
}

export async function listMemory(workspaceId: string): Promise<MemoryRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("memory_entries")
    .select("id, workspace_id, memory_type, content, domain, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemoryRecord[];
}

export async function createMemory(input: {
  workspaceId: string;
  userId: string;
  memoryType: MemoryRecord["memory_type"];
  content: string;
  domain?: WorkspaceDomain;
}): Promise<MemoryRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("memory_entries")
    .insert({ workspace_id: input.workspaceId, created_by: input.userId, memory_type: input.memoryType, content: input.content.trim(), domain: input.domain ?? null })
    .select("id, workspace_id, memory_type, content, domain, created_at")
    .single();
  return required(data as MemoryRecord | null, error);
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await getWorkspaceClient().from("memory_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listIntegrationConnections(workspaceId: string): Promise<IntegrationConnection[]> {
  const { data, error } = await getWorkspaceClient()
    .from("integration_connections")
    .select("id, provider, status, connected_account_label, scopes, last_success_at, last_error_code")
    .eq("workspace_id", workspaceId)
    .order("provider");
  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationConnection[];
}

export async function getClockTimeZones(userId: string): Promise<ClockTimeZones> {
  const { data, error } = await getWorkspaceClient()
    .from("user_profiles")
    .select("user_id, timezone, clock_timezones")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeClockTimeZones((data as UserProfileRecord | null)?.clock_timezones);
}

export async function saveClockTimeZones(userId: string, clockTimeZones: ClockTimeZones): Promise<ClockTimeZones> {
  const { data: updated, error: updateError } = await getWorkspaceClient()
    .from("user_profiles")
    .update({ clock_timezones: clockTimeZones })
    .eq("user_id", userId)
    .select("user_id, timezone, clock_timezones")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (updated) return normalizeClockTimeZones((updated as UserProfileRecord).clock_timezones);

  const { data: inserted, error: insertError } = await getWorkspaceClient()
    .from("user_profiles")
    .insert({ user_id: userId, clock_timezones: clockTimeZones })
    .select("user_id, timezone, clock_timezones")
    .single();
  return normalizeClockTimeZones(required(inserted as UserProfileRecord | null, insertError).clock_timezones);
}

export async function listDailyBriefings(workspaceId: string): Promise<DailyBriefingRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("daily_briefings")
    .select("id, workspace_id, briefing_date, items, generated_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("briefing_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyBriefingRecord[];
}

export async function listWorkspaceActivity(workspaceId: string): Promise<WorkspaceAuditEvent[]> {
  const { data, error } = await getWorkspaceClient()
    .from("audit_events")
    .select("id, workspace_id, event_type, entity_type, entity_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceAuditEvent[];
}

export async function countAiConversations(workspaceId: string): Promise<number> {
  const { count, error } = await getWorkspaceClient()
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getPersonalPlan(workspaceId: string): Promise<PersonalPlanRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("personal_plans")
    .select("workspace_id, user_id, plan_key, status, trial_started_at, trial_ends_at, conversion_state")
    .eq("workspace_id", workspaceId)
    .single();
  return required(data as PersonalPlanRecord | null, error);
}

export async function listPlanCapabilities(planKey: string): Promise<PlanCapabilityRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("plan_capabilities")
    .select("capability_key, enabled, limit_value")
    .eq("plan_key", planKey)
    .order("capability_key");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanCapabilityRecord[];
}

export async function getLeaderModeEntitlement(workspaceId: string): Promise<boolean> {
  const { data, error } = await getWorkspaceClient()
    .from("workspace_entitlements")
    .select("enabled, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("feature_key", "leader_mode")
    .maybeSingle<{ enabled: boolean; expires_at: string | null }>();
  if (error) throw new Error(error.message);
  return Boolean(data?.enabled && (!data.expires_at || new Date(data.expires_at).getTime() > Date.now()));
}

export async function getOnboarding(workspaceId: string): Promise<OnboardingRecord> {
  const { data, error } = await getWorkspaceClient()
    .from("personal_onboarding")
    .select("workspace_id, user_id, state, setup_method, selected_assistant, completed_areas, started_at, completed_at, last_resumed_at")
    .eq("workspace_id", workspaceId)
    .single();
  return required(data as OnboardingRecord | null, error);
}

export async function chooseSetupMethod(input: {
  workspaceId: string;
  userId: string;
  method: "ai" | "native";
  assistant?: AssistantProvider;
}): Promise<OnboardingRecord> {
  const { error } = await getWorkspaceClient().rpc("select_personal_setup_method", {
    target_method: input.method,
    target_assistant: input.method === "ai" ? input.assistant : null
  });
  if (error) throw new Error(error.message);
  return getOnboarding(input.workspaceId);
}

export async function prepareAssistantConnection(input: { workspaceId: string; userId: string; assistant: AssistantProvider }): Promise<OnboardingRecord> {
  const { error } = await getWorkspaceClient().rpc("prepare_personal_assistant_connection", {
    target_assistant: input.assistant
  });
  if (error) throw new Error(error.message);
  return getOnboarding(input.workspaceId);
}

export async function listConfiguration(workspaceId: string): Promise<ConfigurationItem[]> {
  const { data, error } = await getWorkspaceClient()
    .from("personal_configuration_items")
    .select("id, workspace_id, area, content, epistemic_status, source_interface, active, confirmed_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConfigurationItem[];
}

export async function saveNativeConfiguration(input: {
  workspaceId: string;
  userId: string;
  area: ConfigurationArea;
  content: ConfigurationItem["content"];
}): Promise<ConfigurationItem> {
  const supabase = getWorkspaceClient();
  const { error: deactivateError } = await supabase
    .from("personal_configuration_items")
    .update({ active: false })
    .eq("workspace_id", input.workspaceId)
    .eq("area", input.area)
    .eq("active", true);
  if (deactivateError) throw new Error(deactivateError.message);
  const { data, error } = await supabase
    .from("personal_configuration_items")
    .insert({
      workspace_id: input.workspaceId,
      area: input.area,
      content: input.content,
      epistemic_status: "user_confirmed",
      source_interface: "native",
      active: true,
      confirmed_at: new Date().toISOString(),
      created_by: input.userId
    })
    .select("id, workspace_id, area, content, epistemic_status, source_interface, active, confirmed_at, updated_at")
    .single();
  return required(data as ConfigurationItem | null, error);
}

export async function completePersonalOnboarding(): Promise<{ workspace_id: string; state: "workspace_ready"; confirmed_areas: number }> {
  const { data, error } = await getWorkspaceClient().rpc("complete_personal_onboarding");
  if (error) throw new Error(error.message);
  return data as { workspace_id: string; state: "workspace_ready"; confirmed_areas: number };
}

export async function listMcpAuthorizations(workspaceId: string): Promise<McpAuthorizationRecord[]> {
  const { data, error } = await getWorkspaceClient()
    .from("mcp_authorizations")
    .select("id, workspace_id, client_id, assistant_provider, status, granted_scopes, connected_at, disconnected_at, last_verified_at, last_error_code")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as McpAuthorizationRecord[];
}

export async function disconnectMcpAuthorization(clientId: string): Promise<void> {
  const supabase = getWorkspaceClient();
  const { error } = await supabase.rpc("disconnect_personal_mcp", { target_client_id: clientId });
  if (error) throw new Error(error.message);
  const revoke = await supabase.auth.oauth.revokeGrant({ clientId });
  if (revoke.error) throw new Error("Workspace access is disabled, but the provider grant could not be revoked. Try again from Privacy & Data.");
}

export async function trackProductEvent(
  workspaceId: string,
  userId: string,
  eventName: "onboarding_started" | "ai_setup_selected" | "native_setup_selected" | "mcp_connected" | "mcp_disconnected" | "onboarding_completed" | "workspace_configured" | "integration_connected" | "feature_locked_seen" | "plan_viewed" | "first_capture_created",
  eventContext: Record<string, string | boolean | number> = {}
): Promise<void> {
  const { error } = await getWorkspaceClient().from("product_events").insert({
    workspace_id: workspaceId,
    event_name: eventName,
    event_context: eventContext,
    created_by: userId
  });
  if (error) throw new Error(error.message);
}
