import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {localConfiguration,localSql,fixtureSession,appUrl} from "./bundle-local-runtime.mjs";
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8")),seed=JSON.parse(await readFile(".bundle-local/search-fixtures.json","utf8"));
await writeFile(".bundle-local/public-config.json",JSON.stringify({url:config.API_URL,anonKey:config.ANON_KEY}));
const all=await fixtureSession(config,f.layoutAll),only=await fixtureSession(config,f.layout),reader=await fixtureSession(config,f.reader);
let groups=0;const pass=label=>{console.log("PASS "+label);groups++;};
async function api(session,body){const r=await fetch(appUrl+"/api/bundles/search",{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+session.token,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json(),headers:r.headers};}
let catalog=(await api(all)).body;
assert.equal(catalog.providerIds.length,16);assert.equal(catalog.workspaceId,f.layoutAll.workspaceId);
const dbCatalog=JSON.parse(localSql("select jsonb_agg(jsonb_build_object('id',id,'capabilityIds',capability_ids) order by id) from workspace_private.search_providers"));
assert.equal(dbCatalog.length,16);
assert.equal((await api(only)).body.providerIds.length,0);
assert.equal((await api(reader)).status,403);assert.equal((await reader.client.rpc("search_saved_work_catalog")).error?.code,"42501");
pass("all-six catalog, Experience-only empty state, unassigned HTTP and RPC denial");
const input=(overrides={})=>({query:"Cedar Harbor",providerIds:catalog.providerIds,authorityRevision:catalog.authorityRevision,offset:0,...overrides});
let first=await api(all,input());assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.matchingCount,47);assert.equal(first.body.results.length,25);
assert.equal(first.body.results[0].title,"Cedar Harbor");assert.equal(first.body.results[0].matchReason,"exact_title");assert.match(first.headers.get("cache-control"),/no-store/);
const second=await api(all,input({offset:25}));assert.equal(second.body.results.length,22);
const results=[...first.body.results,...second.body.results];assert.equal(new Set(results.map(r=>r.id)).size,47);
assert.deepEqual(results.map(r=>r.id).sort(),seed.records.map(r=>r.id).sort());
assert.equal(first.body.coverage.reduce((n,c)=>n+c.matchingCount,0),47);
assert.equal(results.some(r=>r.id===seed.isolated),false);
pass("ranked complete two-page retrieval, truthful counts and zero cross-owner results");
for(const providerId of catalog.providerIds){
 const r=await api(all,input({providerIds:[providerId]}));assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.coverage.length,1);assert.ok(r.body.results.every(x=>x.providerId===providerId));assert.ok(r.body.matchingCount>0);
}
pass("every one of 16 scopes searches its actual saved corpus independently");
const body=await api(all,input({query:"bodyonlyneedle",providerIds:["writer.search.resources"]}));
assert.equal(body.body.matchingCount,32);assert.ok(body.body.results.every(r=>r.matchReason==="saved_text"));
assert.equal((await api(all,input({query:"otherownerneedle"}))).body.matchingCount,0);
assert.equal((await api(all,input({query:"clearlynotpresent77889"}))).body.matchingCount,0);
pass("body-text discovery and honest no-match results without foreign text");
for(const patch of [{query:"a"},{query:"x".repeat(201)},{providerIds:[]},{providerIds:["ministry.search.profile"]},{providerIds:["writer.search.resources","writer.search.resources"]},{workspaceId:f.layoutOther.workspaceId},{offset:1},{offset:10025}]){
 assert.equal((await api(all,input(patch))).status,400);
}
assert.equal((await api(all,input({authorityRevision:"stale"}))).status,409);
assert.equal((await api(all,input({query:"x".repeat(9000)}))).status,400);
const unsigned=await fetch(appUrl+"/api/bundles/search");assert.equal(unsigned.status,401);
pass("strict bounded HTTP, forged identities, bad scopes, malformed paging and stale authority");
const params={p_query:"Cedar Harbor",p_provider_ids:catalog.providerIds,p_authority_revision:catalog.authorityRevision,p_offset:0};
for(const patch of [{p_query:null},{p_query:"a"},{p_provider_ids:[]},{p_provider_ids:[null]},{p_provider_ids:["writer.search.resources","writer.search.resources"]},{p_provider_ids:[["writer.search.resources"]]},{p_offset:1},{p_offset:10025}]){
 assert.equal((await all.client.rpc("search_saved_work",{...params,...patch})).error?.code,"22023");
}
assert.equal((await all.client.rpc("search_saved_work",{...params,p_provider_ids:["ministry.search.profile"]})).error?.code,"42501");
pass("SQL independently rejects invalid direct calls and private-profile forgery");
const entitlement=f.layoutAll.entitlements.writer_editor;
try{
 localSql("update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P11 search acceptance' where id='"+entitlement+"' and workspace_id='"+f.layoutAll.workspaceId+"'");
 assert.equal((await api(all,input({offset:25}))).status,409);
 catalog=(await api(all)).body;assert.equal(catalog.providerIds.includes("writer.search.resources"),false);
 assert.equal((await api(all,input({providerIds:["writer.search.resources"]}))).status,403);
 assert.equal((await api(all,input())).body.matchingCount,15);
 pass("mid-pagination revocation changes authority and removes Writer search without partial leakage");
}finally{localSql("update workspace.bundle_entitlements set revoked_at=null,revocation_reason=null where id='"+entitlement+"' and workspace_id='"+f.layoutAll.workspaceId+"'");}
catalog=(await api(all)).body;assert.equal(catalog.providerIds.length,16);
const signatures=["workspace.search_saved_work_catalog()","workspace.search_saved_work(text,text[],text,integer)"];
for(const signature of signatures)assert.equal(localSql("select has_function_privilege('anon','"+signature+"','execute')"),"f");
pass("access restoration and anonymous RPC privilege denial");
console.log("Native saved-work local acceptance: "+groups+" groups passed.");
