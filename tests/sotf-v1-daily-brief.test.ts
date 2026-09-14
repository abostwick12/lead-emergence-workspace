import { describe, expect, it } from "vitest";
import { dailyBriefOutcomeSchema, dailyBriefWindow, projectDailyBriefState, type DailyBriefProjectionAuthority } from "@/lib/sotf/daily-brief-v1";
import { emptyPilotState, type PilotState } from "@/lib/sotf/contracts";

const workspaceId = "71000000-0000-4000-8000-000000000001";
const now = new Date("2026-03-08T18:00:00.000Z");

function state(): PilotState {
  return {
    ...emptyPilotState(), revision: 7,
    chapter: { timing: "Spring", question: "Which work is worth testing?", weeklyHours: 8, phase: "exploring", startedAt: "2026-03-01T12:00:00.000Z" },
    criteria: [{ id: "ownership", label: "Ownership", dimension: "actual_work", desired: "Own a meaningful decision", nonNegotiable: false, importance: 5, confirmed: true }],
    opportunities: [{ id: "role", company: "Fictional Northstar", role: "Program Lead", description: "Synthetic role", hypothesisIds: [], requirements: [], deadline: "2026-03-09", actualWork: "Unknown", decisionQuestion: "Should I test it?", status: "investigate", createdAt: "2026-03-01T12:00:00.000Z" }],
    commitments: [{ id: "follow-up", title: "Send reviewed follow-up", owner: "Fellow", due: "2026-03-08", definitionOfDone: "Recipient has it", reviewTrigger: "Before noon", status: "open", createdAt: "2026-03-01T12:00:00.000Z", updatedAt: "2026-03-01T12:00:00.000Z" }],
    meetings: [{ id: "conversation", title: "Learning conversation", kind: "networking", startsAt: "2026-03-09T14:00:00.000Z", endsAt: "2026-03-09T14:30:00.000Z", status: "accepted", provider: "manual", objective: "Learn the actual work", hypothesisIds: [] }],
    hypotheses: [{ id: "direction", proposition: "Program leadership may fit", whyPromising: "Synthetic evidence", assumptions: [], gaps: [], nextExperiment: "Ask about decisions", reviewTrigger: "After two conversations", status: "continue", confidenceExplanation: "Provisional", updatedAt: "2026-03-01T12:00:00.000Z" }],
  };
}

function databaseProjection(input: {
  revision: number; date: string; zone: string; start: string; end: string;
  meetings: Array<{ id: string; title: string; startsAt: string; endsAt: string; status: PilotState["meetings"][number]["status"]; objective: string }>;
}) {
  return {
    projection_version: "1" as const, workspace_id: workspaceId,
    workflow_id: "transition.daily_brief" as const, workflow_version: "1.0.0" as const,
    state_revision: input.revision, as_of: "2026-09-13T12:00:00.000Z",
    brief_date: input.date, time_zone: input.zone, window_start: input.start, window_end: input.end,
    chapter: { question: "Which work is worth testing?", phase: "exploring" as const, weekly_hours: 8 },
    criteria: [], opportunities: [], commitments: [],
    meetings: input.meetings.map((item) => ({
      id: item.id, title: item.title, starts_at: item.startsAt, ends_at: item.endsAt,
      status: item.status as "planned" | "accepted", objective: item.objective,
    })),
    hypotheses: [],
    suggestions: input.meetings.slice(0, 3).map((item) => ({
      source_ref: { entity_type: "meeting" as const, entity_id: item.id },
      reason_code: "meeting_soon" as const, epistemic_status: "derived" as const,
    })),
    recent_outcomes: [], truncated_sections: [],
    omitted_counts: { criteria: 0, opportunities: 0, commitments: 0, meetings: 0, hypotheses: 0, recent_outcomes: 0 },
  };
}

describe("SOTF v1 bounded daily-brief state", () => {
  it("uses the requested IANA zone across a DST-shortened local window", () => {
    expect(dailyBriefWindow("2026-03-08", "America/Chicago", now)).toEqual({
      brief_date: "2026-03-08", end_date: "2026-03-10",
      window_start: "2026-03-08T06:00:00.000Z", window_end: "2026-03-10T05:00:00.000Z",
      email_window_start: "2026-03-02T06:00:00.000Z", email_window_end: "2026-03-09T05:00:00.000Z",
    });
    expect(() => dailyBriefWindow("2026-03-06", "America/Chicago", now)).toThrow("today or the immediately preceding");
    expect(() => dailyBriefWindow("2026-03-08", "Not/A_Zone", now)).toThrow("IANA");
  });

  it("uses the user's local date rather than the UTC date near midnight", () => {
    const nearMidnight = new Date("2026-09-12T04:30:00.000Z");
    expect(dailyBriefWindow("2026-09-11", "America/Chicago", nearMidnight)).toMatchObject({
      window_start: "2026-09-11T05:00:00.000Z", window_end: "2026-09-13T05:00:00.000Z",
    });
    expect(() => dailyBriefWindow("2026-09-12", "America/Chicago", nearMidnight)).toThrow("today or the immediately preceding");
  });

  it("returns only the bounded ordinary state needed by the hosted workflow", () => {
    const projection = projectDailyBriefState(state(), workspaceId, {
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
      brief_date: "2026-03-08", time_zone: "America/Chicago",
    }, [], now);
    expect(projection).toMatchObject({ workspace_id: workspaceId, state_revision: 7, criteria: [{ id: "ownership" }], opportunities: [{ id: "role" }], commitments: [{ id: "follow-up" }], meetings: [{ id: "conversation" }], hypotheses: [{ id: "direction", epistemic_status: "provisional" }] });
    expect(projection.suggestions).toHaveLength(3);
    expect(Object.keys(projection)).not.toEqual(expect.arrayContaining(["evidence", "people", "stories", "materials", "applications", "interviews", "offers", "actions"]));
    expect(JSON.stringify(projection)).not.toContain("provider_payload");
    expect(Buffer.byteLength(JSON.stringify(projection), "utf8")).toBeLessThanOrEqual(64 * 1024);
  });

  it("uses database-owned UTC boundaries for governed meeting eligibility", () => {
    const boundedState = state();
    boundedState.revision = 8;
    boundedState.meetings = [{
      id: "asuncion-boundary", title: "Boundary meeting", kind: "networking",
      startsAt: "2026-09-15T03:15:00.000Z", endsAt: "2026-09-15T03:45:00.000Z",
      status: "accepted", provider: "manual", objective: "Exercise the database boundary", hypothesisIds: [],
    }];
    boundedState.opportunities = [];
    boundedState.commitments = [];
    boundedState.hypotheses = [];
    boundedState.criteria = [];
    const authority: DailyBriefProjectionAuthority = {
      authority_version: "1",
      authority_token: `sha256:${"a".repeat(64)}`,
      authority_local_day: "2026-09-13",
      workspace_id: workspaceId,
      workflow_id: "transition.daily_brief",
      workflow_version: "1.0.0",
      state_revision: 8,
      as_of: "2026-09-13T12:00:00.000Z",
      brief_date: "2026-09-13",
      time_zone: "America/Asuncion",
      window_start: "2026-09-13T04:00:00.000Z",
      window_end: "2026-09-15T04:00:00.000Z",
      eligible_refs: [{ entity_type: "meeting", entity_id: "asuncion-boundary" }],
      truncated_sections: [],
      projection_fingerprint: `sha256:${"d".repeat(64)}`,
      projection: databaseProjection({
        revision: 8, date: "2026-09-13", zone: "America/Asuncion",
        start: "2026-09-13T04:00:00.000Z", end: "2026-09-15T04:00:00.000Z",
        meetings: boundedState.meetings,
      }),
    };
    const projection = projectDailyBriefState(boundedState, workspaceId, {
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
      brief_date: "2026-09-13", time_zone: "America/Asuncion",
    }, [], new Date(authority.as_of), authority);
    expect(projection.window_end).toBe("2026-09-15T04:00:00.000Z");
    expect(projection.meetings).toEqual([expect.objectContaining({ id: "asuncion-boundary" })]);
  });

  it("uses database membership when sub-millisecond timestamps collapse in application presentation", () => {
    const boundedState = state();
    boundedState.revision = 9;
    boundedState.criteria = [];
    boundedState.opportunities = [];
    boundedState.commitments = [];
    boundedState.hypotheses = [];
    const fractions = ["000000", "000001", "000499", "000500", "000999", "001000", "001001"];
    boundedState.meetings = fractions.map((fraction) => ({
      id: `fraction-${fraction}`,
      title: `Fraction ${fraction}`,
      kind: "networking" as const,
      startsAt: "2026-09-12T23:59:00.000Z",
      endsAt: `2026-09-13T00:00:00.${fraction}Z`,
      status: "accepted" as const,
      provider: "manual" as const,
      objective: "Exercise database-owned timestamp membership",
      hypothesisIds: [],
    }));
    const eligible = fractions.slice(1).map((fraction) => ({
      entity_type: "meeting" as const,
      entity_id: `fraction-${fraction}`,
    }));
    const authority: DailyBriefProjectionAuthority = {
      authority_version: "1",
      authority_token: `sha256:${"b".repeat(64)}`,
      authority_local_day: "2026-09-13",
      workspace_id: workspaceId,
      workflow_id: "transition.daily_brief",
      workflow_version: "1.0.0",
      state_revision: 9,
      as_of: "2026-09-13T12:00:00.000Z",
      brief_date: "2026-09-13",
      time_zone: "UTC",
      window_start: "2026-09-13T00:00:00.000Z",
      window_end: "2026-09-15T00:00:00.000Z",
      eligible_refs: eligible,
      truncated_sections: [],
      projection_fingerprint: `sha256:${"e".repeat(64)}`,
      projection: databaseProjection({
        revision: 9, date: "2026-09-13", zone: "UTC",
        start: "2026-09-13T00:00:00.000Z", end: "2026-09-15T00:00:00.000Z",
        meetings: boundedState.meetings.slice(1),
      }),
    };

    const projection = projectDailyBriefState(boundedState, workspaceId, {
      workflow_id: "transition.daily_brief",
      workflow_version: "1.0.0",
      brief_date: "2026-09-13",
      time_zone: "UTC",
    }, [], new Date(authority.as_of), authority);

    expect(projection.meetings.map((meeting) => meeting.id)).toEqual(eligible.map((reference) => reference.entity_id));
    expect(projection.meetings.find((meeting) => meeting.id === "fraction-000500")?.ends_at)
      .toBe("2026-09-13T00:00:00.000500Z");
    expect(projection.meetings.some((meeting) => meeting.id === "fraction-000000")).toBe(false);
  });

  it("does not let a locally plausible timestamp add a reference excluded by database authority", () => {
    const boundedState = state();
    boundedState.revision = 10;
    boundedState.criteria = [];
    boundedState.opportunities = [];
    boundedState.commitments = [];
    boundedState.hypotheses = [];
    boundedState.meetings = [{
      id: "locally-plausible", title: "Locally plausible", kind: "networking",
      startsAt: "2026-09-13T00:00:00.001Z", endsAt: "2026-09-13T00:30:00.000Z",
      status: "accepted", provider: "manual", objective: "Must follow database membership", hypothesisIds: [],
    }];
    const authority: DailyBriefProjectionAuthority = {
      authority_version: "1", authority_token: `sha256:${"c".repeat(64)}`,
      authority_local_day: "2026-09-13", workspace_id: workspaceId,
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0", state_revision: 10,
      as_of: "2026-09-13T12:00:00.000Z", brief_date: "2026-09-13", time_zone: "UTC",
      window_start: "2026-09-13T00:00:00.000Z", window_end: "2026-09-15T00:00:00.000Z",
      eligible_refs: [], truncated_sections: [],
      projection_fingerprint: `sha256:${"f".repeat(64)}`,
      projection: databaseProjection({
        revision: 10, date: "2026-09-13", zone: "UTC",
        start: "2026-09-13T00:00:00.000Z", end: "2026-09-15T00:00:00.000Z",
        meetings: [],
      }),
    };

    const projection = projectDailyBriefState(boundedState, workspaceId, {
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
      brief_date: "2026-09-13", time_zone: "UTC",
    }, [], new Date(authority.as_of), authority);
    expect(projection.meetings).toEqual([]);
  });

  it("marks bounded truncation and never emits more than the contract limits", () => {
    const large = state();
    large.criteria = Array.from({ length: 25 }, (_, index) => ({
      id: `criterion-${index}`, label: `Criterion ${index}`, dimension: "actual_work" as const,
      desired: "x".repeat(700), nonNegotiable: false, importance: 3, confirmed: true as const,
    }));
    const projection = projectDailyBriefState(large, workspaceId, {
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
      brief_date: "2026-03-08", time_zone: "America/Chicago",
    }, [], now);
    expect(projection.criteria).toHaveLength(20);
    expect(projection.omitted_counts.criteria).toBe(5);
    expect(projection.truncated_sections).toContain("criteria");
  });

  it("accepts only reviewed metadata with exact degradation semantics", () => {
    const base = {
      schema_version: "1", request_id: "72000000-0000-4000-8000-000000000001", run_id: "72000000-0000-4000-8000-000000000002",
      workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: 7,
      expected_authority_token: `sha256:${"a".repeat(64)}`,
      brief_date: "2026-03-08", time_zone: "America/Chicago", host: "chatgpt", execution_mode: "A",
      data_class: "ordinary_transition_operations", user_confirmed: true, priority_count: 1,
      selected_le_refs: [{ entity_type: "commitment", entity_id: "follow-up" }], usefulness: "not_rated",
      provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
    } as const;
    expect(dailyBriefOutcomeSchema.safeParse({ ...base, status: "completed", connector_results: { calendar_read: "used", email_read: "used" }, degradation_reasons: [] }).success).toBe(true);
    expect(dailyBriefOutcomeSchema.safeParse({ ...base, status: "degraded", connector_results: { calendar_read: "not_available", email_read: "used" }, degradation_reasons: ["calendar_unavailable"] }).success).toBe(true);
    expect(dailyBriefOutcomeSchema.safeParse({ ...base, status: "completed", connector_results: { calendar_read: "not_available", email_read: "used" }, degradation_reasons: [] }).success).toBe(false);
    expect(dailyBriefOutcomeSchema.safeParse({ ...base, status: "degraded", connector_results: { calendar_read: "used", email_read: "used" }, degradation_reasons: [], provider_content: "forbidden" }).success).toBe(false);
  });
});
