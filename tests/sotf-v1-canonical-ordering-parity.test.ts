import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyPilotState, type PilotState } from "@/lib/sotf/contracts";
import { projectDailyBriefState } from "@/lib/sotf/daily-brief-v1";
import { compareSotfV1CanonicalText } from "@/lib/sotf/v1-text";

type OrderingRow = { id: string; description: string; ids: string[]; expected: string[] };
const sql = readFileSync("supabase/tests/database/sotf_v1_canonical_ordering_parity.sql","utf8");
const corpus: OrderingRow[] = JSON.parse(sql.split("$ordering$")[1]);
const broad = corpus.find(row => row.id === "O31")!;
const now = new Date("2026-09-13T12:00:00.000Z");
const input = { workflow_id:"transition.daily_brief",workflow_version:"1.0.0",brief_date:"2026-09-13",time_zone:"America/Chicago" } as const;
const workspace = "79000000-0000-4000-8000-000000000001";

// This independent oracle does not call TextEncoder or the implementation
// helper. Node's UTF-8 Buffer encoding supplies a second byte-level authority.
function oracle(left: string, right: string) {
  return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));
}

function hypothesisState(ids: string[]): PilotState {
  const state = emptyPilotState();
  state.revision = 1;
  state.chapter = { timing:"Synthetic",question:"Which direction?",weeklyHours:8,phase:"exploring",startedAt:now.toISOString() };
  state.hypotheses = ids.map(id => ({
    id,proposition:`Synthetic ${id}`,whyPromising:"It is testable",assumptions:[],gaps:[],
    nextExperiment:"Run the synthetic test",reviewTrigger:"After the test",status:"continue",
    confidenceExplanation:"Still provisional",updatedAt:now.toISOString()
  }));
  return state;
}

describe("SOTF v1 canonical authority ordering", () => {
  it.each(corpus)("$id $description", row => {
    expect([...row.ids].sort(oracle)).toEqual(row.expected);
    expect([...row.ids].sort(compareSotfV1CanonicalText)).toEqual(row.expected);
    expect([...row.ids].reverse().sort(compareSotfV1CanonicalText)).toEqual(row.expected);

    const projection = projectDailyBriefState(hypothesisState(row.ids),workspace,input,[],now);
    const expectedBounded = row.expected.slice(0,3);
    expect(projection.hypotheses.map(item => item.id)).toEqual(expectedBounded);
    expect(projection.omitted_counts.hypotheses).toBe(Math.max(0,row.expected.length - 3));
    expect(projection.truncated_sections.includes("hypotheses")).toBe(row.expected.length > 3);

    const escaped = JSON.stringify(row.ids).replace(/[\u007f-\uffff]/g,
      character => "\\u" + character.charCodeAt(0).toString(16).padStart(4,"0"));
    const decoded = JSON.parse(escaped) as string[];
    expect(decoded).toEqual(row.ids);
    expect(projectDailyBriefState(hypothesisState(decoded),workspace,input,[],now)).toEqual(projection);
  });

  it("uses the canonical final tie-breaker in every bounded state collection", () => {
    const ids = broad.ids;
    const state = hypothesisState(ids);
    state.criteria = ids.map(id => ({id,label:`Criterion ${id}`,dimension:"actual_work",desired:"Synthetic",nonNegotiable:false,importance:5,confirmed:true}));
    state.opportunities = ids.map(id => ({id,company:"Synthetic",role:`Role ${id}`,description:"",hypothesisIds:[],requirements:[],deadline:input.brief_date,actualWork:"",decisionQuestion:"Proceed?",status:"exploring",createdAt:now.toISOString()}));
    state.commitments = ids.map(id => ({id,title:`Commitment ${id}`,owner:"Synthetic",due:input.brief_date,definitionOfDone:"Done",reviewTrigger:"Today",status:"open",createdAt:now.toISOString(),updatedAt:now.toISOString()}));
    state.meetings = ids.map(id => ({id,title:`Meeting ${id}`,kind:"networking",startsAt:"2026-09-13T15:00:00.000Z",endsAt:"2026-09-13T16:00:00.000Z",status:"planned",provider:"manual",objective:"Synthetic",hypothesisIds:[]}));
    const receipt = (outcome_id: string,request_id: string,run_id: string) => ({
      outcome_id,request_id,run_id,workflow_id:"transition.daily_brief" as const,workflow_version:"1.0.0" as const,
      state_revision:1,recorded_at:now.toISOString(),brief_date:input.brief_date,time_zone:input.time_zone,
      status:"completed" as const,connector_results:{calendar_read:"used" as const,email_read:"used" as const},
      degradation_reasons:[],selected_le_refs:[],priority_count:0,usefulness:"not_rated" as const,
      provenance:{source:"host_reported_user_confirmed" as const,provider_content_persisted:false as const}
    });
    const receipts = [
      receipt("00000000-0000-4000-8000-00000000000a","00000000-0000-4000-8000-000000000011","00000000-0000-4000-8000-000000000021"),
      receipt("00000000-0000-4000-8000-00000000000f","00000000-0000-4000-8000-000000000012","00000000-0000-4000-8000-000000000022"),
      receipt("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000013","00000000-0000-4000-8000-000000000023"),
      receipt("00000000-0000-4000-8000-000000000010","00000000-0000-4000-8000-000000000014","00000000-0000-4000-8000-000000000024")
    ];
    const projection = projectDailyBriefState(state,workspace,input,receipts,now);
    expect(projection.criteria.map(item => item.id)).toEqual(broad.expected);
    for (const collection of [projection.opportunities,projection.commitments,projection.meetings]) {
      expect(collection.map(item => item.id)).toEqual(broad.expected.slice(0,10));
    }
    expect(projection.hypotheses.map(item => item.id)).toEqual(broad.expected.slice(0,3));
    expect(projection.recent_outcomes.map(item => item.outcome_id)).toEqual([
      "00000000-0000-4000-8000-000000000010",
      "00000000-0000-4000-8000-00000000000f",
      "00000000-0000-4000-8000-00000000000a"
    ]);
    expect(projection.truncated_sections).toEqual(["commitments","hypotheses","meetings","opportunities","recent_outcomes"]);
  });

  it("does not normalize distinct decoded identifiers", () => {
    expect(compareSotfV1CanonicalText("é","e\u0301")).toBeGreaterThan(0);
    expect(["é","e\u0301"].sort(compareSotfV1CanonicalText)).toEqual(["e\u0301","é"]);
  });
});
