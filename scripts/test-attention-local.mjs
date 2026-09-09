import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {localConfiguration,localSql,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const all=await fixtureSession(config,f.layoutAll),only=await fixtureSession(config,f.layout),other=await fixtureSession(config,f.layoutOther),reader=await fixtureSession(config,f.reader);
let groups=0;const pass=label=>{groups++;console.log("PASS "+label);};
async function api(s,input,path=""){const r=await fetch(appUrl+"/api/bundles/attention"+path,{method:input===undefined?"GET":"POST",headers:{Authorization:"Bearer "+s.token,"Content-Type":"application/json"},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,body:await r.json(),headers:r.headers};}
let catalog=(await api(all)).body;
assert.equal(catalog.scopes.length,22);assert.equal(catalog.workspaceId,f.layoutAll.workspaceId);
assert.deepEqual((await api(only)).body.scopes,[]);assert.deepEqual((await api(other)).body.scopes,[]);
assert.equal((await api(reader)).status,403);assert.equal((await reader.client.rpc("native_attention_catalog")).error?.code,"42501");
pass("native assigned scopes, Experience-only empty coverage and unassigned denial");
const input=(patch={})=>({asOfDate:"2026-09-09",authorityRevision:catalog.authorityRevision,bundleKey:null,priority:null,offset:0,...patch});
const first=await api(all,input());assert.equal(first.status,200,JSON.stringify(first.body));assert.ok(first.body.total>15000);
assert.equal(first.body.items.length,25);assert.equal(first.body.total,first.body.overallTotal);assert.match(first.headers.get("cache-control"),/no-store/);
assert.equal(first.body.groups.reduce((n,g)=>n+g.total,0),first.body.total);
assert.equal(first.body.coverage.reduce((n,c)=>n+c.total,0),first.body.total);
const second=await api(all,input({offset:25}));assert.equal(second.status,200);
assert.equal(new Set([...first.body.items,...second.body.items].map(x=>x.id)).size,50);
for(const offset of [10025,15000]){const r=await api(all,input({offset}));assert.equal(r.status,200);assert.equal(r.body.items.length,25);}
pass("complete large-corpus counts, distinct pages and retrieval beyond 10,025 cues");
for(const bundleKey of ["writer_editor","ministry","nonprofit_founder","investor","executive"]){
 const r=await api(all,input({bundleKey}));assert.equal(r.status,200);assert.ok(r.body.total>0);
 assert.equal(r.body.total,first.body.groups.filter(g=>g.bundleKey===bundleKey).reduce((n,g)=>n+g.total,0));
 assert.equal(r.body.overallTotal,first.body.overallTotal);
}
for(const priority of ["high","normal","low"]){const r=await api(all,input({priority}));assert.equal(r.status,200);assert.ok(r.body.items.every(i=>i.priority===priority));}
pass("all five source filters and all priority filters use complete server-side groups");
for(const patch of [{asOfDate:"2026-02-30"},{asOfDate:"9999-12-25"},{offset:1},{offset:-25},{offset:2147483025},{workspaceId:f.layoutOther.workspaceId},{priority:"urgent"},{bundleKey:"private_profile"}])
 assert.equal((await api(all,input(patch))).status,400);
assert.equal((await api(all,input({authorityRevision:"stale"}))).status,409);
assert.equal((await api(all,{...input(),padding:"x".repeat(5000)})).status,400);
assert.equal((await api(all,undefined,"?owner=forged")).status,400);
assert.equal((await fetch(appUrl+"/api/bundles/attention")).status,401);
pass("strict HTTP identity, size, date, filter, page and stale-authority rejection");
const params={p_as_of_date:"2026-09-09",p_authority_revision:catalog.authorityRevision};
for(const patch of [{p_as_of_date:null},{p_offset:null},{p_offset:1},{p_offset:2147483025},{p_bundle_key:"profile"},{p_priority:"urgent"},{p_authority_revision:null}])
 assert.equal((await all.client.rpc("native_attention",{...params,...patch})).error?.code,"22023");
assert.equal((await only.client.rpc("native_attention",{p_as_of_date:"2026-09-09",p_authority_revision:(await api(only)).body.authorityRevision,p_bundle_key:"writer_editor"})).error?.code,"42501");
pass("database independently enforces malformed-call and unavailable-scope boundaries");
for(const bundle of ["executive","writer_editor"]){
 const id=f.layoutAll.entitlements[bundle];assert.match(id,/^[0-9a-f-]{36}$/);
 try{
  localSql("update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P12 attention acceptance' where id='"+id+"' and workspace_id='"+f.layoutAll.workspaceId+"'");
  assert.equal((await api(all,input())).status,409);catalog=(await api(all)).body;
  assert.equal(catalog.scopes.length,bundle==="executive"?16:21);
  assert.equal((await api(all,input({bundleKey:bundle}))).status,403);
  const r=await api(all,input());assert.equal(r.status,200);assert.ok(r.body.items.every(i=>!i.source.capabilityId.startsWith(bundle==="executive"?"executive.":"writer.")));
  if(bundle==="executive")assert.ok(r.body.coverage.some(c=>c.capabilityId==="writer.resource.library"));
 }finally{localSql("update workspace.bundle_entitlements set revoked_at=null,revocation_reason=null where id='"+id+"' and workspace_id='"+f.layoutAll.workspaceId+"'");catalog=(await api(all)).body;}
}
assert.equal(catalog.scopes.length,22);
assert.equal(Number(localSql("select coalesce(sum(cardinality(source_capabilities)+cardinality(task_capabilities)),0) from workspace_private.executive_source_permissions")),0);
pass("revocation and native use without Executive leave model-sharing permissions unchanged");
const layout=await all.client.rpc("get_workspace_layout");assert.equal(layout.error,null);
let current=layout.data;const identity="workspace_experience:workspace.widget.attention";
async function save(preferences){const r=await all.client.rpc("save_workspace_layout",{preferences,expected_revision:current.revision,expected_authority_revision:current.authorityRevision,request_id:randomUUID(),confirmed:true});assert.equal(r.error,null);current=r.data;}
try{
 await save({...layout.data.preferences,hiddenItemIds:[...layout.data.preferences.hiddenItemIds.filter(x=>x!==identity),identity],pinnedWidgetIds:layout.data.preferences.pinnedWidgetIds.filter(x=>x!==identity)});
 assert.ok(current.preferences.hiddenItemIds.includes(identity));
}finally{await save(layout.data.preferences);}
assert.deepEqual(current.preferences,layout.data.preferences);
pass("native attention widget uses confirmed layout persistence and restores prior choices");
const scopes=await api(other);assert.deepEqual(scopes.body.scopes,[]);
const foreign=await api(other,{asOfDate:"2026-09-09",authorityRevision:scopes.body.authorityRevision});assert.equal(foreign.body.total,0);assert.deepEqual(foreign.body.items,[]);
pass("another owner cannot see all-bundle records through a native empty scope");
const operator=await fixtureSession(config,f.operator);
const grant=await operator.client.rpc("issue_bundle_assignment",{target_workspace_id:f.layoutOther.workspaceId,target_bundle_key:"writer_editor",idempotency_key:"attention-owner-"+randomUUID(),target_expires_at:null});assert.equal(grant.error,null);
const grantId=grant.data.entitlement_id;assert.match(grantId,/^[0-9a-f-]{36}$/);
try{
 const oc=(await api(other)).body;assert.equal(oc.scopes.length,1);
 const own=await api(other,{asOfDate:"2026-09-09",authorityRevision:oc.authorityRevision});assert.equal(own.status,200);
 const expected=Number(localSql("select count(*) from workspace_private.writing_resources where workspace_id='"+f.layoutOther.workspaceId+"' and publication_state in ('draft','in_review','ready')"));assert.equal(own.body.total,expected);assert.ok(expected>=500);
 const allIds=new Set(localSql("select id from workspace_private.writing_resources where workspace_id='"+f.layoutAll.workspaceId+"'").split("\n"));
 assert.ok(allIds.size>12000,"Owner control set must contain individual record IDs.");
 assert.ok(own.body.items.every(i=>!allIds.has(i.source.documentId)));
 pass("two independently entitled owners receive only their own actual Writing records");
}finally{
 localSql("update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P12 owner test completed' where id='"+grantId+"' and workspace_id='"+f.layoutOther.workspaceId+"'");
}
console.log("Native attention acceptance: "+groups+" groups passed.");
