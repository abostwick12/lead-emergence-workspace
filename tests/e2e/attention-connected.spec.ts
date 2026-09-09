import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
const fixtures=()=>JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));
async function signIn(page:Page,role="layoutAll"){
 const f=fixtures()[role];expect(f.email).toMatch(/@example\.invalid$/);
 await page.goto("/login?legacy=1&next=%2Fworkspace%2Fattention");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/attention$/);
}
const cues=(p:Page)=>p.locator(".attention-cue");
async function savedLayout(){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8")),f=fixtures().layoutAll;
 expect(c.url).toBe("http://127.0.0.1:58521");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();
 const r=await client.rpc("get_workspace_layout");expect(r.error).toBeNull();return {client,preferences:r.data.preferences};
}
test.describe("native shared saved-work attention",()=>{
 test.setTimeout(120000);
 test.skip(process.env.ATTENTION_LOCAL_ACCEPTANCE!=="true","Requires the explicit fictional all-bundle local fixtures.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("renders source-linked counts, priority filtering and complete current pages",async({page},info)=>{
  await signIn(page);await expect(cues(page)).toHaveCount(25);
  await expect(page.getByRole("heading",{name:"What deserves attention",exact:true})).toBeVisible();
  await page.getByText("What was checked",{exact:true}).click();await expect(page.locator(".attention-coverage li")).toHaveCount(22);
  await page.getByLabel("Compare dates against",{exact:true}).fill("2026-09-09");await page.getByRole("button",{name:"Apply date",exact:true}).click();
  await expect(page.locator(".attention-overview")).toContainText("18,062");
  await page.getByText("What was checked",{exact:true}).click();
  if(await page.locator(".attention-coverage").evaluate(el=>(el as HTMLDetailsElement).open))await page.getByText("What was checked",{exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:"test-results/attention-"+info.project.name+".png",fullPage:false,scale:"css"});
  await cues(page).first().evaluate(el=>{
   const header=document.querySelector(".workspace-header")!;
   const top=getComputedStyle(header).position==="sticky"?header.getBoundingClientRect().height+12:16;
   window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-top);
  });
  await expect(cues(page).first().getByRole("link")).toBeVisible();
  expect(await cues(page).first().evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(16);
  await page.screenshot({path:"test-results/attention-cue-"+info.project.name+".png",fullPage:false,scale:"css"});
  const first=await cues(page).getByRole("heading").allTextContents();
  await page.getByRole("button",{name:"Next attention page",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Showing 26–50"})).toBeVisible();
  expect(await cues(page).getByRole("heading").allTextContents()).not.toEqual(first);
  await page.getByRole("combobox",{name:"Saved-work source",exact:true}).selectOption("writer_editor");
  await expect(cues(page)).toHaveCount(25);await expect(cues(page).first()).toContainText("Writing");
  await page.getByRole("combobox",{name:"Priority",exact:true}).selectOption("high");
  await expect(page.getByRole("heading",{name:"No cues match these filters",exact:true})).toBeVisible();await expect(cues(page)).toHaveCount(0);
  await page.getByRole("combobox",{name:"Priority",exact:true}).selectOption("");
  await expect(cues(page)).toHaveCount(25);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test("opens the precise task in its original authorized editor",async({page})=>{
  await signIn(page);await expect(cues(page)).toHaveCount(25);
  await page.getByRole("combobox",{name:"Saved-work source",exact:true}).selectOption("nonprofit_founder");
  const link=cues(page).getByRole("link",{name:"Open exact task →",exact:true}).first();await expect(link).toBeVisible();
  const href=await link.getAttribute("href");expect(href).toMatch(/\/workspace\/nonprofit\/.*#task-/);
  await link.click();await expect(page).toHaveURL("http://localhost:3125"+href);
  const target=href!.split("#")[1];await expect(page.locator('[id="'+target+'"]')).toBeVisible();
  await expect(page.locator('[id="'+target+'"] summary')).toBeFocused();
 });
 test("clears failed results and provides a real retry",async({page})=>{
  await signIn(page);await expect(cues(page)).toHaveCount(25);
  await page.route("**/api/bundles/attention",r=>r.request().method()==="POST"?r.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic attention interruption."})}):r.continue());
  await page.getByRole("button",{name:"Refresh attention",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Synthetic attention interruption."})).toBeVisible();await expect(cues(page)).toHaveCount(0);
  await page.unroute("**/api/bundles/attention");await page.getByRole("button",{name:"Retry attention",exact:true}).click();await expect(cues(page)).toHaveCount(25);
 });
 test("rejects late results after a newer filter selection",async({page})=>{
  await signIn(page);await expect(cues(page)).toHaveCount(25);
  let release!:()=>void,arrived!:()=>void;const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>arrived=r);
  await page.route("**/api/bundles/attention",async route=>{
   const body=route.request().postDataJSON();if(body.bundleKey!=="writer_editor"||body.priority!==null)return route.continue();
   const response=await route.fetch();arrived();await gate;await route.fulfill({response}).catch(()=>{});
  });
  await page.getByRole("combobox",{name:"Saved-work source",exact:true}).selectOption("writer_editor");await ready;
  await page.getByRole("combobox",{name:"Priority",exact:true}).selectOption("high");
  await expect(page.getByRole("heading",{name:"No cues match these filters",exact:true})).toBeVisible();
  release();await page.unroute("**/api/bundles/attention");
  await expect(cues(page)).toHaveCount(0);await expect(page.getByRole("combobox",{name:"Priority",exact:true})).toHaveValue("high");
 });
 test("distinguishes missing authority from an assigned empty source set",async({page})=>{
  await signIn(page,"reader");await expect(page.getByRole("heading",{name:"Workspace attention is unavailable",exact:true})).toBeVisible();await expect(cues(page)).toHaveCount(0);
  await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());
  await signIn(page,"layout");await expect(page.getByRole("heading",{name:"No saved-work sources assigned yet",exact:true})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Saved-work source",exact:true}).locator("option")).toHaveCount(1);
 });
 test("keeps the Home attention widget under confirmed user layout control",async({page},info)=>{
  const {client,preferences}=await savedLayout();
  try{
   await signIn(page);await page.goto("/workspace/layout");
   await expect(page.getByRole("checkbox",{name:"Show What deserves attention",exact:true})).toBeVisible();
   await page.getByRole("checkbox",{name:"Show What deserves attention",exact:true}).uncheck();
   await page.getByRole("button",{name:"Preview layout",exact:true}).click();
   await page.getByRole("checkbox",{name:"I reviewed this preview and confirm these layout changes."}).check();
   await page.getByRole("button",{name:"Confirm and save layout",exact:true}).click();
   await expect(page.getByRole("status").filter({hasText:"Layout saved."})).toBeVisible();
   await page.goto("/workspace");await expect(page.locator(".native-attention-compact")).toHaveCount(0);
   await page.goto("/workspace/attention");await expect(cues(page)).toHaveCount(25);
  }finally{
   const current=await client.rpc("get_workspace_layout");
   const r=await client.rpc("save_workspace_layout",{preferences,expected_revision:current.data.revision,expected_authority_revision:current.data.authorityRevision,request_id:randomUUID(),confirmed:true});expect(r.error).toBeNull();
  }
  await page.goto("/workspace");await expect(page.locator(".native-attention-compact")).toBeVisible();
  await expect(page.locator(".native-attention-compact .attention-cue")).toHaveCount(3);
  await expect(page.locator(".native-attention-compact .attention-overview")).toHaveCount(0);
  const explanation=page.locator(".native-attention-compact .attention-cue").nth(1).locator("details");
  await explanation.getByText("Why this appears",{exact:true}).click();
  await expect(explanation.getByText(/Next move:/)).toBeVisible();
  await explanation.getByText("Why this appears",{exact:true}).click();
  await page.locator(".native-attention-compact").evaluate(el=>{
   const header=document.querySelector(".workspace-header")!;
   const top=getComputedStyle(header).position==="sticky"?header.getBoundingClientRect().height+12:16;
   window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-top);
  });
  await page.screenshot({path:"test-results/attention-home-"+info.project.name+".png",scale:"css"});
 });
});
