import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpAuthorizationRecord } from "@/lib/workspace/types";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[], index: 0, workspaceId: "ef17ae83-747b-4470-8dc5-08eeec86989f",
  declare: vi.fn(), list: vi.fn()
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T>(initial: T) => {
    const index = fixture.index++;
    if (index === fixture.states.length) fixture.states.push(initial);
    return [fixture.states[index] as T, (next: T | ((previous: T) => T)) => {
      fixture.states[index] = typeof next === "function" ? (next as (previous: T) => T)(fixture.states[index] as T) : next;
    }];
  }, useEffect: () => undefined, useMemo: (calculate: () => unknown) => calculate()
}));
vi.mock("@/components/clock-settings", () => ({ ClockSettings: () => null }));
vi.mock("@/components/workspace-provider", () => ({ useWorkspace: () => ({
  user: { id: "synthetic-owner" }, workspace: { id: fixture.workspaceId, name: "Synthetic Workspace" },
  plan: { status: "active" }, capabilities: { core_workspace: true, workspace_mcp: true }, configuration: [], refreshProductState: vi.fn()
}) }));
vi.mock("@/lib/workspace/repository", () => ({
  confirmPersonalAssistantConnectionHost: fixture.declare, listMcpAuthorizations: fixture.list,
  disconnectMcpAuthorization: vi.fn(), saveNativeConfiguration: vi.fn(), trackProductEvent: vi.fn()
}));
import SettingsPage from "@/app/workspace/settings/page";

const connection: McpAuthorizationRecord = {
  id: "ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3", workspace_id: "ef17ae83-747b-4470-8dc5-08eeec86989f",
  client_id: "61940a73-fafe-4b96-ab8e-1de7d4cafbac", assistant_provider: "other", status: "connected",
  granted_scopes: [], connected_at: null, disconnected_at: null, last_verified_at: null, last_error_code: null
};
function render() { fixture.index = 0; return SettingsPage(); }
type Control = ReactElement<{ children?: ReactNode; onClick?: () => void; onChange?: (event: { target: { checked: boolean } }) => void; disabled?: boolean; type?: string }>;
function controls(node: ReactNode): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!isValidElement(node)) return [];
  const element = node as Control;
  return [element, ...controls(element.props.children)];
}
function button(page: ReactNode, label: string) {
  const found = controls(page).find((element) => element.type === "button" && element.props.children === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
describe("native explicit owner declaration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fixture.states = []; fixture.index = 0; fixture.workspaceId = connection.workspace_id;
    render(); fixture.states[1] = [connection]; fixture.list.mockResolvedValue([{ ...connection, assistant_provider: "chatgpt" }]);
    fixture.declare.mockResolvedValue({ assistant_provider: "chatgpt", changed: true });
  });
  it("requires review and an explicit checkbox before the declaration call", async () => {
    let page = render();
    button(page, "Confirm this is ChatGPT").props.onClick?.();
    expect(fixture.declare).not.toHaveBeenCalled();
    page = render();
    expect(renderToStaticMarkup(page)).toContain("does not independently verify the host");
    expect(button(page, "Record my declaration").props.disabled).toBe(true);
    button(page, "Record my declaration").props.onClick?.();
    expect(fixture.declare).not.toHaveBeenCalled();
    const checkbox = controls(page).find((element) => element.type === "input" && element.props.type === "checkbox");
    checkbox?.props.onChange?.({ target: { checked: true } });
    page = render();
    expect(button(page, "Record my declaration").props.disabled).toBe(false);
    button(page, "Record my declaration").props.onClick?.();
    await vi.waitFor(() => expect(fixture.declare).toHaveBeenCalledWith(connection.id, "chatgpt"));
  });
  it.each([
    { ...connection, id: "another-connection" }, { ...connection, client_id: "another-client" },
    { ...connection, assistant_provider: "claude" }, { ...connection, status: "disconnected" }
  ])("does not advertise the action for a different or unavailable connection", (other) => {
    fixture.states[1] = [other];
    expect(renderToStaticMarkup(render())).not.toContain("Confirm this is ChatGPT");
    expect(fixture.declare).not.toHaveBeenCalled();
  });
  it("does not advertise the action in another workspace", () => {
    fixture.workspaceId = "another-workspace";
    expect(renderToStaticMarkup(render())).not.toContain("Confirm this is ChatGPT");
  });
  it("explains withdrawal's effect and does not invoke it merely by opening review", () => {
    fixture.states[1] = [{ ...connection, assistant_provider: "chatgpt" }];
    button(render(), "Withdraw ChatGPT declaration").props.onClick?.();
    const page = render();
    expect(renderToStaticMarkup(page)).toContain("ChatGPT-specific SOTF metadata will no longer be available");
    expect(button(page, "Withdraw my declaration").props.disabled).toBe(true);
    expect(fixture.declare).not.toHaveBeenCalled();
  });
});
