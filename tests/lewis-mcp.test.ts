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
  it("publishes durable, explicit task controls alongside the existing tools", async () => {
    const client = await connectLewis(vi.fn(async () => ({ data: {}, error: null })));

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["get_leadership_state", "list_tasks", "create_task", "update_task", "delete_task"]));

    const create = tools.tools.find((tool) => tool.name === "create_task");
    const remove = tools.tools.find((tool) => tool.name === "delete_task");
    expect(create?.inputSchema.required).toEqual(expect.arrayContaining(["title", "request_id", "user_confirmed"]));
    expect(create?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    expect(create?._meta).toMatchObject({ securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }] });
    expect(remove?.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
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
