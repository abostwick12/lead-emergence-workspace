import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import type { InvestorDocument } from "../../lib/investor-bundle/contracts";
import { investorFixtures } from "../../scripts/investor-fixtures.mjs";
import {clearNewEditorDrafts} from "./editor-draft-cleanup";
function fixtures() { return JSON.parse(readFileSync(".bundle-local/fixtures.json", "utf8")); }
async function session(role = "investor") {
  const c = JSON.parse(readFileSync(".bundle-local/public-config.json", "utf8")); expect(c.url).toBe("http://127.0.0.1:58521");
  const client = createClient(c.url, c.anonKey, { db: { schema: "workspace" }, auth: { persistSession: false, autoRefreshToken: false } }), f = fixtures()[role];
  expect((await client.auth.signInWithPassword({ email: f.email, password: f.password })).error).toBeNull(); return client;
}
type LocalClient = Awaited<ReturnType<typeof session>>;
async function get(client: LocalClient, kind: string, id: string) { const r = await client.rpc("investor_get_document", { p_kind: kind, p_document_id: id }); expect(r.error).toBeNull(); return r.data.document as InvestorDocument; }
async function save(client: LocalClient, kind: string, data: unknown, base: InvestorDocument | null = null) {
  const r = await client.rpc("investor_save_document", { p_kind: kind, p_document_id: base?.id ?? null, p_expected_revision: base?.revision ?? 0, p_request_id: randomUUID(), p_data: data, p_confirm_research_only: true }); expect(r.error).toBeNull(); return r.data.document as InvestorDocument;
}
async function propose(client: LocalClient, kind: string, data: unknown, base: InvestorDocument | null = null) {
  const r = await client.rpc("investor_propose_document", { p_kind: kind, p_document_id: base?.id ?? null, p_expected_revision: base?.revision ?? 0, p_request_id: randomUUID(), p_data: data, p_reason: "Clarify the fictional research question.", p_evidence: "Fictional acceptance source; no investment recommendation.", p_scope: "public_research_only" }); expect(r.error).toBeNull(); return r.data;
}
async function signIn(page: Page, role = "investor") {
  const f = fixtures()[role]; await page.goto("/login?legacy=1"); await page.getByLabel("Email", { exact: true }).fill(f.email); await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/workspace$/);
}
const confirm = (page: Page) => page.getByRole("checkbox", { name: /I reviewed this exact record/ });
const saveButton = (page: Page, kind: string) => page.getByRole("button", { name: "Confirm and save " + kind, exact: true });
const title = (prefix: string) => prefix + " " + randomUUID().slice(0, 8);
async function savedId(page: Page, kind: string) { await expect(page).toHaveURL(new RegExp("/workspace/investing/" + kind + "/[a-f0-9-]{36}$")); return new URL(page.url()).pathname.split("/").at(-1)!; }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }

test.describe("Investor native client workflow", () => {
  test.setTimeout(150000);
  test.skip(process.env.INVESTOR_LOCAL_ACCEPTANCE !== "true", "Requires isolated fictional accounts.");
  test.beforeEach(async ({ baseURL }) => { expect(baseURL).toBe("http://localhost:3125"); await clearNewEditorDrafts("investor",["watchlist","thesis","filing","brief"],"investor"); });
  test.afterEach(async()=>clearNewEditorDrafts("investor",["watchlist","thesis","filing","brief"],"investor"));
  test("discloses research scope and denies unassigned access", async ({ page }) => {
    await page.goto("/oauth/consent"); await expect(page.getByText(/Investor can read assigned watchlists/)).toBeVisible(); await expect(page.getByRole("button", { name: "Allow access", exact: true })).toBeDisabled();
    await signIn(page, "reader"); await page.goto("/workspace/investing"); await expect(page.getByRole("heading", { name: "This Investor area is not included", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Watchlists", exact: true })).toHaveCount(0);
  });
  test("creates a focused watchlist, resets confirmation and retains edits through a failed save", async ({ page }, info) => {
    const client = await session(), name = title("Questions worth following");
    await signIn(page); await page.goto("/workspace/investing/watchlist/new"); await expect(saveButton(page, "watchlist")).toBeDisabled();
    await page.getByLabel("Record title *", { exact: true }).fill(name);
    await page.getByLabel("Watchlist purpose", { exact: true }).fill("Understand the fictional company's evidence before drawing a conclusion.");
    await page.getByRole("button", { name: "Add instrument", exact: true }).click();
    await page.getByLabel("Company or instrument *", { exact: true }).fill("Example Company — fictional");
    await page.getByLabel("Why watch this? *", { exact: true }).fill("Investigate a demand assumption, not a trade.");
    await page.getByLabel("Next research question", { exact: true }).fill("What would contradict the demand assumption?");
    await confirm(page).check(); await page.getByLabel("Record title *", { exact: true }).fill(name + " — reviewed"); await expect(confirm(page)).not.toBeChecked(); await confirm(page).check();
    await page.route("**/api/bundles/editor-drafts", route => route.request().method() === "POST" && route.request().postDataJSON().operation === "commit" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Synthetic save interruption." }) }) : route.continue());
    await saveButton(page, "watchlist").click(); await expect(page.getByRole("alert").filter({ hasText: "Synthetic save interruption." })).toBeVisible();
    await expect(page.getByLabel("Record title *", { exact: true })).toHaveValue(name + " — reviewed"); await page.unroute("**/api/bundles/editor-drafts"); await saveButton(page, "watchlist").click();
    const id = await savedId(page, "watchlist"); expect((await get(client, "watchlist", id)).data).toMatchObject({ entries: [expect.objectContaining({ nextQuestion: "What would contradict the demand assumption?" })] });
    await expect(page.getByRole("heading", { name: name + " — reviewed", exact: true })).toBeVisible();
    expect(await confirm(page).evaluate(el => Number.parseFloat(getComputedStyle(el.closest("label")!).fontSize))).toBeGreaterThanOrEqual(15);
    await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: "test-results/investor-watchlist-" + info.project.name + ".png", fullPage: true }); await noOverflow(page);
    await page.goto("/workspace/investing"); await expect(page.getByRole("heading", { name: "What would change your mind?", exact: true })).toBeVisible();
  });
  test("builds a thesis with linked counterevidence, a catalyst and explicit scenarios", async ({ page }, info) => {
    const client = await session(), name = title("Test the demand assumption");
    await signIn(page); await page.goto("/workspace/investing/thesis/new");
    await page.getByLabel("Record title *", { exact: true }).fill(name); await page.getByLabel("Company or instrument *", { exact: true }).fill("Example Company — fictional");
    await page.getByLabel("Research question *", { exact: true }).fill("Does the fictional evidence support the demand assumption?");
    await page.getByLabel("Working thesis *", { exact: true }).fill("Demand may persist, but the public evidence could disprove this view.");
    await page.getByLabel("Research horizon *", { exact: true }).fill("Next reporting cycle"); await page.getByLabel("Thesis confidence (%)", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Add invalidation condition", exact: true }).click();
    await page.getByLabel("Observable invalidation condition *", { exact: true }).fill("The next report contradicts the demand assumption.");
    await page.getByRole("button", { name: /^Evidence \(/ }).click(); await page.getByRole("button", { name: "Add source", exact: true }).click();
    await page.getByLabel("Source title *", { exact: true }).fill("Fictional public report"); await page.getByLabel("Publisher *", { exact: true }).fill("Example research fixture");
    await page.getByLabel("Public source URL *", { exact: true }).fill("https://example.org/fictional-report"); await page.getByLabel("Publication or filing date", { exact: true }).fill("2026-08-01");
    await page.getByRole("button", { name: "Record retrieval now", exact: true }).click(); await page.getByLabel("Brief supporting excerpt", { exact: true }).fill("The fictional source does not prove future demand.");
    await page.getByRole("button", { name: "Add evidence claim", exact: true }).click(); await page.getByLabel("Claim category", { exact: true }).selectOption("FACT");
    await page.getByLabel("Relation to the research question", { exact: true }).selectOption("challenges"); await page.getByLabel("Claim *", { exact: true }).fill("The fictional report describes only the past reporting period.");
    await page.getByRole("checkbox", { name: "Fictional public report · unverified", exact: true }).check();
    await page.getByRole("button", { name: "Catalysts", exact: true }).click(); await page.getByRole("button", { name: "Add catalyst", exact: true }).click();
    await page.getByLabel("Catalyst title *", { exact: true }).fill("Next fictional reporting cycle"); await page.getByLabel("Why this matters *", { exact: true }).fill("Revisit the demand assumption using current evidence.");
    await page.getByRole("button", { name: "Scenarios", exact: true }).click();
    for (const [index, name, percent] of [[1, "Demand holds", "10"], [2, "Demand weakens", "-10"]] as const) {
      await page.getByRole("button", { name: "Add scenario", exact: true }).click();
      const card = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Scenario " + index + " ·" }) }).last();
      await card.getByLabel("Scenario name *", { exact: true }).fill(name); await card.getByLabel("Assumptions *", { exact: true }).fill("An explicit fictional assumption for comparison.");
      await card.getByLabel("Hypothetical outcome *", { exact: true }).fill("An illustrative result, not a forecast."); await card.getByLabel("Assumed probability (%)", { exact: true }).fill("50");
      await card.getByLabel("Hypothetical return (%)", { exact: true }).fill(percent); await card.getByLabel("What would invalidate this scenario? *", { exact: true }).fill("Contradictory public evidence.");
    }
    await expect(page.getByText(/No probability-weighted result is presented/)).toBeVisible(); await page.getByLabel("Scenario coverage", { exact: true }).selectOption("exclusive_complete");
    await expect(page.getByRole("status").filter({ hasText: "Hypothetical weighted return: 0.00%." })).toBeVisible();
    await confirm(page).check(); await saveButton(page, "thesis").click(); const id = await savedId(page, "thesis"), d = await get(client, "thesis", id);
    expect(d.data).toMatchObject({ confidence: 0, claims: [expect.objectContaining({ relation: "challenges", kind: "FACT" })], catalysts: [expect.objectContaining({ dateState: "unknown" })], scenarioMode: "exclusive_complete", scenarios: expect.arrayContaining([expect.objectContaining({ probability: 50, returnPercent: -10 })]) });
    await page.getByRole("button", { name: /^Evidence \(/ }).click(); await page.getByRole("heading", { name: "Sources you can inspect", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.locator("summary").filter({ hasText: /Claim 1 · FACT · challenges · user stated/ })).toBeVisible();
    await page.getByRole("heading", { name: "Sources you can inspect", exact: true }).evaluate(el => {
      const headerHeight = innerWidth <= 900 ? document.querySelector(".workspace-header")!.getBoundingClientRect().height : 0;
      scrollTo(0, scrollY + el.getBoundingClientRect().top - headerHeight - 24);
    });
    await page.screenshot({ path: "test-results/investor-evidence-focus-" + info.project.name + ".png" }); await noOverflow(page);
    if (info.project.name === "mobile") { const header = await page.locator(".workspace-header").boundingBox(), menu = await page.getByRole("button", { name: "Open navigation", exact: true }).boundingBox(); expect(header).not.toBeNull(); expect(menu!.y + menu!.height).toBeLessThanOrEqual(header!.y + header!.height); }
  });
  test("compares a proposal, preserves its original, restores a copy and downloads only saved work", async ({ page }, info) => {
    const client = await session(), fixture = investorFixtures().thesis, name = title("A source-aware company thesis");
    const d = await save(client, "thesis", { ...fixture, title: name }); await propose(client, "thesis", { ...d.data, nextQuestion: "Verify the next public reporting period." }, d);
    await signIn(page); await page.goto("/workspace/investing/thesis/proposals");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) }).last();
    await expect(card.getByRole("heading", { name: "Current saved revision 1", exact: true })).toBeVisible(); await expect(card.getByRole("button", { name: "Approve and save proposal", exact: true })).toBeDisabled();
    await card.getByRole("checkbox", { name: /I reviewed the exact proposal/ }).check(); await card.getByRole("button", { name: "Approve and save proposal", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Approved and saved" })).toBeVisible();
    await page.goto("/workspace/investing/thesis/" + d.id); await expect(page.getByLabel("Highest-value next question", { exact: true })).toHaveValue("Verify the next public reporting period.");
    await page.getByText(/Revision 1 · .* · user/).click(); await page.getByRole("button", { name: "Review a copy of revision 1", exact: true }).click(); expect((await get(client, "thesis", d.id)).revision).toBe(2);
    await confirm(page).check(); await saveButton(page, "thesis").click(); await expect(page.getByRole("status").filter({ hasText: "Official save completed as revision 3" })).toBeVisible();
    await page.getByLabel("Highest-value next question", { exact: true }).fill("UNSAVED_SHOULD_NOT_EXPORT");
    const promise = page.waitForEvent("download"); await page.getByRole("button", { name: "Download saved record", exact: true }).click(); const downloaded = await promise, text = readFileSync((await downloaded.path())!, "utf8");
    expect(text).toContain("Saved revision 3"); expect(text).toContain("SYNTHETIC_INVESTOR_EVIDENCE_MARKER"); expect(text).toContain("not verified facts"); expect(text).not.toContain("UNSAVED_SHOULD_NOT_EXPORT");
    await page.screenshot({ path: "test-results/investor-recovery-" + info.project.name + ".png" }); await noOverflow(page);
  });
  test("retains an invalid filing draft, then saves the reporting limitations and a bounded brief", async ({ page }) => {
    const client = await session(); await signIn(page); await page.goto("/workspace/investing/filing/new");
    await page.getByLabel("Record title *", { exact: true }).fill(title("Institutional disclosure review")); await page.getByLabel("Company or instrument *", { exact: true }).fill("Example subject — fictional");
    await page.getByLabel("Filer name *", { exact: true }).fill("Example reporting manager — fictional"); await page.getByLabel("SEC form", { exact: true }).selectOption("13F-HR");
    await page.getByLabel("Filing URL *", { exact: true }).fill("https://example.org/fictional-13f"); await page.getByLabel("Filed date *", { exact: true }).fill("2026-08-14");
    await page.getByLabel("Question this filing should help answer *", { exact: true }).fill("What does this delayed snapshot actually cover?");
    await confirm(page).check(); await saveButton(page, "filing").click(); await expect(page.getByRole("alert").filter({ hasText: /13F research needs/ })).toBeVisible();
    await page.getByLabel("Reported period end", { exact: true }).fill("2026-06-30"); await page.getByLabel("Holdings, scope and reporting-lag limitations *", { exact: true }).fill("Delayed period-end snapshot, not current holdings; short positions are not reported.");
    await confirm(page).check(); await saveButton(page, "filing").click(); const id = await savedId(page, "filing"); expect((await get(client, "filing", id)).data).toMatchObject({ periodEnd: "2026-06-30", sources: [], claims: [] });
    await page.goto("/workspace/investing/brief/new"); await page.getByLabel("Record title *", { exact: true }).fill(title("A bounded fictional market brief"));
    await page.getByLabel("Market or company scope *", { exact: true }).fill("One fictional industry question."); await page.getByLabel("Research summary *", { exact: true }).fill("No conclusion yet. Source coverage needs review.");
    await confirm(page).check(); await saveButton(page, "brief").click(); expect((await get(client, "brief", await savedId(page, "brief"))).data).toMatchObject({ sources: [], claims: [] });
  });
  test("public metadata lookup is explicit and imports only an unsaved, unverified source (UI fixture)", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/investor/public-filings?**", route => { requests++; expect(new URL(route.request().url()).searchParams.get("cik")).toBe("0000000001"); return route.fulfill({ contentType: "application/json", body: JSON.stringify({
      filer: { cik: "0000000001", name: "Example SEC result — fictional", tickers: [], exchanges: [] }, fetchedAt: "2026-09-08T12:00:00Z", sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
      coverage: { scope: "recent_filer_submissions", scannedCount: 3, matchingCount: 2, returnedCount: 1, earliestDate: "2026-07-01", latestDate: "2026-08-01", hasOlderHistory: true, truncated: true },
      filings: [{ accession: "0000000001-26-000001", form: "10-Q", filedDate: "2026-08-01", reportDate: "2026-06-30", primaryDocument: "report.htm", filingUrl: "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/report.htm" }], warnings: ["Fictional UI response; not filing analysis."]
    }) }); });
    await signIn(page); await page.goto("/workspace/investing/filing/new"); expect(requests).toBe(0); await page.getByLabel("Public filer CIK", { exact: true }).fill("0000000001"); expect(requests).toBe(0);
    await page.getByRole("button", { name: "Look up public filings", exact: true }).click(); await expect(page.getByText(/Scanned 3 recent submissions/)).toBeVisible(); expect(requests).toBe(1);
    await page.getByRole("button", { name: "Use metadata in this draft", exact: true }).click(); await expect(page.getByLabel("Filer CIK (optional, 10 digits)", { exact: true })).toHaveValue("0000000001");
    await expect(page.getByText("Not saved yet", { exact: true })).toBeVisible(); await expect(saveButton(page, "filing")).toBeDisabled();
    await page.getByRole("button", { name: /^Evidence \(/ }).click(); await expect(page.locator("summary").filter({ hasText: /Source 1.*unverified/ })).toBeVisible();
    await page.locator("summary").filter({ hasText: /Source 1/ }).click(); await expect(page.getByLabel("Source limitations", { exact: true })).toHaveValue(/Only filing metadata was retrieved/); await noOverflow(page);
  });
  test("stale proposal approval is disabled and cross-client research is not exposed", async ({ page }) => {
    const client = await session(), other = await session("investorOther"), fixture = investorFixtures().thesis, name = title("Stale research proposal");
    const d = await save(client, "thesis", { ...fixture, title: name }); await propose(client, "thesis", { ...d.data, nextQuestion: "An obsolete question." }, d); await save(client, "thesis", { ...d.data, nextQuestion: "A newer saved decision." }, d);
    const foreign = await save(other, "thesis", { ...fixture, title: "PRIVATE_OTHER_BROWSER_MARKER" });
    await signIn(page); await page.goto("/workspace/investing/thesis/proposals"); const card = page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) }).last();
    await expect(card.getByText(/This record changed since the proposal/)).toBeVisible(); await expect(card.getByRole("button", { name: "Approve and save proposal", exact: true })).toBeDisabled();
    await card.getByRole("button", { name: "Reject proposal", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Proposal rejected" })).toBeVisible();
    await page.goto("/workspace/investing/thesis/" + foreign.id); await expect(page.getByRole("alert").filter({ hasText: "This research record is unavailable." })).toBeVisible(); await expect(page.getByText("PRIVATE_OTHER_BROWSER_MARKER", { exact: true })).toHaveCount(0);
  });
});
