import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {test,expect,type Page} from "@playwright/test";
const fixtures=()=>JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));
const id="14333333-3333-4333-8333-333333333333",typeId="writer.notification.publication_ready",title="P14 fictional client-ready resource";
function sql(query:string){
 const f=fixtures().layoutAll;expect(f.email).toMatch(/@example\.invalid$/);expect(f.workspaceId).toMatch(/^[0-9a-f-]{36}$/);
 return execFileSync("docker.exe",["exec","-i","supabase_db_bundle-experience-p2","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
}
async function signIn(page:Page,role="layoutAll"){
 const f=fixtures()[role];await page.goto("/login?legacy=1&next=%2Fworkspace%2Fnotifications");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/notifications$/);
 await expect(page.getByRole("button",{name:"Refresh notifications",exact:true})).toBeEnabled();
}
async function writing(page:Page){await page.getByLabel("Update type",{exact:true}).selectOption(typeId);await expect(page.getByRole("article",{name:title,exact:true})).toBeVisible();}
async function preferences(page:Page){const panel=page.locator(".notification-preferences");if(!await panel.evaluate(el=>(el as HTMLDetailsElement).open))await panel.locator("summary").click();}
const row=(page:Page)=>page.getByRole("article",{name:title,exact:true});
const center=(page:Page)=>page.getByRole("region",{name:"Notification center",exact:true});
const view=async(page:Page,name:string)=>{await page.getByRole("navigation",{name:"Notification views"}).getByRole("button",{name:new RegExp("^"+name+" ")}).click();};
test.describe("native notification lifecycle",()=>{
 test.setTimeout(120000);test.skip(process.env.NOTIFICATIONS_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional local fixtures.");
 test.beforeEach(async({baseURL})=>{
  expect(baseURL).toBe("http://localhost:3125");const w=fixtures().layoutAll.workspaceId;
  expect(sql("select count(*) from workspace_private.notification_states where workspace_id='"+w+"'")).toBe("0");
  expect(sql("select count(*) from workspace_private.notification_preferences where workspace_id='"+w+"'")).toBe("0");
  expect(sql("select count(*) from workspace_private.notification_receipts where workspace_id='"+w+"'")).toBe("0");
  sql("insert into workspace_private.writing_resources(id,workspace_id,title,source_label,publication_state,body_text) values('"+id+"','"+w+"','"+title+"','Fictional P14 notification acceptance','ready','Private fictional source body; never returned by notifications')");
 });
 test.afterEach(()=>{
  const w=fixtures().layoutAll.workspaceId;
  sql("delete from workspace_private.notification_receipts where workspace_id='"+w+"';delete from workspace_private.notification_states where workspace_id='"+w+"';delete from workspace_private.notification_preferences where workspace_id='"+w+"';delete from workspace_private.notification_settings where workspace_id='"+w+"';delete from workspace_private.writing_resources where workspace_id='"+w+"' and source_label='Fictional P14 notification acceptance'");
 });
 test("opens useful source-linked updates, persists read state and fits small screens",async({page},info)=>{
  await signIn(page);await writing(page);await expect(row(page)).toContainText("unread");
  await expect(row(page)).not.toContainText("Private fictional source body");
  await expect(page.getByRole("link",{name:"Notifications",exact:true}).filter({has:page.locator("svg")})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await row(page).evaluate(el=>window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-(document.querySelector(".workspace-header")?.getBoundingClientRect().height??0)-18));await page.screenshot({path:"test-results/notifications-"+info.project.name+".png",fullPage:false,scale:"css"});
  await row(page).getByRole("button",{name:"Mark read",exact:true}).click();await expect(center(page).getByRole("status")).toContainText("choice saved");
  await expect(row(page).getByRole("button",{name:"Mark unread",exact:true})).toBeVisible();
  await page.reload();await writing(page);await expect(row(page).getByRole("button",{name:"Mark unread",exact:true})).toBeVisible();
  await row(page).getByRole("link",{name:"Open source →",exact:true}).click();await expect(page).toHaveURL(new RegExp("/workspace/writing/"+id+"$"));
 });
 test("dismisses, restores, snoozes and mutes without changing the source",async({page},info)=>{
  await signIn(page);await writing(page);
  await row(page).getByRole("button",{name:"Dismiss",exact:true}).click();await expect(row(page)).toHaveCount(0);
  await view(page,"Dismissed");await row(page).getByRole("button",{name:"Restore to unread",exact:true}).click();
  await view(page,"Unread");await row(page).getByRole("button",{name:"Later · 24 hours",exact:true}).click();
  await view(page,"Later");await expect(row(page)).toContainText("Set aside until");
  await preferences(page);
  await page.getByRole("checkbox",{name:"Resource marked ready",exact:true}).click();
  await expect(center(page).getByRole("status")).toContainText("preference saved");
  await expect(page.locator(".notification-preferences summary")).toBeFocused();
  await expect(page.locator(".notification-preferences")).toHaveAttribute("open","");
  await view(page,"Muted");await expect(row(page)).toContainText("Enable this type below");
  await preferences(page);
  await page.getByRole("checkbox",{name:"Resource marked ready",exact:true}).click();
  await view(page,"Later");await expect(row(page)).toContainText("Snoozed");
  await preferences(page);
  await page.locator(".notification-preferences").evaluate(el=>window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-(document.querySelector(".workspace-header")?.getBoundingClientRect().height??0)-18));
  await page.screenshot({path:"test-results/notification-preferences-"+info.project.name+".png",fullPage:false,scale:"css"});
  expect(sql("select publication_state from workspace_private.writing_resources where id='"+id+"'")).toBe("ready");
 });
 test("acknowledges only the displayed page, not unseen updates or a newly arriving source",async({page})=>{
  const w=fixtures().layoutAll.workspaceId;
  sql("insert into workspace_private.writing_resources(workspace_id,title,source_label,publication_state) select '"+w+"','P14 extra ready '||i,'Fictional P14 notification acceptance','ready' from generate_series(1,26)i");
  await signIn(page);await page.getByLabel("Update type",{exact:true}).selectOption(typeId);await expect(page.locator(".notification-card")).toHaveCount(25);
  sql("insert into workspace_private.writing_resources(workspace_id,title,source_label,publication_state) values('"+w+"','P14 new after page review','Fictional P14 notification acceptance','ready')");
  await page.getByRole("button",{name:"Mark this page read",exact:true}).click();await expect(center(page).getByRole("status").filter({hasText:"choice saved"})).toBeVisible();
  await view(page,"Unread");await expect(page.locator(".notification-card")).toHaveCount(3);
  expect(sql("select count(*) from workspace_private.notification_states where workspace_id='"+w+"' and disposition='read'")).toBe("25");
 });
 test("retries exactly once after a lost response without extending snooze",async({page})=>{
  await signIn(page);await writing(page);let first=true;const bodies:string[]=[];
  await page.route("**/api/bundles/notifications",async route=>{
   if(route.request().method()!=="POST")return route.continue();bodies.push(route.request().postData()!);
   if(first){first=false;const r=await route.fetch();expect(r.status()).toBe(200);return route.fulfill({status:503,contentType:"application/json",body:'{"message":"Fictional lost response"}'});}return route.continue();
  });
  await row(page).getByRole("button",{name:"Later · 24 hours",exact:true}).click();await expect(center(page).getByRole("alert")).toContainText("outcome is not verified");
  const before=sql("select snoozed_until from workspace_private.notification_states where workspace_id='"+fixtures().layoutAll.workspaceId+"'");
  await page.getByRole("button",{name:"Retry same change",exact:true}).click();await expect(center(page).getByRole("status")).toContainText("Set aside for 24 hours");
  expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);
  expect(sql("select snoozed_until from workspace_private.notification_states where workspace_id='"+fixtures().layoutAll.workspaceId+"'")).toBe(before);
 });
 test("rejects stale choices from another tab and never marks resolved work read",async({page})=>{
  await signIn(page);await writing(page);
  sql("insert into workspace_private.notification_settings(workspace_id,version) values('"+fixtures().layoutAll.workspaceId+"',1)");
  await row(page).getByRole("button",{name:"Mark read",exact:true}).click();await expect(center(page).getByRole("alert")).toContainText("choices changed");
  await expect(row(page).getByRole("button",{name:"Mark read",exact:true})).toBeVisible();
  sql("update workspace_private.writing_resources set publication_state='published' where id='"+id+"'");
  await row(page).getByRole("button",{name:"Mark read",exact:true}).click();await expect(center(page).getByRole("alert")).toContainText("source is unavailable");
  await expect(row(page)).toHaveCount(0);
 });
 test("clears old data on failed refresh and ignores a late response after leaving the tab",async({page})=>{
  await signIn(page);await writing(page);
  await page.route("**/api/bundles/notifications?**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"message":"Fictional check unavailable"}'}));
  await page.getByRole("button",{name:"Refresh notifications",exact:true}).click();await expect(row(page)).toHaveCount(0);await expect(center(page).getByRole("alert")).toContainText("check unavailable");
  await page.unroute("**/api/bundles/notifications?**");await page.getByRole("button",{name:"Retry notifications",exact:true}).click();await expect(row(page)).toBeVisible();
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let arrived!:()=>void;const started=new Promise<void>(resolve=>{arrived=resolve;});
  await page.route("**/api/bundles/notifications?**",async route=>{const r=await route.fetch();arrived();await held;await route.fulfill({response:r}).catch(()=>{});});
  await page.getByRole("button",{name:"Refresh notifications",exact:true}).click();await started;
  await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
  release();await expect(center(page).getByRole("status")).toContainText("cleared while away");await expect(row(page)).toHaveCount(0);
 });
 test("an Experience-only owner cannot see or select another bundle's notifications",async({page})=>{
  await signIn(page,"layoutOther");
  await expect(page.getByLabel("Update type").locator("option")).toHaveCount(2);
  await expect(center(page)).not.toContainText(title);await expect(page.locator(".notification-card")).toHaveCount(0);
 });
});
