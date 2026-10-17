import { expect, test } from "@playwright/test";

test("a pending booking can only recheck its original request", async ({ page }) => {
  const chicagoParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const date = `${chicagoParts.year}-${chicagoParts.month}-${chicagoParts.day}`;
  const dayLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
  const requests: unknown[] = [];

  await page.route("**/api/meet/andrew/availability?**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "available", slots: [{
        start: `${date}T15:00:00.000Z`, end: `${date}T15:30:00.000Z`
      }] })
    });
  });
  await page.route("**/api/meet/andrew/book", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: requests.length === 1 ? 202 : 200,
      contentType: "application/json",
      body: JSON.stringify({ status: requests.length === 1 ? "pending" : "confirmed" })
    });
  });

  await page.goto("/meet/andrew");
  const fallback = page.getByRole("link", { name: "Use the current Google booking page" });
  await expect(fallback).toBeVisible();
  const day = page.getByRole("button", { name: dayLabel });
  await day.click();
  const slot = page.getByRole("list", { name: "Available times" }).getByRole("button").first();
  await slot.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Test Guest");
  await page.getByRole("textbox", { name: "Email" }).fill("guest@example.com");
  await page.getByRole("button", { name: "Book this time" }).click();

  await expect(page.getByRole("button", { name: "Check booking again" })).toBeVisible();
  await expect(day).toBeDisabled();
  await expect(slot).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Meeting type" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Name" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeDisabled();
  await expect(fallback).toHaveCount(0);

  await page.getByRole("button", { name: "Check booking again" }).click();
  await expect(page.getByText("Your meeting is booked.")).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});
