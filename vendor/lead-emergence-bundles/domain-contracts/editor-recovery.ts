import { z } from "zod";
import { theologicalProfile, researchProject, teachingArchive } from "./ministry";
import { nonprofitSchemas } from "./nonprofit";
import { investorSchemas } from "./investor";
import { executiveSchemas } from "./executive";

// Recovery is a native editor primitive, not a Workspace Experience entitlement
// or an assistant capability. Identity is never accepted in these inputs.
export const editorKinds = {
  ministry: ["profile", "research", "archive"],
  nonprofit: ["plan", "partner", "meeting", "research"],
  investor: ["watchlist", "thesis", "filing", "brief"],
  executive: ["commitment", "decision", "meeting", "daily_brief", "weekly_review"]
} as const;
export const editorDomain = z.enum(["ministry", "nonprofit", "investor", "executive"]);
export const editorTarget = z.object({
  domain: editorDomain, kind: z.string().min(1).max(40), documentId: z.string().uuid().nullable()
}).strict().refine(t => (editorKinds[t.domain] as readonly string[]).includes(t.kind), "Choose an admitted editor type.");
export type EditorTarget = z.infer<typeof editorTarget>;
type JsonSchema = Record<string, unknown>;
const canonical: Record<string, Record<string, z.ZodType>> = {
  ministry: {profile: theologicalProfile, research: researchProject, archive: teachingArchive},
  nonprofit: nonprofitSchemas, investor: investorSchemas, executive: executiveSchemas
};
// Keep the exact object/array/type/enum structure and upper bounds. Incomplete
// text, dates, links and numeric entry must be recoverable before validation.
// These shapes MUST NOT be used to authorize a canonical save.
export function recoveryShape(schema: JsonSchema): JsonSchema {
  if (schema.$ref || schema.allOf || schema.not) throw new Error("Unsupported recovery schema composition.");
  const result: JsonSchema = {};
  for (const key of ["type", "required", "additionalProperties", "maxItems", "maxLength", "maximum", "enum", "const"])
    if (key in schema) result[key] = schema[key];
  if (schema.type === "string" && !("maxLength" in result)) result.maxLength = 256;
  if (schema.type === "array" && !("maxItems" in result)) result.maxItems = 1000;
  if (schema.type === "number" || schema.type === "integer") result.minimum = -Number.MAX_SAFE_INTEGER;
  if (schema.properties) result.properties = Object.fromEntries(Object.entries(schema.properties as Record<string, JsonSchema>).map(([key, value]) => [key, recoveryShape(value)]));
  if (schema.items) result.items = recoveryShape(schema.items as JsonSchema);
  for (const key of ["anyOf", "oneOf"]) if (schema[key]) result[key] = (schema[key] as JsonSchema[]).map(recoveryShape);
  return result;
}
export const editorRecoveryShapes = Object.fromEntries(Object.entries(canonical).map(([domain, kinds]) =>
  [domain, Object.fromEntries(Object.entries(kinds).map(([kind, schema]) => [kind, recoveryShape(z.toJSONSchema(schema, {io: "input"}))]))]
)) as Record<string, Record<string, JsonSchema>>;
export function matchesRecoveryShape(schema: JsonSchema, value: unknown): boolean {
  if (schema.anyOf && !(schema.anyOf as JsonSchema[]).some(s => matchesRecoveryShape(s, value))) return false;
  if (schema.oneOf && (schema.oneOf as JsonSchema[]).filter(s => matchesRecoveryShape(s, value)).length !== 1) return false;
  if ("const" in schema && value !== schema.const) return false;
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) return false;
  switch (schema.type) {
    case "null": return value === null;
    case "string": return typeof value === "string" && value.length <= Number(schema.maxLength ?? 256);
    case "boolean": return typeof value === "boolean";
    case "number": case "integer":
      return typeof value === "number" && Number.isFinite(value) && (schema.type !== "integer" || Number.isSafeInteger(value))
        && value >= -Number.MAX_SAFE_INTEGER && value <= Number(schema.maximum ?? Number.MAX_SAFE_INTEGER);
    case "array": return Array.isArray(value) && value.length <= Number(schema.maxItems ?? 1000)
      && value.every(v => matchesRecoveryShape(schema.items as JsonSchema, v));
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const fields = schema.properties as Record<string, JsonSchema> ?? {};
      const required = schema.required as string[] ?? [];
      return required.every(key => Object.hasOwn(value, key)) && Object.entries(value).every(([key, v]) =>
        Object.hasOwn(fields, key) ? matchesRecoveryShape(fields[key], v) : schema.additionalProperties !== false);
    }
    default: return !!(schema.anyOf || schema.oneOf || "const" in schema || schema.enum);
  }
}
export const editorDraftValues = z.object({
  data: z.record(z.string(), z.json()),
  ui: z.object({
    unsetProfile: z.boolean().optional(),
    meetingTime: z.object({local: z.string().max(40), selection: z.string().max(64), pending: z.boolean()}).strict().optional(),
    availability: z.object({
      zone: z.string().max(100),
      offered: z.array(z.object({id:z.string().uuid(),start:z.string().max(40),end:z.string().max(40),startInstant:z.string().max(64),endInstant:z.string().max(64)}).strict()).max(20),
      available: z.array(z.object({id:z.string().uuid(),start:z.string().max(40),end:z.string().max(40),startInstant:z.string().max(64),endInstant:z.string().max(64)}).strict()).max(20),
      busy: z.array(z.object({id:z.string().uuid(),start:z.string().max(40),end:z.string().max(40),startInstant:z.string().max(64),endInstant:z.string().max(64)}).strict()).max(200),
      source: z.string().max(240),bufferMinutes:z.number().int().min(-1).max(120),checkedAt:z.string().max(64).nullable(),context:z.string().max(20000),pending:z.boolean()
    }).strict().optional()
  }).strict()
}).strict();
export type EditorDraftValues = z.infer<typeof editorDraftValues>;
export function validEditorValues(target: EditorTarget, values: EditorDraftValues): boolean {
  return !!editorRecoveryShapes[target.domain]?.[target.kind]
    && matchesRecoveryShape(editorRecoveryShapes[target.domain][target.kind], values.data)
    && (!("unsetProfile" in values.ui) || target.domain === "ministry" && target.kind === "profile")
    && (!values.ui.meetingTime || target.domain === "executive" && target.kind === "meeting")
    && (!values.ui.availability || target.domain === "executive" && target.kind === "meeting");
}
const common = {target: editorTarget, requestId: z.string().uuid(), expectedVersion: z.number().int().min(0).max(2147483646)};
export const editorDraftChange = z.discriminatedUnion("operation", [
  z.object({...common, operation: z.literal("save"), schemaVersion: z.literal(1), baseRevision: z.number().int().min(0).max(2147483646), values: editorDraftValues}).strict(),
  z.object({...common, operation: z.literal("discard")}).strict(),
  z.object({...common, operation: z.literal("commit"), confirm: z.literal(true)}).strict()
]).superRefine((v, ctx) => {
  if (v.operation === "save" && !validEditorValues(v.target, v.values))
    ctx.addIssue({code: "custom", message: "Working draft does not match this editor."});
});
export type EditorDraftChange = z.infer<typeof editorDraftChange>;
export const editorDraftReceipt = z.object({
  requestId: z.string().uuid(), operation: z.enum(["save", "discard", "commit"]),
  version: z.number().int().positive(), committedDocumentId: z.string().uuid().nullable(), committedRevision: z.number().int().positive().nullable()
}).strict();
export type EditorDraftReceipt = z.infer<typeof editorDraftReceipt>;
export const editorDraftSnapshot = z.object({
  target: editorTarget, schemaVersion: z.literal(1), version: z.number().int().nonnegative(),
  baseRevision: z.number().int().nonnegative().nullable(), currentRevision: z.number().int().nonnegative(),
  values: editorDraftValues.nullable(), savedAt: z.string().nullable(), receipt: editorDraftReceipt.nullable()
}).strict().superRefine((v, ctx) => {
  if (v.values && !validEditorValues(v.target, v.values))
    ctx.addIssue({code: "custom", message: "Working draft response does not match this editor."});
});
export type EditorDraftSnapshot = z.infer<typeof editorDraftSnapshot>;
