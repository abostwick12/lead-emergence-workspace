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
try{
 await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 const tools=(await assistant.listTools()).tools;
 for(const prefix of ["writer_","ministry_","nonprofit_","investor_","executive_"])assert.ok(tools.some(t=>t.name.startsWith(prefix)),prefix);
 assert.ok(tools.every(t=>!t.name.includes("workspace_layout")));
 console.log("PASS all-six assignment composes the actual five domain MCP toolsets without introducing layout persistence tools");
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
 const disconnected=await native.client.rpc("disconnect_personal_mcp",{target_client_id:auth.clientId});
 assert.equal(disconnected.error,null,"Synthetic layout OAuth grant cleanup failed.");
}
console.log("Workspace layout connected acceptance: 3 groups passed. Temporary fictional OAuth grant disconnected.");
