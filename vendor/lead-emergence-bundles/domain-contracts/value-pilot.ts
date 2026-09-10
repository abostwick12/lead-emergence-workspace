import { z } from "zod";

export const valuePilotBundleKeys = [
  "executive", "writer_editor", "ministry", "nonprofit_founder", "investor", "workspace_experience"
] as const;
export const valuePilotBundleKey = z.enum(valuePilotBundleKeys);
const requestId = z.string().uuid();
const instant = z.iso.datetime({ offset: true });
const signalId = z.string().regex(/^[a-z][a-z0-9._-]{2,99}$/);
const rating = z.number().int().min(1).max(5);
const qualityGates = z.object({
  evidenceRequired: z.boolean(),
  provenanceRequired: z.boolean(),
  mutationConfirmationRequired: z.boolean()
}).strict();

export const valuePilotDefinition = z.object({
  schemaVersion: z.literal("1.0"),
  bundleKey: valuePilotBundleKey,
  manifestVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  displayName: z.string().trim().min(1).max(80),
  promise: z.string().trim().min(1).max(300),
  firstRunOutcome: z.string().trim().min(1).max(500),
  targetMinutes: z.number().int().min(1).max(60),
  successSignals: z.array(z.object({
    id: signalId,
    description: z.string().trim().min(1).max(300)
  }).strict()).min(1).max(10),
  qualityGates,
  workspaceRoute: z.string().regex(/^\/workspace(?:\/[a-z0-9/-]+)?$/),
  available: z.boolean()
}).strict().superRefine((value, context) => {
  if (new Set(value.successSignals.map(signal => signal.id)).size !== value.successSignals.length)
    context.addIssue({ code: "custom", path: ["successSignals"], message: "Success signals must be unique." });
});

const start = z.object({
  operation: z.literal("start"), requestId, bundleKey: valuePilotBundleKey,
  baselineMinutes: z.number().int().min(1).max(480)
}).strict();
const finish = z.object({
  operation: z.literal("finish"), requestId, pilotId: z.string().uuid(),
  expectedVersion: z.number().int().positive(), outcomeAchieved: z.boolean(),
  successSignalIds: z.array(signalId).max(10),
  ratings: z.object({ usefulness: rating, trust: rating, actionability: rating }).strict(),
  gates: z.object({ evidenceVisible: z.boolean(), provenanceVisible: z.boolean(), mutationControlPreserved: z.boolean() }).strict(),
  correctionCount: z.number().int().min(0).max(100)
}).strict().superRefine((value, context) => {
  if (new Set(value.successSignalIds).size !== value.successSignalIds.length)
    context.addIssue({ code: "custom", path: ["successSignalIds"], message: "Success signals must be unique." });
  if (value.outcomeAchieved !== (value.successSignalIds.length > 0))
    context.addIssue({ code: "custom", path: ["successSignalIds"], message: "Choose a signal only when the expected outcome was reached." });
});
const abandon = z.object({
  operation: z.literal("abandon"), requestId, pilotId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  reason: z.enum(["interrupted", "outcome_unclear", "source_gap", "workflow_friction", "other"])
}).strict();
export const valuePilotChange = z.discriminatedUnion("operation", [start, finish, abandon]);

export const valuePilotRatings = finish.shape.ratings;
export const valuePilotGateAnswers = finish.shape.gates;
export type ValuePilotRatings = z.infer<typeof valuePilotRatings>;
export type ValuePilotGateAnswers = z.infer<typeof valuePilotGateAnswers>;
export type ValuePilotQualityGates = z.infer<typeof qualityGates>;

export function assessValuePilot(input: {
  baselineMinutes: number; targetMinutes: number; elapsedSeconds: number;
  outcomeAchieved: boolean; ratings: ValuePilotRatings; gates: ValuePilotGateAnswers;
  requiredGates: ValuePilotQualityGates;
}) {
  const targetMet = input.elapsedSeconds <= input.targetMinutes * 60;
  const qualityGatesMet = (!input.requiredGates.evidenceRequired || input.gates.evidenceVisible)
    && (!input.requiredGates.provenanceRequired || input.gates.provenanceVisible)
    && (!input.requiredGates.mutationConfirmationRequired || input.gates.mutationControlPreserved);
  const lowestRating = Math.min(input.ratings.usefulness, input.ratings.trust, input.ratings.actionability);
  const assessment = input.outcomeAchieved && qualityGatesMet && lowestRating >= 4 ? "strong_signal"
    : input.outcomeAchieved && qualityGatesMet && lowestRating >= 3 ? "promising_signal" : "needs_iteration";
  return {
    targetMet,
    qualityGatesMet,
    estimatedMinutesSaved: Math.max(0, input.baselineMinutes - Math.ceil(input.elapsedSeconds / 60)),
    assessment: assessment as "strong_signal" | "promising_signal" | "needs_iteration"
  };
}

const receipt = z.object({
  requestId, operation: z.enum(["start", "finish", "abandon"]),
  version: z.number().int().positive(), recordedAt: instant
}).strict();
const result = z.object({
  elapsedSeconds: z.number().int().min(0).max(604800), outcomeAchieved: z.boolean(),
  successSignalIds: z.array(signalId).max(10), ratings: valuePilotRatings, gates: valuePilotGateAnswers,
  correctionCount: z.number().int().min(0).max(100), targetMet: z.boolean(), qualityGatesMet: z.boolean(),
  estimatedMinutesSaved: z.number().int().min(0).max(480),
  assessment: z.enum(["strong_signal", "promising_signal", "needs_iteration"])
}).strict();
const abandonment = z.object({
  reason: abandon.shape.reason, elapsedSeconds: z.number().int().min(0).max(604800)
}).strict();

export const valuePilotSession = z.object({
  schemaVersion: z.literal("1.0"), id: z.string().uuid(), bundleKey: valuePilotBundleKey,
  status: z.enum(["active", "completed", "abandoned"]), version: z.number().int().positive(),
  manifestVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  targetMinutes: z.number().int().min(1).max(60), baselineMinutes: z.number().int().min(1).max(480),
  availableSignalIds: z.array(signalId).min(1).max(10), requiredGates: qualityGates,
  startedAt: instant, completedAt: instant.nullable(), abandonedAt: instant.nullable(),
  result: result.nullable(), abandonment: abandonment.nullable(), receipt
}).strict().superRefine((value, context) => {
  const issue = (message: string, path: string) => context.addIssue({ code: "custom", path: [path], message });
  if (new Set(value.availableSignalIds).size !== value.availableSignalIds.length) issue("Available signals must be unique.", "availableSignalIds");
  if (value.status === "active" && (value.completedAt || value.abandonedAt || value.result || value.abandonment)) issue("An active pilot cannot have a final result.", "status");
  if (value.status === "completed" && (!value.completedAt || value.abandonedAt || !value.result || value.abandonment || value.receipt.operation !== "finish")) issue("A completed pilot needs one final result.", "status");
  if (value.status === "abandoned" && (!value.abandonedAt || value.completedAt || value.result || !value.abandonment || value.receipt.operation !== "abandon")) issue("An abandoned pilot needs one abandonment result.", "status");
  if (value.result) {
    if (value.result.successSignalIds.some(id => !value.availableSignalIds.includes(id))) issue("A result contains an unavailable success signal.", "result");
    if (value.result.outcomeAchieved !== (value.result.successSignalIds.length > 0)) issue("Outcome and success signals disagree.", "result");
    const assessed = assessValuePilot({ baselineMinutes: value.baselineMinutes, targetMinutes: value.targetMinutes,
      elapsedSeconds: value.result.elapsedSeconds, outcomeAchieved: value.result.outcomeAchieved,
      ratings: value.result.ratings, gates: value.result.gates, requiredGates: value.requiredGates });
    if (assessed.targetMet !== value.result.targetMet || assessed.qualityGatesMet !== value.result.qualityGatesMet
      || assessed.estimatedMinutesSaved !== value.result.estimatedMinutesSaved || assessed.assessment !== value.result.assessment)
      issue("Derived pilot assessment is inconsistent.", "result");
  }
});

export const valuePilotDashboard = z.object({
  schemaVersion: z.literal("1.0"), generatedAt: instant,
  definitions: z.array(valuePilotDefinition).length(valuePilotBundleKeys.length),
  sessions: z.array(valuePilotSession).max(120)
}).strict().superRefine((value, context) => {
  if (new Set(value.definitions.map(item => item.bundleKey)).size !== valuePilotBundleKeys.length)
    context.addIssue({ code: "custom", path: ["definitions"], message: "Every bundle needs one value definition." });
  if (new Set(value.sessions.map(item => item.id)).size !== value.sessions.length)
    context.addIssue({ code: "custom", path: ["sessions"], message: "Pilot sessions must be unique." });
});

export type ValuePilotDefinition = z.infer<typeof valuePilotDefinition>;
export type ValuePilotChange = z.infer<typeof valuePilotChange>;
export type ValuePilotSession = z.infer<typeof valuePilotSession>;
export type ValuePilotDashboard = z.infer<typeof valuePilotDashboard>;
