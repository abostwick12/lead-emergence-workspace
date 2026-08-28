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
  it("publishes durable, explicit Workspace controls alongside the existing tools", async () => {
    const client = await connectLewis(vi.fn(async () => ({ data: {}, error: null })));

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "get_leadership_state", "list_tasks", "create_task", "update_task", "delete_task",
      "list_captures", "resolve_capture", "dismiss_capture",
      "list_memory", "create_memory", "delete_memory",
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
