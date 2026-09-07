import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/sotf/preview");
  await expect(page.getByRole("heading", { name: "A few things deserve attention." })).toBeVisible();
});

test("a confirmed criterion changes the decision and keeps the evidence visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Opportunities", exact: true }).click();
  await expect(page.locator('[data-recommendation="MAYBE"]')).toBeVisible();
  await page.getByRole("button", { name: "Direction", exact: true }).click();
  const criterion = page.locator("article").filter({ has: page.getByRole("heading", { name: "Decision ownership", exact: true }) });
  await criterion.getByRole("button", { name: "Revisit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Is this a non-negotiable?").selectOption("true");
  await dialog.getByLabel("Why confirm or change this now?").fill("I deliberately confirmed that my next role must include decision ownership.");
  await dialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Opportunities", exact: true }).click();
  await expect(page.locator('[data-recommendation="NO"]')).toBeVisible();
  await expect(page.getByText("How your context changes the answer", { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/sotf-decision-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("a conversation leaves linked evidence, follow-through, and a next touch", async ({ page }) => {
  const accountRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/sotf") || request.url().includes("supabase")) accountRequests.push(request.url()); });
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.getByRole("button", { name: "Debrief this conversation", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("What was actually said?").fill("Morgan explained how this team shares delivery decisions.");
  await dialog.getByLabel("What do you infer from it?").fill("I should test whether the arrangement would provide enough ownership.");
  await dialog.getByLabel("Questions still open", { exact: false }).fill("Which decisions would be mine?");
  await dialog.getByLabel("My next commitment").fill("Ask for a concrete decision example");
  await dialog.getByLabel("How will I know that commitment is complete?").fill("I have a scoped example to review with my coach");
  await dialog.getByLabel("Commitment due").fill("2026-09-09");
  await dialog.getByLabel("Next relationship touch").fill("2026-09-10");
  await dialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/Next touch: 2026-09-10/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thank you — Understand the work with Morgan" })).toBeVisible();
  await page.getByRole("button", { name: "Turn learning into reviewed evidence" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What does the evidence say?").fill("Morgan described a delivery decision owned by the program lead.");
  await dialog.getByLabel("Source name or reference").fill("Fictional Morgan conversation");
  await dialog.getByLabel("Where does this apply?", { exact: false }).fill("This team only");
  await dialog.getByLabel("Effect on the current question").selectOption("supporting");
  await dialog.getByLabel("How strong is this evidence?").selectOption("high");
  await dialog.getByLabel("Fit dimension", { exact: false }).selectOption("environment");
  await dialog.getByLabel("Related confirmed criterion", { exact: false }).selectOption("ownership");
  await dialog.getByLabel("Fit judgment", { exact: false }).fill("8");
  await dialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Why accept or reject this interpretation?").fill("This is accurate within the scope of my fictional meeting notes.");
  await page.getByRole("button", { name: "Accept as scoped evidence" }).click();
  await page.getByRole("button", { name: "Direction", exact: true }).click();
  await page.getByText("Evidence, assumptions, and learning", { exact: true }).first().click();
  await expect(page.getByText("Morgan described a delivery decision owned by the program lead.", { exact: true })).toBeVisible();
  expect(accountRequests).toEqual([]);
});


test("scheduling prepares reviewed times and an invitation without account access", async ({ page }) => {
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Find a time', exact: true }).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Availability source').fill('Fictional reply and my calendar, explicitly checked');
  const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  await dialog.getByLabel('Offered start').fill(date+'T09:00'); await dialog.getByLabel('Offered end').fill(date+'T12:00');
  await dialog.getByLabel('I can start').fill(date+'T08:30'); await dialog.getByLabel('I must finish').fill(date+'T12:30');
  await dialog.getByLabel('Busy from (optional)').fill(date+'T09:30'); await dialog.getByLabel('Busy until (optional)').fill(date+'T10:00');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Find useful times' }).click();
  await expect(dialog.getByRole('heading', { name: 'Review these proposed times' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save scheduling draft for review' }).click();
  await expect(page.getByRole('heading', { name: 'Times for our conversation' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare invitation draft' }).click();
  await expect(page.getByText('calendar invite · draft', { exact: true })).toBeVisible();
  await expect(page.getByText('Review the recipient, local time', { exact: false })).toBeVisible();
});
