import {test,expect,type Page} from "@playwright/test";
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
test.describe("Executive delivery isolated component — no persistence proof",()=>{
 test.skip(({baseURL})=>baseURL!=="http://127.0.0.1:3131","Requires the isolated delivery component harness.");
 test("makes schedule authority and delivery limits obvious",async({page},info)=>{await page.goto("/");
  await expect(page.getByText(/Interaction and layout simulation only/)).toBeVisible();await expect(page.getByText(/no background runner/i)).toBeVisible();
  await page.getByRole("button",{name:"Create schedule",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Confirm the exact schedule");
  await page.getByLabel("Schedule name *",{exact:true}).fill("Focused weekday brief");await page.getByLabel("Named time zone *",{exact:true}).fill("America/Chicago");await page.getByRole("checkbox",{name:/I confirm this exact local schedule/}).check();await page.getByRole("button",{name:"Create schedule",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Focused weekday brief",exact:true})).toBeVisible();
  await expect(page.getByLabel("Schedule name *",{exact:true})).toHaveValue("Friday weekly review");await expect(page.getByLabel("Local time *",{exact:true})).toHaveValue("16:00");await expect(page.getByLabel("Friday",{exact:true})).toBeChecked();await expect(page.getByLabel("Monday",{exact:true})).not.toBeChecked();
  await page.getByRole("button",{name:"Pause",exact:true}).click();await expect(page.getByText("Daily brief · paused",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Resume",exact:true}).click();
  await page.getByRole("button",{name:"Simulate one due occurrence",exact:true}).click();await expect(page.getByText("Daily brief · review ready",{exact:true})).toBeVisible();await expect(page.getByText(/63 total matching cues; 7 high priority in the first 50 inspected/)).toBeVisible();await expect(page.getByRole("link",{name:"Open an unsaved daily brief",exact:true})).toHaveAttribute("href","/workspace/executive/daily_brief/new");
  const section=page.getByRole("region",{name:"Bring the right review back at the right time"});await section.screenshot({path:"test-results/delivery-component-"+info.project.name+".png"});await noOverflow(page);
 });
 test("supports explicit weekly days and final cancellation",async({page})=>{await page.goto("/");await page.getByLabel("Review",{exact:true}).selectOption("weekly_review");await page.getByLabel("Monday",{exact:true}).check();await page.getByRole("checkbox",{name:/I confirm this exact local schedule/}).check();await page.getByRole("button",{name:"Create schedule",exact:true}).click();await expect(page.getByText(/Every Monday, Friday at 16:00/)).toBeVisible();page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancel",exact:true}).click();await expect(page.getByText("Weekly review · cancelled",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Resume",exact:true})).toHaveCount(0);await noOverflow(page);});
});
