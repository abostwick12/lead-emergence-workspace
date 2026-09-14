import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

const workspaceId = "73000000-0000-4000-8000-000000000001";
const authorityToken = `sha256:${"c".repeat(64)}`;
const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

async function connect(rpc: ReturnType<typeof vi.fn>) {
  vi.stubEnv("SOTF_PILOT_ENABLED", "true");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createWorkspaceMcpServer({ rpc } as never, undefined, { sotfEnabled: false });
  const client = new Client({ name: "sotf-v1-semantic-parity-test", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(server, client);
  return client;
}

type SemanticCommand = Record<string, unknown> & { type: string };
type Outcome = ReturnType<typeof outcome>;

function operationBatch(extraCommands: SemanticCommand[] = []) {
  const commands: SemanticCommand[] = [
    {
      type: "start_transition", timing: "Fall", question: "Which work should I test?", weeklyHours: 8,
      criteria: [{ id: "criterion-old", label: "Decision ownership", dimension: "actual_work", desired: "Own a meaningful decision", nonNegotiable: false, importance: 5, confirmed: true }], hypotheses: [],
    },
    {
      type: "save_commitment",
      commitment: { id: "eligible-now", title: "Complete the reviewed follow-up", owner: "Fellow", due: "2026-09-11", definitionOfDone: "The synthetic follow-up is complete", reviewTrigger: "Before local noon" },
    },
    ...extraCommands,
  ];
  return {
    workspace_id: workspaceId,
    revision: commands.length,
    events: commands.map((command, index) => ({
      revision: index + 1,
      recorded_at: `2026-09-11T12:${String(index).padStart(2, "0")}:00.000Z`,
      envelope: {
        requestId: `76000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        expectedRevision: index, userConfirmed: true, dataClass: "ordinary_transition_operations", command,
      },
    })),
  };
}

function outcome(revision: number, sequence: number) {
  return {
    schema_version: "1",
    request_id: `76100000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    run_id: `76200000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: revision,
    expected_authority_token: authorityToken,
    brief_date: "2026-09-11", time_zone: "America/Chicago", host: "chatgpt", execution_mode: "A",
    data_class: "ordinary_transition_operations", user_confirmed: true, status: "completed",
    connector_results: { calendar_read: "used", email_read: "used" }, degradation_reasons: [] as unknown[],
    selected_le_refs: [{ entity_type: "commitment", entity_id: "eligible-now" }] as Array<Record<string, unknown>>,
    priority_count: 1, usefulness: "not_rated",
    provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
  };
}

function authorityProjection(
  revision: number,
  eligibleRefs: Array<{ entity_type: string; entity_id: string }>,
  truncatedSections: string[],
) {
  return {
    projection_version: "1", workspace_id: workspaceId,
    workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
    state_revision: revision, as_of: "2026-09-12T12:00:00.000Z", brief_date: "2026-09-11",
    time_zone: "America/Chicago", window_start: "2026-09-11T05:00:00.000Z",
    window_end: "2026-09-13T05:00:00.000Z",
    chapter: { question: "Which work should I test?", phase: "exploring", weekly_hours: 8 },
    criteria: [], opportunities: [],
    commitments: eligibleRefs.filter((reference) => reference.entity_type === "commitment").map((reference) => ({
      id: reference.entity_id, title: "Synthetic commitment", due: "2026-09-11", status: "open",
      definition_of_done: "Synthetic completion", review_trigger: "Before local noon",
    })),
    meetings: [], hypotheses: [], suggestions: [], recent_outcomes: [],
    truncated_sections: truncatedSections,
    omitted_counts: { criteria: 0, opportunities: 0, commitments: 0, meetings: 0, hypotheses: 0, recent_outcomes: 0 },
  };
}

describe("SOTF v1 outcome semantic parity", () => {
  it("feeds the authenticated RPC corpus through the MCP/application validator", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T12:00:00.000Z"));

    const longCommitment: SemanticCommand = {
      type: "save_commitment",
      commitment: { id: "long-commitment", title: "Bounded semantic fixture", owner: "Fellow", due: "2026-09-11", definitionOfDone: "x".repeat(501), reviewTrigger: "Review after the synthetic test" },
    };
    const cases: Array<{
      id: string;
      description: string;
      extra?: SemanticCommand[];
      accepted: boolean;
      mutate?: (value: Outcome) => Record<string, unknown>;
    }> = [
      { id: "C01", description: "false plus empty projection", accepted: true },
      { id: "C02", description: "true plus non-empty valid sections", extra: [longCommitment], accepted: true, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: ["state_truncated"], selected_le_refs: [{ entity_type: "commitment", entity_id: "long-commitment" }] }) },
      { id: "C03", description: "true plus empty projection", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: ["state_truncated"] }) },
      { id: "C04", description: "false plus non-empty projection", extra: [longCommitment], accepted: false, mutate: (value) => ({ ...value, selected_le_refs: [], priority_count: 0 }) },
      { id: "C05", description: "missing redundant boolean means the reason is absent", accepted: true },
      { id: "C06", description: "missing caller sections is canonical because sections are server-derived", accepted: true },
      { id: "C07", description: "JSON-null declaration", accepted: false, mutate: (value) => ({ ...value, degradation_reasons: null }) },
      { id: "C08", description: "wrong-type declaration", accepted: false, mutate: (value) => ({ ...value, degradation_reasons: "state_truncated" }) },
      { id: "C09", description: "duplicate declaration", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: ["state_truncated", "state_truncated"] }) },
      { id: "C10", description: "unsupported section name used as a reason", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: ["criteria"] }) },
      { id: "C11", description: "empty-string declaration", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: [""] }) },
      { id: "C12", description: "whitespace-only declaration", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: ["   "] }) },
      { id: "C13", description: "malformed nested declaration", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: [["state_truncated"]] }) },
      { id: "C14", description: "caller-supplied empty sections field", accepted: false, mutate: (value) => ({ ...value, truncated_sections: [] }) },
      { id: "C15", description: "caller-supplied redundant boolean", accepted: false, mutate: (value) => ({ ...value, state_truncated: true }) },
      { id: "C16", description: "historically present but future-filtered commitment reference", extra: [{ type: "save_commitment", commitment: { id: "future-commitment", title: "Future synthetic work", owner: "Fellow", due: "2026-10-11", definitionOfDone: "Future work completed", reviewTrigger: "At the future date" } }], accepted: false, mutate: (value) => ({ ...value, selected_le_refs: [{ entity_type: "commitment", entity_id: "future-commitment" }] }) },
      { id: "C17", description: "historically present but resolved commitment reference", extra: [{ type: "resolve_commitment", commitmentId: "eligible-now", status: "done", evidence: "Synthetic completion" }], accepted: false },
      { id: "C18", description: "historically present but replaced criterion reference", extra: [{ type: "confirm_criteria", reason: "Synthetic replacement", criteria: [{ id: "criterion-new", label: "Current criterion", dimension: "actual_work", desired: "Current desired state", nonNegotiable: false, importance: 5, confirmed: true }] }], accepted: false, mutate: (value) => ({ ...value, selected_le_refs: [{ entity_type: "criterion", entity_id: "criterion-old" }] }) },
      { id: "C19", description: "historically present but rejected hypothesis reference", extra: [
        { type: "save_hypothesis", hypothesis: { id: "direction-old", proposition: "A synthetic direction", whyPromising: "It is testable", assumptions: [], gaps: [], nextExperiment: "Run a synthetic test", reviewTrigger: "After the test", status: "continue", confidenceExplanation: "Still provisional" } },
        { type: "save_hypothesis", hypothesis: { id: "direction-old", proposition: "A synthetic direction", whyPromising: "It was testable", assumptions: [], gaps: [], nextExperiment: "No further experiment", reviewTrigger: "If new evidence appears", status: "reject", confidenceExplanation: "Synthetic rejection" } },
      ], accepted: false, mutate: (value) => ({ ...value, selected_le_refs: [{ entity_type: "hypothesis", entity_id: "direction-old" }] }) },
      { id: "C20", description: "historically present but paused opportunity reference", extra: [
        { type: "record_opportunity", opportunity: { id: "paused-opportunity", company: "Synthetic Company", role: "Synthetic Role", description: "", hypothesisIds: [], requirements: [], deadline: "2026-09-11", actualWork: "", decisionQuestion: "Should this synthetic role continue?" } },
        { type: "decide_opportunity", opportunityId: "paused-opportunity", decision: "pause", rationale: "Synthetic pause", nextAction: "Wait for synthetic evidence", revisitWhen: "When evidence changes" },
      ], accepted: false, mutate: (value) => ({ ...value, selected_le_refs: [{ entity_type: "opportunity", entity_id: "paused-opportunity" }] }) },
      { id: "C21", description: "historically present but outside-window meeting reference", extra: [{ type: "record_meeting", meeting: { id: "outside-window", title: "Future synthetic meeting", hypothesisIds: [], kind: "networking", startsAt: "2026-09-21T12:00:00.000Z", endsAt: "2026-09-21T13:00:00.000Z", status: "planned", provider: "manual", objective: "Synthetic future discussion" } }], accepted: false, mutate: (value) => ({ ...value, selected_le_refs: [{ entity_type: "meeting", entity_id: "outside-window" }] }) },
      { id: "C23", description: "stale true declaration against an untruncated projection", accepted: false, mutate: (value) => ({ ...value, status: "degraded", degradation_reasons: ["state_truncated"], selected_le_refs: [], priority_count: 0 }) },
      { id: "C24", description: "stale revision with otherwise valid semantics", accepted: false, mutate: (value) => ({ ...value, expected_state_revision: value.expected_state_revision - 1 }) },
    ];

    for (const [index, testCase] of cases.entries()) {
      const batch = operationBatch(testCase.extra);
      const base = outcome(batch.revision, index + 1);
      const candidate = testCase.mutate ? testCase.mutate(base) : base;
      const hasLongCommitment = testCase.id === "C02" || testCase.id === "C04";
      const eligibleRefs = testCase.id === "C17" ? [] : [
        { entity_type: "commitment", entity_id: "eligible-now" },
        ...(hasLongCommitment ? [{ entity_type: "commitment", entity_id: "long-commitment" }] : []),
      ];
      let recordCalls = 0;
      const rpc = vi.fn(async (name: string, parameters?: { outcome?: Record<string, unknown> }) => {
        if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
        if (name === "sotf_v1_probe_daily_brief_outcome") return { data: { state: "new" }, error: null };
        if (name === "sotf_read_operations") return { data: batch, error: null };
        if (name === "sotf_v1_list_daily_brief_outcomes") return { data: [], error: null };
        if (name === "sotf_v1_get_daily_brief_authority") return { data: {
          authority_version: "1", authority_token: authorityToken, authority_local_day: "2026-09-12",
          workspace_id: workspaceId, workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
          state_revision: batch.revision, as_of: "2026-09-12T12:00:00.000Z", brief_date: "2026-09-11",
          time_zone: "America/Chicago", window_start: "2026-09-11T05:00:00.000Z",
          window_end: "2026-09-13T05:00:00.000Z", eligible_refs: eligibleRefs,
          truncated_sections: hasLongCommitment ? ["commitments"] : [],
          projection_fingerprint: `sha256:${"d".repeat(64)}`,
          projection: authorityProjection(batch.revision, eligibleRefs, hasLongCommitment ? ["commitments"] : []),
        }, error: null };
        if (name === "sotf_v1_record_daily_brief_outcome") {
          recordCalls += 1;
          const saved = parameters?.outcome ?? candidate;
          return { data: { saved: true, replayed: false, receipt: {
            outcome_id: "76300000-0000-4000-8000-000000000001", request_id: saved.request_id, run_id: saved.run_id,
            workflow_id: saved.workflow_id, workflow_version: saved.workflow_version, state_revision: saved.expected_state_revision,
            recorded_at: "2026-09-12T12:00:00.000Z", brief_date: saved.brief_date, time_zone: saved.time_zone,
            status: saved.status, connector_results: saved.connector_results, degradation_reasons: saved.degradation_reasons,
            selected_le_refs: saved.selected_le_refs, priority_count: saved.priority_count, usefulness: saved.usefulness,
            provenance: { ...(saved.provenance as object), workspace_id: workspaceId },
          } }, error: null };
        }
        return { data: null, error: { code: "unexpected", message: name } };
      });
      const client = await connect(rpc);
      const result = await client.callTool({ name: "sotf_record_daily_brief_outcome", arguments: candidate });
      expect(result.isError === true, `[SOTF-PARITY:${testCase.id}] ${testCase.description}`).toBe(!testCase.accepted);
      expect(recordCalls, `[SOTF-PARITY:${testCase.id}] ${testCase.description}`).toBe(testCase.accepted ? 1 : 0);
    }
  });

  it("[SOTF-PARITY:C22] accepts an exact stored replay after the projection changes", async () => {
    const stored = outcome(3, 22);
    const receipt = {
      outcome_id: "76300000-0000-4000-8000-000000000022", request_id: stored.request_id, run_id: stored.run_id,
      workflow_id: stored.workflow_id, workflow_version: stored.workflow_version, state_revision: stored.expected_state_revision,
      recorded_at: "2026-09-12T12:00:00.000Z", brief_date: stored.brief_date, time_zone: stored.time_zone,
      status: stored.status, connector_results: stored.connector_results, degradation_reasons: stored.degradation_reasons,
      selected_le_refs: stored.selected_le_refs, priority_count: stored.priority_count, usefulness: stored.usefulness,
      provenance: { ...stored.provenance, workspace_id: workspaceId },
    };
    const rpc = vi.fn(async (name: string) => {
      if (name === "sotf_v1_access_state") return { data: { state: "active", workspace_id: workspaceId, capabilities: ["core_workspace", "workspace_mcp", "career", "daily_brief", "agentic_workflows"] }, error: null };
      if (name === "sotf_v1_probe_daily_brief_outcome") return { data: { state: "replay", receipt }, error: null };
      return { data: null, error: { code: "unexpected", message: name } };
    });
    const client = await connect(rpc);
    const result = await client.callTool({ name: "sotf_record_daily_brief_outcome", arguments: stored });
    expect(result.structuredContent).toMatchObject({ status: "ok", data: { saved: true, replayed: true } });
    expect(rpc.mock.calls.some(([name]) => name === "sotf_v1_record_daily_brief_outcome")).toBe(false);
  });
});
