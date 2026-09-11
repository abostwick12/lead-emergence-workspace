import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";

function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
function localSql(sql:string){return execFileSync("docker.exe",["exec","-i","supabase_db_bundle-experience-p2","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],{input:sql,encoding:"utf8"}).trim();}
async function session(){const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8")),f=fixtures().executive;
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();return client;}
async function signIn(page:Page){const f=fixtures().executive;await page.goto("/login?legacy=1&next="+encodeURIComponent("/workspace/executive"));await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/executive$/);}
function clearSchedules(){const workspace=fixtures().executive.workspaceId;if(!/^[0-9a-f-]{36}$/.test(workspace))throw new Error("Unsafe fictional workspace fixture.");localSql(`delete from workspace_private.executive_delivery_requests where workspace_id='${workspace}';delete from workspace_private.executive_delivery_schedules where workspace_id='${workspace}';`);}
async function savedBriefs(){const client=await session(),result=await client.rpc("executive_search_documents",{p_kind:"daily_brief",p_search:"",p_offset:0,p_limit:25});expect(result.error).toBeNull();return result.data.total as number;}
async function forceDue(){const client=await session(),list=await client.rpc("executive_deliveries");expect(list.error).toBeNull();const id=list.data.schedules.find((schedule:{status:string,definition:{deliveryKind:string}})=>schedule.status==="active"&&schedule.definition.deliveryKind==="daily_brief")?.scheduleId;expect(id).toBeTruthy();localSql(`update workspace_private.executive_delivery_schedules set next_occurrence=now()-interval '1 minute' where id='${id}';`);}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test.describe("native Executive review schedules",()=>{
 test.setTimeout(120000);
 test.skip(process.env.EXECUTIVE_DELIVERY_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional Executive delivery fixtures.");
 test.beforeEach(async({baseURL})=>{expect(baseURL).toBe("http://localhost:3125");clearSchedules();});
 test.afterEach(()=>clearSchedules());
 test("creates, safely retries, controls and materializes only an in-app review cue",async({page},info)=>{
  const before=await savedBriefs();await signIn(page);
  await expect(page.getByRole("heading",{name:"Bring the right review back at the right time",exact:true})).toBeVisible();
  await expect(page.getByText(/This installed version has no background runner/)).toBeVisible();
  await page.getByLabel("Schedule name *",{exact:true}).fill("Client-ready morning brief");await page.getByLabel("Named time zone *",{exact:true}).fill("America/Chicago");
  await page.getByLabel("Local time *",{exact:true}).fill("07:45");await page.getByLabel("When to create a cue",{exact:true}).selectOption("when_attention_summary_changes");
  await page.getByRole("checkbox",{name:/I confirm this exact local schedule/}).check();
  let intercepted=false;await page.route("**/api/executive/deliveries",async route=>{if(route.request().method()!=="POST"||intercepted)return route.continue();intercepted=true;const response=await route.fetch();expect(response.status()).toBe(200);await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic uncertain schedule response."})});});
  await page.getByRole("button",{name:"Create schedule",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Synthetic uncertain schedule response."})).toBeVisible();
  await page.getByRole("button",{name:"Create schedule",exact:true}).click();await expect(page.getByRole("heading",{name:"Client-ready morning brief",exact:true})).toBeVisible();await page.unroute("**/api/executive/deliveries");
  const client=await session(),created=await client.rpc("executive_deliveries");expect(created.error).toBeNull();expect(created.data.schedules.filter((schedule:{status:string})=>schedule.status!=="cancelled")).toHaveLength(1);
  await page.getByRole("button",{name:"Pause",exact:true}).click();await expect(page.getByText("Daily brief · paused",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Resume",exact:true}).click();await expect(page.getByText("Daily brief · active",{exact:true})).toBeVisible();
  await forceDue();await page.reload();await expect(page.getByText("Daily brief · review ready",{exact:true})).toBeVisible();
  await expect(page.getByText(/no record was created or sent/)).toBeVisible();expect(await savedBriefs()).toBe(before);
  const section=page.getByRole("region",{name:"Bring the right review back at the right time"});await section.screenshot({path:"test-results/executive-delivery-"+info.project.name+".png"});await noOverflow(page);
  await page.getByRole("link",{name:"Open an unsaved daily brief",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/executive\/daily_brief\/new$/);expect(await savedBriefs()).toBe(before);
  await forceDue();await page.goto("/workspace/executive");await expect(page.getByText("Daily brief · unchanged; skipped",{exact:true})).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancel",exact:true}).click();await expect(page.getByText("Daily brief · cancelled",{exact:true})).toBeVisible();
  expect(await savedBriefs()).toBe(before);await noOverflow(page);
 });
 test("uses a named-zone weekly cadence and keeps schedule creation explicit",async({page})=>{
  await signIn(page);await page.getByLabel("Review",{exact:true}).selectOption("weekly_review");
  await expect(page.getByLabel("Friday",{exact:true})).toBeChecked();await page.getByLabel("Monday",{exact:true}).check();
  await page.getByLabel("Named time zone *",{exact:true}).fill("America/New_York");await page.getByRole("checkbox",{name:/I confirm this exact local schedule/}).check();
  await page.getByRole("button",{name:"Create schedule",exact:true}).click();await expect(page.getByRole("heading",{name:"Friday weekly review",exact:true})).toBeVisible();
  await expect(page.getByText(/Every Monday, Friday at 16:00 · America\/New_York/)).toBeVisible();await noOverflow(page);
 });
});
