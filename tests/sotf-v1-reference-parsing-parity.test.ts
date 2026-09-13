import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dailyBriefOutcomeSchema, dailyBriefStateInputSchema } from "@/lib/sotf/daily-brief-v1";
import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

type ReferenceCase = {
  id: string;
  description: string;
  raw: string;
  parsed: string | null;
  accepted: boolean;
};

const sql = readFileSync("supabase/tests/database/sotf_v1_reference_parsing_parity.sql", "utf8");
const corpus: ReferenceCase[] = JSON.parse(sql.split("$parsing$")[1]);
const workspaceId = "80111111-1111-4111-8111-111111111111";
const authorityToken = `sha256:${"b".repeat(64)}`;
const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

function operationBatch() {
  const hypothesis = (id: string) => ({
    type: "save_hypothesis",
    hypothesis: {
      id, proposition: "Synthetic " + id, whyPromising: "It is testable", assumptions: [], gaps: [],
      nextExperiment: "Run a synthetic test", reviewTrigger: "After the test", status: "continue",
      confidenceExplanation: "Still provisional",
    },
  });
  const commands = [
    { type: "start_transition", timing: "Synthetic", question: "Which direction?", weeklyHours: 8, criteria: [], hypotheses: [] },
    hypothesis("0"), hypothesis("1"), hypothesis("a-b"), hypothesis("a_b"),
  ];
  return {
    workspace_id: workspaceId,
    revision: commands.length,
    events: commands.map((command, index) => ({
      revision: index + 1,
      recorded_at: "2026-09-13T12:" + String(index).padStart(2, "0") + ":00.000Z",
      envelope: {
        requestId: "80200000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
        expectedRevision: index, userConfirmed: true, dataClass: "ordinary_transition_operations", command,
      },
    })),
  };
}

function outcome(reference: string, sequence: number) {
  return {
    schema_version: "1",
    request_id: "80300000-0000-4000-8000-" + String(sequence).padStart(12, "0"),
    run_id: "80400000-0000-4000-8000-" + String(sequence).padStart(12, "0"),
    workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: 5,
    expected_authority_token: authorityToken,
    brief_date: "2026-09-13", time_zone: "America/Chicago", host: "chatgpt", execution_mode: "A",
    data_class: "ordinary_transition_operations", user_confirmed: true, status: "degraded",
    connector_results: { calendar_read: "not_requested", email_read: "not_requested" },
    degradation_reasons: ["state_truncated"],
    selected_le_refs: [{ entity_type: "hypothesis", entity_id: reference }],
    priority_count: 1, usefulness: "not_rated",
    provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
  };
}

async function connect(rpc: ReturnType<typeof vi.fn>) {
  vi.stubEnv("SOTF_PILOT_ENABLED", "true");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createWorkspaceMcpServer({ rpc } as never, undefined, { sotfEnabled: false });
  const client = new Client({ name: "sotf-v1-reference-parity", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return client;
}

function successfulReceipt(saved: ReturnType<typeof outcome>) {
  return {
    outcome_id: "80500000-0000-4000-8000-000000000001",
    request_id: saved.request_id, run_id: saved.run_id, workflow_id: saved.workflow_id,
    workflow_version: saved.workflow_version, state_revision: saved.expected_state_revision,
    recorded_at: "2026-09-13T12:00:00.000Z", brief_date: saved.brief_date, time_zone: saved.time_zone,
    status: saved.status, connector_results: saved.connector_results, degradation_reasons: saved.degradation_reasons,
    selected_le_refs: saved.selected_le_refs, priority_count: saved.priority_count, usefulness: saved.usefulness,
    provenance: { ...saved.provenance, workspace_id: workspaceId },
  };
}

describe("SOTF v1 exact authority-reference parsing", () => {
  it("shares at least fifteen genuinely distinct decoded-string attacks", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(15);
    expect(new Set(corpus.map((row) => row.id)).size).toBe(corpus.length);
    expect(corpus.filter((row) => row.accepted).map((row) => row.raw)).toEqual(["a-b"]);
    expect(corpus.some((row) => row.raw.includes("\u00a0"))).toBe(true);
    expect(corpus.some((row) => row.raw.includes("\u3000"))).toBe(true);
    expect(corpus.some((row) => row.raw.includes("\u2010"))).toBe(true);
    expect(corpus.some((row) => row.raw.includes("\u0009"))).toBe(true);
  });

  it.each(corpus)("$id preserves the decoded input without rewriting: $description", (row) => {
    const sequence = Number(row.id.slice(1));
    const parsed = dailyBriefOutcomeSchema.parse(outcome(row.raw, sequence));
    expect(parsed.selected_le_refs[0].entity_id).toBe(row.raw);
    expect(row.parsed).toBe(row.accepted ? row.raw : null);
  });

  it("enforces the same accept or deny result before the MCP write boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00.000Z"));
    for (let index = 0; index < corpus.length; index += 1) {
      const row = corpus[index];
      let recordCalls = 0;
      let recordedReference: string | undefined;
      const batch = operationBatch();
      const rpc = vi.fn(async (name: string, parameters?: Record<string, unknown>) => {
        if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
        if (name === "sotf_v1_probe_daily_brief_outcome") return { data: { state: "new" }, error: null };
        if (name === "sotf_read_operations") return { data: batch, error: null };
        if (name === "sotf_v1_list_daily_brief_outcomes") return { data: [], error: null };
        if (name === "sotf_v1_get_daily_brief_authority") return { data: {
          authority_version: "1", authority_token: authorityToken, authority_local_day: "2026-09-13",
          workspace_id: workspaceId, workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
          state_revision: 5, as_of: "2026-09-13T12:00:00.000Z", brief_date: "2026-09-13",
          time_zone: "America/Chicago", window_start: "2026-09-13T05:00:00.000Z",
          window_end: "2026-09-15T05:00:00.000Z",
          eligible_refs: [{ entity_type: "hypothesis", entity_id: "a-b" }],
          truncated_sections: ["hypotheses"],
        }, error: null };
        if (name === "sotf_v1_record_daily_brief_outcome") {
          recordCalls += 1;
          const saved = parameters?.outcome as ReturnType<typeof outcome>;
          recordedReference = saved.selected_le_refs[0].entity_id;
          return { data: { saved: true, replayed: false, receipt: successfulReceipt(saved) }, error: null };
        }
        return { data: null, error: { code: "unexpected", message: name } };
      });
      const client = await connect(rpc);
      const result = await client.callTool({
        name: "sotf_record_daily_brief_outcome",
        arguments: outcome(row.raw, index + 1),
      });
      expect(result.isError === true, "[SOTF-REFERENCE:" + row.id + "] " + row.description).toBe(!row.accepted);
      expect(recordCalls, "[SOTF-REFERENCE:" + row.id + "] write calls").toBe(row.accepted ? 1 : 0);
      expect(recordedReference).toBe(row.accepted ? row.raw : undefined);
      await client.close();
      closeables.splice(closeables.indexOf(client), 1);
    }
  });

  it("keeps other authority-sensitive fields exact", async () => {
    expect(dailyBriefStateInputSchema.safeParse({
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
      brief_date: "2026-09-13", time_zone: " America/Chicago ",
    }).success).toBe(false);
    const rpc = vi.fn(async (name: string) => {
      if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
      return { data: null, error: { code: "unexpected", message: name } };
    });
    const client = await connect(rpc);
    for (const argumentsValue of [
      { workflow_id: " transition.daily_brief ", workflow_version: "1.0.0" },
      { workflow_id: "transition.daily_brief", workflow_version: " 1.0.0 " },
      { workflow_id: "TRANSITION.DAILY_BRIEF", workflow_version: "1.0.0" },
    ]) {
      const result = await client.callTool({ name: "get_workflow", arguments: argumentsValue });
      expect(result.isError).toBe(true);
    }
    expect(rpc.mock.calls.some(([name]) => name === "sotf_v1_authorize_workflow_retrieval")).toBe(false);
  });

  it("does not collapse canonically equivalent Unicode spellings", () => {
    const distinct = ["é", "e\u0301", "Å", "Å", "A\u030a"];
    expect(new Set(distinct).size).toBe(distinct.length);
    expect(distinct.map((value) => value.normalize("NFC"))).not.toEqual(distinct);
    for (const value of distinct) {
      const parsed = dailyBriefOutcomeSchema.parse(outcome(value, 99));
      expect(parsed.selected_le_refs[0].entity_id).toBe(value);
    }
  });
});
