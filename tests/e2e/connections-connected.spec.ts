import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {test,expect,type Page} from "@playwright/test";
const fixtures=()=>JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));
const recordId="13333333-3333-4333-8333-333333333333",clientId="p13-fictional-browser-connection";
const opaque=()=>createHash("sha256").update(fixtures().layoutAll.workspaceId+":assistant:"+clientId).digest("hex");
function sql(query:string){
 const f=fixtures().layoutAll;expect(f.email).toMatch(/@example\.invalid$/);expect(f.workspaceId).toMatch(/^[0-9a-f-]{36}$/);expect(f.id).toMatch(/^[0-9a-f-]{36}$/);
 return execFileSync(process.platform==="win32"?"docker.exe":"docker",["exec","-i","supabase_db_bundle-experience-p2","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
}
async function signIn(page:Page){
 const f=fixtures().layoutAll;
 await page.goto("/login?legacy=1&next=%2Fworkspace%2Fintegrations");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/integrations$/);
 await expect(page.getByRole("button",{name:"Refresh connections",exact:true})).toBeEnabled();
}
const row=(page:Page)=>page.locator(".connection-item").filter({has:page.getByRole("heading",{name:"AI assistant · "+opaque().slice(0,8),exact:true})});
test.describe("native connection evidence and privacy controls",()=>{
 test.setTimeout(120000);
 test.skip(process.env.CONNECTIONS_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional local fixtures.");
 test.beforeEach(async({baseURL})=>{
  expect(baseURL).toBe("http://localhost:3125");
  const f=fixtures().layoutAll;
  sql("insert into workspace.mcp_authorizations(id,workspace_id,client_id,assistant_provider,status,created_by) values('"+recordId+"','"+f.workspaceId+"','"+clientId+"','other','connected','"+f.id+"') on conflict(id) do update set status='connected',disconnected_at=null,updated_at=now()");
 });
 test.afterEach(()=>{
  sql("delete from workspace_private.connection_disconnect_receipts where result->>'id'='"+opaque()+"';delete from workspace.mcp_authorizations where id='"+recordId+"' and client_id='"+clientId+"'");
 });
 test("uses real status, useful optional-bundle guidance and readable small screens",async({page},info)=>{
  await signIn(page);await expect(row(page)).toContainText("Access not verified");
  await expect(page.getByRole("heading",{name:"Connections",exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Optional bundle connections"})).toContainText("Wix");
  await expect(page.getByRole("region",{name:"Optional bundle connections"})).toContainText("finances");
  await expect(page.locator('input[type="password"],input[name="apiKey"]')).toHaveCount(0);
  await page.screenshot({path:"test-results/connections-"+info.project.name+".png",fullPage:false,scale:"css"});
  await row(page).getByRole("button").click();await expect(page.getByRole("heading",{name:"Review disconnect",exact:true})).toBeFocused();
  await page.getByRole("heading",{name:"Review disconnect",exact:true}).evaluate(el=>{const header=document.querySelector(".workspace-header")!;window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-header.getBoundingClientRect().height-24);});
  await page.screenshot({path:"test-results/connections-review-"+info.project.name+".png",fullPage:false,scale:"css"});
  await page.getByRole("button",{name:"Cancel disconnect",exact:true}).click();await expect(row(page).getByRole("button")).toBeFocused();
  expect(sql("select status from workspace.mcp_authorizations where id='"+recordId+"'")).toBe("connected");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test("confirms exact disconnect and safely retries a lost response",async({page})=>{
  await signIn(page);await row(page).getByRole("button").click();
  const bodies:string[]=[];let first=true;
  await page.route("**/api/bundles/connections",async route=>{
   if(route.request().method()!=="POST")return route.continue();
   bodies.push(route.request().postData()!);
   if(first){first=false;const r=await route.fetch();expect(r.status()).toBe(200);return route.fulfill({status:503,contentType:"application/json",body:'{"message":"Fictional response loss"}'});}
   return route.continue();
  });
  await page.getByRole("button",{name:"Confirm Workspace disconnect",exact:true}).click();
  await expect(page.locator(".connection-center").getByRole("alert")).toContainText("outcome is not verified");
  expect(sql("select status from workspace.mcp_authorizations where id='"+recordId+"'")).toBe("disconnected");
  await page.getByRole("button",{name:"Retry same disconnect",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Workspace disconnect confirmed",exact:true})).toBeVisible();
  await expect(page.locator(".connection-receipt")).toContainText("Workspace access for this assistant is disabled.");
  expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);
  expect(sql("select count(*) from workspace_private.connection_disconnect_receipts where result->>'id'='"+opaque()+"'")).toBe("1");
  await expect(row(page)).toContainText("Disconnected in Workspace");
 });
 test("rejects stale review instead of overwriting changed access",async({page})=>{
  await signIn(page);await row(page).getByRole("button").click();
  sql("update workspace.mcp_authorizations set status='error',updated_at=now() where id='"+recordId+"'");
  await page.getByRole("button",{name:"Confirm Workspace disconnect",exact:true}).click();
  await expect(page.locator(".connection-center").getByRole("alert")).toContainText("Connection changed");
  expect(sql("select status from workspace.mcp_authorizations where id='"+recordId+"'")).toBe("error");
  expect(sql("select count(*) from workspace_private.connection_disconnect_receipts where result->>'id'='"+opaque()+"'")).toBe("0");
 });
 test("clears failed status and recovers with a current read",async({page})=>{
  await signIn(page);await expect(row(page)).toBeVisible();
  await page.route("**/api/bundles/connections?*",r=>r.fulfill({status:503,contentType:"application/json",body:'{"message":"Fictional status interruption"}'}));
  await page.getByRole("button",{name:"Refresh connections",exact:true}).click();
  await expect(page.locator(".connection-center").getByRole("alert")).toContainText("Fictional status interruption");
  await expect(page.locator(".connection-item")).toHaveCount(0);await expect(page.locator(".connection-metrics")).toHaveCount(0);
  await page.unroute("**/api/bundles/connections?*");await page.getByRole("button",{name:"Retry connections",exact:true}).click();await expect(row(page)).toBeVisible();
 });
 test("discards a late response after status is cleared while away",async({page})=>{
  await signIn(page);let release!:()=>void,arrived!:()=>void;
  const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>arrived=r);
  await page.route("**/api/bundles/connections?*",async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response}).catch(()=>{});});
  await page.getByRole("button",{name:"Refresh connections",exact:true}).click();await ready;
  await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
  release();await page.unroute("**/api/bundles/connections?*");
  await expect(page.locator(".connection-center").getByRole("status")).toContainText("cleared while away");
  await expect(page.locator(".connection-item")).toHaveCount(0);
  await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});document.dispatchEvent(new Event("visibilitychange"));});
  await page.getByRole("button",{name:"Refresh connections",exact:true}).click();await expect(row(page)).toBeVisible();
 });
 test("opening assistant setup does not save onboarding or claim connection success",async({page})=>{
  await signIn(page);const f=fixtures().layoutAll,before=sql("select row_to_json(o)::text from workspace.personal_onboarding o where workspace_id='"+f.workspaceId+"'");
  await page.goto("/workspace/integrations/assistant?provider=chatgpt");
  await expect(page.getByRole("heading",{name:"Set up ChatGPT",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Check access in connection center",exact:true})).toBeVisible();
  expect(sql("select row_to_json(o)::text from workspace.personal_onboarding o where workspace_id='"+f.workspaceId+"'")).toBe(before);
 });
});
