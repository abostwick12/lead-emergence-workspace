import {z} from "zod";
// Native privacy controls, not a model tool or a source of authorization.
// A host verifies owner identity, current grants, release gates and every write.
const date=z.string().datetime({offset:true});
const hash=z.string().regex(/^[0-9a-f]{64}$/);
export const connectionQuery=z.object({offset:z.number().int().min(0).max(2147483000).multipleOf(25).default(0)}).strict();
export const connectionReview=z.object({
 kind:z.enum(["assistant","external"]),id:hash,revision:hash,
 requestId:z.string().uuid(),confirmed:z.literal(true)
}).strict();
const common={id:hash,revision:hash,canDisconnect:z.boolean()};
export const assistantConnection=z.object({
 ...common,kind:z.literal("assistant"),provider:z.enum(["chatgpt","claude","other"]),
 state:z.enum(["authorized","setup_required","blocked","revoked","disconnected","unverified"]),
 grantActive:z.boolean(),registered:z.boolean(),scopes:z.array(z.string().max(200)).max(50),
 registeredAt:date.nullable(),authorizedAt:date.nullable()
}).strict();
export const externalConnection=z.object({
 ...common,kind:z.literal("external"),family:z.string().regex(/^[a-z_]+$/),
 providers:z.array(z.string().regex(/^[a-z_]+$/)).min(1).max(14),
 credentialState:z.enum(["missing","recorded","expired","revoked"]),
 metadataState:z.enum(["connected","disconnected","needs_review"]),
 lastRecordedAt:date.nullable(),expiresAt:date.nullable()
}).strict();
export const connectionSnapshot=z.object({
 workspaceId:z.string().uuid(),retrievedAt:date,
 assistantAccessIncluded:z.boolean(),assistantAdmissionEnabled:z.boolean(),externalAccessIncluded:z.boolean(),
 offset:z.number().int().nonnegative(),pageSize:z.literal(25),assistantTotal:z.number().int().nonnegative(),
 authorizedTotal:z.number().int().nonnegative(),activeGrantTotal:z.number().int().nonnegative(),
 assistants:z.array(assistantConnection).max(25),external:z.array(externalConnection).max(12),
 releasedProviders:z.array(z.string().regex(/^[a-z_]+$/)).max(12)
}).strict();
export const connectionReceipt=z.object({
 requestId:z.string().uuid(),kind:z.enum(["assistant","external"]),id:hash,
 disconnectedAt:date,scope:z.enum(["workspace_assistant_access","workspace_credential_family"]),
 affectedProviders:z.array(z.string().regex(/^[a-z_]+$/)).min(1).max(14)
}).strict();
export type ConnectionSnapshot=z.infer<typeof connectionSnapshot>;
export type ConnectionItem=z.infer<typeof assistantConnection>|z.infer<typeof externalConnection>;
export type ConnectionReview=z.infer<typeof connectionReview>;
export type ConnectionReceipt=z.infer<typeof connectionReceipt>;
export const assistantStateLabels:Record<z.infer<typeof assistantConnection>["state"],string>={
 authorized:"Workspace access authorized",setup_required:"Consent saved · setup unfinished",
 blocked:"Workspace access blocked",revoked:"Workspace grant revoked",
 disconnected:"Disconnected in Workspace",unverified:"Access not verified"
};
