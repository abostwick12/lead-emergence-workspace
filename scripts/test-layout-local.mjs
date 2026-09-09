import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {localConfiguration,localSql,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const all=await fixtureSession(config,fixtures.layoutAll),only=await fixtureSession(config,fixtures.layout),other=await fixtureSession(config,fixtures.layoutOther),reader=await fixtureSession(config,fixtures.reader);
let groups=0;
function pass(label){console.log("PASS "+label);groups++;}
async function rpc(session,name,body){const r=await session.client.rpc(name,body);assert.equal(r.error,null,JSON.stringify(r.error));return r.data;}
async function snapshot(session=all){return rpc(session,"get_workspace_layout");}
const empty={schemaVersion:"1.0",hiddenItemIds:[],pinnedNavigationIds:[],pinnedWidgetIds:[],orderOverrides:{},defaultWorkspaceRoute:"/workspace"};
async function save(session,p,base,id=randomUUID(),overrides={}){return session.client.rpc("save_workspace_layout",{preferences:p,expected_revision:base.revision,expected_authority_revision:base.authorityRevision,request_id:id,confirmed:true,...overrides});}
async function api(session,path,body){const r=await fetch(appUrl+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+session.token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),headers:r.headers};}
let base=await snapshot();const reset=await save(all,empty,base);assert.equal(reset.error,null,JSON.stringify(reset.error));base=reset.data;
assert.equal(base.revision, (await snapshot()).revision);assert.deepEqual(base.preferences,empty);
pass("confirmed save returns the committed revision and private empty layout");
const authority=await rpc(all,"get_bundle_experience");
assert.equal(authority.assignments.filter(x=>x.status==="active").length,6);
const catalogResponse=await api(all,"/api/bundles/layout");assert.equal(catalogResponse.status,200);
const catalog=catalogResponse.body.catalog;
assert.equal(catalog.navigation.length,5);assert.equal(catalog.widgets.length,6);
const dbCatalog=JSON.parse(localSql("select jsonb_agg(jsonb_build_object('id',identity,'route',route) order by identity) from workspace_private.layout_contributions"));
const uiCatalog=[...catalog.navigation,...catalog.widgets].map(x=>({id:x.sourceBundleKey+":"+x.id,route:x.route??null})).sort((a,b)=>a.id.localeCompare(b.id));
assert.deepEqual(uiCatalog,dbCatalog);
assert.match(catalogResponse.headers.get("cache-control"),/no-store/);pass("all six assigned through configuration; SQL and native customizable catalogs match");
const onlyCatalog=await api(only,"/api/bundles/layout");assert.equal(onlyCatalog.status,200);assert.equal(onlyCatalog.body.catalog.navigation.length,0);assert.equal(onlyCatalog.body.catalog.widgets.length,1);
assert.equal((await api(reader,"/api/bundles/layout")).status,403);
assert.equal((await reader.client.rpc("get_workspace_layout")).error?.code,"42501");pass("Experience-only attention widget without functional navigation, and unassigned API/RPC denial");
const writerNav="writer_editor:writer.nav.writing",writerWidget="writer_editor:writer.widget.publication_queue";
const choices={...empty,hiddenItemIds:[writerNav],pinnedWidgetIds:[writerWidget],pinnedNavigationIds:["investor:investor.nav.home"],orderOverrides:{[writerWidget]:20},defaultWorkspaceRoute:"/workspace/writing"};
const otherBefore=await snapshot(other), request=randomUUID();
const result=await save(all,choices,base,request);assert.equal(result.error,null,JSON.stringify(result.error));
assert.equal(result.data.revision,base.revision+1);assert.deepEqual((await snapshot(other)),otherBefore);
assert.equal((await rpc(all,"get_bundle_experience")).revision,authority.revision);pass("saved choices are owner-isolated and do not change authority/editor revision");
assert.equal((await save(all,choices,base,request)).data.revision,result.data.revision);
assert.equal((await save(all,choices,base,request,{expected_revision:base.revision+1})).error?.code,"40001");
assert.equal((await save(all,empty,base,request)).error?.code,"40001");
assert.equal((await save(all,empty,base)).error?.code,"40001");pass("exact retries succeed; changed, stale and different-base retries fail");
base=result.data;
for(const p of [
 {...empty,hiddenItemIds:[writerNav,writerNav]}, {...empty,hiddenItemIds:[writerNav],pinnedNavigationIds:[writerNav]},
 {...empty,workspaceId:fixtures.layoutOther.workspaceId},{...empty,defaultWorkspaceRoute:"https://example.invalid"},
 {...empty,pinnedWidgetIds:[writerNav]},{...empty,orderOverrides:{[writerNav]:-1}},
 {...empty,orderOverrides:{[writerNav]:1.2}},{...empty,hiddenItemIds:[null]},
 {...empty,hiddenItemIds:null},{...empty,defaultWorkspaceRoute:null},{...empty,schemaVersion:1},
 {...empty,hiddenItemIds:["workspace_experience:workspace.nav.home"]},
 {...empty,orderOverrides:{["a".repeat(65000)]:1}}
])assert.equal((await save(all,p,base)).error?.code,"22023");
assert.equal((await save(all,empty,base,randomUUID(),{confirmed:false})).error?.code,"22023");
assert.equal((await save(all,empty,base,randomUUID(),{expected_authority_revision:"stale"})).error?.code,"40001");
pass("strict SQL independently rejects malformed, injected, oversized and unconfirmed choices");
const onlyBase=await snapshot(only);
assert.equal((await save(only,{...empty,hiddenItemIds:[writerNav]},onlyBase)).error?.code,"42501");
assert.equal((await save(only,{...empty,defaultWorkspaceRoute:"/workspace/writing"},onlyBase)).error?.code,"42501");
pass("forged bundle identities and defaults never grant access");
const both=await Promise.all([save(all,empty,base),save(all,empty,base)]);
assert.equal(both.filter(x=>!x.error).length,1);assert.equal(both.filter(x=>x.error?.code==="40001").length,1);
assert.equal((await save(all,choices,result.data,request)).error?.code,"40001");
pass("concurrent saves serialize and superseded requests cannot roll back newer preferences");
base=await snapshot();assert.equal((await save(all,choices,base)).error,null);base=await snapshot();
const entitlement=fixtures.layoutAll.entitlements.writer_editor;
try {
 localSql("update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional layout acceptance' where id='"+entitlement+"' and workspace_id='"+fixtures.layoutAll.workspaceId+"' and revoked_at is null");
 assert.equal((await save(all,choices,base)).error?.code,"40001");
 const revoked=await snapshot();assert.deepEqual(revoked.preferences,choices);
 const experience=await api(all,"/api/bundles/experience");assert.equal(experience.status,200);
 assert.equal(experience.body.ui.defaultWorkspaceRoute,"/workspace");assert.equal(experience.body.layout.defaultUnavailable,true);
 assert.equal(experience.body.capabilityIds.includes("writer.resource.library"),false);
 assert.equal(experience.body.ui.dashboardWidgets.some(x=>x.id===writerWidget.split(":")[1]),false);
 assert.equal((await save(all,{...choices,orderOverrides:{[writerWidget]:99}},revoked)).error?.code,"42501");
 const retained=await save(all,choices,revoked);assert.equal(retained.error,null);
 const removed=await save(all,{...choices,pinnedWidgetIds:[]},retained.data);assert.equal(removed.error,null);
 pass("revocation retains dormant choices, removes unavailable UI, rejects new dormant edits and permits removal");
}finally {localSql("update workspace.bundle_entitlements set revoked_at=null,revocation_reason=null where id='"+entitlement+"' and workspace_id='"+fixtures.layoutAll.workspaceId+"'");}
base=await snapshot();assert.equal((await save(all,choices,base)).error,null);
const restored=await api(all,"/api/bundles/experience");assert.equal(restored.body.ui.defaultWorkspaceRoute,"/workspace/writing");assert.equal(restored.body.ui.primaryNavigation.some(x=>x.id==="writer.nav.writing"),false);
pass("regrant restores a valid default without discarding a deliberately hidden navigation choice");
const nativeDenied=localSql("begin; set local search_path=workspace,extensions,public; select no_plan(); set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\""+fixtures.layoutAll.id+"\",\"role\":\"authenticated\",\"client_id\":\"fictional-layout-hostile-test\"}',true); select throws_ok('select workspace.get_workspace_layout()','42501','Use the native Workspace to manage layout.','connected-client layout read denied'); select throws_ok('select workspace.save_workspace_layout(null,0,null,null,true)','42501','Use the native Workspace to manage layout.','connected-client layout write denied'); select * from finish(); rollback;");
assert.doesNotMatch(nativeDenied,/not ok/);assert.equal([...nativeDenied.matchAll(/ok \d+/g)].length,2);pass("connected-client claims cannot read or mutate native layout preferences");
base=await snapshot();const invalid=await api(all,"/api/bundles/layout",{preferences:empty,expectedRevision:base.revision,expectedAuthorityRevision:base.authorityRevision,requestId:randomUUID(),confirmed:false});assert.equal(invalid.status,400);
const httpSaved=await api(all,"/api/bundles/layout",{preferences:empty,expectedRevision:base.revision,expectedAuthorityRevision:base.authorityRevision,requestId:randomUUID(),confirmed:true});assert.equal(httpSaved.status,200,JSON.stringify(httpSaved.body));assert.deepEqual((await snapshot()).preferences,empty);
assert.ok(httpSaved.body.record.history.some(x=>x.preferences.defaultWorkspaceRoute==="/workspace/writing"));
pass("native HTTP confirmation and version recovery history match actual persisted records");
console.log("Workspace layout local acceptance: "+groups+" groups. Real loopback HTTP and authenticated SQL/RPC; fictional records only.");
