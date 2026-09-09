import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {appUrl,localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const writer=await fixtureSession(config,fixtures.writer),other=await fixtureSession(config,fixtures.other),reader=await fixtureSession(config,fixtures.reader);
const created=[];let groups=0,profileDisabled=false;
function pass(name){groups++;console.log("PASS "+name);}
async function rpc(name,args,code,client=writer.client){const r=await client.rpc(name,args);assert.equal(r.error?.code??null,code??null,JSON.stringify(r.error));return r.data;}
async function web(path,body,token=writer.token){
 const response=await fetch(appUrl+path,{method:body?"POST":"GET",headers:{...(token?{Authorization:"Bearer "+token}:{}),"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,headers:response.headers,body:await response.json()};
}
const original=await rpc("writer_get_profile"),originalOther=await rpc("writer_get_profile",{},null,other.client);
try {
 const firstId=randomUUID(),profile={voice_notes:"Synthetic direct, gentle voice.",editing_boundaries:"Do not invent a theological position.",topics:["Attention","Faith, hope"],themes:["Hospitality"]};
 const input={expected_revision:original.revision,request_id:firstId,profile_input:profile,confirm_preferences:true};
 let saved=await rpc("writer_save_profile",input);assert.equal(saved.revision,original.revision+1);assert.deepEqual(saved.profile,profile);assert.equal(saved.epistemicState,"confirmed");
 assert.equal((await rpc("writer_save_profile",input)).revision,saved.revision);
 assert.deepEqual((await rpc("writer_get_profile")).profile,profile);
 pass("client-confirmed preferences persist with provenance and identical retries do not create another revision");
 await rpc("writer_save_profile",{...input,request_id:randomUUID(),profile_input:{voice_notes:"Stale overwrite"}},"40001");
 await rpc("writer_save_profile",{...input,expected_revision:saved.revision,profile_input:{voice_notes:"Changed retry"}},"40001");
 for(const value of [{theology:"Inherited"},{workspace_id:fixtures.other.workspaceId},{epistemic_state:"confirmed"},{voice_notes:3},{topics:["Care","CARE"]},{themes:["x".repeat(241)]}])
  await rpc("writer_save_profile",{...input,expected_revision:saved.revision,request_id:randomUUID(),profile_input:value},"22023");
 await rpc("writer_save_profile",{...input,expected_revision:saved.revision,request_id:randomUUID(),confirm_preferences:false},"22023");
 await rpc("writer_get_profile",{},"42501",reader.client);
 const otherSaved=await rpc("writer_save_profile",{expected_revision:originalOther.revision,request_id:randomUUID(),profile_input:{voice_notes:"PRIVATE OTHER TENANT PROFILE"},confirm_preferences:true},null,other.client);
 assert.equal(otherSaved.profile.voice_notes,"PRIVATE OTHER TENANT PROFILE");assert.deepEqual((await rpc("writer_get_profile")).profile,profile);
 pass("profile writes reject stale tabs, changed retries, belief/tenant overrides and unconfirmed inputs; users retain separate profiles");
 const next=await web("/api/writing/profile",{expectedRevision:saved.revision,requestId:randomUUID(),profile:{...profile,voice_notes:"Synthetic revised voice."},confirmPreferences:true});
 assert.equal(next.status,200);saved=next.body;
 assert.match(next.headers.get("cache-control"),/no-store/);
 assert.equal((await web("/api/writing/profile?workspaceId="+fixtures.other.workspaceId)).status,400);
 assert.equal((await web("/api/writing/profile",null,null)).status,401);
 await rpc("writer_save_profile",input,"40001");
 const cleared=await rpc("writer_save_profile",{expected_revision:saved.revision,request_id:randomUUID(),profile_input:null,confirm_preferences:true});
 assert.equal(cleared.profile,null);assert.equal(cleared.epistemicState,"unset");
 const history=await rpc("writer_get_profile_history");assert.ok(history.revisions.some(r=>r.profile?.voice_notes===profile.voice_notes));
 assert.equal(history.revisions.some(r=>r.profile?.voice_notes==="PRIVATE OTHER TENANT PROFILE"),false);
 profileDisabled=true;localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='writer_editor' and capability_key='writer_profile';");
 await rpc("writer_get_profile",{},"42501");await rpc("writer_get_profile_history",{},"42501");
 localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='writer_editor' and capability_key='writer_profile';");profileDisabled=false;
 pass("native API enforces authentication, current confirmation state, private recovery history and independent profile capability removal");
 const imported=await rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title:"Synthetic publication acceptance",body_text:"Canonical public-facing source.",author:"Example",source_label:"Synthetic publication acceptance",metadata:{website_summary:"Canonical website summary.",seo_description:"Canonical description.",source_file:"PRIVATE_FILE_MARKER",provider_record_id:"PRIVATE_PROVIDER_MARKER"}}});
 const id=imported.resourceId;created.push(id);
 await rpc("writer_save_working_draft",{resource_id:id,expected_version:0,base_revision:1,request_id:randomUUID(),draft_values:{body_text:"PRIVATE_UNFINISHED_MARKER"}});
 await rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:1,proposed_patch:{body_text:"UNAPPROVED_PROPOSAL_MARKER"},proposal_reason:"Pending synthetic revision",source_evidence:"Fictional acceptance input"});
 const packet=await web("/api/writing/resources/"+id+"/publication?revision=1");assert.equal(packet.status,200);
 assert.equal(packet.body.content.bodyText,"Canonical public-facing source.");assert.equal(packet.body.pendingProposals,1);
 assert.equal(packet.body.checklist.filter(c=>c.status==="human_review").length,5);
 for(const marker of ["PRIVATE_FILE_MARKER","PRIVATE_PROVIDER_MARKER","PRIVATE_UNFINISHED_MARKER","UNAPPROVED_PROPOSAL_MARKER","PRIVATE OTHER TENANT PROFILE"])assert.equal(JSON.stringify(packet.body).includes(marker),false);
 assert.equal((await rpc("writer_get_resource",{resource_id:id})).resource.publication_state,"draft");
 pass("actual publication packet includes only the saved canonical revision, provenance and unresolved checks; private fields and proposals are excluded");
 await rpc("writer_publication_context",{resource_id:fixtures.foreignResourceId,expected_revision:1},"P0002");
 await rpc("writer_publication_context",{resource_id:randomUUID(),expected_revision:1},"P0002");
 await rpc("writer_publication_context",{resource_id:id,expected_revision:1},"42501",reader.client);
 assert.equal((await web("/api/writing/resources/"+id+"/publication?revision=0")).status,400);
 assert.equal((await web("/api/writing/resources/"+id+"/publication?revision=1&workspaceId="+fixtures.other.workspaceId)).status,400);
 assert.equal((await web("/api/writing/resources/"+id+"/publication?revision=1&revision=2")).status,400);
 const proposal=await rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:1,proposed_patch:{audience:"Volunteers"},proposal_reason:"Synthetic audience",source_evidence:"Synthetic source"});
 await rpc("writer_decide_proposal",{proposal_id:proposal.proposalId,expected_revision:1,decision:"approve"});
 assert.equal((await web("/api/writing/resources/"+id+"/publication?revision=1")).status,409);
 assert.equal((await web("/api/writing/resources/"+id+"/publication?revision=2")).body.content.audience,"Volunteers");
 pass("publication preparation rejects foreign or stale revisions and repeated/forged query fields without mutating the resource");
 assert.equal(localSql("select has_table_privilege('authenticated','workspace_private.writing_profiles','select'),has_table_privilege('authenticated','workspace_private.writing_profile_revisions','select'),has_function_privilege('anon','workspace.writer_save_profile(integer,uuid,jsonb,boolean)','execute');"),"f|f|f");
 pass("profiles and history have no direct table access or anonymous confirmation");
 console.log(groups+" profile and publication groups passed.");
} finally {
 if(profileDisabled)localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='writer_editor' and capability_key='writer_profile';");
 for(const [session,prior] of [[writer,original],[other,originalOther]]){
  const current=await rpc("writer_get_profile",{},null,session.client);
  await rpc("writer_save_profile",{expected_revision:current.revision,request_id:randomUUID(),profile_input:prior.profile,confirm_preferences:true},null,session.client);
 }
 for(const id of created){assert.match(id,/^[a-f0-9-]{36}$/);localSql("delete from workspace_private.writing_resources where id='"+id+"' and source_label='Synthetic publication acceptance';");}
}
