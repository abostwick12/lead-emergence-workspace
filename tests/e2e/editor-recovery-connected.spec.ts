import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";

type Domain="ministry"|"nonprofit"|"investor"|"executive";
type Target={domain:Domain;kind:string;documentId:null};
type Case={domain:Domain;kind:string;role:string;path:string;label:string};
const cases:Case[]=[
 {domain:"ministry",kind:"profile",role:"minister",path:"/workspace/ministry/profile",label:"Tradition and context"},
 {domain:"nonprofit",kind:"plan",role:"founder",path:"/workspace/nonprofit/plan/new",label:"Roadmap title *"},
 {domain:"investor",kind:"watchlist",role:"investor",path:"/workspace/investing/watchlist/new",label:"Record title *"},
 {domain:"executive",kind:"commitment",role:"executive",path:"/workspace/executive/commitment/new",label:"Title *"}
];
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
function config(){const value=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(value.url).toBe("http://127.0.0.1:58521");return value;}
async function session(role:string){const c=config(),client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}}),fixture=fixtures()[role];
 expect((await client.auth.signInWithPassword({email:fixture.email,password:fixture.password})).error).toBeNull();return client;}
type LocalClient=Awaited<ReturnType<typeof session>>;
const target=(entry:Case):Target=>({domain:entry.domain,kind:entry.kind,documentId:null});
async function snapshot(client:LocalClient,value:Target){const result=await client.rpc("native_editor_draft",{p_target:value});expect(result.error).toBeNull();return result.data;}
async function clear(client:LocalClient,value:Target){const current=await snapshot(client,value);if(!current.values)return;
 const result=await client.rpc("native_change_editor_draft",{p_change:{target:value,operation:"discard",requestId:randomUUID(),expectedVersion:current.version}});expect(result.error).toBeNull();}
async function signIn(page:Page,role:string){const fixture=fixtures()[role];await page.goto("/login?legacy=1");await page.getByLabel("Email",{exact:true}).fill(fixture.email);await page.getByLabel("Password",{exact:true}).fill(fixture.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);}
async function saved(page:Page){await expect(page.getByText("Working draft saved",{exact:true})).toBeVisible({timeout:15000});}

test.describe("Private editor recovery",()=>{
 test.setTimeout(150000);
 test.skip(process.env.EDITOR_RECOVERY_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional accounts.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));

 for(const entry of cases)test(entry.domain+" restores an unfinished native draft only after the user chooses it",async({page})=>{
  const client=await session(entry.role),draftTarget=target(entry);await clear(client,draftTarget);
  try{
   await signIn(page,entry.role);await page.goto(entry.path);
   const field=page.getByLabel(entry.label,{exact:true});await expect(field).toBeEnabled();const original=await field.inputValue(),marker="RECOVERY_"+entry.domain.toUpperCase()+"_"+randomUUID();
   await field.fill(marker);await saved(page);
   const browserStorage=await page.evaluate(value=>({local:Object.values(localStorage).some(item=>item.includes(value)),session:Object.values(sessionStorage).some(item=>item.includes(value))}),marker);
   expect(browserStorage).toEqual({local:false,session:false});
   await page.goto("/workspace");await page.goto(entry.path);
   await expect(page.getByRole("alert").filter({hasText:"Unfinished work is available"})).toBeVisible();
   await expect(field).toBeDisabled();await expect(field).not.toHaveValue(marker);
   await page.getByRole("button",{name:"Restore unfinished work",exact:true}).click();
   await expect(field).toBeEnabled();await expect(field).toHaveValue(marker);await expect(page.getByText(/restored on screen/)).toBeVisible();
   page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Discard working draft",exact:true}).click();
   await expect(field).toHaveValue(original);expect((await snapshot(client,draftTarget)).values).toBeNull();
  }finally{await clear(client,draftTarget);}
 });

 test("rejects a stale second tab without replacing the first tab's server draft",async({page,context},info)=>{
  test.skip(info.project.name!=="desktop","The cross-tab race is exercised once; recovery itself runs on both viewports.");
  const entry=cases[1],client=await session(entry.role),draftTarget=target(entry);await clear(client,draftTarget);
  const other=await context.newPage();
  try{
   await signIn(page,entry.role);await page.goto(entry.path);await other.goto(entry.path);
   const first=page.getByLabel(entry.label,{exact:true}),second=other.getByLabel(entry.label,{exact:true});await expect(first).toBeEnabled();await expect(second).toBeEnabled();
   const firstMarker="FIRST_TAB_"+randomUUID(),secondMarker="SECOND_TAB_"+randomUUID();await first.fill(firstMarker);await saved(page);
   await second.fill(secondMarker);await expect(other.getByRole("alert").filter({hasText:/working draft or saved record changed/i})).toBeVisible({timeout:15000});
   const server=await snapshot(client,draftTarget);expect(server.values.data.title).toBe(firstMarker);expect(JSON.stringify(server.values)).not.toContain(secondMarker);
   other.once("dialog",dialog=>dialog.accept());await other.getByRole("button",{name:"Check server draft",exact:true}).click();
   await expect(other.getByRole("alert").filter({hasText:"Unfinished work is available"})).toBeVisible();
   await other.getByRole("button",{name:"Restore unfinished work",exact:true}).click();await expect(second).toHaveValue(firstMarker);
  }finally{await other.close();await clear(client,draftTarget);}
 });

 test("retries the identical save after the server response is lost",async({page},info)=>{
  test.skip(info.project.name!=="desktop","The lost-response path is transport behavior and is exercised once.");
  const entry=cases[1],client=await session(entry.role),draftTarget=target(entry);await clear(client,draftTarget);
  try{
   await signIn(page,entry.role);await page.goto(entry.path);let interrupted=false;
   await page.route("**/api/bundles/editor-drafts",async route=>{
    const request=route.request();if(!interrupted&&request.method()==="POST"&&request.postDataJSON().operation==="save"){interrupted=true;await route.fetch();await route.abort("connectionfailed");return;}await route.continue();
   });
   const marker="LOST_RESPONSE_"+randomUUID();await page.getByLabel(entry.label,{exact:true}).fill(marker);
   await expect(page.getByText("Working draft needs attention",{exact:true})).toBeVisible({timeout:15000});await page.unroute("**/api/bundles/editor-drafts");
   const committed=await snapshot(client,draftTarget);expect(committed.values.data.title).toBe(marker);
   await page.getByRole("button",{name:"Retry same draft save",exact:true}).click();await saved(page);
   const server=await snapshot(client,draftTarget);expect(server.values.data.title).toBe(marker);expect(server.version).toBe(committed.version);
   await page.reload();await expect(page.getByRole("alert").filter({hasText:"Unfinished work is available"})).toBeVisible();
  }finally{await clear(client,draftTarget);}
 });

 test("restores unfinished Executive availability without turning it into a saved meeting",async({page})=>{
  const entry:Case={domain:"executive",kind:"meeting",role:"executive",path:"/workspace/executive/meeting/new",label:"Title *"},client=await session(entry.role),draftTarget=target(entry);await clear(client,draftTarget);
  try{
   await signIn(page,entry.role);await page.goto(entry.path);const marker="RECOVERED_AVAILABILITY_"+randomUUID(),future=new Date(Date.now()+172800000).toISOString().slice(0,10);
   await page.getByLabel("Title *",{exact:true}).fill(marker);await page.getByLabel("Meeting objective *",{exact:true}).fill("Recover the planning window without booking anything.");
   await page.getByLabel("Meeting time zone *",{exact:true}).selectOption("UTC");await page.getByText("Find times from reviewed availability",{exact:true}).click();
   await page.getByLabel("Availability entry time zone",{exact:true}).selectOption("UTC");await page.getByLabel("offered window 1 start",{exact:true}).fill(future+"T14:00");
   await page.getByLabel("Where and with whom availability was checked *",{exact:true}).fill("Unfinished fictional availability check");await saved(page);
   await page.goto("/workspace");await page.goto(entry.path);await expect(page.getByRole("alert").filter({hasText:"Unfinished work is available"})).toBeVisible();
   await page.getByRole("button",{name:"Restore unfinished work",exact:true}).click();await page.getByText("Find times from reviewed availability",{exact:true}).click();
   await expect(page.getByLabel("offered window 1 start",{exact:true})).toHaveValue(future+"T14:00");await expect(page.getByLabel("Where and with whom availability was checked *",{exact:true})).toHaveValue("Unfinished fictional availability check");
   await expect(page.getByText(/Unapplied availability edits/)).toBeVisible();await page.getByRole("checkbox",{name:/I reviewed this exact record/}).check();await expect(page.getByRole("button",{name:"Confirm and save meeting",exact:true})).toBeDisabled();
   expect((await snapshot(client,draftTarget)).values.ui.availability.pending).toBe(true);
  }finally{await clear(client,draftTarget);}
 });
});
