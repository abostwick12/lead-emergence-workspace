import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import bundle from "../../lib/workspace/releases/sotf-transition/bundle.json";

test.use({ video: "off" });

// Execute the actual server sources with synthetic boundary dependencies. No
// route, test identity, account request, or credential is added to the product.
const nativeRequire = createRequire(path.join(process.cwd(), "package.json"));
function loadSource<T>(filename: string, overrides: Record<string, unknown> = {}): T {
  const absolute = path.resolve(filename);
  const compiled = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  const target = { exports: {} };
  const sourceRequire = (specifier: string): unknown => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) };
    if (specifier.startsWith("@/")) {
      const resolved = path.resolve(specifier.slice(2));
      return specifier.endsWith(".json") ? nativeRequire(resolved) : loadSource(resolved + ".ts", overrides);
    }
    return nativeRequire(specifier);
  };
  new Function("require", "module", "exports", compiled)(sourceRequire, target, target.exports);
  return target.exports as T;
}

const { WorkflowDescriptions } = loadSource<{ WorkflowDescriptions: () => ReactElement }>(
  "components/sotf/workflow-descriptions.tsx",
  { "next/link": ({ children, ...props }: { children: React.ReactNode; href: string }) => createElement("a", props, children) }
);
const css = readFileSync("components/sotf/sotf.module.css", "utf8");

test("pilot descriptions cover the released definitions, ownership, limits, and supported links", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>${renderToStaticMarkup(createElement(WorkflowDescriptions))}`);
  const surface = page.getByRole("region", { name: "Choose the transition work you need." });
  await expect(surface).toHaveClass("experience");
  expect(await page.evaluate(() => innerWidth)).toBe(page.viewportSize()?.width);
  await expect(surface.getByRole("article")).toHaveCount(1 + bundle.workflows.length);
  await expect(surface).toContainText("not approved for the customer release");
  await expect(surface).toContainText("ChatGPT connection health is unknown");
  await expect(surface).toContainText("manage Gmail, Slack, Calendar");
  let cardNumber = 0;
  for (const name of ["Transition-loop skill", ...bundle.workflows.map((workflow) => workflow.name)]) {
    const card = surface.getByRole("article", { name, exact: true });
    await expect(card.getByRole("link")).toBeVisible();
    await card.locator("summary").click();
    for (const heading of ["Your input", "Access and connections", "Output and retention", "Effects", "Limits and next step"]) {
      await expect(card.locator("dt").filter({ hasText: heading })).toBeVisible();
    }
    await expect(card).toContainText("Protected Professional Context is unavailable");
    if (test.info().project.name === "mobile") {
      await card.screenshot({ path: `test-results/f02-description-${cardNumber}-mobile.png` });
    }
    cardNumber += 1;
  }
  const paths = await surface.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(paths).toEqual(["/sotf/connect", "#sotf-saved-work", "/workspace/sotf/opportunities", "/workspace/sotf/networking", "/workspace/sotf/briefs", "/workspace/sotf/learning"]);
  const brief = surface.getByRole("article", { name: "Prepare a daily transition brief", exact: true });
  await expect(brief).toContainText("does not retain a separate daily-brief artifact");
  await expect(brief).toContainText("separate hosted daily-brief contract");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(requests).toEqual([]);
  await page.screenshot({ path: `test-results/f02-descriptions-open-${test.info().project.name}.png`, fullPage: true });
});

test("native disclosures open and close by keyboard with focus retained and links reachable", async ({ page }) => {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>${renderToStaticMarkup(createElement(WorkflowDescriptions))}`);
  for (const card of await page.getByRole("article").all()) {
    const summary = card.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(card.locator("details")).toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
    await page.keyboard.press("Space");
    await expect(card.locator("details")).not.toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(card.getByRole("link")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(summary).toBeFocused();
  }
  await page.screenshot({ path: `test-results/f02-descriptions-keyboard-${test.info().project.name}.png`, fullPage: true });
});

test("narrow touch disclosures work without hover", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch behavior is exercised by the mobile project.");
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>${renderToStaticMarkup(createElement(WorkflowDescriptions))}`);
  const card = page.getByRole("article", { name: "Transition-loop skill", exact: true });
  await card.locator("summary").tap();
  await expect(card.getByText("Your input", { exact: true })).toBeVisible();
  await card.locator("summary").tap();
  await expect(card.getByText("Your input", { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("the landing page retains the existing pilot, sign-in, denied, and unknown access gates", async () => {
  const previousFlag = process.env.SOTF_PILOT_ENABLED;
  try {
    for (const scenario of ["disabled", "signed-out", "denied", "unknown", "allowed"] as const) {
      process.env.SOTF_PILOT_ENABLED = scenario === "disabled" ? "false" : "true";
      let descriptionsRendered = 0;
      const connected = loadSource<{ connectedSotfExperience: () => Promise<ReactElement> }>(
        "app/workspace/sotf/connected-experience.tsx", {
          "next/navigation": { notFound: () => { throw new Error("not-found"); }, redirect: (href: string) => { throw new Error("redirect:" + href); } },
          "@/components/sotf/sotf-experience": { SotfExperience: () => createElement("p", null, "Synthetic authorized experience") },
          "@/lib/sotf/booking": { networkingBookingConfiguration: () => ({}), networkingSchedulingHandoff: () => ({ status: "unavailable" }) },
          "@/lib/supabase/server": { createWorkspaceServerClient: async () => ({
            auth: { getUser: async () => ({ data: { user: scenario === "signed-out" ? null : { id: "synthetic-test-user" } }, error: null }) },
            rpc: async () => ({ data: scenario === "allowed", error: scenario === "unknown" ? { code: "synthetic-unavailable" } : null })
          }) }
        }
      );
      const { default: LandingPage } = loadSource<{ default: () => Promise<ReactElement> }>("app/workspace/sotf/page.tsx", {
        "./connected-experience": connected,
        "@/components/sotf/workflow-descriptions": { WorkflowDescriptions: () => { descriptionsRendered += 1; return createElement(WorkflowDescriptions); } }
      });
      if (scenario === "allowed") {
        const html = renderToStaticMarkup(await LandingPage());
        expect(html).toContain("Choose the transition work you need.");
        expect(html).toContain('id="sotf-saved-work" tabindex="-1"');
        expect(descriptionsRendered).toBe(1);
      } else {
        await expect(LandingPage()).rejects.toThrow(scenario === "signed-out" ? "redirect:/login" : "not-found");
        expect(descriptionsRendered).toBe(0);
      }
    }
  } finally {
    if (previousFlag === undefined) delete process.env.SOTF_PILOT_ENABLED;
    else process.env.SOTF_PILOT_ENABLED = previousFlag;
  }
});
