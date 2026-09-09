import {randomBytes,randomUUID} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
const config=await localConfiguration();
const fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
if(fixtures.executive)throw new Error("Executive fixtures already exist; reuse them or reset the isolated stack explicitly.");
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const operator=await fixtureSession(config,fixtures.operator);
for(const name of ["executive","executiveOther","executiveDual"]){
 const id=randomUUID(),workspaceId=randomUUID();
 const fixture={id,workspaceId,email:"executive."+name+"."+id.slice(0,8)+"@example.invalid",password:randomBytes(24).toString("base64url")};
 const created=await admin.auth.admin.createUser({id,email:fixture.email,password:fixture.password,email_confirm:true,user_metadata:{full_name:"Synthetic "+name}});
 if(created.error)throw new Error("Synthetic Executive user creation failed.");
 localSql(`insert into workspace.user_profiles(user_id,display_name) values ('${id}','Synthetic ${name}');
 insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('${workspaceId}','personal','Synthetic Executive ${name}','${id}');
 insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('${workspaceId}','${id}','owner','active');`);
 const session=await fixtureSession(config,fixture),ensured=await session.client.rpc("ensure_personal_workspace").single();
 if(ensured.error)throw new Error("Synthetic Executive workspace failed.");
 localSql(`update workspace.personal_onboarding set state='workspace_ready' where user_id='${id}';`);
 for(const bundle of name==="executiveDual"?["executive","writer_editor","ministry","nonprofit_founder","investor"]:["executive"]){
  const assigned=await operator.client.rpc("issue_bundle_assignment",{target_workspace_id:workspaceId,target_bundle_key:bundle,idempotency_key:"executive-"+name+"-"+randomUUID(),target_expires_at:null});
  if(assigned.error)throw new Error("Synthetic Executive assignment failed.");
  if(bundle==="executive")fixture.entitlementId=assigned.data.entitlement_id;
 }
 fixtures[name]=fixture;
}
await writeFile(".bundle-local/fixtures.json",JSON.stringify(fixtures,null,2));
console.log("Created isolated fictional Executive, other-Executive and dual-bundle fixtures. No client data used.");
