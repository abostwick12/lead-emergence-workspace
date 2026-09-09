import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {appUrl,localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
import {localOAuth} from "./bundle-local-oauth.mjs";
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const founder=await fixtureSession(config,f.founder),other=await fixtureSession(config,f.founderOther),reader=await fixtureSession(config,f.reader),writer=await fixtureSession(config,f.writer),minister=await fixtureSession(config,f.minister),dual=await fixtureSession(config,f.founderDual);
const created=[],proposals=[],connections=[];let disabled=false,groups=0;
const pass=name=>{groups++;console.log("PASS "+name);};
async function rpc(name,args={},code=null,client=founder.client){const r=await client.rpc(name,args);assert.equal(r.error?.code??null,code,JSON.stringify(r.error));return r.data;}
async function web(path,body,token=founder.token){const r=await fetch(appUrl+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,body:await r.json()};}
const action=(title)=>({id:randomUUID(),title,owner:"",dueDate:"2026-09-01",status:"planned",nextAction:"An administrative next step.",evidence:"Fictional acceptance decision.",priority:"normal"});
const milestone={...action("Synthetic launch review"),category:"launch",dependsOn:[]};
const plan={title:"Synthetic founder roadmap "+randomUUID(),mission:"SYNTHETIC_NONPROFIT_PLAN_MARKER",jurisdiction:"Fictional jurisdiction",status:"active",targetDate:null,milestones:[milestone]};
const partner={title:"Synthetic community partner "+randomUUID(),role:"partner",contactName:"Example contact",contactEmail:"example@example.invalid",stage:"contacted",owner:"Example owner",nextAction:"Confirm the administrative partnership conversation.",followupDate:"2026-09-01",lastContactDate:null,notes:"SYNTHETIC_NONPROFIT_PARTNER_MARKER",outreachDraft:"Fictional unsent outreach."};
const meeting={title:"Synthetic planning meeting "+randomUUID(),scheduledDate:"2026-09-09",localTime:"09:30",timeZone:"America/Chicago",location:"Example meeting room",participants:["Example coordinator"],status:"completed",agenda:"Review administrative launch work.",notes:"SYNTHETIC_NONPROFIT_MEETING_MARKER",decisions:["Continue planning; not a legal determination."],actions:[action("Follow up after the meeting")]};
const research={title:"Synthetic source-first question "+randomUUID(),category:"regulatory",jurisdiction:"Fictional jurisdiction",question:"Which fictional authority should review this?",status:"researching",reviewDate:"2026-09-01",owner:"Example reviewer",
 sources:[{id:randomUUID(),title:"Fictional agency page",authority:"Fictional authority",authorityType:"government",url:"https://example.org/fictional-nonprofit-source",reference:"Acceptance fixture, not legal guidance",jurisdiction:"Fictional jurisdiction",retrievedDate:"2026-09-08",effectiveDate:null,sourceDate:null,finding:"SYNTHETIC_NONPROFIT_RESEARCH_MARKER"}],
 interpretation:"A tentative fictional interpretation.",uncertainty:"Applicability is unverified.",requiredAction:"Seek qualified review before acting.",professionalReview:"A qualified professional should review applicability.",epistemicState:"user_stated"};
const saveArgs=(kind,data,doc=null)=>({p_kind:kind,p_document_id:doc?.id??null,p_expected_revision:doc?.revision??0,p_request_id:randomUUID(),p_data:data,p_confirm_administrative:true});
const proposalArgs=(kind,data,doc=null)=>({p_kind:kind,p_document_id:doc?.id??null,p_expected_revision:doc?.revision??0,p_request_id:randomUUID(),p_data:data,p_reason:"A requested synthetic change.",p_evidence:"Fictional acceptance source and user request.",p_scope:"administrative_only"});
async function create(kind,data,client=founder.client){const d=(await rpc("nonprofit_save_document",saveArgs(kind,data),null,client)).document;created.push(d.id);return d;}
async function propose(args,client=founder.client){const p=await rpc("nonprofit_propose_document",args,null,client);proposals.push(p.id);return p;}
async function decide(p,decision="approve",client=founder.client){const r=await rpc("nonprofit_decide_proposal",{p_proposal_id:p.id,p_expected_revision:p.baseRevision,p_decision:decision,p_confirm_administrative:decision==="approve"},null,client);if(r.document)created.push(r.document.id);return r;}
async function connect(token){const c=new Client({name:"synthetic-nonprofit-acceptance",version:"1"});await c.connect(new StreamableHTTPClientTransport(new URL(appUrl+"/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+token}}}));connections.push(c);return c;}
try{
 const docs={plan:await create("plan",plan),partner:await create("partner",partner),meeting:await create("meeting",meeting),research:await create("research",research)};
 const foreign=await create("partner",{...partner,title:"PRIVATE OTHER NONPROFIT"},other.client);
 for(const [kind,d]of Object.entries(docs)){
  assert.deepEqual((await rpc("nonprofit_get_document",{p_kind:kind,p_document_id:d.id})).document,d);
  assert.equal((await rpc("nonprofit_search_documents",{p_kind:kind,p_search:"SYNTHETIC_NONPROFIT_"+kind.toUpperCase()+"_MARKER"})).documents.some(x=>x.id===d.id),true);
  for(const client of [reader.client,writer.client,minister.client])await rpc("nonprofit_get_document",{p_kind:kind,p_document_id:d.id},"42501",client);
 }
 await rpc("nonprofit_get_document",{p_kind:"partner",p_document_id:foreign.id},"P0002");
 await rpc("nonprofit_get_document",{p_kind:"research",p_document_id:docs.partner.id},"P0002");
 await rpc("nonprofit_get_document",{p_kind:"plan",p_document_id:f.writerResourceId},"P0002",dual.client);
 await rpc("writer_get_resource",{resource_id:docs.plan.id},"P0002",dual.client);
 await rpc("ministry_get_document",{p_kind:"research",p_document_id:docs.research.id},"P0002",dual.client);
 pass("real SQL CRUD/search for all four kinds and client, capability and multi-bundle record isolation");
 for(const [kind,data]of [["plan",{...plan,patientRecords:[]}],["partner",{...partner,diagnosis:"disallowed field"}],["meeting",{...meeting,treatmentPlan:"disallowed field"}],["research",{...research,complianceCertified:true}],["plan",{...plan,title:null}],["research",{...research,sources:[]}]]){
  if(kind==="research"&&data.sources?.length===0)continue;
  await rpc("nonprofit_save_document",saveArgs(kind,data),"22023");
 }
 await rpc("nonprofit_save_document",{...saveArgs("plan",plan),p_confirm_administrative:false},"22023");
 await rpc("nonprofit_save_document",saveArgs("plan",{...plan,milestones:[{...milestone,dependsOn:[milestone.id]}]}),"22023");
 await rpc("nonprofit_save_document",saveArgs("plan",{...plan,milestones:[{...milestone,dependsOn:[randomUUID()]}]}),"22023");
 await rpc("nonprofit_save_document",saveArgs("plan",{...plan,milestones:[milestone,milestone]}),"22023");
 await rpc("nonprofit_save_document",saveArgs("meeting",{...meeting,timeZone:"Imaginary/Nowhere"}),"22023");
 await rpc("nonprofit_save_document",saveArgs("meeting",{...meeting,scheduledDate:"2026-02-30"}),"22023");
 for(const contactEmail of [".person@example.org","person..name@example.org","person@example.c"])
  await rpc("nonprofit_save_document",saveArgs("partner",{...partner,contactEmail}),"22023");
 for(const data of [{...research,uncertainty:""},{...research,professionalReview:""},{...research,status:"compliant"},{...research,status:"reviewed",sources:[]},{...research,sources:[{...research.sources[0],url:"https://someone:secret@example.org/"}]},{...research,sources:[{...research.sources[0],retrievedDate:null}]}])
  await rpc("nonprofit_save_document",saveArgs("research",data),"22023");
 pass("independent SQL rejection of clinical/unknown fields, missing confirmation, invalid dependencies, sources, dates and review assertions");
 const retry=saveArgs("partner",{...partner,nextAction:"Saved follow-up revision two."},docs.partner);
 docs.partner=(await rpc("nonprofit_save_document",retry)).document;
 assert.equal((await rpc("nonprofit_save_document",retry)).document.revision,2);
 await rpc("nonprofit_save_document",{...retry,p_data:partner},"40001");
 const races=await Promise.all(["Concurrent A","Concurrent B"].map(title=>founder.client.rpc("nonprofit_save_document",saveArgs("partner",{...docs.partner.data,title},docs.partner))));
 assert.deepEqual(races.map(x=>x.error?.code??"OK").sort(),["40001","OK"]);
 docs.partner=(await rpc("nonprofit_get_document",{p_kind:"partner",p_document_id:docs.partner.id})).document;
 await rpc("nonprofit_save_document",retry,"40001");
 const history=await rpc("nonprofit_document_history",{p_kind:"partner",p_document_id:docs.partner.id});
 assert.deepEqual(history.revisions.at(-1).data,partner);
 pass("exact idempotent saves, concurrent stale-write rejection and recoverable original history");
 for(const [kind,d]of Object.entries(docs)){
  const result=await web("/api/nonprofit/"+kind+"/"+d.id);assert.equal(result.status,200,JSON.stringify(result.body));assert.deepEqual(result.body.document,d);assert.match(result.headers.get("cache-control"),/no-store/);
 }
 for(const path of ["/api/nonprofit/plan?workspaceId="+f.founderOther.workspaceId,"/api/nonprofit/plan?limit=2&limit=3","/api/nonprofit/plan?limit=Infinity"])assert.equal((await web(path)).status,400);
 assert.equal((await web("/api/nonprofit/plan",null,null)).status,401);
 assert.equal((await web("/api/nonprofit/plan",null,reader.token)).status,403);
 assert.equal((await web("/api/nonprofit/partner/"+foreign.id)).status,404);
 assert.equal((await web("/api/nonprofit/meeting",{kind:"plan",documentId:null,expectedRevision:0,requestId:randomUUID(),data:plan,confirmAdministrative:true})).status,400);
 const nativeSave=await web("/api/nonprofit/plan",{kind:"plan",documentId:docs.plan.id,expectedRevision:docs.plan.revision,requestId:randomUUID(),data:{...plan,mission:"An actual native API revision."},confirmAdministrative:true});assert.equal(nativeSave.status,200);docs.plan=nativeSave.body.document;
 const authority=(await web("/api/bundles/experience",null,dual.token)).body;
 const composition=authority.experience??authority;
 assert.equal(JSON.stringify(composition).includes("/workspace/nonprofit"),true);
 pass("real native bearer APIs, private no-store output, strict query/body validation and multi-bundle composition");
 let pending=await propose(proposalArgs("plan",{...plan,title:"Proposed new roadmap"}));
 assert.equal(pending.documentId,null);
 assert.equal((await rpc("nonprofit_search_documents",{p_kind:"plan",p_search:'"Proposed new roadmap"'})).total,0);
 assert.equal((await rpc("nonprofit_list_proposals",{p_kind:"plan"})).proposals.some(p=>p.id===pending.id),true);
 await rpc("nonprofit_decide_proposal",{p_proposal_id:pending.id,p_expected_revision:0,p_decision:"approve",p_confirm_administrative:false},"22023");
 await rpc("nonprofit_decide_proposal",{p_proposal_id:pending.id,p_expected_revision:0,p_decision:"approve",p_confirm_administrative:true},"P0002",other.client);
 const approved=await decide(pending);assert.equal(approved.document.revision,1);
 assert.equal((await decide(pending)).document.id,approved.document.id);
 assert.equal((await rpc("nonprofit_list_proposals",{p_kind:"plan",p_status:"approved"})).proposals.some(p=>p.id===pending.id),true);
 pending=await propose(proposalArgs("partner",{...partner,title:"Rejected proposal remains recoverable"}));
 const rejected=await decide(pending,"reject");assert.equal(rejected.document,null);assert.equal(rejected.proposal.status,"rejected");
 assert.equal((await rpc("nonprofit_list_proposals",{p_kind:"partner",p_status:"rejected"})).proposals.some(p=>p.id===pending.id),true);
 pass("new-record proposals stay noncanonical until exact native approval; rejection and prior decisions remain recoverable");
 const stale=await propose(proposalArgs("partner",{...docs.partner.data,nextAction:"Stale proposal"},docs.partner));
 docs.partner=(await rpc("nonprofit_save_document",saveArgs("partner",{...docs.partner.data,nextAction:"A newer native decision."},docs.partner))).document;
 await rpc("nonprofit_decide_proposal",{p_proposal_id:stale.id,p_expected_revision:stale.baseRevision,p_decision:"approve",p_confirm_administrative:true},"40001");
 await decide(stale,"reject");
 const moves=await rpc("nonprofit_next_moves");assert.match(moves.asOfDate,/^\d{4}-\d{2}-\d{2}$/);
 for(const kind of ["plan","partner","meeting","research"])assert.equal(moves.items.some(x=>x.kind===kind),true,kind);
 assert.equal(moves.items.some(x=>x.documentId===foreign.id),false);
 assert.equal(moves.items.every(x=>x.reason&&x.evidence&&x.revision>0),true);
 pass("stale proposal approval fails without losing native work; attention is evidence-linked and tenant-scoped");
 const oauth=await localOAuth(config,f.founder),assistant=await connect(oauth.token);
 const oauthDb=createClient(config.API_URL,config.ANON_KEY,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+oauth.token}}});
 const tools=(await assistant.listTools()).tools.filter(x=>x.name.startsWith("nonprofit_"));
 assert.equal(tools.length,13);
 assert.deepEqual(tools.filter(x=>!x.annotations.readOnlyHint).map(x=>x.name).sort(),["nonprofit_propose_meeting","nonprofit_propose_partner","nonprofit_propose_plan","nonprofit_propose_research"]);
 assert.equal(tools.every(x=>x.annotations.openWorldHint===false),true);
 for(const [kind,d]of Object.entries(docs)){
  const listed=await assistant.callTool({name:"nonprofit_list_"+(kind==="research"?"research":kind+"s"),arguments:{search:"",limit:25,offset:0}});
  assert.equal(listed.isError??false,false);assert.equal(listed.structuredContent.documents.some(x=>x.id===d.id),true);
  const result=await assistant.callTool({name:"nonprofit_get_"+kind,arguments:{documentId:d.id}});
  assert.equal(result.isError??false,false);assert.deepEqual(result.structuredContent.document,d);
 }
 const denied=await assistant.callTool({name:"nonprofit_get_partner",arguments:{documentId:foreign.id}});assert.equal(denied.isError,true);assert.equal(JSON.stringify(denied).includes("PRIVATE OTHER NONPROFIT"),false);
 assert.equal((await assistant.callTool({name:"nonprofit_next_moves",arguments:{}})).isError??false,false);
 for(const kind of ["plan","partner","meeting"]){
  const result=await assistant.callTool({name:"nonprofit_propose_"+kind,arguments:{documentId:null,expectedRevision:0,requestId:randomUUID(),data:docs[kind].data,reason:"Requested new administrative record.",evidence:"Fictional user-supplied context.",scope:"administrative_only"}});
  assert.equal(result.isError??false,false);proposals.push(result.structuredContent.id);assert.equal(result.structuredContent.origin,"assistant");await decide(result.structuredContent,"reject");
 }
 assert.equal((await assistant.callTool({name:"nonprofit_propose_plan",arguments:{documentId:null,expectedRevision:0,requestId:randomUUID(),data:{...plan,patientRecords:[]},reason:"Invalid test input.",evidence:"Fictional negative test.",scope:"administrative_only"}})).isError,true);
 pass("real OAuth registration, consent, PKCE and HTTP MCP with 13 accurate, capability-scoped tools");
 const proposedInput={documentId:docs.research.id,expectedRevision:docs.research.revision,requestId:randomUUID(),data:{...research,interpretation:"Assistant-proposed interpretation.",status:"reviewed"},reason:"Requested test research revision.",evidence:"Fictional source supplied for acceptance.",scope:"administrative_only"};
 const mcpProposal=await assistant.callTool({name:"nonprofit_propose_research",arguments:proposedInput});
 assert.equal(mcpProposal.isError??false,false,JSON.stringify(mcpProposal));
 const p=mcpProposal.structuredContent;proposals.push(p.id);assert.equal(p.origin,"assistant");assert.equal(p.data.epistemicState,"inferred");assert.equal(p.data.status,"review_required");
 assert.equal((await assistant.callTool({name:"nonprofit_propose_research",arguments:proposedInput})).structuredContent.id,p.id);
 const a=await decide(p);docs.research=a.document;assert.equal(a.document.data.epistemicState,"inferred");
 assert.equal((await assistant.callTool({name:"nonprofit_propose_research",arguments:proposedInput})).structuredContent.id,p.id);
 await rpc("nonprofit_save_document",saveArgs("plan",plan),"42501",oauthDb);
 await rpc("nonprofit_decide_proposal",{p_proposal_id:p.id,p_expected_revision:p.baseRevision,p_decision:"approve",p_confirm_administrative:true},"42501",oauthDb);
 await rpc("nonprofit_document_history",{p_kind:"research",p_document_id:docs.research.id},"42501",oauthDb);
 await rpc("nonprofit_list_proposals",{p_kind:"research"},"42501",oauthDb);
 pass("assistant proposals normalize inferred research, retry deterministically and cannot call native save/approval/history");
 localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='nonprofit_founder' and capability_key='nonprofit_regulatory_research';");disabled=true;
 assert.equal((await assistant.callTool({name:"nonprofit_get_research",arguments:{documentId:docs.research.id}})).isError,true);
 assert.equal((await web("/api/nonprofit/research/"+docs.research.id)).status,403);
 assert.equal((await rpc("nonprofit_next_moves")).items.some(x=>x.kind==="research"),false);
 const after=(await web("/api/bundles/experience")).body;
 assert.equal(JSON.stringify(after).includes("/workspace/nonprofit/research"),false);
 assert.equal((await web("/api/nonprofit/partner/"+docs.partner.id)).status,200);
 localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='nonprofit_founder' and capability_key='nonprofit_regulatory_research';");disabled=false;
 pass("capability revocation removes API, connected tool, attention and navigation access without disabling other areas");
 const disconnect=await founder.client.rpc("disconnect_personal_mcp",{target_client_id:oauth.clientId});
 assert.equal(disconnect.error,null);
 const blocked=await fetch(appUrl+"/api/mcp",{method:"POST",headers:{Authorization:"Bearer "+oauth.token,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:101,method:"tools/list",params:{}})});
 assert.equal(blocked.status,401);
 pass("revoked assistant authorization fails closed while native founder records remain accessible");
 const readerOAuth=await localOAuth(config,f.reader),readerAssistant=await connect(readerOAuth.token);
 assert.equal((await readerAssistant.listTools()).tools.some(x=>x.name.startsWith("nonprofit_")),false);
 pass("unassigned users are not advertised founder tools");
 console.log("Nonprofit connected acceptance: "+groups+" groups passed.");
}finally{
 if(disabled)localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='nonprofit_founder' and capability_key='nonprofit_regulatory_research';");
 for(const c of connections)await c.close().catch(()=>{});
 if(proposals.length)localSql("delete from workspace_private.nonprofit_proposals where id in ("+[...new Set(proposals)].map(id=>"'"+id+"'").join(",")+");");
 if(created.length)localSql("delete from workspace_private.nonprofit_documents where id in ("+[...new Set(created)].map(id=>"'"+id+"'").join(",")+");");
}
