import { z } from "zod";
import { domainSchema } from "../policy/index";
import { providerRequirementSchema } from "../provider-contracts/index";

export const BUNDLE_CONTRACT_VERSION = "1.0" as const;

export const bundleKeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,49}$/);
export const capabilityIdSchema = z.string().regex(/^[a-z][a-z0-9._-]{2,99}$/);
export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

export const capabilityDefinitionSchema = z.object({
  id: capabilityIdSchema,
  version: semverSchema,
  description: z.string().trim().min(1).max(500),
  domain: domainSchema,
  operations: z.array(z.enum(["read", "propose", "execute", "notify", "automate"])).min(1),
  taskMetadataShareable: z.boolean().default(false)
}).strict();

export const skillDefinitionSchema = z.object({
  id: capabilityIdSchema,
  path: z.string().regex(/^\.\/plugins\/[a-z0-9-]+\/skills\/[a-z0-9-]+\/$/),
  capabilityIds: z.array(capabilityIdSchema).min(1),
  triggers: z.array(z.string().trim().min(2).max(160)).min(1),
  outcome: z.string().trim().min(1).max(500)
}).strict();

export const workflowDefinitionSchema = z.object({
  id: capabilityIdSchema,
  version: semverSchema,
  name: z.string().trim().min(1).max(100),
  capabilityIds: z.array(capabilityIdSchema).min(1),
  providerRequirementIds: z.array(capabilityIdSchema),
  inputScopes: z.array(z.string().trim().min(1).max(100)),
  outputScopes: z.array(z.string().trim().min(1).max(100)),
  mode: z.enum(["read", "propose", "execute"]),
  evidenceRequired: z.boolean(),
  targetUserMinutes: z.number().positive().max(480).optional()
}).strict();

export const appRequirementSchema = z.object({
  id: capabilityIdSchema,
  appId: z.string().trim().min(1).max(200).optional(),
  required: z.boolean(),
  purpose: z.string().trim().min(1).max(500),
  status: z.enum(["planned", "available", "requires_authorization"])
}).strict();

export const automationDefinitionSchema = z.object({
  id: capabilityIdSchema,
  workflowId: capabilityIdSchema,
  triggerKinds: z.array(z.enum(["manual", "schedule", "event"])).min(1),
  notificationPolicy: z.enum(["meaningful_change", "completion", "failure", "user_action"]),
  requiresUserApproval: z.boolean()
}).strict();

export const attentionTypeSchema = z.object({
  id: capabilityIdSchema,
  description: z.string().trim().min(1).max(300),
  defaultPriority: z.enum(["low", "normal", "high", "urgent"]),
  evidenceRequired: z.boolean()
}).strict();

export const bundleManifestSchema = z.object({
  schemaVersion: z.literal(BUNDLE_CONTRACT_VERSION),
  identity: z.object({
    key: bundleKeySchema,
    version: semverSchema,
    displayName: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(500),
    kind: z.enum(["functional", "experience"])
  }).strict(),
  experience: z.object({
    promise: z.string().trim().min(1).max(300),
    firstRunOutcome: z.string().trim().min(1).max(500),
    timeToFirstValueMinutes: z.number().positive().max(60),
    successSignals: z.array(z.object({
      id: capabilityIdSchema,
      description: z.string().trim().min(1).max(300)
    }).strict()).min(1),
    qualityGates: z.object({
      evidenceRequired: z.boolean(),
      provenanceRequired: z.boolean(),
      mutationConfirmationRequired: z.boolean()
    }).strict()
  }).strict(),
  capabilities: z.array(capabilityDefinitionSchema).min(1),
  skills: z.array(skillDefinitionSchema),
  workflows: z.array(workflowDefinitionSchema),
  providerRequirements: z.array(providerRequirementSchema),
  appRequirements: z.array(appRequirementSchema),
  permissions: z.object({
    dataScopes: z.array(z.string().trim().min(1).max(100)),
    contextScopes: z.array(z.string().trim().min(1).max(100)),
    crossDomainAccess: z.array(z.object({
      targetDomain: domainSchema,
      dataClass: z.enum(["task_metadata", "full_content"]),
      operation: z.enum(["read", "propose", "execute"])
    }).strict())
  }).strict(),
  automations: z.array(automationDefinitionSchema),
  attentionTypes: z.array(attentionTypeSchema),
  uiManifestPath: z.string().regex(/^\.\/bundles\/[a-z0-9-]+\/ui-manifest\.json$/),
  distribution: z.object({
    pluginName: z.string().regex(/^[a-z0-9-]+$/),
    marketplacePath: z.literal("./.agents/plugins/marketplace.json")
  }).strict()
}).strict().superRefine((bundle, context) => {
  const capabilityIds = new Set(bundle.capabilities.map((capability) => capability.id));
  const providerIds = new Set(bundle.providerRequirements.map((provider) => provider.id));
  const workflowIds = new Set(bundle.workflows.map((workflow) => workflow.id));
  const allIds = [
    ...bundle.capabilities.map((item) => item.id),
    ...bundle.skills.map((item) => item.id),
    ...bundle.workflows.map((item) => item.id),
    ...bundle.providerRequirements.map((item) => item.id),
    ...bundle.appRequirements.map((item) => item.id),
    ...bundle.automations.map((item) => item.id),
    ...bundle.attentionTypes.map((item) => item.id)
  ];
  if (new Set(allIds).size !== allIds.length) {
    context.addIssue({ code: "custom", message: "Every bundle contribution id must be unique" });
  }
  for (const skill of bundle.skills) {
    for (const id of skill.capabilityIds) {
      if (!capabilityIds.has(id)) context.addIssue({ code: "custom", message: `Skill ${skill.id} references unknown capability ${id}` });
    }
  }
  for (const workflow of bundle.workflows) {
    for (const id of workflow.capabilityIds) {
      if (!capabilityIds.has(id)) context.addIssue({ code: "custom", message: `Workflow ${workflow.id} references unknown capability ${id}` });
    }
    for (const id of workflow.providerRequirementIds) {
      if (!providerIds.has(id)) context.addIssue({ code: "custom", message: `Workflow ${workflow.id} references unknown provider requirement ${id}` });
    }
  }
  for (const automation of bundle.automations) {
    if (!workflowIds.has(automation.workflowId)) {
      context.addIssue({ code: "custom", message: `Automation ${automation.id} references unknown workflow ${automation.workflowId}` });
    }
  }
});

export type CapabilityDefinition = z.infer<typeof capabilityDefinitionSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type BundleManifest = z.infer<typeof bundleManifestSchema>;

export function parseBundleManifest(input: unknown): BundleManifest {
  return bundleManifestSchema.parse(input);
}
