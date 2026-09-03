import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

async function connectLewis(rpc: ReturnType<typeof vi.fn>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createWorkspaceMcpServer({ rpc } as never);
  const client = new Client({ name: "lewis-contract-test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return client;
}

describe("Lewis MCP contract", () => {
  it("publishes OAuth tool policy at the standard top-level wire field", async () => {
    const server = createWorkspaceMcpServer({ rpc: vi.fn(async () => ({ data: {}, error: null })) } as never);
    const internal = server.server as unknown as {
      _requestHandlers: Map<string, (request: unknown, extra: unknown) => Promise<{ tools: Array<Record<string, unknown>> }>>;
    };
    const listTools = internal._requestHandlers.get("tools/list");

    expect(listTools).toBeDefined();
    const result = await listTools!({ method: "tools/list", params: {} }, {});
    const onboarding = result.tools.find((tool) => tool.name === "get_onboarding_state");

    expect(onboarding?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["openid", "email", "profile"] }
    ]);
    expect(onboarding?.outputSchema).toMatchObject({ type: "object" });
    for (const tool of result.tools) {
      expect((tool.outputSchema as { type?: unknown } | undefined)?.type).toBe("object");
    }
  });

  it("publishes durable, explicit Workspace controls alongside the existing tools", async () => {
    const client = await connectLewis(vi.fn(async () => ({ data: {}, error: null })));

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "get_leadership_state", "list_tasks", "create_task", "update_task", "delete_task",
      "list_captures", "resolve_capture", "dismiss_capture",
      "list_memory", "create_memory", "delete_memory",
      "list_professional_context", "list_context_candidates", "propose_context_candidate",
      "review_context_candidate", "get_context_provenance", "link_professional_context",
      "manage_professional_context", "get_professional_context_change_status",
      "list_career_opportunities", "create_career_opportunity", "update_career_opportunity",
      "replace_confirmed_workspace_configuration", "list_integration_connections",
      "get_clock_preferences", "save_clock_preferences",
      "list_assistant_connections", "disconnect_current_assistant", "disconnect_assistant_connection"
    ]));

    const create = tools.tools.find((tool) => tool.name === "create_task");
    const remove = tools.tools.find((tool) => tool.name === "delete_task");
    const memory = tools.tools.find((tool) => tool.name === "create_memory");
    const replaceConfiguration = tools.tools.find((tool) => tool.name === "replace_confirmed_workspace_configuration");
    const integrations = tools.tools.find((tool) => tool.name === "list_integration_connections");
    const saveClockPreferences = tools.tools.find((tool) => tool.name === "save_clock_preferences");
    const disconnectAssistant = tools.tools.find((tool) => tool.name === "disconnect_current_assistant");
    const disconnectAssistantConnection = tools.tools.find((tool) => tool.name === "disconnect_assistant_connection");
    expect(create?.inputSchema.required).toEqual(expect.arrayContaining(["title", "request_id", "user_confirmed"]));
    expect(create?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    expect(create?._meta).toMatchObject({ securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }] });
    expect(remove?.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(memory?.inputSchema.required).toEqual(expect.arrayContaining(["content", "request_id", "user_confirmed"]));
    expect(replaceConfiguration?.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(integrations?.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
    expect(saveClockPreferences?.inputSchema.required).toEqual(expect.arrayContaining(["clock_timezones", "user_confirmed"]));
    expect(disconnectAssistant?.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(disconnectAssistantConnection?.inputSchema.required).toEqual(expect.arrayContaining(["connection_id", "user_confirmed"]));
    expect(disconnectAssistantConnection?.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
  });

  it("maps a confirmed task creation to the database contract", async () => {
    const rpc = vi.fn(async () => ({
      data: { task: { id: "00000000-0000-4000-8000-000000000123", title: "Call Sandy" }, created: true, idempotent_replay: false },
      error: null
    }));
    const client = await connectLewis(rpc);

    const result = await client.callTool({
      name: "create_task",
      arguments: {
        title: "Call Sandy",
        request_id: "00000000-0000-4000-8000-000000000001",
        domain: "life",
        priority: "high",
        due_date: null,
        description: "Get retirement information and discuss fellowship dates.",
        user_confirmed: true
      }
    });

    expect(result.isError).not.toBe(true);
    expect(rpc).toHaveBeenCalledWith("mcp_create_task", {
      task_title: "Call Sandy",
      request_id: "00000000-0000-4000-8000-000000000001",
      task_domain: "life",
      task_priority: "high",
      task_due_date: null,
      task_description: "Get retirement information and discuss fellowship dates."
    });
  });

  it("rejects an unconfirmed destructive task action before reaching the database", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    const result = await client.callTool({
      name: "delete_task",
      arguments: { task_id: "00000000-0000-4000-8000-000000000123", user_confirmed: false }
    });

    expect(result.isError).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps confirmed parity actions to narrow tenant-scoped RPC contracts", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    await client.callTool({
      name: "resolve_capture",
      arguments: {
        capture_id: "00000000-0000-4000-8000-000000000010",
        request_id: "00000000-0000-4000-8000-000000000011",
        task_domain: "leadership",
        user_confirmed: true
      }
    });
    await client.callTool({
      name: "create_memory",
      arguments: {
        content: "Sandy prefers calls before noon.",
        request_id: "00000000-0000-4000-8000-000000000012",
        memory_type: "preference",
        domain: "life",
        user_confirmed: true
      }
    });
    await client.callTool({
      name: "create_career_opportunity",
      arguments: {
        company: "Care Coalition",
        role: "Fellow",
        request_id: "00000000-0000-4000-8000-000000000013",
        next_follow_up_date: "2026-09-30",
        user_confirmed: true
      }
    });
    await client.callTool({
      name: "replace_confirmed_workspace_configuration",
      arguments: {
        area: "priorities",
        confirmed_text: "Confirm fellowship dates before the end of September.",
        request_id: "00000000-0000-4000-8000-000000000014",
        user_confirmed: true
      }
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_resolve_capture", {
      target_capture_id: "00000000-0000-4000-8000-000000000010",
      request_id: "00000000-0000-4000-8000-000000000011",
      task_domain: "leadership"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_create_memory", {
      memory_content: "Sandy prefers calls before noon.",
      request_id: "00000000-0000-4000-8000-000000000012",
      target_memory_type: "preference",
      target_domain: "life"
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_create_career_opportunity", {
      target_company: "Care Coalition",
      target_role: "Fellow",
      request_id: "00000000-0000-4000-8000-000000000013",
      target_next_follow_up_date: "2026-09-30"
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_replace_confirmed_workspace_configuration", {
      target_area: "priorities",
      confirmed_text: "Confirm fellowship dates before the end of September.",
      request_id: "00000000-0000-4000-8000-000000000014"
    });
  });

  it("rejects an unconfirmed memory deletion before reaching the database", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    const result = await client.callTool({
      name: "delete_memory",
      arguments: { memory_id: "00000000-0000-4000-8000-000000000123", user_confirmed: false }
    });

    expect(result.isError).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps governed Professional Context Graph operations to narrow RPC contracts", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    await client.callTool({
      name: "propose_context_candidate",
      arguments: {
        request_id: "00000000-0000-4000-8000-000000000201",
        family: "lesson",
        label: "Quantify operational scale",
        summary: "State team size and outcomes in interview examples.",
        proposed_tier: "chapter",
        chapter_key: "sotf_transition",
        privacy: "normal",
        source_type: "workflow",
        source_reference: "interview-lab:session-1",
        observed_at: "2026-09-02T18:00:00Z",
        confidence: 0.8,
        evidence_excerpt: "The coach requested clearer evidence of scale.",
        evidence_role: "supporting",
        source_record_type: null,
        source_record_id: null,
        conflicts_with_context_id: null,
        possible_match_context_id: null,
        retention: "retain",
        military_sensitivity: "none"
      }
    });
    await client.callTool({
      name: "review_context_candidate",
      arguments: {
        candidate_id: "00000000-0000-4000-8000-000000000202",
        decision: "correct",
        request_id: "00000000-0000-4000-8000-000000000203",
        corrected_label: null,
        corrected_summary: "Quantify team size, operating tempo, and outcomes.",
        review_notes: "Confirmed and amended by the user."
      }
    });
    await client.callTool({
      name: "list_professional_context",
      arguments: {
        purpose: "learning",
        tiers: ["chapter", "core"],
        privacy_scopes: [],
        page_size: 25
      }
    });
    await client.callTool({
      name: "link_professional_context",
      arguments: {
        source_context_id: "00000000-0000-4000-8000-000000000204",
        link_type: "derived_from",
        request_id: "00000000-0000-4000-8000-000000000205",
        target_context_id: null,
        target_record_type: "memory_entry",
        target_record_id: "00000000-0000-4000-8000-000000000206"
      }
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_submit_context_candidate", {
      request_id: "00000000-0000-4000-8000-000000000201",
      target_family: "lesson",
      proposed_label: "Quantify operational scale",
      proposed_summary: "State team size and outcomes in interview examples.",
      proposed_tier: "chapter",
      target_privacy_level: "normal",
      target_source_type: "workflow",
      target_source_reference: "interview-lab:session-1",
      target_observed_at: "2026-09-02T18:00:00Z",
      target_confidence: 0.8,
      evidence_excerpt: "The coach requested clearer evidence of scale.",
      target_evidence_role: "supporting",
      target_chapter_key: "sotf_transition",
      target_source_record_type: null,
      target_source_record_id: null,
      target_conflict_with_entity_id: null,
      target_possible_match_entity_id: null,
      target_retention: "retain",
      target_military_sensitivity: "none"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_request_context_review", {
      target_candidate_id: "00000000-0000-4000-8000-000000000202",
      target_decision: "correct",
      request_id: "00000000-0000-4000-8000-000000000203",
      corrected_label: null,
      corrected_summary: "Quantify team size, operating tempo, and outcomes.",
      review_notes: "Confirmed and amended by the user."
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_list_professional_context_granted", {
      target_purpose: "learning",
      target_tiers: ["chapter", "core"],
      requested_privacy_scopes: [],
      page_size: 25
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_request_context_link", {
      source_context_id: "00000000-0000-4000-8000-000000000204",
      link_type: "derived_from",
      request_id: "00000000-0000-4000-8000-000000000205",
      target_context_id: null,
      target_record_type: "memory_entry",
      target_record_id: "00000000-0000-4000-8000-000000000206"
    });
  });

  it("maps governed context decisions to request-only RPCs without client confirmation attestation", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    const review = await client.callTool({
      name: "review_context_candidate",
      arguments: {
        candidate_id: "00000000-0000-4000-8000-000000000202",
        decision: "approve",
        request_id: "00000000-0000-4000-8000-000000000203"
      }
    });
    const deletion = await client.callTool({
      name: "manage_professional_context",
      arguments: {
        context_id: "00000000-0000-4000-8000-000000000204",
        action: "delete",
        request_id: "00000000-0000-4000-8000-000000000205"
      }
    });

    expect(review.isError).not.toBe(true);
    expect(deletion.isError).not.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_request_context_review", {
      target_candidate_id: "00000000-0000-4000-8000-000000000202",
      target_decision: "approve",
      request_id: "00000000-0000-4000-8000-000000000203",
      corrected_label: null,
      corrected_summary: null,
      review_notes: null
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_request_context_management", {
      target_entity_id: "00000000-0000-4000-8000-000000000204",
      target_action: "delete",
      request_id: "00000000-0000-4000-8000-000000000205",
      target_tier: null,
      target_chapter_key: null,
      review_notes: null
    });
  });

  it("rejects ambiguous candidate-review semantics before database access", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);
    const base = {
      candidate_id: "00000000-0000-4000-8000-000000000202",
      request_id: "00000000-0000-4000-8000-000000000203"
    };

    const approveMutation = await client.callTool({
      name: "review_context_candidate",
      arguments: { ...base, decision: "approve", corrected_summary: "Changed during approval." }
    });
    const noOpCorrection = await client.callTool({
      name: "review_context_candidate",
      arguments: { ...base, decision: "correct" }
    });
    const rejectMutation = await client.callTool({
      name: "review_context_candidate",
      arguments: { ...base, decision: "reject", corrected_label: "Changed while rejecting." }
    });
    const supersedeMutation = await client.callTool({
      name: "review_context_candidate",
      arguments: { ...base, decision: "supersede", corrected_summary: "Changed while superseding." }
    });

    for (const result of [approveMutation, noOpCorrection, rejectMutation, supersedeMutation]) {
      expect(result.isError).toBe(true);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps separately requested protected scopes to the grant-aware provenance RPC", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    await client.callTool({
      name: "get_context_provenance",
      arguments: {
        context_id: "00000000-0000-4000-8000-000000000204",
        privacy_scopes: ["private", "sensitive"]
      }
    });

    expect(rpc).toHaveBeenCalledWith("mcp_get_context_provenance_granted", {
      target_entity_id: "00000000-0000-4000-8000-000000000204",
      requested_privacy_scopes: ["private", "sensitive"]
    });
  });

  it("polls only the bound content-minimized confirmation status RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "pending" }, error: null }));
    const client = await connectLewis(rpc);
    await client.callTool({
      name: "get_professional_context_change_status",
      arguments: { confirmation_request_id: "00000000-0000-4000-8000-000000000207" }
    });
    expect(rpc).toHaveBeenCalledWith("mcp_get_context_confirmation_status", {
      target_request_id: "00000000-0000-4000-8000-000000000207"
    });
  });

  it("maps confirmed preference and assistant-disconnect actions to narrow RPC contracts", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    await client.callTool({
      name: "save_clock_preferences",
      arguments: {
        clock_timezones: ["America/Denver", "America/Chicago", "America/Los_Angeles"],
        user_confirmed: true
      }
    });
    await client.callTool({ name: "disconnect_current_assistant", arguments: { user_confirmed: true } });
    await client.callTool({
      name: "disconnect_assistant_connection",
      arguments: { connection_id: "00000000-0000-4000-8000-000000000099", user_confirmed: true }
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_save_clock_preferences", {
      target_clock_timezones: ["America/Denver", "America/Chicago", "America/Los_Angeles"]
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_disconnect_current_assistant", undefined);
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_disconnect_assistant_connection", {
      target_connection_id: "00000000-0000-4000-8000-000000000099"
    });
  });

  it("rejects an unconfirmed self-disconnect before reaching the database", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    const result = await client.callTool({ name: "disconnect_current_assistant", arguments: { user_confirmed: false } });

    expect(result.isError).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unconfirmed assistant-connection disconnect before reaching the database", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const client = await connectLewis(rpc);

    const result = await client.callTool({
      name: "disconnect_assistant_connection",
      arguments: { connection_id: "00000000-0000-4000-8000-000000000099", user_confirmed: false }
    });

    expect(result.isError).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns an MCP reauthorization challenge when a controlled RPC detects a disconnected bearer", async () => {
    const client = await connectLewis(vi.fn(async () => ({
      data: null,
      error: { code: "42501", message: "This AI assistant connection is disconnected or requires authorization." }
    })));

    const result = await client.callTool({ name: "get_leadership_state", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result._meta).toMatchObject({ "mcp/www_authenticate": [expect.stringContaining("resource_metadata=")] });
  });
});
