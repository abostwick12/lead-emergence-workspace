import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {localConfiguration,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
assert.notEqual((await fetch(appUrl+"/api/mcp")).status,421,"Use the isolated dev preview, not a forged production host.");
const native=await fixtureSession(config,fixtures.layoutAll),before=await native.client.rpc("get_workspace_layout");
assert.equal(before.error,null);
const auth=await localOAuth(config,fixtures.layoutAll),assistant=new Client({name:"synthetic-layout-boundary-acceptance",version:"1"});
let proposalReceipt=null,proposalContext=null;
try{
 await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 const tools=(await assistant.listTools()).tools;
 for(const prefix of ["writer_","ministry_","nonprofit_","investor_","executive_"])assert.ok(tools.some(t=>t.name.startsWith(prefix)),prefix);
 const layoutTools=tools.filter(t=>t.name.startsWith("workspace_")&&t.name.includes("layout"));
 assert.deepEqual(layoutTools.map(t=>t.name).sort(),["workspace_layout_proposal_context","workspace_propose_layout"]);
 assert.equal(layoutTools.find(t=>t.name==="workspace_layout_proposal_context").annotations.readOnlyHint,true);
 assert.ok(layoutTools.every(t=>!/approve|accept|save/.test(t.name)));
 console.log("PASS all-six assignment composes all domain tools plus proposal-only layout tools without assistant approval or persistence");
 const contextResult=await assistant.callTool({name:"workspace_layout_proposal_context",arguments:{}});
 assert.equal(contextResult.isError,undefined,JSON.stringify(contextResult.content));proposalContext=contextResult.structuredContent;
 assert.equal(proposalContext.workspaceId,fixtures.layoutAll.workspaceId);assert.equal(proposalContext.layoutRevision,before.data.revision);
 assert.equal(typeof proposalContext.dormantChoiceCount,"number");assert.doesNotMatch(JSON.stringify(proposalContext),/hiddenItemIds|pinnedNavigationIds|pinnedWidgetIds/);
 const investing=proposalContext.items.find(item=>item.route==="/workspace/investing");assert.ok(investing);
 const proposalArgs={expectedLayoutRevision:proposalContext.layoutRevision,expectedAuthorityRevision:proposalContext.authorityRevision,requestId:randomUUID(),
  title:"Keep investing one step away",goal:"Reach current investing work without repeated navigation",goalSource:"user_stated",
  summary:"Pin the admitted Investing workspace without changing access, content, or any unavailable saved choice.",
  operations:[{kind:"set_pin",itemId:investing.id,pinned:true,reason:"The user identified current investing work as a repeated destination.",basis:["user_stated_priority","enabled_capability"]}]};
 const proposed=await assistant.callTool({name:"workspace_propose_layout",arguments:proposalArgs});assert.equal(proposed.isError,undefined,JSON.stringify(proposed.content));proposalReceipt=proposed.structuredContent;
 assert.equal(proposalReceipt.status,"pending");assert.equal(proposalReceipt.replayed,false);
 const replayed=await assistant.callTool({name:"workspace_propose_layout",arguments:proposalArgs});assert.equal(replayed.structuredContent.replayed,true);
 const rebound=await assistant.callTool({name:"workspace_propose_layout",arguments:{...proposalArgs,title:"Changed meaning on the same request"}});assert.equal(rebound.isError,true);
 const listed=await native.client.rpc("list_workspace_layout_proposals");assert.equal(listed.error,null);assert.equal(listed.data.items.find(item=>item.proposalId===proposalReceipt.proposalId).createdBy,"assistant");
 assert.deepEqual((await native.client.rpc("get_workspace_layout")).data,before.data);
 console.log("PASS actual MCP context is capability-filtered and an immutable exact-retry proposal leaves the saved layout untouched");
 const db=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+auth.token}}});
 const current=before.data,args={preferences:current.preferences,expected_revision:current.revision,expected_authority_revision:current.authorityRevision,request_id:randomUUID(),confirmed:true};
 for(const [name,input] of [["get_workspace_layout",{}],["save_workspace_layout",args]]){
  const r=await db.rpc(name,input);assert.equal(r.error?.code,"42501");assert.match(r.error.message,/native Workspace/);
 }
 console.log("PASS actual OAuth-bearer RPC layout read and write are both native-only");
 const body={preferences:current.preferences,expectedRevision:current.revision,expectedAuthorityRevision:current.authorityRevision,requestId:randomUUID(),confirmed:true};
 for(const method of ["GET","POST"]){
  const r=await fetch(appUrl+"/api/bundles/layout",{method,headers:{Authorization:"Bearer "+auth.token,"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify(body)}:{})});
  assert.equal(r.status,403);assert.doesNotMatch(JSON.stringify(await r.json()),/hiddenItemIds|pinnedNavigationIds/);
 }
 assert.deepEqual((await native.client.rpc("get_workspace_layout")).data,before.data);
 console.log("PASS actual OAuth-bearer HTTP requests cannot read preferences or mutate the native revision");
}finally{
 await assistant.close().catch(()=>{});
 if(proposalReceipt&&proposalContext){
  const rejected=await native.client.rpc("decide_workspace_layout_proposal",{proposal_id:proposalReceipt.proposalId,expected_proposal_version:1,
   expected_layout_revision:before.data.revision,expected_authority_revision:proposalContext.authorityRevision,request_id:randomUUID(),decision:"reject",confirmed:true,decision_note:"Synthetic connected acceptance cleanup."});
  assert.equal(rejected.error,null,"Synthetic proposal cleanup failed.");assert.equal(rejected.data.resultingLayoutRevision,before.data.revision);
 }
 const disconnected=await native.client.rpc("disconnect_personal_mcp",{target_client_id:auth.clientId});
 assert.equal(disconnected.error,null,"Synthetic layout OAuth grant cleanup failed.");
}
console.log("Workspace layout connected acceptance: 4 groups passed. Proposal rejected without layout mutation; temporary fictional OAuth grant disconnected.");
