import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {composeBundleExperience,type BundleAuthority} from "@/lib/bundles/experience";
import {createWorkspaceMcpServer} from "@/lib/workspace/mcp-server";
import {layoutProposalDecisionResult} from "@/lib/bundles/layout-proposals";
import {layoutProposalList} from "@/vendor/lead-emergence-bundles/domain-contracts/layout-proposal";

const user="23111111-1111-4111-8111-111111111111",workspace="23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authority:BundleAuthority={schemaVersion:"1.0",subjectId:user,workspaceId:workspace,revision:"layout-authority-1",resolvedAt:"2026-09-10T20:00:00Z",
 assignments:["workspace_experience","writer_editor"].map(bundleKey=>({bundleKey,status:"active",startsAt:"2026-09-01T00:00:00Z",expiresAt:null})),
 capabilities:[{bundleKey:"workspace_experience",capabilityId:"workspace.compose"},{bundleKey:"workspace_experience",capabilityId:"workspace.personalize"},{bundleKey:"writer_editor",capabilityId:"writer.resource.library"}]};
const experience=composeBundleExperience(authority),proposalId="23333333-3333-4333-8333-333333333333",requestId="23444444-4444-4444-8444-444444444444";
const operation={kind:"set_pin" as const,itemId:"writer_editor:writer.nav.writing",pinned:true,reason:"The user said current Writing work should be easiest to reach.",basis:["user_stated_priority" as const,"enabled_capability" as const]};
const closers:Array<{close:()=>Promise<void>}>=[];afterEach(async()=>{await Promise.all(closers.splice(0).map(value=>value.close()));});

describe("Workspace layout proposal host contract",()=>{
 it("registers context and proposal tools without any approval tool",async()=>{
  const rpc=vi.fn(async(name:string)=>name==="layout_proposal_context"?{data:{schemaVersion:"1.0",workspaceId:workspace,layoutRevision:1,authorityRevision:authority.revision,
   items:[{id:"writer_editor:writer.nav.writing",bundleKey:"writer_editor",kind:"navigation",route:"/workspace/writing",visible:true,pinned:false,order:null}],
   defaultRoutes:["/workspace","/workspace/writing"],currentDefaultWorkspaceRoute:"/workspace",defaultUnavailable:false,dormantChoiceCount:2},error:null}:
   name==="propose_workspace_layout"?{data:{schemaVersion:"1.0",proposalId,status:"pending",baseLayoutRevision:1,authorityRevision:authority.revision,createdAt:"2026-09-10T20:01:00Z",replayed:false},error:null}:{data:null,error:{code:"42501"}});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair(),server=createWorkspaceMcpServer({rpc} as never,undefined,{bundleCapabilityIds:experience.capabilityIds,bundleExperience:experience});
  const client=new Client({name:"layout-proposal-unit",version:"1"});await server.connect(serverTransport);await client.connect(clientTransport);closers.push(client,server);
  const tools=(await client.listTools()).tools.filter(tool=>tool.name.startsWith("workspace_")&&tool.name.includes("layout"));
  expect(tools.map(tool=>tool.name).sort()).toEqual(["workspace_layout_proposal_context","workspace_propose_layout"]);
  expect(tools.find(tool=>tool.name==="workspace_layout_proposal_context")?.annotations?.readOnlyHint).toBe(true);
  expect(tools.find(tool=>tool.name==="workspace_propose_layout")?.annotations?.readOnlyHint).toBe(false);
  expect(tools.some(tool=>/approve|accept|save/.test(tool.name))).toBe(false);
  const context=await client.callTool({name:"workspace_layout_proposal_context",arguments:{}});
  expect(context.isError).not.toBe(true);expect(JSON.stringify(context.structuredContent)).toContain('"label":"Writing"');
  expect(JSON.stringify(context.structuredContent)).not.toContain("ministry");
  const proposal=await client.callTool({name:"workspace_propose_layout",arguments:{expectedLayoutRevision:1,expectedAuthorityRevision:authority.revision,requestId,
   title:"Put current Writing first",goal:"Reach current writing with less navigation",goalSource:"user_stated",summary:"Pin the enabled Writing workspace without changing any access.",operations:[operation]}});
  expect(proposal.isError).not.toBe(true);
  expect(rpc).toHaveBeenCalledWith("propose_workspace_layout",{expected_layout_revision:1,expected_authority_revision:authority.revision,request_id:requestId,
   proposal_title:"Put current Writing first",proposal_goal:"Reach current writing with less navigation",goal_source:"user_stated",
   proposal_summary:"Pin the enabled Writing workspace without changing any access.",operations:[operation]});
 });
 it("omits both tools when personalization is not currently admitted",async()=>{
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair(),rpc=vi.fn(),server=createWorkspaceMcpServer({rpc} as never,undefined,{bundleCapabilityIds:["workspace.compose"],bundleExperience:experience});
  const client=new Client({name:"layout-proposal-denied-unit",version:"1"});await server.connect(serverTransport);await client.connect(clientTransport);closers.push(client,server);
  expect((await client.listTools()).tools.some(tool=>tool.name.includes("layout"))).toBe(false);expect(rpc).not.toHaveBeenCalled();
 });
 it("strictly validates native lists and decision receipts",()=>{
  const record={schemaVersion:"1.0",proposalId,status:"accepted",baseLayoutRevision:1,authorityRevision:authority.revision,createdAt:"2026-09-10T20:01:00Z",version:2,
   title:"Put current Writing first",goal:"Reach current writing with less navigation",goalSource:"user_stated",summary:"Pin the enabled Writing workspace without changing any access.",operations:[operation],
   proposedPreferences:{schemaVersion:"1.0",hiddenItemIds:[],pinnedNavigationIds:[operation.itemId],pinnedWidgetIds:[],orderOverrides:{},defaultWorkspaceRoute:"/workspace"},createdBy:"assistant",decidedAt:"2026-09-10T20:02:00Z",decisionNote:"Accepted after preview."};
  expect(layoutProposalList.safeParse({schemaVersion:"1.0",workspaceId:workspace,layoutRevision:2,authorityRevision:authority.revision,items:[record]}).success).toBe(true);
  expect(layoutProposalDecisionResult.safeParse({...record,replayed:false,resultingLayoutRevision:2}).success).toBe(true);
  expect(layoutProposalDecisionResult.safeParse({...record,replayed:false,resultingLayoutRevision:2,approvedByModel:true}).success).toBe(false);
 });
});
