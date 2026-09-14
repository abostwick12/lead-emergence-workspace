import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../",import.meta.url)).replaceAll("\\","/").replace(/\/$/,"");
mkdirSync(join(root,".sotf-local"),{ recursive:true });
const evidencePath = process.env.SOTF_ORDERING_EVIDENCE_PATH ?? join(root,".sotf-local","canonical-ordering-evidence.json");
const docker = process.env.SOTF_DOCKER ?? (process.platform === "win32"
  ? join(homedir(),"AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe") : "docker");
const sql = query => execFileSync(docker,[
  "exec","-i","supabase_db_lead-emergence-workspace-local","psql","-X","-v","ON_ERROR_STOP=1",
  "-U","postgres","-d","postgres","-Atq"
],{ input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"] }).trim();
const quote = value => "'" + String(value).replaceAll("'","''") + "'";
const json = value => quote(JSON.stringify(value)) + "::jsonb";
const load = path => import(pathToFileURL(root + "/node_modules/" + path).href);
const { createClient } = await load("@supabase/supabase-js/dist/index.mjs");
const { createServer } = await load("vite/dist/node/index.js");
const { McpServer } = await load("@modelcontextprotocol/sdk/dist/esm/server/mcp.js");
const { Client } = await load("@modelcontextprotocol/sdk/dist/esm/client/index.js");
const { InMemoryTransport } = await load("@modelcontextprotocol/sdk/dist/esm/inMemory.js");

const status = JSON.parse(execFileSync(process.platform === "win32" ? join(homedir(),"scoop/shims/supabase.exe") : "supabase",
  ["status","--output","json"],{ cwd:root,encoding:"utf8",stdio:["pipe","pipe","pipe"] }));
assert.equal(status.API_URL,"http://127.0.0.1:56421");
assert.equal(status.linked_project ?? null,null);

const user = "79111111-1111-4111-8111-111111111111";
const workspace = "79aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientId = "79cccccc-cccc-4ccc-8ccc-cccccccccccc";
const resource = "https://workspace.leademergence.com/api/mcp";
const surfaces = [
  "workspace_private.sotf_daily_brief_outcomes","workspace_private.sotf_operation_events",
  "workspace_private.sotf_operation_heads","workspace_private.sotf_workflow_access_audit",
  "workspace.bundle_entitlements","workspace.mcp_authorizations","workspace_private.mcp_oauth_resource_grants"
];
const corpus = JSON.parse(readFileSync(join(root,"supabase/tests/database/sotf_v1_canonical_ordering_parity.sql"),"utf8").split("$ordering$")[1]);
assert(corpus.length >= 20);

function bearer() {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = encode({ alg:"HS256",typ:"JWT" }) + "." + encode({
    sub:user,role:"authenticated",aud:resource,client_id:clientId,workspace_mcp:"true",
    iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600
  });
  return unsigned + "." + createHmac("sha256",status.JWT_SECRET).update(unsigned).digest("base64url");
}
const db = createClient(status.API_URL,status.ANON_KEY,{
  db:{ schema:"workspace" },
  global:{ fetch:(input,init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assert.equal(new URL(url).origin,status.API_URL,"ordering runner must remain on loopback");
    const headers = new Headers(init?.headers);
    headers.set("Authorization","Bearer " + bearer());
    return fetch(input,{ ...init,headers });
  }},
  auth:{ persistSession:false,autoRefreshToken:false }
});
const snapshot = () => JSON.parse(sql("select jsonb_build_object(" + surfaces.map(table =>
  quote(table) + `,(select jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(row_to_json(r)::text,'|' order by row_to_json(r)::text),''))) from ${table} r)`
).join(",") + ")"));
const claims = JSON.stringify({ sub:user,role:"authenticated",aud:resource,client_id:clientId,workspace_mcp:"true" });
const date = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const input = { workflow_id:"transition.daily_brief",workflow_version:"1.0.0",brief_date:date,time_zone:"America/Chicago" };
const semantics = () => JSON.parse(sql(`begin;set local request.jwt.claims=${quote(claims)};
  select workspace_private.sotf_v1_daily_brief_projection_semantics('${workspace}',${quote(date)}::date,'America/Chicago');rollback;`));
const report = {
  head:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),
  started:new Date().toISOString(),canonicalRule:"unsigned UTF-8 byte lexicographic order; decoded strings; no normalization",
  corpusCases:corpus.length,results:[],application:{accept:0,deny:0},rpc:{accept:0,deny:0},failure:null
};
const connections = [];
let loader,realHost,applicationHost,store,revision=0,authorityToken="sha256:"+"0".repeat(64),applicationWrites=0,initialized=false;
const content = result => result.structuredContent;
async function call(host,name,args={}) {
  try { return await host.callTool({name,arguments:args}); }
  catch (error) { return {isError:true,transportError:error.message}; }
}
async function connect(client) {
  const server = new McpServer({name:"canonical-ordering-parity",version:"1"});
  const { registerSotfV1Tools } = await loader.ssrLoadModule(root + "/lib/sotf/v1-mcp.ts");
  registerSotfV1Tools(server,client,{releaseEnabled:true});
  const host = new Client({name:"synthetic-host",version:"1"});
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await host.connect(clientTransport);
  connections.push(server,host);
  return host;
}
async function append(command) {
  const result = await store.execute({requestId:randomUUID(),expectedRevision:revision,userConfirmed:true,dataClass:"ordinary_transition_operations",command});
  revision = result.state.revision;
}
const hypothesis = (id,statusValue="continue") => ({
  type:"save_hypothesis",hypothesis:{id,proposition:"Synthetic " + id,whyPromising:"It is testable",
    assumptions:[],gaps:[],nextExperiment:"Run a synthetic test",reviewTrigger:"After the test",
    status:statusValue,confidenceExplanation:"Still provisional"}
});
const candidate = (reference,truncated) => ({
  schema_version:"1",request_id:randomUUID(),run_id:randomUUID(),...input,expected_state_revision:revision,
  expected_authority_token:authorityToken,
  host:"chatgpt",execution_mode:"A",data_class:"ordinary_transition_operations",user_confirmed:true,
  status:"degraded",connector_results:{calendar_read:"not_requested",email_read:"not_requested"},
  degradation_reasons:truncated ? ["state_truncated"] : [],
  selected_le_refs:[{entity_type:"hypothesis",entity_id:reference}],priority_count:1,usefulness:"not_rated",
  provenance:{source:"host_reported_user_confirmed",provider_content_persisted:false}
});
async function isolatedApplicationDecision(payload) {
  const before = snapshot(),callsBefore = applicationWrites;
  await call(applicationHost,"sotf_record_daily_brief_outcome",payload);
  const accepted = applicationWrites === callsBefore + 1;
  assert.deepEqual(snapshot(),before,"isolated application validator must not mutate durable state");
  report.application[accepted ? "accept" : "deny"]++;
  return accepted;
}
async function actualDeny(label,payload) {
  const before = snapshot();
  const handler = await call(realHost,"sotf_record_daily_brief_outcome",payload);
  assert.notEqual(content(handler)?.status,"ok",label + " handler must deny");
  assert.deepEqual(snapshot(),before,label + " handler denial must have no side effect");
  const {expected_authority_token,...storedOutcome} = payload;
  const rpc = await db.rpc("sotf_v1_record_daily_brief_outcome",{outcome:storedOutcome,p_expected_authority_token:expected_authority_token});
  assert(rpc.error,label + " authenticated RPC must deny");
  assert.equal(rpc.error.code,"22023");
  assert.deepEqual(snapshot(),before,label + " RPC denial must have no side effect");
  report.rpc.deny++;
}
async function actualAccept(label,payload) {
  const before = snapshot();
  const handler = await call(realHost,"sotf_record_daily_brief_outcome",payload);
  assert.equal(content(handler)?.status,"ok",label + " handler must accept");
  assert.equal(content(handler)?.data?.saved,true);
  const after = snapshot();
  assert.equal(after[surfaces[0]].count,before[surfaces[0]].count+1,label + " persists exactly one outcome");
  for (const table of surfaces.slice(1)) assert.deepEqual(after[table],before[table],label + " does not alter " + table);
  const {expected_authority_token,...storedOutcome} = payload;
  const rpc = await db.rpc("sotf_v1_record_daily_brief_outcome",{outcome:storedOutcome,p_expected_authority_token:expected_authority_token});
  assert.ifError(rpc.error);
  assert.equal(rpc.data?.saved,true);
  assert.equal(rpc.data?.replayed,true);
  assert.deepEqual(rpc.data?.receipt,content(handler).data.receipt,label + " exact retry returns same receipt");
  assert.deepEqual(snapshot(),after,label + " exact retry has no side effect");
  report.rpc.accept++;
}

const savedSettings = JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')"));
try {
  assert.equal(sql("select count(*) from auth.users"),"0");
  sql(`
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000','${user}','authenticated','authenticated','sotf.ordering.local@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
    insert into workspace.user_profiles(user_id,display_name) values ('${user}','Synthetic ordering parity');
    insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('${workspace}','personal','Synthetic ordering parity','${user}');
    insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('${workspace}','${user}','owner','active');
    insert into workspace.personal_plans(workspace_id,user_id,plan_key) values ('${workspace}','${user}','personal');
    insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference)
      values ('${workspace}','sotf_transition','${user}','promotion','synthetic-ordering-parity');
    insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by)
      values ('${workspace}','${clientId}','chatgpt','connected',now(),'${user}');
    update workspace_private.product_settings set setting_value='true'
      where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
    update workspace_private.product_settings set setting_value='${resource}' where setting_key='mcp_resource_uri';
    insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
      values ('${user}','${clientId}','${resource}',array['openid','email','profile']);`);
  initialized = true;
  process.env.SOTF_PILOT_ENABLED = "true";
  loader = await createServer({configFile:false,root,server:{middlewareMode:true},resolve:{alias:[
    {find:"server-only",replacement:root+"/tests/harness/session.ts"},{find:"@",replacement:root}
  ]}});
  const { createSotfStore } = await loader.ssrLoadModule(root + "/lib/sotf/server.ts");
  store = createSotfStore(db);
  realHost = await connect(db);
  applicationHost = await connect({rpc:async(name,args) => {
    if (name === "sotf_v1_probe_daily_brief_outcome") return {data:{state:"new"},error:null};
    if (name === "sotf_v1_record_daily_brief_outcome") {
      applicationWrites++;
      return {data:null,error:{code:"local_test_sentinel",message:"write intentionally suppressed"}};
    }
    return db.rpc(name,args);
  }});
  await append({type:"start_transition",timing:"Synthetic",question:"Which direction?",weeklyHours:8,criteria:[],hypotheses:[]});

  let previous = [];
  for (let index=0;index<corpus.length;index++) {
    const row = corpus[index],source = index % 2 ? [...row.ids].reverse() : row.ids;
    for (const id of previous) await append(hypothesis(id,"pause"));
    for (const id of source) await append(hypothesis(id));
    previous = [...row.ids];

    const fullSql = JSON.parse(sql(`select coalesce(jsonb_agg(value order by workspace_private.sotf_v1_order_key(value)),'[]'::jsonb) from jsonb_array_elements_text(${json(row.ids)}) source(value)`));
    assert.deepEqual(fullSql,row.expected,row.id + " SQL full order");
    const projected = content(await call(realHost,"sotf_get_daily_brief_state",input));
    assert.equal(projected.status,"ok");
    authorityToken = projected.data.authority.authority_token;
    const projection = projected.data.projection;
    const derived = semantics();
    const expectedBounded = row.expected.slice(0,3),expectedOmitted = row.expected.slice(3);
    assert.deepEqual(projection.hypotheses.map(item => item.id),expectedBounded,row.id + " handler membership");
    const eligible = derived.eligible_refs.filter(ref => ref.entity_type === "hypothesis").map(ref => ref.entity_id);
    assert.deepEqual(eligible,expectedBounded,row.id + " SQL membership");
    assert.equal(projection.omitted_counts.hypotheses,expectedOmitted.length,row.id + " handler omitted count");
    const truncated = row.expected.length > 3;
    assert.equal(projection.truncated_sections.includes("hypotheses"),truncated,row.id + " handler truncation");
    assert.equal(derived.truncated_sections.includes("hypotheses"),truncated,row.id + " SQL truncation");
    assert.deepEqual(eligible,expectedBounded,row.id + " governed eligible membership");

    const inside = candidate(expectedBounded[0],truncated);
    assert.equal(await isolatedApplicationDecision(inside),true,row.id + " application accepts included ref");
    await actualAccept(row.id + " included ref",inside);
    const refreshed = content(await call(realHost,"sotf_get_daily_brief_state",input));
    assert.equal(refreshed.status,"ok",row.id + " authority refresh after accepted outcome");
    authorityToken = refreshed.data.authority.authority_token;
    const outsideId = expectedOmitted[0] ?? "not-present-" + row.id;
    const outside = candidate(outsideId,truncated);
    assert.equal(await isolatedApplicationDecision(outside),false,row.id + " application denies omitted ref");
    await actualDeny(row.id + " omitted ref",outside);
    report.results.push({
      id:row.id,description:row.description,sourceOrder:source,expectedFull:row.expected,
      handlerProjected:projection.hypotheses.map(item => item.id),rpcEligible:eligible,
      omitted:expectedOmitted,truncated,inside:{id:expectedBounded[0],result:"ACCEPT / ACCEPT"},
      outside:{id:outsideId,result:"DENY / DENY"},insertionOrder:index % 2 ? "reverse" : "listed"
    });
    console.log("PASS " + row.id + " " + row.description);
  }
  assert.equal(report.application.accept,corpus.length);
  assert.equal(report.application.deny,corpus.length);
  assert.equal(report.rpc.accept,corpus.length);
  assert.equal(report.rpc.deny,corpus.length);
  report.completed = new Date().toISOString();
} catch (error) {
  report.failure = {message:error.message,stack:error.stack};
  throw error;
} finally {
  for (const connection of connections.reverse()) await connection.close().catch(()=>{});
  if (loader) await loader.close();
  if (initialized) sql(`
    delete from workspace_private.sotf_daily_brief_outcomes where workspace_id='${workspace}';
    delete from workspace_private.sotf_workflow_access_audit where workspace_id='${workspace}';
    delete from workspace_private.sotf_operation_events where workspace_id='${workspace}';
    delete from workspace_private.sotf_operation_heads where workspace_id='${workspace}';
    delete from workspace_private.mcp_oauth_resource_grants where user_id='${user}';
    delete from workspace.mcp_authorizations where workspace_id='${workspace}';
    delete from workspace.bundle_entitlements where workspace_id='${workspace}';
    delete from workspace.personal_plans where workspace_id='${workspace}';
    delete from workspace.workspace_memberships where workspace_id='${workspace}';
    delete from workspace.workspaces where id='${workspace}';
    delete from workspace.user_profiles where user_id='${user}';
    delete from auth.users where id='${user}';
    update workspace_private.product_settings as setting set setting_value=saved.value
    from jsonb_each_text(${json(savedSettings)}) saved where setting.setting_key=saved.key;`);
  report.cleanup = {
    users:Number(sql("select count(*) from auth.users")),
    workspaces:Number(sql("select count(*) from workspace.workspaces")),
    outcomes:Number(sql("select count(*) from workspace_private.sotf_daily_brief_outcomes")),
    events:Number(sql("select count(*) from workspace_private.sotf_operation_events")),
    audits:Number(sql("select count(*) from workspace_private.sotf_workflow_access_audit")),
    settingsRestored:JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')"))
  };
  writeFileSync(evidencePath,JSON.stringify(report,null,2));
}
console.log(JSON.stringify({cases:report.corpusCases,application:report.application,rpc:report.rpc,cleanup:report.cleanup,evidencePath},null,2));
