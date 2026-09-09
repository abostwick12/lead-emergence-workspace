import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {localConfiguration,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
assert.notEqual((await fetch(appUrl+"/api/mcp")).status,421,"Use the actual isolated dev host, not a forged production host.");
const native=await fixtureSession(config,fixtures.layoutAll),catalog=await native.client.rpc("search_saved_work_catalog");assert.equal(catalog.error,null);
const auth=await localOAuth(config,fixtures.layoutAll),assistant=new Client({name:"synthetic-search-boundary-acceptance",version:"1"});
try{
 await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 const tools=(await assistant.listTools()).tools;
 for(const prefix of ["writer_","ministry_","nonprofit_","investor_","executive_"])assert.ok(tools.some(t=>t.name.startsWith(prefix)));
 assert.ok(tools.every(t=>!t.name.includes("search_saved_work")&&!t.name.includes("workspace_search")));
 console.log("PASS all-five domain MCP toolsets remain available without adding native shared search");
 const db=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+auth.token}}});
 const args={p_query:"Cedar Harbor",p_provider_ids:catalog.data.providerIds,p_authority_revision:catalog.data.authorityRevision,p_offset:0};
 for(const [name,input] of [["search_saved_work_catalog",{}],["search_saved_work",args]]){
  const r=await db.rpc(name,input);assert.equal(r.error?.code,"42501");assert.match(r.error.message,/native Workspace/);
 }
 console.log("PASS actual OAuth bearer cannot read shared-search catalog or saved records through direct RPC");
 for(const method of ["GET","POST"]){
  const r=await fetch(appUrl+"/api/bundles/search",{method,headers:{Authorization:"Bearer "+auth.token,"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({query:"Cedar Harbor",providerIds:catalog.data.providerIds,authorityRevision:catalog.data.authorityRevision,offset:0})}:{})});
  assert.equal(r.status,403);assert.doesNotMatch(JSON.stringify(await r.json()),/Cedar Harbor|providerIds|snippet/);
 }
 console.log("PASS actual OAuth bearer cannot bypass the native-only boundary through HTTP");
}finally{
 await assistant.close().catch(()=>{});
 const disconnected=await native.client.rpc("disconnect_personal_mcp",{target_client_id:auth.clientId});assert.equal(disconnected.error,null);
}
console.log("Saved-work connected acceptance: 3 groups passed. Temporary fictional OAuth grant disconnected.");
