import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function session(){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));
 expect(c.url).toBe("http://127.0.0.1:58521");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});
 const f=fixtures().writer;
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();
 return client;
}
async function signIn(page:Page){
 const f=fixtures().writer;
 await page.goto("/login?legacy=1");
 await page.getByLabel("Email",{exact:true}).fill(f.email);
 await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page).toHaveURL(/\/workspace$/);
}
async function saved(page:Page){await expect(page.getByText(/^Working draft saved ·/)).toBeVisible();}
async function editor(page:Page,id:string){
 await page.goto("/workspace/writing/"+id);
 await page.getByRole("button",{name:"Propose an improvement"}).click();
 await expect(page.getByRole("textbox",{name:"Proposed text",exact:true})).toBeEnabled();
}
test.describe("Writer draft recovery and library connections",()=>{
 test.setTimeout(120000);
 test.skip(process.env.WRITER_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional accounts.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("recovers an import after autosave failure, reload and a lost successful response",async({page})=>{
  const client=await session(),existing=await client.rpc("writer_get_working_draft",{resource_id:null});
  expect(existing.error).toBeNull();
  expect((await client.rpc("writer_clear_working_draft",{resource_id:null,expected_version:existing.data.version})).error).toBeNull();
  const title="Synthetic recovered manuscript "+randomUUID(),body="An unfinished fictional manuscript worth recovering.";
  await signIn(page);await page.goto("/workspace/writing/new");
  await page.route("**/api/writing/drafts",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic draft save failure."})}):route.continue());
  await page.getByRole("textbox",{name:"Title",exact:true}).fill(title);
  await page.getByRole("textbox",{name:"Source label",exact:true}).fill("Synthetic recovery source");
  await page.getByRole("textbox",{name:"Source text",exact:true}).fill(body);
  await expect(page.getByText("Synthetic draft save failure.",{exact:true})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Source text",exact:true})).toHaveValue(body);
  await page.unroute("**/api/writing/drafts");
  await page.getByRole("button",{name:"Retry saving draft"}).click();await saved(page);
  await page.reload();
  await expect(page.getByText("Your unfinished work was restored.",{exact:true})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Title",exact:true})).toHaveValue(title);
  await expect(page.getByRole("textbox",{name:"Source text",exact:true})).toHaveValue(body);
  let importedId="";
  await page.route("**/api/writing/import",async route=>{
   const response=await route.fetch();expect(response.ok()).toBe(true);
   importedId=(await response.json()).resourceId;await route.abort("failed");
  });
  await page.getByRole("button",{name:"Save resource and review"}).click();
  await expect.poll(()=>importedId).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.getByRole("alert").filter({hasText:"Failed to fetch"})).toBeVisible();
  await page.unroute("**/api/writing/import");await page.reload();
  await expect(page.getByText("Your unfinished work was restored.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Save resource and review"}).click();
  await expect(page).toHaveURL(new RegExp("/workspace/writing/"+importedId+"$"));
  await expect(page.getByRole("heading",{name:title,level:1,exact:true})).toBeVisible();
  const found=await client.rpc("writer_list_resources",{search_text:title});
  expect(found.error).toBeNull();expect(found.data.matchingCount).toBe(1);
  expect((await client.rpc("writer_get_working_draft",{resource_id:null})).data.values).toBeNull();
 });
 test("keeps a conflicting tab's edits and restores a stale draft for explicit comparison",async({page,context},info)=>{
  const client=await session();
  const created=await client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title:"Synthetic two-tab manuscript "+randomUUID(),body_text:"Original fictional text.",source_label:"Synthetic draft browser source"}});
  expect(created.error).toBeNull();const id=created.data.resourceId;
  await signIn(page);await editor(page,id);
  const second=await context.newPage();await editor(second,id);
  await page.getByRole("textbox",{name:"Proposed text",exact:true}).fill("First tab's fictional improvement.");await saved(page);
  await second.getByRole("textbox",{name:"Proposed text",exact:true}).fill("Second tab's unfinished private thought.");
  await expect(second.getByText(/Another version was saved. Your edits have not overwritten it./)).toBeVisible();
  await expect(second.getByRole("textbox",{name:"Proposed text",exact:true})).toHaveValue("Second tab's unfinished private thought.");
  expect((await client.rpc("writer_get_resource",{resource_id:id})).data.resource.body_text).toBe("Original fictional text.");
  second.once("dialog",dialog=>dialog.accept());
  await second.getByRole("button",{name:"Load saved draft"}).click();
  await expect(second.getByRole("textbox",{name:"Proposed text",exact:true})).toHaveValue("First tab's fictional improvement.");
  await second.getByRole("textbox",{name:"Why this helps",exact:true}).fill("Synthetic clearer invitation");
  await second.getByRole("button",{name:"Save proposal for comparison"}).click();
  const proposal=second.getByRole("article",{name:"Proposal: Synthetic clearer invitation"});
  await expect(proposal).toBeVisible();
  await second.getByRole("button",{name:"Propose an improvement"}).click();
  await second.getByRole("textbox",{name:"Proposed text",exact:true}).fill("Another unfinished thought for later.");await saved(second);
  await proposal.getByRole("checkbox").check();
  await proposal.getByRole("button",{name:"Approve and save revision"}).click();
  await expect(second.getByText("Revision 2 · Original preserved",{exact:true})).toBeVisible();
  await second.getByRole("button",{name:"Propose an improvement"}).click();
  await expect(second.getByText(/Your unfinished draft is based on revision 1; the resource is now revision 2/)).toBeVisible();
  await expect(second.getByRole("textbox",{name:"Proposed text",exact:true})).toHaveValue("Another unfinished thought for later.");
  await expect(second.getByRole("button",{name:"Save proposal for comparison"})).toBeDisabled();
  await second.getByText(/Your unfinished draft is based on revision 1; the resource is now revision 2/).locator("..").screenshot({path:"test-results/writer-draft-recovery-"+info.project.name+".png"});
  await second.getByRole("button",{name:"Compare this draft with the current revision"}).click();await saved(second);
  await expect(second.getByRole("button",{name:"Save proposal for comparison"})).toBeEnabled();
  expect((await client.rpc("writer_get_resource",{resource_id:id})).data.resource.body_text).toBe("First tab's fictional improvement.");
  await second.getByRole("textbox",{name:"Proposed text",exact:true}).scrollIntoViewIfNeeded();
  expect(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  second.once("dialog",dialog=>dialog.accept());await second.getByRole("button",{name:"Discard working draft"}).click();
  await expect(second.getByRole("textbox",{name:"Proposed text",exact:true})).toHaveValue("First tab's fictional improvement.");
  await second.close();
 });
 test("searches source text, explains candidate signals and proposes a connection before applying it",async({page},info)=>{
  const client=await session(),key="syntheticconnection"+randomUUID().replaceAll("-",""),sharedTopic="Synthetic topic "+randomUUID();
  async function create(title:string){
   const result=await client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title,body_text:key+" is a fictional source phrase.",topics:[sharedTopic],source_label:"Synthetic connection browser source"}});
   expect(result.error).toBeNull();return result.data.resourceId;
  }
  const firstTitle="Synthetic source manuscript "+randomUUID(),otherTitle="Synthetic related manuscript "+randomUUID();
  const id=await create(firstTitle),other=await create(otherTitle);
  await signIn(page);await page.goto("/workspace/writing");
  await page.getByLabel("Search resources",{exact:true}).fill(key);
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.getByRole("link",{name:new RegExp(firstTitle)})).toBeVisible();
  await expect(page.getByRole("link",{name:new RegExp(otherTitle)})).toBeVisible();
  await page.getByRole("link",{name:new RegExp(firstTitle)}).click();
  const connections=page.getByRole("region",{name:"Related and duplicate candidates"});
  await expect(connections.getByText("Same recorded text (ignoring whitespace)",{exact:true})).toBeVisible();
  await connections.scrollIntoViewIfNeeded();
  await connections.screenshot({path:"test-results/writer-connections-"+info.project.name+".png"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await connections.getByRole("button",{name:"Propose as related",exact:true}).click();
  const proposal=page.getByRole("article",{name:"Proposal: Connect a related resource: "+otherTitle});
  await expect(proposal).toBeVisible();
  expect((await client.rpc("writer_get_resource",{resource_id:id})).data.resource.metadata.related_resource_ids).toBeUndefined();
  await proposal.getByRole("checkbox").check();await proposal.getByRole("button",{name:"Approve and save revision"}).click();
  await expect(page.getByText("Revision 2 · Original preserved",{exact:true})).toBeVisible();
  expect((await client.rpc("writer_get_resource",{resource_id:id})).data.resource.metadata.related_resource_ids).toEqual([other]);
  await expect(connections.getByRole("button",{name:"Related resource recorded",exact:true})).toBeDisabled();
 });
});
