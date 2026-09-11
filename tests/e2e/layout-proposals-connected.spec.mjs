import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {expect,test} from "@playwright/test";
import {appUrl,fixtureSession,localConfiguration} from "../../scripts/bundle-local-runtime.mjs";
import {localOAuth} from "../../scripts/bundle-local-oauth.mjs";

const empty={schemaVersion:"1.0",hiddenItemIds:[],pinnedNavigationIds:[],pinnedWidgetIds:[],orderOverrides:{},defaultWorkspaceRoute:"/workspace"};
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function resetLayout(config,fixture){
 const native=await fixtureSession(config,fixture),current=await native.client.rpc("get_workspace_layout");expect(current.error).toBeNull();
 const saved=await native.client.rpc("save_workspace_layout",{preferences:empty,expected_revision:current.data.revision,expected_authority_revision:current.data.authorityRevision,request_id:randomUUID(),confirmed:true});
 expect(saved.error).toBeNull();return {native,base:saved.data};
}
async function assistantProposal(config,fixture,title){
 const auth=await localOAuth(config,fixture),assistant=new Client({name:"synthetic-layout-proposal-browser",version:"1"});
 try{
  await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
  const tools=(await assistant.listTools()).tools.map(tool=>tool.name);
  expect(tools).toContain("workspace_layout_proposal_context");expect(tools).toContain("workspace_propose_layout");
  expect(tools.some(name=>/workspace.*(approve|accept|save).*layout|workspace.*layout.*(approve|accept|save)/.test(name))).toBe(false);
  const contextResult=await assistant.callTool({name:"workspace_layout_proposal_context",arguments:{}});expect(contextResult.isError).not.toBe(true);
  const context=contextResult.structuredContent,investing=context.items.find(item=>item.route==="/workspace/investing");expect(investing).toBeTruthy();
  expect(JSON.stringify(context)).not.toContain("hiddenItemIds");expect(typeof context.dormantChoiceCount).toBe("number");
  const requestId=randomUUID(),proposalResult=await assistant.callTool({name:"workspace_propose_layout",arguments:{
   expectedLayoutRevision:context.layoutRevision,expectedAuthorityRevision:context.authorityRevision,requestId,title,
   goal:"Reach the current investing workspace immediately after sign-in.",goalSource:"user_stated",
   summary:"Pin the enabled Investing workspace and make it the starting point without changing access or content.",
   operations:[
    {kind:"set_pin",itemId:investing.id,pinned:true,reason:"The user said current investing work should be easiest to reach.",basis:["user_stated_priority","enabled_capability"]},
    {kind:"set_default_workspace",route:"/workspace/investing",reason:"Opening the stated priority first removes a repeated navigation step.",basis:["user_stated_priority","current_layout"]}
   ]
  }});
  expect(proposalResult.isError).not.toBe(true);expect(proposalResult.structuredContent.status).toBe("pending");
  return {auth,assistant,context,receipt:proposalResult.structuredContent};
 }catch(error){await assistant.close().catch(()=>{});await fixtureSession(config,fixture).then(session=>session.client.rpc("disconnect_personal_mcp",{target_client_id:auth.clientId})).catch(()=>{});throw error;}
}
async function disconnect(config,fixture,connection){
 if(!connection)return;await connection.assistant.close().catch(()=>{});
 const session=await fixtureSession(config,fixture),result=await session.client.rpc("disconnect_personal_mcp",{target_client_id:connection.auth.clientId});expect(result.error).toBeNull();
}
async function signIn(page,fixture){
 await page.goto("/login?legacy=1&next="+encodeURIComponent("/workspace/layout"));
 await page.getByLabel("Email",{exact:true}).fill(fixture.email);await page.getByLabel("Password",{exact:true}).fill(fixture.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/layout$/);
}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test.describe("connected assistant to native layout proposal",()=>{
 test.setTimeout(120000);
 test.skip(process.env.LAYOUT_PROPOSAL_LOCAL_ACCEPTANCE!=="true","Requires the isolated fictional proposal fixtures.");
 let config,fixture,connection,native,base;
 test.beforeEach(async({baseURL},info)=>{
  expect(baseURL).toBe("http://localhost:3125");config=await localConfiguration();fixture=fixtures().layoutAll;
  const reset=await resetLayout(config,fixture);native=reset.native;base=reset.base;
  connection=await assistantProposal(config,fixture,"Put investing first — "+info.project.name);
 });
 test.afterEach(async()=>{await disconnect(config,fixture,connection);connection=null;});

 test("previews and exactly retries an accepted recommendation after an uncertain response",async({page},info)=>{
  await signIn(page,fixture);
  const card=page.getByRole("article",{name:"Layout recommendation: Put investing first — "+info.project.name});
  await expect(card).toContainText("User-stated goal");await expect(card).toContainText("Pin Investing");await expect(card).toContainText("Start in Investing");
  await card.getByRole("button",{name:"Preview this recommendation",exact:true}).click();
  const preview=page.getByLabel("Layout preview",{exact:true});await expect(preview).toContainText("Starting workspace: Investing");
  await expect(page.getByRole("button",{name:"Confirm and accept recommendation",exact:true})).toBeDisabled();
  // Keep fixed application/development chrome from covering the proof artifact.
  await page.addStyleTag({content:".workspace-header,.mobile-menu-button,nextjs-portal{visibility:hidden!important}"});
  await card.screenshot({path:"test-results/layout-proposal-card-"+info.project.name+".png"});
  await preview.screenshot({path:"test-results/layout-proposal-preview-"+info.project.name+".png"});await noOverflow(page);
  await page.getByRole("checkbox",{name:"I reviewed this preview and confirm these layout changes."}).check();
  let intercepted=false;
  await page.route("**/api/bundles/layout/proposals/decision",async route=>{
   if(route.request().method()!=="POST"||intercepted)return route.continue();intercepted=true;
   const committed=await route.fetch();expect(committed.status()).toBe(200);
   await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic uncertain proposal response."})});
  });
  await page.getByRole("button",{name:"Confirm and accept recommendation",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Synthetic uncertain proposal response."})).toBeVisible();
  let current=(await native.client.rpc("get_workspace_layout")).data;expect(current.revision).toBe(base.revision+1);expect(current.preferences.pinnedNavigationIds).toContain("investor:investor.nav.home");
  await page.getByRole("button",{name:"Confirm and accept recommendation",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Recommendation accepted and saved."})).toBeVisible();
  current=(await native.client.rpc("get_workspace_layout")).data;expect(current.revision).toBe(base.revision+1);expect(current.preferences.defaultWorkspaceRoute).toBe("/workspace/investing");
  const listed=await native.client.rpc("list_workspace_layout_proposals");expect(listed.error).toBeNull();
  expect(listed.data.items.find(item=>item.proposalId===connection.receipt.proposalId).status).toBe("accepted");
  await expect(page.getByText(/Recent decisions \(/)).toBeVisible();await noOverflow(page);
 });

 test("marks a recommendation stale after a separate native change and lets the user reject it",async({page},info)=>{
  await signIn(page,fixture);
  const title="Put investing first — "+info.project.name,card=page.getByRole("article",{name:"Layout recommendation: "+title});
  await expect(card.getByRole("button",{name:"Preview this recommendation",exact:true})).toBeVisible();
  const current=await native.client.rpc("get_workspace_layout");expect(current.error).toBeNull();
  const changed={...current.data.preferences,hiddenItemIds:["writer_editor:writer.nav.writing"]};
  const saved=await native.client.rpc("save_workspace_layout",{preferences:changed,expected_revision:current.data.revision,expected_authority_revision:current.data.authorityRevision,request_id:randomUUID(),confirmed:true});expect(saved.error).toBeNull();
  await page.reload();const stale=page.getByRole("article",{name:"Layout recommendation: "+title});await expect(stale).toContainText("stale");
  await expect(stale.getByRole("button",{name:"Preview this recommendation",exact:true})).toHaveCount(0);
  await stale.getByRole("button",{name:"Reject recommendation",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Recommendation rejected."})).toBeVisible();
  const after=(await native.client.rpc("get_workspace_layout")).data;expect(after.revision).toBe(saved.data.revision);expect(after.preferences).toEqual(changed);
  const listed=await native.client.rpc("list_workspace_layout_proposals");expect(listed.data.items.find(item=>item.proposalId===connection.receipt.proposalId).status).toBe("rejected");
 });
});
