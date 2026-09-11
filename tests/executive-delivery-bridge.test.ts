import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {changeDelivery,listDeliveries} from "@/lib/executive-bundle/server";

const scheduleId="91000000-0000-4000-8000-000000000001",requestId="91000000-0000-4000-8000-000000000002",workspaceId="91000000-0000-4000-8000-000000000003",now="2026-09-10T18:00:00Z";
const definition={schemaVersion:"1.0",deliveryKind:"daily_brief",label:"Weekday daily brief",timeZone:"America/Chicago",cadence:{kind:"daily",localTime:"07:30"},changePolicy:"when_attention_summary_changes",deliveryTarget:"native_executive_inbox"};
const schedule={scheduleId,version:1,definition,status:"active",capabilityAvailable:true,nextOccurrence:"2026-09-11T12:30:00Z",lastEvaluatedAt:null,lastDeliveredAt:null,createdAt:now,updatedAt:now,replayed:false};
describe("Executive native delivery bridge",()=>{
 it("accepts a bounded, honest native delivery list",async()=>{
  const data={schemaVersion:"1.0",workspaceId,authorityRevision:"r1",serverNow:now,schedules:[schedule],deliveries:[{deliveryId:requestId,scheduleId,scheduleVersion:1,deliveryKind:"daily_brief",label:definition.label,dueAt:now,evaluatedAt:now,outcome:"ready",reason:"The scheduled native review is ready.",currentAttentionCount:70,inspectedAttentionCount:50,inspectedHighPriorityCount:9,route:"/workspace/executive/daily_brief/new",requiresUserReview:true,externalDelivery:false,recordCreated:false}],backgroundDeliveryAvailable:false};
  const rpc=vi.fn(async()=>({data,error:null}));
  expect((await listDeliveries({rpc} as never)).deliveries[0].externalDelivery).toBe(false);
  expect(rpc).toHaveBeenCalledWith("executive_deliveries",{});
 });
 it("rejects an overclaimed delivery response",async()=>{
  const rpc=vi.fn(async()=>({data:{schemaVersion:"1.0",workspaceId,authorityRevision:"r1",serverNow:now,schedules:[schedule],deliveries:[],backgroundDeliveryAvailable:true},error:null}));
  await expect(listDeliveries({rpc} as never)).rejects.toMatchObject({status:503});
 });
 it("sends one exact confirmed mutation object",async()=>{
  const input={scheduleId:null,expectedVersion:0,requestId,operation:"create",definition,confirmExactSchedule:true};
  const rpc=vi.fn(async()=>({data:schedule,error:null}));
  expect((await changeDelivery({rpc} as never,input)).scheduleId).toBe(scheduleId);
  expect(rpc).toHaveBeenCalledWith("executive_change_delivery",{p_change:input});
 });
 it("rejects mutation ambiguity before the database",async()=>{
  const rpc=vi.fn();
  await expect(changeDelivery({rpc} as never,{scheduleId:null,expectedVersion:0,requestId,operation:"create",definition,confirmExactSchedule:false})).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
 });
});
