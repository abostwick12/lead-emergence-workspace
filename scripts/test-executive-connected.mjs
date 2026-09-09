import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {appUrl,localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
import {executiveFixtures} from "./executive-fixtures.mjs";
import {investorFixtures} from "./investor-fixtures.mjs";
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const hostProbe=await fetch(appUrl+"/api/mcp");
assert.notEqual(hostProbe.status,421,"Run connected MCP acceptance with the isolated dev preview; production correctly requires the canonical host.");
const own=await fixtureSession(config,f.executive),other=await fixtureSession(config,f.executiveOther),
 dual=await fixtureSession(config,f.executiveDual),unassigned=await fixtureSession(config,f.reader),operator=await fixtureSession(config,f.operator);
const data=executiveFixtures(),date=new Date().toISOString().slice(0,10),connections=[],grants=[];
let groups=0,disabled=false;
const pass=message=>{groups++;console.log("PASS "+message);};
async function rpc(client,name,args={},code=null){const r=await client.rpc(name,args);assert.equal(r.error?.code??null,code,name+": "+r.error?.message);return r.data;}
async function web(path,body,token=own.token){
 const r=await fetch(appUrl+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,headers:r.headers,body:await r.json()};
}
const saveInput=(kind,value,base=null)=>({kind,documentId:base?.id??null,expectedRevision:base?.revision??0,requestId:randomUUID(),data:value,confirmExactRecord:true});
async function connect(fixture,native){
 const auth=await localOAuth(config,fixture),client=new Client({name:"synthetic-executive-acceptance",version:"1"});
 grants.push({clientId:auth.clientId,native});
 await client.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+auth.token}}}));
 connections.push(client);
 const db=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+auth.token}}});
 return {client,db,...auth};
}
let sharing=await rpc(dual.client,"executive_get_source_permissions");
async function share(caps){sharing=await rpc(dual.client,"executive_set_source_permissions",{p_capabilities:caps,p_expected_revision:sharing.revision,p_request_id:randomUUID(),p_confirm_task_metadata_only:true});return sharing;}
try {
 if(sharing.sourceCapabilities.length)await share([]);
 const records={};
 for(const kind of Object.keys(data)){
  const input=saveInput(kind,{...data[kind],title:"Connected Executive "+kind+" "+randomUUID().slice(0,8)});
  const result=await web("/api/executive/"+kind,input);assert.equal(result.status,200,JSON.stringify(result.body));records[kind]=result.body.document;
  assert.equal((await web("/api/executive/"+kind,input)).body.document.id,records[kind].id);
  const opened=await web("/api/executive/"+kind+"/"+records[kind].id);assert.deepEqual(opened.body.document,records[kind]);assert.match(opened.headers.get("cache-control"),/no-store/);
  assert.equal((await web("/api/executive/"+kind+"?search="+encodeURIComponent(records[kind].data.title))).body.total,1);
  assert.equal((await web("/api/executive/"+kind+"/"+records[kind].id+"/history")).body.revisions.length,1);
  assert.equal((await web("/api/executive/"+kind+"/"+records[kind].id,null,other.token)).status,404);
 }
 for(const path of ["/api/executive/commitment?workspaceId="+f.executiveOther.workspaceId,
  "/api/executive/commitment?limit=1&limit=2","/api/executive/commitment?limit=Infinity",
  "/api/executive/attention?asOfDate=2026-02-30","/api/executive/attention?asOfDate="+date+"&tenantId=x"])
  assert.equal((await web(path)).status,400,path);
 assert.equal((await web("/api/executive/commitment",null,null)).status,401);
 assert.equal((await web("/api/executive/commitment",null,unassigned.token)).status,403);
 assert.equal((await web("/api/executive/meeting/"+records.commitment.id)).status,404);
 assert.equal((await web("/api/executive/decision",saveInput("commitment",data.commitment))).status,400);
 pass("five native HTTP record flows, exact retries, private caching and strict cross-client/kind/query boundaries");

 const composition=JSON.stringify((await web("/api/bundles/experience",null,dual.token)).body);
 for(const area of ["executive","writing","ministry","nonprofit","investing"])assert.ok(composition.includes("/workspace/"+area));
 const cues=await web("/api/executive/attention?asOfDate="+date);assert.equal(cues.status,200,JSON.stringify(cues.body));
 assert.equal(cues.body.coverage.length,13);assert.equal(cues.body.total,cues.body.coverage.reduce((sum,c)=>sum+(c.total??0),0));
 assert.ok(cues.body.items.every(i=>i.source.capabilityId.startsWith("executive.")&&i.evidence&&i.reason));
 assert.ok(cues.body.coverage.filter(c=>!c.capabilityId.startsWith("executive.")).every(c=>c.state==="not_shared"&&c.total===null));
 const held=await rpc(own.client,"executive_save_document",{p_kind:"meeting",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_confirm_exact_record:true,
  p_data:{...data.meeting,title:"Fictional already-held meeting",state:"held",outcome:"The fictional decision was recorded."}});
 const afterHeld=await web("/api/executive/attention?asOfDate="+date);
 assert.equal(afterHeld.status,200);assert.equal(afterHeld.body.items.some(item=>item.source.documentId===held.document.id),false);
 pass("five-bundle composition, honest bounded default-off coverage and no pending cue for held meetings");

 const boundedRecords=[];
 try {
  for(let start=0;start<55;start+=5) {
   const batch=await Promise.all(Array.from({length:Math.min(5,55-start)},(_,index)=>rpc(other.client,"executive_save_document",{
    p_kind:"commitment",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_confirm_exact_record:true,
    p_data:{...data.commitment,title:"Fictional bounded attention "+(start+index),notes:"BOUNDED_PRIVATE_NOTES_CANARY"}
   })));
   boundedRecords.push(...batch.map(result=>result.document));
  }
  const bounded=await rpc(other.client,"executive_attention",{p_as_of_date:date});
  assert.ok(bounded.total>=55);assert.equal(bounded.items.length,50);
  assert.equal(new Set(bounded.items.map(item=>item.id)).size,50);
  assert.equal(bounded.total,bounded.coverage.reduce((sum,c)=>sum+(c.total??0),0));
  assert.doesNotMatch(JSON.stringify(bounded),/BOUNDED_PRIVATE_NOTES_CANARY/);
 }finally{
  for(let start=0;start<boundedRecords.length;start+=5)await Promise.all(boundedRecords.slice(start,start+5).map(d=>rpc(other.client,"executive_save_document",{
   p_kind:"commitment",p_document_id:d.id,p_expected_revision:d.revision,p_request_id:randomUUID(),p_confirm_exact_record:true,
   p_data:{...d.data,state:"cancelled"}
  })));
 }
 pass("more than fifty actual records produce exact counts and a bounded metadata page; synthetic test work is closed through native revisions");

 const assistant=await connect(f.executive,own.client);
 console.log("Connected synthetic Executive MCP session.");
 const tools=(await assistant.client.listTools()).tools.filter(t=>t.name.startsWith("executive_"));
 assert.equal(tools.length,17);assert.equal(tools.filter(t=>!t.annotations.readOnlyHint).length,5);
 assert.ok(tools.every(t=>!t.annotations.openWorldHint&&!t.annotations.destructiveHint));
 for(const[kind,d]of Object.entries(records)){
  console.log("Checking connected "+kind+" tools.");
  const listed=await assistant.client.callTool({name:"executive_list_"+kind+"s",arguments:{search:d.data.title}});
  assert.equal(listed.isError??false,false,JSON.stringify(listed));assert.ok(listed.structuredContent.documents.some(x=>x.id===d.id));
  const current=await assistant.client.callTool({name:"executive_get_"+kind,arguments:{documentId:d.id}});
  assert.equal(current.isError??false,false);assert.deepEqual(current.structuredContent.document,d);
  const input={documentId:d.id,expectedRevision:d.revision,requestId:randomUUID(),data:{...d.data,notes:"Requested fictional clarification",reviewState:"confirmed"},
   reason:"Clarify the fictional next move",evidence:"Fictional acceptance evidence only",scope:"executive_coordination_only"};
  const proposed=await assistant.client.callTool({name:"executive_propose_"+kind,arguments:input});
  assert.equal(proposed.isError??false,false,JSON.stringify(proposed));
  const proposal=proposed.structuredContent;assert.equal(proposal.origin,"assistant");assert.equal(proposal.data.reviewState,"inferred");
  assert.equal((await assistant.client.callTool({name:"executive_propose_"+kind,arguments:input})).structuredContent.id,proposal.id);
  const decision={proposalId:proposal.id,expectedRevision:d.revision,decision:"approve",confirmExactRecord:true};
  const approved=await web("/api/executive/proposals/decision",decision);assert.equal(approved.status,200,JSON.stringify(approved.body));
  assert.equal(approved.body.document.data.reviewState,"inferred");records[kind]=approved.body.document;
 }
 assert.equal((await assistant.client.callTool({name:"executive_attention",arguments:{asOfDate:date}})).isError??false,false);
 pass("actual OAuth consent/PKCE, seventeen HTTP MCP tools and five proposal-only assistant writes");

 await rpc(assistant.db,"executive_save_document",{p_kind:"commitment",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_data:data.commitment,p_confirm_exact_record:true},"42501");
 await rpc(assistant.db,"executive_document_history",{p_kind:"commitment",p_document_id:records.commitment.id},"42501");
 await rpc(assistant.db,"executive_list_proposals",{p_kind:"commitment"},"42501");
 await rpc(assistant.db,"executive_set_source_permissions",{p_capabilities:[],p_expected_revision:0,p_request_id:randomUUID(),p_confirm_task_metadata_only:true},"42501");
 assert.equal((await web("/api/executive/commitment",saveInput("commitment",data.commitment),assistant.token)).status,403);
 pass("OAuth clients cannot use native canonical save, permission, proposal-list or history operations");

 const sourceRecords=[];
 const writing=await rpc(dual.client,"writer_import_resource",{request_id:randomUUID(),resource_input:{title:"Fictional shared Writing cue",source_label:"Synthetic acceptance",body_text:"CONNECTED_PRIVATE_MANUSCRIPT_CANARY"}});
 sourceRecords.push({capabilityId:"writer.resource.library",kind:"resource",documentId:writing.resourceId,revision:1});
 const ministry=await rpc(dual.client,"ministry_save_document",{p_kind:"research",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_confirm_profile:false,
 p_data:{title:"Fictional shared Ministry cue",question:"Illustrative question",passage:"",audience:"",dueDate:date,status:"researching",sources:[],notes:[],teachingOutline:"CONNECTED_PRIVATE_THEOLOGY_CANARY"}});
 sourceRecords.push({capabilityId:"ministry.research",kind:"research",documentId:ministry.document.id,revision:1});
 const nonprofit=await rpc(dual.client,"nonprofit_save_document",{p_kind:"plan",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_confirm_administrative:true,
 p_data:{title:"Fictional shared Nonprofit cue",mission:"CONNECTED_PRIVATE_OPERATIONS_CANARY",jurisdiction:"Fictional jurisdiction",status:"active",targetDate:date,milestones:[]}});
 sourceRecords.push({capabilityId:"nonprofit.roadmap",kind:"plan",documentId:nonprofit.document.id,revision:1});
 const investor=await rpc(dual.client,"investor_save_document",{p_kind:"thesis",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_confirm_research_only:true,
 p_data:{...investorFixtures().thesis,title:"Fictional shared Investor cue",thesis:"CONNECTED_PRIVATE_RESEARCH_CANARY"}});
 sourceRecords.push({capabilityId:"investor.thesis",kind:"thesis",documentId:investor.document.id,revision:1});
 const connectedDual=await connect(f.executiveDual,dual.client);
 await share(sourceRecords.map(ref=>ref.capabilityId));
 const resolved=await connectedDual.client.callTool({name:"executive_resolve_references",arguments:{references:sourceRecords}});
 assert.equal(resolved.isError??false,false,JSON.stringify(resolved));
 assert.ok(resolved.structuredContent.references.every(x=>x.state==="current"&&x.metadata));
 const sharedAttention=await connectedDual.client.callTool({name:"executive_attention",arguments:{asOfDate:date}});
 assert.equal(sharedAttention.isError??false,false,JSON.stringify(sharedAttention));
 for(const ref of sourceRecords)assert.ok(sharedAttention.structuredContent.items.some(i=>i.source.documentId===ref.documentId));
 assert.doesNotMatch(JSON.stringify([resolved,sharedAttention]),/CONNECTED_PRIVATE_|body_text|theologicalProfile/);
 const ownDenied=await assistant.client.callTool({name:"executive_resolve_references",arguments:{references:sourceRecords}});
 assert.ok(ownDenied.structuredContent.references.every(x=>x.metadata===null));
 pass("actual assistant source resolution and four-domain attention omit private canary bodies and other-client metadata");

 const brief=await web("/api/executive/daily_brief",saveInput("daily_brief",{...data.daily_brief,references:sourceRecords}),dual.token);
 assert.equal(brief.status,200,JSON.stringify(brief.body));
 await share([]);
 const withdrawn=await connectedDual.client.callTool({name:"executive_resolve_references",arguments:{references:sourceRecords}});
 assert.ok(withdrawn.structuredContent.references.every(x=>x.state==="unavailable"&&x.metadata===null));
 assert.equal((await web("/api/executive/daily_brief/"+brief.body.document.id,null,dual.token)).status,200);
 assert.equal((await web("/api/executive/daily_brief",saveInput("daily_brief",brief.body.document.data,brief.body.document),dual.token)).status,403);
 pass("withdrawing source sharing closes current assistant reads while preserving the user's own saved brief");

 await share(["writer.resource.library"]);
 const target=f.executiveDual.workspaceId;assert.match(target,/^[0-9a-f-]{36}$/);
 const ids=localSql("select id from workspace.bundle_entitlements where workspace_id='"+target+"' and bundle_key='writer_editor' and revoked_at is null;").split("\n").filter(Boolean);
 assert.ok(ids.length);for(const entitlementId of ids)assert.match(entitlementId,/^[0-9a-f-]{36}$/);
 try {
  for(const entitlementId of ids)await rpc(operator.client,"revoke_bundle_entitlement",{target_entitlement_id:entitlementId,revocation_reason:"Synthetic Executive connected access test"});
  const result=await connectedDual.client.callTool({name:"executive_attention",arguments:{asOfDate:date}});
  assert.equal(result.structuredContent.coverage.find(c=>c.capabilityId==="writer.resource.library").state,"unavailable");
  assert.equal(result.structuredContent.items.some(i=>i.source.capabilityId==="writer.resource.library"),false);
 }finally{
  await rpc(operator.client,"issue_bundle_assignment",{target_workspace_id:target,target_bundle_key:"writer_editor",idempotency_key:"executive-connected-restore-"+randomUUID(),target_expires_at:null});
  await share([]);
 }
 pass("actual operator source revocation closes attention and regrant restores only entitlement, not implicit sharing");

 localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='executive' and capability_key='executive_coordination';");disabled=true;
 assert.equal((await web("/api/executive/commitment/"+records.commitment.id)).status,403);
 assert.equal((await assistant.client.callTool({name:"executive_get_commitment",arguments:{documentId:records.commitment.id}})).isError,true);
 assert.equal((await web("/api/executive/daily_brief/"+records.daily_brief.id)).status,200);
 const after=JSON.stringify((await web("/api/bundles/experience")).body);
 assert.ok(after.includes('"route":"/workspace/executive"'));assert.equal(after.includes('"route":"/workspace/executive/commitment"'),false);
 localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='executive' and capability_key='executive_coordination';");disabled=false;
 pass("selective Executive revocation closes existing APIs/tools while admitted briefs stay reachable");

 await rpc(own.client,"disconnect_personal_mcp",{target_client_id:assistant.clientId});
 const blocked=await fetch(appUrl+"/api/mcp",{method:"POST",headers:{Authorization:"Bearer "+assistant.token,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:101,method:"tools/list",params:{}})});
 assert.equal(blocked.status,401);
 const readerAssistant=await connect(f.reader,unassigned.client);
 assert.equal((await readerAssistant.client.listTools()).tools.some(t=>t.name.startsWith("executive_")),false);
 pass("disconnected assistants fail closed and unassigned accounts see no Executive tools");
 console.log("Executive connected acceptance: "+groups+" groups passed. Fictional local clients only; no installed host, provider or recurring automation proof.");
}finally{
 if(disabled)localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='executive' and capability_key='executive_coordination';");
 if(sharing.sourceCapabilities.length)await share([]);
 for(const c of connections)await c.close().catch(()=>{});
 for(const grant of grants)await grant.native.rpc("disconnect_personal_mcp",{target_client_id:grant.clientId});
}
