import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
const empty={schemaVersion:"1.0",hiddenItemIds:[] as string[],pinnedNavigationIds:[] as string[],pinnedWidgetIds:[] as string[],orderOverrides:{} as Record<string,number>,defaultWorkspaceRoute:"/workspace"};
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function session(role="layoutAll"){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(c.url).toBe("http://127.0.0.1:58521");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}}),f=fixtures()[role];
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();return client;
}
async function reset(role="layoutAll"){
 const client=await session(role),current=await client.rpc("get_workspace_layout");expect(current.error).toBeNull();
 const r=await client.rpc("save_workspace_layout",{preferences:empty,expected_revision:current.data.revision,expected_authority_revision:current.data.authorityRevision,request_id:randomUUID(),confirmed:true});expect(r.error).toBeNull();return client;
}
async function signIn(page:Page,role="layoutAll",next:string|null="/workspace/layout",expected=/\/workspace\/layout$/){
 const f=fixtures()[role];await page.goto("/login?legacy=1"+(next!==null?"&next="+encodeURIComponent(next):""));
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(expected);
}
const confirmation=(p:Page)=>p.getByRole("checkbox",{name:"I reviewed this preview and confirm these layout changes."});
async function previewSave(page:Page){
 await page.getByRole("button",{name:"Preview layout",exact:true}).click();
 await expect(page.getByRole("button",{name:"Confirm and save layout",exact:true})).toBeDisabled();
 await confirmation(page).check();await page.getByRole("button",{name:"Confirm and save layout",exact:true}).click();
}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
test.describe("native user-owned Workspace layout",()=>{
 test.setTimeout(120000);
 test.skip(process.env.LAYOUT_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional layout fixtures.");
 test.beforeEach(async({baseURL})=>{expect(baseURL).toBe("http://localhost:3125");await reset();});
 test("previews, confirms, persists and recovers a useful layout",async({page},info)=>{
  const client=await session();await signIn(page);
  await expect(page.getByRole("heading",{name:"Workspace layout",exact:true})).toBeVisible();
  await page.getByRole("checkbox",{name:"Show Writing",exact:true}).uncheck();
  await page.getByRole("checkbox",{name:"Pin Investing",exact:true}).check();
  await page.getByRole("checkbox",{name:"Show Publication queue",exact:true}).uncheck();
  await page.getByRole("button",{name:"Move Nonprofit up",exact:true}).click();
  await page.getByRole("button",{name:"Move Nonprofit up",exact:true}).click();
  await page.getByRole("button",{name:"Move Founder next moves up",exact:true}).click();
  await page.getByRole("combobox",{name:"Starting workspace",exact:true}).selectOption("/workspace/investing");
  await page.getByRole("button",{name:"Preview layout",exact:true}).click();
  const preview=page.getByLabel("Layout preview",{exact:true});
  await expect(preview).toContainText("Navigation: Home → Investing → Executive → Nonprofit → Ministry");
  await expect(preview).toContainText("Home attention cards: What deserves attention → Executive attention brief → Founder next moves → Upcoming teaching");
  expect((await client.rpc("get_workspace_layout")).data.preferences).toEqual(empty);
  await confirmation(page).check();await page.getByRole("button",{name:"Confirm and save layout",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  const saved=(await client.rpc("get_workspace_layout")).data;expect(saved.preferences.hiddenItemIds).toContain("writer_editor:writer.nav.writing");
  await page.reload();await expect(page.getByRole("checkbox",{name:"Show Writing",exact:true})).not.toBeChecked();
  await page.getByRole("checkbox",{name:"Show Writing",exact:true}).check();await previewSave(page);
  await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  await page.getByRole("combobox",{name:"Earlier saved version",exact:true}).selectOption(String(saved.revision));
  await page.getByRole("button",{name:"Load version as draft",exact:true}).click();
  expect((await client.rpc("get_workspace_layout")).data.preferences.hiddenItemIds).not.toContain("writer_editor:writer.nav.writing");
  await previewSave(page);await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  // Wait for the saved composition, not merely the save acknowledgement.
  const bundleLinks=page.locator('nav[aria-label="Workspace navigation"] a');
  await expect(page.locator('nav[aria-label="Workspace navigation"] a[href="/workspace/writing"]')).toHaveCount(0);
  const routes=await bundleLinks.evaluateAll(links=>links.map(link=>link.getAttribute("href")));
  expect(routes.indexOf("/workspace/investing")).toBeLessThan(routes.indexOf("/workspace/executive"));
  expect(routes.indexOf("/workspace/nonprofit")).toBeLessThan(routes.indexOf("/workspace/ministry"));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/layout-controls-"+info.project.name+".png",fullPage:false});
  await page.getByRole("group",{name:"Home attention cards",exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/layout-cards-"+info.project.name+".png",fullPage:false});await noOverflow(page);
 });
 test("rejects a stale second tab without replacing its draft",async({page,context})=>{
  await signIn(page);const second=await context.newPage();await second.goto("/workspace/layout");
  await expect(second.getByRole("checkbox",{name:"Show Writing",exact:true})).toBeVisible();
  await page.getByRole("checkbox",{name:"Pin Investing",exact:true}).check();await previewSave(page);
  await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  await second.getByRole("checkbox",{name:"Show Writing",exact:true}).uncheck();await previewSave(second);
  await expect(second.getByRole("alert").filter({hasText:"Your layout or access changed"})).toContainText("layout or access changed");
  await expect(second.getByRole("checkbox",{name:"Show Writing",exact:true})).not.toBeChecked();
  await second.getByRole("button",{name:"Discard draft and reload saved layout",exact:true}).click();
  await expect(second.getByRole("checkbox",{name:"Pin Investing",exact:true})).toBeChecked();
  await expect(second.getByRole("checkbox",{name:"Show Writing",exact:true})).toBeChecked();await second.close();
 });
 test("retains a draft through a save interruption and retries the same confirmed change",async({page})=>{
  await signIn(page);await page.getByRole("checkbox",{name:"Show Writing",exact:true}).uncheck();
  await page.route("**/api/bundles/layout",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic save interruption."})}):route.continue());
  await previewSave(page);await expect(page.getByRole("alert").filter({hasText:"Synthetic save interruption"})).toContainText("Synthetic save interruption");
  await expect(page.getByRole("checkbox",{name:"Show Writing",exact:true})).not.toBeChecked();
  await page.unroute("**/api/bundles/layout");await page.getByRole("button",{name:"Confirm and save layout",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
 });
 test("retries an uncertain response after the server committed without adding another version",async({page})=>{
  const client=await session();await signIn(page);
  const before=(await client.rpc("get_workspace_layout")).data;
  await page.getByRole("checkbox",{name:"Show Writing",exact:true}).uncheck();
  let intercepted=false;
  await page.route("**/api/bundles/layout",async route=>{
   if(route.request().method()!=="POST"||intercepted)return route.continue();
   intercepted=true;const saved=await route.fetch();expect(saved.status()).toBe(200);
   await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic uncertain response. Reload to check the saved state."})});
  });
  await previewSave(page);await expect(page.getByRole("alert").filter({hasText:"Synthetic uncertain response"})).toBeVisible();
  expect((await client.rpc("get_workspace_layout")).data.revision).toBe(before.revision+1);
  await page.getByRole("button",{name:"Confirm and save layout",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  expect((await client.rpc("get_workspace_layout")).data.revision).toBe(before.revision+1);
 });
 test("keeps an unsaved domain editor intact when another tab saves a layout",async({page,context})=>{
  await signIn(page,"layoutAll","/workspace/executive/commitment/new",/\/commitment\/new$/);
  await page.getByLabel("Title *",{exact:true}).fill("Unsaved fictional draft must survive layout refresh");
  const layout=await context.newPage();await layout.goto("/workspace/layout");
  await layout.getByRole("checkbox",{name:"Show Writing",exact:true}).uncheck();await previewSave(layout);
  await expect(layout.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  const refreshed=page.waitForResponse(r=>r.url().includes("/api/bundles/experience")&&r.status()===200);
  await page.bringToFront();await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await refreshed;
  await expect(page.getByLabel("Title *",{exact:true})).toHaveValue("Unsaved fictional draft must survive layout refresh");
  await layout.close();
 });
 test("uses the default on ordinary sign-in without hijacking an explicit Home destination",async({page,browser})=>{
  await signIn(page);await page.getByRole("combobox",{name:"Starting workspace",exact:true}).selectOption("/workspace/investing");
  await previewSave(page);await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
  const fresh=await browser.newContext({baseURL:"http://localhost:3125"}),freshPage=await fresh.newPage();
  await signIn(freshPage,"layoutAll",null,/\/workspace\/investing$/);await fresh.close();
  const explicit=await browser.newContext({baseURL:"http://localhost:3125"}),explicitPage=await explicit.newPage();
  await signIn(explicitPage,"layoutAll","/workspace",/\/workspace$/);await explicit.close();
  await page.goto("/workspace");await expect(page).toHaveURL(/\/workspace$/);
 });
 test("discloses missing layout access and a valid Experience-only empty state",async({page})=>{
  await signIn(page,"reader");await expect(page.getByRole("heading",{name:"Workspace layout is unavailable",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Preview layout",exact:true})).toHaveCount(0);
  await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());
  await reset("layout");await signIn(page,"layout");
  await expect(page.getByText("No assigned contributions in this section yet.",{exact:true})).toHaveCount(1);
  await expect(page.getByRole("checkbox",{name:"Show What deserves attention",exact:true})).toBeVisible();
  await previewSave(page);await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();await noOverflow(page);
 });
});
