import assert from "node:assert/strict";
import {readFile,readdir,mkdir,copyFile,writeFile,access} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
// A new named local Supabase database, never reset over an existing stack.
// Keep its backup after verification. The next clean replay needs a new explicit name.
const suffix=process.argv[2]??"p11a";
assert.match(suffix,/^[a-z][a-z0-9-]{1,20}$/,"Choose a simple explicit local verification suffix.");
const workdir=".bundle-local/fresh-"+suffix,project="bundle-search-fresh-"+suffix,container="supabase_db_"+project;
const docker=process.platform==="win32"?"docker.exe":"docker",cli=process.platform==="win32"?"supabase.exe":"supabase";
function run(command,args){return execFileSync(command,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});}
assert.equal(run(docker,["volume","ls","--filter","name="+project,"-q"]).trim(),"","A previous named fresh backup exists; do not overwrite it.");
try{await access(workdir);throw new Error("Named fresh directory already exists; inspect it before retrying.");}catch(e){if(e.code!=="ENOENT")throw e;}
await mkdir(resolve(workdir,"supabase/migrations"),{recursive:true});
const config=(await readFile("supabase/config.toml","utf8")).replace('project_id = "lead-emergence-workspace-local"','project_id = "'+project+'"').replaceAll("5642","5862").replaceAll("localhost:3000","localhost:3125").replaceAll("127.0.0.1:3000","127.0.0.1:3125");
await writeFile(resolve(workdir,"supabase/config.toml"),config);
const migrations=(await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort();
for(const file of migrations)await copyFile(resolve("supabase/migrations",file),resolve(workdir,"supabase/migrations",file));
await copyFile("supabase/seed.sql",resolve(workdir,"supabase/seed.sql"));
const sql=query=>execFileSync(docker,["exec","-i",container,"psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
let attempted=false;
try{
 attempted=true;run(cli,["db","start","--workdir",workdir]);console.log("Fresh named local database started; credentials withheld.");
 run(cli,["migration","up","--local","--workdir",workdir]);
 assert.equal(Number(sql("select count(*) from supabase_migrations.schema_migrations")),migrations.length);
 console.log("PASS all "+migrations.length+" migrations replayed from a new local Supabase database.");
 const runner=await readFile("scripts/test-bundle-rls-local.mjs","utf8");
 const suites=JSON.parse(runner.match(/const suites = (\[[^\n]+\]);/)[1]);
 sql("create extension if not exists pgtap with schema extensions;");let total=0;
 for(const name of suites){
  const output=sql("set search_path=workspace,extensions,public;\n"+await readFile("supabase/tests/database/"+name+".sql","utf8"));
  assert.doesNotMatch(output,/^not ok|# (?:Failed|SKIP|TODO)/m,name+" failed.");
  const plan=output.match(/^1\.\.(\d+)$/m),passed=[...output.matchAll(/^ok \d+\b/gm)].length;
  assert.ok(plan);assert.equal(passed,Number(plan[1]));total+=passed;console.log("PASS fresh "+name+": "+passed+" assertions.");
 }
 assert.equal(Number(sql("select count(*) from auth.users")),0);
 console.log("Fresh migration acceptance: "+migrations.length+" migrations; "+total+" assertions; zero users retained.");
}finally{
 if(attempted){run(cli,["stop","--workdir",workdir]);console.log("Named fresh database stopped. Local backup preserved.");}
}
