import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

test.use({ video: "off" });

// Execute the actual interactive shell/dialog and CSS without a product test
// route, credentials, or hosted requests. Only account/service boundaries are
// synthetic; React, icons, capability checks, keyboard handlers and modal are real.
const nativeRequire = createRequire(path.join(process.cwd(), "package.json"));
function packageFile(name: string, relative: string) {
  return readFileSync(path.join(path.dirname(nativeRequire.resolve(`${name}/package.json`)), relative), "utf8");
}
const sources = Object.fromEntries([
  ["@/components/workspace-shell", "components/workspace-shell.tsx"],
  ["@/components/quick-capture-dialog", "components/quick-capture-dialog.tsx"],
  ["@/lib/workspace/return-path", "lib/workspace/return-path.ts"],
  ["@/lib/workspace/capabilities", "lib/workspace/capabilities.ts"]
].map(([name, filename]) => [name, ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText]));

async function renderWorkspace(page: Page) {
  page.on("pageerror", (error) => { throw error; });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/*", (route) => route.abort());
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync("app/globals.css", "utf8")}</style><div id="fixture"></div>`);
  for (const content of [packageFile("react", "umd/react.development.js"), "window.react = React;", packageFile("react-dom", "umd/react-dom.development.js"), packageFile("lucide-react", "dist/umd/lucide-react.js")]) {
    await page.addScriptTag({ content });
  }
  await page.addScriptTag({ content: `
    const sources = ${JSON.stringify(sources)};
    window.captureCalls = []; window.backgroundClicks = 0;
    const modules = {
      react: React, "lucide-react": LucideReact,
      "react/jsx-runtime": { Fragment: React.Fragment, jsx: (type, props, key) => React.createElement(type, {...props, key}), jsxs: (type, props, key) => React.createElement(type, {...props, key}) },
      "next/link": { __esModule: true, default: ({children, ...props}) => React.createElement("a", props, children) },
      "next/navigation": { usePathname: () => "/workspace", useRouter: () => ({replace: () => {}}) },
      "@/components/workspace-provider": {
        WorkspaceProvider: ({children}) => children,
        useWorkspace: () => ({ready: true, user: {id: "synthetic-user", user_metadata: {full_name: "Pilot tester"}}, workspace: {id: "synthetic-workspace"},
          accessState: {access_allowed: true}, onboarding: {state: "workspace_ready"}, plan: {status: "active"},
          capabilities: {quick_capture: true}, sotfAccess: false, error: null, signOut: async () => {}})
      },
      "@/components/workspace-clocks": {WorkspaceClocks: () => null, WorkspaceHeaderDate: () => null},
      "@/components/capability-locked-state": {CapabilityLockedState: () => null},
      "@/lib/workspace/repository": {createCapture: async (...args) => {window.captureCalls.push(args);}}
    };
    function sourceRequire(name) {
      if (Object.hasOwn(modules, name)) return modules[name];
      if (!sources[name]) throw Error("Unmocked boundary: " + name);
      const target = {exports: {}}; modules[name] = target.exports;
      new Function("require", "module", "exports", sources[name])(sourceRequire, target, target.exports);
      return modules[name] = target.exports;
    }
    const {WorkspaceShell} = sourceRequire("@/components/workspace-shell");
    ReactDOM.createRoot(document.getElementById("fixture")).render(React.createElement(WorkspaceShell, null,
      React.createElement("section", {className: "command-dashboard"},
        React.createElement("h1", null, "Synthetic Command Center"),
        React.createElement("button", {id: "background-action", style: {position: "fixed", bottom: 20, left: 20}, onClick: () => window.backgroundClicks++}, "Background action"))));
  ` });
  await expect(page.locator(".quick-capture-trigger")).toBeVisible();
  return requests;
}

test("quick capture retains backward keyboard focus in the modal", async ({ page }) => {
  await renderWorkspace(page);
  await page.locator(".quick-capture-trigger").click();
  await expect(page.getByLabel("Capture text", { exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Close quick capture", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await test.info().attach("backward-focus-observation", { body: await page.evaluate(() => document.activeElement?.outerHTML ?? "none"), contentType: "text/plain" });
  await expect(page.getByRole("button", { name: "Save capture", exact: true })).toBeFocused();
});

for (const entry of ["header", "Control+k", "Meta+k"] as const) {
  test(`${entry} opens a modal, cycles focus, dismisses to its opener, and preserves an unsaved draft`, async ({ page, isMobile }) => {
    if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
    const requests = await renderWorkspace(page);
    const opener = entry === "header" ? page.locator(".quick-capture-trigger") : page.locator("#background-action");
    const open = async () => {
      if (entry === "header") await opener.click();
      else { await opener.focus(); await page.keyboard.press(entry); }
    };
    await open();
    const modal = page.getByRole("dialog", { name: "What needs your attention?", exact: true });
    const text = page.getByLabel("Capture text", { exact: true });
    const close = page.getByRole("button", { name: "Close quick capture", exact: true });
    const save = page.getByRole("button", { name: "Save capture", exact: true });
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((element) => element.matches(":modal"))).toBe(true);
    await expect(text).toBeFocused();
    await text.fill("Synthetic unsaved capture draft");
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.keyboard.press("Tab"); await expect(save).toBeFocused();
      await expect(save).toHaveCSS("outline-style", "solid");
      await expect(save).toHaveCSS("outline-width", "2px");
      await page.keyboard.press("Tab"); await expect(close).toBeFocused();
      await expect(close).toHaveCSS("outline-style", "solid");
      await expect(close).toHaveCSS("outline-width", "2px");
      await page.keyboard.press("Tab"); await expect(text).toBeFocused();
    }
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.keyboard.press("Shift+Tab"); await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab"); await expect(save).toBeFocused();
      await page.keyboard.press("Shift+Tab"); await expect(text).toBeFocused();
    }

    // Native modality blocks programmatic focus and removes the background
    // from the browser accessibility tree; this is not a screen-reader test.
    await page.locator("#background-action").evaluate((element) => element.focus());
    await expect(text).toBeFocused();
    const accessibility = await page.context().newCDPSession(page);
    const tree = await accessibility.send("Accessibility.getFullAXTree");
    const snapshot = JSON.stringify(tree.nodes.filter((node) => !node.ignored).map((node) => ({ role: node.role?.value, name: node.name?.value })));
    await accessibility.detach();
    expect(snapshot).toContain('"role":"dialog","name":"What needs your attention?"');
    expect(snapshot).not.toContain("Background action");
    expect(snapshot).not.toContain("Workspace navigation");
    expect(snapshot).not.toContain("Synthetic Command Center");
    await test.info().attach(`modal-accessibility-${entry}`, { body: snapshot, contentType: "text/plain" });
    const panel = modal.locator(".capture-dialog");
    await expect(panel).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (entry === "header") await page.screenshot({ path: `test-results/f06-modal-${test.info().project.name}.png`, fullPage: true });

    await close.click();
    await expect(modal).toHaveCount(0);
    await expect(opener).toBeFocused();
    await open();
    await expect(text).toBeFocused();
    await expect(text).toHaveValue("Synthetic unsaved capture draft");
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(opener).toBeFocused();
    await open();
    await expect(text).toHaveValue("Synthetic unsaved capture draft");
    await expect(text).toBeFocused();
    // A pointer aimed at background content reaches only the modal backdrop,
    // retaining the existing backdrop-dismiss behavior without activating it.
    const bounds = await page.locator("#background-action").boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(modal).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => (window as Window & { backgroundClicks?: number }).backgroundClicks)).toBe(0);
    expect(await page.evaluate(() => (window as Window & { captureCalls?: unknown[] }).captureCalls)).toEqual([]);
    expect(requests).toEqual([]);
    await expect(page.getByRole("button", { name: "Background action", exact: true })).toBeVisible();
  });
}
