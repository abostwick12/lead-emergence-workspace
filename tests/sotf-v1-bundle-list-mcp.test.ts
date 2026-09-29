import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

const workspaceId = "73000000-0000-4000-8000-000000000001";
const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

async function connect(rpc: ReturnType<typeof vi.fn>, enabled = true) {
  vi.stubEnv("SOTF_PILOT_ENABLED", enabled ? "true" : "false");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createWorkspaceMcpServer({ rpc } as never, undefined, { sotfEnabled: false });
  const client = new Client({ name: "sotf-v1-bundle-list-test", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return client;
}

describe("SOTF v1 bundle list MCP contract", () => {
  it("registers only the entitled bundle list from the V1 tool family", async () => {
    const client = await connect(vi.fn());
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names.filter((name) => [
      "list_entitled_bundles", "get_bundle_manifest", "list_workflows", "get_workflow",
      "sotf_get_daily_brief_state", "sotf_record_daily_brief_outcome",
    ].includes(name))).toEqual(["list_entitled_bundles"]);
  });

  it("returns bounded SOTF metadata for an active entitled caller", async () => {
    const rpc = vi.fn(async () => ({ data: {
      state: "active", workspace_id: workspaceId,
      capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"],
    }, error: null }));
    const client = await connect(rpc);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({
      schema_version: "1", status: "ok", data: { bundles: [{
        bundle_key: "sotf_transition", bundle_version: "1.0.0",
        display_name: "SOTF Transition — Daily Brief",
        required_capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"],
        le_contract: "sotf_daily_brief_v1",
      }] },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("sotf_v1_access_state");
    expect(JSON.stringify(result.structuredContent)).not.toContain("steps");
    expect(JSON.stringify(result.structuredContent)).not.toContain("provider_payloads");
  });

  it("returns a successful empty list without entitlement", async () => {
    const rpc = vi.fn(async () => ({ data: { state: "entitlement_required" }, error: null }));
    const client = await connect(rpc);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ schema_version: "1", status: "ok", data: { bundles: [] } });
  });

  it("fails closed at the release gate without reading authority", async () => {
    const rpc = vi.fn();
    const client = await connect(rpc, false);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(result.structuredContent).toEqual({
      schema_version: "1", status: "error", code: "service_unavailable", retryable: true, saved: false,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps unavailable and incompatible authority states inside the V1 error contract", async () => {
    for (const state of ["incompatible_contract", "service_unavailable", "access_denied"] as const) {
      const rpc = vi.fn(async () => ({ data: { state }, error: null }));
      const client = await connect(rpc);
      const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
      expect(result.structuredContent).toMatchObject({ status: "error", code: state, saved: false });
    }
    const rpc = vi.fn(async () => ({ data: {
      state: "capability_unavailable", missing_capabilities: ["daily_brief"],
    }, error: null }));
    const client = await connect(rpc);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(result.structuredContent).toMatchObject({
      status: "error", code: "capability_unavailable", retryable: false,
      saved: false, missing_capabilities: ["daily_brief"],
    });
  });
});
