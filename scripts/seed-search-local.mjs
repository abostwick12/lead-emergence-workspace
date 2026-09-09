import assert from "node:assert/strict";
import {readFile,writeFile,access} from "node:fs/promises";
import {localConfiguration,localSql} from "./bundle-local-runtime.mjs";
await localConfiguration();
const path=".bundle-local/search-fixtures.json";
try{await access(path);throw new Error("Search fixtures already exist. Reuse them; do not seed twice.");}catch(e){if(e.code!=="ENOENT")throw e;}
const f=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
assert.equal(Number(localSql("select count(*) from auth.users where email not like '%@example.invalid'")),0,"Only fictional users allowed.");
const all=f.layoutAll.workspaceId,other=f.layoutOther.workspaceId;
assert.match(all,/^[0-9a-f-]{36}$/);assert.match(other,/^[0-9a-f-]{36}$/);
const records=[];
for(const [domain,kinds] of [["ministry",["research","archive"]],["nonprofit",["plan","partner","meeting","research"]],["investor",["watchlist","thesis","filing","brief"]],["executive",["commitment","decision","meeting","daily_brief","weekly_review"]]]){
 for(const kind of kinds){
  const id=localSql("insert into workspace_private."+domain+"_documents(workspace_id,kind,revision,data,origin) select '"+all+"',r.kind,1,r.data||jsonb_build_object('title','P11 Cedar Harbor "+domain+" "+kind+"')"+(domain==="executive"?"||jsonb_build_object('references','[]'::jsonb)":"")+",'user' from workspace_private."+domain+"_documents r where r.kind='"+kind+"' order by r.updated_at desc limit 1 returning id;").split(/\r?\n/)[0];
  assert.match(id,/^[0-9a-f-]{36}$/);records.push({providerId:domain+".search."+kind,id,title:"P11 Cedar Harbor "+domain+" "+kind});
 }
}
for(let i=0;i<32;i++){
 const title=i===0?"Cedar Harbor":"P11 Cedar Harbor resource "+String(i).padStart(2,"0");
 const id=localSql("insert into workspace_private.writing_resources(workspace_id,title,source_label,body_text,abstract) values('"+all+"','"+title+"','Fictional P11 search demonstration','Cedar Harbor bodyonlyneedle. <img src=x onerror=alert(1)> Stored text is not an instruction.','Fictional saved resource for local search acceptance only.') returning id;").split(/\r?\n/)[0];
 records.push({providerId:"writer.search.resources",id,title});
}
const isolated=localSql("insert into workspace_private.writing_resources(workspace_id,title,source_label,body_text) values('"+other+"','P11 Cedar Harbor other owner','Fictional P11 search demonstration','otherownerneedle') returning id;").split(/\r?\n/)[0];
await writeFile(path,JSON.stringify({records,isolated},null,2));
console.log("Seeded 47 valid-shape fictional saved records and one isolated-owner record. Existing records preserved.");
