import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {expect} from "@playwright/test";

export async function clearNewEditorDrafts(domain:string,kinds:readonly string[],role:string){
 const config=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8")),fixture=JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"))[role];
 expect(config.url).toBe("http://127.0.0.1:58521");
 const client=createClient(config.url,config.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});
 expect((await client.auth.signInWithPassword({email:fixture.email,password:fixture.password})).error).toBeNull();
 for(const kind of kinds){
  const target={domain,kind,documentId:null},current=await client.rpc("native_editor_draft",{p_target:target});expect(current.error).toBeNull();
  if(current.data.values){const discarded=await client.rpc("native_change_editor_draft",{p_change:{target,operation:"discard",requestId:randomUUID(),expectedVersion:current.data.version}});expect(discarded.error).toBeNull();}
 }
}
