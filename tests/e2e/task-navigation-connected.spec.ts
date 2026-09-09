import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { executiveFixtures } from "../../scripts/executive-fixtures.mjs";
import { investorFixtures } from "../../scripts/investor-fixtures.mjs";
import { emptyNonprofitData, newFounderAction, nonprofitSchemas } from "../../lib/nonprofit-bundle/contracts";
import { executiveSchemas } from "../../lib/executive-bundle/contracts";
import { investorSchemas } from "../../lib/investor-bundle/contracts";
import { sourceRoute } from "../../lib/executive-bundle/presentation";
import { taskTargetId, type TaskTargetKind } from "../../lib/bundles/task-target";

type Domain = "executive" | "nonprofit" | "investor";
type RecordData = Record<string, unknown>;
type Saved = { id: string; revision: number; data: RecordData };
function fixtures() { return JSON.parse(readFileSync(".bundle-local/fixtures.json", "utf8")); }
async function session() {
  const c = JSON.parse(readFileSync(".bundle-local/public-config.json", "utf8"));
  expect(c.url).toBe("http://127.0.0.1:58421");
  const f = fixtures().executiveDual;
  expect(f.email).toMatch(/@example\.invalid$/);
  const client = createClient(c.url, c.anonKey, { db: { schema: "workspace" }, auth: { persistSession: false, autoRefreshToken: false } });
  expect((await client.auth.signInWithPassword({ email: f.email, password: f.password })).error).toBeNull();
  return client;
}
async function signIn(page: Page, role = "executiveDual") {
  const f = fixtures()[role]; expect(f.email).toMatch(/@example\.invalid$/);
  await page.goto("/login?legacy=1");
  await page.getByLabel("Email", { exact: true }).fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
}
async function save(client: Awaited<ReturnType<typeof session>>, domain: Domain, kind: string, data: RecordData, base?: Saved) {
  const schemas: Record<string, { parse(value: unknown): unknown }> = domain === "executive" ? executiveSchemas : domain === "nonprofit" ? nonprofitSchemas : investorSchemas;
  schemas[kind].parse(data);
  const confirmation = domain === "executive" ? "p_confirm_exact_record" : domain === "nonprofit" ? "p_confirm_administrative" : "p_confirm_research_only";
  const result = await client.rpc(domain + "_save_document", { p_kind: kind, p_document_id: base?.id ?? null, p_expected_revision: base?.revision ?? 0, p_request_id: randomUUID(), p_data: data, [confirmation]: true });
  expect(result.error).toBeNull(); return result.data.document as Saved;
}
function dataFor(domain: Domain, kind: string, ids: string[]): RecordData {
  const actions = ids.map((id, i) => ({ id, title: "Fictional task " + (i + 1), owner: "Fictional coordinator", dueDate: null, state: "open", nextAction: "Review this exact fictional task.", evidence: "", reviewState: "user_stated" }));
  if (domain === "executive") return { ...executiveFixtures()[kind as "meeting" | "daily_brief" | "weekly_review"], actions };
  if (domain === "nonprofit") {
    const rows = ids.map((id, i) => ({ ...newFounderAction(id), title: "Fictional next move " + (i + 1), nextAction: "Review this exact fictional next move." }));
    if (kind === "plan") return { ...emptyNonprofitData.plan, title: "Fictional task navigation roadmap", milestones: rows.map(r => ({ ...r, category: "other", dependsOn: [] })) };
    if (kind === "meeting") return { ...emptyNonprofitData.meeting, title: "Fictional task navigation meeting", actions: rows };
    return { ...emptyNonprofitData.partner, title: "Fictional task navigation partner", nextAction: "Review this exact fictional follow-up." };
  }
  const data = investorFixtures()[kind as "watchlist" | "thesis" | "filing" | "brief"];
  if ("entries" in data) return { ...data, entries: ids.map((id, i) => ({ ...data.entries[0], id, instrument: { ...data.entries[0].instrument, name: "Fictional company " + (i + 1) } })) };
  return { ...data, catalysts: ids.map((id, i) => ({ ...data.catalysts[0], id, title: "Fictional catalyst " + (i + 1) })) };
}
const cases: [Domain, string, string, TaskTargetKind][] = [
  ["executive", "meeting", "executive.coordination", "action"],
  ["executive", "daily_brief", "executive.brief", "action"],
  ["executive", "weekly_review", "executive.review", "action"],
  ["nonprofit", "plan", "nonprofit.roadmap", "milestone"],
  ["nonprofit", "meeting", "nonprofit.meetings", "action"],
  ["nonprofit", "partner", "nonprofit.partners", "followup"],
  ["investor", "watchlist", "investor.company_research", "watch_item"],
  ["investor", "thesis", "investor.thesis", "catalyst"],
  ["investor", "filing", "investor.filings", "catalyst"],
  ["investor", "brief", "investor.company_research", "catalyst"]
];
test.describe("Exact task navigation in authorized native editors", () => {
  test.setTimeout(90000);
  test.skip(process.env.EXECUTIVE_LOCAL_ACCEPTANCE !== "true", "Requires isolated fictional accounts.");
  test.beforeEach(async ({ baseURL }) => expect(baseURL).toBe("http://localhost:3125"));
  test("follows an actual saved source link to the exact action", async ({ page }) => {
    const client = await session(), ids = [randomUUID(), randomUUID()];
    const meeting = await save(client, "executive", "meeting", dataFor("executive", "meeting", ids));
    const review = await save(client, "executive", "weekly_review", {
      ...executiveFixtures().weekly_review,
      references: [{ capabilityId: "executive.coordination", kind: "meeting", documentId: meeting.id, revision: 1, item: { kind: "action", id: ids[1] } }]
    });
    await signIn(page); await page.goto("/workspace/executive/weekly_review/" + review.id);
    const link = page.getByRole("link", { name: "Open source workspace", exact: true });
    await expect(link).toHaveAttribute("href", "/workspace/executive/meeting/" + meeting.id + "#" + taskTargetId("action", ids[1]));
    await link.click();
    await expect(page.locator('[id="' + taskTargetId("action", ids[1]) + '"] summary')).toBeFocused();
    await expect(page.getByLabel("Next action step", { exact: true })).toHaveValue("Review this exact fictional task.");
  });
  test("handles hash changes, reloads, missing tasks and malformed links without saving", async ({ page }) => {
    const client = await session(), ids = [randomUUID(), randomUUID()];
    const d = await save(client, "executive", "meeting", dataFor("executive", "meeting", ids));
    const url = "/workspace/executive/meeting/" + d.id;
    await signIn(page); await page.goto(url + "#" + taskTargetId("action", ids[0]));
    await expect(page.locator('[id="' + taskTargetId("action", ids[0]) + '"] summary')).toBeFocused();
    await page.evaluate(hash => { location.hash = hash; }, taskTargetId("action", ids[1]));
    await expect(page.locator('[id="' + taskTargetId("action", ids[1]) + '"] summary')).toBeFocused();
    await page.reload();
    await expect(page.locator('[id="' + taskTargetId("action", ids[1]) + '"] summary')).toBeFocused();
    await page.evaluate(hash => { location.hash = hash; }, taskTargetId("action", randomUUID()));
    const missing = page.getByRole("status").filter({ hasText: "The linked task is not in this on-screen record." });
    await expect(missing).toBeVisible(); await expect(missing).toBeFocused();
    await page.evaluate(() => { location.hash = "task-action-invalid"; });
    await expect(page.getByRole("status").filter({ hasText: "This task link is not valid." })).toBeFocused();
    expect((await client.rpc("executive_get_document", { p_kind: "meeting", p_document_id: d.id })).data.document.revision).toBe(1);
  });
  test("does not select an old-revision task or leak a denied record through its fragment", async ({ page }) => {
    const client = await session(), ids = [randomUUID(), randomUUID()];
    const data = dataFor("executive", "meeting", ids);
    const d = await save(client, "executive", "meeting", data);
    await save(client, "executive", "meeting", { ...data, actions: (data.actions as { id: string }[]).filter(a => a.id !== ids[1]) }, d);
    const url = "/workspace/executive/meeting/" + d.id + "#" + taskTargetId("action", ids[1]);
    await signIn(page); await page.goto(url);
    await expect(page.getByRole("status").filter({ hasText: "The linked task is not in this on-screen record." })).toBeVisible();
    await expect(page.locator('[id="' + taskTargetId("action", ids[1]) + '"]')).toHaveCount(0);
    await expect(page.locator('[id="' + taskTargetId("action", ids[0]) + '"]')).not.toHaveAttribute("open", "");
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await signIn(page, "reader"); await page.goto(url);
    await expect(page.getByRole("heading", { name: "This Executive area is not included", exact: true })).toBeVisible();
    await expect(page.getByText("Fictional task 1", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "linked task" })).toHaveCount(0);
  });
  test("opens a linked catalyst across tab changes and repeated links without saving", async ({ page }, info) => {
    const client = await session(), ids = [randomUUID(), randomUUID()];
    const data = dataFor("investor", "thesis", ids);
    const saved = await save(client, "investor", "thesis", data);
    const target = (id: string) => page.locator('[id="' + taskTargetId("catalyst", id) + '"]');
    await signIn(page);
    await page.goto("/workspace/investing/thesis/" + saved.id + "#" + taskTargetId("catalyst", ids[0]));
    await expect(target(ids[0]).locator(":scope > summary")).toBeFocused();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByLabel("Research question *", { exact: true }).fill("Unsaved question kept through task navigation");
    await expect(target(ids[0])).toHaveCount(0);
    await page.evaluate(hash => { location.hash = hash; }, taskTargetId("catalyst", ids[1]));
    await expect(target(ids[1]).locator(":scope > summary")).toBeFocused();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    // A presentation-only fixture link exercises an ordinary same-page anchor click.
    // It does not replace an API, change saved data or grant record access.
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = location.href; link.textContent = "Reopen this fictional task";
      document.body.append(link);
    });
    await page.getByRole("link", { name: "Reopen this fictional task", exact: true }).click();
    await expect(target(ids[1]).locator(":scope > summary")).toBeFocused();
    await target(ids[1]).screenshot({path:"test-results/task-navigation-investor-catalyst-" + info.project.name + ".png"});
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page.getByLabel("Research question *", { exact: true })).toHaveValue("Unsaved question kept through task navigation");
    await page.evaluate(hash => { location.hash = hash; }, taskTargetId("catalyst", randomUUID()));
    await expect(page.getByRole("status").filter({hasText:"The linked task is not in this on-screen record."})).toBeFocused();
    await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute("aria-pressed", "true");
    const current = await client.rpc("investor_get_document", {p_kind:"thesis", p_document_id:saved.id});
    expect(current.error).toBeNull(); expect(current.data.document.revision).toBe(1);
    expect(current.data.document.data).toEqual(data);
  });
  for (const [domain, kind, capabilityId, itemKind] of cases) {
    test("opens and focuses only " + domain + "/" + kind + "/" + itemKind, async ({ page }, info) => {
      const client = await session(), ids = [randomUUID(), randomUUID()];
      const d = await save(client, domain, kind, dataFor(domain, kind, ids));
      const target = taskTargetId(itemKind, itemKind === "followup" ? d.id : ids[1]);
      const url = sourceRoute({ capabilityId, kind, documentId: d.id, revision: 1, item: { kind: itemKind, id: itemKind === "followup" ? d.id : ids[1] } })!;
      await signIn(page); await page.goto(url);
      const selected = page.locator('[id="' + target + '"]');
      await expect(selected).toBeVisible();
      if (itemKind === "followup") {
        await expect(selected).toBeFocused();
        await expect(selected.getByLabel("Next follow-up action", { exact: true })).toBeVisible();
      } else {
        await expect(selected).toHaveAttribute("open", "");
        await expect(selected.locator(":scope > summary")).toBeFocused();
        await expect(page.locator('[id="' + taskTargetId(itemKind, ids[0]) + '"]')).not.toHaveAttribute("open", "");
      }
      expect((await selected.boundingBox())!.y).toBeGreaterThanOrEqual(0);
      expect((await selected.boundingBox())!.y).toBeLessThan(300);
      const header = page.locator(".workspace-header");
      if (await header.evaluate(el => getComputedStyle(el).position === "sticky")) {
        const headerBox = (await header.boundingBox())!;
        expect((await selected.boundingBox())!.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height + 8);
      }
      await expect(page.getByRole("checkbox", { name: /I reviewed this exact record/ })).not.toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (["meeting", "plan", "watchlist"].includes(kind)) await page.screenshot({ path: "test-results/task-navigation-" + domain + "-" + kind + "-" + info.project.name + ".png" });
      const current = await client.rpc(domain + "_get_document", { p_kind: kind, p_document_id: d.id });
      expect(current.error).toBeNull(); expect(current.data.document.revision).toBe(1);
      expect(current.data.document.data).toEqual(d.data);
    });
  }
});
