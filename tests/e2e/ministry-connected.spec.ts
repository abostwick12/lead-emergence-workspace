import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
import {emptyProfile,type MinistryDocument} from "../../lib/ministry-bundle/contracts";
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function session(role="minister"){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(c.url).toBe("http://127.0.0.1:58421");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}}),f=fixtures()[role];
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();return client;
}
type LocalClient=Awaited<ReturnType<typeof session>>;
async function get(client:LocalClient,kind:string,id?:string){const r=await client.rpc("ministry_get_document",{p_kind:kind,...(id?{p_document_id:id}:{})});expect(r.error).toBeNull();return r.data.document as MinistryDocument|null;}
async function save(client:LocalClient,kind:string,data:unknown,base:MinistryDocument|null){
 const r=await client.rpc("ministry_save_document",{p_kind:kind,p_document_id:base?.id??null,p_expected_revision:base?.revision??0,p_request_id:randomUUID(),p_data:data,p_confirm_profile:kind==="profile"});
 expect(r.error).toBeNull();return r.data.document as MinistryDocument;
}
async function signIn(page:Page,role="minister"){
 const f=fixtures()[role];await page.goto("/login?legacy=1");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
}
const confirm=(page:Page)=>page.getByRole("checkbox",{name:/I confirm this exact configuration/});
const profileSave=(page:Page)=>page.getByRole("button",{name:"Confirm and save preferences",exact:true});
const notice=(page:Page)=>page.getByRole("status").filter({hasText:/Saved revision/});
test.describe("Ministry native client workflow",()=>{
 test.setTimeout(120000);
 test.skip(process.env.MINISTRY_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional accounts.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("discloses bundle-specific reading and proposal limits without approving an incomplete connection",async({page})=>{
  await page.goto("/oauth/consent");
  await expect(page.getByText(/Ministry can read your current theological preferences/)).toBeVisible();
  await expect(page.getByText(/Private working drafts and profile revision history remain native-only/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Allow access",exact:true})).toBeDisabled();
 });
 test("starts without inherited theology, resets confirmation and survives failed saves",async({page},info)=>{
  const client=await session(),original=await get(client,"profile");await save(client,"profile",null,original);
  try {
   await signIn(page);await page.goto("/workspace/ministry/profile");
   const context=page.getByRole("textbox",{name:"Tradition and context",exact:true});
   await expect(context).toHaveValue("");await expect(profileSave(page)).toBeDisabled();
   await context.fill("Synthetic independent client context.");
   await page.getByRole("button",{name:"Add a position",exact:true}).click();
   await page.getByRole("textbox",{name:"Position 1 statement *",exact:true}).fill("Fictional inferred position, not a confirmed belief.");
   await page.getByRole("combobox",{name:"Position 1 status",exact:true}).selectOption("inferred");
   await confirm(page).check();await context.fill("Synthetic independent context, revised.");
   await expect(confirm(page)).not.toBeChecked();await confirm(page).check();
   await page.route("**/api/ministry/profile",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic save failure."})}):route.continue());
   await profileSave(page).click();await expect(page.getByRole("alert").filter({hasText:"Synthetic save failure."})).toBeVisible();
   await expect(context).toHaveValue("Synthetic independent context, revised.");
   await page.unroute("**/api/ministry/profile");await profileSave(page).click();await expect(notice(page)).toBeVisible();
   await expect(page.getByRole("combobox",{name:"Position 1 status",exact:true})).toHaveValue("inferred");
   expect((await get(client,"profile"))?.data).toMatchObject({positions:[{epistemicState:"inferred"}]});
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:"test-results/ministry-profile-"+info.project.name+".png",fullPage:true});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }finally{await save(client,"profile",original?.data??null,await get(client,"profile"));}
 });
 test("creates source-linked research, downloads the saved bibliography and compares proposals",async({page},info)=>{
  const client=await session(),title="Fictional teaching "+randomUUID();
  await signIn(page);await page.goto("/workspace/ministry/research/new");
  await page.getByRole("textbox",{name:"Project title *",exact:true}).fill(title);
  await page.getByRole("textbox",{name:"Research question *",exact:true}).fill("How should this fictional class practice listening?");
  await page.getByRole("button",{name:"Add a source",exact:true}).click();
  await page.getByRole("textbox",{name:"Source 1 title *",exact:true}).fill("Fictional source for acceptance testing");
  await page.getByRole("combobox",{name:"Source 1 layer",exact:true}).selectOption("academic_interpretation");
  await page.getByRole("textbox",{name:"Source 1 reference *",exact:true}).fill("Synthetic section 3");
  await page.getByRole("textbox",{name:"Source 1 excerpt or recorded evidence",exact:true}).fill("SYNTHETIC_EVIDENCE_BROWSER_MARKER");
  await page.getByRole("button",{name:"Add a note",exact:true}).click();
  await page.getByRole("textbox",{name:"Note 1 text *",exact:true}).fill("A fictional observation linked to its recorded source.");
  await page.getByRole("checkbox",{name:/Fictional source for acceptance testing/}).check();
  await page.getByRole("textbox",{name:"Teaching outline",exact:true}).fill("Begin with the fictional question. Compare source [1].");
  await page.getByRole("button",{name:"Save research",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/ministry\/research\/[a-f0-9-]{36}$/);
  const id=new URL(page.url()).pathname.split("/").at(-1)!;const current=await get(client,"research",id);expect(current?.revision).toBe(1);
  await expect(page.getByRole("textbox",{name:"Project title *",exact:true})).toHaveValue(title);
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Download saved research & bibliography",exact:true}).click();
  const download=await downloadPromise;const path=await download.path();expect(path).toBeTruthy();const text=readFileSync(path!,"utf8");
  expect(text).toContain("Saved revision 1");expect(text).toContain("SYNTHETIC_EVIDENCE_BROWSER_MARKER");expect(text).toContain("Synthetic section 3");
  const proposed=await client.rpc("ministry_propose_research",{p_document_id:id,p_expected_revision:1,p_request_id:randomUUID(),p_patch:{teachingOutline:"Compare evidence, name uncertainty, then teach."},p_reason:"Make the reasoning explicit.",p_evidence:"Fictional recorded source [1]."});expect(proposed.error).toBeNull();
  await page.reload();await page.getByRole("button",{name:"Compare this proposal",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Current saved research",exact:true})).toBeVisible();
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Approve compared changes",exact:true}).click();await expect(notice(page)).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Teaching outline",exact:true})).toHaveValue("Compare evidence, name uncertainty, then teach.");
  await page.getByText("Revision 1 · Original · User saved",{exact:true}).click();
  await page.getByRole("button",{name:"Review a copy of revision 1",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Teaching outline",exact:true})).toHaveValue("Begin with the fictional question. Compare source [1].");
  expect((await get(client,"research",id))?.revision).toBe(2);
  await page.getByRole("button",{name:"Save research",exact:true}).click();await expect(notice(page)).toBeVisible();
  expect((await get(client,"research",id))?.revision).toBe(3);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:"test-results/ministry-research-"+info.project.name+".png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test("imports prior teaching text, finds it by content, and denies foreign records",async({page},info)=>{
  const marker="archiveunique"+randomUUID().replaceAll("-",""),title="Synthetic archive "+randomUUID();
  await signIn(page);await page.goto("/workspace/ministry/archive/new");
  await page.getByRole("textbox",{name:"Teaching title *",exact:true}).fill(title);
  await page.getByRole("textbox",{name:"Source description *",exact:true}).fill("Fictional original teaching manuscript");
  await page.getByLabel("Import a plain-text file",{exact:true}).setInputFiles({name:"fictional-teaching.txt",mimeType:"text/plain",buffer:Buffer.from("Earlier teaching text "+marker)});
  await expect(page.getByRole("textbox",{name:"Teaching text",exact:true})).toHaveValue("Earlier teaching text "+marker);
  await page.getByRole("button",{name:"Save teaching",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/ministry\/archive\/[a-f0-9-]{36}$/);
  const id=new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("link",{name:"Teaching archive",exact:true}).click();
  await page.getByRole("searchbox",{name:"Search prior teaching",exact:true}).fill(marker);
  await page.getByRole("button",{name:"Search",exact:true}).click();await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:"test-results/ministry-archive-"+info.project.name+".png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const other=await session("ministerOther"),denied=await other.rpc("ministry_get_document",{p_kind:"archive",p_document_id:id});expect(denied.error?.code).toBe("P0002");
 });
 test("stale profile tabs preserve edits and require an explicit reload decision",async({page,context})=>{
  const client=await session(),original=await get(client,"profile");await save(client,"profile",emptyProfile,original);
  try {
   await signIn(page);await page.goto("/workspace/ministry/profile");const second=await context.newPage();await second.goto("/workspace/ministry/profile");
   const field=(p:Page)=>p.getByRole("textbox",{name:"Tradition and context",exact:true});
   await expect(field(second)).toBeVisible();
   await field(page).fill("First tab's fictional preference");await confirm(page).check();await profileSave(page).click();await expect(notice(page)).toBeVisible();
   await field(second).fill("Second tab's unsaved preference");await confirm(second).check();await profileSave(second).click();
   await expect(second.getByRole("alert").filter({hasText:"Your work was not applied"})).toBeVisible();await expect(field(second)).toHaveValue("Second tab's unsaved preference");
   second.once("dialog",d=>d.dismiss());await second.getByRole("link",{name:"Research & teaching",exact:true}).click();await expect(second).toHaveURL(/\/profile$/);
   second.once("dialog",d=>d.accept());await second.getByRole("button",{name:"Open latest saved revision",exact:true}).click();
   await expect(field(second)).toHaveValue("First tab's fictional preference");await expect(profileSave(second)).toBeDisabled();await second.close();
  }finally{await save(client,"profile",original?.data??null,await get(client,"profile"));}
 });
});
