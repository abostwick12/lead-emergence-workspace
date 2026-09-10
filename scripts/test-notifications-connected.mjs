import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {localConfiguration,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const c=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
assert.notEqual((await fetch(appUrl+"/api/mcp")).status,421,"Use the isolated dev preview; do not bypass production host guards.");
const native=await fixtureSession(c,f.layoutAll),other=await fixtureSession(c,f.layoutOther);
async function api(token,body,path=""){const r=await fetch(appUrl+"/api/bundles/notifications"+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json(),headers:r.headers};}
const before=(await api(native.token)).body,auth=await localOAuth(c,f.layoutAll);
const connectionId=createHash("sha256").update(f.layoutAll.workspaceId+":assistant:"+auth.clientId).digest("hex");
const id=createHash("sha256").update(f.layoutAll.workspaceId+":workspace.notification.connection_required:"+connectionId).digest("hex");
const assistant=new Client({name:"fictional-notification-boundary-acceptance",version:"1"});
async function consentRecord(){for(let offset=0;offset<=10000;offset+=25){const r=await native.client.rpc("native_connection_center",{p_offset:offset});assert.equal(r.error,null);const found=r.data.assistants.find(i=>i.id===connectionId);if(found)return found;if(offset+25>=r.data.assistantTotal)break;}throw new Error("Local consent not found for cleanup.");}
try{
 const pending=await api(native.token,undefined,"?typeId=workspace.notification.connection_required");assert.equal(pending.status,200);
 const item=pending.body.items.find(i=>i.id===id);assert.ok(item,"Actual unfinished consent should produce a current saved-access cue");
 assert.doesNotMatch(JSON.stringify(pending.body),new RegExp(auth.clientId));assert.match(pending.headers.get("cache-control"),/no-store/);
 console.log("PASS actual local OAuth consent produces a source-linked unfinished-access cue without exposing its client identifier");
 const input={kind:"items",requestId:randomUUID(),expectedVersion:pending.body.version,action:"read",items:[{id:item.id,revision:item.revision}]};
 const db=createClient(c.API_URL,c.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+auth.token}}});
 for(const [name,args] of [["native_notifications",{}],["native_change_notifications",{p_change:input}]])assert.equal((await db.rpc(name,args)).error?.code,"42501");
 assert.equal((await api(auth.token)).status,403);assert.equal((await api(auth.token,input)).status,403);
 console.log("PASS actual OAuth bearer denied native notification reads and changes at HTTP and database boundaries");
 for(const path of ["?offset=1","?offset=-25","?offset=00","?offset=25&offset=0","?view=sent","?workspaceId=forged","?typeId=unknown"])assert.equal((await api(native.token,undefined,path)).status,400);
 for(const patch of [{expectedVersion:-1},{items:[]},{workspaceId:f.layoutOther.workspaceId},{padding:"x".repeat(13000)}])assert.equal((await api(native.token,{...input,...patch})).status,400);
 assert.equal((await fetch(appUrl+"/api/bundles/notifications")).status,401);
 assert.equal((await api(other.token,undefined,"?typeId=writer.notification.publication_ready")).status,403);
 assert.equal((await api(other.token,input)).status,403);
 console.log("PASS strict query, body bounds, owner derivation and unassigned source rejection");
 await assistant.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 const ts=(await assistant.listTools()).tools;assert.ok(ts.every(t=>!t.name.includes("native_notification")));
 const after=await api(native.token,undefined,"?typeId=workspace.notification.connection_required");assert.equal(after.status,200);
 assert.ok(after.body.items.every(i=>i.id!==id),"Finished usable registration should resolve the unfinished-access cue");
 assert.equal((await api(native.token,input)).status,403,"An old tab cannot acknowledge a resolved source");
 assert.equal(after.body.version,before.version,"Checking conditions and resolving source state do not manufacture inbox writes");
 console.log("PASS actual MCP registration resolves the current cue without a fabricated sent event or stale acknowledgement");
}finally{
 await assistant.close().catch(()=>{});
 const item=await consentRecord();
 if(item.canDisconnect){const r=await native.client.rpc("native_disconnect_connection",{p_kind:"assistant",p_id:item.id,p_revision:item.revision,p_request_id:randomUUID(),p_confirmed:true});assert.equal(r.error,null);}
 assert.equal((await consentRecord()).grantActive,false);
}
console.log("Native notification actual OAuth acceptance: 4 groups passed. Fictional grant revoked.");
