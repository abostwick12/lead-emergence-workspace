import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

const workspaceId = "73000000-0000-4000-8000-000000000001";
const skillId = "sotf.skill.transition_loop";
const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

async function connect(rpc: ReturnType<typeof vi.fn>, enabled = true) {
  vi.stubEnv("SOTF_PILOT_ENABLED", enabled ? "true" : "false");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  // The existing list-tool family stays discoverable even when SOTF operations
  // are disabled. Per-call admission must still be checked by the new tool.
  const server = createWorkspaceMcpServer({ rpc } as never, undefined, { sotfEnabled: false });
  const client = new Client({ name: "on-demand-sotf-skill-test", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return client;
}

const active = {
  state: "active", workspace_id: workspaceId,
  capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"],
};

describe("on-demand SOTF skill delivery through Lewis", () => {
  it("advertises one named skill tool without exposing instructions in discovery", async () => {
    const rpc = vi.fn();
    const client = await connect(rpc);
    const listed = await client.listTools();
    const tool = listed.tools.find((item) => item.name === "get_sotf_skill_instructions");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("current conversation");
    expect(JSON.stringify(listed.tools)).not.toContain("# SOTF transition loop");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("delivers only the requested instructions to an active entitled customer", async () => {
    const rpc = vi.fn(async () => ({ data: active, error: null }));
    const client = await connect(rpc);
    const result = await client.callTool({
      name: "get_sotf_skill_instructions", arguments: { skill_id: skillId },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      schema_version: "1", status: "ok",
      skill: { skill_id: skillId, bundle_key: "sotf_transition" },
    });
    const instructions = (result.structuredContent as { skill: { instructions: string } }).skill.instructions;
    expect(instructions).toContain("# SOTF transition loop");
    expect(instructions).toContain("## Preserve user control");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("sotf_v1_bundle_list_access_state");
  });

  it.each(["entitlement_required", "access_denied", "capability_unavailable", "incompatible_contract"] as const)(
    "denies instructions when authority reports %s", async (state) => {
      const rpc = vi.fn(async () => ({ data: state === "capability_unavailable"
        ? { state, missing_capabilities: ["career"] } : { state }, error: null }));
      const client = await connect(rpc);
      const result = await client.callTool({
        name: "get_sotf_skill_instructions", arguments: { skill_id: skillId },
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({ schema_version: "1", status: "error", code: state });
      expect(JSON.stringify(result)).not.toContain("# SOTF transition loop");
    },
  );

  it("fails closed when the SOTF pilot release is disabled, without invoking authority", async () => {
    const rpc = vi.fn();
    const client = await connect(rpc, false);
    const result = await client.callTool({
      name: "get_sotf_skill_instructions", arguments: { skill_id: skillId },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      schema_version: "1", status: "error", code: "service_unavailable",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the authority read fails", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "backend unavailable" } }));
    const client = await connect(rpc);
    const result = await client.callTool({
      name: "get_sotf_skill_instructions", arguments: { skill_id: skillId },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      schema_version: "1", status: "error", code: "service_unavailable",
    });
    expect(JSON.stringify(result)).not.toContain("backend unavailable");
  });

  it("does not accept arbitrary skill IDs or paths", async () => {
    const rpc = vi.fn(async () => ({ data: active, error: null }));
    const client = await connect(rpc);
    const result = await client.callTool({
      name: "get_sotf_skill_instructions", arguments: { skill_id: "../writer-editor/SKILL.md" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("# SOTF transition loop");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps the existing entitled bundle list free of skill bodies", async () => {
    const rpc = vi.fn(async () => ({ data: active, error: null }));
    const client = await connect(rpc);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).not.toContain("# SOTF transition loop");
  });
});
