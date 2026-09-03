import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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
const contextFamily = z.enum([
  "professional_identity", "strength", "skill", "work_preference", "communication_preference",
  "goal", "career_direction", "target_function", "target_industry", "target_role",
  "decision_criterion", "career_hypothesis", "person", "organization", "relationship",
  "opportunity", "accomplishment", "responsibility", "story_bank", "coaching_guidance",
  "feedback", "lesson", "assumption", "context_gap"
]);
const contextTier = z.enum(["working", "chapter", "core"]);
const contextPrivacy = z.enum(["normal", "private", "sensitive"]);
const contextSource = z.enum(["user_supplied", "connector", "workflow", "inferred", "legacy_memory"]);
const contextRecordType = z.enum(["task", "commitment", "meeting", "decision", "capture", "job_application", "memory_entry"]);
const contextPurpose = z.enum(["all", "profile", "direction", "relationships", "work", "learning"]);
const contextCandidateStatus = z.enum(["pending", "conflict", "confirmed", "corrected", "rejected", "archived"]);
const contextReviewDecision = z.enum(["approve", "correct", "reject", "supersede"]);
const contextLinkType = z.enum(["related_to", "supports", "contradicts", "about", "applies_to", "derived_from", "fulfilled_by"]);
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

// ChatGPT requires this standard, top-level tool field to decide which tools
// need OAuth. It deliberately mirrors the protected-resource metadata rather
// than expanding the scopes Workspace actually uses.
const workspaceOAuthToolMeta = {
  securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }]
} as const;

// The MCP SDK requires structuredContent to be paired with an outputSchema.
// Keep the contract deliberately permissive while the tool responses retain
// their versioned, server-owned shapes; this tells strict hosts (including
// ChatGPT) that a structured result is expected without erasing any fields.
const workspaceMcpToolContract = {
  outputSchema: z.object({}).passthrough(),
  _meta: workspaceOAuthToolMeta
} as const;

type McpToolListResult = {
  tools: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type McpToolListHandler = (request: unknown, extra: unknown) => Promise<McpToolListResult>;

type McpServerInternals = {
  _requestHandlers: Map<string, McpToolListHandler>;
};

export function createWorkspaceMcpServer(supabase: SupabaseClient<any, any, any, any, any>, currentClientId?: string) {
  const server = new McpServer({ name: "lewis", version: "1.4.0" });

  server.registerTool("get_onboarding_state", {
    title: "Get onboarding state",
    description: "Determine whether this Personal Workspace is new, incomplete, or ready, and identify the next useful setup area. Continue existing progress instead of restarting.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_get_onboarding_state"));

  server.registerTool("get_workspace_setup", {
    title: "Get confirmed Workspace setup",
    description: "Read the user's current reported, suggested, and confirmed Personal configuration. Preserve epistemic status and never present AI-suggested material as confirmed truth.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_get_workspace_setup"));

  server.registerTool("save_user_reported_setup", {
    title: "Save user-reported setup",
    description: "Save a concise statement the user explicitly reported in the current conversation. This records the statement as user-reported, not as an AI interpretation.",
    inputSchema: { area: setupArea, reported_text: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ area, reported_text }) => rpcResult(supabase, "mcp_save_user_reported_setup", { target_area: area, reported_text }));

  server.registerTool("suggest_workspace_configuration", {
    title: "Suggest Workspace configuration",
    description: "Store a concise AI interpretation as a suggestion awaiting user confirmation. Tell the user what you inferred and ask for confirmation before using the confirmation tool.",
    inputSchema: { area: setupArea, suggestion_text: z.string().trim().min(1).max(5000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ area, suggestion_text }) => rpcResult(supabase, "mcp_suggest_workspace_configuration", { target_area: area, suggestion_text }));

  server.registerTool("confirm_workspace_configuration", {
    title: "Confirm Workspace configuration",
    description: "Mark specific reported or suggested items as user-confirmed only after the user explicitly confirms the interpretation in the current conversation.",
    inputSchema: { item_ids: z.array(z.uuid()).min(1).max(20), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ item_ids }) => rpcResult(supabase, "mcp_confirm_workspace_configuration", { item_ids }));

  server.registerTool("complete_onboarding", {
    title: "Complete onboarding",
    description: "Complete Personal onboarding after at least three meaningful setup areas are user-confirmed. Do not call while important interpretations still need confirmation.",
    inputSchema: { user_confirmed_completion: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_complete_onboarding"));

  server.registerTool("get_leadership_state", {
    title: "Get leadership state",
    description: "Read confirmed configuration, open tasks, and open commitments after onboarding so the assistant can help the user notice, choose, act, and learn.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_get_leadership_state"));

  server.registerTool("capture_signal", {
    title: "Capture a signal",
    description: "Create a private Quick Capture after onboarding when the user explicitly asks to remember or capture something. Do not infer consent from ordinary conversation.",
    inputSchema: { capture_text: z.string().trim().min(1).max(10000), user_requested_capture: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
  }, ({ task_id }) => rpcResult(supabase, "mcp_delete_task", { target_task_id: task_id }));

  server.registerTool("list_captures", {
    title: "List Quick Captures",
    description: "Read a bounded page of the user's private Quick Captures. Use this before resolving or discarding a capture; never infer or expose captures from another Workspace.",
    inputSchema: { status: captureStatus.optional(), page_size: boundedPageSize },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
  }, ({ capture_id }) => rpcResult(supabase, "mcp_dismiss_capture", { target_capture_id: capture_id }));

  server.registerTool("list_professional_context", {
    title: "List confirmed professional context",
    description: "Retrieve bounded, confirmed Working/Chapter/Core professional context by purpose. Private context is excluded unless the user explicitly requests it. Legacy Workspace memory is returned separately for compatibility and is never copied into the graph.",
    inputSchema: {
      purpose: contextPurpose.default("all"),
      tiers: z.array(contextTier).min(1).max(3).default(["chapter", "core"]),
      include_private: z.boolean().default(false),
      explicit_private_access: z.boolean().default(false),
      page_size: boundedPageSize
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ purpose, tiers, include_private, explicit_private_access, page_size }) => rpcResult(supabase, "mcp_list_professional_context", {
    target_purpose: purpose,
    target_tiers: tiers,
    include_private,
    explicit_private_access,
    page_size
  }));

  server.registerTool("list_context_candidates", {
    title: "Inspect professional context candidates",
    description: "Read the governed context review queue, including conflicts and prior rejected candidates. Private candidates require an explicit user request.",
    inputSchema: {
      status: contextCandidateStatus.optional(),
      include_private: z.boolean().default(false),
      explicit_private_access: z.boolean().default(false),
      page_size: boundedPageSize
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ status, include_private, explicit_private_access, page_size }) => rpcResult(supabase, "mcp_list_context_candidates", {
    target_status: status ?? null,
    include_private,
    explicit_private_access,
    page_size
  }));

  server.registerTool("propose_context_candidate", {
    title: "Propose professional context for review",
    description: "Record one bounded observation as a reviewable candidate with provenance. This never creates durable professional truth. Mark do-not-retain or suspected classified/CUI/operationally-sensitive military material so Workspace can refuse persistence.",
    inputSchema: {
      request_id: z.uuid(),
      family: contextFamily,
      label: z.string().trim().min(1).max(240),
      summary: z.string().trim().min(1).max(5000),
      proposed_tier: contextTier.default("working"),
      chapter_key: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/).nullable().optional(),
      privacy: contextPrivacy.default("normal"),
      source_type: contextSource,
      source_reference: z.string().trim().min(1).max(500).nullable().optional(),
      observed_at: z.string().datetime({ offset: true }),
      confidence: z.number().min(0).max(1),
      evidence_excerpt: z.string().trim().min(1).max(2000).nullable().optional(),
      evidence_role: z.enum(["supporting", "contradicting"]).default("supporting"),
      source_record_type: contextRecordType.nullable().optional(),
      source_record_id: z.uuid().nullable().optional(),
      conflicts_with_context_id: z.uuid().nullable().optional(),
      possible_match_context_id: z.uuid().nullable().optional(),
      retention: z.enum(["retain", "do_not_retain"]).default("retain"),
      military_sensitivity: z.enum(["none", "suspected_classified", "suspected_cui", "operationally_sensitive"]).default("none")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, (input) => rpcResult(supabase, "mcp_propose_context_candidate", {
    request_id: input.request_id,
    target_family: input.family,
    proposed_label: input.label,
    proposed_summary: input.summary,
    proposed_tier: input.proposed_tier,
    target_privacy_level: input.privacy,
    target_source_type: input.source_type,
    target_source_reference: input.source_reference ?? null,
    target_observed_at: input.observed_at,
    target_confidence: input.confidence,
    evidence_excerpt: input.evidence_excerpt ?? null,
    target_evidence_role: input.evidence_role,
    target_chapter_key: input.chapter_key ?? null,
    target_source_record_type: input.source_record_type ?? null,
    target_source_record_id: input.source_record_id ?? null,
    target_conflict_with_entity_id: input.conflicts_with_context_id ?? null,
    target_possible_match_entity_id: input.possible_match_context_id ?? null,
    target_retention: input.retention,
    target_military_sensitivity: input.military_sensitivity
  }));

  server.registerTool("review_context_candidate", {
    title: "Review a professional context candidate",
    description: "Approve, correct, reject, or explicitly supersede conflicting context only after the user reviews the candidate. Core promotion is always user governed.",
    inputSchema: {
      candidate_id: z.uuid(),
      decision: contextReviewDecision,
      request_id: z.uuid(),
      tier: contextTier.nullable().optional(),
      corrected_label: z.string().trim().min(1).max(240).nullable().optional(),
      corrected_summary: z.string().trim().min(1).max(5000).nullable().optional(),
      chapter_key: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/).nullable().optional(),
      review_notes: z.string().trim().min(1).max(2000).nullable().optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, (input) => rpcResult(supabase, "mcp_review_context_candidate", {
    target_candidate_id: input.candidate_id,
    target_decision: input.decision,
    request_id: input.request_id,
    target_tier: input.tier ?? null,
    corrected_label: input.corrected_label ?? null,
    corrected_summary: input.corrected_summary ?? null,
    target_chapter_key: input.chapter_key ?? null,
    review_notes: input.review_notes ?? null
  }));

  server.registerTool("get_context_provenance", {
    title: "Inspect professional context provenance",
    description: "Inspect bounded supporting and contradicting evidence, review history, and unresolved conflicts for one professional context item.",
    inputSchema: { context_id: z.uuid() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ context_id }) => rpcResult(supabase, "mcp_get_context_provenance", { target_entity_id: context_id }));

  server.registerTool("link_professional_context", {
    title: "Link professional context to an existing record",
    description: "Link confirmed professional context to another context item or an existing Workspace task, commitment, meeting, decision, capture, job application, or legacy memory record without copying that record.",
    inputSchema: {
      source_context_id: z.uuid(),
      link_type: contextLinkType,
      request_id: z.uuid(),
      target_context_id: z.uuid().nullable().optional(),
      target_record_type: contextRecordType.nullable().optional(),
      target_record_id: z.uuid().nullable().optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, (input) => rpcResult(supabase, "mcp_link_professional_context", {
    source_context_id: input.source_context_id,
    link_type: input.link_type,
    request_id: input.request_id,
    target_context_id: input.target_context_id ?? null,
    target_record_type: input.target_record_type ?? null,
    target_record_id: input.target_record_id ?? null
  }));

  server.registerTool("manage_professional_context", {
    title: "Promote, archive, or delete professional context",
    description: "Apply an explicit user decision to promote confirmed context, archive it, or delete its retained content. Working can promote to Chapter/Core; Chapter can promote to Core.",
    inputSchema: {
      context_id: z.uuid(),
      action: z.enum(["promote", "archive", "delete"]),
      request_id: z.uuid(),
      tier: z.enum(["chapter", "core"]).nullable().optional(),
      chapter_key: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/).nullable().optional(),
      review_notes: z.string().trim().min(1).max(2000).nullable().optional(),
      user_confirmed: z.literal(true)
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, (input) => rpcResult(supabase, "mcp_manage_professional_context", {
    target_entity_id: input.context_id,
    target_action: input.action,
    request_id: input.request_id,
    target_tier: input.tier ?? null,
    target_chapter_key: input.chapter_key ?? null,
    review_notes: input.review_notes ?? null
  }));

  server.registerTool("list_memory", {
    title: "List Workspace memory",
    description: "Read a bounded page of the user's private Workspace memory. A memory record is personal context, not a fact about another person unless the user explicitly recorded it.",
    inputSchema: { domain: taskDomain.optional(), page_size: boundedPageSize },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
  }, ({ memory_id }) => rpcResult(supabase, "mcp_delete_memory", { target_memory_id: memory_id }));

  server.registerTool("list_career_opportunities", {
    title: "List career opportunities",
    description: "Read a bounded page of the user's private career opportunities. Use this before changing a status so the assistant acts on the correct opportunity.",
    inputSchema: { status: careerStatus.optional(), page_size: boundedPageSize },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
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
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_list_integration_connections"));

  server.registerTool("get_clock_preferences", {
    title: "Get Workspace display-clock preferences",
    description: "Read the three IANA time zones used only for the user's Workspace display clocks. This does not change stored timestamps or the primary Workspace timezone.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_get_clock_preferences"));

  server.registerTool("save_clock_preferences", {
    title: "Save Workspace display-clock preferences",
    description: "Replace the three IANA time zones used for Workspace display clocks only when the user explicitly confirms the exact set. This does not change stored timestamps or the primary Workspace timezone.",
    inputSchema: { clock_timezones: clockTimeZones, user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ clock_timezones }) => rpcResult(supabase, "mcp_save_clock_preferences", { target_clock_timezones: clock_timezones }));

  server.registerTool("list_assistant_connections", {
    title: "List Workspace assistant connections",
    description: "Read Workspace OAuth connection status for ChatGPT, Claude, and other registered assistant clients. The returned opaque connection_id can be used only to revoke a listed connection; client identifiers and credentials are never exposed.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => rpcResult(supabase, "mcp_list_assistant_connections"));

  server.registerTool("disconnect_current_assistant", {
    title: "Disconnect this assistant from Workspace",
    description: "Disconnect only the currently connected ChatGPT or Claude client after the user explicitly confirms. Future privileged Lewis calls from this client will require a new OAuth authorization.",
    inputSchema: { user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, () => disconnectMcpAssistant(supabase, "mcp_disconnect_current_assistant", undefined, currentClientId));

  server.registerTool("disconnect_assistant_connection", {
    title: "Disconnect a Workspace assistant connection",
    description: "Revoke one listed ChatGPT, Claude, or other Workspace assistant connection only after the user explicitly confirms. Use the opaque connection_id returned by list_assistant_connections; the target must complete a new Workspace OAuth authorization before it can make privileged calls again.",
    inputSchema: { connection_id: z.uuid(), user_confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    ...workspaceMcpToolContract
  }, ({ connection_id }) => disconnectMcpAssistant(supabase, "mcp_disconnect_assistant_connection", { target_connection_id: connection_id }));

  server.registerPrompt("lead_emergence_onboarding", {
    title: "Lead Emergence Personal onboarding",
    description: "A conversational onboarding posture that asks one useful question at a time and confirms interpretations before storing them."
  }, async () => ({ messages: [{ role: "user", content: { type: "text", text: "Continue my Lead Emergence Workspace setup. First check my onboarding state and existing setup. Ask one useful question at a time, adapt to my answers, allow me to skip or say I don't know, and confirm meaningful interpretations before storing them as configuration." } }] }));

  publishTopLevelOAuthSecuritySchemes(server);
  return server;
}

/**
 * MCP SDK 1.30 serializes arbitrary tool metadata but has not yet exposed the
 * standard `securitySchemes` field in `registerTool`. Preserve its generated
 * schemas/handlers, then decorate the wire-level tools/list response with the
 * standard field ChatGPT consumes. Keep the legacy `_meta` copy for older MCP
 * clients until the SDK supports this field natively.
 */
function publishTopLevelOAuthSecuritySchemes(server: McpServer) {
  const internalServer = server.server as unknown as McpServerInternals;
  const existing = internalServer._requestHandlers.get("tools/list");
  if (!existing) throw new Error("Workspace MCP tools/list handler was not initialized.");

  server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const result = await existing(request, extra) as McpToolListResult;
    return {
      ...result,
      tools: result.tools.map((tool) => ({
        ...tool,
        securitySchemes: workspaceOAuthToolMeta.securitySchemes,
      })),
    } as never;
  });
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

async function disconnectMcpAssistant(
  supabase: SupabaseClient<any, any, any, any, any>,
  name: "mcp_disconnect_current_assistant" | "mcp_disconnect_assistant_connection",
  args?: Record<string, unknown>,
  currentClientId?: string,
) {
  const clientId = name === "mcp_disconnect_current_assistant"
    ? currentClientId
    : await connectionClientId(supabase, args?.target_connection_id);
  const { data, error } = await supabase.rpc(name, args);
  if (error) return rpcError(error);

  // The private grant and Workspace authorization are revoked atomically by
  // the RPC above. Supabase grant revocation is a best-effort second boundary:
  // an endpoint failure cannot reconnect the client because the durable grant
  // is already inactive and the access-token hook fails closed.
  const grantRevoked = clientId && isUuid(clientId) ? await revokeProviderGrant(supabase, clientId) : false;
  const result = data && typeof data === "object" ? data as Record<string, unknown> : { result: data };
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ...result, provider_grant_revoked: grantRevoked }) }],
    structuredContent: { ...result, provider_grant_revoked: grantRevoked },
  };
}

async function connectionClientId(supabase: SupabaseClient<any, any, any, any, any>, connectionId: unknown) {
  if (!isUuid(connectionId)) return null;
  try {
    const { data, error } = await supabase
      .from("mcp_authorizations")
      .select("client_id")
      .eq("id", connectionId)
      .maybeSingle();
    return error || !data || typeof data.client_id !== "string" ? null : data.client_id;
  } catch { return null; }
}

function rpcError(error: { code?: string; message?: string }) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: safeToolError(error.code) }],
    ...(requiresReauthorization(error) ? { _meta: { "mcp/www_authenticate": [mcpWwwAuthenticateChallenge()] } } : {}),
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function revokeProviderGrant(supabase: SupabaseClient<any, any, any, any, any>, clientId: string) {
  try { return !(await supabase.auth.oauth.revokeGrant({ clientId })).error; } catch { return false; }
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
