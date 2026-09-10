import {describe,it,expect} from "vitest";
import {availabilityDraft,reviewedAvailability,resolveAvailabilityBoundary,meetingAvailabilityContext,type Meeting} from "@/lib/executive-bundle/availability";
import {emptyExecutiveData} from "@/lib/executive-bundle/contracts";
const meeting={...emptyExecutiveData("meeting","2026-09-09"),title:"Fictional meeting",objective:"Review",timeZone:"UTC",durationMinutes:30,participants:[]} as Meeting;
const input={offered:[{start:"2026-11-01T01:00:12.123456-05:00",end:"2026-11-01T02:30:45.654321-05:00"}],
 available:[{start:"2026-11-01T01:00:12.123456-05:00",end:"2026-11-01T02:30:45.654321-05:00"}],busy:[],
 checkedAt:"2026-11-01T04:00:00Z",source:"Fictional manual review",confirmAvailabilityChecked:true as const,timeZone:"America/New_York",durationMinutes:30,bufferMinutes:15};
describe("Native availability input fidelity",()=>{
 it("starts without invented windows, sources or a checked confirmation",()=>{
  const draft=availabilityDraft(meeting);
  expect(draft.checkedAt).toBeNull();expect(draft.source).toBe("");expect(draft.busy).toEqual([]);
  expect(draft.offered[0].start).toBe("");expect(draft.offered[0].id).toMatch(/^[a-f0-9-]{36}$/);expect(draft.available[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(()=>reviewedAvailability(draft,meeting)).toThrow(/Confirm/);
 });
 it("retains exact saved instants, including repeated-hour choice and submillisecond precision",()=>{
  const saved={...meeting,timeZone:input.timeZone,availability:{input,participants:[]}};
  const draft=availabilityDraft(saved);expect(draft.offered[0].start).toBe("2026-11-01T01:00");expect(draft.offered[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(reviewedAvailability(draft,saved)).toEqual(saved.availability);
 });
 it("refuses a snapshot check for changed participants, duration or display zone",()=>{
  const saved={...meeting,timeZone:input.timeZone,availability:{input,participants:[]}},draft=availabilityDraft(saved);
  for(const changed of [{...saved,durationMinutes:60},{...saved,timeZone:"UTC"},{...saved,participants:[{name:"Someone else",role:""}]}])
   expect(()=>reviewedAvailability(draft,changed)).toThrow(/fresh/);
 });
 it("does not guess ambiguous or nonexistent local times",()=>{
  expect(()=>resolveAvailabilityBoundary("2026-11-01T01:00","America/New_York","","Start")).toThrow(/occurs twice/);
  expect(()=>resolveAvailabilityBoundary("2026-03-08T02:30","America/New_York","","Start")).toThrow(/Nonexistent/);
  expect(resolveAvailabilityBoundary("2026-11-01T01:00","America/New_York","2026-11-01T06:00:00.000Z","Start")).toBe("2026-11-01T06:00:00.000Z");
 });
 it("an edited clock field cannot retain an unrelated saved instant",()=>{
  expect(resolveAvailabilityBoundary("2026-09-09T14:00","UTC","2026-09-09T13:00:00Z","Start")).toBe("2026-09-09T14:00:00.000Z");
 });
 it("rejects empty windows and invalid buffers after an explicit check",()=>{
  const draft={...availabilityDraft(meeting),checkedAt:"2026-09-09T12:00:00Z",source:"Fictional check",context:meetingAvailabilityContext(meeting)};
  expect(()=>reviewedAvailability(draft,meeting)).toThrow(/valid local/);
  const window={id:"one",start:"2026-09-09T14:00",end:"2026-09-09T18:00",startInstant:"",endInstant:""};
  for(const bufferMinutes of [-1,121,2.5])expect(()=>reviewedAvailability({...draft,offered:[window],available:[window],bufferMinutes},meeting)).toThrow();
 });
});
