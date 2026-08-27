import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/v4";
import { workspaceMcpResourceUri } from "@/lib/workspace/mcp-auth";

const setupArea = z.enum([
  "responsibilities", "areas_of_attention", "priorities", "commitments", "value_focus",
  "existing_systems", "assistant_posture", "review_rhythm", "starting_capabilities",
  "daily_brief", "integration_recommendations"
]);

const workspaceDomain = z.enum(["general", "military_transition", "sotf_fellowship", "job_search", "life", "leadership"]);
const taskStatus = z.enum(["todo", "in_progress", "blocked", "done"]);
const taskPriority = z.enum(["critical", "high", "medium", "low"]);
const applicationStatus = z.enum(["researching", "applied", "phone_screen", "interview", "offer", "rejected", "withdrawn"]);
const memoryType = z.enum(["fact", "preference", "context", "relationship"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.");
const externalConnector = z.enum(["gmail", "slack", "google_calendar", "monday", "github", "linkedin", "google_drive", "firecrawl", "canva", "powerpoint", "youversion"]);

export function createWorkspaceMcpServer(supabase: SupabaseClient<any, any, any, any, any>) {
  const server = new McpServer({ name: "Lead Emergence Workspace", version: "1.0.0" });

  server.registerTool("get_onboarding_state", {
    title: "Get onboarding state",
    description: "Determine whether this Personal Workspace is new, incomplete, or ready, and identify the next useful setup area. Continue existing progress instead of restarting.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_get_onboarding_state"));

  server.registerTool("get_workspace_setup", {
    title: "Get confirmed Workspace setup",
    description: "Read the user's current reported, suggested, and confirmed Personal configuration. Preserve epistemic status and never present AI-suggested material as confirmed truth.",
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
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_get_leadership_state"));

  server.registerTool("capture_signal", {
    title: "Capture a signal",
    description: "Create a private Quick Capture after onboarding when the user explicitly asks to remember or capture something. Do not infer consent from ordinary conversation.",
    inputSchema: { capture_text: z.string().trim().min(1).max(10000), user_requested_capture: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ capture_text }) => rpcResult(supabase, "mcp_capture_signal", { capture_text }));

  server.registerTool("list_tasks", {
    title: "List Workspace tasks",
    description: "Read the user's private Workspace tasks, including completed items when useful for review.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_list_tasks"));

  server.registerTool("create_task", {
    title: "Create a Workspace task",
    description: "Create a private Workspace task only after the user explicitly confirms the exact title, domain, priority, description, and due date to save.",
    inputSchema: {
      title: z.string().trim().min(1).max(240),
      domain: workspaceDomain,
      priority: taskPriority.optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      due_date: isoDate.nullable().optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ title, domain, priority, description, due_date }) => rpcResult(supabase, "mcp_create_task", {
    task_title: title, task_domain: domain, task_priority: priority ?? "medium", task_description: description ?? null, task_due_date: due_date ?? null, user_confirmed: true
  }));

  server.registerTool("update_task", {
    title: "Update a Workspace task",
    description: "Update a task's status, priority, or due date only after the user explicitly confirms the exact change.",
    inputSchema: {
      task_id: z.uuid(),
      patch: z.object({ status: taskStatus.optional(), priority: taskPriority.optional(), due_date: isoDate.nullable().optional() }).refine((value) => Object.keys(value).length > 0, "Provide at least one task field to update."),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ task_id, patch }) => rpcResult(supabase, "mcp_update_task", { task_id, task_patch: patch, user_confirmed: true }));

  server.registerTool("delete_task", {
    title: "Delete a Workspace task",
    description: "Permanently delete one private task only after the user explicitly confirms the identified task should be removed.",
    inputSchema: { task_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ task_id }) => rpcResult(supabase, "mcp_delete_task", { task_id, user_confirmed: true }));

  server.registerTool("list_captures", {
    title: "List Quick Capture inbox",
    description: "Read the user's private Quick Capture inbox and its processing state.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_list_captures"));

  server.registerTool("resolve_capture_to_task", {
    title: "Turn a capture into a task",
    description: "Create a task from one unprocessed capture and mark the capture processed only after the user explicitly confirms the selected domain.",
    inputSchema: { capture_id: z.uuid(), domain: workspaceDomain, user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ capture_id, domain }) => rpcResult(supabase, "mcp_resolve_capture_to_task", { capture_id, task_domain: domain, user_confirmed: true }));

  server.registerTool("discard_capture", {
    title: "Discard a Quick Capture",
    description: "Mark one unprocessed Quick Capture as discarded only after the user explicitly confirms it should be discarded.",
    inputSchema: { capture_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ capture_id }) => rpcResult(supabase, "mcp_discard_capture", { capture_id, user_confirmed: true }));

  server.registerTool("list_job_applications", {
    title: "List career opportunities",
    description: "Read the user's private Career Pipeline opportunities and their next follow-up dates.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_list_job_applications"));

  server.registerTool("create_job_application", {
    title: "Create a career opportunity",
    description: "Create a private Career Pipeline opportunity only after the user explicitly confirms the company, role, status, and follow-up date.",
    inputSchema: { company: z.string().trim().min(1).max(240), role: z.string().trim().min(1).max(240), status: applicationStatus.optional(), next_follow_up_date: isoDate.nullable().optional(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ company, role, status, next_follow_up_date }) => rpcResult(supabase, "mcp_create_job_application", { company, role, application_status: status ?? "researching", next_follow_up_date: next_follow_up_date ?? null, user_confirmed: true }));

  server.registerTool("update_job_application", {
    title: "Update a career opportunity",
    description: "Update an opportunity's status only after the user explicitly confirms the exact change.",
    inputSchema: { application_id: z.uuid(), status: applicationStatus, user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ application_id, status }) => rpcResult(supabase, "mcp_update_job_application", { application_id, application_status: status, user_confirmed: true }));

  server.registerTool("list_memory", {
    title: "List Workspace memory",
    description: "Read the user's explicitly saved private Memory entries. Do not infer or add memory from ordinary conversation.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_list_memory"));

  server.registerTool("create_memory", {
    title: "Save Workspace memory",
    description: "Save one private Memory entry only when the user explicitly asks for that exact fact, preference, context, or relationship to be retained.",
    inputSchema: { memory_type: memoryType, content: z.string().trim().min(1).max(10000), domain: workspaceDomain.nullable().optional(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ memory_type, content, domain }) => rpcResult(supabase, "mcp_create_memory", { entry_type: memory_type, entry_content: content, entry_domain: domain ?? null, user_confirmed: true }));

  server.registerTool("delete_memory", {
    title: "Delete Workspace memory",
    description: "Permanently delete one explicit Memory entry only after the user confirms the identified entry should be removed.",
    inputSchema: { memory_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ memory_id }) => rpcResult(supabase, "mcp_delete_memory", { memory_id, user_confirmed: true }));

  server.registerTool("get_clock_timezones", {
    title: "Get Workspace clock preferences",
    description: "Read the three IANA time zones shown in the Workspace header clocks.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_get_clock_timezones"));

  server.registerTool("update_clock_timezones", {
    title: "Update Workspace clock preferences",
    description: "Update all three Workspace clock time zones only after the user explicitly confirms the exact ordered set of IANA time zones.",
    inputSchema: { clock_timezones: z.array(z.string().trim().min(1).max(100)).length(3), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, ({ clock_timezones }) => rpcResult(supabase, "mcp_update_clock_timezones", { requested_timezones: clock_timezones, user_confirmed: true }));

  server.registerTool("list_external_connectors", {
    title: "List external connector status",
    description: "Read the Workspace-scoped status of supported external connectors. Provider credentials and OAuth tokens are never returned to an assistant.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, () => rpcResult(supabase, "mcp_list_external_connectors"));

  server.registerTool("begin_external_connector", {
    title: "Open external connector consent",
    description: "After the user explicitly requests a supported external connection, open the Workspace handoff where the user completes the provider's interactive OAuth consent. Never ask for, receive, or store provider credentials in the assistant.",
    inputSchema: { provider: externalConnector, user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, ({ provider }) => externalConnectorHandoff(supabase, provider));

  server.registerPrompt("lead_emergence_onboarding", {
    title: "Lead Emergence Personal onboarding",
    description: "A conversational onboarding posture that asks one useful question at a time and confirms interpretations before storing them."
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
  if (code === "22023") return "Workspace rejected the input. Check the requested setup area, confirmation, and length, then try again.";
  return "Workspace could not complete this tool call safely. No private data was returned.";
}

async function externalConnectorHandoff(supabase: SupabaseClient<any, any, any, any, any>, provider: z.infer<typeof externalConnector>) {
  const { data, error } = await supabase.rpc("mcp_begin_external_connector", { target_provider: provider, user_confirmed: true });
  if (error) return { isError: true, content: [{ type: "text" as const, text: safeToolError(error.code) }] };
  const workspaceUrl = new URL("/workspace/integrations", workspaceMcpResourceUri());
  workspaceUrl.searchParams.set("connector", provider);
  workspaceUrl.searchParams.set("from", "mcp");
  const result = { ...(data && typeof data === "object" ? data as Record<string, unknown> : {}), workspace_consent_url: workspaceUrl.toString() };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result
  };
}
