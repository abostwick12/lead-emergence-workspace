import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {localConfiguration,localSql,fixtureSession,publicClient} from "./bundle-local-runtime.mjs";
import {executiveFixtures} from "./executive-fixtures.mjs";
import {investorFixtures} from "./investor-fixtures.mjs";
import {z} from "zod";
import {executiveBaseSchemas} from "../vendor/lead-emergence-bundles/domain-contracts/executive.ts";
const config=await localConfiguration(), fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const dual=await fixtureSession(config,fixtures.executiveDual), other=await fixtureSession(config,fixtures.executiveOther),
 operator=await fixtureSession(config,fixtures.operator);
const date="2026-09-09", marker="Task acceptance "+randomUUID(), refs=[], records={};
let groups=0;
const pass=msg=>{groups++;console.log("PASS "+msg);};
for(const [kind,schema] of Object.entries(executiveBaseSchemas)) {
 assert.match(kind,/^[a-z_]+$/);
 assert.deepEqual(JSON.parse(localSql("select workspace_private.executive_schema('"+kind+"');")),z.toJSONSchema(schema,{io:"input"}));
}
pass("all five replayed database schemas exactly match the pinned reusable source schemas");
const rpc=async(name,p={},client=dual.client)=>{const r=await client.rpc(name,p);assert.equal(r.error,null,name+": "+r.error?.message);return r.data;};
const denied=async(name,p,code="22023",client=dual.client)=>assert.equal((await client.rpc(name,p)).error?.code,code,name+" denial");
const save=async(bundle,kind,data,previous=null)=>{
 const result=await rpc(bundle+"_save_document",{p_kind:kind,p_document_id:previous?.id??null,p_expected_revision:previous?.revision??0,
  p_request_id:randomUUID(),p_data:data,...(bundle==="executive"?{p_confirm_exact_record:true}:bundle==="nonprofit"?{p_confirm_administrative:true}:{p_confirm_research_only:true})});
 return result.document;
};
const taskRef=(capabilityId,record,kind,id)=>({capabilityId,kind:record.kind,documentId:record.id,revision:record.revision,item:{kind,id}});
const resolve=references=>rpc("executive_resolve_references",{p_references:references});
const caps=["nonprofit.roadmap","nonprofit.partners","nonprofit.meetings","investor.company_research","investor.thesis","investor.filings"];
let sharing=await rpc("executive_get_source_permissions_v2");
const permissionInput=(recordCaps=caps,taskCaps=caps)=>({p_capabilities:recordCaps,p_task_capabilities:taskCaps,p_expected_revision:sharing.revision,
 p_request_id:randomUUID(),p_confirm_task_metadata_only:true,p_confirm_expanded_task_metadata:true,p_task_metadata_version:"task-metadata-v1"});
const shareV2=async(recordCaps=caps,taskCaps=caps)=>sharing=await rpc("executive_set_source_permissions_v2",permissionInput(recordCaps,taskCaps));
const shareV1=async(recordCaps)=>{await rpc("executive_set_source_permissions",{p_capabilities:recordCaps,p_expected_revision:sharing.revision,
 p_request_id:randomUUID(),p_confirm_task_metadata_only:true});sharing=await rpc("executive_get_source_permissions_v2");};
const founderAction=(title,patch={})=>({id:randomUUID(),title,owner:"Fictional owner",dueDate:date,status:"planned",nextAction:"Review a fictional next step",
 evidence:"PRIVATE_CANARY_TASK_EVIDENCE",priority:"normal",...patch});
const prerequisite=founderAction(marker+" prerequisite",{dueDate:"2026-12-01"});
const milestone={...founderAction(marker+" blocked milestone",{status:"blocked",dueDate:null}),category:"other",dependsOn:[prerequisite.id]};
const plan={title:marker+" roadmap",mission:"PRIVATE_CANARY_MISSION",jurisdiction:"Fictional jurisdiction",status:"active",targetDate:"2026-12-01",
 milestones:[{...prerequisite,category:"other",dependsOn:[]},milestone]};
records.plan=await save("nonprofit","plan",plan);
refs.push(taskRef("nonprofit.roadmap",records.plan,"milestone",milestone.id));
records.partner=await save("nonprofit","partner",{title:marker+" followup",role:"partner",contactName:"PRIVATE_CANARY_CONTACT",contactEmail:"",
 stage:"conversation",owner:"Fictional coordinator",nextAction:"Ask for the illustrative outline",followupDate:date,lastContactDate:null,
 notes:"PRIVATE_CANARY_PARTNER",outreachDraft:"PRIVATE_CANARY_OUTREACH"});
refs.push(taskRef("nonprofit.partners",records.partner,"followup",records.partner.id));
const meetingAction=founderAction(marker+" completed meeting open action");
records.nonprofitMeeting=await save("nonprofit","meeting",{title:marker+" completed meeting",scheduledDate:date,localTime:"",timeZone:"",location:"",
 participants:[],status:"completed",agenda:"PRIVATE_CANARY_AGENDA",notes:"PRIVATE_CANARY_MEETING",decisions:[],actions:[meetingAction]});
refs.push(taskRef("nonprofit.meetings",records.nonprofitMeeting,"action",meetingAction.id));
const investor=investorFixtures();
for(const kind of ["watchlist","brief","thesis","filing"]) {
 const content=structuredClone(investor[kind]);content.title=marker+" "+kind;
 if(kind==="watchlist") {content.purpose="PRIVATE_CANARY_PURPOSE";content.entries[0].rationale="PRIVATE_CANARY_RATIONALE";}
 else {content.uncertainty="PRIVATE_CANARY_UNCERTAINTY";content.sources[0].excerpt="PRIVATE_CANARY_EXCERPT";content.claims[0].text="PRIVATE_CANARY_CLAIM";content.catalysts[0].whyItMatters="PRIVATE_CANARY_CATALYST_BODY";}
 records[kind]=await save("investor",kind,content);
 const cap=kind==="watchlist"||kind==="brief"?"investor.company_research":"investor."+ (kind==="filing"?"filings":"thesis");
 refs.push(taskRef(cap,records[kind],kind==="watchlist"?"watch_item":"catalyst",kind==="watchlist"?content.entries[0].id:content.catalysts[0].id));
}
const ownRefs=[];
for(const kind of ["meeting","daily_brief","weekly_review"]) {
 const content=executiveFixtures(date)[kind];content.title=marker+" "+kind;
 const action={id:randomUUID(),title:marker+" "+kind+" action",owner:"Fictional owner",dueDate:date,state:"open",
  nextAction:"Review the illustrative next move",evidence:"PRIVATE_CANARY_EXECUTIVE_EVIDENCE",reviewState:"user_stated"};
 content.actions=[action];
 if(kind==="meeting"){content.state="held";content.outcome="PRIVATE_CANARY_OUTCOME";}
 const record=await save("executive",kind,content);records["exec"+kind]=record;
 ownRefs.push(taskRef(kind==="meeting"?"executive.coordination":kind==="daily_brief"?"executive.brief":"executive.review",record,"action",action.id));
}
try {
 await shareV2([],[]);await shareV1(caps);
 assert.deepEqual(sharing.taskCapabilities,[]);
 assert.ok((await resolve(refs)).references.every(r=>r.state==="unavailable"&&r.metadata===null));
 assert.ok((await resolve(ownRefs)).references.every(r=>r.state==="current"));
 const legacy=await rpc("executive_attention",{p_as_of_date:date});assert.ok(legacy.items.every(i=>!i.source.item));
 let search=await rpc("executive_find_sources",{p_capability:caps[0],p_level:"task"});
 assert.deepEqual({state:search.state,total:search.total,items:search.items,nextCursor:search.nextCursor},{state:"not_shared",total:null,items:[],nextCursor:null});
 const p=permissionInput();
 for(const patch of [{p_confirm_expanded_task_metadata:false},{p_task_metadata_version:"all-content"},{p_capabilities:[]},
  {p_task_capabilities:["writer.resource.library"]},{p_task_capabilities:[caps[0],caps[0]]},{p_task_capabilities:null}])
  await denied("executive_set_source_permissions_v2",{...p,...patch});
 sharing=await rpc("executive_set_source_permissions_v2",p);
 assert.deepEqual(await rpc("executive_set_source_permissions_v2",{...p,p_capabilities:[...caps].reverse(),p_task_capabilities:[...caps].reverse()}),sharing);
 await denied("executive_set_source_permissions_v2",{...p,p_request_id:randomUUID()},"40001");
 const concurrentInput=permissionInput(), concurrent=await Promise.all([
  dual.client.rpc("executive_set_source_permissions_v2",concurrentInput),
  dual.client.rpc("executive_set_source_permissions_v2",{...concurrentInput,p_request_id:randomUUID()})]);
 assert.equal(concurrent.filter(r=>!r.error).length,1);assert.equal(concurrent.find(r=>r.error)?.error.code,"40001");
 sharing=await rpc("executive_get_source_permissions_v2");
 pass("legacy grants never expand; separate versioned confirmation, exact retries and concurrent permission conflicts work in the database");

 const resolved=await resolve([...refs,...ownRefs]);
 const fields=["title","state","reviewState","revision","dueDate","sourceUpdatedAt","parentTitle","owner","nextAction","priority","dateState","openPrerequisites"].sort();
 for(const r of resolved.references){assert.equal(r.state,"current");assert.deepEqual(Object.keys(r.metadata).sort(),fields);}
 assert.doesNotMatch(JSON.stringify(resolved),/PRIVATE_CANARY/);
 assert.equal(resolved.references[0].metadata.openPrerequisites,1);
 assert.equal(resolved.references.find(r=>r.reference.kind==="thesis").metadata.dateState,"estimated");
 const recordRef={...refs[0]};delete recordRef.item;
 assert.equal(Object.keys((await resolve([recordRef])).references[0].metadata).length,6);
 assert.ok((await rpc("executive_resolve_references",{p_references:refs},other.client)).references.every(r=>r.metadata===null));
 for(const patch of [{item:{kind:"catalyst",id:milestone.id}},{kind:"meeting"},{item:{kind:"milestone",id:milestone.id,body:"PRIVATE"}}])
  await denied("executive_resolve_references",{p_references:[{...refs[0],...patch}]});
 assert.equal((await resolve([{...refs[0],item:{...refs[0].item,id:randomUUID()}}])).references[0].metadata,null);
 await denied("executive_find_sources",{p_capability:"ministry.profile",p_level:"task"});
 await denied("executive_find_sources",{p_capability:"ministry.research",p_level:"task"});
 await denied("executive_find_sources",{p_capability:caps[0],p_level:"task",p_after:"client-private-text"});
 await denied("executive_find_sources",{p_capability:caps[0],p_level:"task"},"42501",publicClient(config));
 pass("all ten task mappings return exactly twelve fields; old record links stay six-field and wrong scope/client/item requests fail closed");

 const signals=[];
 for(let offset=0;;offset+=3) {
  const page=await rpc("executive_review_attention",{p_as_of_date:date,p_offset:offset,p_limit:3});
  assert.equal(page.coverage.length,22);assert.equal(new Set(page.coverage.map(c=>c.capabilityId+":"+c.level)).size,22);
  assert.equal(page.total,page.coverage.reduce((sum,c)=>sum+(c.total??0),0));
  assert.equal(page.items.length,Math.min(3,Math.max(0,page.total-offset)));signals.push(...page.items);
  if(offset+3>=page.total)break;
 }
 assert.equal(new Set(signals.map(i=>i.id)).size,signals.length);
 const has=ref=>signals.find(i=>i.source.documentId===ref.documentId&&i.source.item?.id===ref.item.id);
 for(const ref of [...refs,...ownRefs])assert.ok(has(ref),"Expected a current task cue");
 assert.equal(has(refs[0]).openPrerequisites,1);
 assert.match(has(refs.find(r=>r.kind==="thesis")).reason,/certainty is estimated; no event/);
 assert.ok(!signals.some(i=>i.source.documentId===records.nonprofitMeeting.id&&!i.source.item));
 assert.ok(!signals.some(i=>i.source.documentId===records.execmeeting.id&&!i.source.item));
 assert.doesNotMatch(JSON.stringify(signals),/PRIVATE_CANARY/);
 pass("paged attention has exact 22-scope counts and keeps open actions from completed/held meetings, prerequisite evidence and estimated catalyst certainty");

 // A full source catalog includes future and terminal tasks outside attention.
 const pagedIds=[];
 for(let batch=0;batch<3;batch++) {
  const milestones=Array.from({length:25},(_,i)=>({...founderAction(marker+" catalog "+batch+"-"+i,{dueDate:"2026-12-01",status:i===0?"done":"planned"}),
   category:"other",dependsOn:[]}));
  const record=await save("nonprofit","plan",{...plan,title:marker+" catalog parent "+batch,milestones});
  pagedIds.push(...milestones.map(m=>taskRef("nonprofit.roadmap",record,"milestone",m.id)));
 }
 let after=null;const found=[];
 do {
  search=await rpc("executive_find_sources",{p_capability:caps[0],p_level:"task",p_search:marker+" catalog ",p_limit:17,p_after:after});
  assert.equal(search.total,75);assert.equal(search.state,"current");
  const key=r=>r.kind+":"+r.documentId+":"+r.item.kind+":"+r.item.id;
  if(search.nextCursor)assert.equal(search.nextCursor,key(search.items.at(-1).reference));
  for(const r of search.items){if(after)assert.ok(key(r.reference)>after);found.push(key(r.reference));}
  after=search.nextCursor;
 } while(after);
 assert.equal(found.length,75);assert.equal(new Set(found).size,75);assert.ok(pagedIds.every(r=>found.includes(r.kind+":"+r.documentId+":"+r.item.kind+":"+r.item.id)));
 assert.equal((await rpc("executive_find_sources",{p_capability:caps[0],p_level:"task",p_search:"PRIVATE_CANARY"})).total,0);
 pass("stable source discovery traverses 75 future/completed tasks beyond attention and does not search private evidence");

 const linked=await save("executive","daily_brief",{...executiveFixtures(date).daily_brief,title:marker+" linked brief",references:[recordRef,refs[0],taskRef(caps[0],records.plan,"milestone",prerequisite.id)]});
 assert.equal(linked.data.references.length,3);
 records.plan=await save("nonprofit","plan",{...plan,title:marker+" revised roadmap"},records.plan);
 assert.equal((await resolve([refs[0]])).references[0].state,"changed");
 assert.equal((await resolve([{...refs[0],revision:100}])).references[0].state,"unavailable");
 records.plan=await save("nonprofit","plan",{...plan,milestones:[{...prerequisite,category:"other",dependsOn:[]}]},records.plan);
 assert.equal((await resolve([refs[0]])).references[0].metadata,null);
 await denied("executive_save_document",{p_kind:"daily_brief",p_document_id:linked.id,p_expected_revision:1,p_request_id:randomUUID(),p_data:linked.data,p_confirm_exact_record:true},"42501");
 pass("multiple exact tasks coexist with their parent link; parent edits mark links changed and removed tasks become unavailable");

 await shareV1(caps.filter(c=>c!==caps[0]));assert.ok(!sharing.taskCapabilities.includes(caps[0]));assert.equal(sharing.taskCapabilities.length,5);
 await shareV1(caps);assert.ok(!sharing.taskCapabilities.includes(caps[0]));
 await shareV2(caps,[]);assert.ok((await resolve(refs)).references.every(r=>r.metadata===null));
 assert.equal((await resolve([{...refs[1],item:undefined}].map(({item,...r})=>r))).references[0].state,"current");
 await shareV2();
 const target=fixtures.executiveDual.workspaceId;assert.match(target,/^[0-9a-f-]{36}$/);
 const grants=localSql("select id from workspace.bundle_entitlements where workspace_id='"+target+"' and bundle_key='nonprofit_founder' and revoked_at is null;").split("\n").filter(Boolean);
 assert.ok(grants.length);
 try {
  for(const entitlementId of grants)await rpc("revoke_bundle_entitlement",{target_entitlement_id:entitlementId,revocation_reason:"Fictional task attention acceptance"},operator.client);
  assert.equal((await resolve([refs[1]])).references[0].metadata,null);
  const hidden=await rpc("executive_find_sources",{p_capability:"nonprofit.partners",p_level:"task"});
  assert.deepEqual({state:hidden.state,total:hidden.total,items:hidden.items},{state:"unavailable",total:null,items:[]});
 } finally {
  await rpc("issue_bundle_assignment",{target_workspace_id:target,target_bundle_key:"nonprofit_founder",idempotency_key:"executive-task-restore-"+randomUUID(),target_expires_at:null},operator.client);
 }
 pass("task withdrawal, legacy removal/regrant and live source entitlement revocation close task access without deleting personal briefs");
} finally {await shareV2([],[]);}
console.log("Executive task native acceptance: "+groups+" groups. Fictional local database; no hosted, provider or installed-plugin proof.");
