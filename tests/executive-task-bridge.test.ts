import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {findSources,reviewAttention,resolveReferences,setSharingV2} from "@/lib/executive-bundle/server";
import {executiveAllCapabilities,executiveTaskKinds,sourceCursorKey} from "@/lib/executive-bundle/contracts";
const id="89000000-0000-4000-8000-000000000001",second="89000000-0000-4000-8000-000000000002",now="2026-09-09T12:00:00Z";
const ref={capabilityId:"nonprofit.roadmap",kind:"plan",documentId:id,revision:1,item:{kind:"milestone" as const,id:second}};
const metadata={title:"Fictional milestone",state:"planned",reviewState:null,revision:1,dueDate:null,sourceUpdatedAt:now,
 parentTitle:"Fictional roadmap",owner:"",nextAction:"",priority:"normal",dateState:null,openPrerequisites:0};
describe("Executive task bridge response correlation",()=>{
 it("rejects unconfirmed task sharing before calling the database",async()=>{
  const rpc=vi.fn();
  await expect(setSharingV2({rpc} as never,{sourceCapabilities:[ref.capabilityId],taskCapabilities:[ref.capabilityId],
   taskMetadataVersion:"task-metadata-v1",expectedRevision:0,requestId:id,confirmTaskMetadataOnly:true,confirmExpandedTaskMetadata:false})).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
 });
 it("checks individual identity, not just the parent, in live resolution",async()=>{
  const rpc=vi.fn(async()=>({data:{references:[{reference:{...ref,item:{...ref.item,id}},state:"current",metadata}],retrievedAt:now},error:null}));
  await expect(resolveReferences({rpc} as never,{references:[ref]})).rejects.toMatchObject({status:503});
 });
 it("matches source responses to the exact requested capability, level and cursor boundary",async()=>{
  const data={scope:{capabilityId:ref.capabilityId,level:"task"},state:"current",total:1,items:[{reference:ref,metadata}],nextCursor:null,retrievedAt:now};
  const rpc=vi.fn(async()=>({data,error:null}));
  expect((await findSources({rpc} as never,{capabilityId:ref.capabilityId,level:"task"})).items[0].reference).toEqual(ref);
  await expect(findSources({rpc} as never,{capabilityId:"nonprofit.meetings",level:"task"})).rejects.toMatchObject({status:503});
  await expect(findSources({rpc} as never,{capabilityId:ref.capabilityId,level:"task",after:sourceCursorKey(ref)})).rejects.toMatchObject({status:503});
 });
 it("does not accept a different attention page or comparison date",async()=>{
  const coverage=[...executiveAllCapabilities.map(capabilityId=>({capabilityId,level:"record",state:"current",total:0})),
   ...Object.keys(executiveTaskKinds).map(capabilityId=>({capabilityId,level:"task",state:"current",total:0}))];
  const data={schemaVersion:"2.0",asOfDate:"2026-09-09",retrievedAt:now,items:[],total:0,offset:0,limit:25,coverage};
  const rpc=vi.fn(async()=>({data,error:null}));
  expect((await reviewAttention({rpc} as never,{})).total).toBe(0);
  for(const input of [{offset:25},{limit:10},{asOfDate:"2026-09-10"}])
   await expect(reviewAttention({rpc} as never,input)).rejects.toMatchObject({status:503});
 });
});
