import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {localConfiguration,localSql,fixtureSession,publicClient} from "./bundle-local-runtime.mjs";
import {executiveFixtures} from "./executive-fixtures.mjs";
// Serial acceptance against the explicitly isolated fictional-user stack only.
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const own=await fixtureSession(config,fixtures.executive),other=await fixtureSession(config,fixtures.executiveOther),
 unassigned=await fixtureSession(config,fixtures.reader);
const today=new Date().toISOString().slice(0,10),data=executiveFixtures(today);
let groups=0;
const pass=label=>{groups++;console.log("PASS "+label);};
async function rpc(client,name,args={},code=null){const r=await client.rpc(name,args);assert.equal(r.error?.code??null,code,name+": "+r.error?.message);return r.data;}
const input=(kind,value,base)=>({p_kind:kind,p_data:value,p_document_id:base?.id??null,p_expected_revision:base?.revision??0,p_request_id:randomUUID(),p_confirm_exact_record:true});
const save=async(kind,value,base)=>(await rpc(own.client,"executive_save_document",input(kind,value,base))).document;
const query={p_period_start:today,p_period_end:today,p_time_zone:"UTC",p_limit:50,p_offset:0};
const report=(client=own.client,params={})=>rpc(client,"executive_weekly_outcomes",{...query,...params});
async function allEvents(client=own.client){
 const first=await report(client),events=[...first.events];let offset=events.length;
 while(offset<first.total){
  const page=await report(client,{p_offset:offset,p_recorded_through:first.recordedThrough});
  assert.equal(page.total,first.total);assert.ok(page.events.length);events.push(...page.events);offset+=page.events.length;
 }
 assert.equal(new Set(events.map(e=>e.id)).size,first.total);return {...first,events};
}
const canary="WEEKLY_PRIVATE_BODY_CANARY";
let commitment=await save("commitment",{...data.commitment,title:"Fictional weekly outcome "+randomUUID(),outcome:canary,notes:canary});
commitment=await save("commitment",{...commitment.data,state:"completed",completedOn:"2020-01-01"},commitment);
commitment=await save("commitment",{...commitment.data,notes:canary+" ordinary edit"},commitment);
commitment=await save("commitment",{...commitment.data,completedOn:"2020-01-02"},commitment);
commitment=await save("commitment",{...commitment.data,state:"open",completedOn:null},commitment);
const history=await allEvents(),changes=history.events.filter(e=>e.source.documentId===commitment.id);
assert.deepEqual(changes.map(e=>[e.source.revision,e.change,e.outcome]),[[5,"withdrawn","completed"],[4,"corrected","completed"],[2,"recorded","completed"]]);
assert.equal(changes[2].reportedDate,"2020-01-01");assert.equal(changes[1].previousReportedDate,"2020-01-01");
assert.ok(changes.every(e=>e.currentRevision===5&&e.currentState==="open"));
assert.doesNotMatch(JSON.stringify(history),/WEEKLY_PRIVATE_BODY_CANARY/);
pass("recorded-time outcomes retain backdated, corrected and reopened work without counting ordinary edits or returning private bodies");

const itemId=randomUUID(),action={id:itemId,title:"Fictional completed weekly action",owner:"Fictional owner",dueDate:today,
 state:"completed",nextAction:"",evidence:canary,reviewState:"user_stated"};
let meeting=await save("meeting",{...data.meeting,agenda:canary,actions:[action]});
meeting=await save("meeting",{...meeting.data,actions:[]},meeting);
const removed=(await allEvents()).events.filter(e=>e.source.documentId===meeting.id);
assert.deepEqual(removed.map(e=>[e.source.item?.id,e.change,e.currentTargetPresent]),[[itemId,"withdrawn",false],[itemId,"recorded",false]]);
assert.ok(removed.every(e=>e.currentState===null&&e.currentRevision===2));
const optionId=randomUUID();
let decision=await save("decision",{...data.decision,state:"decided",options:[{id:optionId,title:"Fictional option",upside:"",downside:"",evidence:""}],
 selectedOptionId:optionId,decidedOn:today,rationale:canary});
decision=await save("decision",{...decision.data,state:"reversed"},decision);
decision=await save("decision",{...decision.data,state:"open",selectedOptionId:null,decidedOn:null,rationale:""},decision);
const decisions=(await allEvents()).events.filter(e=>e.source.documentId===decision.id);
assert.deepEqual(decisions.map(e=>[e.change,e.outcome]),[["withdrawn","reversed"],["recorded","reversed"],["recorded","decided"]]);
pass("deleted completed actions remain historical, and decision reversals are distinct from accomplishments");

await save("weekly_review",data.weekly_review);
const zoned=await save("weekly_review",{...data.weekly_review,timeZone:"America/New_York"});
assert.equal(zoned.data.timeZone,"America/New_York");
await rpc(own.client,"executive_save_document",input("weekly_review",{...data.weekly_review,timeZone:"Bad/Zone"}),"22023");
for(const [date,hours] of [["2026-03-08",23],["2026-11-01",25]]){
 const result=await report(own.client,{p_period_start:date,p_period_end:date,p_time_zone:"America/New_York"});
 assert.equal((Date.parse(result.windowEndExclusive)-Date.parse(result.windowStart))/3600000,hours);
}
for(const patch of [{p_period_end:"2026-02-30"},{p_period_start:"2026-09-01",p_period_end:"2026-09-08"},
 {p_time_zone:"Bad/Zone"},{p_limit:51},{p_offset:-1},{p_recorded_through:"infinity"},
 {p_period_start:"2011-12-30",p_period_end:"2011-12-30",p_time_zone:"Pacific/Apia"}]){
 const result=await own.client.rpc("executive_weekly_outcomes",{...query,...patch});
 assert.ok(["22023","22008"].includes(result.error?.code),"Invalid period/query should fail: "+JSON.stringify(patch));
}
pass("legacy reviews remain valid, named zones persist, DST windows use local days and invalid windows fail closed");

const first=await report(own.client,{p_limit:1}),second=await report(own.client,{p_limit:1,p_offset:1,p_recorded_through:first.recordedThrough});
assert.equal(first.events.length,1);assert.equal(second.events.length,1);assert.notEqual(first.events[0].id,second.events[0].id);
assert.equal(second.recordedThrough,first.recordedThrough);assert.equal(second.total,first.total);
assert.equal(first.total,first.coverage.reduce((sum,c)=>sum+(c.total??0),0));
const otherReport=await allEvents(other.client);
assert.ok(otherReport.events.every(e=>![commitment.id,meeting.id,decision.id].includes(e.source.documentId)));
await rpc(unassigned.client,"executive_weekly_outcomes",query,"42501");
await rpc(publicClient(config),"executive_weekly_outcomes",query,"42501");
pass("bounded pages reuse a cutoff and current authorization excludes other clients, unassigned accounts and anonymous callers");

for(const [key,cap] of [["executive_coordination","executive.coordination"],["executive_review","executive.review"]]){
 const previous=localSql("select enabled from workspace.bundle_capabilities where bundle_key='executive' and capability_key='"+key+"';");
 assert.equal(previous,"t","Expected enabled fictional fixture capability");
 try{
  localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='executive' and capability_key='"+key+"';");
  if(cap==="executive.review")await rpc(own.client,"executive_weekly_outcomes",query,"42501");
  else{
   const result=await report();
   assert.deepEqual(result.coverage.find(c=>c.capabilityId===cap),{capabilityId:cap,state:"unavailable",total:null});
   assert.ok(result.events.every(e=>e.source.capabilityId!==cap));
  }
 }finally{
  localSql("update workspace.bundle_capabilities set enabled="+(previous==="t"?"true":"false")+" where bundle_key='executive' and capability_key='"+key+"';");
 }
}
pass("live selective revocation removes history metadata and review revocation closes the entire endpoint");
console.log("Executive weekly native acceptance: "+groups+" groups. Real isolated auth/database only; no HTTP, installed-host or client-value proof.");
