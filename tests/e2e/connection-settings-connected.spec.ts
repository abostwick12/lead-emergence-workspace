import {readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
test("Settings routes assistant access to the verified center without metadata-status reads",async({page,baseURL})=>{
 test.skip(process.env.CONNECTIONS_LOCAL_ACCEPTANCE!=="true","Requires the isolated fictional local fixture.");
 expect(baseURL).toBe("http://localhost:3125");test.setTimeout(120000);
 const f=JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8")).layoutAll;expect(f.email).toMatch(/@example\.invalid$/);
 let metadataReads=0;page.on("request",r=>{if(r.url().includes("/rest/v1/mcp_authorizations"))metadataReads++;});
 await page.goto("/login?legacy=1&next=%2Fworkspace%2Fsettings");
 await page.getByLabel("Email",{exact:true}).fill(f.email);await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/settings$/);
 const section=page.locator("#assistant");await expect(section.getByRole("heading",{name:"AI / Assistant",exact:true})).toBeVisible();
 await expect(section.getByRole("button",{name:"Disconnect",exact:true})).toHaveCount(0);
 await section.getByRole("link",{name:"Manage access in connection center",exact:false}).click();
 await expect(page).toHaveURL(/\/workspace\/integrations$/);await expect(page.getByRole("heading",{name:"Connections",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Refresh connections",exact:true})).toBeEnabled();expect(metadataReads).toBe(0);
});
