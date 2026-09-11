import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveSotfMcpAccess } from "@/app/api/mcp/route";
import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

async function toolNames(sotfEnabled: boolean) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createWorkspaceMcpServer({ rpc: vi.fn() } as never, undefined, { sotfEnabled });
  const client = new Client({ name: "sotf-entitlement-test", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return (await client.listTools()).tools.map((tool) => tool.name);
}

describe("SOTF presentation entitlement gates", () => {
  it("publishes SOTF tools only after authenticated entitlement resolution", async () => {
    expect(await toolNames(true)).toEqual(expect.arrayContaining([
      "sotf_resume_transition", "sotf_prepare_next_move", "sotf_record_transition_step"
    ]));
    const disabled = await toolNames(false);
    expect(disabled).toEqual(expect.arrayContaining([
      "list_entitled_bundles", "get_bundle_manifest", "list_workflows", "get_workflow",
      "sotf_get_daily_brief_state", "sotf_record_daily_brief_outcome",
    ]));
    expect(disabled).not.toEqual(expect.arrayContaining([
      "sotf_resume_transition", "sotf_prepare_next_move", "sotf_record_transition_step",
    ]));
  });

  it("requires both the environment gate and an exact true database result", async () => {
    const rpc = vi.fn();
    vi.stubEnv("SOTF_PILOT_ENABLED", "false");
    await expect(resolveSotfMcpAccess({ rpc } as never)).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();

    vi.stubEnv("SOTF_PILOT_ENABLED", "true");
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(resolveSotfMcpAccess({ rpc } as never)).resolves.toBe(true);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(resolveSotfMcpAccess({ rpc } as never)).resolves.toBe(false);
    rpc.mockResolvedValueOnce({ data: "true", error: null });
    await expect(resolveSotfMcpAccess({ rpc } as never)).resolves.toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(resolveSotfMcpAccess({ rpc } as never)).resolves.toBe(false);
    rpc.mockRejectedValueOnce(new Error("unavailable"));
    await expect(resolveSotfMcpAccess({ rpc } as never)).resolves.toBe(false);
  });
});
