import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {localConfiguration,localSql} from "./bundle-local-runtime.mjs";
await localConfiguration();
const f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8")),owner=f.layoutAll.workspaceId,other=f.layoutOther.workspaceId;
for(const id of [owner,other])assert.match(id,/^[0-9a-f-]{36}$/);
assert.equal(Number(localSql("select count(*) from auth.users where email not like '%@example.invalid'")),0,"Only fictional users allowed.");
const marker="Fictional P11a scale acceptance",rowsPerKind=200,writerRows=12000,foreignRows=500;
const domains=[
 ["ministry",[["research","teachingOutline",8000],["archive","bodyText",8000]]],
 ["nonprofit",[["plan","mission",3500],["partner","notes",8000],["meeting","notes",8000],["research","interpretation",8000]]],
 ["investor",[["watchlist","purpose",3500],["thesis","thesis",7000],["filing","transactionFootnotes",7000],["brief",null,0]]],
 ["executive",["commitment","decision","meeting","daily_brief","weekly_review"].map(k=>[k,"notes",8000])]
];
const countSql="select (select count(*) from workspace_private.writing_resources where source_label='"+marker+"')"+
 domains.map(([d])=>"+(select count(*) from workspace_private."+d+"_documents where data->>'title' like 'P11ascale %')").join("");
const existing=Number(localSql(countSql));
assert.ok(existing===0||existing===15500,"Unexpected partial scale corpus: inspect without overwriting.");
if(existing===0){
 let sql="begin; set local statement_timeout='180s';\n";
 sql+="insert into workspace_private.writing_resources(workspace_id,title,source_label,body_text,abstract) select '"+owner+"',case when n=1 then 'P11ascale' else 'P11ascale Writer '||lpad(n::text,5,'0') end,'"+marker+"','p11ascale precisionneedle'||n||' '||left(repeat('Fictional local resource. Recorded history, source comparison, review and next steps. ',110),8000),'"+marker+"' from generate_series(1,"+writerRows+") n;\n";
 for(const [domain,kinds] of domains){
  for(const [kind,field,size] of kinds){
   const patch=field?"||jsonb_build_object('"+field+"',left(repeat('P11ascale fictional saved work for local responsiveness testing. ',150),"+size+"))":"";
   sql+="insert into workspace_private."+domain+"_documents(workspace_id,kind,revision,data,origin) select '"+owner+"','"+kind+"',1,r.data||jsonb_build_object('title','P11ascale "+domain+" "+kind+" '||lpad(n::text,4,'0'))"+patch+(domain==="executive"?"||jsonb_build_object('references','[]'::jsonb)":"")+",'user' from (select data from workspace_private."+domain+"_documents where workspace_id='"+owner+"' and kind='"+kind+"' order by updated_at desc limit 1) r cross join generate_series(1,"+rowsPerKind+") n;\n";
  }
 }
 sql+="insert into workspace_private.writing_resources(workspace_id,title,source_label,body_text) select '"+other+"','P11ascale foreign '||n,'"+marker+"','foreignscaleprivate p11ascale' from generate_series(1,"+foreignRows+") n;\ncommit;";
 const start=performance.now();localSql(sql);console.log("Created scale corpus transaction in "+Math.round(performance.now()-start)+" ms.");
}else console.log("Reusing existing scale fixtures; no records rewritten.");
assert.equal(Number(localSql(countSql)),15500);
const counts={writer:writerRows,perDocumentKind:rowsPerKind,ownTotal:15000,foreignTotal:foreignRows};
const bytes=Number(localSql("select (select sum(octet_length(body_text)) from workspace_private.writing_resources where source_label='"+marker+"')"+
 domains.map(([d])=>"+coalesce((select sum(octet_length(data::text)) from workspace_private."+d+"_documents where data->>'title' like 'P11ascale %'),0)").join("")));
await writeFile(".bundle-local/search-scale-fixtures.json",JSON.stringify({marker,counts,logicalTextBytes:bytes},null,2));
console.log(JSON.stringify({...counts,logicalTextBytes:bytes}));
