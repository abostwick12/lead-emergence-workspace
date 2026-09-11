import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

type Fixture = { id: string; email: string; password: string; workspaceId: string };
type Fixtures = { operator: Fixture; reader: Fixture };

function fixtures(): Fixtures {
  return JSON.parse(readFileSync(".bundle-local/fixtures.json", "utf8")) as Fixtures;
}

function resetClientAccess() {
  const { reader } = fixtures();
  expect(reader.workspaceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(reader.email).toMatch(/^[a-z0-9.-]+@example\.invalid$/);
  const sql = `
    delete from workspace.bundle_entitlements
    where workspace_id='${reader.workspaceId}' and bundle_key='ministry';
    delete from workspace_private.bundle_invites
    where recipient_email='${reader.email}' and bundle_key='nonprofit_founder';
  `;
  execFileSync(process.platform === "win32" ? "docker.exe" : "docker", [
    "exec", "-i", "supabase_db_bundle-experience-p2", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"
  ], { input: sql });
}

async function signInAsOperator(page: Page) {
  const { operator } = fixtures();
  await page.goto("/login?legacy=1&next=%2Fworkspace%2Foperator%2Fbundles");
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/operator\/bundles$/);
}

test.describe("bundle client access console", () => {
  test.setTimeout(90_000);
  test.skip(process.env.BUNDLE_OPERATOR_LOCAL_ACCEPTANCE !== "true", "Requires the isolated synthetic bundle stack.");
  test.beforeEach(async ({ baseURL }) => {
    expect(baseURL).toBe("http://localhost:3125");
    resetClientAccess();
  });

  test("verifies a client and completes grant, removal, re-grant, invite and withdrawal", async ({ page }, info) => {
    const { reader } = fixtures();
    await signInAsOperator(page);

    await expect(page.getByRole("heading", { name: "Give each client exactly the bundles they need." })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(7);
    await expect(page.getByRole("button", { name: "Grant bundle" }).first()).toBeDisabled();

    await page.getByLabel("Workspace ID").fill(reader.workspaceId);
    await page.getByRole("button", { name: "Review client" }).click();
    const verified = page.getByLabel("Verified client workspace");
    await expect(verified.getByText("Synthetic reader", { exact: true })).toBeVisible();
    await expect(verified.getByText(reader.email, { exact: true })).toBeVisible();
    await expect(verified.getByText("Verified owner", { exact: true })).toBeVisible();

    const ministry = page.getByRole("article", { name: "Ministry access" });
    await expect(ministry.getByText("Not granted", { exact: true })).toBeVisible();
    await ministry.getByRole("button", { name: "Grant bundle" }).click();
    await expect(page.getByRole("status")).toContainText("Ministry is now active");
    await expect(ministry.getByText("Active", { exact: true })).toBeVisible();
    await expect(ministry.getByText("Direct grant", { exact: true })).toBeVisible();

    await ministry.getByText("Remove access", { exact: true }).click();
    await ministry.getByLabel("Audit reason").fill("Connected browser lifecycle acceptance.");
    await ministry.getByRole("button", { name: "Confirm removal" }).click();
    await expect(page.getByRole("status")).toContainText("Ministry access was removed");
    await expect(ministry.getByText("Removed", { exact: true })).toBeVisible();
    await expect(ministry.getByText(/Last removal: Connected browser lifecycle acceptance/)).toBeVisible();

    await ministry.getByRole("button", { name: "Grant again" }).click();
    await expect(ministry.getByText("Active", { exact: true })).toBeVisible();

    await page.locator('select[name="bundleKey"]').selectOption("nonprofit_founder");
    await page.getByLabel("Recipient email").fill(reader.email);
    await page.getByRole("button", { name: "Create invite" }).click();
    const inviteLink = page.getByRole("link", { name: /workspace\.leademergence\.com\/workspace\/bundles\/invite/ });
    await expect(inviteLink).toHaveAttribute("href", /^https:\/\/workspace\.leademergence\.com\/workspace\/bundles\/invite\?token=bi1\./);
    await page.getByRole("button", { name: "Withdraw invite" }).click();
    await expect(page.getByRole("status")).toContainText("can no longer be claimed");
    await expect(inviteLink).not.toBeVisible();

    const unauthenticated = await page.request.get("/api/operator/bundles/state");
    expect(unauthenticated.status()).toBe(401);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/bundle-client-access-${info.project.name}.png`, fullPage: true });
  });
});
