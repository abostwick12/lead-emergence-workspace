import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {appUrl,localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const writer=await fixtureSession(config,fixtures.writer),other=await fixtureSession(config,fixtures.other),reader=await fixtureSession(config,fixtures.reader);
const created=[];
let groups=0,reviewDisabled=false;
function pass(message){groups++;console.log("PASS "+message);}
async function rpc(name,args,code,client=writer.client) {
 const result=await client.rpc(name,args);
 assert.equal(result.error?.code??null,code??null,JSON.stringify(result.error));
 return result.data;
}
async function create(client,values) {
 const result=await rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title:"Synthetic library resource",body_text:"Fictional source.",source_label:"Synthetic library acceptance",...values}},null,client);
 created.push(result.resourceId);return result.resourceId;
}
async function post(path,payload) {
 const response=await fetch(appUrl+path,{method:"POST",headers:{Authorization:"Bearer "+writer.token,"Content-Type":"application/json"},body:JSON.stringify(payload)});
 return {status:response.status,body:await response.json()};
}
try {
 const sentinel="whisperlattice"+randomUUID().replaceAll("-","");
 const first=await create(writer.client,{title:"A listening resource",body_text:sentinel+" is the unique phrase in this fictional source.",topics:["Listening"],metadata:{scripture_references:["Luke 10:25-37"]}});
 const copy=await create(writer.client,{title:"A resource copy",body_text:" "+sentinel+"  is the unique phrase in this fictional source.\n",topics:["Listening"]});
 const related=await create(writer.client,{title:"A second resource",body_text:"Different fictional text.",topics:["LISTENING"],metadata:{scripture_references:["Luke 10:25-37"]}});
 const foreign=await create(other.client,{title:"Private other-tenant match",body_text:sentinel+" is the unique phrase in this fictional source.",topics:["Listening"]});
 const found=await rpc("writer_find_connections",{resource_id:first,result_limit:20});
 assert.ok(found.candidates.find(c=>c.id===copy).duplicate_signals.includes("same_text_ignoring_whitespace"));
 assert.deepEqual(found.candidates.find(c=>c.id===related).shared_topics,["listening"]);
 assert.deepEqual(found.candidates.find(c=>c.id===related).shared_scripture,["luke 10:25-37"]);
 assert.equal(found.candidates.some(c=>c.id===foreign),false);
 assert.equal(found.baseRevision,1);
 pass("actual library matches expose precise duplicate/topic/scripture signals and exclude other tenants");
 await rpc("writer_find_connections",{resource_id:foreign},"P0002");
 await rpc("writer_find_connections",{resource_id:randomUUID()},"P0002");
 await rpc("writer_find_connections",{resource_id:first,result_limit:21},"22023");
 await rpc("writer_find_connections",{resource_id:first},"42501",reader.client);
 const result=await rpc("writer_list_resources",{search_text:sentinel});
 assert.ok(result.resources.some(r=>r.id===first));assert.equal(result.resources.some(r=>r.id===foreign),false);
 localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='writer_editor' and capability_key='writer_resource_review';");reviewDisabled=true;
 const narrow=await rpc("writer_list_resources",{search_text:sentinel});
 assert.equal(narrow.matchingCount,0);
 await rpc("writer_find_connections",{resource_id:first},"42501");
 localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='writer_editor' and capability_key='writer_resource_review';");reviewDisabled=false;
 pass("full-text search requires review access; candidate reads enforce bounds and current entitlement");
 const original=await rpc("writer_get_resource",{resource_id:first});
 let draft=await rpc("writer_get_working_draft",{resource_id:first});
 assert.equal(draft.version,0);assert.equal(draft.values,null);
 const requestId=randomUUID(),values={title:"Unfinished title",body_text:"An unfinished private thought.",reason:""};
 draft=await rpc("writer_save_working_draft",{resource_id:first,expected_version:0,base_revision:1,request_id:requestId,draft_values:values});
 assert.equal(draft.version,1);assert.deepEqual(draft.values,values);
 assert.equal((await rpc("writer_get_working_draft",{resource_id:first})).requestId,requestId);
 const replay=await rpc("writer_save_working_draft",{resource_id:first,expected_version:0,base_revision:1,request_id:requestId,draft_values:values});
 assert.equal(replay.version,1);
 assert.deepEqual((await rpc("writer_get_resource",{resource_id:first})).resource,original.resource);
 pass("working drafts persist incomplete edits and request IDs without changing canonical content");
 await rpc("writer_save_working_draft",{resource_id:first,expected_version:0,base_revision:1,request_id:randomUUID(),draft_values:{title:"Stale tab"}},"40001");
 await rpc("writer_save_working_draft",{resource_id:first,expected_version:1,base_revision:1,request_id:requestId,draft_values:{title:"Changed retry"}},"40001");
 for(const payload of [{workspace_id:fixtures.other.workspaceId},{title:4},{body_text:"x".repeat(100001)}]) {
   await rpc("writer_save_working_draft",{resource_id:first,expected_version:1,base_revision:1,request_id:randomUUID(),draft_values:payload},"22023");
 }
 await rpc("writer_get_working_draft",{resource_id:first},"P0002",other.client);
 await rpc("writer_get_working_draft",{resource_id:first},"42501",reader.client);
 assert.equal((await post("/api/writing/drafts",{resourceId:first,expectedVersion:1,baseRevision:1,requestId:randomUUID(),values:{title:"Wrong"},tenantId:fixtures.other.workspaceId})).status,400);
 pass("draft concurrency, changed retries, tenant substitution, bad types and other-user reads fail closed");
 const next=await post("/api/writing/drafts",{resourceId:first,expectedVersion:1,baseRevision:1,requestId:randomUUID(),values:{title:"Saved in another tab",body_text:"Still private."}});
 assert.equal(next.status,200,JSON.stringify(next.body));assert.equal(next.body.version,2);
 await rpc("writer_clear_working_draft",{resource_id:first,expected_version:1},"40001");
 const cleared=await rpc("writer_clear_working_draft",{resource_id:first,expected_version:2});
 assert.equal(cleared.version,3);assert.equal(cleared.values,null);
 assert.equal((await rpc("writer_clear_working_draft",{resource_id:first,expected_version:2})).version,3);
 await rpc("writer_save_working_draft",{resource_id:first,expected_version:0,base_revision:1,request_id:randomUUID(),draft_values:{title:"Old tab recreated"}},"40001");
 const renewed=await rpc("writer_save_working_draft",{resource_id:first,expected_version:3,base_revision:1,request_id:randomUUID(),draft_values:{title:"Fresh draft"}});
 assert.equal(renewed.version,4);
 pass("explicit discard uses a tombstone: old tabs cannot erase or resurrect newer working drafts");
 const proposal=await rpc("writer_propose_revision",{resource_id:first,request_id:randomUUID(),base_revision:1,proposed_patch:{body_text:"An entirely new approved source text.",topics:["Hospitality"]},proposal_reason:"Synthetic index update",source_evidence:"Synthetic user-approved replacement"});
 await rpc("writer_decide_proposal",{proposal_id:proposal.proposalId,expected_revision:1,decision:"approve"});
 const changed=await rpc("writer_list_resources",{search_text:sentinel});
 assert.equal(changed.resources.some(r=>r.id===first),false);assert.equal(changed.resources.some(r=>r.id===copy),true);
 const after=await rpc("writer_find_connections",{resource_id:first});
 assert.equal(after.candidates.find(c=>c.id===copy)?.duplicate_signals.includes("same_text_ignoring_whitespace")??false,false);
 assert.equal((await rpc("writer_get_working_draft",{resource_id:first})).baseRevision,1);
 pass("approved edits refresh the private search index while preserving the stale draft for explicit comparison");
 const privileges=localSql("select has_table_privilege('authenticated','workspace_private.writing_working_drafts','select'),has_table_privilege('authenticated','workspace_private.writing_search_index','select'),has_function_privilege('anon','workspace.writer_save_working_draft(uuid,integer,integer,uuid,jsonb)','execute');");
 assert.equal(privileges,"f|f|f");
 pass("working drafts, content fingerprints and search vectors cannot be read directly");
 console.log(groups+" draft and discovery groups passed.");
} finally {
 if(reviewDisabled)localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='writer_editor' and capability_key='writer_resource_review';");
 for(const id of created){assert.match(id,/^[0-9a-f-]{36}$/);localSql("delete from workspace_private.writing_resources where id='"+id+"' and source_label='Synthetic library acceptance';");}
}
