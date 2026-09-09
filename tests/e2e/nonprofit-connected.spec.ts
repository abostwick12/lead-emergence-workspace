import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {test,expect,type Page} from "@playwright/test";
import {emptyNonprofitData,type NonprofitDocument} from "../../lib/nonprofit-bundle/contracts";
function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
async function session(role="founder"){
 const c=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(c.url).toBe("http://127.0.0.1:58521");
 const client=createClient(c.url,c.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}}),f=fixtures()[role];
 expect((await client.auth.signInWithPassword({email:f.email,password:f.password})).error).toBeNull();return client;
}
type LocalClient=Awaited<ReturnType<typeof session>>;
async function get(client:LocalClient,kind:string,id:string){const r=await client.rpc("nonprofit_get_document",{p_kind:kind,p_document_id:id});expect(r.error).toBeNull();return r.data.document as NonprofitDocument;}
async function save(client:LocalClient,kind:string,data:unknown,base:NonprofitDocument|null=null){
 const r=await client.rpc("nonprofit_save_document",{p_kind:kind,p_document_id:base?.id??null,p_expected_revision:base?.revision??0,p_request_id:randomUUID(),p_data:data,p_confirm_administrative:true});expect(r.error).toBeNull();return r.data.document as NonprofitDocument;
}
async function propose(client:LocalClient,kind:string,data:unknown,base:NonprofitDocument|null=null){
 const r=await client.rpc("nonprofit_propose_document",{p_kind:kind,p_document_id:base?.id??null,p_expected_revision:base?.revision??0,p_request_id:randomUUID(),p_data:data,p_reason:"Make the next administrative action clear.",p_evidence:"Fictional acceptance discussion; no client information.",p_scope:"administrative_only"});expect(r.error).toBeNull();return r.data;
}
async function signIn(page:Page,role="founder"){
 const f=fixtures()[role];await page.goto("/login?legacy=1");await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
}
const confirm=(page:Page)=>page.getByRole("checkbox",{name:/I reviewed this exact record/});
const saveButton=(page:Page,kind:string)=>page.getByRole("button",{name:"Confirm and save "+kind,exact:true});
const notice=(page:Page)=>page.getByRole("status").filter({hasText:/Saved revision/});
const title=(prefix:string)=>prefix+" "+randomUUID().slice(0,8);
async function savedId(page:Page,kind:string){await expect(page).toHaveURL(new RegExp("/workspace/nonprofit/"+kind+"/[a-f0-9-]{36}$"));return new URL(page.url()).pathname.split("/").at(-1)!;}
test.describe("Nonprofit native client workflow",()=>{
 test.setTimeout(120000);
 test.skip(process.env.NONPROFIT_LOCAL_ACCEPTANCE!=="true","Requires isolated fictional accounts.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("discloses nonprofit scope and denies unassigned native access",async({page})=>{
  await page.goto("/oauth/consent");await expect(page.getByText(/Nonprofit Founder can read your assigned administrative roadmaps/)).toBeVisible();await expect(page.getByRole("button",{name:"Allow access",exact:true})).toBeDisabled();
  await signIn(page,"reader");await page.goto("/workspace/nonprofit");await expect(page.getByRole("heading",{name:"This Nonprofit area is not included",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Roadmaps",exact:true})).toHaveCount(0);
 });
 test("builds an editable first roadmap, resets confirmation and recovers a failed save",async({page},info)=>{
  const client=await session(),name=title("Community welcome initiative");
  await signIn(page);await page.goto("/workspace/nonprofit/plan/new");
  await expect(saveButton(page,"plan")).toBeDisabled();
  await page.getByRole("textbox",{name:"Roadmap title *",exact:true}).fill(name);
  await page.getByRole("textbox",{name:"Mission and operating boundaries",exact:true}).fill("Coordinate community partnerships and volunteer support. Administrative planning only.");
  await page.getByRole("textbox",{name:"Jurisdiction",exact:true}).fill("Fictional jurisdiction");
  await page.getByRole("button",{name:"Use the suggested starting checklist",exact:true}).click();
  await page.locator("summary").filter({hasText:"Clarify the mission and operating boundaries"}).click();
  await page.getByRole("textbox",{name:"Owner",exact:true}).fill("Example founder");
  await page.getByRole("combobox",{name:"Action status",exact:true}).selectOption("blocked");
  await confirm(page).check();await page.getByRole("textbox",{name:"Roadmap title *",exact:true}).fill(name+" — reviewed");
  await expect(confirm(page)).not.toBeChecked();await confirm(page).check();
  await page.route("**/api/nonprofit/plan",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic save interruption."})}):route.continue());
  await saveButton(page,"plan").click();await expect(page.getByRole("alert").filter({hasText:"Synthetic save interruption."})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Roadmap title *",exact:true})).toHaveValue(name+" — reviewed");
  await page.unroute("**/api/nonprofit/plan");await saveButton(page,"plan").click();
  const id=await savedId(page,"plan"),d=await get(client,"plan",id);expect(d.revision).toBe(1);expect(d.data).toMatchObject({milestones:expect.arrayContaining([expect.objectContaining({owner:"Example founder",status:"blocked"})])});
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:"test-results/nonprofit-roadmap-"+info.project.name+".png",fullPage:true});
  await page.getByRole("heading",{name:"Make the next moves manageable",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/nonprofit-roadmap-focus-"+info.project.name+".png"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goto("/workspace/nonprofit");await expect(page.getByRole("heading",{name:"What moves the mission forward?",exact:true})).toBeVisible();await expect(page.getByText(/This milestone is blocked or has unfinished dependencies/).first()).toBeVisible();
 });
 test("saves a partnership, approves a compared proposal and restores the original as a new revision",async({page},info)=>{
  const client=await session(),name=title("Neighborhood partner network");
  await signIn(page);await page.goto("/workspace/nonprofit/partner/new");
  await page.getByRole("textbox",{name:"Name or organization *",exact:true}).fill(name);
  await page.getByRole("textbox",{name:"Next follow-up action",exact:true}).fill("Confirm the community partnership conversation.");
  await page.getByRole("textbox",{name:"Follow-up owner",exact:true}).fill("Example coordinator");
  await page.getByLabel("Follow-up date",{exact:true}).fill("2026-09-01");
  await confirm(page).check();await saveButton(page,"partner").click();
  const id=await savedId(page,"partner"),d=await get(client,"partner",id);
  await propose(client,"partner",{...d.data,nextAction:"Ask for the agreed administrative meeting time."},d);
  await page.goto("/workspace/nonprofit/partner/proposals");
  const card=page.locator("section").filter({has:page.getByRole("heading",{name,exact:true})}).last();
  await expect(card.getByRole("heading",{name:"Current saved revision 1",exact:true})).toBeVisible();
  await expect(card.getByRole("button",{name:"Approve and save proposal",exact:true})).toBeDisabled();
  await card.getByRole("checkbox",{name:/I reviewed the exact proposal/}).check();await card.getByRole("button",{name:"Approve and save proposal",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Approved and saved"})).toBeVisible();
  await page.goto("/workspace/nonprofit/partner/"+id);await expect(page.getByRole("textbox",{name:"Next follow-up action",exact:true})).toHaveValue("Ask for the agreed administrative meeting time.");
  await page.getByText(/Revision 1 · .* · user/).click();await page.getByRole("button",{name:"Review a copy of revision 1",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Next follow-up action",exact:true})).toHaveValue("Confirm the community partnership conversation.");expect((await get(client,"partner",id)).revision).toBe(2);
  await confirm(page).check();await saveButton(page,"partner").click();await expect(notice(page)).toBeVisible();expect((await get(client,"partner",id)).revision).toBe(3);
  const promised=page.waitForEvent("download");await page.getByRole("button",{name:"Download saved record",exact:true}).click();const downloaded=await promised;const output=readFileSync((await downloaded.path())!,"utf8");
  expect(output).toContain("Saved revision 3");expect(output).toContain("OUTREACH DRAFT — NOT SENT");expect(output).toContain("Confirm the community partnership conversation.");
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:"test-results/nonprofit-partner-"+info.project.name+".png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test("records meeting time zone, decisions and a follow-up action without booking a calendar",async({page})=>{
  const client=await session(),name=title("Volunteer planning conversation");
  await signIn(page);await page.goto("/workspace/nonprofit/meeting/new");
  await page.getByRole("textbox",{name:"Meeting title *",exact:true}).fill(name);
  await page.getByLabel("Meeting date",{exact:true}).fill("2026-09-10");await page.getByLabel("Local meeting time",{exact:true}).fill("09:30");
  await page.getByRole("textbox",{name:"Meeting time zone",exact:true}).fill("America/Chicago");
  await page.getByRole("textbox",{name:"Administrative participants",exact:true}).fill("Example coordinator\nExample volunteer");
  await page.getByRole("textbox",{name:"Meeting agenda",exact:true}).fill("Agree on administrative roles and a useful next conversation.");
  await page.getByRole("textbox",{name:"Recorded decisions",exact:true}).fill("Discuss the draft volunteer role.\nKeep clinical information outside this workspace.");
  await page.getByRole("button",{name:"Add a meeting action",exact:true}).click();
  await page.getByRole("textbox",{name:"Action title *",exact:true}).fill("Confirm the next planning conversation");
  await page.getByRole("textbox",{name:"Owner",exact:true}).fill("Example coordinator");
  await page.getByLabel("Due date",{exact:true}).fill("2026-09-11");
  await confirm(page).check();await saveButton(page,"meeting").click();
  const d=await get(client,"meeting",await savedId(page,"meeting"));
  expect(d.data).toMatchObject({localTime:"09:30",timeZone:"America/Chicago",participants:["Example coordinator","Example volunteer"],decisions:["Discuss the draft volunteer role.","Keep clinical information outside this workspace."],actions:[expect.objectContaining({title:"Confirm the next planning conversation",owner:"Example coordinator"})]});
 });
 test("records a source-first question and exports findings separately from interpretation",async({page},info)=>{
  const client=await session(),name=title("Grant eligibility review");
  await signIn(page);await page.goto("/workspace/nonprofit/research/new");
  await page.getByRole("textbox",{name:"Research title *",exact:true}).fill(name);
  await page.getByRole("textbox",{name:"Question to resolve *",exact:true}).fill("What eligibility questions should this fictional grantmaker review?");
  await page.getByRole("textbox",{name:"Research jurisdiction *",exact:true}).fill("Fictional jurisdiction");
  await page.getByRole("combobox",{name:"Research category",exact:true}).selectOption("grant");
  await page.getByRole("button",{name:"Add a source",exact:true}).click();
  await page.getByRole("textbox",{name:"Source title *",exact:true}).fill("Fictional grantmaker source");
  await page.getByRole("textbox",{name:"Issuing authority or grantmaker *",exact:true}).fill("Example grantmaker");
  await page.getByRole("combobox",{name:"Authority type",exact:true}).selectOption("grantmaker");
  await page.getByRole("textbox",{name:"Source URL *",exact:true}).fill("https://example.org/fictional-grant-source");
  await page.getByLabel("Date retrieved *",{exact:true}).fill("2026-09-08");
  await page.getByRole("textbox",{name:"Authority finding *",exact:true}).fill("Fictional acceptance evidence, not an actual funding opportunity.");
  await page.getByRole("textbox",{name:"Interpretation",exact:true}).fill("Eligibility is not established by this fictional exercise.");
  await page.getByRole("textbox",{name:"Required next action",exact:true}).fill("Ask the real grantmaker to clarify applicable eligibility.");
  await confirm(page).check();await saveButton(page,"research").click();
  const d=await get(client,"research",await savedId(page,"research"));expect(d.data).toMatchObject({epistemicState:"inferred",sources:[expect.objectContaining({authority:"Example grantmaker",retrievedDate:"2026-09-08"})]});
  const promised=page.waitForEvent("download");await page.getByRole("button",{name:"Download saved record",exact:true}).click();const downloaded=await promised,output=readFileSync((await downloaded.path())!,"utf8");
  expect(output).toContain("SOURCE FINDINGS");expect(output).toContain("INTERPRETATION [inferred]");expect(output).toContain("Professional review recommendation");expect(output).toContain("does not certify compliance");
  await page.getByText("Fictional grantmaker source",{exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:"test-results/nonprofit-research-"+info.project.name+".png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole("heading",{name:"The evidence behind the answer",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/nonprofit-research-focus-"+info.project.name+".png"});
 });
 test("retains rejected proposals, blocks stale approval and rejects foreign records",async({page})=>{
  const client=await session(),other=await session("founderOther"),name=title("Governance planning");
  const d=await save(client,"plan",{...emptyNonprofitData.plan,title:name,mission:"A fictional original mission."});
  await propose(client,"plan",{...d.data,mission:"A proposed mission change."},d);
  await save(client,"plan",{...d.data,mission:"A newer user decision."},d);
  await signIn(page);await page.goto("/workspace/nonprofit/plan/proposals");
  const card=page.locator("section").filter({has:page.getByRole("heading",{name,exact:true})}).last();
  await expect(card.getByText(/This record changed since the proposal/)).toBeVisible();await expect(card.getByRole("button",{name:"Approve and save proposal",exact:true})).toBeDisabled();
  await card.getByRole("button",{name:"Reject proposal",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Proposal rejected."})).toBeVisible();
  await page.getByRole("combobox",{name:"Proposal status",exact:true}).selectOption("rejected");await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();expect((await get(client,"plan",d.id)).data).toMatchObject({mission:"A newer user decision."});
  const foreign=await save(other,"plan",{...emptyNonprofitData.plan,title:"PRIVATE OTHER FOUNDER",mission:"PRIVATE_NONPROFIT_BROWSER_MARKER"});
  await page.goto("/workspace/nonprofit/plan/"+foreign.id);await expect(page.getByRole("alert").filter({hasText:"This founder record is unavailable."})).toBeVisible();await expect(page.getByText("PRIVATE_NONPROFIT_BROWSER_MARKER",{exact:true})).toHaveCount(0);
 });
});
