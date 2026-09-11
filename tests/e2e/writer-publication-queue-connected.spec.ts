import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

function fixture(){return JSON.parse(readFileSync(".bundle-local/fixtures.json","utf8")).writer as {email:string;password:string};}
async function session(){
  const config=JSON.parse(readFileSync(".bundle-local/public-config.json","utf8"));expect(config.url).toBe("http://127.0.0.1:58521");
  const client=createClient(config.url,config.anonKey,{db:{schema:"workspace"},auth:{persistSession:false,autoRefreshToken:false}});
  expect((await client.auth.signInWithPassword(fixture())).error).toBeNull();return client;
}
async function signIn(page:Page){const user=fixture();await page.goto("/login?legacy=1");await page.getByLabel("Email",{exact:true}).fill(user.email);await page.getByLabel("Password",{exact:true}).fill(user.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);}

test.describe("Writer publication readiness queue",()=>{
  test.setTimeout(150000);
  test.skip(process.env.WRITER_LOCAL_ACCEPTANCE!=="true","Requires the isolated Writer stack and fictional accounts.");
  test.beforeEach(async({baseURL})=>expect(baseURL).toBe("http://localhost:3125"));

  test("recovers exact saves, records dated evidence, hands off honestly, and stales on revision change",async({page},info)=>{
    const client=await session(),marker=randomUUID().replaceAll("-","");
    const title="Synthetic publication plan "+marker,destination="https://resources.example.com/fictional-"+marker;
    const created=await client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{title,author:"Fictional author",audience:"Community leaders",topics:["Topic "+marker],abstract:"A useful fictional summary.",body_text:"Fictional reviewed publication source "+marker+".",source_label:"Synthetic P21 browser source",metadata:{website_summary:"A useful fictional summary.",seo_description:"A concise fictional description."}}});
    expect(created.error).toBeNull();const id=created.data.resourceId;
    const proposal=await client.rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:1,proposed_patch:{publication_state:"ready"},proposal_reason:"Synthetic publication readiness",source_evidence:"Explicit fictional browser fixture"});
    expect(proposal.error).toBeNull();expect((await client.rpc("writer_decide_proposal",{proposal_id:proposal.data.proposalId,expected_revision:1,decision:"approve"})).error).toBeNull();
    const browserErrors:string[]=[];page.on("pageerror",error=>browserErrors.push(error.message));
    await signIn(page);await page.goto("/workspace/writing/"+id);await expect(page.getByText("Revision 2 · Original preserved",{exact:true})).toBeVisible();
    await expect(page.getByText(/Saved revision history \(2, original included\)/)).toBeVisible();
    const prepareButton=page.getByRole("button",{name:"Prepare publication packet",exact:true});
    await prepareButton.evaluate(element=>element.scrollIntoView({block:"center"}));
    await expect.poll(()=>prepareButton.evaluate(element=>{const rect=element.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return rect.top>=0&&rect.bottom<=innerHeight&&(hit===element||element.contains(hit));})).toBe(true);
    await prepareButton.dispatchEvent("click");
    await expect(page.getByRole("button",{name:"Add revision 2 to publication queue",exact:true})).toBeVisible();
    let saved=false;
    await page.route("**/api/writing/publication",async route=>{
      if(saved||route.request().method()!=="POST")return route.continue();saved=true;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort("failed");
    });
    await page.getByRole("button",{name:"Add revision 2 to publication queue",exact:true}).click();
    await expect(page.getByRole("alert").filter({hasText:"Failed to fetch"})).toBeVisible();
    await page.unroute("**/api/writing/publication");await page.getByRole("button",{name:"Add revision 2 to publication queue",exact:true}).click();
    await page.getByRole("link",{name:"Open publication queue",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/writing\/publication$/);
    const card=page.getByRole("article",{name:"Publication plan: "+title});await expect(card).toBeVisible();
    await card.getByRole("textbox",{name:/Public destination/}).fill(destination);
    await card.getByRole("textbox",{name:/Handoff note/}).fill("Fictional handoff to the resource editor.");
    await card.getByRole("checkbox",{name:/Accuracy and quotations reviewed/}).check();
    await card.getByRole("checkbox",{name:/Author voice reviewed/}).check();
    await card.getByRole("checkbox",{name:/Rights confirmed/}).check();
    await card.getByRole("button",{name:"Save review progress",exact:true}).click();await expect(card.getByRole("status")).toContainText("Publication review saved.");
    const open=card.getByRole("link",{name:"Open saved destination",exact:false});await expect(open).toHaveAttribute("href",destination);await expect(open).toHaveAttribute("target","_blank");
    await card.getByRole("checkbox",{name:/I opened the saved destination/}).check();
    let observed=false;
    await page.route("**/api/writing/publication/evidence",async route=>{
      if(observed)return route.continue();observed=true;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort("failed");
    });
    await card.getByRole("button",{name:"Record dated link check",exact:true}).click();await expect(card.getByRole("alert")).toContainText("Failed to fetch");
    await page.unroute("**/api/writing/publication/evidence");await card.getByRole("button",{name:"Record dated link check",exact:true}).click();
    await expect(card.getByRole("status")).toContainText("earlier link observation was recovered safely");
    await expect(card.getByRole("heading",{name:"This revision has complete handoff evidence."})).toBeVisible();
    await card.getByRole("button",{name:"Mark this revision ready for handoff",exact:true}).click();await expect(card.getByText("Ready for handoff",{exact:true})).toBeVisible();
    await card.getByRole("checkbox",{name:/I exported and handed off this exact saved revision/}).check();await card.getByRole("button",{name:"Record handoff",exact:true}).click();
    await expect(card.getByText("Handoff recorded—not published.",{exact:true})).toBeVisible();
    await page.screenshot({path:"test-results/writer-publication-queue-"+info.project.name+".png",fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const next=await client.rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:2,proposed_patch:{audience:"Updated fictional readers"},proposal_reason:"Synthetic later revision",source_evidence:"Explicit fictional concurrency fixture"});
    expect(next.error).toBeNull();expect((await client.rpc("writer_decide_proposal",{proposal_id:next.data.proposalId,expected_revision:2,decision:"approve"})).error).toBeNull();
    await page.reload();const fresh=page.getByRole("article",{name:"Publication plan: "+title});await expect(fresh.getByText("Revision 3 is now current.",{exact:true})).toBeVisible();
    await expect(fresh.getByText("Stale",{exact:true})).toBeVisible();await fresh.getByRole("button",{name:"Use revision 3",exact:true}).click();
    await expect(fresh.getByText("Revision 3 · queue version 6",{exact:true})).toBeVisible();
    await expect(fresh.getByRole("checkbox",{name:/Accuracy and quotations reviewed/})).not.toBeChecked();
    await expect(fresh.getByText("Destination evidence is stale",{exact:true})).toBeVisible();
    await fresh.getByRole("button",{name:"Remove from active queue",exact:true}).click();await expect(page.getByRole("heading",{name:"Nothing is waiting for a handoff"})).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
});
