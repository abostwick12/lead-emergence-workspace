import {randomUUID} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
import type {WritingProfile} from "../../lib/writing/profile-contracts";
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function session(role="writer"){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(c.url).toBe("http://127.0.0.1:58521");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}}),f=fixtures()[role];
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();return client;
}
type LocalClient=Awaited<ReturnType<typeof session>>;
async function profile(client:LocalClient){const r=await client.rpc("writer_get_profile");expect(r.error).toBeNull();return r.data;}
async function saveProfile(client:LocalClient,value:WritingProfile|null){
 const current=await profile(client),r=await client.rpc("writer_save_profile",{expected_revision:current.revision,request_id:randomUUID(),profile_input:value,confirm_preferences:true});
 expect(r.error).toBeNull();return r.data;
}
async function signIn(page:Page){
 const f=fixtures().writer;await page.goto("/login?legacy=1");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
}
const voice=(page:Page)=>page.getByRole("textbox",{name:/^Your voice/});
const confirm=(page:Page)=>page.getByRole("checkbox",{name:"I confirm these are my writing preferences."});
const save=(page:Page)=>page.getByRole("button",{name:"Confirm and save preferences",exact:true});
const savedNotice=(page:Page)=>page.getByRole("status").filter({hasText:"Your writing preferences are confirmed and saved."});
async function preferences(page:Page){await page.goto("/workspace/writing/preferences");await expect(voice(page)).toBeVisible();}
test.describe("Writer confirmed preferences and publication handoff",()=>{
 test.setTimeout(120000);
 test.skip(process.env.WRITER_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional accounts.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("requires confirmation, recovers save failures and restores prior preferences only after review",async({page},info)=>{
  const client=await session(),original=await profile(client);await saveProfile(client,null);
  try{
   await signIn(page);await preferences(page);await expect(voice(page)).toHaveValue("");await expect(save(page)).toBeDisabled();
   await voice(page).fill("Preserve my fictional conversational voice.");await confirm(page).check();
   await page.getByRole("textbox",{name:/^Preferred topics/}).fill("Faith, hope\nCommunity");
   await expect(confirm(page)).not.toBeChecked();await expect(save(page)).toBeDisabled();await confirm(page).check();
   await page.route("**/api/writing/profile",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic preference save failure."})}):route.continue());
   await save(page).click();await expect(page.getByRole("alert").filter({hasText:"Synthetic preference save failure."})).toBeVisible();
   await expect(voice(page)).toHaveValue("Preserve my fictional conversational voice.");expect((await profile(client)).profile).toBeNull();
   await page.unroute("**/api/writing/profile");
   let savedRevision=0;
   await page.route("**/api/writing/profile",async route=>{
    if(route.request().method()!=="POST")return route.continue();
    const response=await route.fetch();expect(response.ok()).toBe(true);savedRevision=(await response.json()).revision;await route.abort("failed");
   });
   await save(page).click();await expect(page.getByRole("alert").filter({hasText:"Failed to fetch"})).toBeVisible();expect(savedRevision).toBeGreaterThan(0);
   await page.unroute("**/api/writing/profile");await save(page).click();
   await expect(savedNotice(page)).toBeVisible();
   expect((await profile(client)).revision).toBe(savedRevision);
   await page.reload();await expect(voice(page)).toHaveValue("Preserve my fictional conversational voice.");
   await expect(page.getByRole("textbox",{name:/^Preferred topics/})).toHaveValue("Faith, hope\nCommunity");
   await page.screenshot({path:"test-results/writer-preferences-"+info.project.name+".png",fullPage:true});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.getByRole("button",{name:"Clear all fields"}).click();await expect(save(page)).toBeDisabled();
   expect((await profile(client)).profile.voice_notes).toBe("Preserve my fictional conversational voice.");
   await confirm(page).check();await save(page).click();await expect(page.getByRole("status").filter({hasText:"No writing preferences are active."})).toBeVisible();
   await page.getByText("Earlier confirmed preferences",{exact:true}).click();
   await page.getByRole("button",{name:"Review revision "+savedRevision,exact:true}).click();
   await expect(voice(page)).toHaveValue("Preserve my fictional conversational voice.");await expect(save(page)).toBeDisabled();
   expect((await profile(client)).profile).toBeNull();
   await confirm(page).check();await save(page).click();await expect(savedNotice(page)).toBeVisible();
   expect((await profile(client)).profile.topics).toEqual(["Faith, hope","Community"]);
  }finally{await saveProfile(client,original.profile);}
 });
 test("preserves a stale tab's unconfirmed preferences and warns before abandoning them",async({page,context})=>{
  const client=await session(),original=await profile(client);await saveProfile(client,{voice_notes:"Original fictional preferences"});
  try{
   await signIn(page);await preferences(page);const second=await context.newPage();await preferences(second);
   await voice(page).fill("First tab's confirmed preference");await confirm(page).check();await save(page).click();
   await expect(savedNotice(page)).toBeVisible();
   await voice(second).fill("Second tab's unconfirmed preference");await confirm(second).check();await save(second).click();
   await expect(second.getByRole("alert").filter({hasText:"The saved version changed."})).toBeVisible();
   await expect(voice(second)).toHaveValue("Second tab's unconfirmed preference");expect((await profile(client)).profile.voice_notes).toBe("First tab's confirmed preference");
   second.once("dialog",dialog=>dialog.dismiss());await second.getByRole("link",{name:"Resource library",exact:true}).click();
   await expect(second).toHaveURL(/\/preferences$/);await expect(voice(second)).toHaveValue("Second tab's unconfirmed preference");
   second.once("dialog",dialog=>dialog.accept());await second.getByRole("button",{name:"Reload saved preferences"}).click();
   await expect(voice(second)).toHaveValue("First tab's confirmed preference");await expect(save(second)).toBeDisabled();await second.close();
  }finally{await saveProfile(client,original.profile);}
 });
 test("proposes preferred taxonomy, downloads actual saved packets and blocks a stale export",async({page},info)=>{
  const client=await session(),original=await profile(client);
  await saveProfile(client,{voice_notes:"PRIVATE_PROFILE_MARKER",topics:["Faith, hope"],themes:["Practicing welcome"]});
  const title="Synthetic publication manuscript "+randomUUID(),body="Saved fictional source text for publication review.";
  const created=await client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title,author:"Fictional author",audience:"Community volunteers",body_text:body,source_label:"Synthetic publication browser source",source_url:"https://example.com/fictional-source",metadata:{website_summary:"A fictional summary for readers.",seo_description:"Fictional invitation to welcome.",source_file:"PRIVATE_FILE_MARKER",provider_record_id:"PRIVATE_PROVIDER_MARKER"}}});
  expect(created.error).toBeNull();const id=created.data.resourceId;
  try{
   await signIn(page);await page.goto("/workspace/writing/"+id);
   const guidance=page.getByRole("region",{name:"Confirmed writing guidance"});
   await guidance.getByRole("combobox",{name:"Preferred topic",exact:true}).selectOption("Faith, hope");
   await guidance.getByRole("button",{name:"Propose topic",exact:true}).click();
   const topicProposal=page.getByRole("article",{name:"Proposal: Classify with a preferred topic: Faith, hope"});await expect(topicProposal).toBeVisible();
   expect((await client.rpc("writer_get_resource",{resource_id:id})).data.resource.topics).toEqual([]);
   await topicProposal.getByRole("checkbox").check();await topicProposal.getByRole("button",{name:"Approve and save revision"}).click();
   await expect(page.getByText("Revision 2 · Original preserved",{exact:true})).toBeVisible();
   await guidance.getByRole("combobox",{name:"Preferred theme",exact:true}).selectOption("Practicing welcome");await guidance.getByRole("button",{name:"Propose theme",exact:true}).click();
   const themeProposal=page.getByRole("article",{name:"Proposal: Classify with a preferred theme: Practicing welcome"});await expect(themeProposal).toBeVisible();
   await themeProposal.getByRole("checkbox").check();await themeProposal.getByRole("button",{name:"Approve and save revision"}).click();
   await expect(page.getByText("Revision 3 · Original preserved",{exact:true})).toBeVisible();
   const pending=await client.rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:3,proposed_patch:{body_text:"PRIVATE_PROPOSAL_MARKER"},proposal_reason:"Synthetic pending proposal",source_evidence:"Fictional private proposal"});expect(pending.error).toBeNull();
   expect((await client.rpc("writer_save_working_draft",{resource_id:id,expected_version:0,base_revision:3,request_id:randomUUID(),draft_values:{body_text:"PRIVATE_DRAFT_MARKER"}})).error).toBeNull();
   await page.getByRole("button",{name:"Prepare publication packet",exact:true}).click();
   const packet=page.getByRole("region",{name:"Publication preparation"});await expect(packet.getByRole("button",{name:"Download structured packet"})).toBeVisible();
   const jsonDownload=page.waitForEvent("download");await packet.getByRole("button",{name:"Download structured packet"}).click();
   const downloaded=await jsonDownload;expect(downloaded.suggestedFilename()).toBe("writing-"+id+"-r3.json");
   const raw=readFileSync((await downloaded.path())!,"utf8"),data=JSON.parse(raw);
   expect(data.content.bodyText).toBe(body);expect(data.content.topics).toEqual(["Faith, hope"]);expect(data.content.themes).toEqual(["Practicing welcome"]);
   expect(data.pendingProposals).toBe(1);expect(data.checklist.filter((x:{status:string})=>x.status==="human_review")).toHaveLength(5);expect(raw).not.toContain("PRIVATE_");
   const textDownload=page.waitForEvent("download");await packet.getByRole("button",{name:"Download handoff text"}).click();
   const text=readFileSync((await (await textDownload).path())!,"utf8");expect(text).toContain(body);expect(text).toContain("revision 3");expect(text).toContain("This packet is not published.");expect(text).not.toContain("PRIVATE_");
   await packet.getByRole("button",{name:"Copy website summary"}).click();await expect(packet.getByRole("status")).toContainText("Website summary copied.");
   await packet.screenshot({path:"test-results/writer-publication-"+info.project.name+".png"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const newer=await client.rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:3,proposed_patch:{audience:"Updated fictional readers"},proposal_reason:"Synthetic concurrent update",source_evidence:"Explicit test instruction"});expect(newer.error).toBeNull();
   expect((await client.rpc("writer_decide_proposal",{proposal_id:newer.data.proposalId,expected_revision:3,decision:"approve"})).error).toBeNull();
   const unexpectedDownloads:string[]=[];page.on("download",d=>unexpectedDownloads.push(d.suggestedFilename()));
   await packet.getByRole("button",{name:"Download structured packet"}).click();await expect(packet.getByRole("status")).toContainText("This saved revision changed.");expect(unexpectedDownloads).toEqual([]);
   await page.reload();await expect(page.getByText("Revision 4 · Original preserved",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Prepare publication packet",exact:true}).click();
   const latestDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Download structured packet"}).click();
   const latest=JSON.parse(readFileSync((await (await latestDownload).path())!,"utf8"));expect(latest.revision).toBe(4);expect(latest.content.audience).toBe("Updated fictional readers");
  }finally{await saveProfile(client,original.profile);}
 });
 test("revocation removes an open private preference editor and blocks saving",async({page})=>{
  const client=await session(),operator=await session("operator"),f=fixtures(),original=await profile(client);
  await saveProfile(client,{voice_notes:"Synthetic private preference for revocation"});let revoked=false;
  try{
   await signIn(page);await preferences(page);await voice(page).fill("Synthetic unconfirmed private preference");
   const result=await operator.rpc("revoke_bundle_entitlement",{target_entitlement_id:f.writer.entitlementId,revocation_reason:"Synthetic profile browser lifecycle"});expect(result.error).toBeNull();revoked=true;
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await expect(page.getByRole("heading",{name:"Writing isn't included in your current access"})).toBeVisible();await expect(voice(page)).toHaveCount(0);
   await expect(page.getByText("Synthetic unconfirmed private preference",{exact:true})).toHaveCount(0);
   expect((await client.rpc("writer_save_profile",{expected_revision:1,request_id:randomUUID(),profile_input:null,confirm_preferences:true})).error?.code).toBe("42501");
  }finally{
   if(revoked){const restored=await operator.rpc("issue_bundle_assignment",{target_workspace_id:f.writer.workspaceId,target_bundle_key:"writer_editor",idempotency_key:"profile-browser-restore-"+randomUUID(),target_expires_at:null});expect(restored.error).toBeNull();f.writer.entitlementId=restored.data.entitlement_id;writeFileSync(".bundle-local/fixtures.json",JSON.stringify(f,null,2));}
   await saveProfile(client,original.profile);
  }
 });
});
