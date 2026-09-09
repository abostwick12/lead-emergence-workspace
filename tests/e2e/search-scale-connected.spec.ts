import {readFileSync} from "node:fs";
import {test,expect,type Page} from "@playwright/test";
async function signIn(page:Page){
 const f=JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8")).layoutAll;
 const scale=JSON.parse(readFileSync(".bundle-local/search-scale-fixtures.json","utf8"));
 expect(scale.counts.ownTotal).toBe(15000);
 await page.goto("/login?legacy=1&next=%2Fworkspace%2Fsearch");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/search$/);
 await expect(page.getByText("Search scope · 16 of 16 selected",{exact:true})).toBeVisible();
}
async function search(page:Page,query:string){
 await page.getByLabel("Find saved work",{exact:true}).fill(query);
 await page.getByRole("button",{name:"Search saved work",exact:true}).click();
}
test.describe("large fictional saved-work library",()=>{
 test.setTimeout(120000);
 test.skip(process.env.SEARCH_SCALE_LOCAL_ACCEPTANCE!=="true","Requires the explicit local 15,000-record scale fixture.");
 test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));
 test("shows complete counts, bounded cards, honest paging limits and a narrow result",async({page},info)=>{
  await signIn(page);await search(page,"p11ascale");
  await expect(page.getByRole("heading",{name:"15000 saved records found",exact:true})).toBeVisible();
  const rows=page.locator(".search-result");await expect(rows).toHaveCount(25);
  await expect(rows.first().getByRole("heading")).toHaveText("P11ascale");
  await expect(page.getByText("The first 10,025 matches are pageable.",{exact:false})).toBeVisible();
  await page.getByText("What was searched",{exact:true}).click();
  await expect(page.getByText("Writing · Saved resources: 12000",{exact:true})).toBeVisible();
  await expect(page.locator(".search-results details li")).toHaveCount(16);
  await page.locator(".search-results").scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/search-scale-"+info.project.name+".png",fullPage:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const firstIds=await rows.getByRole("link",{name:"Open original record →",exact:true}).evaluateAll(ns=>ns.map(n=>n.getAttribute("href")));
  await page.getByRole("button",{name:"Next results",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Showing 26–50."})).toBeVisible();
  const nextIds=await rows.getByRole("link",{name:"Open original record →",exact:true}).evaluateAll(ns=>ns.map(n=>n.getAttribute("href")));
  expect(nextIds).toHaveLength(25);expect(nextIds.some(id=>firstIds.includes(id))).toBe(false);
  await search(page,"precisionneedle11999");
  await expect(page.getByRole("heading",{name:"1 saved records found",exact:true})).toBeVisible();
  await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("P11ascale Writer 11999");
  await expect(page.getByRole("button",{name:"Next results",exact:true})).toBeDisabled();
  expect(page.url()).toBe("http://localhost:3125/workspace/search");
 });
 test("keeps 500 other-owner controls invisible and returns to broad search",async({page})=>{
  await signIn(page);await search(page,"foreignscaleprivate");
  await expect(page.getByRole("heading",{name:"No matches in the selected scopes",exact:true})).toBeVisible();
  await expect(page.locator(".search-result")).toHaveCount(0);
  await search(page,"p11ascale");
  await expect(page.getByRole("heading",{name:"15000 saved records found",exact:true})).toBeVisible();
  await expect(page.locator(".search-result")).toHaveCount(25);
 });
});
