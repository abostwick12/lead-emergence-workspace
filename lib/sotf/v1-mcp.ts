import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { listSotfV1Bundles, SOTF_DAILY_BRIEF_CONTRACT } from "./workflow-catalog";

const oauth = { securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }] } as const;
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const bundleSummarySchema = z.strictObject({
  bundle_key: z.literal("sotf_transition"), bundle_version: z.literal("1.0.0"),
  display_name: z.string().min(1).max(240),
  required_capabilities: z.tuple([
    z.literal("core_workspace"), z.literal("workspace_mcp"), z.literal("career"),
    z.literal("daily_brief"), z.literal("agentic_workflows"),
  ]),
  le_contract: z.literal(SOTF_DAILY_BRIEF_CONTRACT),
});
const accessStateSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("active"), workspace_id: z.string().uuid(), capabilities: z.array(z.string()).max(20) }),
  z.strictObject({ state: z.literal("service_unavailable") }),
  z.strictObject({ state: z.literal("incompatible_contract") }),
  z.strictObject({ state: z.literal("entitlement_required") }),
  z.strictObject({ state: z.literal("capability_unavailable"), missing_capabilities: z.array(z.string()).min(1).max(20) }),
  z.strictObject({ state: z.literal("access_denied") }),
]);
type AccessState = z.infer<typeof accessStateSchema>;
type AccessFailure = Exclude<AccessState, { state: "active" }>;
type ErrorCode = AccessFailure["state"];

const outputSchema = z.strictObject({
  schema_version: z.literal("1"), status: z.enum(["ok", "error"]),
  data: z.strictObject({ bundles: z.array(bundleSummarySchema).max(1) }).optional(),
  code: z.enum(["service_unavailable", "incompatible_contract", "entitlement_required", "capability_unavailable", "access_denied"]).optional(),
  retryable: z.boolean().optional(),
  saved: z.literal(false).optional(),
  missing_capabilities: z.array(z.string()).max(20).optional(),
}).superRefine((value, context) => {
  if (value.status === "ok" && value.data === undefined) {
    context.addIssue({ code: "custom", path: ["data"], message: "Successful responses require data." });
  }
  if (value.status === "error" && (value.code === undefined || value.retryable === undefined || value.saved === undefined || value.data !== undefined)) {
    context.addIssue({ code: "custom", message: "Error responses require code, retryable, and saved, with no data." });
  }
});

export function registerSotfV1BundleListTool(
  server: McpServer,
  client: SupabaseClient<any, any, any, any, any>,
  options: { releaseEnabled: boolean },
) {
  server.registerTool("list_entitled_bundles", {
    title: "List entitled Lead Emergence bundles",
    description: "List the currently entitled SOTF v1 bundle metadata. This reads current authority and never returns a hosted workflow body or user state.",
    inputSchema: z.strictObject({}), annotations: readOnly,
    outputSchema, _meta: oauth,
  }, async () => {
    const access = await resolveAccess(client, options.releaseEnabled);
    if (access.state === "entitlement_required") return ok({ bundles: [] });
    if (access.state !== "active") return accessFailure(access);
    return ok({ bundles: listSotfV1Bundles() });
  });
}

async function resolveAccess(client: SupabaseClient<any, any, any, any, any>, releaseEnabled: boolean): Promise<AccessState> {
  if (!releaseEnabled) return { state: "service_unavailable" };
  try {
    const { data, error } = await client.rpc("sotf_v1_access_state");
    if (error) return { state: "service_unavailable" };
    return accessStateSchema.parse(data);
  } catch {
    return { state: "service_unavailable" };
  }
}

function accessFailure(access: AccessFailure) {
  if (access.state === "capability_unavailable") {
    return fail("capability_unavailable", false, { missing_capabilities: access.missing_capabilities });
  }
  return fail(access.state, access.state === "service_unavailable");
}

function ok<T>(data: T) {
  const value = { schema_version: "1", status: "ok" as const, data };
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}

function fail(code: ErrorCode, retryable: boolean, details?: Record<string, unknown>) {
  const value = { schema_version: "1", status: "error" as const, code, retryable, saved: false, ...details };
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}
