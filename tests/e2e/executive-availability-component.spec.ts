import {test,expect,type Page} from "@playwright/test";
const planner=(page:Page)=>page.getByRole("region",{name:"Meeting availability planner",exact:true});
const record=async(page:Page)=>JSON.parse((await page.getByTestId("record").textContent())!);
async function open(page:Page){
 await page.clock.install({time:new Date("2026-09-09T12:00:00Z")});await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
 await page.goto("/");await page.getByText("Find times from reviewed availability",{exact:true}).click();
}
async function windows(page:Page,start="2026-09-09T14:00",end="2026-09-09T18:00"){
 await page.getByLabel("offered window 1 start",{exact:true}).fill(start);await page.getByLabel("offered window 1 end",{exact:true}).fill(end);
 await page.getByRole("button",{name:"I am available throughout the offered windows",exact:true}).click();
 await page.getByLabel("Where and with whom availability was checked *",{exact:true}).fill("Fictional calendar and colleague, manually reviewed");
}
async function find(page:Page){
 await page.getByRole("button",{name:"Confirm I rechecked these windows now",exact:true}).click();
 await page.getByRole("button",{name:"Find proposed meeting times",exact:true}).click();
}
test.describe("Executive availability isolated component — no database/auth proof",()=>{
 test.skip(({baseURL})=>baseURL!=="http://127.0.0.1:3130","Requires the isolated component harness, not the connected app.");
 test("chooses a buffered time, retains evidence across component remount and never submits",async({page},info)=>{
  const errors:string[]=[],api:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  page.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/api/"))api.push(request.url());});
  await open(page);await windows(page);await find(page);
  await expect(page.getByRole("button",{name:"Use proposed time 1",exact:true})).toBeVisible();
  await page.getByRole("region",{name:"Proposed meeting times",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/availability-component/options-"+info.project.name+".png",fullPage:false});
  expect(await record(page)).not.toHaveProperty("availability");
  await page.getByRole("button",{name:"Use proposed time 1",exact:true}).click();
  expect(await record(page)).toMatchObject({startsAt:"2026-09-09T14:15:00.000Z",agreement:"not_agreed",reviewState:"inferred",
   availability:{input:{source:"Fictional calendar and colleague, manually reviewed",checkedAt:"2026-09-09T12:00:00.000Z"}}});
  await expect(page.getByTestId("pending")).toHaveText("No unapplied inputs");await expect(page.getByTestId("valid")).toHaveText("Valid meeting record");
  await page.getByRole("button",{name:"Remount current on-screen record",exact:true}).click();
  await page.getByText("Find times from reviewed availability",{exact:true}).click();
  await expect(page.getByLabel("offered window 1 start",{exact:true})).toHaveValue("2026-09-09T14:00");
  await expect(page.getByLabel("Where and with whom availability was checked *",{exact:true})).toHaveValue("Fictional calendar and colleague, manually reviewed");
  await planner(page).scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/availability-component/planner-"+info.project.name+".png",fullPage:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.getByTestId("submits")).toHaveText("0");expect(api).toEqual([]);expect(errors).toEqual([]);
 });
 test("offers an honest no-overlap state and clears the check after edits",async({page})=>{
  await open(page);await windows(page);await page.getByRole("button",{name:"Add busy window",exact:true}).click();
  await page.getByLabel("busy window 1 start",{exact:true}).fill("2026-09-09T13:00");await page.getByLabel("busy window 1 end",{exact:true}).fill("2026-09-09T19:00");await find(page);
  await expect(page.getByRole("heading",{name:"No suitable overlap found",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Use proposed time 1",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Keep reviewed availability without choosing a time",exact:true}).click();
  expect((await record(page)).startsAt).toBeNull();expect((await record(page)).availability.input.busy).toHaveLength(1);
  await page.getByLabel("busy window 1 end",{exact:true}).fill("2026-09-09T15:00");
  await expect(page.getByRole("button",{name:"Find proposed meeting times",exact:true})).toBeDisabled();
  await expect(page.getByTestId("pending")).toHaveText("Unapplied inputs block the meeting save");
  await expect(page.getByTestId("submits")).toHaveText("0");
 });
 test("requires a new check for changed participants and rejects aged results",async({page})=>{
  await open(page);await windows(page);await find(page);await page.getByLabel("Participant 1 *",{exact:true}).fill("Different fictional colleague");
  await expect(page.getByRole("button",{name:"Use proposed time 1",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Find proposed meeting times",exact:true})).toBeDisabled();
  await find(page);await page.clock.setFixedTime(new Date("2026-09-10T13:00:00Z"));
  await page.getByRole("button",{name:"Use proposed time 1",exact:true}).click();
  await expect(planner(page).getByRole("alert")).toContainText("Recheck availability");
  expect(await record(page)).not.toHaveProperty("availability");await expect(page.getByTestId("submits")).toHaveText("0");
 });
 test("requires explicit repeated-hour choices and rejects daylight-saving gaps",async({page})=>{
  await open(page);await page.clock.setFixedTime(new Date("2026-11-01T04:00:00Z"));
  await page.getByLabel("Meeting time zone *",{exact:true}).selectOption("America/New_York");
  await page.getByLabel("Availability entry time zone",{exact:true}).selectOption("America/New_York");
  await windows(page,"2026-11-01T01:00","2026-11-01T02:30");await find(page);
  await expect(planner(page).getByRole("alert")).toContainText("occurs twice");
  await page.getByRole("group",{name:"offered window 1 start occurrence",exact:true}).getByRole("radio").nth(1).check();
  await page.getByRole("group",{name:"available window 1 start occurrence",exact:true}).getByRole("radio").nth(1).check();
  await find(page);page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Use proposed time 1",exact:true}).click();
  expect((await record(page)).startsAt).toBe("2026-11-01T06:15:00.000Z");
  await expect(page.getByTestId("pending")).toHaveText("No unapplied inputs");
  await page.getByLabel("offered window 1 start",{exact:true}).fill("2026-03-08T02:30");await find(page);
  await expect(planner(page).getByRole("alert")).toContainText("Nonexistent daylight-saving times");
 });
 test("does not lose unapplied manual-time warnings when availability is retained or discarded",async({page})=>{
  await open(page);await windows(page);await find(page);
  await page.getByLabel("Meeting local date and time",{exact:true}).fill("2026-09-09T13:30");
  await page.getByRole("button",{name:"Keep reviewed availability without choosing a time",exact:true}).click();
  await expect(page.getByTestId("pending")).toHaveText("Unapplied inputs block the meeting save");
  await page.getByRole("button",{name:"Use this meeting time",exact:true}).click();
  await expect(page.getByTestId("pending")).toHaveText("No unapplied inputs");
  await page.getByLabel("offered window 1 end",{exact:true}).fill("2026-09-09T17:00");
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Discard unapplied availability edits",exact:true}).click();
  await expect(page.getByLabel("offered window 1 end",{exact:true})).toHaveValue("2026-09-09T18:00");
  await expect(page.getByTestId("pending")).toHaveText("No unapplied inputs");await expect(page.getByTestId("submits")).toHaveText("0");
 });
});
