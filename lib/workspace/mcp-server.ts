import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/v4";
import { mcpWwwAuthenticateChallenge } from "@/lib/workspace/mcp-auth";

const setupArea = z.enum([
  "responsibilities", "areas_of_attention", "priorities", "commitments", "value_focus",
  "existing_systems", "assistant_posture", "review_rhythm", "starting_capabilities",
  "daily_brief", "integration_recommendations"
]);

const taskStatus = z.enum(["todo", "in_progress", "blocked", "done"]);
const taskDomain = z.enum(["general", "military_transition", "sotf_fellowship", "job_search", "life", "leadership"]);
const taskPriority = z.enum(["critical", "high", "medium", "low"]);
const captureStatus = z.enum(["unprocessed", "processed", "discarded"]);
const memoryType = z.enum(["fact", "preference", "context", "relationship"]);
const careerStatus = z.enum(["researching", "applied", "phone_screen", "interview", "offer", "rejected", "withdrawn"]);
const boundedPageSize = z.number().int().min(1).max(50).default(25);
const clockTimeZones = z.array(z.string().trim().min(1).max(80)).min(3).max(3).refine(
  (timeZones) => new Set(timeZones).size === 3,
  { message: "Choose three distinct IANA time zones." }
);
const taskCursor = z.object({
  created_at: z.string().datetime({ offset: true }),
  id: z.uuid()
});
const taskUpdateInput = z.object({
  task_id: z.uuid(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  due_date: z.string().date().nullable().optional(),
  user_confirmed: z.literal(true)
}).refine(
  (input) => input.status !== undefined || input.priority !== undefined || input.due_date !== undefined,
  { message: "Provide at least one task field to update." }
);

// SDK 1.30 publishes descriptor metadata through `_meta`. Keep the OAuth
// scheme beside every tool until the SDK exposes the MCP top-level field.
const workspaceOAuthToolMeta = {
  securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }]
} as const;

export function createWorkspaceMcpServer(supabase: SupabaseClient<any, any, any, any, any>) {
  const server = new McpServer({ name: "lewis", version: "1.4.0" });

  server.registerTool("get_onboarding_state", {
    title: "Get onboarding state",
    description: "Determine whether this Personal Workspace is new, incomplete, or ready, and identify the next useful setup area. Continue existing progress instead of restarting.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_get_onboarding_state"));

  server.registerTool("get_workspace_setup", {
    title: "Get confirmed Workspace setup",
    description: "Read the user's current reported, suggested, and confirmed Personal configuration. Preserve epistemic status and never present AI-suggested material as confirmed truth.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_get_workspace_setup"));

  server.registerTool("save_user_reported_setup", {
    title: "Save user-reported setup",
    description: "Save a concise statement the user explicitly reported in the current conversation. This records the statement as user-reported, not as an AI interpretation.",
    inputSchema: { area: setupArea, reported_text: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ area, reported_text }) => rpcResult(supabase, "mcp_save_user_reported_setup", { target_area: area, reported_text }));

  server.registerTool("suggest_workspace_configuration", {
    title: "Suggest Workspace configuration",
    description: "Store a concise AI interpretation as a suggestion awaiting user confirmation. Tell the user what you inferred and ask for confirmation before using the confirmation tool.",
    inputSchema: { area: setupArea, suggestion_text: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ area, suggestion_text }) => rpcResult(supabase, "mcp_suggest_workspace_configuration", { target_area: area, suggestion_text }));

  server.registerTool("confirm_workspace_configuration", {
    title: "Confirm Workspace configuration",
    description: "Mark specific reported or suggested items as user-confirmed only after the user explicitly confirms the interpretation in the current conversation.",
    inputSchema: { item_ids: z.array(z.uuid()).min(1).max(20), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ item_ids }) => rpcResult(supabase, "mcp_confirm_workspace_configuration", { item_ids }));

  server.registerTool("complete_onboarding", {
    title: "Complete onboarding",
    description: "Complete Personal onboarding after at least three meaningful setup areas are user-confirmed. Do not call while important interpretations still need confirmation.",
    inputSchema: { user_confirmed_completion: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_complete_onboarding"));

  server.registerTool("get_leadership_state", {
    title: "Get leadership state",
    description: "Read confirmed configuration, open tasks, and open commitments after onboarding so the assistant can help the user notice, choose, act, and learn.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_get_leadership_state"));

  server.registerTool("capture_signal", {
    title: "Capture a signal",
    description: "Create a private Quick Capture after onboarding when the user explicitly asks to remember or capture something. Do not infer consent from ordinary conversation.",
    inputSchema: { capture_text: z.string().trim().min(1).max(10000), user_requested_capture: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ capture_text }) => rpcResult(supabase, "mcp_capture_signal", { capture_text }));

  server.registerTool("list_tasks", {
    title: "List Workspace tasks",
    description: "Read a bounded page of the user's private Workspace tasks. Use the returned next_cursor to read another page; never infer or expose tasks from another Workspace.",
    inputSchema: {
      status: taskStatus.optional(),
      domain: taskDomain.optional(),
      cursor: taskCursor.optional(),
      page_size: boundedPageSize
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ status, domain, cursor, page_size }) => rpcResult(supabase, "mcp_list_tasks", {
    target_status: status ?? null,
    target_domain: domain ?? null,
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_size
  }));

  server.registerTool("create_task", {
    title: "Create a Workspace task",
    description: "Create one private Workspace task only when the user explicitly asks. Generate one UUID request_id for this intended task and reuse the same value if the call must be retried.",
    inputSchema: {
      title: z.string().trim().min(1).max(240),
      request_id: z.uuid().describe("A UUID generated once for this intended task; reuse it on retry."),
      domain: taskDomain.default("general"),
      priority: taskPriority.default("medium"),
      due_date: z.string().date().nullable().optional(),
      description: z.string().trim().max(10000).optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ title, request_id, domain, priority, due_date, description }) => rpcResult(supabase, "mcp_create_task", {
    task_title: title,
    request_id,
    task_domain: domain,
    task_priority: priority,
    task_due_date: due_date ?? null,
    task_description: description ?? null
  }));

  server.registerTool("update_task", {
    title: "Update a Workspace task",
    description: "Change a task's status, priority, or due date only when the user explicitly asks. Use due_date: null to clear a due date.",
    inputSchema: taskUpdateInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ task_id, status, priority, due_date }) => rpcResult(supabase, "mcp_update_task", {
    target_task_id: task_id,
    target_status: status ?? null,
    target_priority: priority ?? null,
    target_due_date: due_date ?? null,
    set_due_date: due_date !== undefined
  }));

  server.registerTool("delete_task", {
    title: "Delete a Workspace task",
    description: "Permanently delete one private Workspace task only after the user explicitly confirms that deletion. This cannot be undone from Lewis.",
    inputSchema: { task_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ task_id }) => rpcResult(supabase, "mcp_delete_task", { target_task_id: task_id }));

  server.registerTool("list_captures", {
    title: "List Quick Captures",
    description: "Read a bounded page of the user's private Quick Captures. Use this before resolving or discarding a capture; never infer or expose captures from another Workspace.",
    inputSchema: { status: captureStatus.optional(), page_size: boundedPageSize },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ status, page_size }) => rpcResult(supabase, "mcp_list_captures", {
    target_status: status ?? null,
    page_size
  }));

  server.registerTool("resolve_capture", {
    title: "Resolve a Quick Capture into a task",
    description: "Turn one unprocessed private Quick Capture into a private task only when the user explicitly asks. Generate one UUID request_id for this intended resolution and reuse it on retry.",
    inputSchema: {
      capture_id: z.uuid(),
      request_id: z.uuid().describe("A UUID generated once for this intended capture resolution; reuse it on retry."),
      task_domain: taskDomain.default("general"),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ capture_id, request_id, task_domain }) => rpcResult(supabase, "mcp_resolve_capture", {
    target_capture_id: capture_id,
    request_id,
    task_domain
  }));

  server.registerTool("dismiss_capture", {
    title: "Discard a Quick Capture",
    description: "Discard one unprocessed private Quick Capture only after the user explicitly confirms. The capture will no longer be available for task routing.",
    inputSchema: { capture_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ capture_id }) => rpcResult(supabase, "mcp_dismiss_capture", { target_capture_id: capture_id }));

  server.registerTool("list_memory", {
    title: "List Workspace memory",
    description: "Read a bounded page of the user's private Workspace memory. A memory record is personal context, not a fact about another person unless the user explicitly recorded it.",
    inputSchema: { domain: taskDomain.optional(), page_size: boundedPageSize },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ domain, page_size }) => rpcResult(supabase, "mcp_list_memory", {
    target_domain: domain ?? null,
    page_size
  }));

  server.registerTool("create_memory", {
    title: "Create Workspace memory",
    description: "Save a private memory only when the user explicitly asks. Generate one UUID request_id for this intended memory and reuse it on retry.",
    inputSchema: {
      content: z.string().trim().min(1).max(10_000),
      request_id: z.uuid().describe("A UUID generated once for this intended memory; reuse it on retry."),
      memory_type: memoryType.default("context"),
      domain: taskDomain.optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ content, request_id, memory_type, domain }) => rpcResult(supabase, "mcp_create_memory", {
    memory_content: content,
    request_id,
    target_memory_type: memory_type,
    target_domain: domain ?? null
  }));

  server.registerTool("delete_memory", {
    title: "Delete Workspace memory",
    description: "Permanently delete one private memory record only after the user explicitly confirms. This cannot be undone from Lewis.",
    inputSchema: { memory_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ memory_id }) => rpcResult(supabase, "mcp_delete_memory", { target_memory_id: memory_id }));

  server.registerTool("list_career_opportunities", {
    title: "List career opportunities",
    description: "Read a bounded page of the user's private career opportunities. Use this before changing a status so the assistant acts on the correct opportunity.",
    inputSchema: { status: careerStatus.optional(), page_size: boundedPageSize },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ status, page_size }) => rpcResult(supabase, "mcp_list_career_opportunities", {
    target_status: status ?? null,
    page_size
  }));

  server.registerTool("create_career_opportunity", {
    title: "Create a career opportunity",
    description: "Create one private career opportunity only when the user explicitly asks. Generate one UUID request_id for this intended opportunity and reuse it on retry.",
    inputSchema: {
      company: z.string().trim().min(1).max(240),
      role: z.string().trim().min(1).max(240),
      request_id: z.uuid().describe("A UUID generated once for this intended opportunity; reuse it on retry."),
      next_follow_up_date: z.string().date().nullable().optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ company, role, request_id, next_follow_up_date }) => rpcResult(supabase, "mcp_create_career_opportunity", {
    target_company: company,
    target_role: role,
    request_id,
    target_next_follow_up_date: next_follow_up_date ?? null
  }));

  server.registerTool("update_career_opportunity", {
    title: "Update a career opportunity",
    description: "Change the status of one private career opportunity only when the user explicitly asks.",
    inputSchema: { opportunity_id: z.uuid(), status: careerStatus, user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ opportunity_id, status }) => rpcResult(supabase, "mcp_update_career_opportunity", {
    target_opportunity_id: opportunity_id,
    target_status: status
  }));

  server.registerTool("replace_confirmed_workspace_configuration", {
    title: "Replace confirmed Workspace configuration",
    description: "Replace the active confirmed content for one Workspace setup area only after the user explicitly confirms the exact replacement. Prior history is retained, but the former active item becomes inactive.",
    inputSchema: {
      area: setupArea,
      confirmed_text: z.string().trim().min(1).max(5000),
      request_id: z.uuid().describe("A UUID generated once for this intended replacement; reuse it on retry."),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ area, confirmed_text, request_id }) => rpcResult(supabase, "mcp_replace_confirmed_workspace_configuration", {
    target_area: area,
    confirmed_text,
    request_id
  }));

  server.registerTool("list_integration_connections", {
    title: "List integration connection status",
    description: "Read the status and granted scopes of the user's existing Workspace integrations. This tool never returns credentials and does not create an external connection.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_list_integration_connections"));

  server.registerTool("get_clock_preferences", {
    title: "Get Workspace display-clock preferences",
    description: "Read the three IANA time zones used only for the user's Workspace display clocks. This does not change stored timestamps or the primary Workspace timezone.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_get_clock_preferences"));

  server.registerTool("save_clock_preferences", {
    title: "Save Workspace display-clock preferences",
    description: "Replace the three IANA time zones used for Workspace display clocks only when the user explicitly confirms the exact set. This does not change stored timestamps or the primary Workspace timezone.",
    inputSchema: { clock_timezones: clockTimeZones, user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ clock_timezones }) => rpcResult(supabase, "mcp_save_clock_preferences", { target_clock_timezones: clock_timezones }));

  server.registerTool("list_assistant_connections", {
    title: "List Workspace assistant connections",
    description: "Read Workspace OAuth connection status for ChatGPT, Claude, and other registered assistant clients. The returned opaque connection_id can be used only to revoke a listed connection; client identifiers and credentials are never exposed.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_list_assistant_connections"));

  server.registerTool("disconnect_current_assistant", {
    title: "Disconnect this assistant from Workspace",
    description: "Disconnect only the currently connected ChatGPT or Claude client after the user explicitly confirms. Future privileged Lewis calls from this client will require a new OAuth authorization.",
    inputSchema: { user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, () => rpcResult(supabase, "mcp_disconnect_current_assistant"));

  server.registerTool("disconnect_assistant_connection", {
    title: "Disconnect a Workspace assistant connection",
    description: "Revoke one listed ChatGPT, Claude, or other Workspace assistant connection only after the user explicitly confirms. Use the opaque connection_id returned by list_assistant_connections; the target must complete a new Workspace OAuth authorization before it can make privileged calls again.",
    inputSchema: { connection_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: workspaceOAuthToolMeta
  }, ({ connection_id }) => rpcResult(supabase, "mcp_disconnect_assistant_connection", { target_connection_id: connection_id }));

  server.registerPrompt("lead_emergence_onboarding", {
    title: "Lead Emergence Personal onboarding",
    description: "A conversational onboarding posture that asks one useful question at a time and confirms interpretations before storing them."
  }, async () => ({ messages: [{ role: "user", content: { type: "text", text: "Continue my Lead Emergence Workspace setup. First check my onboarding state and existing setup. Ask one useful question at a time, adapt to my answers, allow me to skip or say I don't know, and confirm meaningful interpretations before storing them as configuration." } }] }));

  return server;
}

async function rpcResult(supabase: SupabaseClient<any, any, any, any, any>, name: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: safeToolError(error.code) }],
      ...(requiresReauthorization(error) ? { _meta: { "mcp/www_authenticate": [mcpWwwAuthenticateChallenge()] } } : {})
    };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data && typeof data === "object" ? data as Record<string, unknown> : { result: data } };
}

function requiresReauthorization(error: { code?: string; message?: string }) {
  return error.code === "42501"
    && /MCP authorization is invalid|connection is disconnected or requires authorization/i.test(error.message ?? "");
}

function safeToolError(code?: string) {
  if (code === "42501") return "Workspace denied this operation because the connection, plan capability, onboarding state, or Personal authorization is not active.";
  if (code === "22023") return "Workspace rejected the input. Check the requested setup area, confirmation, task identifier, and field lengths, then try again.";
  return "Workspace could not complete this tool call safely. No private data was returned.";
}
