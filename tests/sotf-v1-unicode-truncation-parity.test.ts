import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyPilotState, type PilotState } from "@/lib/sotf/contracts";
import { projectDailyBriefState } from "@/lib/sotf/daily-brief-v1";
import { clipSotfV1Text, isSotfV1Text, sotfV1TextUnits } from "@/lib/sotf/v1-text";

type Row = { id: string; description: string; segments: {text: string; repeat: number}[]; units: number; prefixUnits: number; truncated: boolean };
const sql = readFileSync("supabase/tests/database/sotf_v1_unicode_truncation_parity.sql","utf8");
const corpus: Row[] = JSON.parse(sql.split("$unicode$")[1]);
const now = new Date("2026-09-12T12:00:00.000Z");
const input = { workflow_id: "transition.daily_brief", workflow_version: "1.0.0", brief_date: "2026-09-12", time_zone: "America/Chicago" } as const;
const workspace = "77000000-0000-4000-8000-000000000001";
function state(text: string): PilotState {
  return { ...emptyPilotState(), revision: 2,
    chapter: { timing: "Synthetic", question: "Synthetic question", weeklyHours: 8, phase: "exploring", startedAt: now.toISOString() },
    commitments: [{ id: "unicode", title: "Synthetic", owner: "Synthetic", due: input.brief_date, definitionOfDone: text, reviewTrigger: "Today", status: "open", createdAt: now.toISOString(), updatedAt: now.toISOString() }],
  };
}
// Independent oracle uses the UTF-16LE encoding and checks code-point integrity;
// it does not call the implementation helpers to compute expected values.
const units = (text: string) => Buffer.byteLength(text,"utf16le") / 2;

describe("SOTF v1 canonical Unicode boundary", () => {
  it.each(corpus)("$id $description", (row) => {
    const text = row.segments.map(part => part.text.repeat(part.repeat)).join("");
    expect(units(text)).toBe(row.units);
    expect(sotfV1TextUnits(text)).toBe(row.units);
    const prefix = clipSotfV1Text(text,500);
    expect(units(prefix)).toBe(row.prefixUnits);
    expect(isSotfV1Text(prefix)).toBe(true);
    expect(text.startsWith(prefix)).toBe(true);
    if (prefix !== text) {
      const next = Array.from(text.substring(prefix.length))[0];
      expect(units(prefix + next)).toBeGreaterThan(500);
    }
    const p = projectDailyBriefState(state(text),workspace,input,[],now);
    expect(p.commitments[0].definition_of_done).toBe(prefix);
    expect(p.truncated_sections).toEqual(row.truncated ? ["commitments"] : []);
    const escaped = JSON.stringify(text).replace(/[\u007f-\uffff]/g, ch => "\\u" + ch.charCodeAt(0).toString(16).padStart(4,"0"));
    expect(JSON.parse(escaped)).toBe(text);
    expect(projectDailyBriefState(state(JSON.parse(escaped)),workspace,input,[],now)).toEqual(p);
  });

  it("applies the same unit to all eight clipped projection fields", () => {
    const text = "🙂".repeat(300), s = state(text);
    s.chapter!.question = text;
    s.commitments[0].reviewTrigger = text;
    s.criteria = [{ id:"criterion", label:"Synthetic", dimension:"actual_work", desired:text, nonNegotiable:false, importance:5, confirmed:true }];
    s.opportunities = [{ id:"opportunity", company:"Synthetic", role:"Synthetic", description:"", hypothesisIds:[], requirements:[], deadline:input.brief_date, actualWork:"", decisionQuestion:"Synthetic", status:"investigate", createdAt:now.toISOString(), decision:{ rationale:"Synthetic", nextAction:text, revisitWhen:"Today", at:now.toISOString(), assessmentRevision:1 } }];
    s.meetings = [{ id:"meeting", title:"Synthetic", kind:"networking", startsAt:"2026-09-12T15:00:00.000Z", endsAt:"2026-09-12T16:00:00.000Z", status:"planned", provider:"manual", objective:text, hypothesisIds:[] }];
    s.hypotheses = [{ id:"hypothesis", proposition:"Synthetic", whyPromising:"Synthetic", assumptions:[], gaps:[], nextExperiment:text, reviewTrigger:text, status:"continue", confidenceExplanation:"Synthetic", updatedAt:now.toISOString() }];
    const p = projectDailyBriefState(s,workspace,input,[],now);
    expect(p.truncated_sections).toEqual(["chapter","commitments","criteria","hypotheses","meetings","opportunities"]);
    for (const value of [p.chapter.question,p.criteria[0].desired,p.opportunities[0].next_action!,p.commitments[0].definition_of_done,p.commitments[0].review_trigger,p.meetings[0].objective,p.hypotheses[0].next_experiment,p.hypotheses[0].review_trigger]) {
      expect(value).toBe("🙂".repeat(250));
    }
  });

  it("does not normalize or accept text that PostgreSQL cannot represent", () => {
    expect(sotfV1TextUnits("é")).toBe(1);
    expect(sotfV1TextUnits("e\u0301")).toBe(2);
    for (const value of ["\ud800","\udc00","a\u0000b"]) {
      expect(isSotfV1Text(value)).toBe(false);
      expect(() => sotfV1TextUnits(value)).toThrow();
    }
    expect(clipSotfV1Text("a🙂",2)).toBe("a");
    expect(clipSotfV1Text("🙂",0)).toBe("");
  });

  it("measures the final serialized projection including truncation metadata", () => {
    const s = state("🙂".repeat(300));
    s.criteria = Array.from({length:20},(_,i) => ({id:"c"+i,label:"界".repeat(240),dimension:"actual_work" as const,desired:"界".repeat(501),nonNegotiable:false,importance:5,confirmed:true as const}));
    s.commitments = Array.from({length:10},(_,i) => ({...s.commitments[0],id:"k"+i,title:"界".repeat(240),definitionOfDone:"界".repeat(501),reviewTrigger:"界".repeat(501)}));
    s.opportunities = Array.from({length:10},(_,i) => ({id:"o"+i,company:"界".repeat(240),role:"界".repeat(240),description:"",hypothesisIds:[],requirements:[],deadline:input.brief_date,actualWork:"",decisionQuestion:"Synthetic",status:"investigate" as const,createdAt:now.toISOString()}));
    const p = projectDailyBriefState(s,workspace,input,[],now);
    expect(Buffer.byteLength(JSON.stringify(p),"utf8")).toBeLessThanOrEqual(65536);
    expect(p.omitted_counts.commitments).toBeGreaterThan(0);
    expect(p.truncated_sections).toContain("commitments");
  });
});
