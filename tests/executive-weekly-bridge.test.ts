import {describe,it,expect,vi} from "vitest";
import {readFile} from "node:fs/promises";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
vi.mock("server-only",()=>({}));
import {weeklyOutcomes} from "@/lib/executive-bundle/server";
import {executiveOutcomeRules,executiveWeeklyReport} from "@/lib/executive-bundle/contracts";
import {createWorkspaceMcpServer} from "@/lib/workspace/mcp-server";
const query={periodStart:"2026-09-03",periodEnd:"2026-09-09",timeZone:"America/Chicago"};
const report={schemaVersion:"1.0",...query,windowStart:"2026-09-03T05:00:00Z",windowEndExclusive:"2026-09-10T05:00:00Z",
 recordedThrough:"2026-09-09T18:00:00.123456Z",retrievedAt:"2026-09-09T18:01:00Z",consistency:"recorded_time_cutoff_live_access",
 coverage:["executive.coordination","executive.brief","executive.review"].map(capabilityId=>({capabilityId,state:"current",total:0})),
 offset:0,limit:25,total:0,events:[]};
describe("Weekly outcome bridge and source parity",()=>{
 it("keeps the SQL classifier's fixed rules identical to the pinned source",async()=>{
  const sql=await readFile("supabase/migrations/20260911160000_executive_weekly_outcomes.sql","utf8");
  const rules=sql.match(/\$rules\$([\s\S]*?)\$rules\$::jsonb/);
  expect(rules).not.toBeNull();expect(JSON.parse(rules![1])).toEqual(executiveOutcomeRules);
 });
 it("passes only the bounded window and page to the authenticated RPC",async()=>{
  const rpc=vi.fn(async()=>({data:report,error:null}));
  expect(await weeklyOutcomes({rpc} as never,query)).toEqual(executiveWeeklyReport.parse(report));
  expect(rpc).toHaveBeenCalledWith("executive_weekly_outcomes",{p_period_start:query.periodStart,p_period_end:query.periodEnd,p_time_zone:query.timeZone,p_offset:0,p_limit:25});
 });
 it("rejects caller-supplied authority, overlong periods and invalid zones before the RPC",async()=>{
  const rpc=vi.fn();
  for(const patch of [{workspaceId:"invented"},{periodEnd:"2026-09-10"},{timeZone:"invalid"},{offset:-1},{limit:51},{recordedThrough:"not a timestamp"}])
   await expect(weeklyOutcomes({rpc} as never,{...query,...patch})).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
 });
 it("checks the exact echoed period, zone, page and microsecond cutoff",async()=>{
  const rpc=vi.fn(async()=>({data:report,error:null}));
  for(const patch of [{periodStart:"2026-09-04"},{timeZone:"UTC"},{offset:1},{limit:10},{recordedThrough:"2026-09-09T18:00:00.123455Z"}])
   await expect(weeklyOutcomes({rpc} as never,{...query,...patch})).rejects.toMatchObject({status:503});
  expect((await weeklyOutcomes({rpc} as never,{...query,recordedThrough:"2026-09-09T18:00:00.123456+00:00"})).total).toBe(0);
 });
 it("fails closed on denied admission and unexpected audit bodies",async()=>{
  await expect(weeklyOutcomes({rpc:vi.fn(async()=>({data:null,error:{code:"42501"}}))} as never,query)).rejects.toMatchObject({status:403});
  await expect(weeklyOutcomes({rpc:vi.fn(async()=>({data:{...report,privateHistory:"must not return"},error:null}))} as never,query)).rejects.toMatchObject({status:503});
 });
 it.each([["executive.coordination",false],["executive.brief",false],["executive.review",true]] as const)("advertises outcome history only with %s admission",async(capability,present)=>{
  const rpc=vi.fn(async()=>({data:report,error:null}));
  const server=createWorkspaceMcpServer({rpc} as never,undefined,{bundleCapabilityIds:[capability]});
  const client=new Client({name:"weekly-unit",version:"1"}),[c,s]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(s);await client.connect(c);
   const tool=(await client.listTools()).tools.find(t=>t.name==="executive_weekly_outcomes");
   expect(Boolean(tool)).toBe(present);
   if(present){
    expect(tool?.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,openWorldHint:false});
    expect(tool?.inputSchema).toMatchObject({additionalProperties:false});
    expect(tool?.outputSchema).toBeTruthy();
    const result=await client.callTool({name:"executive_weekly_outcomes",arguments:query});
    expect(result.isError).not.toBe(true);expect(result.structuredContent).toEqual(report);
   }
  }finally{await client.close();await server.close();}
 });
});
