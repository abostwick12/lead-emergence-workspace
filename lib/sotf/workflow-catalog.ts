import bundleDocument from "@/docs/architecture/contracts/sotf-transition.bundle.v1.json";
import workflowDocument from "@/docs/architecture/contracts/transition.daily_brief.v1.json";
import { z } from "zod";

export const SOTF_DAILY_BRIEF_CONTRACT = "sotf_daily_brief_v1" as const;

const requiredCapabilities = z.tuple([
  z.literal("core_workspace"), z.literal("workspace_mcp"), z.literal("career"),
  z.literal("daily_brief"), z.literal("agentic_workflows"),
]);
const bundle = z.object({
  schema_version: z.literal("1"),
  bundle_key: z.literal("sotf_transition"),
  bundle_version: z.literal("1.0.0"),
  display_name: z.string().min(1).max(240),
  entitlement: z.object({
    bundle_key: z.literal("sotf_transition"),
    required_capabilities: requiredCapabilities,
  }),
  le_mcp: z.object({ contract_version: z.literal(SOTF_DAILY_BRIEF_CONTRACT) }),
  hosted_workflows: z.tuple([z.object({ workflow_id: z.literal("transition.daily_brief") })]),
}).parse(bundleDocument);
const workflow = z.object({
  schema_version: z.literal("1"),
  workflow_id: z.literal("transition.daily_brief"),
  workflow_version: z.literal("1.0.0"),
  bundle_key: z.literal("sotf_transition"),
  le_mcp: z.object({ contract_version: z.literal(SOTF_DAILY_BRIEF_CONTRACT) }),
}).parse(workflowDocument);

if (bundle.hosted_workflows[0].workflow_id !== workflow.workflow_id || bundle.bundle_key !== workflow.bundle_key) {
  throw new Error("The checked-in SOTF v1 catalog is internally inconsistent.");
}

export function listSotfV1Bundles() {
  return [{
    bundle_key: bundle.bundle_key,
    bundle_version: bundle.bundle_version,
    display_name: bundle.display_name,
    required_capabilities: [...bundle.entitlement.required_capabilities],
    le_contract: bundle.le_mcp.contract_version,
  }];
}
