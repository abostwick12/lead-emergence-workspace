import { expect, type Page, test } from "@playwright/test";

const password = process.env.E2E_WORKSPACE_PASSWORD;
const newUser = process.env.E2E_NEW_USER_EMAIL;
const mobileUser = process.env.E2E_MOBILE_USER_EMAIL;
const returningUser = process.env.E2E_RETURNING_USER_EMAIL;
const suspendedUser = process.env.E2E_SUSPENDED_USER_EMAIL;

function relativeLuminance(rgb: string) {
  const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  if (channels.length !== 3) throw new Error(`Expected an RGB color, received ${rgb}`);
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function monitorRuntime(page: Page) {
  const pageErrors: string[] = [];
  const criticalResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) criticalResponses.push(`${response.status()} ${response.url()}`);
  });
  return () => {
    expect(pageErrors, "critical browser errors").toEqual([]);
    expect(criticalResponses, "critical network responses").toEqual([]);
  };
}

async function rollbackSignIn(page: Page, email: string) {
  await page.goto("/login?legacy=1");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("public login keeps Lead Emergence primary and rollback available", async ({ page }) => {
  const assertRuntime = monitorRuntime(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Lead Emergence Workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue with Lead Emergence/ })).toBeVisible();
  await page.getByRole("button", { name: /Use rollback sign-in/ }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy and access details" })).toBeVisible();
  await page.getByLabel("Email").focus();
  await expect(page.getByLabel("Email")).toBeFocused();
  assertRuntime();
});

test("public login meets the keyboard, touch, alert, and contrast baseline", async ({ page }) => {
  const assertRuntime = monitorRuntime(page);
  await page.goto("/login?error=entry_unavailable");
  const primary = page.getByRole("link", { name: /Continue with Lead Emergence/ });
  const rollback = page.getByRole("button", { name: /Use rollback sign-in/ });

  await page.keyboard.press("Tab");
  await expect(primary).toBeFocused();
  await expect(page.locator(".auth-card .error[role='alert']")).toContainText("temporarily unavailable");

  for (const control of [primary, rollback]) {
    const box = await control.boundingBox();
    expect(box, "visible interactive control has a box").not.toBeNull();
    expect(box!.height, "touch target height").toBeGreaterThanOrEqual(44);
    expect(box!.width, "touch target width").toBeGreaterThanOrEqual(44);
  }

  const primaryColors = await primary.evaluate((element) => {
    const style = getComputedStyle(element);
    return { foreground: style.color, background: style.backgroundColor };
  });
  expect(contrastRatio(primaryColors.foreground, primaryColors.background)).toBeGreaterThanOrEqual(4.5);

  const supportColors = await page.locator(".auth-support-copy").evaluate((element) => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(element.closest(".auth-card")!).backgroundColor,
  }));
  expect(contrastRatio(supportColors.foreground, supportColors.background)).toBeGreaterThanOrEqual(4.5);
  assertRuntime();
});

test.describe("authenticated product lifecycle", () => {
  test.skip(!password || !newUser || !mobileUser || !returningUser, "Synthetic local acceptance accounts are required.");

  test("AI failure fallback, native resume, switching, first value, and returning state", async ({ page }, testInfo) => {
    const assertRuntime = monitorRuntime(page);
    await rollbackSignIn(page, testInfo.project.name === "mobile" ? mobileUser! : newUser!);
    await expect(page).toHaveURL(/\/workspace\/setup/);
    await expect(page.getByRole("heading", { name: "Set up your Workspace" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect ChatGPT" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Claude" })).toBeVisible();
    await expect(page.getByText("AI setup is recommended, never required.")).toBeVisible();

    await page.getByRole("button", { name: "Connect ChatGPT" }).click();
    await expect(page.getByRole("heading", { name: "Continue with ChatGPT" })).toBeVisible();
    await expect(page.getByText("Workspace remains the system of record.")).toBeVisible();
    await page.getByRole("button", { name: /Continue setup without AI/ }).click();

    await expect(page.getByRole("heading", { name: "Your leadership reality" })).toBeVisible();
    await page.getByLabel("Responsibilities").fill("Lead a product team through a meaningful transition.");
    await page.getByLabel("Areas of attention").fill("Alignment, decision quality, and sustainable pace.");
    await page.getByRole("button", { name: /Save and continue/ }).click();
    await expect(page.getByRole("heading", { name: "Commitments and value" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Commitments and value" })).toBeVisible();
    await page.getByLabel("Starting priorities").fill("Clarify the next decision and who needs to participate.");
    await page.getByRole("button", { name: /Save and continue/ }).click();
    await expect(page.getByRole("heading", { name: "How Workspace should help" })).toBeVisible();
    await page.getByRole("button", { name: "Connect an AI assistant" }).click();
    await expect(page.getByRole("heading", { name: "Continue with ChatGPT" })).toBeVisible();
    await page.getByRole("button", { name: /Continue setup without AI/ }).click();
    await expect(page.getByRole("heading", { name: "How Workspace should help" })).toBeVisible();
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByLabel("Starting priorities")).toHaveValue("Clarify the next decision and who needs to participate.");
    await page.getByRole("button", { name: /Save and continue/ }).click();

    await page.getByLabel("Assistant posture").fill("Assistive: surface patterns and ask before treating an interpretation as true.");
    await page.getByRole("button", { name: /Save and continue/ }).click();
    await expect(page.getByRole("heading", { name: "Your starting system" })).toBeVisible();
    await page.getByRole("button", { name: /Begin using Workspace/ }).click();

    await expect(page).toHaveURL(/\/workspace(?:\?welcome=1)?$/);
    await expect(page.getByText("Leadership focus")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clarify the next decision and who needs to participate." })).toBeVisible();

    await page.goto("/workspace/settings#plan");
    await expect(page.getByText("Current plan")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Personal", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Included" })).toBeVisible();
    await expect(page.getByText("Available with an upgraded plan.").first()).toBeVisible();
    await expect(page.getByText("Billing is not active.")).toBeVisible();
    assertRuntime();
  });

  test("returning user bypasses onboarding and no-connection states remain useful", async ({ page }) => {
    const assertRuntime = monitorRuntime(page);
    await rollbackSignIn(page, returningUser!);
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole("heading", { name: "Clarify this quarter's focus" })).toBeVisible();
    await page.goto("/workspace/integrations");
    await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
    await expect(page.getByText("Nothing is connected automatically.")).toBeVisible();
    await expect(page.getByText("Not connected").first()).toBeVisible();
    await page.goto("/workspace/memory");
    await expect(page.getByText("Memory is empty until you choose what should carry forward.")).toBeVisible();

    if (test.info().project.name === "mobile") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeVisible();
      await page.getByRole("complementary").getByRole("button", { name: "Close navigation" }).click();
    }
    assertRuntime();
  });

  test("suspended plan keeps retained data behind clear locked states", async ({ page }) => {
    test.skip(!suspendedUser, "A synthetic suspended-plan account is required.");
    const assertRuntime = monitorRuntime(page);
    await rollbackSignIn(page, suspendedUser!);
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole("heading", { name: "Personal Workspace" })).toBeVisible();
    await expect(page.getByText("Capability use is suspended")).toBeVisible();

    await page.goto("/workspace/tasks");
    await expect(page.getByRole("heading", { name: "Daily Focus" })).toBeVisible();
    await expect(page.getByText("Your existing data is retained while use is suspended.")).toBeVisible();

    await page.goto("/workspace/settings#plan");
    await expect(page.getByText("Capability use is currently suspended. Your data is retained.")).toBeVisible();
    await expect(page.getByLabel("Responsibilities")).toHaveAttribute("readonly", "");
    assertRuntime();
  });
});
