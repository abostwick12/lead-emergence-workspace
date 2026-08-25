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
  it("includes Logos with the selected Lovable capability copy", () => {
    expect(MCP_CATALOG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "logos",
          name: "Logos",
          category: "Faith",
          detail: "Study library and commentary lookup"
        })
      ])
    );
  });

  it("filters by category and search text", () => {
    expect(filterMcpCatalog(MCP_CATALOG, "commentary", "Faith").map((entry) => entry.id)).toEqual(["logos"]);
    expect(filterMcpCatalog(MCP_CATALOG, "draft", "All").map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["chatgpt", "gmail", "linkedin"])
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
    expect(logos && getMcpDisplayStatus(logos, connections)).toBe("available");
  });

  it("gives every catalog connection a concrete, non-secret setup contract", () => {
    expect(MCP_CATALOG.map((entry) => entry.id)).toEqual(INTEGRATION_PROVIDER_IDS);
    for (const entry of MCP_CATALOG) {
      const provider = INTEGRATION_PROVIDERS[entry.id];
      expect(entry.supportsWorkspaceMetadata).toBe(true);
      expect(provider.credentialFamily).not.toHaveLength(0);
      expect(["oauth", "oauth1", "api_key", "github_app"]).toContain(provider.connectionMethod);
      expect(getMcpSetupLabel(entry)).toBe(provider.setupLabel);
    }
  });
});
