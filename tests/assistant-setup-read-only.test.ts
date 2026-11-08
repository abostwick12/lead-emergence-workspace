import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantProvider, McpAuthorizationRecord } from "@/lib/workspace/types";

const fixture = vi.hoisted(() => ({
  slots: [] as unknown[], index: 0, effects: [] as (() => void)[],
  listAuthorizations: vi.fn(), prepare: vi.fn(), refreshProductState: vi.fn(),
  workspace: { id: "synthetic-workspace" }, user: { id: "synthetic-user" }, enabled: true
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T>(initial: T) => {
    const index = fixture.index++;
    if (!(index in fixture.slots)) fixture.slots[index] = initial;
    return [fixture.slots[index] as T, (next: T) => { fixture.slots[index] = next; }];
  },
  useRef: <T>(initial: T) => {
    const index = fixture.index++;
    if (!(index in fixture.slots)) fixture.slots[index] = { current: initial };
    return fixture.slots[index];
  },
  useEffect: (effect: () => void, dependencies: unknown[]) => {
    const index = fixture.index++;
    const previous = fixture.slots[index] as unknown[] | undefined;
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
      fixture.effects.push(effect);
      fixture.slots[index] = dependencies;
    }
  }
}));
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: (props: Record<string, unknown>) => createElement("a", props) };
});
vi.mock("@/components/workspace-provider", () => ({ useWorkspace: () => ({
  user: fixture.user, workspace: fixture.workspace,
  plan: { status: "active" }, capabilities: { workspace_mcp: fixture.enabled },
  refreshProductState: fixture.refreshProductState
}) }));
vi.mock("@/lib/workspace/repository", () => ({
  listMcpAuthorizations: fixture.listAuthorizations, prepareAssistantConnection: fixture.prepare
}));
import AssistantConnectionPage from "@/app/workspace/integrations/assistant/page";

let tree: ReactElement;
function render() {
  fixture.index = 0;
  tree = AssistantConnectionPage();
  return renderToStaticMarkup(tree);
}
async function settle() {
  for (let i = 0; i < 6; i++) {
    for (const effect of fixture.effects.splice(0)) effect();
    await Promise.resolve();
    render();
  }
  return renderToStaticMarkup(tree);
}
function button(label: string) {
  let found: ReactElement<{ onClick: () => void; disabled?: boolean }> | undefined;
  function visit(node: ReactNode) {
    if (!isValidElement<{ children?: ReactNode }>(node)) return;
    if (node.type === "button" && renderToStaticMarkup(node).includes(label)) {
      found = node as typeof found;
    }
    Children.forEach(node.props.children, visit);
  }
  visit(tree);
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
function authorization(provider: AssistantProvider): McpAuthorizationRecord {
  return {
    id: "synthetic-authorization", workspace_id: "synthetic-workspace", client_id: "synthetic-client",
    assistant_provider: provider, status: "connected", granted_scopes: [], connected_at: null,
    disconnected_at: null, last_verified_at: null, last_error_code: null
  };
}

describe("Assistant setup reads until the user starts setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.slots = []; fixture.effects = []; fixture.enabled = true;
    fixture.workspace = { id: "synthetic-workspace" };
    fixture.listAuthorizations.mockResolvedValue([]);
    fixture.prepare.mockResolvedValue({});
    fixture.refreshProductState.mockResolvedValue(undefined);
    vi.stubGlobal("window", { location: { search: "", origin: "https://workspace.example" } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["chatgpt", "claude"] as const)("keeps %s arrival, rerenders and authorization refresh read-only", async (provider) => {
    window.location.search = `?provider=${provider}`;
    render();
    const html = await settle();
    expect(html).not.toContain("Approve the Lewis consent screen");
    expect(html).not.toMatch(/href="https:\/\/(chatgpt.com|claude.ai)/);
    expect(fixture.prepare).not.toHaveBeenCalled();
    fixture.workspace = { ...fixture.workspace };
    render(); await settle();
    button("Refresh authorization").props.onClick();
    const refreshed = await settle();
    expect(refreshed).toContain("No active authorization was found yet. Start setup to continue.");
    expect(refreshed).not.toContain("Complete consent in your assistant");
    expect(fixture.listAuthorizations).toHaveBeenCalledWith("synthetic-workspace");
    expect(fixture.prepare).not.toHaveBeenCalled();
    expect(fixture.refreshProductState).not.toHaveBeenCalled();
  });

  it("cannot prepare the default provider before the Claude query is resolved", async () => {
    window.location.search = "?provider=claude";
    render();
    const start = button("Start");
    expect(start.props.disabled).toBe(true);
    start.props.onClick();
    await settle();
    expect(fixture.prepare).not.toHaveBeenCalled();
    expect(button("Start Claude setup").props.disabled).toBe(false);
  });

  it.each(["chatgpt", "claude"] as const)("prepares %s once on explicit start before exposing consent guidance", async (provider) => {
    window.location.search = `?provider=${provider}`;
    const name = provider === "chatgpt" ? "ChatGPT" : "Claude";
    let resolvePreparation!: () => void;
    fixture.prepare.mockReturnValue(new Promise<void>((resolve) => { resolvePreparation = resolve; }));
    render(); await settle();
    const start = button(`Start ${name} setup`);
    start.props.onClick(); start.props.onClick();
    let html = await settle();
    expect(fixture.prepare).toHaveBeenCalledExactlyOnceWith({
      workspaceId: "synthetic-workspace", userId: "synthetic-user", assistant: provider
    });
    expect(html).not.toContain("Approve the Lewis consent screen");
    expect(html).not.toContain(`Open ${name}`);
    resolvePreparation();
    html = await settle();
    expect(html).toContain("Approve the Lewis consent screen");
    expect(html).toContain(`Open ${name}`);
    expect(fixture.refreshProductState).toHaveBeenCalledTimes(1);
    render(); await settle();
    button("Refresh authorization").props.onClick();
    html = await settle();
    expect(html).toContain("Complete consent in your assistant, then try again.");
    expect(fixture.prepare).toHaveBeenCalledTimes(1);
  });

  it("keeps failed preparation closed and retries only on another explicit start", async () => {
    fixture.prepare.mockRejectedValueOnce(new Error("synthetic preparation failure"));
    render(); await settle();
    button("Start ChatGPT setup").props.onClick();
    let html = await settle();
    expect(html).toContain("Workspace could not prepare this assistant connection.");
    expect(html).not.toContain("Approve the Lewis consent screen");
    expect(html).not.toContain("Open ChatGPT");
    render(); await settle();
    button("Refresh authorization").props.onClick();
    html = await settle();
    expect(html).toContain("No active authorization was found yet. Start setup to continue.");
    expect(html).not.toContain("Complete consent in your assistant");
    expect(fixture.prepare).toHaveBeenCalledTimes(1);
    button("Start ChatGPT setup").props.onClick();
    html = await settle();
    expect(fixture.prepare).toHaveBeenCalledTimes(2);
    expect(html).toContain("Open ChatGPT");
  });

  it.each(["chatgpt", "claude"] as const)("keeps existing %s guidance available without starting setup", async (provider) => {
    window.location.search = `?provider=${provider}`;
    fixture.listAuthorizations.mockResolvedValue([authorization(provider)]);
    render();
    const html = await settle();
    expect(html).toContain(`Open ${provider === "chatgpt" ? "ChatGPT" : "Claude"}`);
    expect(html).toContain("Authorization active");
    expect(html).not.toContain(" setup</button>");
    expect(fixture.prepare).not.toHaveBeenCalled();
  });

  it("does not prepare or expose continuation after an authorization-read failure", async () => {
    fixture.listAuthorizations.mockRejectedValue(new Error("synthetic read failure"));
    render();
    const html = await settle();
    expect(html).toContain("Connection status is temporarily unavailable.");
    expect(html).not.toContain("Open ChatGPT");
    expect(fixture.prepare).not.toHaveBeenCalled();
  });

  it("keeps successful setup available when the subsequent product-state read fails", async () => {
    fixture.refreshProductState.mockRejectedValue(new Error("synthetic product-state read failure"));
    render(); await settle();
    button("Start ChatGPT setup").props.onClick();
    const html = await settle();
    expect(html).toContain("Setup started, but Workspace status could not be refreshed.");
    expect(html).toContain("Open ChatGPT");
    expect(fixture.prepare).toHaveBeenCalledTimes(1);
    render(); await settle();
    expect(fixture.prepare).toHaveBeenCalledTimes(1);
  });

  it("does not read or prepare when the capability is unavailable", async () => {
    fixture.enabled = false;
    render(); await settle();
    expect(fixture.listAuthorizations).not.toHaveBeenCalled();
    expect(fixture.prepare).not.toHaveBeenCalled();
  });
});
