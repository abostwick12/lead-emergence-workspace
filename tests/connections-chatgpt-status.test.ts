import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationConnection, McpAuthorizationRecord } from "@/lib/workspace/types";
import { MCP_CATALOG } from "@/lib/workspace/mcp-catalog";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[], index: 0, effects: [] as (() => void | (() => void))[],
  listConnections: vi.fn(), listAuthorizations: vi.fn()
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T>(initial: T) => {
    const index = fixture.index++;
    if (index === fixture.states.length) fixture.states.push(initial);
    return [fixture.states[index] as T, (next: T) => { fixture.states[index] = next; }];
  },
  useEffect: (effect: () => void | (() => void)) => { fixture.effects.push(effect); },
  useMemo: (calculate: () => unknown) => calculate(),
  useRef: () => ({ current: null })
}));
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: (props: Record<string, unknown>) => createElement("a", props) };
});
vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return { default: ({ unoptimized: _unoptimized, ...props }: Record<string, unknown>) => createElement("img", props) };
});
vi.mock("@/components/workspace-provider", () => ({ useWorkspace: () => ({
  user: null, workspace: { id: "synthetic-workspace", owner_user_id: "synthetic-owner" },
  capabilities: { external_connectors: true, integration_limit: 20 }
}) }));
vi.mock("@/lib/workspace/repository", () => ({
  listIntegrationConnections: fixture.listConnections, listMcpAuthorizations: fixture.listAuthorizations
}));
import IntegrationsPage from "@/app/workspace/integrations/page";

const authorization: McpAuthorizationRecord = {
  id: "synthetic-authorization", workspace_id: "synthetic-workspace", client_id: "synthetic-client",
  assistant_provider: "chatgpt", status: "connected", granted_scopes: [],
  connected_at: null, disconnected_at: null, last_verified_at: null, last_error_code: null
};
const connection: IntegrationConnection = {
  id: "synthetic-connection", provider: "gmail", status: "connected", connected_account_label: null,
  scopes: [], last_success_at: "2026-11-01T00:00:00Z", last_error_code: null
};
function render() {
  fixture.index = 0;
  fixture.effects = [];
  return renderToStaticMarkup(IntegrationsPage());
}
async function load() {
  render();
  fixture.effects[0]();
  await vi.waitFor(() => expect(fixture.states[2]).toBe(false));
  return render();
}
function expectUnknownHealth(html: string) {
  const cards = html.slice(html.indexOf('aria-label="ChatGPT-account connection status"'));
  expect(cards.match(/Status unavailable/g)).toHaveLength(MCP_CATALOG.length);
  expect(cards.match(/href="https:\/\/chatgpt.com\/"/g)).toHaveLength(MCP_CATALOG.length);
  expect(cards).not.toMatch(/data-status=|Connected|Disconnected|Reconnect required|Action needed|Planned connector|No sync yet|Last sync/);
  expect(html).not.toMatch(/connections active|need review|\/14/);
  expect(html).toContain("In ChatGPT, open Settings and review the relevant app under Apps or Plugins, if available.");
}

describe("Connections reports ChatGPT-account health truthfully", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fixture.states = [];
    fixture.listConnections.mockResolvedValue([]);
    fixture.listAuthorizations.mockResolvedValue([]);
  });

  it("does not count duplicate Workspace ChatGPT authorizations as healthy connections", async () => {
    fixture.listAuthorizations.mockResolvedValue([authorization, { ...authorization, id: "duplicate" }]);
    const html = await load();
    expectUnknownHealth(html);
    expect(html).toContain("Workspace authorization saved");
    expect(html).toContain("They do not establish connection health in your ChatGPT account.");
    expect(fixture.listAuthorizations).toHaveBeenCalledWith("synthetic-workspace");
  });

  it("does not substitute multiple assistant or provider authorizations for ChatGPT health", async () => {
    fixture.listAuthorizations.mockResolvedValue([authorization, { ...authorization, assistant_provider: "claude" }]);
    fixture.listConnections.mockResolvedValue([connection, { ...connection, provider: "github" }]);
    expectUnknownHealth(await load());
  });

  it("keeps mixed active, inactive, error, and planned native metadata separate from account health", async () => {
    fixture.listAuthorizations.mockResolvedValue([
      { ...authorization, status: "disconnected" }, { ...authorization, id: "active-authorization" },
      { ...authorization, assistant_provider: "claude", status: "error" }
    ]);
    fixture.listConnections.mockResolvedValue([
      connection, { ...connection, provider: "slack", status: "error" },
      { ...connection, provider: "github", status: "reconnect_required" },
      { ...connection, provider: "google_drive", status: "disconnected" }
    ]);
    const html = await load();
    expectUnknownHealth(html);
    expect(html).toContain("Workspace authorization saved");
    expect(html).toContain("No active Workspace authorization recorded");
  });

  it("preserves unknown health and authorization evidence while loading or when metadata lookup fails", async () => {
    const loading = render();
    expectUnknownHealth(loading);
    expect(loading).toContain("Workspace authorization status unavailable");
    expect(loading).not.toContain("No active Workspace authorization recorded");
    fixture.listConnections.mockRejectedValue(new Error("Synthetic lookup failure"));
    const failed = await load();
    expectUnknownHealth(failed);
    expect(failed).toContain("Workspace settings could not be loaded");
    expect(failed).toContain("Workspace authorization status unavailable");
    expect(failed).not.toContain("No active Workspace authorization recorded");
  });

  it("labels native setup as Workspace settings and keeps ChatGPT recovery at ChatGPT", async () => {
    fixture.listConnections.mockResolvedValue([connection]);
    await load();
    fixture.states[4] = true;
    fixture.states[7] = "gmail";
    const html = render();
    expectUnknownHealth(html);
    expect(html).toContain("Workspace connection settings");
    expect(html).toContain("Gmail Workspace setup");
    expect(html).toContain("Workspace has saved Gmail connection metadata");
    expect(html).toContain("This does not confirm connection health in your ChatGPT account.");
    expect(html).toContain("Workspace: Connected");
    expect(html).toContain('href="https://chatgpt.com/"');
  });
});
