import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/v4";

const setupArea = z.enum([
  "responsibilities", "areas_of_attention", "priorities", "commitments", "value_focus",
  "existing_systems", "assistant_posture", "review_rhythm", "starting_capabilities",
  "daily_brief", "integration_recommendations"
]);

const taskDomain = z.enum(["general", "military_transition", "sotf_fellowship", "job_search", "life", "leadership"]);
const taskStatus = z.enum(["todo", "in_progress", "blocked", "done"]);
const taskPriority = z.enum(["critical", "high", "medium", "low"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.");

export function createWorkspaceMcpServer(supabase: SupabaseClient<any, any, any, any, any>) {
  const server = new McpServer({ name: "lewis", version: "1.1.0" });

  server.registerTool("get_onboarding_state", {
    title: "Get onboarding state",
    description: "Determine whether this Personal Workspace is new, incomplete, or ready, and identify the next useful setup area. Continue existing progress instead of restarting.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_get_onboarding_state"));

  server.registerTool("get_workspace_setup", {
    title: "Get confirmed Workspace setup",
    description: "Read the user's current reported, suggested, and confirmed Personal configuration. Preserve epistemic status and never present AI-suggested material as confirmed truth.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_get_workspace_setup"));

  server.registerTool("save_user_reported_setup", {
    title: "Save user-reported setup",
    description: "Save a concise statement the user explicitly reported in the current conversation. This records the statement as user-reported, not as an AI interpretation.",
    inputSchema: { area: setupArea, reported_text: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ area, reported_text }) => rpcResult(supabase, "mcp_save_user_reported_setup", { target_area: area, reported_text }));

  server.registerTool("suggest_workspace_configuration", {
    title: "Suggest Workspace configuration",
    description: "Store a concise AI interpretation as a suggestion awaiting user confirmation. Tell the user what you inferred and ask for confirmation before using the confirmation tool.",
    inputSchema: { area: setupArea, suggestion_text: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ area, suggestion_text }) => rpcResult(supabase, "mcp_suggest_workspace_configuration", { target_area: area, suggestion_text }));

  server.registerTool("confirm_workspace_configuration", {
    title: "Confirm Workspace configuration",
    description: "Mark specific reported or suggested items as user-confirmed only after the user explicitly confirms the interpretation in the current conversation.",
    inputSchema: { item_ids: z.array(z.uuid()).min(1).max(20), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ item_ids }) => rpcResult(supabase, "mcp_confirm_workspace_configuration", { item_ids }));

  server.registerTool("complete_onboarding", {
    title: "Complete onboarding",
    description: "Complete Personal onboarding after at least three meaningful setup areas are user-confirmed. Do not call while important interpretations still need confirmation.",
    inputSchema: { user_confirmed_completion: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_complete_onboarding"));

  server.registerTool("get_leadership_state", {
    title: "Get leadership state",
    description: "Read confirmed configuration, open tasks, and open commitments after onboarding so the assistant can help the user notice, choose, act, and learn.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_get_leadership_state"));

  server.registerTool("capture_signal", {
    title: "Capture a signal",
    description: "Create a private Quick Capture after onboarding when the user explicitly asks to remember or capture something. Do not infer consent from ordinary conversation.",
    inputSchema: { capture_text: z.string().trim().min(1).max(10000), user_requested_capture: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ capture_text }) => rpcResult(supabase, "mcp_capture_signal", { capture_text }));

  server.registerTool("list_tasks", {
    title: "List tasks",
    description: "Read Personal Workspace tasks after onboarding. Optionally filter by status or domain, and include completed tasks when useful.",
    inputSchema: {
      status: taskStatus.optional(),
      domain: taskDomain.optional(),
      include_done: z.boolean().optional()
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ status, domain, include_done }) => rpcResult(supabase, "mcp_list_tasks", {
    target_status: status ?? null,
    target_domain: domain ?? null,
    include_done: include_done ?? false
  }));

  server.registerTool("create_task", {
    title: "Create task",
    description: "Create a task in the user's Personal Workspace when the user explicitly asks to add, save, track, or remember an actionable task.",
    inputSchema: {
      title: z.string().trim().min(1).max(240),
      description: z.string().trim().max(10000).nullable().optional(),
      domain: taskDomain.optional(),
      priority: taskPriority.optional(),
      due_date: isoDate.nullable().optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ title, description, domain, priority, due_date }) => rpcResult(supabase, "mcp_create_task", {
    task_title: title,
    task_description: description ?? null,
    task_domain: domain ?? "general",
    task_priority: priority ?? "medium",
    task_due_date: due_date ?? null
  }));

  server.registerTool("update_task", {
    title: "Update task",
    description: "Update an existing Personal Workspace task. Only change fields the user asked to change; a null description or due date clears that field.",
    inputSchema: {
      task_id: z.uuid(),
      title: z.string().trim().min(1).max(240).optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      domain: taskDomain.optional(),
      status: taskStatus.optional(),
      priority: taskPriority.optional(),
      due_date: isoDate.nullable().optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ task_id, title, description, domain, status, priority, due_date }) => {
    const taskPatch: Record<string, unknown> = {};
    if (title !== undefined) taskPatch.title = title;
    if (description !== undefined) taskPatch.description = description;
    if (domain !== undefined) taskPatch.domain = domain;
    if (status !== undefined) taskPatch.status = status;
    if (priority !== undefined) taskPatch.priority = priority;
    if (due_date !== undefined) taskPatch.due_date = due_date;
    return rpcResult(supabase, "mcp_update_task", { target_task_id: task_id, task_patch: taskPatch });
  });

  server.registerTool("delete_task", {
    title: "Delete task",
    description: "Permanently delete a Personal Workspace task only when the user explicitly asks to delete or remove that task.",
    inputSchema: { task_id: z.uuid(), user_confirmed_delete: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ task_id }) => rpcResult(supabase, "mcp_delete_task", { target_task_id: task_id }));

  server.registerPrompt("lead_emergence_onboarding", {
    title: "Lead Emergence Personal onboarding",
    description: "A conversational onboarding posture that asks one useful question at a time and confirms interpretations before storing them as configuration."
  }, async () => ({ messages: [{ role: "user", content: { type: "text", text: "Continue my Lead Emergence Workspace setup. First check my onboarding state and existing setup. Ask one useful question at a time, adapt to my answers, allow me to skip or say I don't know, and confirm meaningful interpretations before storing them as configuration." } }] }));

  return server;
}

async function rpcResult(supabase: SupabaseClient<any, any, any, any, any>, name: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    return { isError: true, content: [{ type: "text" as const, text: safeToolError(error.code) }] };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data && typeof data === "object" ? data as Record<string, unknown> : { result: data } };
}

function safeToolError(code?: string) {
  if (code === "42501") return "Workspace denied this operation because the connection, plan capability, onboarding state, or Personal authorization is not active.";
  if (code === "22023" || code === "22P02" || code === "22007") return "Workspace rejected the input. Check the task or setup values, then try again.";
  return "Workspace could not complete this tool call safely. No private data was returned.";
}
