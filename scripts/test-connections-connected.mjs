import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {localConfiguration,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8")),native=await fixtureSession(config,f.layoutAll);
assert.notEqual((await fetch(appUrl+"/api/mcp")).status,421,"Use the isolated development preview for real OAuth/MCP acceptance; production host checks must remain enabled.");
const auth=await localOAuth(config,f.layoutAll),assistant=new Client({name:"fictional-connection-center-acceptance",version:"1"});
const id=createHash("sha256").update(f.layoutAll.workspaceId+":assistant:"+auth.clientId).digest("hex");
async function api(token,body,path=""){const r=await fetch(appUrl+"/api/bundles/connections"+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json(),headers:r.headers};}
async function current(){for(let offset=0;offset<=10000;offset+=25){const r=await api(native.token,undefined,"?offset="+offset);assert.equal(r.status,200,JSON.stringify(r.body));const item=r.body.assistants.find(a=>a.id===id);if(item)return item;if(offset+25>=r.body.assistantTotal)break;}throw Error("Fictional consent missing from center");}
try{
 const orphan=await current();assert.equal(orphan.state,"setup_required");assert.equal(orphan.registered,false);assert.equal(orphan.grantActive,true);
 console.log("PASS real local OAuth consent appears before assistant registration without a false connected claim");
 await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 const ts=(await assistant.listTools()).tools;
 for(const prefix of ["writer_","ministry_","nonprofit_","investor_","executive_"])assert.ok(ts.some(t=>t.name.startsWith(prefix)));
 assert.ok(ts.every(t=>!t.name.includes("native_connection")));
 const item=await current();assert.equal(item.state,"authorized");assert.equal(item.registered,true);
 console.log("PASS actual MCP registration yields current authorized state and preserves all five domain toolsets");
 await assistant.listTools();assert.equal((await current()).revision,item.revision,"Ordinary MCP activity must not stale a disconnect review.");
 const input={kind:item.kind,id:item.id,revision:item.revision,requestId:randomUUID(),confirmed:true};
 const db=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+auth.token}}});
 assert.equal((await db.rpc("native_connection_center")).error?.code,"42501");
 assert.equal((await db.rpc("native_disconnect_connection",{p_kind:input.kind,p_id:input.id,p_revision:input.revision,p_request_id:input.requestId,p_confirmed:true})).error?.code,"42501");
 assert.equal((await api(auth.token)).status,403);assert.equal((await api(auth.token,input)).status,403);
 console.log("PASS real OAuth bearer denied native inventory and disconnect at HTTP and direct database boundaries");
 for(const path of ["?offset=1","?offset=-25","?offset=25&offset=0","?workspaceId=forged","?offset=1e2"])assert.equal((await api(native.token,undefined,path)).status,400);
 for(const patch of [{confirmed:false},{workspaceId:f.layoutOther.workspaceId},{revision:"stale"},{padding:"x".repeat(2500)}])assert.equal((await api(native.token,{...input,...patch})).status,400);
 assert.equal((await fetch(appUrl+"/api/bundles/connections")).status,401);
 const other=await fixtureSession(config,f.layoutOther);assert.equal((await api(other.token,input)).status,403);
 assert.match((await api(native.token)).headers.get("cache-control"),/no-store/);
 console.log("PASS strict HTTP paging, owner derivation, confirmation, body bounds and private caching");
 const done=await api(native.token,input);assert.equal(done.status,200,JSON.stringify(done.body));assert.equal(done.body.scope,"workspace_assistant_access");
 assert.deepEqual((await api(native.token,input)).body,done.body);assert.equal((await current()).state,"revoked");
 const denied=await db.rpc("mcp_register_connection");assert.equal(denied.error?.code,"42501");
 console.log("PASS confirmed native revocation, exact receipt retry and rejection of the previously valid OAuth token");
}finally{
 await assistant.close().catch(()=>{});
 const item=await current();if(item.canDisconnect){const r=await api(native.token,{kind:item.kind,id:item.id,revision:item.revision,requestId:randomUUID(),confirmed:true});assert.equal(r.status,200);}
 assert.equal((await current()).grantActive,false);
}
console.log("Connection-center actual OAuth acceptance: 5 groups passed; fictional grant revoked.");
