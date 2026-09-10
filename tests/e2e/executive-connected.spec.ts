import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
import {executiveFixtures} from "../../scripts/executive-fixtures.mjs";
import type {ExecutiveData,ExecutiveDocument,ExecutiveKind} from "../../lib/executive-bundle/contracts";
import {clearNewEditorDrafts} from "./editor-draft-cleanup";
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function session(role="executive"){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(c.url).toBe("http://127.0.0.1:58521");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}}),f=fixtures()[role];
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();return client;
}
type LocalClient=Awaited<ReturnType<typeof session>>;
async function get(client:LocalClient,kind:string,id:string){const r=await client.rpc("executive_get_document",{p_kind:kind,p_document_id:id});expect(r.error).toBeNull();return r.data.document as ExecutiveDocument;}
async function save(client:LocalClient,kind:ExecutiveKind,data:ExecutiveData,base:ExecutiveDocument|null=null){
 const r=await client.rpc("executive_save_document",{p_kind:kind,p_document_id:base?.id??null,p_expected_revision:base?.revision??0,p_request_id:randomUUID(),p_data:data,p_confirm_exact_record:true});expect(r.error).toBeNull();return r.data.document as ExecutiveDocument;
}
async function share(client:LocalClient,capabilities:string[]){
 const current=await client.rpc("executive_get_source_permissions");expect(current.error).toBeNull();
 const r=await client.rpc("executive_set_source_permissions",{p_capabilities:capabilities,p_expected_revision:current.data.revision,p_request_id:randomUUID(),p_confirm_task_metadata_only:true});expect(r.error).toBeNull();
}
async function signIn(page:Page,role="executive"){
 const f=fixtures()[role];await page.goto("/login?legacy=1");await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
}
const confirm=(page:Page)=>page.getByRole("checkbox",{name:/I reviewed this exact record/});
const saveButton=(page:Page,kind:string)=>page.getByRole("button",{name:"Confirm and save "+kind.replaceAll("_"," "),exact:true});
const title=(text:string)=>text+" "+randomUUID().slice(0,8);
async function savedId(page:Page,kind:string){await expect(page).toHaveURL(new RegExp("/workspace/executive/"+kind+"/[a-f0-9-]{36}$"));return new URL(page.url()).pathname.split("/").at(-1)!;}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
test.describe("Executive native client workflow",()=>{
 test.setTimeout(150000);
 test.skip(process.env.EXECUTIVE_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional accounts.");
 test.beforeEach(async({baseURL})=>{expect(baseURL).toBe("http://localhost:3125");await clearNewEditorDrafts("executive",["commitment","decision","meeting","daily_brief","weekly_review"],"executive");});
 test.afterEach(async()=>clearNewEditorDrafts("executive",["commitment","decision","meeting","daily_brief","weekly_review"],"executive"));
 test("discloses scoped assistant access and denies an unassigned area",async({page})=>{
  await page.goto("/oauth/consent");await expect(page.getByText(/Executive can read assigned commitments/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Allow access",exact:true})).toBeDisabled();
  await signIn(page,"reader");await page.goto("/workspace/executive");await expect(page.getByRole("heading",{name:"This Executive area is not included",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Commitments",exact:true})).toHaveCount(0);await noOverflow(page);
 });
 test("captures one commitment, resets confirmation and retains edits through a failed save",async({page},info)=>{
  const client=await session(),name=title("Deliver the workshop outline");
  await signIn(page);await page.goto("/workspace/executive/commitment/new");await expect(saveButton(page,"commitment")).toBeDisabled();
  await page.getByLabel("Title *",{exact:true}).fill(name);await page.getByLabel("Desired outcome *",{exact:true}).fill("A clear, reviewed outline for a fictional workshop.");
  await page.getByLabel("Highest-value next action",{exact:true}).fill("Ask the fictional reviewer to check the opening question.");
  await page.getByLabel("Owner",{exact:true}).fill("Fictional coordinator");await page.getByLabel("Due date",{exact:true}).fill("2026-09-09");
  await confirm(page).check();await page.getByLabel("Title *",{exact:true}).fill(name+" — ready for review");await expect(confirm(page)).not.toBeChecked();await confirm(page).check();
  await page.route("**/api/bundles/editor-drafts",route=>route.request().method()==="POST"&&route.request().postDataJSON().operation==="commit"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic save interruption."})}):route.continue());
  await saveButton(page,"commitment").click();await expect(page.getByRole("alert").filter({hasText:"Synthetic save interruption."})).toBeVisible();
  await expect(page.getByLabel("Title *",{exact:true})).toHaveValue(name+" — ready for review");await page.unroute("**/api/bundles/editor-drafts");await saveButton(page,"commitment").click();
  const d=await get(client,"commitment",await savedId(page,"commitment"));expect(d.data).toMatchObject({owner:"Fictional coordinator",reviewState:"user_stated",state:"open"});
  expect(await confirm(page).evaluate(el=>Number.parseFloat(getComputedStyle(el.closest("label")!).fontSize))).toBeGreaterThanOrEqual(15);
  await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/executive-commitment-"+info.project.name+".png",fullPage:false});await noOverflow(page);
 });
 test("records decision options, rationale and completion evidence",async({page})=>{
  const client=await session();await signIn(page);await page.goto("/workspace/executive/decision/new");
  await page.getByLabel("Title *",{exact:true}).fill(title("Choose a first workshop format"));await page.getByLabel("Decision question *",{exact:true}).fill("Which fictional format best supports a useful discussion?");
  await page.getByRole("button",{name:"Add option",exact:true}).click();await page.getByLabel("Option *",{exact:true}).fill("A small facilitated discussion");
  await page.getByLabel("Upside",{exact:true}).fill("More time for each participant.");await page.getByLabel("Downside",{exact:true}).fill("Fewer places in the first session.");
  await page.getByLabel("Decision state",{exact:true}).selectOption("decided");
  await page.getByLabel("Chosen option",{exact:true}).selectOption({label:"A small facilitated discussion"});
  await page.getByLabel("Decision date",{exact:true}).fill("2026-09-09");await confirm(page).check();await saveButton(page,"decision").click();
  await expect(page.getByRole("alert").filter({hasText:/rationale/})).toBeVisible();
  await page.getByLabel("Decision rationale *",{exact:true}).fill("The first session should test discussion quality before growing attendance.");
  await confirm(page).check();await saveButton(page,"decision").click();expect((await get(client,"decision",await savedId(page,"decision"))).data).toMatchObject({state:"decided",options:[expect.objectContaining({title:"A small facilitated discussion"})]});
  await page.goto("/workspace/executive/commitment/new");await page.getByLabel("Title *",{exact:true}).fill(title("A completed fictional handoff"));await page.getByLabel("Desired outcome *",{exact:true}).fill("The fictional outline was reviewed.");
  await page.getByLabel("Commitment state",{exact:true}).selectOption("completed");await confirm(page).check();await saveButton(page,"commitment").click();await expect(page.getByRole("alert").filter({hasText:/completed/})).toBeVisible();
  await page.getByLabel("Actual completion date *",{exact:true}).fill("2026-09-09");await confirm(page).check();await saveButton(page,"commitment").click();expect((await get(client,"commitment",await savedId(page,"commitment"))).data).toMatchObject({completedOn:"2026-09-09"});
 });
 test("requires an explicit repeated-hour meeting instant and never claims booking",async({page},info)=>{
  const client=await session();await signIn(page);await page.goto("/workspace/executive/meeting/new");
  await page.getByLabel("Title *",{exact:true}).fill(title("Agree the fictional next move"));await page.getByLabel("Meeting objective *",{exact:true}).fill("Choose one concrete next step together.");
  await page.getByLabel("Meeting time zone *",{exact:true}).selectOption("America/New_York");
  await page.getByLabel("Meeting local date and time",{exact:true}).fill("2026-03-08T02:30");await expect(page.getByText(/This local time does not exist/)).toBeVisible();
  await page.getByLabel("Meeting local date and time",{exact:true}).fill("2026-11-01T01:30");await expect(page.getByText("This local hour occurs twice. Choose the intended instant.")).toBeVisible();
  await confirm(page).check();await expect(saveButton(page,"meeting")).toBeDisabled();
  await page.getByRole("radio").nth(1).check();
  expect((await page.getByRole("radio").nth(1).boundingBox())!.width).toBeLessThanOrEqual(32);
  await page.getByText("This local hour occurs twice. Choose the intended instant.").scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/executive-time-choice-"+info.project.name+".png",fullPage:false});
  await page.getByRole("button",{name:"Use this meeting time",exact:true}).click();
  await page.getByLabel("Meeting agreement",{exact:true}).selectOption("user_reported_agreed");await confirm(page).check();await saveButton(page,"meeting").click();
  expect((await get(client,"meeting",await savedId(page,"meeting"))).data).toMatchObject({startsAt:"2026-11-01T06:30:00.000Z",agreement:"user_reported_agreed",timeZone:"America/New_York"});
  await expect(page.getByText(/A saved time is not a calendar booking/)).toBeVisible();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/executive-meeting-"+info.project.name+".png",fullPage:false});await noOverflow(page);
 });
test("reviews recorded outcomes, prepares an unsaved review and retains its time zone",async({page},info)=>{
  const client=await session(),today=new Date().toISOString().slice(0,10),name=title("Weekly completed then reopened work");
  let d=await save(client,"commitment",{...executiveFixtures(today).commitment,title:name,state:"completed",completedOn:"2020-01-01",outcome:"WEEKLY_BROWSER_PRIVATE_BODY_CANARY"});
  d=await save(client,"commitment",{...d.data,state:"open",completedOn:null} as ExecutiveData,d);
  await signIn(page);await page.goto("/workspace/executive/weekly_review/new");
  await page.getByLabel("Period start *",{exact:true}).fill(today);await page.getByLabel("Period end *",{exact:true}).fill(today);
  await page.getByLabel("Weekly history time zone",{exact:true}).selectOption("UTC");
  const panel=page.getByRole("region",{name:"Recorded weekly outcomes"});
  await expect(panel.getByRole("heading",{name,exact:true})).toHaveCount(2);
  await expect(panel.getByText("Earlier completed state withdrawn",{exact:true}).first()).toBeVisible();
  await expect(panel.getByText(/User-recorded completion\/decision date: 2020-01-01/).first()).toBeVisible();
  await expect(panel.getByText(/WEEKLY_BROWSER_PRIVATE_BODY_CANARY/)).toHaveCount(0);
  await confirm(page).check();await page.getByLabel("Weekly history time zone",{exact:true}).selectOption("America/New_York");
  await expect(confirm(page)).not.toBeChecked();await page.getByLabel("Weekly history time zone",{exact:true}).selectOption("UTC");
  await expect(panel.getByRole("heading",{name,exact:true})).toHaveCount(2);
  page.once("dialog",dialog=>dialog.accept());
  await panel.getByRole("button",{name:"Prepare review from saved outcomes",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Unsaved weekly review prepared"})).toBeVisible();
  expect(await page.getByLabel("Brief summary",{exact:true}).inputValue()).toContain("not independently verified accomplishments");
  expect(await page.getByLabel("Brief summary",{exact:true}).inputValue()).not.toContain(name);
  await expect(confirm(page)).not.toBeChecked();
  await expect(page.getByLabel("Record review state",{exact:true})).toHaveValue("inferred");
  await confirm(page).check();await saveButton(page,"weekly_review").click();
  const id=await savedId(page,"weekly_review"),saved=await get(client,"weekly_review",id);
  expect(saved.data).toMatchObject({timeZone:"UTC",periodStart:today,periodEnd:today,reviewState:"inferred",
   references:expect.arrayContaining([expect.objectContaining({documentId:d.id,revision:d.revision})])});
  await page.reload();await expect(page.getByLabel("Weekly history time zone",{exact:true})).toHaveValue("UTC");
  await expect(panel.locator("article").first()).toBeVisible();
  await panel.locator("article").first().screenshot({path:"test-results/executive-weekly-event-"+info.project.name+".png"});
  await panel.getByRole("heading",{name:"Outcomes recorded during this period"}).scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/executive-weekly-outcomes-"+info.project.name+".png",fullPage:false});await noOverflow(page);
 });
 test("pages weekly outcomes without pretending the first page is complete",async({page})=>{
  const client=await session(),today=new Date().toISOString().slice(0,10),prefix=title("Weekly paged action");
  const actions=Array.from({length:26},(_,index)=>({id:randomUUID(),title:prefix+" "+index,owner:"Fictional owner",dueDate:today,
   state:"completed" as const,nextAction:"",evidence:"WEEKLY_BROWSER_PAGE_EVIDENCE_CANARY",reviewState:"user_stated" as const}));
  await save(client,"meeting",{...executiveFixtures(today).meeting,actions});
  await signIn(page);await page.goto("/workspace/executive/weekly_review/new");
  await page.getByLabel("Period start *",{exact:true}).fill(today);await page.getByLabel("Period end *",{exact:true}).fill(today);
  await page.getByLabel("Weekly history time zone",{exact:true}).selectOption("UTC");
  const panel=page.getByRole("region",{name:"Recorded weekly outcomes"});
  await expect(panel.getByRole("button",{name:"Next outcome page",exact:true})).toBeEnabled();
  await expect(panel.locator("article")).toHaveCount(25);
  await panel.getByRole("button",{name:"Next outcome page",exact:true}).click();
  await expect(panel.getByRole("button",{name:"Previous outcome page",exact:true})).toBeEnabled();
  await expect(panel.getByRole("button",{name:"Prepare review from saved outcomes",exact:true})).toBeDisabled();
  await expect(panel.getByText(/WEEKLY_BROWSER_PAGE_EVIDENCE_CANARY/)).toHaveCount(0);
  await panel.getByRole("button",{name:"Refresh full period",exact:true}).click();
  await expect(panel.getByRole("button",{name:"Previous outcome page",exact:true})).toBeDisabled();
  await expect(panel.getByRole("button",{name:"Prepare review from saved outcomes",exact:true})).toBeEnabled();await noOverflow(page);
 });
 test("distinguishes an empty checked week from a failed weekly read",async({page})=>{
  await signIn(page);await page.goto("/workspace/executive/weekly_review/new");
  await page.getByLabel("Period start *",{exact:true}).fill("1990-01-01");await page.getByLabel("Period end *",{exact:true}).fill("1990-01-07");
  await page.getByLabel("Weekly history time zone",{exact:true}).selectOption("UTC");
  const panel=page.getByRole("region",{name:"Recorded weekly outcomes"});
  await expect(panel.getByText(/No outcome changes were recorded in the checked window/)).toBeVisible();
  await page.route("**/api/executive/weekly-outcomes?**",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic weekly read unavailable."})}));
  await panel.getByRole("button",{name:"Refresh full period",exact:true}).click();
  await expect(panel.getByRole("alert").filter({hasText:"Synthetic weekly read unavailable."})).toBeVisible();
  await expect(panel.getByText(/No outcome changes were recorded in the checked window/)).toHaveCount(0);
  await expect(panel.getByRole("button",{name:"Prepare review from saved outcomes",exact:true})).toHaveCount(0);
  await page.unroute("**/api/executive/weekly-outcomes?**");
  const saves:string[]=[];page.on("request",request=>{if(request.method()==="POST"&&request.url().endsWith("/api/executive/weekly_review"))saves.push(request.url());});
  await confirm(page).check();await panel.getByRole("button",{name:"Try again",exact:true}).click();
  await expect(panel.getByText(/No outcome changes were recorded in the checked window/)).toBeVisible();
  expect(saves).toEqual([]);await expect(confirm(page)).toBeChecked();await noOverflow(page);
 });
test("saves reviewed meeting availability, reopens it and preserves history after removal",async({page},info)=>{
  const client=await session(),future=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await signIn(page);await page.goto("/workspace/executive/meeting/new");
  await page.getByLabel("Title *",{exact:true}).fill(title("Fictional reviewed availability"));
  await page.getByLabel("Meeting objective *",{exact:true}).fill("Agree a fictional next step");
  await page.getByLabel("Meeting time zone *",{exact:true}).selectOption("UTC");
  await page.getByText("Find times from reviewed availability",{exact:true}).click();
  await page.getByLabel("Availability entry time zone",{exact:true}).selectOption("UTC");
  await page.getByLabel("offered window 1 start",{exact:true}).fill(future+"T14:00");
  await page.getByLabel("offered window 1 end",{exact:true}).fill(future+"T18:00");
  await page.getByRole("button",{name:"I am available throughout the offered windows",exact:true}).click();
  await page.getByLabel("Where and with whom availability was checked *",{exact:true}).fill("Fictional calendar manually checked");
  await page.getByRole("button",{name:"Confirm I rechecked these windows now",exact:true}).click();
  await page.getByRole("button",{name:"Find proposed meeting times",exact:true}).click();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Use proposed time 1",exact:true}).click();
  await expect(saveButton(page,"meeting")).toBeDisabled();await confirm(page).check();await saveButton(page,"meeting").click();
  const id=await savedId(page,"meeting"),saved=await get(client,"meeting",id);
  expect(saved.data).toMatchObject({startsAt:future+"T14:15:00.000Z",agreement:"not_agreed",reviewState:"inferred",
   availability:{input:{source:"Fictional calendar manually checked",confirmAvailabilityChecked:true}}});
  await page.reload();await page.getByText("Find times from reviewed availability",{exact:true}).click();
  await expect(page.getByLabel("offered window 1 start",{exact:true})).toHaveValue(future+"T14:00");
  await page.getByRole("region",{name:"offered windows",exact:true}).screenshot({path:"test-results/executive-retained-availability-"+info.project.name+".png"});
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Remove retained availability from this meeting",exact:true}).click();
  await confirm(page).check();await saveButton(page,"meeting").click();
  await expect(page.getByRole("status").filter({hasText:"Official save completed as revision 2"})).toBeVisible();
  expect((await get(client,"meeting",id)).data).not.toHaveProperty("availability");
  const history=await client.rpc("executive_document_history",{p_kind:"meeting",p_document_id:id});expect(history.error).toBeNull();
  expect(history.data.revisions.find((r:ExecutiveDocument)=>r.revision===1).data.availability).toEqual((saved.data as Extract<ExecutiveData,{recordType:"meeting"}>).availability);
  await noOverflow(page);
 });
 test("prepares and saves a daily brief and an honest weekly review",async({page})=>{
  const client=await session();await save(client,"commitment",{...executiveFixtures().commitment,title:title("A next move for the daily brief")});
  await signIn(page);
  for(const kind of ["daily_brief","weekly_review"] as const){
   await page.goto("/workspace/executive/"+kind+"/new");await page.getByRole("button",{name:"Prepare from current attention",exact:true}).click();
   await expect(page.getByLabel("Record review state",{exact:true})).toHaveValue("inferred");
   const summary=await page.getByLabel("Brief summary",{exact:true}).inputValue();expect(summary).toContain("Unshared record or task scopes");if(kind==="weekly_review")expect(summary).toContain("not a complete record");
   await page.getByRole("button",{name:"Add action",exact:true}).click();await page.getByLabel("Action *",{exact:true}).fill("Review the fictional source and choose one next move");
   await page.getByLabel("Action owner",{exact:true}).fill("Fictional coordinator");await page.getByLabel("Action evidence or agreement",{exact:true}).fill("A user-stated next action, not a sent message.");
   await confirm(page).check();await saveButton(page,kind).click();const d=await get(client,kind,await savedId(page,kind));expect(d.data).toMatchObject({reviewState:"inferred",actions:[expect.objectContaining({reviewState:"user_stated"})]});expect(d.data.references.length).toBeGreaterThan(0);
  }
 });
 test("requires explicit source consent and refreshes withdrawn metadata",async({page},info)=>{
  const client=await session("executiveDual");await share(client,[]);
  const sourceTitle=title("Fictional shared task title"),writing=await client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title:sourceTitle,source_label:"Synthetic browser evidence",body_text:"EXECUTIVE_BROWSER_PRIVATE_BODY_CANARY"}});expect(writing.error).toBeNull();
  await signIn(page,"executiveDual");await page.goto("/workspace/executive/sources");await expect(page.getByRole("checkbox",{name:"Writing resource status",exact:true})).not.toBeChecked();
  await page.getByRole("checkbox",{name:"Writing resource status",exact:true}).check();await expect(page.getByRole("button",{name:"Confirm source permissions",exact:true})).toBeDisabled();
  await page.getByRole("checkbox",{name:/I reviewed this exact selection/}).check();await page.getByRole("button",{name:"Confirm source permissions",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Source permissions saved"})).toBeVisible();
  const reference={capabilityId:"writer.resource.library",kind:"resource",documentId:writing.data.resourceId,revision:1};
  const d=await save(client,"daily_brief",{...executiveFixtures().daily_brief,title:title("A source-aware fictional brief"),references:[reference]});
  await page.goto("/workspace/executive/daily_brief/"+d.id);await expect(page.getByRole("heading",{name:sourceTitle,exact:true})).toBeVisible();await expect(page.getByText("EXECUTIVE_BROWSER_PRIVATE_BODY_CANARY",{exact:true})).toHaveCount(0);
  await share(client,[]);await page.getByRole("button",{name:"Refresh linked sources",exact:true}).click();await expect(page.getByRole("heading",{name:"Source unavailable",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:sourceTitle,exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Remove link",exact:true}).click();
  await confirm(page).check();await saveButton(page,"daily_brief").click();await expect(page.getByRole("status").filter({hasText:"Official save completed as revision 2"})).toBeVisible();expect((await get(client,"daily_brief",d.id)).data.references).toEqual([]);
  await page.goto("/workspace/executive");await expect(page.getByRole("heading",{name:"What deserves your attention?",exact:true})).toBeVisible();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/executive-attention-"+info.project.name+".png",fullPage:false});await noOverflow(page);
 });
 test("separately shares individual tasks, links beyond fifty sources and withdraws live details",async({page},info)=>{
  const client=await session("executiveDual");await share(client,[]);
  const prefix=title("Fictional task picker"),plans=[];
  for(let batch=0;batch<2;batch++){
   const milestones=Array.from({length:26},(_,i)=>({id:randomUUID(),title:prefix+" "+batch+"-"+i,owner:"Fictional delivery owner",
    dueDate:"2026-12-01",status:"planned",nextAction:"Review the fictional task outline",evidence:"BROWSER_PRIVATE_TASK_EVIDENCE_CANARY",priority:"normal",category:"other",dependsOn:[]}));
   const r=await client.rpc("nonprofit_save_document",{p_kind:"plan",p_document_id:null,p_expected_revision:0,p_request_id:randomUUID(),p_confirm_administrative:true,
    p_data:{title:prefix+" parent "+batch,mission:"BROWSER_PRIVATE_TASK_MISSION_CANARY",jurisdiction:"Fictional jurisdiction",status:"active",targetDate:"2026-12-01",milestones}});
   expect(r.error).toBeNull();plans.push(r.data.document);
  }
  await signIn(page,"executiveDual");await page.goto("/workspace/executive/sources");
  const record=page.getByRole("checkbox",{name:"Nonprofit roadmap tasks",exact:true});
  const task=page.getByRole("checkbox",{name:"Include individual tasks — Nonprofit roadmap tasks",exact:true});
  await expect(task).toBeDisabled();await record.check();await expect(task).not.toBeChecked();
  await task.check();await page.getByRole("checkbox",{name:/I reviewed this exact selection/}).check();
  await expect(page.getByRole("button",{name:"Confirm source permissions",exact:true})).toBeDisabled();
  await page.getByRole("checkbox",{name:/I separately permit the selected individual-task fields/}).check();
  await page.getByRole("button",{name:"Confirm source permissions",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Source permissions saved"})).toBeVisible();
  const permission=await client.rpc("executive_get_source_permissions_v2");expect(permission.error).toBeNull();
  expect(permission.data.taskCapabilities).toEqual(["nonprofit.roadmap"]);
  const first=await client.rpc("executive_find_sources",{p_capability:"nonprofit.roadmap",p_level:"task",p_search:prefix,p_limit:40});
  expect(first.error).toBeNull();expect(first.data.total).toBe(52);
  const later=await client.rpc("executive_find_sources",{p_capability:"nonprofit.roadmap",p_level:"task",p_search:prefix,p_limit:20,p_after:first.data.nextCursor});
  expect(later.error).toBeNull();const target=later.data.items.at(-1);expect(target).toBeTruthy();

  await page.goto("/workspace/executive/daily_brief/new");
  await page.getByLabel("Title *",{exact:true}).fill(title("A precise task-linked brief"));
  await page.getByLabel("Focus *",{exact:true}).fill("Which fictional task needs my next move?");
  await page.getByText("Find a record or individual task to link",{exact:true}).click();
  await page.getByLabel("Source workspace",{exact:true}).selectOption("nonprofit.roadmap");
  await page.getByLabel("Link level",{exact:true}).selectOption("task");
  await page.getByLabel("Find by title",{exact:true}).fill(prefix);await page.getByRole("button",{name:"Find sources",exact:true}).click();
  await expect(page.getByText(/52 matching permitted tasks/)).toBeVisible();
  await page.getByRole("button",{name:"Next source page",exact:true}).click();
  await expect(page.getByText(/Later page · 20 returned/)).toBeVisible();
  await page.getByRole("button",{name:"Next source page",exact:true}).click();
  await expect(page.getByText(/Later page · 12 returned/)).toBeVisible();
  await page.getByRole("button",{name:"Link "+target.metadata.title,exact:true}).click();
  await page.getByText("Find a record or individual task to link",{exact:true}).click();
  await expect(page.getByRole("heading",{name:target.metadata.title,exact:true})).toBeVisible();
  await expect(page.getByText(/Owner: Fictional delivery owner/)).toBeVisible();
  await expect(page.getByText("BROWSER_PRIVATE_TASK_EVIDENCE_CANARY",{exact:true})).toHaveCount(0);
  await confirm(page).check();await saveButton(page,"daily_brief").click();
  const briefId=await savedId(page,"daily_brief"),saved=await get(client,"daily_brief",briefId);
  expect(saved.data.references).toEqual([target.reference]);expect(JSON.stringify(saved.data)).not.toContain(target.metadata.title);
  await expect(page.getByRole("heading",{name:target.metadata.title,exact:true})).toBeVisible();
  await page.getByRole("heading",{name:target.metadata.title,exact:true}).locator("..").screenshot({path:"test-results/executive-task-link-"+info.project.name+".png"});await noOverflow(page);

  await page.goto("/workspace/executive/sources");await page.getByRole("checkbox",{name:"Include individual tasks — Nonprofit roadmap tasks",exact:true}).uncheck();
  await page.getByRole("checkbox",{name:/I reviewed this exact selection/}).check();
  await page.getByRole("button",{name:"Confirm source permissions",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Source permissions saved"})).toBeVisible();
  const withdrawn=await client.rpc("executive_get_source_permissions_v2");expect(withdrawn.data.sourceCapabilities).toEqual(["nonprofit.roadmap"]);expect(withdrawn.data.taskCapabilities).toEqual([]);
  await page.goto("/workspace/executive/daily_brief/"+briefId);
  await expect(page.getByRole("heading",{name:"Source unavailable",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:target.metadata.title,exact:true})).toHaveCount(0);
  await expect(page.getByText(/Owner: Fictional delivery owner/)).toHaveCount(0);
  await share(client,[]);
 });
 test("shows task ownership and next steps in paged attention without treating a held meeting as pending",async({page},info)=>{
  const client=await session(),name=title("Fictional blocked meeting follow-through"),content=executiveFixtures("2026-09-09").meeting;
  const action={id:randomUUID(),title:name,owner:"Fictional operations lead",dueDate:"2020-01-01",state:"blocked" as const,
   nextAction:"Obtain the illustrative missing decision",evidence:"ATTENTION_TASK_PRIVATE_EVIDENCE_CANARY",reviewState:"user_stated" as const};
  const meeting=await save(client,"meeting",{...content,state:"held",title:title("Fictional completed meeting"),outcome:"PRIVATE_MEETING_OUTCOME_CANARY",actions:[action]});
  await signIn(page);await page.goto("/workspace/executive");
  const heading=page.getByRole("heading",{name,exact:true});await expect(heading).toBeVisible();
  const card=heading.locator("..");
  await expect(card.getByText(/Owner: Fictional operations lead/)).toBeVisible();
  await expect(card.getByText("Next step: Obtain the illustrative missing decision",{exact:true})).toBeVisible();
  await expect(card.getByText("This saved task is marked blocked.",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:meeting.data.title,exact:true})).toHaveCount(0);
  await expect(page.getByText("ATTENTION_TASK_PRIVATE_EVIDENCE_CANARY",{exact:true})).toHaveCount(0);
  await card.screenshot({path:"test-results/executive-task-attention-"+info.project.name+".png"});
  await page.getByText(/Source coverage ·/).click();
  await expect(page.getByText(/Executive commitments, decisions and meetings · individual tasks — metadata checked/)).toBeVisible();
  await noOverflow(page);
 });
 test("reviews exact proposals, restores originals and exports saved work only",async({page})=>{
  const client=await session(),data={...executiveFixtures().commitment,title:title("A recoverable fictional commitment")},d=await save(client,"commitment",data);
  const proposal=await client.rpc("executive_propose_document",{p_kind:"commitment",p_document_id:d.id,p_expected_revision:1,p_request_id:randomUUID(),p_data:{...data,nextAction:"A revised fictional next move"},p_reason:"Clarify the agreed next step",p_evidence:"User-provided synthetic evidence",p_scope:"executive_coordination_only"});expect(proposal.error).toBeNull();
  await signIn(page);await page.goto("/workspace/executive/commitment/proposals");
  const card=page.locator("section").filter({has:page.getByRole("heading",{name:data.title,exact:true})}).last();
  await expect(card.getByRole("heading",{name:"Current saved revision 1",exact:true})).toBeVisible();await expect(card.getByRole("button",{name:"Approve and save proposal",exact:true})).toBeDisabled();
  await card.getByRole("checkbox",{name:/I reviewed the exact proposal/}).check();await card.getByRole("button",{name:"Approve and save proposal",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Approved and saved"})).toBeVisible();await page.goto("/workspace/executive/commitment/"+d.id);
  await expect(page.getByLabel("Highest-value next action",{exact:true})).toHaveValue("A revised fictional next move");
  await page.getByText(/Revision 1 · .* · user/).click();await page.getByRole("button",{name:"Review a copy of revision 1",exact:true}).click();expect((await get(client,"commitment",d.id)).revision).toBe(2);
  await confirm(page).check();await saveButton(page,"commitment").click();await expect(page.getByRole("status").filter({hasText:"Official save completed as revision 3"})).toBeVisible();
  await page.getByLabel("Notes",{exact:true}).fill("UNSAVED_EXECUTIVE_SHOULD_NOT_EXPORT");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download saved record",exact:true}).click();const file=await download,text=readFileSync((await file.path())!,"utf8");
  expect(text).toContain("Revision 3");expect(text).not.toContain("UNSAVED_EXECUTIVE_SHOULD_NOT_EXPORT");expect(text).toContain("live linked-source metadata are excluded");await noOverflow(page);
 });
 test("keeps a stale proposal from overwriting a newer decision and allows rejection",async({page})=>{
  const client=await session(),data={...executiveFixtures().decision,title:title("A stale fictional decision")},d=await save(client,"decision",data);
  const proposed=await client.rpc("executive_propose_document",{p_kind:"decision",p_document_id:d.id,p_expected_revision:1,p_request_id:randomUUID(),p_data:{...data,nextAction:"Old proposed direction"},p_reason:"Earlier direction",p_evidence:"Fictional earlier input",p_scope:"executive_coordination_only"});expect(proposed.error).toBeNull();
  await save(client,"decision",{...data,nextAction:"Newer native direction"},d);await signIn(page);await page.goto("/workspace/executive/decision/proposals");
  const card=page.locator("section").filter({has:page.getByRole("heading",{name:data.title,exact:true})}).last();await expect(card.getByText(/This record changed since the proposal/)).toBeVisible();
  await expect(card.getByRole("button",{name:"Approve and save proposal",exact:true})).toBeDisabled();await card.getByRole("button",{name:"Reject proposal",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Proposal rejected"})).toBeVisible();expect((await get(client,"decision",d.id)).data).toMatchObject({nextAction:"Newer native direction"});
 });
});
