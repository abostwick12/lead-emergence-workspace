import { z } from "zod";

export const dimensionSchema = z.enum(["experience", "actual_work", "culture", "values", "environment", "trajectory", "lifestyle"]);
export type Dimension = z.infer<typeof dimensionSchema>;
export const DIMENSIONS: Record<Dimension, string> = { experience: "Experience & skills", actual_work: "Actual work", culture: "Culture", values: "Values", environment: "Work environment", trajectory: "Career trajectory", lifestyle: "Lifestyle & economics" };
const id = z.string().trim().min(1).max(100);
const short = z.string().trim().min(1).max(240);
const text = z.string().trim().min(1).max(5000);
const note = z.string().trim().max(5000).default("");
const date = z.string().date();
const timestamp = z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString());
const ids = z.array(id).max(100).default([]);
export const publicUrl = z.string().url().refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS source URL.");
export const criterionSchema = z.strictObject({ id, label: short, dimension: dimensionSchema, desired: text, nonNegotiable: z.boolean().default(false), importance: z.number().int().min(1).max(5).default(3), confirmed: z.literal(true) });
export const hypothesisSchema = z.strictObject({ id, proposition: short, whyPromising: text, assumptions: z.array(short).max(12).default([]), gaps: z.array(short).max(12).default([]), nextExperiment: text, reviewTrigger: text, status: z.enum(["continue", "refine", "split", "pause", "reject"]).default("continue"), confidenceExplanation: text });
export const sourceSchema = z.strictObject({ kind: z.enum(["job_post", "company_claim", "practitioner", "independent_reporting", "community", "fellow_report", "inference"]), reference: short, url: publicUrl.optional(), observedAt: date, scope: short });
export const evidenceSchema = z.strictObject({ id, statement: text, source: sourceSchema, direction: z.enum(["supporting", "conflicting", "neutral"]), dimension: dimensionSchema.optional(), opportunityId: id.optional(), hypothesisIds: ids, personId: id.optional(), meetingId: id.optional(), reliability: z.enum(["low", "medium", "high"]), criterionId: id.optional(), score: z.number().int().min(0).max(10).optional(), explanation: note });
export const requirementSchema = z.strictObject({ id, label: short, category: z.enum(["mandatory", "preferred", "clearance", "education", "certification", "authorization", "experience", "location", "travel"]), mandatory: z.boolean(), status: z.enum(["met", "unknown", "not_met"]).default("unknown"), evidenceIds: ids });
export const opportunitySchema = z.strictObject({ id, company: short, role: short, url: publicUrl.optional(), description: z.string().trim().max(24000).default(""), hypothesisIds: ids, requirements: z.array(requirementSchema).max(40).default([]), deadline: date.optional(), actualWork: note, decisionQuestion: short.default("Should I invest time pursuing this role?") });
export const personSchema = z.strictObject({ id, name: short, company: note, role: note, email: z.string().email().optional(), source: short, overlap: note, whyNow: text, objective: text, introductionPath: note, hypothesisIds: ids, opportunityId: id.optional(), nextTouch: date.optional() });
export const meetingSchema = z.strictObject({ id, title: short, personId: id.optional(), opportunityId: id.optional(), hypothesisIds: ids, kind: z.enum(["networking", "coaching", "interview", "mentor"]), startsAt: timestamp, endsAt: timestamp, status: z.enum(["planned", "accepted", "completed", "cancelled"]).default("planned"), provider: z.enum(["manual", "google_calendar", "outlook"]).default("manual"), sourceEventId: id.optional(), objective: text });
export const commitmentSchema = z.strictObject({ id, title: short, owner: short.default("Fellow"), due: date.optional(), definitionOfDone: text, reviewTrigger: text, personId: id.optional(), meetingId: id.optional(), opportunityId: id.optional(), hypothesisId: id.optional() });
export const storySchema = z.strictObject({ id, title: short, situation: text, contribution: text, scope: text, actions: text, outcome: text, skills: z.array(short).min(1).max(20), evidenceIds: ids, approvedLanguage: text, uncertainNumbers: z.array(short).max(10).default([]), confirmed: z.literal(true) });
export const materialSchema = z.strictObject({ id, opportunityId: id, kind: z.enum(["resume", "cover_letter", "profile", "work_sample"]), title: short, content: text, storyIds: ids, confirmedTruthful: z.literal(true) });
export const interviewSchema = z.strictObject({ id, opportunityId: id, meetingId: id.optional(), round: short, interviewerContext: note, questionsAsked: z.array(short).max(30).default([]), storyIds: ids, missingExamples: z.array(short).max(15).default([]), selfAssessment: note, employerFeedback: note, employerFeedbackSource: z.string().trim().max(240).optional(), nextPreparation: text, evidence: z.array(evidenceSchema).max(10).default([]) });
export const offerSchema = z.strictObject({ id, opportunityId: id, deadline: date.optional(), terms: z.array(z.strictObject({ label: short, value: text, certainty: z.enum(["written", "reported", "estimated", "unknown"]), source: short })).min(1).max(25), tradeoffs: text, unresolvedQuestions: z.array(short).max(15), negotiationPriorities: z.array(short).max(10), recruitingPromises: z.array(short).max(15).default([]) });
export const checkpointSchema = z.strictObject({ id, day: z.number().int().min(0).max(90), title: short, successEvidence: text, owner: short.default("Fellow") });

export const commandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("start_transition"), timing: short, question: text, weeklyHours: z.number().min(1).max(80), criteria: z.array(criterionSchema).max(20), hypotheses: z.array(hypothesisSchema).max(3) }),
  z.strictObject({ type: z.literal("confirm_criteria"), criteria: z.array(criterionSchema).min(1).max(20), reason: text }),
  z.strictObject({ type: z.literal("save_hypothesis"), hypothesis: hypothesisSchema }),
  z.strictObject({ type: z.literal("record_opportunity"), opportunity: opportunitySchema }),
  z.strictObject({ type: z.literal("record_evidence"), evidence: evidenceSchema }),
  z.strictObject({ type: z.literal("review_evidence"), evidenceId: id, decision: z.enum(["accept", "reject"]), rationale: text }),
  z.strictObject({ type: z.literal("resolve_requirement"), opportunityId: id, requirementId: id, status: z.enum(["met", "unknown", "not_met"]), evidenceIds: ids }),
  z.strictObject({ type: z.literal("decide_opportunity"), opportunityId: id, decision: z.enum(["pursue", "investigate", "decline", "pause"]), rationale: text, nextAction: text, revisitWhen: text, due: date.optional() }),
  z.strictObject({ type: z.literal("save_person"), person: personSchema }),
  z.strictObject({ type: z.literal("prepare_outreach"), personId: id }),
  z.strictObject({ type: z.literal("record_meeting"), meeting: meetingSchema }),
  z.strictObject({ type: z.literal("debrief_meeting"), meetingId: id, said: text, inferred: note, unresolved: z.array(short).max(15), evidence: z.array(evidenceSchema).max(15), commitments: z.array(commitmentSchema).max(15), introductions: z.array(short).max(10).default([]), nextTouch: date.optional() }),
  z.strictObject({ type: z.literal("save_commitment"), commitment: commitmentSchema }),
  z.strictObject({ type: z.literal("resolve_commitment"), commitmentId: id, status: z.enum(["done", "blocked", "cancelled"]), evidence: text }),
  z.strictObject({ type: z.literal("save_story"), story: storySchema }),
  z.strictObject({ type: z.literal("save_material"), material: materialSchema }),
  z.strictObject({ type: z.literal("record_submission"), opportunityId: id, materialIds: z.array(id).min(1).max(10), submittedAt: timestamp, receipt: text, confirmedSubmitted: z.literal(true) }),
  z.strictObject({ type: z.literal("record_application_outcome"), opportunityId: id, outcome: z.enum(["rejected", "withdrawn", "interview", "offer"]), reason: text, source: short, nextAction: text }),
  z.strictObject({ type: z.literal("record_interview"), interview: interviewSchema }),
  z.strictObject({ type: z.literal("record_offer"), offer: offerSchema }),
  z.strictObject({ type: z.literal("accept_offer"), offerId: id, rationale: text, confirmedAccepted: z.literal(true), startDate: date, checkpoints: z.array(checkpointSchema).min(3).max(15) }),
  z.strictObject({ type: z.literal("review_week"), learned: text, start: text, stop: text, change: text, hypothesisUpdates: z.array(hypothesisSchema).max(5), commitments: z.array(commitmentSchema).max(10) }),
  z.strictObject({ type: z.literal("prepare_action"), kind: z.enum(["email", "calendar_invite", "coach_share"]), recipient: short, subject: short, body: text, personId: id.optional(), meetingId: id.optional() }),
  z.strictObject({ type: z.literal("approve_action"), actionId: id, exactRevision: z.number().int().min(1) }),
  z.strictObject({ type: z.literal("revise_action"), actionId: id, recipient: short, subject: short, body: text }),
  z.strictObject({ type: z.literal("record_action_result"), actionId: id, outcome: z.enum(["manually_completed", "failed", "uncertain"]), receipt: text }),
  z.strictObject({ type: z.literal("retry_action"), actionId: id, confirmedNotExecuted: z.literal(true) }),
  z.strictObject({ type: z.literal("close_chapter"), reflection: text, carryForward: z.array(id).max(100), nextFocus: text })
]);
export const commandEnvelopeSchema = z.strictObject({ requestId: z.string().uuid(), expectedRevision: z.number().int().min(0), userConfirmed: z.literal(true), dataClass: z.literal("ordinary_transition_operations"), command: commandSchema });
export type Command = z.infer<typeof commandSchema>;
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema> & { updatedAt: string };
export type Evidence = z.infer<typeof evidenceSchema> & { review: "pending" | "accepted" | "rejected"; reviewedAt?: string; reviewRationale?: string; createdAt: string; criterionDesired?: string };
export type Opportunity = z.infer<typeof opportunitySchema> & { status: "exploring" | "pursue" | "investigate" | "decline" | "pause"; decision?: { rationale: string; nextAction: string; revisitWhen: string; at: string; due?: string; assessmentRevision: number }; createdAt: string };
export type Person = z.infer<typeof personSchema> & { firstContact?: string; lastInteraction?: string };
export type Meeting = z.infer<typeof meetingSchema> & { debrief?: { said: string; inferred: string; unresolved: string[]; introductions: string[]; at: string } };
export type Commitment = z.infer<typeof commitmentSchema> & { status: "open" | "done" | "blocked" | "cancelled"; result?: string; createdAt: string; updatedAt: string };
export type Story = z.infer<typeof storySchema> & { createdAt: string; updatedAt: string };
export type Material = z.infer<typeof materialSchema> & { version: number; createdAt: string };
export type Application = { opportunityId: string; submittedAt: string; receipt: string; materials: Material[]; status: "applied" | "rejected" | "withdrawn" | "interview" | "offer"; outcome?: { reason: string; source: string; at: string; nextAction: string } };
export type Interview = z.infer<typeof interviewSchema> & { recordedAt: string };
export type Offer = z.infer<typeof offerSchema> & { accepted?: { rationale: string; startDate: string; at: string } };
export type OutboundAction = { id: string; kind: "email" | "calendar_invite" | "coach_share"; recipient: string; subject: string; body: string; personId?: string; meetingId?: string; revision: number; state: "draft" | "approved_for_manual_execution" | "manually_completed" | "failed" | "uncertain" | "superseded"; meetingStamp?: string; receipt?: string; updatedAt: string; approvedAt?: string };
export type PilotState = {
  schemaVersion: 1; revision: number;
  chapter: { timing: string; question: string; weeklyHours: number; phase: "exploring" | "transitioning" | "professional_work"; startedAt: string; nextFocus?: string; reflection?: string; carryForward?: string[] } | null;
  criteria: Criterion[]; hypotheses: Hypothesis[]; opportunities: Opportunity[]; evidence: Evidence[]; people: Person[]; meetings: Meeting[]; commitments: Commitment[]; stories: Story[]; materials: Material[]; applications: Application[]; interviews: Interview[]; offers: Offer[]; actions: OutboundAction[];
  checkpoints: z.infer<typeof checkpointSchema>[];
  weeklyReviews: { id: string; at: string; learned: string; start: string; stop: string; change: string }[];
  changes: { id: string; at: string; kind: Command["type"]; summary: string }[];
  receipts: { requestId: string; command: string; revision: number }[];
};
export function emptyPilotState(): PilotState { return { schemaVersion: 1, revision: 0, chapter: null, criteria: [], hypotheses: [], opportunities: [], evidence: [], people: [], meetings: [], commitments: [], stories: [], materials: [], applications: [], interviews: [], offers: [], actions: [], checkpoints: [], weeklyReviews: [], changes: [], receipts: [] }; }
