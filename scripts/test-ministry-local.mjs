import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {createClient} from "@supabase/supabase-js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {appUrl,localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const minister=await fixtureSession(config,f.minister),other=await fixtureSession(config,f.ministerOther),reader=await fixtureSession(config,f.reader),writer=await fixtureSession(config,f.writer),dual=await fixtureSession(config,f.dual);
const created=[],connections=[];let groups=0,disabled=false;
function pass(name){groups++;console.log("PASS "+name);}
async function rpc(name,args={},code=null,client=minister.client){const r=await client.rpc(name,args);assert.equal(r.error?.code??null,code,JSON.stringify(r.error));return r.data;}
async function web(path,body,token=minister.token){const r=await fetch(appUrl+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,body:await r.json()};}
const profile={traditionContext:"Synthetic client context",preferredTranslations:[],interpretiveNotes:"Do not infer my beliefs.",dialoguePreferences:"Name disagreements fairly.",positions:[{id:randomUUID(),statement:"Synthetic inferred position",epistemicState:"inferred",sourceReference:"Fictional exercise"}]};
const sid=randomUUID(),nid=randomUUID();
const project={title:"Synthetic research "+randomUUID(),question:"What does attentive listening require?",passage:"Fictional passage study",audience:"Example class",dueDate:"2026-09-09",status:"researching",
 sources:[{id:sid,title:"Fictional source",layer:"academic_interpretation",reference:"Synthetic section 2",author:"Example author",url:"https://example.com/synthetic",sourceDate:null,retrievedDate:null,excerpt:"SYNTHETIC_RESEARCH_SOURCE_MARKER",comment:"Fictional acceptance evidence, not actual scholarship."}],
 notes:[{id:nid,kind:"observation",text:"A fictional observation",sourceIds:[sid],epistemicState:"user_stated"}],teachingOutline:"Open with the question."};
const archive={title:"Synthetic prior teaching "+randomUUID(),author:"Example author",resourceType:"sermon",deliveredDate:null,scriptureReferences:["Example 1"],topics:["Listening"],audience:"Example class",summary:"Fictional historical work.",bodyText:"SYNTHETIC_ARCHIVE_BODY_MARKER",sourceLabel:"Synthetic original manuscript",sourceUrl:null,status:"active"};
const originalProfile=(await rpc("ministry_get_document",{p_kind:"profile"})).document;
const saveArgs=(kind,data,doc=null)=>({p_kind:kind,p_document_id:doc?.id??null,p_expected_revision:doc?.revision??0,p_request_id:randomUUID(),p_data:data,p_confirm_profile:kind==="profile"});
async function create(kind,data,client=minister.client){const d=(await rpc("ministry_save_document",saveArgs(kind,data),null,client)).document;created.push(d.id);return d;}
async function connect(token){const c=new Client({name:"synthetic-ministry-acceptance",version:"1"});await c.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+token}}}));connections.push(c);return c;}
try {
 if(originalProfile)await rpc("ministry_save_document",saveArgs("profile",null,originalProfile));
 const unset=(await rpc("ministry_get_document",{p_kind:"profile"})).document;
 assert.equal(unset?.data??null,null);
 let pref=unset?(await rpc("ministry_save_document",saveArgs("profile",profile,unset))).document:await create("profile",profile);
 assert.equal(pref.data.positions[0].epistemicState,"inferred");
 await rpc("ministry_save_document",{...saveArgs("profile",profile,pref),p_confirm_profile:false},"22023");
 await rpc("ministry_save_document",saveArgs("profile",{...profile,workspaceId:f.ministerOther.workspaceId},pref),"22023");
 await rpc("ministry_get_document",{p_kind:"profile"},"42501",reader.client);
 await rpc("ministry_get_document",{p_kind:"profile"},"42501",writer.client);
 assert.equal((await rpc("ministry_get_document",{p_kind:"profile"},null,other.client)).document,null);
 pass("blank client profile, explicit confirmation, inferred state preserved, and no Writer/other-client inheritance");
 let doc=await create("research",project),prior=await create("archive",archive);
 const foreign=await create("research",{...project,title:"PRIVATE OTHER MINISTRY"},other.client);
 assert.equal((await rpc("ministry_search_documents",{p_kind:"research",p_search:"SYNTHETIC_RESEARCH_SOURCE_MARKER"})).documents.some(d=>d.id===doc.id),true);
 assert.equal((await rpc("ministry_search_documents",{p_kind:"archive",p_search:"SYNTHETIC_ARCHIVE_BODY_MARKER"})).documents.some(d=>d.id===prior.id),true);
 await rpc("ministry_get_document",{p_kind:"research",p_document_id:foreign.id},"P0002");
 await rpc("ministry_get_document",{p_kind:"archive",p_document_id:doc.id},"P0002");
 await rpc("ministry_get_document",{p_kind:"research",p_document_id:f.writerResourceId},"P0002");
 await rpc("ministry_get_document",{p_kind:"research",p_document_id:f.writerResourceId},"P0002",dual.client);
 pass("research/source and archive/body search stay within tenant and document domain");
 for(const bad of [
  {...project,tenantId:f.minister.workspaceId},{...project,notes:[{...project.notes[0],sourceIds:[randomUUID()]}]},
  {...project,sources:[project.sources[0],project.sources[0]]},{...project,notes:[{...project.notes[0],kind:"ai_synthesis",epistemicState:"user_stated"}]},
  {...project,dueDate:"2026-02-30"},{...project,sources:[{...project.sources[0],url:"https://secret@example.com"}]},
  {...project,sources:[{...project.sources[0],layer:"verified_fact"}]},{...project,title:null},{...project,question:""}
 ])await rpc("ministry_save_document",saveArgs("research",bad,doc),"22023");
 const args=saveArgs("research",{...project,teachingOutline:"Saved revision two."},doc);
 doc=(await rpc("ministry_save_document",args)).document;
 assert.equal((await rpc("ministry_save_document",args)).document.revision,doc.revision);
 await rpc("ministry_save_document",{...args,p_data:project},"40001");
 const concurrent=await Promise.all(["Concurrent A","Concurrent B"].map(title=>minister.client.rpc("ministry_save_document",saveArgs("research",{...doc.data,title},doc))));
 assert.deepEqual(concurrent.map(x=>x.error?.code??"OK").sort(),["40001","OK"]);
 doc=(await rpc("ministry_get_document",{p_kind:"research",p_document_id:doc.id})).document;
 pass("SQL independently rejects invalid citations, sources, dates, tenant fields and stale or duplicate saves");
 const result=await web("/api/ministry/research/"+doc.id);
 assert.equal(result.status,200,JSON.stringify(result.body));assert.deepEqual(result.body.document,doc);assert.match(result.headers.get("cache-control"),/no-store/);
 assert.equal((await web("/api/ministry/research?workspaceId="+f.ministerOther.workspaceId)).status,400);
 assert.equal((await web("/api/ministry/research?limit=2&limit=3")).status,400);
 assert.equal((await web("/api/ministry/research",null,null)).status,401);
 assert.equal((await web("/api/ministry/research",null,writer.token)).status,403);
 assert.equal((await web("/api/ministry/research/"+foreign.id)).status,404);
 assert.equal((await web("/api/ministry/archive",{kind:"research",documentId:doc.id,expectedRevision:doc.revision,requestId:randomUUID(),data:doc.data})).status,400);
 pass("real native APIs validate private no-store responses, query allowlists, record type and bearer access");
 const composition=await web("/api/bundles/experience",null,dual.token);
 assert.equal(composition.status,200);
 assert.deepEqual(composition.body.ui.primaryNavigation.map(x=>x.label).sort(),["Ministry","Writing"]);
 assert.equal(composition.body.ui.dashboardWidgets.length,2);
 pass("dual entitlement composes Ministry and Writing without a client-specific navigation branch");
 const oauth=await localOAuth(config,f.minister),mcp=await connect(oauth.token);
 const catalog=await mcp.listTools(),names=catalog.tools.map(x=>x.name);
 for(const name of ["ministry_get_profile","ministry_list_research","ministry_read_research","ministry_propose_research","ministry_search_archive","ministry_read_archive"])assert.ok(names.includes(name));
 assert.ok(!names.some(x=>x.startsWith("writer_")));
 const mread=await mcp.callTool({name:"ministry_read_research",arguments:{documentId:doc.id}});
 assert.ok(!mread.isError);assert.deepEqual(mread.structuredContent.document,doc);
 const denied=await mcp.callTool({name:"ministry_read_research",arguments:{documentId:foreign.id}});assert.equal(denied.isError,true);
 pass("real OAuth registration, consent, PKCE and HTTP assistant tools read the same authorized saved research");
 const assistant=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:"Bearer "+oauth.token}}});
 // Bearer-bound like the application bridge; no refresh token is invented.
 const proposalInput={documentId:doc.id,expectedRevision:doc.revision,requestId:randomUUID(),patch:{notes:[...doc.data.notes,{id:randomUUID(),kind:"interpretation",text:"Synthetic assistant interpretation",sourceIds:[sid],epistemicState:"user_stated"}]},reason:"Clarify the distinction.",evidence:"Synthetic recorded source only."};
 const proposed=await mcp.callTool({name:"ministry_propose_research",arguments:proposalInput});assert.ok(!proposed.isError,JSON.stringify(proposed));
 const proposal=proposed.structuredContent;assert.equal(proposal.origin,"assistant");assert.equal(proposal.patch.notes[1].epistemicState,"inferred");
 assert.equal((await rpc("ministry_get_document",{p_kind:"research",p_document_id:doc.id})).document.revision,doc.revision);
 for(const [name,input] of [
  ["ministry_save_document",saveArgs("profile",profile,pref)],
  ["ministry_document_history",{p_kind:"profile",p_document_id:pref.id}],
  ["ministry_decide_research",{p_proposal_id:proposal.id,p_expected_revision:doc.revision,p_decision:"approve"}]
 ])await rpc(name,input,"42501",assistant);
 pass("assistant proposals leave canonical work unchanged, force new interpretations to inferred and cannot approve or alter profile/history");
 const decision=await web("/api/ministry/proposals/decision",{proposalId:proposal.id,expectedRevision:doc.revision,decision:"approve"});
 assert.equal(decision.status,200,JSON.stringify(decision.body));doc=decision.body.document;
 assert.equal(doc.data.notes[1].epistemicState,"inferred");assert.equal(doc.origin,"assistant");
 const replay=await mcp.callTool({name:"ministry_propose_research",arguments:proposalInput});assert.ok(!replay.isError);assert.equal(replay.structuredContent.id,proposal.id);
 assert.equal((await rpc("ministry_get_document",{p_kind:"profile"})).document.data.positions[0].epistemicState,"inferred");
 pass("explicit native approval adds one revision, preserves inferred status and proposal retries survive canonical changes");
 const staleProposal=await rpc("ministry_propose_research",{p_document_id:doc.id,p_expected_revision:doc.revision,p_request_id:randomUUID(),p_patch:{teachingOutline:"Stale proposal"},p_reason:"Fictional reason",p_evidence:"Fictional evidence"});
 const old=doc;doc=(await rpc("ministry_save_document",saveArgs("research",{...doc.data,teachingOutline:"New direct work"},doc))).document;
 await rpc("ministry_decide_research",{p_proposal_id:staleProposal.id,p_expected_revision:doc.revision,p_decision:"approve"},"40001");
 await rpc("ministry_decide_research",{p_proposal_id:staleProposal.id,p_expected_revision:doc.revision,p_decision:"reject"});
 for(let i=0;i<10;i++)doc=(await rpc("ministry_save_document",saveArgs("research",{...doc.data,teachingOutline:"Revision retention "+i},doc))).document;
 const history=await rpc("ministry_document_history",{p_kind:"research",p_document_id:doc.id});
 assert.equal(history.revisions.length,10);assert.ok(history.revisions.some(d=>d.revision===1&&d.data.teachingOutline===project.teachingOutline));assert.equal(history.revisions[0].revision,doc.revision);
 await rpc("ministry_document_history",{p_kind:"research",p_document_id:foreign.id},"P0002");
 pass("stale proposals cannot overwrite direct work; original plus latest nine revisions remain recoverable");
 localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='ministry' and capability_key='ministry_research';");disabled=true;
 assert.equal((await web("/api/ministry/research/"+doc.id)).status,403);
 assert.equal((await mcp.callTool({name:"ministry_read_research",arguments:{documentId:doc.id}})).isError,true);
 localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='ministry' and capability_key='ministry_research';");disabled=false;
 pass("revoked capability is denied on every native and assistant request");
 console.log("Completed "+groups+" Ministry native/API/OAuth acceptance groups.");
} finally {
 if(disabled)localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='ministry' and capability_key='ministry_research';");
 for(const c of connections)await c.close();
 if(originalProfile){const current=(await rpc("ministry_get_document",{p_kind:"profile"})).document;await rpc("ministry_save_document",saveArgs("profile",originalProfile.data,current));}
 if(created.length)localSql("delete from workspace_private.ministry_documents where id in ("+created.map(id=>"'"+id+"'").join(",")+");");
}
