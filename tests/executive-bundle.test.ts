import {describe,it,expect,vi} from "vitest";
import {readFile} from "node:fs/promises";
import {z} from "zod";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
vi.mock("server-only",()=>({}));
import {composeBundleExperience,type BundleAuthority} from "@/lib/bundles/experience";
import {createWorkspaceMcpServer} from "@/lib/workspace/mcp-server";
import {getDocument,saveDocument,resolveReferences,attention,setSharing} from "@/lib/executive-bundle/server";
import {executiveKinds,executiveCapabilities,executiveBaseSchemas,executiveResolutionResult,executiveResolveInput,executiveSources,executiveAttention,emptyExecutiveData,type ExecutiveDocument} from "@/lib/executive-bundle/contracts";
import {localTimeCandidates,localMeetingTime,sourceRoute,executiveHandoff,describeExecutive} from "@/lib/executive-bundle/presentation";
const id="88000000-0000-4000-8000-000000000001",now="2026-09-09T12:00:00Z";
const caps=[...new Set(Object.values(executiveCapabilities))];
const authority:BundleAuthority={schemaVersion:"1.0",subjectId:id,workspaceId:id,revision:"synthetic",resolvedAt:now,
 assignments:[{bundleKey:"executive",status:"active",startsAt:"2026-09-01T00:00:00Z",expiresAt:null}],
 capabilities:caps.map(capabilityId=>({bundleKey:"executive",capabilityId}))};
const content={...emptyExecutiveData("commitment","2026-09-09"),title:"Fictional next move",outcome:"A stated fictional outcome"};
const document={id,kind:"commitment",revision:2,origin:"user",createdAt:now,updatedAt:now,data:content} as ExecutiveDocument;
const ref={capabilityId:"executive.coordination",kind:"commitment",documentId:id,revision:2};
const metadata={title:"Fictional next move",state:"open",reviewState:"user_stated",revision:2,dueDate:null,sourceUpdatedAt:now};
describe("Executive native integration boundaries",()=>{
 it.each(executiveKinds)("keeps trusted %s JSON schema parity",async kind=>{
  const sql=await readFile("supabase/migrations/20260911130000_executive_native_workspace.sql","utf8");
  const match=sql.match(new RegExp("when '"+kind+"' then \\$schema\\$([\\s\\S]*?)\\$schema\\$::jsonb"));
  expect(match).not.toBeNull();
  const extension=await readFile("supabase/migrations/20260911150000_executive_task_attention.sql","utf8");
  expect(extension).toContain("'{properties,references,items,properties,item}'");
  const task=extension.match(/\$item\$([\s\S]*?)\$item\$::jsonb/);expect(task).not.toBeNull();
  const latest=JSON.parse(match![1]);latest.properties.references.items.properties.item=JSON.parse(task![1]);
  if(kind==="weekly_review"){
   const weekly=await readFile("supabase/migrations/20260911160000_executive_weekly_outcomes.sql","utf8");
   const zone=weekly.match(/\$zone\$([\s\S]*?)\$zone\$::jsonb/);expect(zone).not.toBeNull();
   latest.properties.timeZone=JSON.parse(zone![1]);
  }
  if(kind==="meeting"){
   const availability=await readFile("supabase/migrations/20260911170000_executive_availability_planning.sql","utf8");
   const schema=availability.match(/\$availability\$([\s\S]*?)\$availability\$::jsonb/);expect(schema).not.toBeNull();
   latest.properties.availability=JSON.parse(schema![1]);
  }
  expect(latest).toEqual(z.toJSONSchema(executiveBaseSchemas[kind],{io:"input"}));
 });
 it("composes Executive without pulling unrelated private domains into authority",()=>{
  const value=composeBundleExperience(authority);
  expect(value.ui.primaryNavigation.map(x=>x.route)).toEqual(["/workspace/executive"]);
  expect(value.ui.secondaryNavigation).toHaveLength(6);expect(value.capabilityIds).toEqual(expect.arrayContaining(caps));
  expect(value.capabilityIds).not.toContain("writer.resource.library");
  expect(composeBundleExperience({...authority,assignments:[]}).capabilityIds).toEqual([]);
 });
 it.each(caps)("keeps %s-only admission reachable",capabilityId=>{
  const value=composeBundleExperience({...authority,capabilities:[{bundleKey:"executive",capabilityId}]});
  expect(value.ui.primaryNavigation.map(x=>x.route)).toEqual(["/workspace/executive"]);
  expect(value.ui.secondaryNavigation.every(x=>x.capabilityId===capabilityId)).toBe(true);
 });
 it.each([["42501",403],["P0002",404],["40001",409],["22023",400],["XX000",503]])("maps %s without exposing private SQL detail",async(code,status)=>{
  const rpc=vi.fn(async()=>({data:null,error:{code,message:"PRIVATE_SQL_DETAIL"}}));
  await expect(getDocument({rpc} as never,"commitment",id)).rejects.toMatchObject({status});
  await expect(getDocument({rpc} as never,"commitment",id)).rejects.not.toThrow("PRIVATE_SQL_DETAIL");
 });
 it("refuses missing/mismatched records and wrong save areas",async()=>{
  const rpc=vi.fn(async()=>({data:{document:null},error:null}));
  await expect(getDocument({rpc} as never,"commitment",id)).rejects.toMatchObject({status:503});
  await expect(saveDocument({rpc} as never,{kind:"commitment",documentId:id,expectedRevision:2,requestId:id,data:content,confirmExactRecord:true},"meeting")).rejects.toMatchObject({status:400});
 });
 it("requires native metadata confirmation and exact source selection input",async()=>{
  const rpc=vi.fn();
  await expect(setSharing({rpc} as never,{sourceCapabilities:[],expectedRevision:0,requestId:id,confirmTaskMetadataOnly:false})).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  expect(executiveResolveInput.safeParse({references:[ref,ref]}).success).toBe(false);
  expect(executiveResolveInput.safeParse({references:[{...ref,privateBody:"not permitted"}]}).success).toBe(false);
 });
 it("matches resolution by stable reference, not JSON property order",async()=>{
  const reordered={revision:2,documentId:id,kind:"commitment",capabilityId:"executive.coordination"};
  const rpc=vi.fn(async()=>({data:{references:[{reference:reordered,state:"current",metadata}],retrievedAt:now},error:null}));
  expect((await resolveReferences({rpc} as never,{references:[ref]})).references[0].metadata?.title).toBe(metadata.title);
  rpc.mockResolvedValueOnce({data:{references:[],retrievedAt:now},error:null} as never);
  await expect(resolveReferences({rpc} as never,{references:[ref]})).rejects.toMatchObject({status:503});
 });
 it.each([
  {state:"unavailable",metadata},
  {state:"current",metadata:{...metadata,revision:3}},
  {state:"changed",metadata},
  {state:"changed",metadata:{...metadata,revision:1}},
  {state:"current",metadata:{...metadata,privateBody:"not permitted"}}
 ])("rejects inconsistent or overbroad resolution %j",item=>{
  expect(executiveResolutionResult.safeParse({references:[{reference:ref,...item}],retrievedAt:now}).success).toBe(false);
 });
 it("passes explicit comparison dates without treating them as historical snapshots",async()=>{
  const coverage=[...caps,...Object.keys(executiveSources)].map(capabilityId=>({capabilityId,state:capabilityId.startsWith("executive.")?"current":"not_shared",total:capabilityId.startsWith("executive.")?0:null}));
  const data={asOfDate:"2026-09-08",retrievedAt:now,items:[],total:0,coverage},rpc=vi.fn(async()=>({data,error:null}));
  expect((await attention({rpc} as never,{asOfDate:"2026-09-08"})).asOfDate).toBe("2026-09-08");
  expect(rpc).toHaveBeenCalledWith("executive_attention",{p_as_of_date:"2026-09-08"});
  await expect(attention({rpc} as never,{asOfDate:"2026-02-30"})).rejects.toThrow();
  expect(executiveAttention.safeParse({...data,coverage:coverage.slice(1)}).success).toBe(false);
  expect(executiveAttention.safeParse({...data,total:1}).success).toBe(false);
  expect(executiveAttention.safeParse({...data,coverage:[...coverage.slice(1),{capabilityId:"unknown.private.source",state:"current",total:0}]}).success).toBe(false);
 });
 it("provides complete literal saved text without fetching linked source metadata",()=>{
  const exported=executiveHandoff({...document,data:{...document.data,title:"<script>literal untrusted title</script>",references:[ref]}});
  expect(exported).toContain("Revision 2");expect(exported).toContain("live linked-source metadata are excluded");
  expect(exported).toContain("<script>literal untrusted title</script>");expect(describeExecutive(document.data)).toContain("outcome");
 });
 it("uses implemented source routes",()=>{
  expect(sourceRoute({...ref,capabilityId:"writer.resource.library",kind:"resource"})).toBe("/workspace/writing/"+id);
  expect(sourceRoute({...ref,capabilityId:"ministry.archive",kind:"archive"})).toBe("/workspace/ministry/archive/"+id);
  expect(sourceRoute({...ref,capabilityId:"investor.thesis",kind:"thesis"})).toBe("/workspace/investing/thesis/"+id);
 });
 it.each([["America/Chicago","2026-09-09T09:30",["2026-09-09T14:30:00.000Z"]],
  ["America/New_York","2026-11-01T01:30",["2026-11-01T05:30:00.000Z","2026-11-01T06:30:00.000Z"]],
  ["America/New_York","2026-03-08T02:30",[]],
  ["Asia/Kathmandu","2026-09-09T09:30",["2026-09-09T03:45:00.000Z"]],
  ["Australia/Lord_Howe","2026-04-05T01:45",["2026-04-04T14:45:00.000Z","2026-04-04T15:15:00.000Z"]],
  ["Bad/Zone","2026-09-09T09:30",[]],
  ["UTC","2026-02-30T09:30",[]]] as const)("resolves %s %s without guessing a wall-clock instant",(zone,local,expected)=>{
   expect(localTimeCandidates(local,zone)).toEqual(expected);
   for(const at of expected)expect(localMeetingTime(at,zone)).toBe(local);
 });
 it("advertises twenty bounded tools, with five proposal-only writes",async()=>{
  const rpc=vi.fn(async()=>({data:null,error:{code:"42501"}}));
  const server=createWorkspaceMcpServer({rpc} as never,undefined,{bundleCapabilityIds:caps});
  const client=new Client({name:"executive-unit",version:"1"}),[c,s]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(s);await client.connect(c);
   const tools=(await client.listTools()).tools.filter(t=>t.name.startsWith("executive_"));
   expect(tools).toHaveLength(20);expect(tools.filter(t=>!t.annotations?.readOnlyHint)).toHaveLength(5);
   expect(tools.map(t=>t.name)).toEqual(expect.arrayContaining(["executive_attention","executive_review_attention","executive_find_sources"]));
   expect(tools.some(t=>t.annotations?.openWorldHint)).toBe(false);
   expect(tools.some(t=>/save|approve|sharing|permissions|send|book|schedule/.test(t.name))).toBe(false);
   expect((await client.callTool({name:"executive_get_commitment",arguments:{documentId:id}})).isError).toBe(true);
  }finally{await client.close();await server.close();}
 });
});
