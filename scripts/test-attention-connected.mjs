import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {localConfiguration,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
assert.notEqual((await fetch(appUrl+"/api/mcp")).status,421,"Use the actual isolated dev host, not a forged production host.");
const native=await fixtureSession(config,fixtures.layoutAll),catalog=await native.client.rpc("native_attention_catalog");assert.equal(catalog.error,null);
const auth=await localOAuth(config,fixtures.layoutAll),assistant=new Client({name:"synthetic-attention-boundary-acceptance",version:"1"});
try{
 await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 const tools=(await assistant.listTools()).tools;
 for(const prefix of ["writer_","ministry_","nonprofit_","investor_","executive_"])assert.ok(tools.some(t=>t.name.startsWith(prefix)));
 assert.ok(tools.every(t=>!t.name.includes("native_attention")&&!t.name.includes("workspace_attention")));
 console.log("PASS all-five domain MCP toolsets remain available without adding native shared attention");
 const db=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+auth.token}}});
 const args={p_as_of_date:"2026-09-09",p_authority_revision:catalog.data.authorityRevision,p_offset:0};
 for(const [name,input] of [["native_attention_catalog",{}],["native_attention",args]]){
  const r=await db.rpc(name,input);assert.equal(r.error?.code,"42501");assert.match(r.error.message,/native Workspace/);
 }
 console.log("PASS actual OAuth bearer cannot read shared-attention catalog or saved records through direct RPC");
 for(const method of ["GET","POST"]){
  const r=await fetch(appUrl+"/api/bundles/attention",{method,headers:{Authorization:"Bearer "+auth.token,"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({asOfDate:"2026-09-09",authorityRevision:catalog.data.authorityRevision,offset:0})}:{})});
  assert.equal(r.status,403);assert.doesNotMatch(JSON.stringify(await r.json()),/Cedar Harbor|coverage|nextAction/);
 }
 console.log("PASS actual OAuth bearer cannot bypass the native-only boundary through HTTP");
}finally{
 await assistant.close().catch(()=>{});
 const disconnected=await native.client.rpc("disconnect_personal_mcp",{target_client_id:auth.clientId});assert.equal(disconnected.error,null);
}
console.log("Native attention connected acceptance: 3 groups passed. Temporary fictional OAuth grant disconnected.");
