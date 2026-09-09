import {readFileSync} from "node:fs";
import {test,expect,type Page} from "@playwright/test";
const fixtures=()=>JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));
async function signIn(page:Page,role="layoutAll"){
 const f=fixtures()[role];await page.goto("/login?legacy=1&next=%2Fworkspace%2Fsearch");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/search$/);
}
const field=(page:Page)=>page.getByLabel("Find saved work",{exact:true});
const submit=(page:Page)=>page.getByRole("button",{name:"Search saved work",exact:true});
async function search(page:Page,query="Cedar Harbor"){await field(page).fill(query);await submit(page).click();}
test.describe("native shared search and quick actions",()=>{
 test.setTimeout(120000);
 test.skip(process.env.SEARCH_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional search fixtures.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("searches all 16 scopes, pages 47 saved records, narrows and opens the original",async({page},info)=>{
  await signIn(page);await expect(page.getByText("Search scope · 16 of 16 selected",{exact:true})).toBeVisible();
  await search(page);await expect(page.getByRole("heading",{name:"47 saved records found",exact:true})).toBeVisible();
  const rows=page.locator(".search-result");await expect(rows).toHaveCount(25);await expect(rows.first().getByRole("heading")).toHaveText("Cedar Harbor");
  await page.locator(".search-results").scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/search-results-"+info.project.name+".png",fullPage:false});
  await page.getByRole("button",{name:"Next results",exact:true}).click();await expect(rows).toHaveCount(22);
  await page.getByText(/Search scope ·/).click();await page.getByRole("button",{name:"Clear scopes",exact:true}).click();await expect(rows).toHaveCount(0);await expect(submit(page)).toBeDisabled();
  await page.getByRole("checkbox",{name:"Teaching archive",exact:true}).check();await submit(page).click();
  await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("Ministry");
  await rows.first().getByRole("link",{name:"Open original record →",exact:true}).click();
  await expect(page.getByLabel("Teaching title *",{exact:true})).toHaveValue("P11 Cedar Harbor ministry archive");
 });
 test("shows safe snippets and complete coverage without putting query into the URL",async({page},info)=>{
  let dialogOpened=false;page.on("dialog",async d=>{dialogOpened=true;await d.dismiss();});
  await signIn(page);await search(page,"bodyonlyneedle");
  await expect(page.getByRole("heading",{name:"32 saved records found",exact:true})).toBeVisible();
  await expect(page.locator(".search-result img")).toHaveCount(0);expect(dialogOpened).toBe(false);
  expect(page.url()).toBe("http://localhost:3125/workspace/search");
  await page.getByText("What was searched",{exact:true}).click();await expect(page.getByText("Writing · Saved resources: 32",{exact:true})).toBeVisible();
  await page.locator(".search-results").scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/search-coverage-"+info.project.name+".png",fullPage:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test("explains no matches and excludes another owner's content",async({page})=>{
  await signIn(page);await search(page,"otherownerneedle");await expect(page.getByRole("heading",{name:"No matches in the selected scopes",exact:true})).toBeVisible();
  await expect(page.locator(".search-result")).toHaveCount(0);await expect(page.getByText("No results does not mean your other work is missing.",{exact:false})).toBeVisible();
  await page.getByText(/Search scope ·/).click();await page.getByRole("button",{name:"Clear scopes",exact:true}).click();await expect(submit(page)).toBeDisabled();
 });
 test("removes old results on failure and preserves the query for a retry",async({page})=>{
  await signIn(page);await search(page);await expect(page.locator(".search-result")).toHaveCount(25);
  await page.route("**/api/bundles/search",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic search interruption. Retry your search."})}):route.continue());
  await submit(page).click();await expect(page.getByRole("alert").filter({hasText:"Synthetic search interruption"})).toBeVisible();
  await expect(page.locator(".search-result")).toHaveCount(0);await expect(field(page)).toHaveValue("Cedar Harbor");
  await page.unroute("**/api/bundles/search");await submit(page).click();await expect(page.locator(".search-result")).toHaveCount(25);
 });
 test("does not restore a late response after the query changes",async({page})=>{
  await signIn(page);
  let release!:()=>void,arrived!:()=>void;
  const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>arrived=r);
  await page.route("**/api/bundles/search",async route=>{
   if(route.request().method()!=="POST"||route.request().postDataJSON().query!=="Cedar Harbor")return route.continue();
   const response=await route.fetch();arrived();await gate;await route.fulfill({response}).catch(()=>{});
  });
  await search(page);await ready;await field(page).fill("otherownerneedle");await submit(page).click();
  await expect(page.getByRole("heading",{name:"No matches in the selected scopes",exact:true})).toBeVisible();
  release();await page.unroute("**/api/bundles/search");
  await expect(page.locator(".search-result")).toHaveCount(0);await expect(field(page)).toHaveValue("otherownerneedle");
 });
 test("opens a keyboard-accessible action palette without hijacking Quick Capture",async({page},info)=>{
  await signIn(page);await page.getByRole("button",{name:"Quick actions",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Quick actions",exact:true});
  await expect(dialog).toBeVisible();await expect(dialog.getByLabel("Find an action",{exact:true})).toBeFocused();
  await dialog.getByLabel("Find an action",{exact:true}).fill("meeting");await expect(dialog.getByRole("link",{name:/New meeting plan/})).toBeVisible();
  await page.screenshot({path:"test-results/search-actions-"+info.project.name+".png",fullPage:false});
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(page.getByRole("button",{name:"Quick actions",exact:true})).toBeFocused();
  await page.keyboard.press("Control+Shift+K");await expect(dialog).toBeVisible();await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");await expect(page.getByRole("dialog",{name:"What needs your attention?",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Quick actions",exact:true}).click();
  await page.getByRole("dialog",{name:"Quick actions",exact:true}).getByRole("link",{name:/^New commitment/}).click();
  await expect(page).toHaveURL(/\/executive\/commitment\/new$/);await expect(page.getByLabel("Title *",{exact:true})).toHaveValue("");
 });
 test("every shortcut opens an implemented workflow without an application write",async({page})=>{
  await signIn(page);await expect(page.locator(".search-action")).toHaveCount(10);const links=await page.locator(".search-action").evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute("href"),label:n.textContent})));expect(links).toHaveLength(10);
  const writes:string[]=[];page.on("request",r=>{if(r.method()==="POST"&&new URL(r.url()).origin==="http://localhost:3125"&&new URL(r.url()).pathname.startsWith("/api/"))writes.push(r.url());});
  for(const link of links){
   await page.goto(link.href!);await expect(page.locator("h1")).toBeVisible();
   await expect(page.locator("h1")).not.toContainText(/unavailable|not found|404/i);
   await expect(page.getByRole("alert").filter({hasText:/unavailable|could not|error|failed/i})).toHaveCount(0);
  }
  expect(writes).toEqual([]);
 });
 test("distinguishes unavailable access from an assigned empty search catalog",async({page})=>{
  await signIn(page,"reader");await expect(page.getByRole("heading",{name:"Workspace search is unavailable",exact:true})).toBeVisible();
  await expect(submit(page)).toHaveCount(0);await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());
  await signIn(page,"layout");await expect(page.getByRole("heading",{name:"No searchable bundles assigned yet",exact:true})).toBeVisible();await expect(submit(page)).toHaveCount(0);
 });
});
