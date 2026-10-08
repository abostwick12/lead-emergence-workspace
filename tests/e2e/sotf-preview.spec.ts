import { expect, test } from "@playwright/test";

let accountRequests: string[] = [];
let browserErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  accountRequests = [];
  browserErrors = [];
  page.on("request", (request) => { if (/\/api\/sotf|supabase\.co/.test(request.url())) accountRequests.push(request.url()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/sotf/preview");
  await expect(page.getByRole("heading", { name: "For today" })).toBeVisible();
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
  await expect(page.getByText("How your criteria affect the answer", { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/sotf-decision-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("networking strategy shows the 10-person goal and selectable conversation prep", async ({ page }) => {
  await page.getByRole("button", { name: "Networking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan 10 people to engage this week." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Networking Assistant", exact: true })).toBeVisible();
  for (const name of ["Action queue", "Waiting for a response", "Conversation prep", "Scheduling", "Contact history"]) await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Weekly plan progress" })).toHaveAttribute("max", "10");
  await expect(page.getByRole("progressbar", { name: "Weekly plan progress" })).toHaveAttribute("value", "10");
  await expect(page.getByText("25 / 10", { exact: true })).toBeVisible();
  await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Mature conversion", exact: true }).getByText("20%", { exact: true })).toBeVisible();
  const morgan = page.locator("article").filter({ has: page.getByRole("heading", { name: "Morgan — fictional contact", exact: true }) });
  await morgan.getByText("Research and rationale", { exact: true }).click();
  await expect(morgan.getByText("Why this person?", { exact: true })).toBeVisible();
  await expect(morgan.getByText("LAMP — List", { exact: true })).toBeVisible();
  await expect(morgan.getByText("Contribution angle", { exact: true })).toBeVisible();
  const candidate = page.locator("article").filter({ has: page.getByRole("heading", { name: "Fictional candidate 6", exact: true }) });
  await candidate.getByRole("button", { name: "Prepare conversation", exact: true }).click();
  const prep = page.getByRole("region", { name: "Conversation prep", exact: true });
  await expect(prep.getByRole("heading", { name: "Conversation prep · Fictional candidate 6" })).toBeVisible();
  await expect(prep.getByRole("heading", { name: "Questions to ask" })).toBeVisible();
  await expect(prep.getByText("Fictional organization 6 describes cross-team program delivery in its public role overview.")).toBeVisible();
  await expect(prep.getByRole("link", { name: "Fictional role overview" })).toHaveAttribute("href", "https://example.com/networking/candidate-6");
  await expect(prep.locator("ol li")).toHaveCount(3);
  await expect(prep.locator("ol li").first()).toHaveText("What does a typical week in your work at Fictional organization 6 look like?");
  await expect(prep.locator("ol li").nth(1)).toContainText("veteran-friendly operations");
  await page.screenshot({ path: `test-results/sotf-networking-prep-${test.info().project.name}.png`, fullPage: false });
  await morgan.getByRole("button", { name: "Progress to conversation", exact: true }).click();
  const meetingDialog = page.getByRole("dialog");
  const followUpStart = new Date(Date.now() + 30 * 86400000);
  const followUpEnd = new Date(followUpStart.valueOf() + 3600000);
  await meetingDialog.getByLabel("Conversation", { exact: true }).fill("Follow-up with Morgan");
  await meetingDialog.getByLabel("Starts at (your local time)").fill(followUpStart.toISOString().slice(0, 16));
  await meetingDialog.getByLabel("Ends at (your local time)").fill(followUpEnd.toISOString().slice(0, 16));
  await meetingDialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(meetingDialog).not.toBeVisible();
  await morgan.getByRole("button", { name: "Prepare conversation", exact: true }).click();
  const morganBriefs = prep.locator(":scope > details");
  await expect(morganBriefs).toHaveCount(2);
  await expect(morganBriefs.first()).toContainText("Conversation prep · Follow-up with Morgan");
  await expect(morganBriefs.last()).toContainText("Conversation prep · Understand the work with Morgan");
  await expect(page.getByText(/both recommendations come from recorded responses/i)).toBeVisible();
  const history = page.getByRole("region", { name: "Contact history", exact: true });
  await expect(history.getByText("25 people", { exact: true })).toBeVisible();
  for (const heading of ["Why they matter", "Last touch", "Status", "Outcome", "Context / notes"]) await expect(history.getByRole("columnheader", { name: heading })).toBeVisible();
  await expect(history.getByRole("row")).toHaveCount(26);
  await expect(history.getByRole("row", { name: /Fictional candidate 25/ }).getByText("No touch recorded", { exact: true })).toBeVisible();
  await page.getByText("Networking drafts and verified actions", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Thoughtful public comment", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Follow up after public conversation", exact: true }).first()).toBeVisible();
  await page.getByRole("heading", { name: "Networking Assistant", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/sotf-networking-dashboard-${test.info().project.name}.png`, fullPage: false });
  await page.screenshot({ path: `test-results/sotf-networking-${test.info().project.name}.png`, fullPage: true });
  expect(accountRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("networking view supports the full manual action lifecycle", async ({ page }) => {
  await page.getByRole("button", { name: "Networking", exact: true }).click();
  const candidate = page.locator("article").filter({ has: page.getByRole("heading", { name: "Fictional candidate 6", exact: true }) });
  await candidate.getByRole("button", { name: "Prepare outreach", exact: true }).click();

  const reviewQueue = page.locator("section").filter({ has: page.getByRole("heading", { name: "Follow-through to review", exact: true }) });
  const action = reviewQueue.locator("article").filter({ hasText: "To: Fictional candidate 6" });
  await action.getByRole("button", { name: "Review exact draft", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Recipient")).toHaveValue("Fictional candidate 6");
  await dialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await action.getByRole("button", { name: "Approve this exact draft for manual use", exact: true }).click();
  await action.getByRole("button", { name: "Record a verified result", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What did you verify?").fill("Synthetic user verified the manual outreach outside Workspace.");
  await dialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByText("Networking drafts and verified actions", { exact: true }).click();
  const verified = page.locator("details").filter({ hasText: "Networking drafts and verified actions" }).locator("article").filter({ hasText: "Fictional candidate 6" });
  await expect(verified.getByText("direct message · manually completed", { exact: true })).toBeVisible();
  await expect(verified.getByText("Synthetic user verified the manual outreach outside Workspace.", { exact: true })).toBeVisible();
  await expect(candidate.getByText("attempted", { exact: true })).toBeVisible();
  await candidate.getByText("Research and rationale", { exact: true }).click();
  await expect(candidate.getByText("direct outreach", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Waiting for a response", exact: true }).getByText("Fictional candidate 6", { exact: true })).toBeVisible();
});

test("networking scheduling uses the branded page only after a positive response", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.getByRole("button", { name: "Networking", exact: true }).click();
  const coldCandidate = page.locator("article").filter({ has: page.getByRole("heading", { name: "Fictional candidate 6", exact: true }) });
  await expect(coldCandidate.getByRole("button", { name: "Prepare scheduling reply", exact: true })).toHaveCount(0);

  const repliedCandidate = page.locator("article").filter({ has: page.getByRole("heading", { name: "Fictional candidate 2", exact: true }) });
  const schedulingButton = repliedCandidate.getByRole("button", { name: "Prepare scheduling reply", exact: true });
  await expect(schedulingButton).toBeEnabled();
  await schedulingButton.click();
  const reviewQueue = page.getByRole("heading", { name: "Follow-through to review", exact: true }).locator("..");
  const schedulingDraft = reviewQueue.locator("article").filter({ has: page.getByRole("heading", { name: "Find a time for our conversation", exact: true }) });
  await expect(schedulingDraft).toContainText("/meet/andrew");
  await expect(schedulingDraft).not.toContainText("calendar.app.google");
  await expect(schedulingDraft).not.toContainText("calendar.google.com");
  await expect(schedulingDraft.getByText("direct message · draft", { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("public Lead Emergence scheduling page hands booking to Google without sign-in", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto("/meet/andrew");
  await expect(page).toHaveURL(/\/meet\/andrew$/);
  await expect(page.getByRole("heading", { name: "Conversation with Andrew Bostwick", exact: true })).toBeVisible();
  await expect(page.getByText(/Google will show available times in your local timezone/i)).toBeVisible();
  const handoff = page.getByRole("link", { name: /View available times in Google Calendar/i });
  await expect(handoff).toBeVisible();
  await expect(handoff).toHaveAttribute("href", "https://calendar.app.google/syntheticE2EBookingPage");
  await expect(handoff).toHaveAttribute("target", "_blank");
  await page.screenshot({ path: `test-results/sotf-scheduling-handoff-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(browserErrors).toEqual([]);
});

test("a candidate source note stays pending until reviewed, then appears in conversation prep", async ({ page }) => {
  await page.getByRole("button", { name: "Networking", exact: true }).click();
  const candidate = page.locator("article").filter({ has: page.getByRole("heading", { name: "Fictional candidate 7", exact: true }) });
  await candidate.getByRole("button", { name: "Prepare conversation", exact: true }).click();
  const prep = page.getByRole("region", { name: "Conversation prep", exact: true });
  await expect(prep.getByText("No reviewed person-specific source notes yet.", { exact: false })).toBeVisible();
  await prep.getByRole("button", { name: "Add source note for review" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("What does the evidence say?").fill("Fictional candidate 7 described a specific program delivery responsibility.");
  await dialog.getByLabel("Source type").selectOption("fellow_report");
  await dialog.getByLabel("Source name or reference").fill("Fictional candidate 7 briefing");
  await dialog.getByLabel("Source URL").fill("https://example.com/networking/candidate-7");
  await dialog.getByLabel("Where does this apply?", { exact: false }).fill("Fictional candidate 7 only");
  await dialog.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(prep.getByText("No reviewed person-specific source notes yet.", { exact: false })).toBeVisible();
  const review = page.locator("article").filter({ has: page.getByRole("heading", { name: "Fictional candidate 7 described a specific program delivery responsibility." }) });
  await review.getByLabel("Why accept or reject this interpretation?").fill("This fictional briefing supports only the stated person-specific claim.");
  await review.getByRole("button", { name: "Accept as scoped evidence" }).click();
  await expect(prep.getByText("Fictional candidate 7 described a specific program delivery responsibility.")).toBeVisible();
  await expect(prep.getByRole("link", { name: "Fictional candidate 7 briefing" })).toHaveAttribute("href", "https://example.com/networking/candidate-7");
  expect(accountRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
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
  await page.locator("article").filter({ has: page.getByRole("heading", { name: "Understand the work with Morgan", exact: true }) }).getByRole("button", { name: "Turn learning into reviewed evidence" }).click();
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
  await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Morgan — fictional contact', exact: true }) }).getByRole('button', { name: 'Find a time', exact: true }).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Availability source').fill('Fictional reply and my calendar, explicitly checked');
  const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  await dialog.getByLabel('Offered start').fill(date+'T09:00'); await dialog.getByLabel('Offered end').fill(date+'T12:00');
  await dialog.getByLabel('I can start').fill(date+'T08:30'); await dialog.getByLabel('I must finish').fill(date+'T12:30');
  await dialog.getByLabel('Busy from (optional)').fill(date+'T09:30'); await dialog.getByLabel('Busy until (optional)').fill(date+'T10:00');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Find times that work' }).click();
  await expect(dialog.getByRole('heading', { name: 'Review these proposed times' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save the draft for review' }).click();
  await expect(page.getByRole('heading', { name: 'Times for our conversation' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare invitation draft' }).click();
  await expect(page.getByText('calendar invite · draft', { exact: true })).toBeVisible();
  await expect(page.getByText('Review the recipient, local time', { exact: false })).toBeVisible();
});
