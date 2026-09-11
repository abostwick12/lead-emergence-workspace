import bundleManifestDocument from "@/docs/architecture/contracts/sotf-transition.bundle.v1.json";
import dailyBriefWorkflowDocument from "@/docs/architecture/contracts/transition.daily_brief.v1.json";
import { z } from "zod";

export const SOTF_V1_BUNDLE_KEY = "sotf_transition" as const;
export const SOTF_V1_BUNDLE_VERSION = "1.0.0" as const;
export const SOTF_DAILY_BRIEF_WORKFLOW_ID = "transition.daily_brief" as const;
export const SOTF_DAILY_BRIEF_VERSION = "1.0.0" as const;
export const SOTF_DAILY_BRIEF_CONTRACT = "sotf_daily_brief_v1" as const;

export type SotfV1CatalogErrorCode = "not_available" | "version_not_available";
export type SotfV1CatalogResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: SotfV1CatalogErrorCode };

const requiredCapabilitiesSchema = z.tuple([
  z.literal("core_workspace"), z.literal("workspace_mcp"), z.literal("career"),
  z.literal("daily_brief"), z.literal("agentic_workflows"),
]);
const capabilitySetSchema = z.strictObject({
  required: z.tuple([
    z.literal("mcp"), z.literal("user_interaction"), z.literal("reasoning"), z.literal("approval_interaction"),
  ]),
  optional: z.tuple([z.literal("calendar_read"), z.literal("email_read")]),
});
const entitlementSchema = z.strictObject({
  bundle_key: z.literal(SOTF_V1_BUNDLE_KEY),
  required_capabilities: requiredCapabilitiesSchema,
});
const mcpDependencySchema = z.strictObject({
  server_name: z.literal("lewis"),
  contract_version: z.literal(SOTF_DAILY_BRIEF_CONTRACT),
  required_tools: z.tuple([
    z.literal("get_onboarding_state"), z.literal("list_entitled_bundles"),
    z.literal("get_bundle_manifest"), z.literal("list_workflows"), z.literal("get_workflow"),
    z.literal("sotf_get_daily_brief_state"), z.literal("sotf_record_daily_brief_outcome"),
  ]),
});

export const sotfV1BundleManifestSchema = z.strictObject({
  schema_version: z.literal("1"),
  bundle_key: z.literal(SOTF_V1_BUNDLE_KEY),
  bundle_version: z.literal(SOTF_V1_BUNDLE_VERSION),
  display_name: z.string().min(1).max(240),
  description: z.string().min(1).max(1000),
  entitlement: entitlementSchema,
  portable_skills: z.array(z.strictObject({
    skill_id: z.string().min(1).max(100),
    skill_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    reference: z.string().min(1).max(300),
  })).min(1).max(3),
  hosted_workflows: z.array(z.strictObject({
    workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID),
    version_selection: z.literal("current"),
  })).length(1),
  host_capabilities: capabilitySetSchema,
  le_mcp: mcpDependencySchema,
  host_compatibility: z.strictObject({
    supported_hosts: z.tuple([z.literal("chatgpt")]),
    acceptance_status: z.literal("not_run"),
    contract_schema_versions: z.tuple([z.literal("1")]),
  }),
  bootstrap_reference: z.string().min(1).max(300),
  degradation_policy: z.literal("sotf_v1_online_only"),
});

const workflowStepSchema = z.strictObject({
  step_id: z.string().min(1).max(60),
  owner: z.literal("host"),
  instruction: z.string().min(1).max(1600),
});

export const sotfV1WorkflowContractSchema = z.strictObject({
  schema_version: z.literal("1"),
  workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID),
  workflow_version: z.literal(SOTF_DAILY_BRIEF_VERSION),
  bundle_key: z.literal(SOTF_V1_BUNDLE_KEY),
  title: z.string().min(1).max(240),
  description: z.string().min(1).max(1000),
  execution_mode: z.literal("A"),
  supported_hosts: z.tuple([z.literal("chatgpt")]),
  entitlement: entitlementSchema,
  host_capabilities: capabilitySetSchema,
  le_mcp: mcpDependencySchema,
  referenced_skills: z.tuple([z.literal("sotf.daily_prioritization")]),
  inputs: z.array(z.strictObject({
    name: z.string().min(1).max(60), type: z.enum(["date", "iana_timezone", "string"]),
    required: z.boolean(), handling: z.literal("host_ephemeral"), description: z.string().min(1).max(600),
  })).length(3),
  state_reads: z.array(z.strictObject({
    tool: z.literal("sotf_get_daily_brief_state"), projection_version: z.literal("1"), purpose: z.string().min(1).max(600),
  })).length(1),
  steps: z.array(workflowStepSchema).min(1).max(12),
  decision_rules: z.array(z.string().min(1).max(1000)).min(1).max(16),
  approval_gates: z.array(z.strictObject({
    gate_id: z.string().min(1).max(60), applies_to: z.literal("sotf_record_daily_brief_outcome"), rule: z.string().min(1).max(1000),
  })).length(1),
  allowed_write_backs: z.tuple([z.literal("sotf_record_daily_brief_outcome")]),
  ephemeral_data_classes: z.tuple([
    z.literal("provider_payloads"), z.literal("host_conversation"),
    z.literal("brief_text"), z.literal("unconfirmed_inference"),
  ]),
  stop_conditions: z.array(z.string().min(1).max(600)).min(1).max(16),
  success_criteria: z.array(z.string().min(1).max(600)).min(1).max(10),
  output: z.strictObject({
    destination: z.literal("host_conversation"), sections: z.array(z.string().min(1)).min(1).max(10),
    max_priorities: z.literal(3), persist_brief_text: z.literal(false),
  }),
  outcome_contract: z.strictObject({
    schema_ref: z.literal("sotf-v1.schema.json#/$defs/outcome"), consent: z.literal("explicit_preview_confirmation"),
    durable_effect: z.literal("append_daily_brief_outcome_only"),
  }),
  degradation_policy: z.literal("sotf_v1_online_only"),
  compatibility: z.strictObject({ schema_versions: z.tuple([z.literal("1")]), required_le_contract: z.literal(SOTF_DAILY_BRIEF_CONTRACT) }),
});

type BundleManifest = z.infer<typeof sotfV1BundleManifestSchema>;
type WorkflowContract = z.infer<typeof sotfV1WorkflowContractSchema>;

const bundleManifest: BundleManifest = deepFreeze(sotfV1BundleManifestSchema.parse(bundleManifestDocument));
const dailyBriefWorkflow: WorkflowContract = deepFreeze(sotfV1WorkflowContractSchema.parse(dailyBriefWorkflowDocument));

assertCatalogIntegrity();

export const SOTF_V1_REQUIRED_CAPABILITIES = Object.freeze(
  [...bundleManifest.entitlement.required_capabilities]
);

export function listSotfV1Bundles(): Array<{
  bundle_key: string;
  bundle_version: string;
  display_name: string;
  required_capabilities: string[];
  le_contract: string;
}> {
  return [{
    bundle_key: bundleManifest.bundle_key,
    bundle_version: bundleManifest.bundle_version,
    display_name: bundleManifest.display_name,
    required_capabilities: [...bundleManifest.entitlement.required_capabilities],
    le_contract: bundleManifest.le_mcp.contract_version,
  }];
}

export function getSotfV1Bundle(bundleKey: string): SotfV1CatalogResult<BundleManifest> {
  if (bundleKey !== SOTF_V1_BUNDLE_KEY) return { ok: false, code: "not_available" };
  return { ok: true, value: structuredClone(bundleManifest) };
}

export function listSotfV1Workflows(bundleKey: string): SotfV1CatalogResult<Array<{
  workflow_id: string;
  current_version: string;
  title: string;
  description: string;
  execution_mode: string;
}>> {
  if (bundleKey !== SOTF_V1_BUNDLE_KEY) return { ok: false, code: "not_available" };
  return { ok: true, value: [{
    workflow_id: dailyBriefWorkflow.workflow_id,
    current_version: dailyBriefWorkflow.workflow_version,
    title: dailyBriefWorkflow.title,
    description: dailyBriefWorkflow.description,
    execution_mode: dailyBriefWorkflow.execution_mode,
  }] };
}

export function getSotfV1Workflow(
  workflowId: string,
  requestedVersion?: string,
): SotfV1CatalogResult<WorkflowContract> {
  if (workflowId !== SOTF_DAILY_BRIEF_WORKFLOW_ID) return { ok: false, code: "not_available" };
  if (requestedVersion !== undefined && requestedVersion !== SOTF_DAILY_BRIEF_VERSION) {
    return { ok: false, code: "version_not_available" };
  }
  return { ok: true, value: structuredClone(dailyBriefWorkflow) };
}

export function evaluateSotfV1Capabilities(enabledCapabilities: Iterable<string>) {
  const enabled = new Set(enabledCapabilities);
  const missing = SOTF_V1_REQUIRED_CAPABILITIES.filter((capability) => !enabled.has(capability));
  return { compatible: missing.length === 0, missing_capabilities: missing };
}

export function evaluateSotfV1HostCapabilities(reportedCapabilities: Iterable<string>) {
  const reported = new Set(reportedCapabilities);
  const required = dailyBriefWorkflow.host_capabilities.required;
  const optional = dailyBriefWorkflow.host_capabilities.optional;
  const missingRequired = required.filter((capability) => !reported.has(capability));
  const missingOptional = optional.filter((capability) => !reported.has(capability));
  return {
    compatible: missingRequired.length === 0,
    missing_required: missingRequired,
    missing_optional: missingOptional,
  };
}

function assertCatalogIntegrity() {
  if (bundleManifest.schema_version !== "1"
    || bundleManifest.bundle_key !== SOTF_V1_BUNDLE_KEY
    || bundleManifest.bundle_version !== SOTF_V1_BUNDLE_VERSION
    || bundleManifest.entitlement.bundle_key !== SOTF_V1_BUNDLE_KEY
    || bundleManifest.le_mcp.contract_version !== SOTF_DAILY_BRIEF_CONTRACT
    || bundleManifest.hosted_workflows.length !== 1
    || bundleManifest.hosted_workflows[0]?.workflow_id !== SOTF_DAILY_BRIEF_WORKFLOW_ID
    || dailyBriefWorkflow.schema_version !== "1"
    || dailyBriefWorkflow.bundle_key !== SOTF_V1_BUNDLE_KEY
    || dailyBriefWorkflow.workflow_id !== SOTF_DAILY_BRIEF_WORKFLOW_ID
    || dailyBriefWorkflow.workflow_version !== SOTF_DAILY_BRIEF_VERSION
    || dailyBriefWorkflow.execution_mode !== "A"
    || dailyBriefWorkflow.le_mcp.contract_version !== SOTF_DAILY_BRIEF_CONTRACT) {
    throw new Error("The checked-in SOTF v1 catalog is internally inconsistent.");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
