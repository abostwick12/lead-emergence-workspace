import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

function fixtures(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8"));}
function resetValueHistory(){
  const config=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(config.url).toBe("http://127.0.0.1:58521");
  const fixture=fixtures().layoutAll,workspace=String(fixture.workspaceId),user=String(fixture.id);
  expect(workspace).toMatch(/^[0-9a-f-]{36}$/);expect(user).toMatch(/^[0-9a-f-]{36}$/);
  const sql=`delete from workspace_private.bundle_value_pilot_receipts where workspace_id='${workspace}' and user_id='${user}';delete from workspace_private.bundle_value_pilot_sessions where workspace_id='${workspace}' and user_id='${user}';`;
  execFileSync(process.platform==="win32"?"docker.exe":"docker",["exec","-i","supabase_db_bundle-experience-p2","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],{input:sql});
}
async function signIn(page:Page,role="layoutAll"){
  const fixture=fixtures()[role];await page.goto("/login?legacy=1&next=%2Fworkspace%2Fvalue");
  await page.getByLabel("Email",{exact:true}).fill(fixture.email);await page.getByLabel("Password",{exact:true}).fill(fixture.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/value$/);
}
async function start(page:Page,bundle:string,baseline:string){
  const card=page.getByRole("article").filter({has:page.getByRole("heading",{name:bundle,exact:true})});
  await card.getByLabel(/Before starting/).fill(baseline);await card.getByRole("button",{name:/Start value check|Run another check/}).click();
  await expect(page.getByRole("status").filter({hasText:`${bundle} measurement started.`})).toBeVisible();return card;
}

test.describe("private bundle value checks",()=>{
  test.setTimeout(120000);
  test.skip(process.env.VALUE_PILOT_LOCAL_ACCEPTANCE!=="true","Requires the isolated all-six fictional fixture.");
  test.beforeEach(async({baseURL})=>{expect(baseURL).toBe("http://localhost:3125");resetValueHistory();});

  test("records a pre-work baseline, survives reload and labels one completed result honestly",async({page},info)=>{
    await signIn(page);await expect(page.getByRole("heading",{name:"Does each bundle earn its place?"})).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(6);const card=await start(page,"Executive","30");
    await expect(card.getByText("Measurement is running from the server start time.")).toBeVisible();
    await expect(card.getByRole("link",{name:/Open Executive/})).toHaveAttribute("href","/workspace/executive");
    await page.reload();const restored=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Executive",exact:true})});
    await expect(restored.getByText("Measurement is running from the server start time.")).toBeVisible();
    await restored.getByRole("button",{name:"Record the outcome"}).click();
    await restored.getByLabel("Did you reach the expected first outcome?").selectOption("yes");
    await restored.getByText("The user accepts, edits, or acts on at least one brief recommendation.").click();
    await restored.getByLabel("Useful result").selectOption("5");await restored.getByLabel("Result felt trustworthy").selectOption("4");
    await restored.getByLabel("Next move was clear").selectOption("4");await restored.getByLabel("Evidence was visible where it mattered").selectOption("yes");
    await restored.getByLabel("Origin, freshness, or uncertainty was clear").selectOption("yes");
    await restored.getByLabel("Nothing changed without review and confirmation").selectOption("yes");
    await restored.getByLabel("Corrections needed before the result was useful").fill("1");
    await restored.getByRole("button",{name:"Record result",exact:true}).click();
    await expect(page.getByRole("status").filter({hasText:"Executive result recorded."})).toBeVisible();
    await expect(restored.getByText("Strong user-reported signal",{exact:true})).toBeVisible();
    await expect(restored.getByText(/One session is not representative proof/)).toBeVisible();
    const response=await page.request.get("/api/bundles/value-pilots");expect(response.status()).toBe(401);
    expect(await page.evaluate(()=>({local:Object.keys(localStorage).some(key=>key.includes("value")),session:Object.keys(sessionStorage).some(key=>key.includes("value"))}))).toEqual({local:false,session:false});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`test-results/bundle-value-pilot-${info.project.name}.png`,fullPage:true});
    await page.goto("/workspace/settings");await expect(page.getByRole("link",{name:"Measure bundle value",exact:true})).toHaveAttribute("href","/workspace/value");
  });

  test("retries the exact start after the server committed but the response was lost",async({page},info)=>{
    test.skip(info.project.name!=="desktop","Transport uncertainty is exercised once; the complete flow runs in both viewports.");
    await signIn(page);let interrupted=false;
    await page.route("**/api/bundles/value-pilots",async route=>{
      if(interrupted||route.request().method()!=="POST")return route.continue();
      interrupted=true;const response=await route.fetch();expect(response.status()).toBe(200);
      await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic uncertain value-check response."})});
    });
    const card=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Writer & Editor",exact:true})});
    await card.getByLabel(/Before starting/).fill("25");await card.getByRole("button",{name:"Start value check"}).click();
    await expect(page.getByRole("alert").filter({hasText:"Synthetic uncertain value-check response."})).toBeVisible();
    await page.unroute("**/api/bundles/value-pilots");await card.getByRole("button",{name:"Start value check"}).click();
    await expect(page.getByRole("status").filter({hasText:"Writer & Editor measurement started."})).toBeVisible();
    await expect(card.getByText("Measurement is running from the server start time.")).toBeVisible();
    await expect(card.getByText("1 private session retained")).toBeVisible();
  });

  test("makes assignment limits visible before a user starts",async({page})=>{
    await signIn(page,"layout");
    const executive=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Executive",exact:true})});
    const workspace=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Workspace Experience",exact:true})});
    await expect(executive.getByText("Not currently assigned",{exact:true})).toBeVisible();
    await expect(executive.getByLabel(/Before starting/)).toBeDisabled();await expect(executive.getByRole("button",{name:"Start value check"})).toBeDisabled();
    await expect(workspace.getByText("Available",{exact:true})).toBeVisible();await expect(workspace.getByLabel(/Before starting/)).toBeEnabled();
  });
});
