import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

async function docx(lines: string[]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(line=>`<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}
async function clearWriterImportDraft(fixture:{email:string;password:string}) {
  const config=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));
  const client=createClient(config.url,config.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});
  const signedIn=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});expect(signedIn.error).toBeNull();
  const current=await client.rpc("writer_get_working_draft",{resource_id:null});expect(current.error).toBeNull();
  if(current.data.values){const cleared=await client.rpc("writer_clear_working_draft",{resource_id:null,expected_version:current.data.version});expect(cleared.error).toBeNull();}
}
test.describe("Writer approved revisions in the actual local browser", () => {
  test.setTimeout(120000);
  test.skip(process.env.WRITER_LOCAL_ACCEPTANCE !== "true","Requires the isolated Writer stack and fictional accounts.");
  test("import text, preview a proposal, explicitly approve, and retain the original",async({page,baseURL},testInfo) => {
    expect(baseURL).toBe("http://localhost:3125");
    const fixture=JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8")).writer;
    await clearWriterImportDraft(fixture);
    const title="Synthetic browser manuscript "+randomUUID();
    const original="A fictional manuscript about listening.\n\nThe original voice stays recoverable.";
    const revised="A fictional revised manuscript about listening.\nMake space for the next voice.";
    const errors:string[]=[]; page.on("pageerror",(error)=>errors.push(error.message));
    await page.goto("/login?legacy=1");
    await page.getByLabel("Email",{exact:true}).fill(fixture.email);
    await page.getByLabel("Password",{exact:true}).fill(fixture.password);
    await page.getByRole("button",{name:"Sign in",exact:true}).click();
    await expect(page).toHaveURL(/\/workspace$/);
    await page.goto("/workspace/writing/new");
    await page.getByLabel("Author Optional").fill("Fictional author");
    await page.getByLabel("Choose a document",{exact:true}).setInputFiles({name:"synthetic-manuscript.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:await docx(original.split("\n\n"))});
    await expect(page.getByText("synthetic-manuscript.docx",{exact:true})).toBeVisible();
    await expect(page.getByText(/Formatting is not preserved/)).toBeVisible();
    await page.getByRole("button",{name:"Use this extracted text",exact:true}).click();
    await expect(page.getByLabel("Title",{exact:true})).toHaveValue("synthetic manuscript");
    await expect(page.getByLabel("Source label",{exact:true})).toHaveValue("Imported from synthetic-manuscript.docx");
    await expect(page.getByRole("textbox",{name:"Source text",exact:true})).toHaveValue(original);
    await page.getByLabel("Title",{exact:true}).fill(title);
    await page.getByLabel("Source label",{exact:true}).fill("Synthetic browser source");
    await page.route("**/api/writing/import", (route) => route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic temporary save failure. Please retry."})}));
    await page.getByRole("button",{name:"Save resource and review"}).click();
    await expect(page.getByText("Synthetic temporary save failure. Please retry.",{exact:true})).toBeVisible();
    await expect(page.getByRole("textbox",{name:"Source text",exact:true})).toHaveValue(original);
    await page.unroute("**/api/writing/import");
    await page.getByRole("button",{name:"Save resource and review"}).click();
    await expect(page.getByRole("heading",{name:title,exact:true,level:1})).toBeVisible();
    await expect(page.getByText("Revision 1 · Original preserved",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Propose an improvement"}).click();
    await page.getByLabel("Intended audience",{exact:true}).fill("Community volunteers");
    await page.getByRole("textbox",{name:"Proposed text",exact:true}).fill(revised);
    await page.getByRole("textbox",{name:"Why this helps",exact:true}).fill("A clearer invitation to listen.");
    await page.getByRole("button",{name:"Save proposal for comparison"}).click();
    const proposal=page.getByRole("article",{name:"Proposal: A clearer invitation to listen."});
    await expect(proposal).toBeVisible();
    await expect(proposal.getByText(original,{exact:true})).toBeVisible();
    await expect(proposal.getByText(revised,{exact:true})).toBeVisible();
    const approve=proposal.getByRole("button",{name:"Approve and save revision"});
    await expect(approve).toBeDisabled();
    await proposal.scrollIntoViewIfNeeded();
    await proposal.screenshot({path:"test-results/writer-comparison-"+testInfo.project.name+".png"});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    await proposal.getByRole("checkbox").check();
    await approve.click();
    await expect(page.getByText("Revision 2 · Original preserved",{exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByText("Revision 2 · Original preserved",{exact:true})).toBeVisible();
    await page.getByText("Saved revision history (2, original included)",{exact:true}).click();
    await page.getByText(/Revision 1 · .* · user import/).click();
    await expect(page.locator("details").getByText(original,{exact:true})).toBeVisible();
    await page.screenshot({path:"test-results/writer-approved-"+testInfo.project.name+".png",fullPage:true});
    expect(errors).toEqual([]);
  });
});
