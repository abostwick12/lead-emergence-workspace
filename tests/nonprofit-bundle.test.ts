import {describe,expect,it,vi} from "vitest";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
vi.mock("server-only",()=>({}));
import {composeBundleExperience,type BundleAuthority} from "@/lib/bundles/experience";
import {createWorkspaceMcpServer} from "@/lib/workspace/mcp-server";
import {getDocument,saveDocument} from "@/lib/nonprofit-bundle/server";
import {emptyNonprofitData,nonprofitCapabilities,nonprofitKinds,type NonprofitDocument} from "@/lib/nonprofit-bundle/contracts";
import {nonprofitHandoff,describeNonprofit,changedNonprofitFields} from "@/lib/nonprofit-bundle/presentation";
const id="84000000-0000-4000-8000-000000000001";
const authority:BundleAuthority={schemaVersion:"1.0",subjectId:id,workspaceId:id,revision:"synthetic",resolvedAt:"2026-09-08T18:00:00Z",assignments:[{bundleKey:"nonprofit_founder",status:"active",startsAt:"2026-09-01T00:00:00Z",expiresAt:null}],capabilities:nonprofitKinds.map(k=>({bundleKey:"nonprofit_founder",capabilityId:nonprofitCapabilities[k]}))};
const doc:NonprofitDocument={id,kind:"plan",revision:2,origin:"user",createdAt:"2026-09-08T00:00:00Z",updatedAt:"2026-09-08T00:00:00Z",data:{...emptyNonprofitData.plan,title:"Fictional roadmap",mission:"Saved administrative work."}};
describe("Independent Nonprofit Founder workspace",()=>{
 it("composes assigned navigation and meaningful attention instead of granting another bundle",()=>{
  const result=composeBundleExperience(authority);
  expect(result.ui.primaryNavigation.map(x=>x.label)).toEqual(["Nonprofit"]);
  expect(result.ui.secondaryNavigation).toHaveLength(4);
  expect(result.ui.dashboardWidgets.map(x=>x.id)).toEqual(["nonprofit.widget.followups"]);
  expect(result.capabilityIds).not.toContain("ministry.research");
  expect(composeBundleExperience({...authority,assignments:[]}).capabilityIds).toEqual([]);
 });
 it("removes a revoked area's navigation, search and capability without removing admitted areas",()=>{
  const result=composeBundleExperience({...authority,capabilities:authority.capabilities.filter(c=>c.capabilityId!=="nonprofit.regulatory_research")});
  expect(result.ui.secondaryNavigation.some(x=>x.route.endsWith("/research"))).toBe(false);
  expect(result.ui.searchProviders.some(x=>x.capabilityId==="nonprofit.regulatory_research")).toBe(false);
  expect(result.ui.secondaryNavigation.some(x=>x.route.endsWith("/partner"))).toBe(true);
 });
 it("keeps partner-only access from entering the full founder dashboard",()=>{
  const result=composeBundleExperience({...authority,capabilities:[authority.capabilities[1]]});
  expect(result.ui.primaryNavigation).toEqual([]);expect(result.ui.dashboardWidgets).toEqual([]);
  expect(result.capabilityIds).toEqual(["nonprofit.partners"]);
 });
 it.each([["42501",403],["P0002",404],["40001",409],["22023",400],["XX000",503]])("maps %s without leaking database details",async(code,status)=>{
  const rpc=vi.fn(async()=>({data:null,error:{code,message:"PRIVATE_SQL_DETAIL"}}));
  await expect(getDocument({rpc} as never,"plan",id)).rejects.toMatchObject({status});
  await expect(getDocument({rpc} as never,"plan",id)).rejects.not.toThrow("PRIVATE_SQL_DETAIL");
 });
 it("fails closed on mismatched server data and rejects a mismatched save area",async()=>{
  const rpc=vi.fn(async()=>({data:{document:{...doc,kind:"research"}},error:null}));
  await expect(getDocument({rpc} as never,"plan",id)).rejects.toMatchObject({status:503});
  await expect(saveDocument({rpc} as never,{kind:"plan",documentId:id,expectedRevision:1,requestId:id,data:doc.data,confirmAdministrative:true},"partner")).rejects.toMatchObject({status:400});
 });
 it("exports saved revision, literal content and evidence gaps without internal identifiers",()=>{
  const text=nonprofitHandoff(doc);expect(text).toContain("Saved revision 2");expect(text).toContain("Saved administrative work.");
  expect(text).toContain("Pending proposals and unsaved changes are excluded.");expect(text).not.toContain(id);
  const r={...emptyNonprofitData.research,title:"Fictional question",question:"What needs review?",jurisdiction:"Fictional"};
  expect(describeNonprofit(r,"research")).toContain("No sources are recorded.");
  expect(describeNonprofit(r,"research")).toContain("does not certify compliance");
  expect(describeNonprofit({...doc.data,title:"<script>untrusted</script>"},"plan")).toContain("<script>untrusted</script>");
  expect(changedNonprofitFields(doc.data,{...doc.data,title:"New title"})).toEqual(["Title"]);
 });
 it("registers 13 focused tools with no canonical-save, approval, history or external action",async()=>{
  const rpc=vi.fn(async()=>({data:null,error:{code:"42501"}}));
  const server=createWorkspaceMcpServer({rpc} as never,undefined,{bundleCapabilityIds:composeBundleExperience(authority).capabilityIds});
  const client=new Client({name:"nonprofit-protocol-unit",version:"1"}),[c,s]=InMemoryTransport.createLinkedPair();
  try{await server.connect(s);await client.connect(c);
   const tools=(await client.listTools()).tools.filter(x=>x.name.startsWith("nonprofit_"));
   expect(tools).toHaveLength(13);expect(tools.filter(x=>!x.annotations?.readOnlyHint)).toHaveLength(4);
   expect(tools.every(x=>x.annotations?.openWorldHint===false)).toBe(true);
   expect(tools.some(x=>/save|approve|history|send|book/.test(x.name))).toBe(false);
   expect((await client.callTool({name:"nonprofit_get_plan",arguments:{documentId:id}})).isError).toBe(true);
   expect(rpc).toHaveBeenCalledWith("nonprofit_get_document",{p_kind:"plan",p_document_id:id});
  }finally{await client.close();await server.close();}
 });
});
