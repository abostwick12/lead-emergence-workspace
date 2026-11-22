import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { execFile } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { CaptureRecord, TaskRecord } from "@/lib/workspace/types";

test.use({ video: "off" });

// Actual CapturePage, repository, React and CSS; synthetic account/transport only.
// Database integrity is tested separately through PostgreSQL and PostgREST.
const nativeRequire = createRequire(path.join(process.cwd(), "package.json"));
const react = readFileSync(path.join(path.dirname(nativeRequire.resolve("react/package.json")), "umd/react.development.js"), "utf8");
const reactDom = readFileSync(path.join(path.dirname(nativeRequire.resolve("react-dom/package.json")), "umd/react-dom.development.js"), "utf8");
const sources = Object.fromEntries([
  ["capture-page", "app/workspace/capture/page.tsx"],
  ["@/lib/workspace/repository", "lib/workspace/repository.ts"],
  ["@/lib/workspace/types", "lib/workspace/types.ts"],
  ["@/lib/workspace/timezones", "lib/workspace/timezones.ts"],
  ["@/lib/workspace/capabilities", "lib/workspace/capabilities.ts"]
].map(([name, filename]) => [name, ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText]));
const storageKey = "workspace:capture-to-task:synthetic-user:synthetic-workspace";
const captures: CaptureRecord[] = ["one", "two"].map((suffix) => ({
  id: `capture-${suffix}`, workspace_id: "synthetic-workspace", raw_text: `Original thought ${suffix}`,
  status: "unprocessed", routed_task_id: null, created_at: "2026-11-19T12:00:00Z"
}));
type Fault = "none" | "lost-after-commit" | "lost-before-commit" | "rollback" | "denied" | "refresh-failed";

const localUser = "f0911111-1111-4111-8111-111111111111";
const localWorkspace = "f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const exec = promisify(execFile);
// Opt-in local integration only: fixed task-owned containers, no hosted URL input.
async function localApi(resource: string, body?: unknown, method?: "PATCH") {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: localUser, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  const token = `${claims}.${createHmac("sha256", "f09-local-only-synthetic-jwt-secret-at-least-32").update(claims).digest("base64url")}`;
  const args = ["exec", "f09-db-20261119", "curl", "-sS", "--max-time", "20", "-w", "\n%{http_code}", "-H", `Authorization: Bearer ${token}`, "-H", "Content-Profile: workspace", "-H", "Accept-Profile: workspace"];
  if (body !== undefined) args.push("-H", "Content-Type: application/json", "-H", "Prefer: return=representation", "--data-binary", JSON.stringify(body));
  if (method) args.push("-X", method);
  args.push(`http://f09-rest-20261119:3000/${resource}`);
  const { stdout } = await exec("docker", args, { windowsHide: true });
  const split = stdout.lastIndexOf("\n");
  const status = Number(stdout.slice(split + 1));
  const result = JSON.parse(stdout.slice(0, split));
  return status >= 200 && status < 300 ? { data: result, error: null } : { data: null, error: result };
}

async function fixture(page: Page, options: { fault?: Fault; storageUnavailable?: boolean; realDatabase?: boolean } = {}) {
  const state = { captures: structuredClone(captures), tasks: [] as TaskRecord[], calls: [] as { target_capture_id: string; task_domain: string }[], fault: options.fault ?? "none" as Fault, readsFail: false, taskReadsFail: false, taskReadsEmpty: false, listCap: Infinity, staleInbox: false, rpcGate: null as Promise<void> | null, inboxReadGate: null as Promise<void> | null, inboxReads: 0, discardOutcome: "normal" as "normal" | "failed" | "unavailable" | "unprocessed", unexpected: [] as string[] };
  const localCaptureIds = [randomUUID(), randomUUID()];
  const runMarker = `f09-browser-${randomUUID()}`;
  const workspaceId = options.realDatabase ? localWorkspace : "synthetic-workspace";
  const userId = options.realDatabase ? localUser : "synthetic-user";
  if (options.realDatabase) {
    expect((await exec("docker", ["inspect", "f09-db-20261119", "--format", '{{index .Config.Labels "task"}}'], { windowsHide: true })).stdout.trim()).toBe("f09-20261119");
    const result = await localApi("capture_inbox", captures.map((capture, index) => ({ id: localCaptureIds[index], workspace_id: workspaceId, created_by: userId, raw_text: `${capture.raw_text} ${runMarker}` })));
    expect(result.error).toBeNull();
    state.captures = result.data;
  }
  const bootstrap = `
    const sources = ${JSON.stringify(sources)};
    ${options.storageUnavailable ? 'Storage.prototype.setItem = Storage.prototype.getItem = Storage.prototype.removeItem = () => { throw Error("storage unavailable"); };' : ""}
    const client = {
      rpc: async (name, args) => {
        const response = await fetch('/f09-fixture/rpc', {method: 'POST', body: JSON.stringify({name, args})});
        return response.json();
      },
      from: (table) => {
        const filters = []; let patch, insert;
        const execute = async () => {
          const response = insert
            ? await fetch('/f09-fixture/insert', {method: 'POST', body: JSON.stringify({table, insert})})
            : patch
            ? await fetch('/f09-fixture/discard', {method: 'POST', body: JSON.stringify({table, filters, patch})})
            : await fetch('/f09-fixture/read?table=' + table + '&filters=' + encodeURIComponent(JSON.stringify(filters)));
          return response.json();
        };
        const query = {select: () => query, insert: value => {insert = value; return query;}, single: execute, update: value => {patch = value; return query;}, eq: (key, value) => {filters.push([key, value]); return query;}, order: execute, then: (resolve, reject) => execute().then(resolve, reject)};
        return query;
      }
    };
    const modules = {
      react: React,
      "react/jsx-runtime": {Fragment: React.Fragment, jsx: (type, props, key) => React.createElement(type, {...props, key}), jsxs: (type, props, key) => React.createElement(type, {...props, key})},
      "next/link": {__esModule: true, default: ({children, ...props}) => React.createElement("a", props, children)},
      "@/components/workspace-provider": {useWorkspace: () => {
        const [id, setId] = React.useState(${JSON.stringify(workspaceId)});
        React.useEffect(() => { window.f09SwitchWorkspace = setId; }, []);
        return {workspace: {id}, user: {id: ${JSON.stringify(userId)}}, plan: {status: "active"}, capabilities: {quick_capture: true, tasks: true}};
      }},
      "@/components/capability-locked-state": {CapabilityLockedState: () => null},
      "@/lib/supabase/client": {getWorkspaceClient: () => client}
    };
    function sourceRequire(name) {
      if (Object.hasOwn(modules, name)) return modules[name];
      if (!sources[name]) throw Error("Unmocked boundary: " + name);
      const target = {exports: {}}; modules[name] = target.exports;
      new Function("require", "module", "exports", sources[name])(sourceRequire, target, target.exports);
      return modules[name] = target.exports;
    }
    const CapturePage = sourceRequire('capture-page').default;
    ReactDOM.createRoot(document.getElementById('fixture')).render(React.createElement(CapturePage));
  `;
  const html = `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync("app/globals.css", "utf8")}</style><div id="fixture"></div><script>${react}</script><script>${reactDom}</script><script>${bootstrap.replaceAll("</script", "<\\/script")}</script>`;
  const install = async (target: Page) => {
    target.on("pageerror", (error) => { throw error; });
    await target.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/f09-native-fixture") return route.fulfill({ contentType: "text/html", body: html });
      if (url.pathname === "/f09-fixture/read") {
        if (state.readsFail) return route.fulfill({ json: { data: null, error: { message: "Synthetic unavailable read" } } });
        const table = url.searchParams.get("table");
        const filters: [string, string][] = JSON.parse(url.searchParams.get("filters") ?? "[]");
        if (!["tasks", "capture_inbox"].includes(table ?? "")) throw Error("Unexpected table " + table);
        if (table === "tasks" && state.taskReadsFail) return route.fulfill({ json: { data: null, error: { message: "Synthetic unavailable task read" } } });
        if (table === "tasks" && state.taskReadsEmpty) return route.fulfill({ json: { data: [], error: null } });
        if (options.realDatabase) {
          const query = `${table}?${filters.map(([key, value]) => `${key}=eq.${encodeURIComponent(value)}`).join("&")}&select=*${table === "capture_inbox" ? `&id=in.(${localCaptureIds.join(",")})` : ""}`;
          return route.fulfill({ json: await localApi(query) });
        }
        const exactRead = filters.some(([key]) => key === "id");
        if (table === "capture_inbox" && exactRead && state.discardOutcome === "unavailable") return route.fulfill({ json: { data: [], error: null } });
        const records = table === "tasks" ? state.tasks : state.staleInbox && !exactRead ? captures : state.captures;
        const filtered = records.filter((record) => filters.every(([key, value]) => record[key as keyof typeof record] === value));
        const snapshot = structuredClone(filtered.slice(0, exactRead ? undefined : state.listCap));
        if (table === "capture_inbox" && !exactRead) {
          state.inboxReads += 1;
          if (state.inboxReadGate) await state.inboxReadGate;
        }
        return route.fulfill({ json: { data: snapshot, error: null } });
      }
      if (url.pathname === "/f09-fixture/insert") {
        const { table, insert } = route.request().postDataJSON();
        expect(options.realDatabase).not.toBe(true);
        expect(table).toBe("capture_inbox");
        expect(insert).toEqual({ workspace_id: workspaceId, created_by: userId, raw_text: "Saved while discarding" });
        const capture: CaptureRecord = { id: `capture-saved-${state.captures.length}`, workspace_id: workspaceId, raw_text: insert.raw_text, status: "unprocessed", routed_task_id: null, created_at: "2026-11-19T12:01:00Z" };
        state.captures.push(capture);
        return route.fulfill({ json: { data: capture, error: null } });
      }
      if (url.pathname === "/f09-fixture/discard") {
        const { table, filters, patch }: { table: string; filters: [string, string][]; patch: { status: string } } = route.request().postDataJSON();
        expect(table).toBe("capture_inbox");
        expect(filters.map(([key]) => key).sort()).toEqual(["id", "status", "workspace_id"]);
        expect(patch).toEqual({ status: "discarded" });
        if (options.realDatabase) {
          const query = `capture_inbox?${filters.map(([key, value]) => `${key}=eq.${encodeURIComponent(value)}`).join("&")}&select=*`;
          return route.fulfill({ json: await localApi(query, patch, "PATCH") });
        }
        if (state.discardOutcome === "failed") return route.fulfill({ json: { data: null, error: { message: "Synthetic discard failed" } } });
        if (state.discardOutcome !== "normal") return route.fulfill({ json: { data: [], error: null } });
        const matching = state.captures.filter((capture) => filters.every(([key, value]) => capture[key as keyof CaptureRecord] === value));
        matching.forEach((capture) => { capture.status = "discarded"; });
        return route.fulfill({ json: { data: matching, error: null } });
      }
      if (url.pathname === "/f09-fixture/rpc") {
        const { name, args } = route.request().postDataJSON();
        expect(name).toBe("resolve_capture_to_task");
        expect(Object.keys(args).sort()).toEqual(["target_capture_id", "target_workspace_id", "task_domain"]);
        expect(args.target_workspace_id).toBe(workspaceId);
        state.calls.push(args);
        if (state.rpcGate) await state.rpcGate;
        const fault = state.fault; state.fault = "none";
        if (options.realDatabase) {
          const result = await localApi("rpc/resolve_capture_to_task", args);
          expect(result.error).toBeNull();
          // The actual database has committed before the browser loses its response.
          if (fault === "lost-after-commit") return route.abort("failed");
          return route.fulfill({ json: result });
        }
        if (fault === "lost-before-commit") return route.abort("failed");
        if (fault === "rollback" || fault === "denied") return route.fulfill({ json: { data: null, error: { code: fault === "rollback" ? "22023" : "42501" } } });
        const capture = state.captures.find((entry) => entry.id === args.target_capture_id)!;
        const existing = state.tasks.find((entry) => entry.id === capture.routed_task_id);
        const task: TaskRecord = existing ?? {
          id: `task-${capture.id}`, workspace_id: "synthetic-workspace", title: capture.raw_text.trim(),
          domain: args.task_domain, description: null, status: "todo", priority: "medium", due_date: null,
          tags: [], created_at: "2026-11-19T12:00:00Z", updated_at: "2026-11-19T12:00:00Z"
        };
        if (!existing) { state.tasks.push(task); capture.status = "processed"; capture.routed_task_id = task.id; }
        if (fault === "lost-after-commit") return route.abort("failed");
        if (fault === "refresh-failed") state.readsFail = true;
        return route.fulfill({ json: { data: { task, already_processed: Boolean(existing) }, error: null } });
      }
      state.unexpected.push(url.href);
      return route.abort();
    });
    await target.goto("/f09-native-fixture");
    await expect(target.getByRole("heading", { name: "Quick capture", exact: true })).toBeVisible();
  };
  await install(page);
  await expect(page.getByRole("button", { name: "Make task", exact: true })).toHaveCount(2);
  return { state, install, localCaptureIds, runMarker };
}

function firstCapture(page: Page) { return page.locator("article.item").filter({ hasText: "Original thought one" }); }

for (const outcome of ["discarded", "processed", "failed", "unavailable", "unprocessed"] as const) {
  test(`discard ${outcome} reconciles an older inbox response started by Save`, async ({ page }) => {
    const { state } = await fixture(page);
    let release!: () => void;
    state.inboxReadGate = new Promise<void>((resolve) => { release = resolve; });
    await page.getByLabel("What needs your attention?").fill("Saved while discarding");
    await page.getByRole("button", { name: "Save to inbox", exact: true }).click();
    await expect.poll(() => state.inboxReads).toBe(2);
    // The list snapshot is now held; only a readable terminal discard result may settle it.
    if (outcome === "processed") state.captures[0].status = "processed";
    else if (outcome !== "discarded") state.discardOutcome = outcome;
    await firstCapture(page).getByRole("button", { name: "Discard", exact: true }).click();
    const terminal = outcome === "discarded" || outcome === "processed";
    if (terminal) {
      await expect(page.getByRole("status")).toContainText(outcome === "discarded" ? "This capture is discarded" : "already became a task and was not discarded");
      await expect(firstCapture(page)).toHaveCount(0);
    } else {
      await expect(page.getByRole("alert")).toContainText(outcome === "failed" ? "Synthetic discard failed" : "current state is unavailable");
      await expect(firstCapture(page)).toBeVisible();
    }
    release();
    const saved = page.locator("article.item").filter({ hasText: "Saved while discarding" });
    await expect(saved).toBeVisible();
    await expect(firstCapture(page)).toHaveCount(terminal ? 0 : 1);
    for (const item of [saved, page.locator("article.item").filter({ hasText: "Original thought two" })]) {
      await expect(item.getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
      await expect(item.getByRole("button", { name: "Discard", exact: true })).toBeEnabled();
    }
    expect(state.captures[0].status).toBe(terminal ? outcome : "unprocessed");
    expect(state.tasks).toHaveLength(0);
    expect(state.calls).toHaveLength(0);
    expect(state.unexpected).toEqual([]);
  });
}

test("double activation retains one pending capture and one conversion request", async ({ page }) => {
  const { state } = await fixture(page);
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  expect(state.calls).toHaveLength(1);
  expect(state.tasks).toHaveLength(1);
});

test("real local committed conversion survives dropped browser acknowledgement, retry and reload", async ({ page }) => {
  test.skip(process.env.F09_LOCAL_DATABASE !== "1", "Requires the task-owned isolated PostgreSQL/PostgREST fixtures.");
  const { state, localCaptureIds, runMarker } = await fixture(page, { realDatabase: true, fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm");
  const committed = await localApi(`capture_inbox?id=eq.${localCaptureIds[0]}&select=status,routed_task_id`);
  expect(committed.error).toBeNull();
  expect(committed.data[0].status).toBe("processed");
  await page.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  const replay = await localApi(`capture_inbox?id=eq.${localCaptureIds[0]}&select=routed_task_id`);
  expect(replay.data[0].routed_task_id).toBe(committed.data[0].routed_task_id);
  state.fault = "lost-after-commit";
  await page.locator("article.item").filter({ hasText: "Original thought two" }).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm");
  const callsBeforeReload = state.calls.length;
  await page.reload();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  expect(state.calls).toHaveLength(callsBeforeReload);
  const persisted = await localApi(`tasks?workspace_id=eq.${localWorkspace}&title=like.*${runMarker}*&select=id,title`);
  expect(persisted.error).toBeNull();
  expect(persisted.data).toHaveLength(2);
  await test.info().attach("real-database-readback", { body: JSON.stringify({ tasks: persisted.data, firstLink: committed.data[0].routed_task_id, writesOnReload: 0 }), contentType: "application/json" });
  expect(state.unexpected).toEqual([]);
});

test("confirmation retains the task and original content when inbox refresh fails", async ({ page }) => {
  const { state } = await fixture(page, { fault: "refresh-failed" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board" })).toHaveAttribute("href", "/workspace/tasks");
  await expect(page.getByRole("alert")).toContainText("The task is confirmed");
  expect(state.tasks).toHaveLength(1);
  expect(state.captures[0]).toMatchObject({ raw_text: "Original thought one", status: "processed", routed_task_id: state.tasks[0].id });
  expect(state.unexpected).toEqual([]);
});

test("lost acknowledgement retains only scoped capture ID and reload reads the committed link without a write", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  await expect(firstCapture(page).getByRole("button", { name: "Discard", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Make task", exact: true }).last()).toBeDisabled();
  expect(await page.evaluate(() => Object.entries(sessionStorage))).toEqual([[storageKey, "capture-one"]]);
  expect(state.tasks).toHaveLength(1);
  const taskId = state.tasks[0].id;
  await page.reload();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  expect(state.calls).toHaveLength(1);
  expect(state.tasks.map((task) => task.id)).toEqual([taskId]);
  expect(await page.evaluate(() => Object.entries(sessionStorage))).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("reload of an uncommitted capture is read-only until explicit same-capture retry", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-before-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("still in your inbox");
  expect(state.tasks).toHaveLength(0); expect(state.calls).toHaveLength(1);
  await page.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  expect(state.tasks).toHaveLength(1);
  expect(state.calls.map((call) => call.target_capture_id)).toEqual(["capture-one", "capture-one"]);
});

test("discard in another tab releases recovery after a lost before-commit response", async ({ page, context }) => {
  const { state, install } = await fixture(page, { fault: "lost-before-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");

  const second = await context.newPage();
  await install(second);
  await firstCapture(second).getByRole("button", { name: "Discard", exact: true }).click();
  await expect(second.getByRole("status")).toContainText("This capture is discarded.");

  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("This capture was discarded.");
  await expect(firstCapture(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
  expect(state.tasks).toHaveLength(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  await expect(firstCapture(page)).toHaveCount(0);
  expect(state.calls).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
  await second.close();
});

test("processed capture with a confirmed null task link offers a read-only exit", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  expect(state.captures[0].status).toBe("processed");
  expect(state.captures[0].routed_task_id).toBe(state.tasks[0].id);
  state.captures[0].routed_task_id = null;
  state.tasks = [];

  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("marked processed, but it has no linked task");
  await expect(page.getByRole("button", { name: "Retry this capture", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear recovery", exact: true })).toBeVisible();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");
  expect(state.tasks).toHaveLength(0);

  await page.reload();
  const otherCapture = page.locator("article.item").filter({ hasText: "Original thought two" });
  await expect(page.getByRole("button", { name: "Clear recovery", exact: true })).toBeVisible();
  await expect(otherCapture.getByRole("button", { name: "Make task", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Clear recovery", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Recovery was cleared. No replacement task was created.");
  await expect(otherCapture.getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
  expect(state.tasks).toHaveLength(0);
  expect(state.calls).toHaveLength(1);
  await page.reload();
  await expect(page.locator("article.item").filter({ hasText: "Original thought two" }).getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(state.calls).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});

test("unreadable linked task preserves pending recovery until access returns", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  state.taskReadsFail = true;

  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("We couldn't check this capture's status");
  await expect(page.getByRole("button", { name: "Return to inbox", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");
  await expect(page.getByRole("button", { name: "Make task", exact: true }).last()).toBeDisabled();
  expect(state.tasks).toHaveLength(1);

  state.taskReadsFail = false;
  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board", exact: true })).toBeVisible();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
  expect(state.tasks).toHaveLength(1);
  expect(state.calls).toHaveLength(1);
});

test("filtered linked task read preserves pending recovery", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  state.taskReadsEmpty = true;

  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("We couldn't confirm the linked task");
  await expect(page.getByRole("button", { name: "Clear recovery", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");
  await expect(page.getByRole("button", { name: "Make task", exact: true }).last()).toBeDisabled();
  expect(state.tasks).toHaveLength(1);
  expect(state.calls).toHaveLength(1);
});
test("changed-domain retry returns first task and a rejected retry preserves earlier uncertainty", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  state.fault = "denied";
  await page.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("earlier attempt is still unconfirmed");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");
  await page.getByLabel("New tasks from this inbox").selectOption("life");
  await page.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your current selection was not applied");
  expect(state.tasks).toHaveLength(1); expect(state.tasks[0].domain).toBe("general");
});

test("acknowledged validation failure leaves content and permits a clean retry", async ({ page }) => {
  const { state } = await fixture(page, { fault: "rollback" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Conversion was not applied");
  expect(state.tasks).toHaveLength(0);
  expect(state.captures[0]).toMatchObject({ raw_text: "Original thought one", status: "unprocessed", routed_task_id: null });
  await expect(firstCapture(page).getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  expect(state.tasks).toHaveLength(1);
});

test("two browser tabs converge on one task and stale changed input is not applied", async ({ page, context }) => {
  const { state, install } = await fixture(page);
  const second = await context.newPage(); await install(second);
  await expect(second.getByRole("button", { name: "Make task", exact: true })).toHaveCount(2);
  await second.getByLabel("New tasks from this inbox").selectOption("life");
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  await firstCapture(second).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(second.getByRole("status")).toContainText("Your current selection was not applied");
  expect(state.tasks).toHaveLength(1); expect(state.calls).toHaveLength(2);
  expect(state.captures[0].routed_task_id).toBe(state.tasks[0].id);
  expect(state.tasks[0].domain).toBe("general");
  await second.close();
});

test("unavailable storage still offers same-capture recovery without fallback writes", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit", storageUnavailable: true });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm whether this became a task");
  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open task board" })).toBeVisible();
  expect(state.calls).toHaveLength(1); expect(state.tasks).toHaveLength(1);
});

test("confirmed A stays absent when refresh fails, B starts, and a stale inbox read returns", async ({ page }) => {
  const { state } = await fixture(page, { fault: "refresh-failed" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The task is confirmed");
  await expect(firstCapture(page)).toHaveCount(0);
  state.readsFail = false; state.staleInbox = true;
  await page.locator("article.item").filter({ hasText: "Original thought two" }).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Confirmed task: Original thought two");
  await expect(page.locator("article.item")).toHaveCount(0);
  expect(state.tasks).toHaveLength(2);
});

test("recovery finds the exact older capture and linked task beyond capped lists", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-after-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm");
  state.listCap = 0;
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Confirmed task: Original thought one");
  await expect(page.getByRole("link", { name: "Open task board", exact: true })).toHaveAttribute("href", "/workspace/tasks");
  expect(state.calls).toHaveLength(1);
});

test("acknowledged validation plus unprocessed readback offers explicit read-only return to inbox", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-before-commit" });
  state.captures[0].raw_text = "x".repeat(241);
  await page.getByRole("button", { name: "Make task", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm");
  state.fault = "rollback";
  await page.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByRole("button", { name: "Return to inbox", exact: true })).toBeVisible();
  expect(state.tasks).toHaveLength(0);
  const calls = state.calls.length;
  await page.getByRole("button", { name: "Return to inbox", exact: true }).click();
  await expect(page.getByRole("button", { name: "Make task", exact: true }).last()).toBeEnabled();
  expect(state.calls).toHaveLength(calls);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
  expect(state.captures[0]).toMatchObject({ status: "unprocessed", raw_text: "x".repeat(241) });
});

test("validation without a reliable unprocessed readback keeps pending and offers no return", async ({ page }) => {
  const { state } = await fixture(page, { fault: "lost-before-commit" });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("couldn't confirm");
  state.fault = "rollback"; state.readsFail = true;
  await page.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("earlier attempt is still unconfirmed");
  await expect(page.getByRole("button", { name: "Return to inbox", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");
  state.readsFail = false;
  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByRole("button", { name: "Return to inbox", exact: true })).toBeVisible();
});

test("switching workspace ignores the old acknowledgement and releases the old busy state", async ({ page }) => {
  const { state } = await fixture(page);
  state.captures.push({ ...captures[0], id: "other-capture", workspace_id: "other-workspace", raw_text: "Other workspace thought" });
  let release!: () => void;
  state.rpcGate = new Promise<void>((resolve) => { release = resolve; });
  await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Making this capture a task");
  await page.evaluate(() => (window as unknown as { f09SwitchWorkspace: (id: string) => void }).f09SwitchWorkspace("other-workspace"));
  const other = page.locator("article.item").filter({ hasText: "Other workspace thought" });
  await expect(other.getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  release();
  await expect.poll(() => state.tasks.length).toBe(1);
  await expect(page.getByRole("link", { name: "Open task board", exact: true })).toHaveCount(0);
  await expect(other.getByRole("button", { name: "Make task", exact: true })).toBeEnabled();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe("capture-one");
  expect(await page.evaluate(() => sessionStorage.getItem("workspace:capture-to-task:synthetic-user:other-workspace"))).toBeNull();
});

for (const realDatabase of [false, true]) {
  test(`${realDatabase ? "real local" : "synthetic"} stale-tab discard preserves an already converted capture and its task`, async ({ page, context }) => {
    test.skip(realDatabase && process.env.F09_LOCAL_DATABASE !== "1", "Requires the task-owned isolated database.");
    const { state, install, localCaptureIds, runMarker } = await fixture(page, { realDatabase });
    const second = await context.newPage(); await install(second);
    await firstCapture(page).getByRole("button", { name: "Make task", exact: true }).click();
    await expect(page.getByRole("link", { name: "Open task board", exact: true })).toBeVisible();
    await firstCapture(second).getByRole("button", { name: "Discard", exact: true }).click();
    await expect(second.getByRole("status")).toContainText("already became a task and was not discarded");
    await expect(firstCapture(second)).toHaveCount(0);
    if (realDatabase) {
      const rows = await localApi(`capture_inbox?workspace_id=eq.${localWorkspace}&id=eq.${localCaptureIds[0]}&select=status,routed_task_id`);
      const tasks = await localApi(`tasks?workspace_id=eq.${localWorkspace}&title=like.*${runMarker}*&select=id`);
      expect(rows.error).toBeNull(); expect(tasks.error).toBeNull();
      expect(tasks.data).toHaveLength(1);
      expect(rows.data[0]).toEqual({ status: "processed", routed_task_id: tasks.data[0].id });
      await test.info().attach("stale-discard-real-readback", { body: JSON.stringify({ captureId: localCaptureIds[0], ...rows.data[0], taskCount: tasks.data.length, runMarker }), contentType: "application/json" });
    } else {
      expect(state.captures[0]).toMatchObject({ status: "processed", routed_task_id: state.tasks[0].id });
      expect(state.tasks).toHaveLength(1);
    }
    expect(state.unexpected).toEqual([]);
    await second.close();
  });
}
