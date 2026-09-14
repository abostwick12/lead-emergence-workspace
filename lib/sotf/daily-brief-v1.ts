import { z } from "zod";
import { dimensionSchema, type PilotState } from "./contracts";
import { SOTF_DAILY_BRIEF_VERSION, SOTF_DAILY_BRIEF_WORKFLOW_ID } from "./workflow-catalog";
import { clipSotfV1Text, compareSotfV1CanonicalText, SOTF_V1_PROJECTION_TEXT_LIMIT, sotfV1AuthorityIdentifierSchema, sotfV1TextSchema, sotfV1TextUnits } from "./v1-text";
import { isSotfV1CanonicalTimeZone, sotfV1CanonicalTimeZoneSchema } from "./v1-time-zones";

const id = sotfV1AuthorityIdentifierSchema(100);
const timeZone = sotfV1CanonicalTimeZoneSchema;
const outcomeConnectorState = z.enum(["used", "not_available", "failed", "not_requested"]);
const degradationReason = z.enum([
  "calendar_unavailable", "calendar_failed", "email_unavailable", "email_failed", "state_truncated",
]);

export const dailyBriefStateInputSchema = z.strictObject({
  workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID),
  workflow_version: z.literal(SOTF_DAILY_BRIEF_VERSION),
  brief_date: z.string().date(),
  time_zone: timeZone,
});

export const dailyBriefOutcomeSchema = z.strictObject({
  schema_version: z.literal("1"),
  request_id: z.string().uuid(),
  run_id: z.string().uuid(),
  workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID),
  workflow_version: z.literal(SOTF_DAILY_BRIEF_VERSION),
  expected_state_revision: z.number().int().min(0).max(2000),
  expected_authority_token: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  brief_date: z.string().date(),
  time_zone: timeZone,
  host: z.literal("chatgpt"),
  execution_mode: z.literal("A"),
  data_class: z.literal("ordinary_transition_operations"),
  user_confirmed: z.literal(true),
  status: z.enum(["completed", "degraded"]),
  connector_results: z.strictObject({ calendar_read: outcomeConnectorState, email_read: outcomeConnectorState }),
  degradation_reasons: z.array(degradationReason).max(5).refine((values) => new Set(values).size === values.length),
  selected_le_refs: z.array(z.strictObject({
    entity_type: z.enum(["criterion", "opportunity", "commitment", "meeting", "hypothesis"]),
    entity_id: id,
  })).max(3).refine((values) => new Set(values.map((item) => `${item.entity_type}:${item.entity_id}`)).size === values.length),
  priority_count: z.number().int().min(0).max(3),
  usefulness: z.enum(["useful", "not_useful", "not_rated"]),
  provenance: z.strictObject({
    source: z.literal("host_reported_user_confirmed"),
    provider_content_persisted: z.literal(false),
  }),
}).superRefine((outcome, context) => {
  if (outcome.selected_le_refs.length > outcome.priority_count) {
    context.addIssue({ code: "custom", path: ["selected_le_refs"], message: "Selected LE references cannot exceed the priority count." });
  }
  const requiredReasons = requiredDegradationReasons(outcome.connector_results);
  const actualConnectorReasons = outcome.degradation_reasons.filter((reason) => reason !== "state_truncated");
  const requiredReasonSet = new Set<string>(requiredReasons);
  if (requiredReasons.length !== actualConnectorReasons.length
    || actualConnectorReasons.some((reason) => !requiredReasonSet.has(reason))) {
    context.addIssue({ code: "custom", path: ["degradation_reasons"], message: "Degradation reasons must exactly match unavailable or failed connectors." });
  }
  const complete = outcome.connector_results.calendar_read === "used"
    && outcome.connector_results.email_read === "used"
    && outcome.degradation_reasons.length === 0;
  if ((outcome.status === "completed") !== complete) {
    context.addIssue({ code: "custom", path: ["status"], message: "Completed requires both connectors and an untruncated state projection." });
  }
});

export type DailyBriefStateInput = z.infer<typeof dailyBriefStateInputSchema>;
export type DailyBriefOutcome = z.infer<typeof dailyBriefOutcomeSchema>;

export const dailyBriefProjectionAuthoritySchema = z.strictObject({
  authority_version: z.literal("1"),
  authority_token: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  authority_local_day: z.string().date(),
  workspace_id: z.string().uuid(),
  workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID),
  workflow_version: z.literal(SOTF_DAILY_BRIEF_VERSION),
  state_revision: z.number().int().min(0).max(2000),
  as_of: z.string().datetime({ offset: true }),
  brief_date: z.string().date(),
  time_zone: timeZone,
  window_start: z.string().datetime({ offset: true }),
  window_end: z.string().datetime({ offset: true }),
  eligible_refs: z.array(z.strictObject({
    entity_type: z.enum(["criterion", "opportunity", "commitment", "meeting", "hypothesis"]),
    entity_id: id,
  })),
  truncated_sections: z.array(z.enum(["chapter", "criteria", "opportunities", "commitments", "meetings", "hypotheses", "recent_outcomes"])),
  projection_fingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  projection: z.unknown(),
});

export type DailyBriefProjectionAuthority = z.infer<typeof dailyBriefProjectionAuthoritySchema>;

export type DailyBriefOutcomeReceipt = {
  outcome_id: string;
  request_id: string;
  run_id: string;
  workflow_id: typeof SOTF_DAILY_BRIEF_WORKFLOW_ID;
  workflow_version: typeof SOTF_DAILY_BRIEF_VERSION;
  state_revision: number;
  recorded_at: string;
  brief_date: string;
  time_zone: string;
  status: "completed" | "degraded";
  connector_results: DailyBriefOutcome["connector_results"];
  degradation_reasons: DailyBriefOutcome["degradation_reasons"];
  selected_le_refs: DailyBriefOutcome["selected_le_refs"];
  priority_count: number;
  usefulness: DailyBriefOutcome["usefulness"];
  provenance: DailyBriefOutcome["provenance"] & { workspace_id?: string; subject_id?: string; client_id?: string };
};

export class DailyBriefContractError extends Error {
  constructor(readonly code: "invalid_input" | "transition_not_started", message: string) {
    super(message);
    this.name = "DailyBriefContractError";
  }
}

/** Consume the closed PostgreSQL projection without recreating governed facts. */
export function consumeDailyBriefProjectionAuthority(
  authority: DailyBriefProjectionAuthority,
  workspaceId: string,
  input: DailyBriefStateInput,
) {
  const projection = dailyBriefStateProjectionSchema.parse(authority.projection);
  if (authority.workspace_id !== workspaceId
    || authority.workflow_id !== input.workflow_id
    || authority.workflow_version !== input.workflow_version
    || authority.brief_date !== input.brief_date
    || authority.time_zone !== input.time_zone
    || projection.workspace_id !== workspaceId
    || projection.workflow_id !== input.workflow_id
    || projection.workflow_version !== input.workflow_version
    || projection.brief_date !== input.brief_date
    || projection.time_zone !== input.time_zone
    || projection.as_of !== authority.as_of
    || projection.state_revision !== authority.state_revision) {
    throw new Error("The database authority does not match the requested SOTF projection.");
  }
  assertProjectionMatchesAuthority(projection, authority);
  return projection;
}

export function projectDailyBriefState(
  state: PilotState,
  workspaceId: string,
  input: DailyBriefStateInput,
  recentOutcomes: DailyBriefOutcomeReceipt[] = [],
  now = new Date(),
  authority?: DailyBriefProjectionAuthority,
) {
  if (authority) return consumeDailyBriefProjectionAuthority(authority, workspaceId, input);
  const window = dailyBriefWindow(input.brief_date, input.time_zone, now);
  if (!state.chapter) throw new DailyBriefContractError("transition_not_started", "Start the ordinary transition chapter before requesting a daily brief.");

  const truncated = new Set<string>();
  const omitted: Record<ProjectionSection, number> = {
    criteria: 0, opportunities: 0, commitments: 0, meetings: 0, hypotheses: 0, recent_outcomes: 0,
  };
  const clip = (value: string, maximum: number, section: ProjectionSection | "chapter") => {
    if (sotfV1TextUnits(value) <= maximum) return value;
    truncated.add(section);
    return clipSotfV1Text(value, maximum);
  };
  const take = <T>(items: T[], maximum: number, section: ProjectionSection, candidateCount = items.length) => {
    omitted[section] += Math.max(0, candidateCount - maximum);
    if (candidateCount > maximum) truncated.add(section);
    return items.slice(0, maximum);
  };

  const criteriaCandidates = [...state.criteria];
  const criteria = take(criteriaCandidates
    .sort((a, b) => b.importance - a.importance || compareSotfV1CanonicalText(a.id, b.id)), 20, "criteria", criteriaCandidates.length)
    .map((item) => ({
      id: item.id,
      label: item.label,
      dimension: item.dimension,
      desired: clip(item.desired, SOTF_V1_PROJECTION_TEXT_LIMIT, "criteria"),
      non_negotiable: item.nonNegotiable,
      importance: item.importance,
      confirmed: true as const,
    }));

  const opportunityCandidates = state.opportunities
    .filter((item) => !["decline", "pause"].includes(item.status) && item.deadline && item.deadline < window.end_date);
  const opportunities = take(opportunityCandidates
    .sort((a, b) => compareSotfV1CanonicalText(a.deadline ?? "", b.deadline ?? "") || compareSotfV1CanonicalText(a.id, b.id)), 10, "opportunities", opportunityCandidates.length)
    .map((item) => ({
      id: item.id,
      company: item.company,
      role: item.role,
      status: item.status,
      deadline: item.deadline ?? null,
      next_action: item.decision?.nextAction ? clip(item.decision.nextAction, SOTF_V1_PROJECTION_TEXT_LIMIT, "opportunities") : null,
    }));

  const commitmentCandidates = state.commitments
    .filter((item) => ["open", "blocked"].includes(item.status) && item.due && item.due < window.end_date);
  const commitments = take(commitmentCandidates
    .sort((a, b) => compareSotfV1CanonicalText(a.due ?? "", b.due ?? "") || compareSotfV1CanonicalText(a.id, b.id)), 10, "commitments", commitmentCandidates.length)
    .map((item) => ({
      id: item.id,
      title: item.title,
      due: item.due ?? null,
      status: item.status,
      definition_of_done: clip(item.definitionOfDone, SOTF_V1_PROJECTION_TEXT_LIMIT, "commitments"),
      review_trigger: clip(item.reviewTrigger, SOTF_V1_PROJECTION_TEXT_LIMIT, "commitments"),
    }));

  const meetingCandidates = state.meetings
    .filter((item) => ["planned", "accepted"].includes(item.status)
      && item.startsAt < window.window_end && item.endsAt > window.window_start);
  const meetings = take(meetingCandidates
    .sort((a, b) => compareSotfV1CanonicalText(a.startsAt, b.startsAt) || compareSotfV1CanonicalText(a.id, b.id)), 10, "meetings", meetingCandidates.length)
    .map((item) => ({
      id: item.id,
      title: item.title,
      starts_at: item.startsAt,
      ends_at: item.endsAt,
      status: item.status,
      objective: clip(item.objective, SOTF_V1_PROJECTION_TEXT_LIMIT, "meetings"),
    }));

  const hypothesisCandidates = state.hypotheses
    .filter((item) => ["continue", "refine"].includes(item.status));
  const hypotheses = take(hypothesisCandidates
    .sort((a, b) => compareSotfV1CanonicalText(a.id, b.id)), 3, "hypotheses", hypothesisCandidates.length)
    .map((item) => ({
      id: item.id,
      proposition: item.proposition,
      next_experiment: clip(item.nextExperiment, SOTF_V1_PROJECTION_TEXT_LIMIT, "hypotheses"),
      review_trigger: clip(item.reviewTrigger, SOTF_V1_PROJECTION_TEXT_LIMIT, "hypotheses"),
      status: item.status,
      epistemic_status: "provisional" as const,
    }));

  const outcomes = take(recentOutcomes
    .filter((item) => item.workflow_id === SOTF_DAILY_BRIEF_WORKFLOW_ID && item.workflow_version === SOTF_DAILY_BRIEF_VERSION)
    .sort((a, b) => compareSotfV1CanonicalText(b.recorded_at, a.recorded_at) || compareSotfV1CanonicalText(b.outcome_id, a.outcome_id)), 3, "recent_outcomes");

  const projection = {
    projection_version: "1" as const,
    workspace_id: workspaceId,
    workflow_id: SOTF_DAILY_BRIEF_WORKFLOW_ID,
    workflow_version: SOTF_DAILY_BRIEF_VERSION,
    state_revision: state.revision,
    as_of: now.toISOString(),
    brief_date: input.brief_date,
    time_zone: input.time_zone,
    window_start: window.window_start,
    window_end: window.window_end,
    chapter: {
      question: clip(state.chapter.question, SOTF_V1_PROJECTION_TEXT_LIMIT, "chapter"),
      phase: state.chapter.phase,
      weekly_hours: state.chapter.weeklyHours,
    },
    criteria,
    opportunities,
    commitments,
    meetings,
    hypotheses,
    suggestions: buildSuggestions(input.brief_date, opportunities, commitments, meetings, hypotheses),
    recent_outcomes: outcomes,
    truncated_sections: [...truncated].sort(compareSotfV1CanonicalText),
    omitted_counts: omitted,
  };

  enforceProjectionByteLimit(projection, truncated);
  projection.truncated_sections = [...truncated].sort(compareSotfV1CanonicalText);
  const parsed = dailyBriefStateProjectionSchema.parse(projection);
  return parsed;
}

export function dailyBriefWindow(briefDate: string, timeZone: string, now = new Date()) {
  const date = parseDate(briefDate);
  assertTimeZone(timeZone);
  const today = localDateAt(now, timeZone);
  const yesterday = addLocalDays(today, -1);
  if (briefDate !== today && briefDate !== yesterday) {
    throw new DailyBriefContractError("invalid_input", "The brief date must be today or the immediately preceding local date.");
  }
  const endDate = addLocalDays(briefDate, 2);
  return {
    brief_date: briefDate,
    end_date: endDate,
    window_start: zonedMidnight(date, timeZone).toISOString(),
    window_end: zonedMidnight(parseDate(endDate), timeZone).toISOString(),
    email_window_start: zonedMidnight(parseDate(addLocalDays(briefDate, -6)), timeZone).toISOString(),
    email_window_end: zonedMidnight(parseDate(addLocalDays(briefDate, 1)), timeZone).toISOString(),
  };
}

function assertProjectionMatchesAuthority(
  projection: z.infer<typeof dailyBriefStateProjectionSchema>,
  authority: DailyBriefProjectionAuthority,
) {
  const projectedRefs = [
    ...projection.criteria.map((item) => ({ entity_type: "criterion" as const, entity_id: item.id })),
    ...projection.opportunities.map((item) => ({ entity_type: "opportunity" as const, entity_id: item.id })),
    ...projection.commitments.map((item) => ({ entity_type: "commitment" as const, entity_id: item.id })),
    ...projection.meetings.map((item) => ({ entity_type: "meeting" as const, entity_id: item.id })),
    ...projection.hypotheses.map((item) => ({ entity_type: "hypothesis" as const, entity_id: item.id })),
  ].sort((left, right) => compareSotfV1CanonicalText(left.entity_type, right.entity_type)
    || compareSotfV1CanonicalText(left.entity_id, right.entity_id));
  const authorityRefs = [...authority.eligible_refs].sort((left, right) => compareSotfV1CanonicalText(left.entity_type, right.entity_type)
    || compareSotfV1CanonicalText(left.entity_id, right.entity_id));
  if (projection.window_start !== authority.window_start
    || projection.window_end !== authority.window_end
    || JSON.stringify(projectedRefs) !== JSON.stringify(authorityRefs)
    || JSON.stringify(projection.truncated_sections) !== JSON.stringify(authority.truncated_sections)) {
    throw new Error("The application projection diverged from database authority.");
  }
}

export function isDailyBriefReferenceEligible(
  projection: ReturnType<typeof projectDailyBriefState>,
  reference: DailyBriefOutcome["selected_le_refs"][number],
) {
  const section = reference.entity_type === "criterion" ? projection.criteria
    : reference.entity_type === "opportunity" ? projection.opportunities
      : reference.entity_type === "commitment" ? projection.commitments
        : reference.entity_type === "meeting" ? projection.meetings
          : projection.hypotheses;
  return section.some((item) => item.id === reference.entity_id);
}

function requiredDegradationReasons(connectors: DailyBriefOutcome["connector_results"]) {
  const reasons: Array<z.infer<typeof degradationReason>> = [];
  if (connectors.calendar_read === "not_available") reasons.push("calendar_unavailable");
  if (connectors.calendar_read === "failed") reasons.push("calendar_failed");
  if (connectors.email_read === "not_available") reasons.push("email_unavailable");
  if (connectors.email_read === "failed") reasons.push("email_failed");
  return reasons;
}

type ProjectionSection = "criteria" | "opportunities" | "commitments" | "meetings" | "hypotheses" | "recent_outcomes";

function buildSuggestions(
  briefDate: string,
  opportunities: Array<{ id: string; deadline: string | null }>,
  commitments: Array<{ id: string; due: string | null; status: string }>,
  meetings: Array<{ id: string; starts_at: string }>,
  hypotheses: Array<{ id: string }>,
) {
  const values: Array<{ source_ref: { entity_type: string; entity_id: string }; reason_code: string; epistemic_status: "derived"; order: string }> = [];
  for (const item of commitments) values.push({
    source_ref: { entity_type: "commitment", entity_id: item.id },
    reason_code: item.due && item.due < briefDate ? "overdue" : "due_soon",
    epistemic_status: "derived",
    order: `${item.due ?? "9999"}:${item.id}`,
  });
  for (const item of meetings) values.push({ source_ref: { entity_type: "meeting", entity_id: item.id }, reason_code: "meeting_soon", epistemic_status: "derived", order: `${item.starts_at}:${item.id}` });
  for (const item of opportunities) values.push({ source_ref: { entity_type: "opportunity", entity_id: item.id }, reason_code: "deadline_soon", epistemic_status: "derived", order: `${item.deadline ?? "9999"}:${item.id}` });
  for (const item of hypotheses) values.push({ source_ref: { entity_type: "hypothesis", entity_id: item.id }, reason_code: "learning_step", epistemic_status: "derived", order: `9999:${item.id}` });
  const rank: Record<string, number> = { overdue: 0, meeting_soon: 1, deadline_soon: 2, due_soon: 3, learning_step: 4 };
  return values.sort((a, b) => rank[a.reason_code] - rank[b.reason_code] || compareSotfV1CanonicalText(a.order, b.order))
    .slice(0, 3).map(({ order: _order, ...item }) => item);
}

function enforceProjectionByteLimit(projection: {
  criteria: unknown[]; opportunities: unknown[]; commitments: unknown[]; meetings: unknown[];
  hypotheses: unknown[]; recent_outcomes: unknown[]; suggestions: Array<{ source_ref: { entity_type: string; entity_id: string } }>;
  omitted_counts: Record<ProjectionSection, number>; truncated_sections: string[];
}, truncated: Set<string>) {
  const order: ProjectionSection[] = ["recent_outcomes", "hypotheses", "meetings", "commitments", "opportunities", "criteria"];
  for (const section of order) {
    while (Buffer.byteLength(JSON.stringify(projection), "utf8") > 64 * 1024 && projection[section].length > 0) {
      projection[section].pop();
      projection.omitted_counts[section] += 1;
      truncated.add(section);
      projection.truncated_sections = [...truncated].sort(compareSotfV1CanonicalText);
    }
  }
  const available = new Set<string>();
  const entityBySection = {
    criteria: "criterion", opportunities: "opportunity", commitments: "commitment", meetings: "meeting", hypotheses: "hypothesis",
  } as const;
  for (const section of Object.keys(entityBySection) as Array<keyof typeof entityBySection>) {
    for (const item of projection[section] as Array<{ id: string }>) available.add(`${entityBySection[section]}:${item.id}`);
  }
  projection.suggestions = projection.suggestions.filter((item) => available.has(`${item.source_ref.entity_type}:${item.source_ref.entity_id}`));
  if (Buffer.byteLength(JSON.stringify(projection), "utf8") > 64 * 1024) {
    throw new DailyBriefContractError("invalid_input", "The bounded daily-brief projection exceeded its safe response size.");
  }
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DailyBriefContractError("invalid_input", "Use an ISO local date.");
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new DailyBriefContractError("invalid_input", "Use a real calendar date.");
  }
  return { year, month, day };
}

function assertTimeZone(timeZone: string) {
  if (!isSotfV1CanonicalTimeZone(timeZone)) {
    throw new DailyBriefContractError("invalid_input", "Use a canonical SOTF v1 IANA time zone.");
  }
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); }
  catch { throw new DailyBriefContractError("invalid_input", "Use a supported IANA time zone."); }
}

function localDateAt(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function addLocalDays(value: string, days: number) {
  const date = parseDate(value);
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return shifted.toISOString().slice(0, 10);
}

function zonedMidnight(target: { year: number; month: number; day: number }, timeZone: string) {
  const desired = Date.UTC(target.year, target.month - 1, target.day);
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    candidate += desired - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  }
  const result = new Date(candidate);
  const actual = zonedParts(result, timeZone);
  if (actual.year !== target.year || actual.month !== target.month || actual.day !== target.day || actual.hour !== 0 || actual.minute !== 0) {
    throw new DailyBriefContractError("invalid_input", "This time zone cannot represent the requested local-day boundary safely.");
  }
  return result;
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

export const dailyBriefOutcomeReceiptSchema = z.strictObject({
  outcome_id: z.string().uuid(), request_id: z.string().uuid(), run_id: z.string().uuid(),
  workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID), workflow_version: z.literal(SOTF_DAILY_BRIEF_VERSION),
  state_revision: z.number().int().min(0).max(2000), recorded_at: z.string().datetime({ offset: true }),
  brief_date: z.string().date(), time_zone: timeZone, status: z.enum(["completed", "degraded"]),
  connector_results: z.strictObject({ calendar_read: outcomeConnectorState, email_read: outcomeConnectorState }),
  degradation_reasons: z.array(degradationReason).max(5), selected_le_refs: z.array(z.strictObject({ entity_type: z.enum(["criterion", "opportunity", "commitment", "meeting", "hypothesis"]), entity_id: id })).max(3),
  priority_count: z.number().int().min(0).max(3), usefulness: z.enum(["useful", "not_useful", "not_rated"]),
  provenance: z.object({ source: z.literal("host_reported_user_confirmed"), provider_content_persisted: z.literal(false) }).passthrough(),
});

export const dailyBriefStateProjectionSchema = z.strictObject({
  projection_version: z.literal("1"), workspace_id: z.string().uuid(),
  workflow_id: z.literal(SOTF_DAILY_BRIEF_WORKFLOW_ID), workflow_version: z.literal(SOTF_DAILY_BRIEF_VERSION),
  state_revision: z.number().int().min(0).max(2000), as_of: z.string().datetime({ offset: true }),
  brief_date: z.string().date(), time_zone: timeZone,
  window_start: z.string().datetime({ offset: true }), window_end: z.string().datetime({ offset: true }),
  chapter: z.strictObject({
    question: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT), phase: z.enum(["exploring", "transitioning", "professional_work"]),
    weekly_hours: z.number().min(1).max(80),
  }),
  criteria: z.array(z.strictObject({
    id, label: sotfV1TextSchema(240, 1), dimension: dimensionSchema, desired: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT),
    non_negotiable: z.boolean(), importance: z.number().int().min(1).max(5), confirmed: z.literal(true),
  })).max(20),
  opportunities: z.array(z.strictObject({
    id, company: sotfV1TextSchema(240, 1), role: sotfV1TextSchema(240, 1),
    status: z.enum(["exploring", "pursue", "investigate"]), deadline: z.string().date().nullable(),
    next_action: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT).nullable(),
  })).max(10),
  commitments: z.array(z.strictObject({
    id, title: sotfV1TextSchema(240, 1), due: z.string().date().nullable(), status: z.enum(["open", "blocked"]),
    definition_of_done: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT), review_trigger: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT),
  })).max(10),
  meetings: z.array(z.strictObject({
    id, title: sotfV1TextSchema(240, 1), starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }), status: z.enum(["planned", "accepted"]), objective: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT),
  })).max(10),
  hypotheses: z.array(z.strictObject({
    id, proposition: sotfV1TextSchema(240, 1), next_experiment: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT), review_trigger: sotfV1TextSchema(SOTF_V1_PROJECTION_TEXT_LIMIT),
    status: z.enum(["continue", "refine"]), epistemic_status: z.literal("provisional"),
  })).max(3),
  suggestions: z.array(z.strictObject({
    source_ref: z.strictObject({ entity_type: z.enum(["opportunity", "commitment", "meeting", "hypothesis"]), entity_id: id }),
    reason_code: z.enum(["overdue", "due_soon", "meeting_soon", "deadline_soon", "learning_step"]),
    epistemic_status: z.literal("derived"),
  })).max(3),
  recent_outcomes: z.array(dailyBriefOutcomeReceiptSchema).max(3),
  truncated_sections: z.array(z.enum(["chapter", "criteria", "opportunities", "commitments", "meetings", "hypotheses", "recent_outcomes"])),
  omitted_counts: z.strictObject({
    criteria: z.number().int().nonnegative(), opportunities: z.number().int().nonnegative(),
    commitments: z.number().int().nonnegative(), meetings: z.number().int().nonnegative(),
    hypotheses: z.number().int().nonnegative(), recent_outcomes: z.number().int().nonnegative(),
  }),
});
