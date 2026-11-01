import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpAuthorizationRecord } from "@/lib/workspace/types";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[], index: 0, effects: [] as (() => void | (() => void))[],
  workspaceId: "synthetic-workspace", mcpEnabled: true, list: vi.fn()
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T>(initial: T) => {
    const index = fixture.index++;
    if (index === fixture.states.length) fixture.states.push(initial);
    return [fixture.states[index] as T, (next: T) => { fixture.states[index] = next; }];
  },
  useEffect: (effect: () => void | (() => void)) => { fixture.effects.push(effect); },
  useCallback: (callback: unknown) => callback,
  useMemo: (calculate: () => unknown) => calculate()
}));
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: (props: Record<string, unknown>) => createElement("a", props) };
});
vi.mock("@/components/workspace-provider", () => ({ useWorkspace: () => ({
  workspace: { id: fixture.workspaceId }, configuration: [],
  plan: { status: "active" }, capabilities: { core_workspace: true, workspace_mcp: fixture.mcpEnabled }
}) }));
vi.mock("@/lib/workspace/repository", () => ({
  listMcpAuthorizations: fixture.list,
  listTasks: vi.fn(), listCaptures: vi.fn(), listJobApplications: vi.fn(),
  listIntegrationConnections: vi.fn(), listDailyBriefings: vi.fn(), listWorkspaceActivity: vi.fn(), countAiConversations: vi.fn()
}));
import WorkspaceOverviewPage from "@/app/workspace/page";

const connection: McpAuthorizationRecord = {
  id: "synthetic-connection", workspace_id: "synthetic-workspace", client_id: "synthetic-client",
  assistant_provider: "chatgpt", status: "connected", granted_scopes: [],
  connected_at: null, disconnected_at: null, last_verified_at: null, last_error_code: null
};
function render() {
  fixture.index = 0;
  fixture.effects = [];
  return renderToStaticMarkup(WorkspaceOverviewPage());
}
async function load() {
  render();
  fixture.effects[1]();
  await vi.waitFor(() => expect(fixture.states[3]).not.toBeNull());
  return render();
}

describe("Command Center ChatGPT handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fixture.states = []; fixture.workspaceId = "synthetic-workspace"; fixture.mcpEnabled = true;
  });

  it("recognizes existing authorization and offers usage without the setup route", async () => {
    fixture.list.mockResolvedValue([connection]);
    const html = await load();
    expect(fixture.list).toHaveBeenCalledWith("synthetic-workspace");
    expect(html).toContain("ChatGPT connected · How to use Workspace");
    expect(html).toContain("<details");
    expect(html).toContain("You do not need to reconnect");
    expect(html).toContain("Choose your existing Lead Emergence Workspace app");
    expect(html).toContain("Show my Workspace tasks");
    expect(html).toContain('href="https://chatgpt.com"');
    expect(html).toContain("Authorization does not confirm which tools or external accounts");
    expect(html).not.toContain("/workspace/integrations/assistant");
    expect(html).not.toContain("/sotf/connect");
  });

  it.each([
    [], [{ ...connection, status: "disconnected" }], [{ ...connection, status: "reconnect_required" }],
    [{ ...connection, assistant_provider: "claude" }], [{ ...connection, assistant_provider: "other" }],
    [{ ...connection, workspace_id: "another-workspace" }]
  ].map((records) => ({ records })))("offers setup only when the lookup establishes no active ChatGPT authorization: $records", async ({ records }) => {
    fixture.list.mockResolvedValue(records);
    const html = await load();
    expect(html).toContain("No active ChatGPT authorization found");
    expect(html).toContain('href="/workspace/integrations/assistant?provider=chatgpt"');
    expect(html).not.toContain("ChatGPT connected");
  });

  it("keeps loading and lookup failure distinct from disconnection", async () => {
    const loadingHtml = render();
    expect(loadingHtml).toContain("Checking ChatGPT connection");
    expect(loadingHtml.match(/role="status"/g)).toHaveLength(1);
    fixture.list.mockRejectedValue(new Error("Unavailable"));
    const html = await load();
    expect(html).toContain("ChatGPT connection status unavailable");
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).not.toContain("No active ChatGPT authorization found");
    expect(html).not.toContain("/workspace/integrations/assistant");
  });

  it("does not offer usable handoff when the plan denies assistant access", async () => {
    fixture.mcpEnabled = false;
    fixture.list.mockResolvedValue([connection]);
    const html = await load();
    expect(html).toContain("ChatGPT authorization recorded");
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain("Assistant access unavailable for this plan");
    expect(html).not.toContain('href="https://chatgpt.com"');
    expect(html).not.toContain("/workspace/integrations/assistant");
  });

  it("does not offer connection setup when the plan denies assistant access", async () => {
    fixture.mcpEnabled = false;
    fixture.list.mockResolvedValue([]);
    const html = await load();
    expect(html).toContain("ChatGPT setup unavailable");
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain("Assistant access unavailable for this plan");
    expect(html).not.toContain("authorization recorded");
    expect(html).not.toContain("No active ChatGPT authorization found");
    expect(html).not.toContain("/workspace/integrations/assistant");
  });

  it("does not carry a connected claim into a different workspace", async () => {
    fixture.list.mockResolvedValue([connection]);
    await load();
    fixture.workspaceId = "another-workspace";
    const html = render();
    expect(html).toContain("Checking ChatGPT connection");
    expect(html).not.toContain("ChatGPT connected");
  });

  it("ignores a request that settles after its effect is cleaned up", async () => {
    let resolve: (records: McpAuthorizationRecord[]) => void = () => undefined;
    fixture.list.mockReturnValue(new Promise<McpAuthorizationRecord[]>((settle) => { resolve = settle; }));
    render();
    const cleanup = fixture.effects[1]();
    if (cleanup) cleanup();
    resolve([connection]);
    await Promise.resolve();
    expect(render()).toContain("Checking ChatGPT connection");
    expect(fixture.states[3]).toBeNull();
  });
});
