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
  const client = new Client({ name: "sotf-v1-contract-test", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return client;
}

function data(result: Awaited<ReturnType<Client["callTool"]>>) {
  return result.structuredContent as { schema_version: string; status: string; code?: string; data?: Record<string, unknown> };
}

function operationBatch() {
  return {
    workspace_id: workspaceId, revision: 1,
    events: [{
      revision: 1, recorded_at: "2026-09-11T12:00:00.000Z",
      envelope: {
        requestId: "73000000-0000-4000-8000-000000000010", expectedRevision: 0, userConfirmed: true,
        dataClass: "ordinary_transition_operations",
        command: { type: "start_transition", timing: "Fall", question: "Which work should I test?", weeklyHours: 8, criteria: [], hypotheses: [] },
      },
    }],
  };
}

describe("SOTF v1 MCP contract", () => {
  it("fails closed at the application release gate without querying authority", async () => {
    const rpc = vi.fn();
    const client = await connect(rpc, false);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(data(result)).toMatchObject({ schema_version: "1", status: "error", code: "service_unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns no catalog entries for a caller without current entitlement", async () => {
    const rpc = vi.fn(async (name: string) => name === "sotf_v1_access_state"
      ? { data: { state: "entitlement_required" }, error: null }
      : { data: null, error: { code: "unexpected" } });
    const client = await connect(rpc);
    const result = await client.callTool({ name: "list_entitled_bundles", arguments: {} });
    expect(data(result)).toMatchObject({ status: "ok", data: { bundles: [] } });
  });

  it("retrieves only the entitled current or exact declarative workflow", async () => {
    const rpc = vi.fn(async () => ({ data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null }));
    const client = await connect(rpc);
    const current = await client.callTool({ name: "get_workflow", arguments: { workflow_id: "transition.daily_brief" } });
    expect(data(current)).toMatchObject({ status: "ok", data: { contract_version: "sotf_daily_brief_v1", workflow: { workflow_version: "1.0.0", execution_mode: "A", allowed_write_backs: ["sotf_record_daily_brief_outcome"] } } });
    expect(rpc).toHaveBeenCalledWith("sotf_v1_authorize_workflow_retrieval", {
      p_workflow_id: "transition.daily_brief", p_workflow_version: "1.0.0",
    });
    const missing = await client.callTool({ name: "get_workflow", arguments: { workflow_id: "transition.daily_brief", workflow_version: "2.0.0" } });
    expect(data(missing)).toMatchObject({ status: "error", code: "version_not_available" });
  });

  it("rejects an unsupported host contract and unknown input fields without retrieval", async () => {
    const incompatibleRpc = vi.fn(async () => ({ data: { state: "incompatible_contract" }, error: null }));
    const incompatible = await connect(incompatibleRpc);
    expect(data(await incompatible.callTool({ name: "get_workflow", arguments: { workflow_id: "transition.daily_brief" } })))
      .toMatchObject({ status: "error", code: "incompatible_contract" });

    const strictRpc = vi.fn();
    const strict = await connect(strictRpc);
    const rejected = await strict.callTool({ name: "get_workflow", arguments: { workflow_id: "transition.daily_brief", workspace_id: workspaceId } });
    expect(rejected.isError).toBe(true);
    expect(JSON.stringify(rejected)).toContain("Unrecognized key");
    expect(strictRpc).not.toHaveBeenCalled();
  });

  it("returns a bounded state projection and never exposes the event batch", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
      if (name === "sotf_read_operations") return { data: operationBatch(), error: null };
      if (name === "sotf_v1_list_daily_brief_outcomes") return { data: [], error: null };
      return { data: null, error: { code: "unexpected", message: name } };
    });
    const client = await connect(rpc);
    const result = await client.callTool({ name: "sotf_get_daily_brief_state", arguments: {
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0", brief_date: "2026-09-11", time_zone: "America/Chicago",
    } });
    expect(data(result)).toMatchObject({ status: "ok", data: { workspace_id: workspaceId, state_revision: 1, workflow_id: "transition.daily_brief" } });
    expect(JSON.stringify(data(result))).not.toContain("events");
    expect(JSON.stringify(data(result))).not.toContain("envelope");
  });

  it("saves one confirmed metadata outcome and maps an exact retry to replay", async () => {
    const receipt = { outcome_id: "73000000-0000-4000-8000-000000000020", request_id: "73000000-0000-4000-8000-000000000021", run_id: "73000000-0000-4000-8000-000000000022", workflow_id: "transition.daily_brief", workflow_version: "1.0.0", state_revision: 1, recorded_at: "2026-09-11T13:00:00.000Z", brief_date: "2026-09-11", time_zone: "America/Chicago", status: "completed", connector_results: { calendar_read: "used", email_read: "used" }, degradation_reasons: [], selected_le_refs: [], priority_count: 0, usefulness: "not_rated", provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false, workspace_id: workspaceId } };
    let replay = false;
    const rpc = vi.fn(async (name: string) => {
      if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
      if (name === "sotf_v1_probe_daily_brief_outcome") return { data: replay ? { state: "replay", receipt } : { state: "new" }, error: null };
      if (name === "sotf_read_operations") return { data: operationBatch(), error: null };
      if (name === "sotf_v1_list_daily_brief_outcomes") return { data: [], error: null };
      if (name === "sotf_v1_record_daily_brief_outcome") { replay = true; return { data: { saved: true, replayed: false, receipt }, error: null }; }
      return { data: null, error: { code: "unexpected", message: name } };
    });
    const client = await connect(rpc);
    const outcome = {
      schema_version: "1", request_id: receipt.request_id, run_id: receipt.run_id,
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: 1,
      brief_date: "2026-09-11", time_zone: "America/Chicago", host: "chatgpt", execution_mode: "A",
      data_class: "ordinary_transition_operations", user_confirmed: true, status: "completed",
      connector_results: { calendar_read: "used", email_read: "used" }, degradation_reasons: [],
      selected_le_refs: [], priority_count: 0, usefulness: "not_rated",
      provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
    };
    expect(data(await client.callTool({ name: "sotf_record_daily_brief_outcome", arguments: outcome }))).toMatchObject({ status: "ok", data: { saved: true, replayed: false } });
    expect(data(await client.callTool({ name: "sotf_record_daily_brief_outcome", arguments: outcome }))).toMatchObject({ status: "ok", data: { saved: true, replayed: true } });
    expect(rpc.mock.calls.filter(([name]) => name === "sotf_v1_record_daily_brief_outcome")).toHaveLength(1);
  });

  it("reports an uncertain write result without claiming the outcome was absent", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
      if (name === "sotf_v1_probe_daily_brief_outcome") return { data: { state: "new" }, error: null };
      if (name === "sotf_read_operations") return { data: operationBatch(), error: null };
      if (name === "sotf_v1_list_daily_brief_outcomes") return { data: [], error: null };
      if (name === "sotf_v1_record_daily_brief_outcome") throw new Error("reply lost");
      return { data: null, error: { code: "unexpected", message: name } };
    });
    const client = await connect(rpc);
    const result = await client.callTool({ name: "sotf_record_daily_brief_outcome", arguments: {
      schema_version: "1", request_id: "73000000-0000-4000-8000-000000000031", run_id: "73000000-0000-4000-8000-000000000032",
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: 1,
      brief_date: "2026-09-11", time_zone: "America/Chicago", host: "chatgpt", execution_mode: "A",
      data_class: "ordinary_transition_operations", user_confirmed: true, status: "completed",
      connector_results: { calendar_read: "used", email_read: "used" }, degradation_reasons: [],
      selected_le_refs: [], priority_count: 0, usefulness: "not_rated",
      provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
    } });
    expect(result.structuredContent).toMatchObject({ status: "error", code: "result_unknown", saved: null, retryable: true });
  });

  it("keeps the bootstrap as discovery instructions instead of embedding the workflow body", async () => {
    const client = await connect(vi.fn());
    const prompt = await client.getPrompt({ name: "sotf_daily_brief_bootstrap" });
    const text = JSON.stringify(prompt);
    expect(text).toContain("retrieve its current hosted contract");
    expect(text).not.toContain("step_id");
    expect(text).not.toContain("decision_rules");
  });
});
