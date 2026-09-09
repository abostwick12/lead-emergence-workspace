import {randomBytes,randomUUID} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {localConfiguration,localSql,fixtureSession} from "./bundle-local-runtime.mjs";
const config=await localConfiguration(),fixtures=JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
if(fixtures.layout)throw new Error("Layout fixtures already exist; reuse them.");
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const operator=await fixtureSession(config,fixtures.operator);
for(const name of ["layout","layoutOther","layoutAll"]){
 const id=randomUUID(),workspaceId=randomUUID(),fixture={id,workspaceId,email:"layout."+name+"."+id.slice(0,8)+"@example.invalid",password:randomBytes(24).toString("base64url")};
 const created=await admin.auth.admin.createUser({id,email:fixture.email,password:fixture.password,email_confirm:true,user_metadata:{full_name:"Synthetic "+name}});
 if(created.error)throw new Error("Synthetic layout user creation failed.");
 localSql(`insert into workspace.user_profiles(user_id,display_name) values ('${id}','Synthetic ${name}');
 insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('${workspaceId}','personal','Synthetic layout ${name}','${id}');
 insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('${workspaceId}','${id}','owner','active');`);
 const session=await fixtureSession(config,fixture),ensured=await session.client.rpc("ensure_personal_workspace").single();if(ensured.error)throw new Error("Synthetic layout workspace failed.");
 localSql(`update workspace.personal_onboarding set state='workspace_ready' where user_id='${id}';`);
 fixture.entitlements={};
 for(const bundle of name==="layoutAll"?["workspace_experience","executive","writer_editor","ministry","nonprofit_founder","investor"]:["workspace_experience"]){
  const assigned=await operator.client.rpc("issue_bundle_assignment",{target_workspace_id:workspaceId,target_bundle_key:bundle,idempotency_key:"layout-"+name+"-"+randomUUID(),target_expires_at:null});
  if(assigned.error)throw new Error("Synthetic layout assignment failed.");
  fixture.entitlements[bundle]=assigned.data.entitlement_id;
 }
 fixtures[name]=fixture;
}
await writeFile(".bundle-local/fixtures.json",JSON.stringify(fixtures,null,2));
console.log("Created three fictional layout fixtures: Experience-only, another owner and all six assigned. Existing fixtures unchanged.");
