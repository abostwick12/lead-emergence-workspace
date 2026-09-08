import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

type Fixture = { id: string; email: string; password: string; workspaceId: string; entitlementId?: string };
type Fixtures = { writer: Fixture; reader: Fixture; other: Fixture; operator: Fixture; writerResourceId: string; foreignResourceId: string; appUrl: string };
function fixtures(): Fixtures { return JSON.parse(readFileSync(".bundle-local/fixtures.json", "utf8")); }
async function signIn(page: Page, fixture: Fixture) {
  await page.goto("/login?legacy=1");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeAttached();
}
async function openWriting(page: Page) {
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Workspace navigation" }).getByRole("link", { name: "Writing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Give good work its next reader." })).toBeVisible();
}
async function operatorSession(fixture: Fixture) {
  const publicConfig = JSON.parse(readFileSync(".bundle-local/public-config.json", "utf8"));
  if (publicConfig.url !== "http://127.0.0.1:58421") throw new Error("Only the isolated P2 stack is allowed.");
  const client = createClient(publicConfig.url, publicConfig.anonKey, {
    db: { schema: "workspace" }, auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  if (error) throw error;
  return client;
}
test.describe("Writer actual local account acceptance", () => {
  test.setTimeout(90_000);
  test.skip(process.env.WRITER_LOCAL_ACCEPTANCE !== "true", "Requires the isolated P2 Supabase stack and fictional fixtures.");
  test.beforeEach(async ({ baseURL }) => {
    expect(baseURL).toBe("http://localhost:3125");
  });
  test("entitled Writer can find a resource, review evidence, and return to the library", async ({ page }, testInfo) => {
    const data = fixtures();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, data.writer);
    await expect(page.getByRole("article", { name: "Writing publication queue" })).toContainText("2 resources are waiting");
    await openWriting(page);
    await expect(page.getByRole("link", { name: /The practice of paying attention/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/writer-library-" + testInfo.project.name + ".png", fullPage: true });
    await page.getByLabel("Search resources", { exact: true }).fill("no matching fictional title");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No resources match this view" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("link", { name: /The practice of paying attention/ })).toBeVisible();
    await page.getByLabel("Search resources", { exact: true }).fill("attention");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("link", { name: /A guide to welcoming new neighbors/ })).toHaveCount(0);
    await page.getByRole("link", { name: /The practice of paying attention/ }).click();
    await expect(page).toHaveURL(new RegExp("/workspace/writing/" + data.writerResourceId + "$"), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "The practice of paying attention", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Next editorial step" })).toContainText("Name the audience");
    await expect(page.getByText("Synthetic acceptance manuscript", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Source text" })).toBeVisible();
    await page.getByRole("button", { name: "Copy review notes" }).click();
    await expect(page.getByRole("button", { name: "Review copied" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/writer-review-" + testInfo.project.name + ".png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("link", { name: "Resource library", exact: true }).click();
    await page.getByLabel("Publication status").selectOption("ready");
    await expect(page.getByRole("link", { name: /A guide to welcoming new neighbors/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /The practice of paying attention/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test("user without Writer sees no navigation, widget, or directly requested resource", async ({ page }) => {
    const data = fixtures();
    await signIn(page, data.reader);
    await expect(page.getByRole("link", { name: "Writing", exact: true })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Writing publication queue" })).toHaveCount(0);
    await page.goto("/workspace/writing/" + data.writerResourceId);
    await expect(page.getByRole("heading", { name: "Writing isn't included in your current access" })).toBeVisible();
    await expect(page.getByText("The practice of paying attention", { exact: true })).toHaveCount(0);
  });
  test("revocation clears an already-open resource and navigation without deployment", async ({ page }) => {
    const data = fixtures(), operator = await operatorSession(data.operator);
    await signIn(page, data.writer);
    await page.goto("/workspace/writing/" + data.writerResourceId);
    await expect(page.getByRole("heading", { name: "The practice of paying attention", exact: true })).toBeVisible();
    let revoked = false;
    try {
      const result = await operator.rpc("revoke_bundle_entitlement", {
        target_entitlement_id: data.writer.entitlementId, revocation_reason: "Synthetic browser lifecycle check"
      });
      expect(result.error).toBeNull(); revoked = true;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.getByRole("heading", { name: "Writing isn't included in your current access" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Writing", exact: true })).toHaveCount(0);
      await expect(page.getByText("Synthetic acceptance manuscript", { exact: true })).toHaveCount(0);
    } finally {
      if (revoked) {
        const restored = await operator.rpc("issue_bundle_assignment", {
          target_workspace_id: data.writer.workspaceId, target_bundle_key: "writer_editor",
          idempotency_key: "p2-browser-restore-" + crypto.randomUUID(), target_expires_at: null
        });
        expect(restored.error).toBeNull();
        data.writer.entitlementId = restored.data.entitlement_id;
        writeFileSync(".bundle-local/fixtures.json", JSON.stringify(data, null, 2));
      }
    }
  });
  test("temporary access-check failure hides stale content and a retry restores access", async ({ page }) => {
    const data = fixtures();
    await signIn(page, data.writer);
    await page.goto("/workspace/writing/" + data.writerResourceId);
    await expect(page.getByRole("heading", { name: "The practice of paying attention", level: 1 })).toBeVisible();
    // Deliberate failure injection checks recovery UX, not backend availability.
    await page.route("**/api/bundles/experience", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic temporary failure" }) }));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("heading", { name: "Writing is temporarily unavailable" })).toBeVisible();
    await expect(page.getByText("Synthetic acceptance manuscript", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Writing", exact: true })).toHaveCount(0);
    await page.unroute("**/api/bundles/experience");
    await page.getByRole("button", { name: "Check access again" }).click();
    await expect(page.getByRole("heading", { name: "The practice of paying attention", level: 1 })).toBeVisible();
  });
});
