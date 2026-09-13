import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHmac, randomUUID} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {homedir} from 'node:os';

// Local-only regression runner. Refuse any non-loopback Supabase endpoint.
const root=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\\\','/').replace(/\/$/,'');
mkdirSync(join(root,'.sotf-local'),{recursive:true});
const output=process.env.SOTF_UNICODE_EVIDENCE_PATH ?? join(root,'.sotf-local','unicode-evidence.json');
const docker=process.env.SOTF_DOCKER ?? (process.platform==='win32' ? join(homedir(),'AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe') : 'docker');
const sql=q=>execFileSync(docker,['exec','-i','supabase_db_lead-emergence-workspace-local','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-Atq'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const json=x=>quote(JSON.stringify(x))+'::jsonb';
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
// Record HEAD without claiming uncommitted repair validation is a freeze.

const load=p=>import(pathToFileURL(root+'/node_modules/'+p).href);
const {createClient}=await load('@supabase/supabase-js/dist/index.mjs');
const {createServer}=await load('vite/dist/node/index.js');
const {McpServer}=await load('@modelcontextprotocol/sdk/dist/esm/server/mcp.js');
const {Client}=await load('@modelcontextprotocol/sdk/dist/esm/client/index.js');
const {InMemoryTransport}=await load('@modelcontextprotocol/sdk/dist/esm/inMemory.js');
const status=JSON.parse(execFileSync((process.platform==='win32' ? join(homedir(),'scoop/shims/supabase.exe') : 'supabase'),['status','--output','json'],{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:56421');
assert.equal(status.linked_project??null,null);
const ua='76111111-1111-4111-8111-111111111111',ub='76222222-2222-4222-8222-222222222222';
const wa='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wb='76bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ca='76cccccc-cccc-4ccc-8ccc-cccccccccccc',cb='76eeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
// Audience is an identifier only. Network calls are restricted to loopback.
const resource='https://workspace.leademergence.com/api/mcp';
function bearer(user,client){const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const unsigned=b({alg:'HS256',typ:'JWT'})+'.'+b({sub:user,role:'authenticated',aud:resource,client_id:client,workspace_mcp:'true',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});return unsigned+'.'+createHmac('sha256',status.JWT_SECRET).update(unsigned).digest('base64url');}
const db=(u,c)=>createClient(status.API_URL,status.ANON_KEY,{db:{schema:'workspace'},global:{fetch:(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  assert.equal(new URL(url).origin,status.API_URL,'test requests must remain on loopback');
  const headers=new Headers(init?.headers);
  headers.set('Authorization','Bearer '+bearer(u,c));
  return fetch(input,{...init,headers});
}},auth:{persistSession:false,autoRefreshToken:false}});
const adb=db(ua,ca), bdb=db(ub,cb);
const surfaces=['workspace_private.sotf_daily_brief_outcomes','workspace_private.sotf_operation_events','workspace_private.sotf_operation_heads','workspace_private.sotf_workflow_access_audit','workspace.bundle_entitlements','workspace.mcp_authorizations','workspace_private.mcp_oauth_resource_grants'];
function snapshot(){return JSON.parse(sql('select jsonb_build_object('+surfaces.map(t=>quote(t)+`,(select jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(row_to_json(r)::text,'|' order by row_to_json(r)::text),''))) from ${t} r)`).join(',')+')'));}
const summary=s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,v.count]));
const report={head,started:new Date().toISOString(),fixture:{ua,ub,wa,wb,ca,cb},checks:[],differential:[],failure:null,unicode:[],application:[]};
const savedSettings=JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')"));
const connections=[];
let loader, initialized=false, store, ac, bc, rev=0, authorityToken='sha256:'+ '0'.repeat(64), active='setup';
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const stateInput={workflow_id:'transition.daily_brief',workflow_version:'1.0.0',brief_date:date,time_zone:'America/Chicago'};
// Private read-only observer: bind the identical synthetic subject so the
// projection includes that subject's recent receipts, just as authenticated RPC does.
const projectionSemantics=()=>JSON.parse(sql(`begin;set local request.jwt.claims=${quote(JSON.stringify({sub:ua,role:'authenticated',client_id:ca,aud:resource,workspace_mcp:'true'}))};select workspace_private.sotf_v1_daily_brief_projection_semantics('${wa}',${quote(date)}::date,'America/Chicago');rollback;`));
const fresh=(v={})=>({schema_version:'1',request_id:randomUUID(),run_id:randomUUID(),...stateInput,expected_state_revision:rev,expected_authority_token:authorityToken,host:'chatgpt',execution_mode:'A',data_class:'ordinary_transition_operations',user_confirmed:true,status:'degraded',connector_results:{calendar_read:'not_requested',email_read:'not_requested'},degradation_reasons:[],selected_le_refs:[{entity_type:'commitment',entity_id:'independent-step'}],priority_count:1,usefulness:'not_rated',provenance:{source:'host_reported_user_confirmed',provider_content_persisted:false},...v});
async function call(host,name,args={}){try{return await host.callTool({name,arguments:args});}catch(e){return {isError:true,transportError:e.message};}}
const content=r=>r.structuredContent;
async function check(name,fn){active=name;await fn();report.checks.push({name,status:'PASS'});console.log('PASS '+name);}
async function append(command){const result=await store.execute({requestId:randomUUID(),expectedRevision:rev,userConfirmed:true,dataClass:'ordinary_transition_operations',command});rev=result.state.revision;return result;}
async function differential(label,candidate,expect='deny',host=ac,rpcClient=adb){
  if(expect!=='replay') {
    const authority=await rpcClient.rpc('sotf_v1_get_daily_brief_authority',{p_workflow_id:candidate.workflow_id,p_workflow_version:candidate.workflow_version,p_brief_date:candidate.brief_date,p_time_zone:candidate.time_zone});
    if(!authority.error&&authority.data?.authority_token) candidate.expected_authority_token=authority.data.authority_token;
  }
  const before=snapshot();
  const handler=await call(host,'sotf_record_daily_brief_outcome',candidate);
  const afterHandler=snapshot();
  const {expected_authority_token,...storedOutcome}=candidate;
  const rpc=await rpcClient.rpc('sotf_v1_record_daily_brief_outcome',{outcome:storedOutcome,p_expected_authority_token:expected_authority_token});
  const afterRpc=snapshot();
  const hAccepted=content(handler)?.status==='ok'&&content(handler)?.data?.saved===true;
  const rAccepted=rpc.data?.saved===true&&!rpc.error;
  const row={label,expected:expect,handler:hAccepted?'ACCEPT':'DENY',rpc:rAccepted?'ACCEPT':'DENY',handlerResponse:handler,rpcResponse:rpc,before,afterHandler,afterRpc};
  report.differential.push(row);
  assert(!handler.transportError || /-32602/.test(handler.transportError),label+' unexpected MCP transport failure');
  if(expect==='deny') {
    assert(rpc.error && ['22023','40001','42501','22P02','22P05','PGRST102'].includes(rpc.error.code),
      label+' denial must be a contract/authority/input rejection, not an expired JWT or unavailable service: '+JSON.stringify(rpc.error));
  }
  if(!hAccepted&&rAccepted){report.failure={type:'IMPLEMENTATION_DEFECT',label,candidate,...row};throw new Error('Handler DENY / authenticated RPC ACCEPT: '+label);}
  if(expect==='deny'){
    if(hAccepted||rAccepted||JSON.stringify(before)!==JSON.stringify(afterHandler)||JSON.stringify(before)!==JSON.stringify(afterRpc)){
      report.failure={type:'IMPLEMENTATION_DEFECT',label,candidate,...row};throw new Error('Required denial/no-side-effect failed: '+label);
    }
  }else{
    assert(hAccepted&&rAccepted,label+' expected valid result on both paths');
    assert.deepEqual(content(handler).data.receipt,rpc.data.receipt);
    assert.equal(rpc.data.replayed,true);
    if(expect==='replay')assert.deepEqual(afterRpc,before);
    else {
      assert.equal(afterHandler[surfaces[0]].count,before[surfaces[0]].count+1);
      for(const t of surfaces.slice(1))assert.deepEqual(afterHandler[t],before[t]);
      assert.deepEqual(afterRpc,afterHandler);
    }
  }
  return content(handler)?.data?.receipt;
}
try{
  assert.equal(sql('select count(*) from auth.users'),'0');
  report.migrations=JSON.parse(sql('select jsonb_agg(version order by version) from supabase_migrations.schema_migrations'));
  const files=readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort().map(x=>x.slice(0,14));
  assert.deepEqual(report.migrations,files);assert.equal(new Set(files).size,files.length);
  report.authority=JSON.parse(sql("select jsonb_build_object('outcomes_rls',(select relrowsecurity from pg_class where oid='workspace_private.sotf_daily_brief_outcomes'::regclass),'audits_rls',(select relrowsecurity from pg_class where oid='workspace_private.sotf_workflow_access_audit'::regclass),'authenticated_direct_select',has_table_privilege('authenticated','workspace_private.sotf_daily_brief_outcomes','select'),'authenticated_direct_insert',has_table_privilege('authenticated','workspace_private.sotf_daily_brief_outcomes','insert'),'legacy_rpc',has_function_privilege('authenticated','workspace.sotf_v1_record_daily_brief_outcome(jsonb)','execute'),'authenticated_rpc',has_function_privilege('authenticated','workspace.sotf_v1_record_daily_brief_outcome(jsonb,text)','execute'),'anon_rpc',has_function_privilege('anon','workspace.sotf_v1_record_daily_brief_outcome(jsonb,text)','execute'),'private_projection',has_function_privilege('authenticated','workspace_private.sotf_v1_daily_brief_projection_semantics(uuid,date,text)','execute'),'private_validator',has_function_privilege('authenticated','workspace_private.validate_sotf_v1_daily_brief_projection_semantics(jsonb,uuid)','execute'),'private_compact',has_function_privilege('authenticated','workspace_private.sotf_v1_compact_json(jsonb)','execute'))"));
  assert.deepEqual(report.authority,{outcomes_rls:true,audits_rls:true,authenticated_direct_select:false,authenticated_direct_insert:false,legacy_rpc:false,authenticated_rpc:true,anon_rpc:false,private_projection:false,private_validator:false,private_compact:false});
  let fixture=readFileSync(root+'/supabase/tests/database/sotf_v1_daily_brief_slice.sql','utf8');
  fixture=fixture.slice(fixture.indexOf('insert into auth.users'),fixture.indexOf('-- One assertion')).replaceAll('74','76');
  sql('begin;'+fixture+"update workspace_private.product_settings set setting_value='true' where setting_key='sotf_v1_daily_brief_enabled';commit;");initialized=true;
  process.env.SOTF_PILOT_ENABLED='true';
  loader=await createServer({configFile:false,root,server:{middlewareMode:true},resolve:{alias:[{find:'server-only',replacement:root+'/tests/harness/session.ts'},{find:'@',replacement:root}]}});
  const {registerSotfV1Tools}=await loader.ssrLoadModule(root+'/lib/sotf/v1-mcp.ts');
  const {createSotfStore}=await loader.ssrLoadModule(root+'/lib/sotf/server.ts');
  const {dailyBriefWindow}=await loader.ssrLoadModule(root+'/lib/sotf/daily-brief-v1.ts');
  async function connect(client){const server=new McpServer({name:'independent-acceptance',version:'1'});registerSotfV1Tools(server,client,{releaseEnabled:true});const host=new Client({name:'synthetic-host',version:'1'});const [ct,st]=InMemoryTransport.createLinkedPair();await server.connect(st);await host.connect(ct);connections.push(server,host);return host;}
  ac=await connect(adb);bc=await connect(bdb);store=createSotfStore(adb);
  await append({type:'start_transition',timing:'Synthetic test',question:'Choose one synthetic next step',weeklyHours:8,criteria:[],hypotheses:[]});
  const step=(text='Synthetic completion evidence')=>({type:'save_commitment',commitment:{id:'independent-step',title:'Synthetic priority',owner:'Synthetic',due:date,definitionOfDone:text,reviewTrigger:'Today'}});
  await append(step());
  await check('I01 current workflow, exact version, bounded state, read-only business state',async()=>{
    const before=snapshot();const current=content(await call(ac,'get_workflow',{workflow_id:stateInput.workflow_id}));const exact=content(await call(ac,'get_workflow',{workflow_id:stateInput.workflow_id,workflow_version:stateInput.workflow_version}));assert.deepEqual(current,exact);assert.equal(exact.status,'ok');assert.equal(exact.data.workflow.execution_mode,'A');
    const p=content(await call(ac,'sotf_get_daily_brief_state',stateInput));assert.equal(p.status,'ok');authorityToken=p.data.authority.authority_token;const projection=p.data.projection;assert.equal(projection.workspace_id,wa);assert.equal(projection.state_revision,rev);assert.deepEqual(projection.truncated_sections,[]);assert(Buffer.byteLength(JSON.stringify(projection))<=65536);assert(!('events' in projection));report.initialProjection=projection;
    const after=snapshot();for(const t of surfaces.filter(x=>x!==surfaces[3]))assert.deepEqual(after[t],before[t]);assert.equal(after[surfaces[3]].count,before[surfaces[3]].count+2);
  });
  await check('I02 malformed and NULL catalog IDs and wrong-workspace reads fail without mutation',async()=>{
    for(const args of [{workflow_id:null},{workflow_id:''},{workflow_id:'../../other'},{workflow_id:stateInput.workflow_id,workflow_version:null},{workflow_id:stateInput.workflow_id,workflow_version:'2.0.0'},{workflow_id:stateInput.workflow_id,workspace_id:wb}]){const before=snapshot();assert((await call(ac,'get_workflow',args)).isError);assert.deepEqual(snapshot(),before);}
    for(const args of [{p_workflow_id:null,p_workflow_version:'1.0.0'},{p_workflow_id:'transition.daily_brief',p_workflow_version:null},{p_workflow_id:'../other',p_workflow_version:'1.0.0'},{p_workflow_id:'transition.daily_brief',p_workflow_version:'2.0.0'}]){const before=snapshot();assert((await adb.rpc('sotf_v1_authorize_workflow_retrieval',args)).error);assert.deepEqual(snapshot(),before);}
    const before=snapshot();assert.equal(content(await call(bc,'sotf_get_daily_brief_state',stateInput)).code,'transition_not_started');assert.deepEqual(snapshot(),before);
  });
  const variants=[['missing',undefined],['JSON null',null],['SQL NULL equivalent',JSON.parse(sql("select jsonb_build_object('v',null::text)->'v'"))],['empty',''],['whitespace',' \t\n'],['number',4],['boolean',true],['object',{}],['array',[]],['unsupported','unsupported']];
  for(const path of [['host'],['execution_mode'],['data_class'],['provenance','source']])await check('NULL '+path.join('.'),async()=>{
    for(const [label,val] of variants){const candidate=fresh();let parent=candidate;for(const key of path.slice(0,-1))parent=parent[key];if(val===undefined)delete parent[path.at(-1)];else parent[path.at(-1)]=val;await differential(path.join('.')+' '+label,candidate);}
  });
  await check('I03 original forged truncation with empty actual sections',()=>differential('original state_truncated declared with empty actual projection',fresh({degradation_reasons:['state_truncated']})));
  const valid=fresh();
  await check('I04 full valid governed write and exact cross-path retry',()=>differential('valid initial outcome',valid,'accept'));
  await check('I05 receipt read-back and no ordinary revision change',async()=>{const p=content(await call(ac,'sotf_get_daily_brief_state',stateInput));authorityToken=p.data.authority.authority_token;assert.equal(p.data.projection.state_revision,rev);assert.equal(p.data.projection.recent_outcomes[0].request_id,valid.request_id);});
  await check('I06 independently combined semantic denials',async()=>{
    const attacks=[['completed with missing connectors',fresh({status:'completed'})],['degraded despite both used',fresh({connector_results:{calendar_read:'used',email_read:'used'}})],['crossed connector reasons',fresh({connector_results:{calendar_read:'failed',email_read:'not_available'},degradation_reasons:['calendar_unavailable','email_failed']})],['wrong provenance/class combination',fresh({data_class:'ordinary_transition_operations',provenance:{source:'provider_verified',provider_content_persisted:false}})],['valid metadata wrong workspace',fresh({workspace_id:wb})],['stale version with valid metadata',fresh({workflow_version:'2.0.0'})],['stale revision new identity',fresh({expected_state_revision:0})],['changed usefulness reused IDs',{...valid,usefulness:'useful'}],['changed run reused request',{...valid,run_id:randomUUID()}],['too many refs relative to priority',fresh({priority_count:0})],['nested provider data',fresh({provenance:{source:'host_reported_user_confirmed',provider_content_persisted:false,email_body:'FORBIDDEN_INDEPENDENT'}})],['large undeclared content',fresh({provider_payload:'FORBIDDEN_INDEPENDENT'.repeat(1000)})]];
    for(const [label,candidate] of attacks)await differential(label,candidate);
    await differential('foreign subject cannot save other subject selected ref',fresh(),'deny',bc,bdb);
  });
  await check('I07 authority loss rejects saved replay through both paths',async()=>{
    for(const [label,off,on] of [
      ['revoked entitlement',`update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Synthetic cancellation' where workspace_id='${wa}'`,`update workspace.bundle_entitlements set revoked_at=null,revocation_reason=null where workspace_id='${wa}'`],
      ['missing capability',"update workspace.bundle_capabilities set enabled=false where bundle_key='sotf_transition' and capability_key='agentic_workflows'","update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='agentic_workflows'"],
      ['release gate off',"update workspace_private.product_settings set setting_value='false' where setting_key='sotf_v1_daily_brief_enabled'","update workspace_private.product_settings set setting_value='true' where setting_key='sotf_v1_daily_brief_enabled'"]
    ]){sql(off);try{await differential(label+' cached replay',valid);const before=snapshot();assert((await call(ac,'get_workflow',{workflow_id:stateInput.workflow_id})).isError);assert((await call(ac,'sotf_get_daily_brief_state',stateInput)).isError);assert.deepEqual(snapshot(),before);}finally{sql(on);}}
  });
  await check('I08 inverse ASCII truncation and safe replay after revision',async()=>{
    await append(step('a'.repeat(501)));const p=content(await call(ac,'sotf_get_daily_brief_state',stateInput));authorityToken=p.data.authority.authority_token;assert.deepEqual(p.data.projection.truncated_sections,['commitments']);
    await differential('ASCII truncation missing declaration',fresh());
    await differential('ASCII truncation correct declaration',fresh({degradation_reasons:['state_truncated']}),'accept');
    await differential('old exact receipt after revision advance',valid,'replay');
    await append(step());
  });
  await check('I09 stale reference excluded by current projection',async()=>{
    await append({type:'save_commitment',commitment:{id:'future-step',title:'Future',owner:'Synthetic',due:'2099-01-01',definitionOfDone:'Done',reviewTrigger:'Later'}});
    await differential('future reference exists only historically',fresh({selected_le_refs:[{entity_type:'commitment',entity_id:'future-step'}]}));
  });
  await check('I10 local day, DST and retry-day identity',async()=>{
    const f=dailyBriefWindow('2026-03-08','America/Chicago',new Date('2026-03-08T18:00Z'));const b=dailyBriefWindow('2026-11-01','America/Chicago',new Date('2026-11-01T18:00Z'));assert.equal((Date.parse(f.window_end)-Date.parse(f.window_start))/3600000,47);assert.equal((Date.parse(b.window_end)-Date.parse(b.window_start))/3600000,49);
    assert.equal(dailyBriefWindow('2026-09-11','America/Chicago',new Date('2026-09-12T05:00Z')).brief_date,'2026-09-11');assert.equal(dailyBriefWindow('2026-12-31','America/Chicago',new Date('2027-01-01T06:00Z')).brief_date,'2026-12-31');
    const yesterday=new Date(date+'T12:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);const y=fresh({brief_date:yesterday.toISOString().slice(0,10)});await differential('valid yesterday then exact retry',y,'accept');await differential('same identity changed local date',{...y,brief_date:date});report.timezone={forwardHours:47,backwardHours:49,midnightGrace:true,yearRollover:true};
  });
  await check('N01 supplementary Unicode at truncation boundary',async()=>{
    const text=String.fromCodePoint(0x1f642).repeat(300);
    await append(step(text));
    const p=content(await call(ac,'sotf_get_daily_brief_state',stateInput));assert.equal(p.status,'ok');
    const derived=projectionSemantics();
    authorityToken=p.data.authority.authority_token;report.reproducedBypass={utf16Units:text.length,unicodeScalars:Array.from(text).length,postgresCharacters:Number(sql(`select char_length(${quote(text)})`)),projection:p.data.projection,dbDerived:derived,revision:rev};
    const candidate=fresh();
    await differential('N01 Unicode truncation: real handler denies absent state_truncated',candidate);
  });

  // Observe actual application validation independently: read real authenticated
  // state, but prevent SQL's probe/write validation from masking a JS disagreement.
  let applicationWrites=0;
  const application=await connect({rpc:async(name,args)=>{
    if(name==='sotf_v1_probe_daily_brief_outcome') return {data:{state:'new'},error:null};
    if(name==='sotf_v1_record_daily_brief_outcome'){
      applicationWrites++;
      return {data:null,error:{code:'local_test_sentinel',message:'Application reached the write boundary; persistence intentionally suppressed'}};
    }
    return adb.rpc(name,args);
  }});
  async function paired(label,candidate,accepted) {
    const authority=await adb.rpc('sotf_v1_get_daily_brief_authority',{p_workflow_id:candidate.workflow_id,p_workflow_version:candidate.workflow_version,p_brief_date:candidate.brief_date,p_time_zone:candidate.time_zone});
    if(!authority.error&&authority.data?.authority_token) candidate.expected_authority_token=authority.data.authority_token;
    const before=snapshot(), callsBefore=applicationWrites;
    const result=await call(application,'sotf_record_daily_brief_outcome',candidate);
    const applicationAccepted=applicationWrites===callsBefore+1;
    assert.deepEqual(snapshot(),before,label+' isolated application check has no effects');
    report.application.push({label,accepted:applicationAccepted,code:content(result)?.code});
    assert.equal(applicationAccepted,accepted,label+' independent application expectation');
    return differential(label,candidate,accepted?'accept':'deny');
  }
  const corpus=JSON.parse(readFileSync(join(root,'supabase/tests/database/sotf_v1_unicode_truncation_parity.sql'),'utf8').split('$unicode$')[1]);
  let previousUnicode;
  for(const row of corpus) await check(row.id+' '+row.description,async()=>{
    const text=row.segments.map(s=>s.text.repeat(s.repeat)).join('');
    const measured=Buffer.byteLength(text,'utf16le')/2;
    assert.equal(measured,row.units,'independent encoding oracle');
    // Required source text is non-empty. The empty corpus item exercises the
    // empty eligible section and empty selected refs; helper tests cover text "".
    const command=step(text || 'Synthetic empty-section fixture');
    if(text==='') command.commitment.due='2099-01-01';
    await append(command);
    if(row.description.startsWith('transport escaped')) {
      const operation={requestId:randomUUID(),expectedRevision:rev,userConfirmed:true,dataClass:'ordinary_transition_operations',command};
      const body=JSON.stringify({operation}).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
      const response=await fetch(status.API_URL+'/rest/v1/rpc/sotf_append_operation',{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+bearer(ua,ca),'Content-Type':'application/json','Content-Profile':'workspace','Accept-Profile':'workspace'},body});
      assert(response.ok,'escaped source append accepted');
      rev=(await response.json()).revision;
    }
    const projection=content(await call(ac,'sotf_get_daily_brief_state',stateInput));
    assert.equal(projection.status,'ok');
    const semantics=projectionSemantics();
    const sections=row.truncated?['commitments']:[];
    authorityToken=projection.data.authority.authority_token;const projectedState=projection.data.projection;
    assert.deepEqual(projectedState.truncated_sections,sections);
    assert.deepEqual(semantics.truncated_sections,sections);
    if(text!=='')assert.equal(Buffer.byteLength(projectedState.commitments[0].definition_of_done,'utf16le')/2,row.prefixUnits);
    const refs=text===''?[]:[{entity_type:'commitment',entity_id:'independent-step'}];
    const valid=fresh({degradation_reasons:row.truncated?['state_truncated']:[],selected_le_refs:refs,priority_count:refs.length});
    await paired(row.id+' contradictory truncation', {...valid,degradation_reasons:row.truncated?[]:['state_truncated']},false);
    await paired(row.id+' canonical metadata',valid,true);
    await differential(row.id+' exact Unicode retry',valid,'replay');
    report.unicode.push({...row,measured,handlerTruncated:projectedState.truncated_sections,rpcTruncated:semantics.truncated_sections,expectedStateTruncated:row.truncated,canonical:'ACCEPT/ACCEPT',contradictory:'DENY/DENY',replay:'same receipt',emptySource:text===''?'empty eligible section; required source text cannot be empty':undefined});
    previousUnicode=valid;
  });
  await check('U41 Unicode replay after ordinary revision advance',async()=>{
    await append(step('界🙂'.repeat(200)));
    await differential('U41 saved exact Unicode replay after state change',previousUnicode,'replay');
    await paired('U41 stale Unicode revision with new identity',{...previousUnicode,request_id:randomUUID(),run_id:randomUUID()},false);
  });
  await check('U42 complete metadata truth table with supplementary state',async()=>{
    const variants=[
      ['missing reason',fresh()],
      ['wrong sections',fresh({degradation_reasons:['state_truncated'],truncated_sections:['criteria']})],
      ['empty sections',fresh({degradation_reasons:['state_truncated'],truncated_sections:[]})],
      ['redundant true plus empty',fresh({state_truncated:true,truncated_sections:[]})],
      ['redundant false',fresh({state_truncated:false})],
      ['wrong reason type',fresh({degradation_reasons:'state_truncated'})],
      ['null reason',fresh({degradation_reasons:null})],
      ['duplicate reason',fresh({degradation_reasons:['state_truncated','state_truncated']})]
    ];
    for(const [label,candidate] of variants)await paired('U42 '+label,candidate,false);
  });
  await check('U43 reference text lengths and invalid encodings',async()=>{
    for(const id of ['🙂'.repeat(51),'é'.repeat(101),'a'.repeat(99)+'🙂','\ud800','a\u0000b']) {
      await paired('U43 reference '+JSON.stringify(id),fresh({degradation_reasons:['state_truncated'],selected_le_refs:[{entity_type:'commitment',entity_id:id}]}),false);
    }
  });
  await check('U44 nested required-field NULL regressions against Unicode state',async()=>{
    for(const path of [['provenance','provider_content_persisted'],['connector_results','calendar_read'],['connector_results','email_read'],['selected_le_refs',0,'entity_type'],['selected_le_refs',0,'entity_id']]) {
      const candidate=fresh({degradation_reasons:['state_truncated']});let target=candidate;
      for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=null;
      await paired('U44 '+path.join('.')+' null',candidate,false);
    }
  });
  await check('U45 multiple projected sections use one measurement',async()=>{
    const text='🙂'.repeat(300);
    await append({type:'confirm_criteria',reason:'Synthetic Unicode boundary',criteria:[{id:'criterion-unicode',label:'Synthetic',dimension:'actual_work',desired:text,nonNegotiable:false,importance:5,confirmed:true}]});
    await append({type:'save_hypothesis',hypothesis:{id:'hypothesis-unicode',proposition:'Synthetic',whyPromising:'Synthetic',assumptions:[],gaps:[],nextExperiment:text,reviewTrigger:text,status:'continue',confidenceExplanation:'Synthetic'}});
    const stateResult=content(await call(ac,'sotf_get_daily_brief_state',stateInput)).data;authorityToken=stateResult.authority.authority_token;const p=stateResult.projection;
    const s=projectionSemantics();
    assert.deepEqual(p.truncated_sections,['commitments','criteria','hypotheses']);assert.deepEqual(s.truncated_sections,p.truncated_sections);
    await paired('U45 multiple sections correct',fresh({degradation_reasons:['state_truncated']}),true);
    await paired('U45 multiple sections missing',fresh(),false);
  });


  await check('U46 valid supplementary reference at exactly 100 units',async()=>{
    const id='🙂'.repeat(50);
    await append({type:'save_commitment',commitment:{id,title:'国際化の確認',owner:'Synthetic',due:date,definitionOfDone:'今日の合意を確認する 🙂',reviewTrigger:'明日レビュー'}});
    const candidate=fresh({degradation_reasons:['state_truncated'],selected_le_refs:[{entity_type:'commitment',entity_id:id}]});
    await paired('U46 Unicode identifier exact 100-unit success',candidate,true);
    await differential('U46 Unicode identifier exact retry',candidate,'replay');
  });
  await check('U47 generated title never splits a supplementary scalar',async()=>{
    const nextAction='a'.repeat(239)+'🙂';
    await append({type:'record_opportunity',opportunity:{id:'unicode-title',company:'Synthetic',role:'Synthetic',description:'',hypothesisIds:[],requirements:[],deadline:date,actualWork:'',decisionQuestion:'Synthetic'}});
    await append({type:'decide_opportunity',opportunityId:'unicode-title',decision:'investigate',rationale:'Synthetic',nextAction,revisitWhen:'Today',due:date});
    const stateResult=content(await call(ac,'sotf_get_daily_brief_state',stateInput)).data;authorityToken=stateResult.authority.authority_token;const p=stateResult.projection;
    assert.equal(p.commitments.find(c=>c.id==='unicode-title:decision-next-step').title,'a'.repeat(239));
    assert.equal(sql(`select workspace_private.sotf_v1_text_prefix(${quote(nextAction)},240)`),'a'.repeat(239));
    await paired('U47 generated title canonical projection',fresh({degradation_reasons:['state_truncated'],selected_le_refs:[{entity_type:'commitment',entity_id:'unicode-title:decision-next-step'}]}),true);
  });
  await check('U48 complete serialized Unicode projection stays within 64 KiB',async()=>{
    await append({type:'confirm_criteria',reason:'Synthetic byte budget',criteria:Array.from({length:20},(_,i)=>({id:'byte-c-'+String(i).padStart(2,'0'),label:'界'.repeat(240),dimension:'actual_work',desired:'界'.repeat(501),nonNegotiable:false,importance:5,confirmed:true}))});
    for(let i=0;i<10;i++) await append({type:'save_commitment',commitment:{id:'byte-k-'+String(i).padStart(2,'0'),title:'界'.repeat(240),owner:'Synthetic',due:date,definitionOfDone:'界'.repeat(501),reviewTrigger:'界'.repeat(501)}});
    for(let i=0;i<10;i++) await append({type:'record_opportunity',opportunity:{id:'byte-o-'+String(i).padStart(2,'0'),company:'界'.repeat(240),role:'界'.repeat(240),description:'',hypothesisIds:[],requirements:[],deadline:date,actualWork:'',decisionQuestion:'Synthetic'}});
    const stateResult=content(await call(ac,'sotf_get_daily_brief_state',stateInput)).data;authorityToken=stateResult.authority.authority_token;const p=stateResult.projection;
    assert(p,'byte-limited projection must remain readable');
    const s=projectionSemantics();
    const bytes=Buffer.byteLength(JSON.stringify(p),'utf8');
    assert(bytes<=65536);assert(p.omitted_counts.commitments>0);
    assert.deepEqual(s.truncated_sections,p.truncated_sections);
    const refs=Object.entries({criteria:'criterion',opportunities:'opportunity',commitments:'commitment',meetings:'meeting',hypotheses:'hypothesis'}).flatMap(([section,entity_type])=>p[section].map(item=>({entity_type,entity_id:item.id})));
    const key=r=>JSON.stringify([r.entity_type,r.entity_id]);
    assert.deepEqual(s.eligible_refs.map(key).sort(),refs.map(key).sort());
    report.byteBudget={bytes,sections:p.truncated_sections,omitted:p.omitted_counts,eligibleRefs:refs.length};
    await paired('U48 byte omission correct',fresh({degradation_reasons:['state_truncated'],selected_le_refs:[],priority_count:0}),true);
    await paired('U48 byte omission undeclared',fresh({selected_le_refs:[],priority_count:0}),false);
  });

}catch(e){report.failure??={type:'HARNESS_OR_ASSERTION',active,message:e.message,stack:e.stack};console.log('STOP '+e.message);process.exitCode=1;}
finally{
  if(initialized){
    report.persisted=JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('id',id,'workspace_id',workspace_id,'request_id',request_id,'run_id',run_id,'state_revision',state_revision,'payload',payload,'provenance',provenance)),'[]') from workspace_private.sotf_daily_brief_outcomes"));
    report.forbiddenCount=Number(sql("select count(*) from workspace_private.sotf_daily_brief_outcomes where payload::text like '%FORBIDDEN_INDEPENDENT%'"));
    report.beforeCleanup=summary(snapshot());
    sql(`begin;delete from workspace.mcp_authorizations where workspace_id in ('${wa}','${wb}');delete from workspace.workspaces where id in ('${wa}','${wb}');delete from auth.users where id in ('${ua}','${ub}');update workspace_private.product_settings p set setting_value=s.value from jsonb_each_text(${json(savedSettings)}) s where p.setting_key=s.key;update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='agentic_workflows';commit;`);
    const tables=['auth.users','workspace.workspaces','workspace.workspace_memberships','workspace.personal_plans','workspace.bundle_entitlements','workspace.mcp_authorizations','workspace_private.mcp_oauth_resource_grants','workspace_private.sotf_operation_events','workspace_private.sotf_operation_heads','workspace_private.sotf_daily_brief_outcomes','workspace_private.sotf_workflow_access_audit'];
    report.cleanup=JSON.parse(sql('select jsonb_build_object('+tables.map(t=>quote(t)+`,(select count(*) from ${t})`).join(',')+')'));
    report.restoredSettings=JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')"));
    for(const count of Object.values(report.cleanup))assert.equal(count,0);
  }
  await Promise.all(connections.map(c=>c.close()));await loader?.close();
  report.finished=new Date().toISOString();writeFileSync(output,JSON.stringify(report,null,2));
  console.log('RESULT '+JSON.stringify({head,checks:report.checks.length,differential:report.differential.length,passPairs:report.differential.filter(x=>x.handler===x.rpc).length,failure:report.failure?.label??report.failure,cleanup:report.cleanup,output}));
}
