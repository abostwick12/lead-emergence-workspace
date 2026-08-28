import { describe, expect, it } from "vitest";
import {
  MCP_CATALOG,
  filterMcpCatalog,
  getMcpSetupLabel,
  getMcpDisplayStatus
} from "../lib/workspace/mcp-catalog";
import { INTEGRATION_PROVIDER_IDS, INTEGRATION_PROVIDERS } from "../lib/integrations/providers";
import type { IntegrationConnection } from "../lib/workspace/types";

describe("MCP catalog", () => {
  it("labels unreleased provider capabilities honestly", () => {
    expect(MCP_CATALOG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "logos",
          name: "Logos",
          category: "Faith",
          detail: "Planned study-library connection"
        })
      ])
    );
  });

  it("filters by category and search text", () => {
    expect(filterMcpCatalog(MCP_CATALOG, "planned", "Faith").map((entry) => entry.id)).toEqual(["logos", "youversion"]);
    expect(filterMcpCatalog(MCP_CATALOG, "planned", "All").map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["logos", "gmail", "linkedin"])
    );
  });

  it("uses persisted connection status only when Workspace metadata exists", () => {
    const gmail = MCP_CATALOG.find((entry) => entry.id === "gmail");
    const logos = MCP_CATALOG.find((entry) => entry.id === "logos");
    const connections: IntegrationConnection[] = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        provider: "gmail",
        status: "reconnect_required",
        connected_account_label: null,
        scopes: [],
        last_success_at: null,
        last_error_code: null
      }
    ];

    expect(gmail && getMcpDisplayStatus(gmail, connections)).toBe("reconnect_required");
    expect(logos && getMcpDisplayStatus(logos, connections)).toBe("catalog_only");
  });

  it("gives every catalog connection a concrete, non-secret setup contract", () => {
    expect(MCP_CATALOG.map((entry) => entry.id)).toEqual(INTEGRATION_PROVIDER_IDS);
    for (const entry of MCP_CATALOG) {
      const provider = INTEGRATION_PROVIDERS[entry.id];
      expect(entry.supportsWorkspaceMetadata).toBe(true);
      expect(provider.credentialFamily).not.toHaveLength(0);
      expect(["oauth", "oauth1", "api_key", "github_app", "mcp_oauth"]).toContain(provider.connectionMethod);
      expect(typeof provider.consumerConnectionReady).toBe("boolean");
      expect(getMcpSetupLabel(entry)).toBe(provider.setupLabel);
    }
  });

  it("keeps ChatGPT and Claude on the Workspace OAuth channel instead of accepting provider API keys", () => {
    expect(INTEGRATION_PROVIDERS.chatgpt.connectionMethod).toBe("mcp_oauth");
    expect(INTEGRATION_PROVIDERS.claude.connectionMethod).toBe("mcp_oauth");
    expect(INTEGRATION_PROVIDERS.chatgpt.credentialFamily).toBe("workspace_mcp");
    expect(INTEGRATION_PROVIDERS.claude.credentialFamily).toBe("workspace_mcp");
    expect(INTEGRATION_PROVIDERS.chatgpt.consumerConnectionReady).toBe(true);
    expect(INTEGRATION_PROVIDERS.claude.consumerConnectionReady).toBe(true);
  });

  it("does not collect consumer external credentials before their individual provider release", () => {
    for (const providerId of INTEGRATION_PROVIDER_IDS) {
      if (providerId === "chatgpt" || providerId === "claude") continue;
      expect(INTEGRATION_PROVIDERS[providerId].consumerConnectionReady).toBe(false);
    }
    expect(INTEGRATION_PROVIDERS.gmail.scopes).not.toContain("https://www.googleapis.com/auth/gmail.compose");
    expect(INTEGRATION_PROVIDERS.slack.scopes).not.toContain("chat:write");
    expect(INTEGRATION_PROVIDERS.powerpoint.scopes).not.toContain("Files.ReadWrite");
  });
});
