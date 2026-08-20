"use client";

import { getWorkspaceClient } from "@/lib/supabase/client";
import type {
  CaptureRecord,
  IntegrationConnection,
  JobApplicationRecord,
  JobApplicationStatus,
  MemoryRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkspaceDomain
} from "@/lib/workspace/types";

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
