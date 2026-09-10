import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {expect,test,type Page} from "@playwright/test";
import JSZip from "jszip";

async function docx(text:string){
  const zip=new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml",`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({type:"uint8array",compression:"DEFLATE"}));
}
function fixture(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8")).writer as {email:string;password:string};}
async function session(){
  const config=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(config.url).toBe("http://127.0.0.1:58521");
  const client=createClient(config.url,config.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});
  expect((await client.auth.signInWithPassword(fixture())).error).toBeNull();return client;
}
type Client=Awaited<ReturnType<typeof session>>;
async function clearBatch(client:Client){
  const current=await client.rpc("writer_get_import_batch");expect(current.error).toBeNull();
  if(current.data.items){const cleared=await client.rpc("writer_clear_import_batch",{expected_version:current.data.version});expect(cleared.error).toBeNull();}
}
async function signIn(page:Page){
  const user=fixture();await page.goto("/login?legacy=1");await page.getByLabel("Email",{exact:true}).fill(user.email);await page.getByLabel("Password",{exact:true}).fill(user.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
}

test.describe("Writer bulk library staging",()=>{
  test.setTimeout(150000);
  test.skip(process.env.WRITER_LOCAL_ACCEPTANCE!=="true","Requires the isolated Writer stack and fictional accounts.");
  test.beforeEach(async({baseURL})=>{expect(baseURL).toBe("http://localhost:3125");await clearBatch(await session());});
  test.afterEach(async()=>clearBatch(await session()));

  test("recovers a partial batch, reviews exact duplicates and safely retries one atomic import",async({page},info)=>{
    const client=await session(),marker=randomUUID().replaceAll("-","");
    const title="Synthetic bulk resource "+marker,body="Fictional bulk source "+marker+" for careful review.";
    const existing=await client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title,body_text:body,source_label:"Synthetic existing duplicate"}});
    expect(existing.error).toBeNull();
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    await signIn(page);await page.goto("/workspace/writing");await page.getByRole("link",{name:"Import a library",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Turn a folder of work into a useful library.",exact:true})).toBeVisible();
    await page.getByLabel("Choose documents",{exact:true}).setInputFiles([
      {name:"first-source.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:await docx(body)},
      {name:"second-source.md",mimeType:"text/markdown",buffer:Buffer.from(body.replaceAll(" ","  "),"utf8")},
      {name:"unsupported.html",mimeType:"text/html",buffer:Buffer.from("<p>Not accepted</p>","utf8")}
    ]);
    await expect(page.getByText("Use a .txt, .md, .docx, or .pdf file.",{exact:true})).toBeVisible();
    await expect(page.getByText("2 staged · 2 included",{exact:false})).toBeVisible();
    const titles=page.getByRole("textbox",{name:"Title",exact:true});await expect(titles).toHaveCount(2);await titles.nth(0).fill(title);await titles.nth(1).fill(title);
    await page.getByRole("combobox",{name:"Resource type",exact:true}).nth(1).selectOption("sermon");
    await expect(page.getByText(/^Staging list saved ·/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Your staging list will save privately as documents are added.",{exact:true})).not.toBeVisible();
    await expect(page.getByRole("textbox",{name:"Title",exact:true})).toHaveCount(2);
    await expect(page.getByRole("textbox",{name:"Title",exact:true}).nth(0)).toHaveValue(title);
    await expect(page.getByRole("combobox",{name:"Resource type",exact:true}).nth(1)).toHaveValue("sermon");
    await page.getByRole("button",{name:"Review duplicate signals",exact:true}).click();
    await expect(page.getByText("Already in your library",{exact:false}).first()).toBeVisible();
    await expect(page.getByText("Also staged",{exact:false}).first()).toBeVisible();
    await expect(page.getByText(/same recorded text, ignoring whitespace/).first()).toBeVisible();
    await page.screenshot({path:"test-results/writer-bulk-review-"+info.project.name+".png",fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.getByRole("checkbox",{name:"Include resource 2",exact:true}).uncheck();
    await expect(page.getByRole("button",{name:"Review duplicate signals",exact:true})).toBeVisible();
    await expect(page.getByText(/^Staging list saved ·/)).toBeVisible();
    await page.getByRole("button",{name:"Review duplicate signals",exact:true}).click();
    await page.getByRole("checkbox",{name:/I reviewed the titles, sources/}).check();
    let imported:SourceBatchCommit|undefined;
    await page.route("**/api/writing/bulk/commit",async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);imported=await response.json();await route.abort("failed");});
    await page.getByRole("button",{name:"Import 1 reviewed resource",exact:true}).click();
    await expect.poll(()=>imported?.resources.length).toBe(1);
    await expect(page.getByRole("alert").filter({hasText:"Failed to fetch"})).toBeVisible();
    await page.unroute("**/api/writing/bulk/commit");await page.getByRole("button",{name:"Import 1 reviewed resource",exact:true}).click();
    await expect(page.getByRole("heading",{name:"1 resource ready for review.",exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:new RegExp(title)})).toBeVisible();
    const found=await client.rpc("writer_list_resources",{search_text:title});expect(found.error).toBeNull();expect(found.data.matchingCount).toBe(2);
    const staged=await client.rpc("writer_get_import_batch");expect(staged.error).toBeNull();expect(staged.data.items).toBeNull();
    await page.screenshot({path:"test-results/writer-bulk-import-"+info.project.name+".png",fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
  });
});

type SourceBatchCommit={resources:Array<{resourceId:string}>};
