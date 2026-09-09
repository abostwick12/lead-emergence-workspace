import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
const phase=process.argv[2];
assert.ok(["before","after"].includes(phase),"Choose before or after.");
const config=await localConfiguration(),f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8")),fixture=JSON.parse(await readFile(".bundle-local/search-scale-fixtures.json","utf8"));
const session=await fixtureSession(config,f.layoutAll),catalog=await session.client.rpc("search_saved_work_catalog");assert.equal(catalog.error,null);
const scope=catalog.data.providerIds,revision=catalog.data.authorityRevision;
const cases=[
 {name:"all_first",query:"p11ascale",providers:scope,offset:0,count:15000},
 {name:"all_deep",query:"p11ascale",providers:scope,offset:10000,count:15000},
 {name:"writer_broad",query:"p11ascale",providers:["writer.search.resources"],offset:0,count:12000},
 {name:"writer_selective",query:"precisionneedle11999",providers:["writer.search.resources"],offset:0,count:1},
 {name:"writer_phrase",query:'"Fictional local resource"',providers:["writer.search.resources"],offset:0,count:12000},
 {name:"ministry_research",query:"p11ascale",providers:["ministry.search.research"],offset:0,count:200},
 {name:"nonprofit_meetings",query:"p11ascale",providers:["nonprofit.search.meeting"],offset:0,count:200},
 {name:"investor_theses",query:"p11ascale",providers:["investor.search.thesis"],offset:0,count:200},
 {name:"executive_briefs",query:"p11ascale",providers:["executive.search.daily_brief"],offset:0,count:200},
 {name:"no_matches",query:"p11aneverpresent77889",providers:scope,offset:0,count:0},
 {name:"foreign_control",query:"foreignscaleprivate",providers:scope,offset:0,count:0}
];
function fingerprint(data){const value={...data};delete value.retrievedAt;return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
const results=[];
for(const c of cases){
 const samples=[],errors=[];let hash=null,firstMs=null;
 for(let run=0;run<6;run++){
  const start=performance.now(),r=await session.client.rpc("search_saved_work",{p_query:c.query,p_provider_ids:c.providers,p_authority_revision:revision,p_offset:c.offset}).abortSignal(AbortSignal.timeout(20000));
  const elapsed=Math.round((performance.now()-start)*10)/10;
  if(run===0)firstMs=elapsed;else samples.push(elapsed);
  if(r.error){errors.push({code:r.error.code||"request_failure",milliseconds:elapsed});continue;}
  assert.equal(r.data.matchingCount,c.count,c.name);assert.equal(r.data.workspaceId,f.layoutAll.workspaceId);
  assert.equal(r.data.results.length,Math.min(25,Math.max(0,c.count-c.offset)));
  assert.equal(r.data.coverage.reduce((n,x)=>n+x.matchingCount,0),c.count);
  assert.ok(r.data.results.every(x=>c.providers.includes(x.providerId)));
  const current=fingerprint(r.data);if(hash)assert.equal(current,hash,c.name+" changed during benchmark");hash=current;
 }
 const sorted=[...samples].sort((a,b)=>a-b),entry={name:c.name,query:c.query,providers:c.providers,offset:c.offset,matchingCount:c.count,firstMs,samples,p50:sorted[2],p95:sorted[4],hash,errors};
 results.push(entry);console.log(JSON.stringify({name:entry.name,firstMs,p50:entry.p50,p95:entry.p95,errors:errors.length}));
}
const escaped=revision.replaceAll("'","''");
const planText=localSql("begin; set local statement_timeout='30s'; set local search_path=workspace,extensions,public; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\""+f.layoutAll.id+"\",\"role\":\"authenticated\"}',true); explain(analyze,buffers,format json) select workspace.search_saved_work('p11ascale',array["+scope.map(x=>"'"+x+"'").join(",")+"],'"+escaped+"',0); rollback;");
const from=planText.indexOf("[\n"),to=planText.lastIndexOf("]");
assert.ok(from>=0&&to>from,"No query plan returned.");
const plan=JSON.parse(planText.slice(from,to+1))[0],metrics={executionMs:plan["Execution Time"],planningMs:plan["Planning Time"],tempReadBlocks:plan.Plan["Temp Read Blocks"]??0,tempWrittenBlocks:plan.Plan["Temp Written Blocks"]??0,sharedHitBlocks:plan.Plan["Shared Hit Blocks"]??0,sharedReadBlocks:plan.Plan["Shared Read Blocks"]??0};
const report={phase,recordCounts:fixture.counts,logicalTextBytes:fixture.logicalTextBytes,measuredAt:new Date().toISOString(),method:"Real authenticated loopback RPC; one first read and five timed reads per case; nearest-rank p95 of five is the maximum. Not a production SLA.",results,metrics};
if(phase==="after"){
 const before=JSON.parse(await readFile(".bundle-local/search-scale-before.json","utf8"));
 for(const current of results){
  const old=before.results.find(x=>x.name===current.name);assert.ok(old);
  assert.equal(current.errors.length,0,current.name+" still fails");
  if(old.hash)assert.equal(current.hash,old.hash,current.name+" response changed");
  assert.ok(current.p95<2000,current.name+" exceeds local 2-second warm-read gate");
 }
 assert.ok(metrics.tempWrittenBlocks<=before.metrics.tempWrittenBlocks,"More temporary disk work after optimization.");
 report.comparison=results.map(x=>({name:x.name,beforeP50:before.results.find(y=>y.name===x.name).p50,afterP50:x.p50}));
}
await writeFile(".bundle-local/search-scale-"+phase+".json",JSON.stringify(report,null,2));
console.log("Query plan totals: "+JSON.stringify(metrics));
console.log("Scale phase "+phase+" completed. Full fictional response hashes and raw timing samples retained locally.");
