import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  dailyBriefOutcomeReceiptSchema,
  dailyBriefOutcomeSchema,
  dailyBriefStateProjectionSchema,
  dailyBriefStateInputSchema,
  DailyBriefContractError,
  isDailyBriefReferenceEligible,
  projectDailyBriefState,
} from "./daily-brief-v1";
import { createSotfStore } from "./server";
import {
  getSotfV1Bundle,
  getSotfV1Workflow,
  listSotfV1Bundles,
  listSotfV1Workflows,
  SOTF_DAILY_BRIEF_CONTRACT,
  sotfV1BundleManifestSchema,
  sotfV1WorkflowContractSchema,
} from "./workflow-catalog";

const oauth = { securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }] } as const;
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const catalogId = z.string().trim().min(1).max(100);
const semanticVersion = z.string().trim().regex(/^\d+\.\d+\.\d+$/).max(32);
const bundleSummarySchema = z.strictObject({
  bundle_key: z.literal("sotf_transition"), bundle_version: z.literal("1.0.0"),
  display_name: z.string().min(1).max(240),
  required_capabilities: z.tuple([
    z.literal("core_workspace"), z.literal("workspace_mcp"), z.literal("career"),
    z.literal("daily_brief"), z.literal("agentic_workflows"),
  ]),
  le_contract: z.literal(SOTF_DAILY_BRIEF_CONTRACT),
});
const workflowSummarySchema = z.strictObject({
  workflow_id: z.literal("transition.daily_brief"), current_version: z.literal("1.0.0"),
  title: z.string().min(1).max(240), description: z.string().min(1).max(1000), execution_mode: z.literal("A"),
});

const accessStateSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("active"), workspace_id: z.string().uuid(), capabilities: z.array(z.string()).max(20) }),
  z.strictObject({ state: z.literal("service_unavailable") }),
  z.strictObject({ state: z.literal("incompatible_contract") }),
  z.strictObject({ state: z.literal("entitlement_required") }),
  z.strictObject({ state: z.literal("capability_unavailable"), missing_capabilities: z.array(z.string()).min(1).max(20) }),
  z.strictObject({ state: z.literal("access_denied") }),
]);
const outcomeProbeSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("new") }),
  z.strictObject({ state: z.literal("conflict") }),
  z.strictObject({ state: z.literal("replay"), receipt: dailyBriefOutcomeReceiptSchema }),
]);
const storedOutcomeSchema = z.strictObject({
  saved: z.literal(true), replayed: z.boolean(), receipt: dailyBriefOutcomeReceiptSchema,
});

const v1ErrorCodes = [
  "authentication_required", "access_denied", "entitlement_required", "capability_unavailable",
  "not_available", "version_not_available", "incompatible_contract", "service_unavailable",
  "transition_not_started", "invalid_input", "state_changed", "idempotency_conflict",
  "capacity_reached", "result_unknown",
] as const;
type V1ErrorCode = typeof v1ErrorCodes[number];
function outputFor<T extends z.ZodType>(data: T) {
  return {
    outputSchema: z.strictObject({
      schema_version: z.literal("1"), status: z.enum(["ok", "error"]), data: data.optional(),
      code: z.enum(v1ErrorCodes).optional(), retryable: z.boolean().optional(),
      saved: z.union([z.literal(false), z.null()]).optional(),
      missing_capabilities: z.array(z.string()).max(20).optional(),
    }).superRefine((value, context) => {
      if (value.status === "ok" && value.data === undefined) {
        context.addIssue({ code: "custom", path: ["data"], message: "Successful responses require data." });
      }
      if (value.status === "error" && (value.code === undefined || value.retryable === undefined || value.saved === undefined || value.data !== undefined)) {
        context.addIssue({ code: "custom", message: "Error responses require code, retryable, and saved, with no data." });
      }
    }),
    _meta: oauth,
  } as const;
}

export function registerSotfV1Tools(
  server: McpServer,
  client: SupabaseClient<any, any, any, any, any>,
  options: { releaseEnabled: boolean },
) {
  server.registerTool("list_entitled_bundles", {
    title: "List entitled Lead Emergence bundles",
    description: "List the currently entitled SOTF v1 bundle metadata. This reads current authority and never returns a hosted workflow body or user state.",
    inputSchema: z.strictObject({}), annotations: readOnly,
    ...outputFor(z.strictObject({ bundles: z.array(bundleSummarySchema).max(1) })),
  }, () => invoke(async () => {
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state === "entitlement_required") return ok({ bundles: [] });
    if (access.state !== "active") return accessFailure(access);
    return ok({ bundles: listSotfV1Bundles() });
  }));

  server.registerTool("get_bundle_manifest", {
    title: "Get an entitled SOTF bundle manifest",
    description: "Retrieve the static portable/bootstrap manifest for a currently authorized bundle. It contains workflow references, not the hosted workflow body.",
    inputSchema: z.strictObject({ bundle_key: catalogId }), annotations: readOnly,
    ...outputFor(sotfV1BundleManifestSchema),
  }, (input) => invoke(async () => {
    const parsed = z.strictObject({ bundle_key: catalogId }).parse(input);
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state !== "active") return accessFailure(access);
    const bundle = getSotfV1Bundle(parsed.bundle_key);
    return bundle.ok ? ok(bundle.value) : fail(bundle.code, false);
  }));

  server.registerTool("list_workflows", {
    title: "List entitled SOTF workflows",
    description: "List version metadata for the bounded workflows referenced by one currently authorized bundle. This does not execute a workflow.",
    inputSchema: z.strictObject({ bundle_key: catalogId }), annotations: readOnly,
    ...outputFor(z.strictObject({ workflows: z.array(workflowSummarySchema).max(1) })),
  }, (input) => invoke(async () => {
    const parsed = z.strictObject({ bundle_key: catalogId }).parse(input);
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state !== "active") return accessFailure(access);
    const workflows = listSotfV1Workflows(parsed.bundle_key);
    return workflows.ok ? ok({ workflows: workflows.value }) : fail(workflows.code, false);
  }));

  server.registerTool("get_workflow", {
    title: "Get an entitled hosted workflow",
    description: "Retrieve one current or exact immutable declarative SOTF workflow contract. The host executes its steps; this read performs no user-state mutation.",
    inputSchema: z.strictObject({ workflow_id: catalogId, workflow_version: semanticVersion.optional() }), annotations: readOnly,
    ...outputFor(z.strictObject({ contract_version: z.literal(SOTF_DAILY_BRIEF_CONTRACT), workflow: sotfV1WorkflowContractSchema })),
  }, (input) => invoke(async () => {
    const parsed = z.strictObject({ workflow_id: catalogId, workflow_version: semanticVersion.optional() }).parse(input);
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state !== "active") return accessFailure(access);
    const workflow = getSotfV1Workflow(parsed.workflow_id, parsed.workflow_version);
    if (!workflow.ok) return fail(workflow.code, false);
    const deliveryAccess = parseReadResult(accessStateSchema, await callRpc(client, "sotf_v1_authorize_workflow_retrieval", {
      p_workflow_id: workflow.value.workflow_id,
      p_workflow_version: workflow.value.workflow_version,
    }));
    if (deliveryAccess.state !== "active") return accessFailure(deliveryAccess);
    return ok({ contract_version: SOTF_DAILY_BRIEF_CONTRACT, workflow: workflow.value });
  }));

  server.registerTool("sotf_get_daily_brief_state", {
    title: "Get bounded SOTF daily-brief state",
    description: "Read only the ordinary SOTF records authorized for transition.daily_brief. Provider content, protected context, and the broad operational event log are excluded.",
    inputSchema: dailyBriefStateInputSchema, annotations: readOnly,
    ...outputFor(dailyBriefStateProjectionSchema),
  }, (input) => invoke(async () => {
    const parsed = dailyBriefStateInputSchema.parse(input);
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state !== "active") return accessFailure(access);
    const workflow = getSotfV1Workflow(parsed.workflow_id, parsed.workflow_version);
    if (!workflow.ok) return fail(workflow.code, false);
    const [{ state, workspaceId }, outcomes] = await Promise.all([
      createSotfStore(client).read(),
      readOutcomes(client, parsed.workflow_version),
    ]);
    if (workspaceId !== access.workspace_id) return fail("access_denied", false);
    return ok(projectDailyBriefState(state, workspaceId, parsed, outcomes));
  }));

  server.registerTool("sotf_record_daily_brief_outcome", {
    title: "Save a reviewed SOTF daily-brief outcome",
    description: "Persist only explicitly reviewed daily-brief metadata. This never saves the brief, provider content, inferred preferences, or arbitrary state.",
    inputSchema: dailyBriefOutcomeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...outputFor(storedOutcomeSchema),
  }, (input) => invoke(async () => {
    const parsed = dailyBriefOutcomeSchema.parse(input);
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state !== "active") return accessFailure(access);
    const workflow = getSotfV1Workflow(parsed.workflow_id, parsed.workflow_version);
    if (!workflow.ok) return fail(workflow.code, false);

    const probe = parseReadResult(outcomeProbeSchema, await callRpc(client, "sotf_v1_probe_daily_brief_outcome", { outcome: parsed }));
    if (probe.state === "replay") return ok({ saved: true, replayed: true, receipt: probe.receipt });
    if (probe.state === "conflict") return fail("idempotency_conflict", false);

    const [{ state, workspaceId }, outcomes] = await Promise.all([
      createSotfStore(client).read(),
      readOutcomes(client, parsed.workflow_version),
    ]);
    if (workspaceId !== access.workspace_id) return fail("access_denied", false);
    const projection = projectDailyBriefState(state, workspaceId, {
      workflow_id: parsed.workflow_id,
      workflow_version: parsed.workflow_version,
      brief_date: parsed.brief_date,
      time_zone: parsed.time_zone,
    }, outcomes);
    if (projection.state_revision !== parsed.expected_state_revision) return fail("state_changed", false);
    if (parsed.selected_le_refs.some((reference) => !isDailyBriefReferenceEligible(projection, reference))) {
      return fail("invalid_input", false);
    }
    const truncated = projection.truncated_sections.length > 0;
    if (truncated !== parsed.degradation_reasons.includes("state_truncated")) return fail("invalid_input", false);

    try {
      const stored = await callRpc(client, "sotf_v1_record_daily_brief_outcome", { outcome: parsed });
      return ok(storedOutcomeSchema.parse(stored));
    } catch (error) {
      if (error instanceof SotfV1RpcError && isDefinitiveWriteRejection(error.code)) throw error;
      throw new SotfV1RpcError("result_unknown", "The outcome may have been saved; retry with the exact same IDs and payload.");
    }
  }));

  server.registerPrompt("sotf_daily_brief_bootstrap", {
    title: "Start my SOTF daily brief",
    description: "Portable bootstrap for discovering the entitled hosted daily-brief contract without embedding its workflow body.",
  }, async () => ({ messages: [{ role: "user", content: { type: "text", text: "Help me run today's SOTF daily brief. Check onboarding, list my entitled bundles, retrieve the SOTF manifest, identify transition.daily_brief, and retrieve its current hosted contract before using any Lead Emergence state. Inspect the contract's required host capabilities and stop if any are missing; treat unavailable optional calendar/email reads only as the documented degradation. Follow the contract in this ChatGPT session. Use only my ChatGPT-authorized external tools, keep provider content in ChatGPT, show the exact outcome metadata before asking whether to save it, and stop Lead Emergence workflow use if current access cannot be verified." } }] }));
}

async function resolveAccess(client: SupabaseClient<any, any, any, any, any>, releaseEnabled: boolean) {
  if (!releaseEnabled) return { state: "service_unavailable" as const };
  try {
    const value = await callRpc(client, "sotf_v1_access_state");
    return accessStateSchema.parse(value);
  } catch {
    return { state: "service_unavailable" as const };
  }
}

async function readOutcomes(client: SupabaseClient<any, any, any, any, any>, workflowVersion: string) {
  const value = await callRpc(client, "sotf_v1_list_daily_brief_outcomes", { p_workflow_version: workflowVersion });
  return parseReadResult(z.array(dailyBriefOutcomeReceiptSchema).max(3), value);
}

function parseReadResult<T>(schema: z.ZodType<T>, value: unknown): T {
  try { return schema.parse(value); }
  catch { throw new SotfV1RpcError("service_unavailable", "SOTF v1 returned an incompatible read result."); }
}

function isDefinitiveWriteRejection(code: V1ErrorCode) {
  return new Set<V1ErrorCode>([
    "authentication_required", "access_denied", "entitlement_required", "capability_unavailable",
    "not_available", "version_not_available", "incompatible_contract", "transition_not_started",
    "invalid_input", "state_changed", "idempotency_conflict", "capacity_reached",
  ]).has(code);
}

async function callRpc(client: SupabaseClient<any, any, any, any, any>, name: string, args?: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new SotfV1RpcError(rpcErrorCode(error), error.message ?? "SOTF v1 operation failed.");
  return data;
}

class SotfV1RpcError extends Error {
  constructor(readonly code: V1ErrorCode, message: string) { super(message); }
}

function rpcErrorCode(error: { code?: string; message?: string }): V1ErrorCode {
  const tagged = /sotf_v1:([a-z_]+)/.exec(error.message ?? "")?.[1];
  if (tagged && (v1ErrorCodes as readonly string[]).includes(tagged)) return tagged as V1ErrorCode;
  if (error.code === "42501") return "access_denied";
  if (error.code === "22023") return "invalid_input";
  if (error.code === "40001") return "state_changed";
  return "service_unavailable";
}

async function invoke(operation: () => Promise<ReturnType<typeof ok> | ReturnType<typeof fail>>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof SotfV1RpcError) return fail(error.code, error.code === "service_unavailable" || error.code === "result_unknown");
    if (error instanceof DailyBriefContractError) return fail(error.code, false);
    if (error instanceof z.ZodError) return fail("invalid_input", false);
    return fail("service_unavailable", true);
  }
}

function accessFailure(access: Exclude<Awaited<ReturnType<typeof resolveAccess>>, { state: "active" }>) {
  if (access.state === "capability_unavailable") return fail("capability_unavailable", false, { missing_capabilities: access.missing_capabilities });
  return fail(access.state, access.state === "service_unavailable");
}

function ok<T>(data: T) {
  const value = { schema_version: "1", status: "ok" as const, data };
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}

function fail(code: V1ErrorCode, retryable: boolean, details?: Record<string, unknown>) {
  const value = { schema_version: "1", status: "error" as const, code, retryable, saved: code === "result_unknown" ? null : false, ...details };
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}
