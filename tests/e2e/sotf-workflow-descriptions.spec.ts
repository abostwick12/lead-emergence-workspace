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
const shellCss = readFileSync("app/globals.css", "utf8");

function renderShell(pathname = "/workspace", sotfPilotEnabled = true, state: Record<string, unknown> = {}, children?: ReactElement) {
  const { WorkspaceShell } = loadSource<{ WorkspaceShell: (props: { children?: ReactElement; sotfPilotEnabled: boolean }) => ReactElement }>(
    "components/workspace-shell.tsx", {
      "next/link": ({ children, ...props }: { children: React.ReactNode; href: string }) => createElement("a", props, children),
      "next/navigation": { usePathname: () => pathname, useRouter: () => ({ replace: () => {} }) },
      "@/components/workspace-provider": {
        WorkspaceProvider: ({ children }: { children: ReactElement }) => children,
        useWorkspace: () => ({
          ready: true, user: { user_metadata: { full_name: "Pilot tester" } }, workspace: { id: "synthetic-workspace" },
          accessState: { access_allowed: true }, onboarding: { state: "workspace_ready" }, plan: null,
          capabilities: {}, sotfAccess: true, error: null, signOut: async () => {}, ...state
        })
      },
      "@/components/quick-capture-dialog": { QuickCaptureDialog: () => null },
      "@/components/capability-locked-state": { CapabilityLockedState: () => createElement("p", null, "Synthetic locked Workspace") },
      "@/components/workspace-clocks": { WorkspaceClocks: () => null, WorkspaceHeaderDate: () => createElement("p", { className: "header-date" }, "Monday, November 2") }
    }
  );
  return renderToStaticMarkup(createElement(WorkspaceShell, { sotfPilotEnabled }, children ?? createElement("div", { className: "command-dashboard" },
    createElement("div", { className: "command-content" }, createElement("h1", { className: "page-title" }, "Command Center"), createElement("p", null, "Synthetic dashboard content")))));
}

async function renderLandingFixture() {
  const { default: LandingPage } = loadSource<{ default: () => Promise<ReactElement> }>("app/workspace/sotf/page.tsx", {
    "./connected-experience": { connectedSotfExperience: async () => createElement("p", null, "Synthetic authorized saved work") },
    "@/components/sotf/workflow-descriptions": { WorkflowDescriptions }
  });
  return renderShell("/workspace/sotf", true, {}, await LandingPage());
}

function fixtureDocument(content: string) {
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${shellCss}\n${css}</style>${content}`;
}

test("dashboard pilot shortcut reaches a description in two interactions without opening navigation", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  const landing = await renderLandingFixture();
  await page.route("https://workspace.synthetic.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requests.push(pathname);
    expect(["/workspace", "/workspace/sotf"]).toContain(pathname);
    await route.fulfill({ contentType: "text/html", body: fixtureDocument(pathname === "/workspace" ? renderShell() : landing) });
  });
  await page.goto("https://workspace.synthetic.test/workspace");
  const shortcut = page.getByRole("link", { name: "Explore SOTF workflows", exact: true });
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toBeInViewport();
  await expect(shortcut).toHaveAttribute("href", "/workspace/sotf");
  await expect(page.getByRole("region", { name: "SOTF pilot workflows" })).toContainText("SOTF pilot");
  expect(await shortcut.evaluate((link) => link.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "SOTF Bundle", exact: true })).not.toBeInViewport();
  }
  await page.screenshot({ path: `test-results/f02-dashboard-shortcut-${test.info().project.name}.png`, fullPage: true });
  if (isMobile) await shortcut.tap();
  else {
    await shortcut.focus();
    await page.keyboard.press("Enter");
  }
  await expect(page).toHaveURL("https://workspace.synthetic.test/workspace/sotf");
  await expect(page.getByRole("link", { name: "Explore SOTF workflows", exact: true })).toHaveCount(0);
  const card = page.getByRole("article", { name: "Transition-loop skill", exact: true });
  if (isMobile) await card.locator("summary").tap();
  else {
    await card.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(card.locator("summary")).toBeFocused();
  }
  await expect(card.getByText("Your input", { exact: true })).toBeVisible();
  expect(requests).toEqual(["/workspace", "/workspace/sotf"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/f02-dashboard-description-${test.info().project.name}.png`, fullPage: true });
});

test("dashboard shortcut preserves shell authorization, pilot and route visibility boundaries", async ({ page }) => {
  const scenarios = [
    { name: "pilot off", pilot: false },
    { name: "SOTF denied", state: { sotfAccess: false } },
    { name: "SOTF unknown", state: { sotfAccess: undefined } },
    { name: "loading", state: { ready: false } },
    { name: "signed out", state: { user: null } },
    { name: "workspace unavailable", state: { workspace: null } },
    { name: "workspace error", state: { error: "Synthetic unavailable" } },
    { name: "workspace suspended", state: { accessState: { access_allowed: false } } },
    { name: "setup unknown", state: { onboarding: null } },
    { name: "setup incomplete", state: { onboarding: { state: "started" } } },
    { name: "setup route", pathname: "/workspace/setup" },
    { name: "SOTF route", pathname: "/workspace/sotf" },
    { name: "other workspace route", pathname: "/workspace/tasks" }
  ];
  for (const scenario of scenarios) {
    await test.step(scenario.name, async () => {
      await page.setContent(fixtureDocument(renderShell(scenario.pathname, scenario.pilot ?? true, scenario.state)));
      await expect(page.getByRole("link", { name: "Explore SOTF workflows", exact: true })).toHaveCount(0);
    });
  }
});

const additionalModes = [
  ["coaching", "Prepare a coaching session", "#sotf-saved-work", "Prepare my SOTF session"],
  ["networking", "Plan a networking week", "/workspace/sotf/networking", "actual outcomes"],
  ["stories", "Find a relevant accomplishment", "#sotf-saved-work", "Find an example"],
  ["interview", "Prepare for an interview", "/sotf/connect", "select my saved opportunity"],
  ["offers", "Compare saved offers", "/sotf/connect", "compare my saved offers"],
  ["professional_work", "Prepare the next professional chapter", "/sotf/connect", "recorded actual acceptance"],
  ["scheduling", "Propose conversation times", "#sotf-saved-work", "choose People, then Find a time"],
  ["invitation", "Prepare an invitation draft", "#sotf-saved-work", "choose People"]
] as const;

test("description coverage follows the existing preparation contract without inventing released workflows", () => {
  const contract = readFileSync("lib/sotf/mcp.ts", "utf8");
  const enumMatch = contract.match(/workflow: z\.enum\((\[[^\]]+\])/);
  expect(enumMatch).not.toBeNull();
  const modes = JSON.parse(enumMatch![1]) as string[];
  const releasedOverlaps = ["opportunity", "meeting", "direction", "weekly", "daily"];
  expect([...releasedOverlaps, ...additionalModes.map(([mode]) => mode)].sort()).toEqual([...modes].sort());
  expect(bundle.workflows).toHaveLength(releasedOverlaps.length);
});

test("pilot descriptions cover the released definitions, ownership, limits, and supported links", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>${renderToStaticMarkup(createElement(WorkflowDescriptions))}`);
  const surface = page.getByRole("region", { name: "Choose the transition work you need." });
  await expect(surface).toHaveClass("experience");
  expect(await page.evaluate(() => innerWidth)).toBe(page.viewportSize()?.width);
  await expect(surface.getByRole("article")).toHaveCount(1 + bundle.workflows.length + additionalModes.length);
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
  expect(paths).toEqual(["/sotf/connect", "#sotf-saved-work", "/workspace/sotf/opportunities", "/workspace/sotf/networking", "/workspace/sotf/briefs", "/workspace/sotf/learning", ...additionalModes.map(([, , href]) => href)]);
  await expect(surface).toContainText("not separate released workflow definitions");
  for (const [mode, name, href, nextStep] of additionalModes) {
    const card = surface.getByRole("article", { name, exact: true });
    await expect(card.getByRole("link")).toHaveAttribute("href", href);
    await card.locator("summary").click();
    for (const heading of ["Your input", "Access and connections", "Output and retention", "Effects", "Limits and next step"]) {
      await expect(card.locator("dt").filter({ hasText: heading })).toBeVisible();
    }
    await expect(card).toContainText("Pilot · Preparation mode · Setup not checked");
    await expect(card).toContainText("sotf_prepare_next_move · Mode: " + mode);
    await expect(card).toContainText("no independent workflow version");
    await expect(card).toContainText("Protected Professional Context is unavailable");
    await expect(card).toContainText(nextStep);
    if (test.info().project.name === "mobile") {
      await card.screenshot({ path: `test-results/f02-mode-${mode}-mobile.png` });
    }
  }
  const scheduling = surface.getByRole("article", { name: "Propose conversation times", exact: true });
  await expect(scheduling).toContainText("does not read your calendars automatically");
  await expect(scheduling).toContainText("Save the draft for review separately retains an email draft");
  const invitation = surface.getByRole("article", { name: "Prepare an invitation draft", exact: true });
  await expect(invitation).toContainText("ChatGPT preparation is read-only");
  await expect(invitation).toContainText("separate web action saves the draft");
  await expect(invitation).toContainText("no saved debrief");
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
